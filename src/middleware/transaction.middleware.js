const mongoose = require('mongoose');
const { recordTransactionFailure } = require('../services/transactionMonitor.service');

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const transactionMiddleware = async (req, res, next) => {
  if (req?.skipTransaction) {
    return next();
  }
  if (!mutatingMethods.has(req.method) && !req.forceTransaction) {
    return next();
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    console.warn('[transactionMiddleware] Unable to start MongoDB session:', err.message);
    recordTransactionFailure('start');
    session = null;
    req.transactionStartFailed = true;
  }
  if (!session) {
    recordTransactionFailure('unavailable');
    return res.status(503).json({ success: false, code: 'TRANSACTION_UNAVAILABLE', message: 'Transactional writes are temporarily unavailable.', action: 'retry' });
  }

  const transactionSession = {
    session,
    withTransaction: (fn) => session.withTransaction(fn),
    endSession: () => session.endSession(),
  };

  req.mongoSession = session;
  req.transactionSession = transactionSession;
  req.transactionActive = !!session;
  req.transactionCommitted = false;

  if (transactionSession) {
    const cleanup = () => transactionSession.endSession();
    res.once('finish', cleanup);
    res.once('close', cleanup);
  }

  return next();
};

module.exports = transactionMiddleware;
