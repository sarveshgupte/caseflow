const Case = require('../models/Case.model');
const Task = require('../models/Task');
const Client = require('../models/Client.model');
const Attachment = require('../models/Attachment.model');
const Comment = require('../models/Comment.model');
const Category = require('../models/Category.model');
const User = require('../models/User.model');
const { recordAdminAudit } = require('./adminAudit.service');

const getCaseKey = (caseDoc) => caseDoc?.caseId || caseDoc?.caseNumber;

const getActorXID = (req) => req?.user?.xID || req?.user?.xid || req?.actorXID || null;
const getFirmId = (req, fallbackDoc) => req?.firmId || req?.user?.firmId || fallbackDoc?.firmId || null;
const getSession = (req, explicitSession) => explicitSession || req?.transactionSession?.session || req?.mongoSession || null;

const emitAudit = async ({ action, modelName, doc, req, reason }) => {
  if (!req) return;
  try {
    await recordAdminAudit({
      actor: getActorXID(req) || 'UNKNOWN_ACTOR',
      firmId: getFirmId(req, doc) || 'UNKNOWN_FIRM',
      userId: req.user?._id || null,
      action: `${action} ${modelName}`,
      target: doc?._id?.toString?.() || null,
      scope: 'admin',
      requestId: req.requestId || req.headers?.['x-request-id'] || null,
      status: req.transactionCommitted ? 200 : (req.res?.statusCode || 200),
      durationMs: req.requestDurationMs,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
      reason,
    });
  } catch (err) {
    console.warn('[SOFT_DELETE][AUDIT] Failed to record audit:', err.message);
  }
};

const applyDocumentDeleteMarkers = async (doc, { actorXID, reason, session }) => {
  if (!doc) return null;
  if (!doc.deletedAt) {
    doc.deletedAt = new Date();
    doc.deletedByXID = actorXID || null;
    doc.deleteReason = reason || null;
  }
  return doc.save({ session });
};

const restoreMany = async ({ model, filter, req, session }) => {
  const query = model.find({ ...filter });
  if (session && query.session) query.session(session);
  if (query.includeDeleted) query.includeDeleted();
  const docs = await query.exec();
  const restoredBy = getActorXID(req);
  for (const doc of docs) {
    if (!doc.deletedAt) continue;
    doc.restoreHistory = Array.isArray(doc.restoreHistory) ? doc.restoreHistory : [];
    doc.restoreHistory.push({ restoredAt: new Date(), restoredByXID: restoredBy || null });
    doc.deletedAt = null;
    doc.deletedByXID = null;
    doc.deleteReason = null;
    await doc.save({ session });
  }
  return docs;
};

const softDeleteMany = async ({ model, filter, req, reason, session }) => {
  const query = model.find({ ...filter });
  if (session && query.session) query.session(session);
  if (query.includeDeleted) query.includeDeleted();
  const docs = await query.exec();
  const actorXID = getActorXID(req);
  for (const doc of docs) {
    await applyDocumentDeleteMarkers(doc, { actorXID, reason, session });
  }
  return docs;
};

const ensureCategoryNotInUse = async (categoryDoc, session) => {
  const countQuery = Case.countDocuments({ categoryId: categoryDoc._id });
  if (session && countQuery.session) countQuery.session(session);
  if (countQuery.includeDeleted) countQuery.includeDeleted();
  const inUseCount = await countQuery.exec();
  if (inUseCount > 0) {
    const err = new Error('Category is in use by existing cases and cannot be deleted');
    err.statusCode = 400;
    throw err;
  }
};

const cascadeDeletes = async (modelName, doc, req, session, reason) => {
  if (modelName === 'Client') {
    const relatedCases = await softDeleteMany({
      model: Case,
      filter: { clientId: doc.clientId, firmId: doc.firmId },
      req,
      reason,
      session,
    });
    for (const caseDoc of relatedCases) {
      await cascadeDeletes('Case', caseDoc, req, session, reason);
    }
  }
  if (modelName === 'Case') {
    await softDeleteMany({ model: Task, filter: { case: doc._id, firmId: doc.firmId }, req, reason, session });
    const caseKey = getCaseKey(doc);
    await softDeleteMany({ model: Attachment, filter: { caseId: caseKey }, req, reason, session });
    await softDeleteMany({ model: Comment, filter: { caseId: caseKey }, req, reason, session });
  }
};

const softDelete = async ({ model, filter, req, reason }) => {
  const session = getSession(req);
  if (model.modelName === 'Category') {
    const categoryQuery = model.findOne({ ...filter });
    if (session && categoryQuery.session) categoryQuery.session(session);
    if (categoryQuery.includeDeleted) categoryQuery.includeDeleted();
    const categoryDoc = await categoryQuery.exec();
    if (!categoryDoc) return null;
    await ensureCategoryNotInUse(categoryDoc, session);
  }

  const query = model.findOne({ ...filter });
  if (session && query.session) query.session(session);
  if (query.includeDeleted) query.includeDeleted();
  const doc = await query.exec();
  if (!doc) return null;

  // User deletes disable login rather than removing data
  if (model.modelName === 'User') {
    doc.status = 'DISABLED';
    doc.isActive = false;
  }

  await applyDocumentDeleteMarkers(doc, { actorXID: getActorXID(req), reason, session });
  await cascadeDeletes(model.modelName, doc, req, session, reason);
  await emitAudit({ action: 'SOFT_DELETE', modelName: model.modelName, doc, req, reason });
  return doc;
};

const ensureParentsActive = async (modelName, doc, session) => {
  if (modelName === 'Case' && doc.clientId) {
    const parentClientQuery = Client.findOne({ clientId: doc.clientId });
    if (session && parentClientQuery.session) parentClientQuery.session(session);
    if (parentClientQuery.includeDeleted) parentClientQuery.includeDeleted();
    const parentClient = await parentClientQuery.exec();
    if (parentClient?.deletedAt) {
      const err = new Error('Cannot restore case while client is deleted');
      err.statusCode = 400;
      throw err;
    }
  }
  if (modelName === 'Task' && doc.case) {
    const parentCaseQuery = Case.findOne({ _id: doc.case });
    if (session && parentCaseQuery.session) parentCaseQuery.session(session);
    if (parentCaseQuery.includeDeleted) parentCaseQuery.includeDeleted();
    const parentCase = await parentCaseQuery.exec();
    if (parentCase?.deletedAt) {
      const err = new Error('Cannot restore task while parent case is deleted');
      err.statusCode = 400;
      throw err;
    }
  }
  if ((modelName === 'Attachment' || modelName === 'Comment') && doc.caseId) {
    const parentCaseQuery = Case.findOne({ $or: [{ caseId: doc.caseId }, { caseNumber: doc.caseId }] });
    if (session && parentCaseQuery.session) parentCaseQuery.session(session);
    if (parentCaseQuery.includeDeleted) parentCaseQuery.includeDeleted();
    const parentCase = await parentCaseQuery.exec();
    if (parentCase?.deletedAt) {
      const err = new Error('Cannot restore child while parent case is deleted');
      err.statusCode = 400;
      throw err;
    }
  }
};

const restoreDocument = async ({ model, filter, req }) => {
  const session = getSession(req);
  const query = model.findOne({ ...filter });
  if (session && query.session) query.session(session);
  if (query.includeDeleted) query.includeDeleted();
  const doc = await query.exec();
  if (!doc || !doc.deletedAt) return doc;

  await ensureParentsActive(model.modelName, doc, session);

  doc.restoreHistory = Array.isArray(doc.restoreHistory) ? doc.restoreHistory : [];
  doc.restoreHistory.push({
    restoredAt: new Date(),
    restoredByXID: getActorXID(req) || null,
  });
  doc.deletedAt = null;
  doc.deletedByXID = null;
  doc.deleteReason = null;
  if (model.modelName === 'User') {
    doc.isActive = true;
    if (doc.status === 'DISABLED') {
      doc.status = 'ACTIVE';
    }
  }
  await doc.save({ session });

  // Restore children that were soft-deleted with the parent
  if (model.modelName === 'Case') {
    const caseKey = getCaseKey(doc);
    await restoreMany({
      model: Task,
      filter: { case: doc._id, firmId: doc.firmId, deletedAt: { $ne: null } },
      req,
      session,
    });
    await restoreMany({
      model: Attachment,
      filter: { caseId: caseKey, firmId: doc.firmId, deletedAt: { $ne: null } },
      req,
      session,
    });
    await restoreMany({
      model: Comment,
      filter: { caseId: caseKey, firmId: doc.firmId, deletedAt: { $ne: null } },
      req,
      session,
    });
  }

  await emitAudit({ action: 'RESTORE', modelName: model.modelName, doc, req });
  return doc;
};

const buildDiagnostics = async () => {
  const models = [
    { name: 'User', model: User },
    { name: 'Client', model: Client },
    { name: 'Case', model: Case },
    { name: 'Task', model: Task },
    { name: 'Attachment', model: Attachment },
    { name: 'Comment', model: Comment },
    { name: 'Category', model: Category },
  ];

  const parsedRetention = Number.parseInt(process.env.SOFT_DELETE_RETENTION_DAYS || '90', 10);
  const retentionDays = Number.isFinite(parsedRetention) && parsedRetention > 0 ? parsedRetention : 90;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const summary = await Promise.all(models.map(async ({ name, model }) => {
    const deletedCountQuery = model.countDocuments({ deletedAt: { $ne: null } });
    if (deletedCountQuery.includeDeleted) deletedCountQuery.includeDeleted();
    const oldestQuery = model.findOne({ deletedAt: { $ne: null } })
      .sort({ deletedAt: 1 })
      .select({ deletedAt: 1 });
    if (oldestQuery.includeDeleted) oldestQuery.includeDeleted();
    const eligibleQuery = model.countDocuments({
      deletedAt: { $lte: cutoff },
    });
    if (eligibleQuery.includeDeleted) eligibleQuery.includeDeleted();
    const [deletedCount, oldest, eligibleForPurge] = await Promise.all([
      deletedCountQuery.exec(),
      oldestQuery.lean().exec(),
      eligibleQuery.exec(),
    ]);
    return {
      entity: name,
      deletedCount,
      oldestDeletedAt: oldest?.deletedAt || null,
      eligibleForPurge,
    };
  }));

  return {
    retentionDays,
    cutoff: cutoff.toISOString(),
    summary,
  };
};

module.exports = {
  softDelete,
  restoreDocument,
  buildDiagnostics,
};
