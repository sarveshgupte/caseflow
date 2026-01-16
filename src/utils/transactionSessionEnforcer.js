const mongoose = require('mongoose');
const { getActiveSession } = require('./transactionContext');

const ensureSession = (providedSession = null) => {
  if (providedSession) {
    return providedSession;
  }
  const session = getActiveSession();
  if (session?.skipTransaction) {
    return null;
  }
  if (!session) {
    const err = new Error('Write attempted without active transaction');
    err.statusCode = 500;
    throw err;
  }
  return session;
};

const applyOptionsSession = (args, index, session) => {
  if (!session) {
    return;
  }
  if (args.length <= index) {
    args[index] = { session };
    return;
  }
  const existing = args[index];
  if (existing == null || typeof existing !== 'object') {
    args[index] = { session };
    return;
  }
  if (!existing.session) {
    args[index] = { ...existing, session };
  }
};

const wrapStaticMethod = (methodName, optionsIndex) => {
  const original = mongoose.Model[methodName];
  if (!original) return;
  mongoose.Model[methodName] = function (...args) {
    const existingOptions = args[optionsIndex];
    const session = ensureSession(
      existingOptions && typeof existingOptions === 'object' ? existingOptions.session : null
    );
    if (!session) {
      return original.apply(this, args);
    }
    applyOptionsSession(args, optionsIndex, session);
    return original.apply(this, args);
  };
};

const originalSave = mongoose.Model.prototype.save;
mongoose.Model.prototype.save = function (options, ...rest) {
  const session = ensureSession(options && typeof options === 'object' ? options.session : null);
  if (!session) {
    return originalSave.call(this, options, ...rest);
  }
  let finalOptions = options;
  if (!options || typeof options !== 'object') {
    finalOptions = { session };
  } else if (!options.session) {
    finalOptions = { ...options, session };
  }
  return originalSave.call(this, finalOptions, ...rest);
};

const originalCreate = mongoose.Model.create;
mongoose.Model.create = function (docs, options, callback) {
  let finalOptions = options;
  let cb = callback;
  if (typeof options === 'function') {
    cb = options;
    finalOptions = undefined;
  }
  const session = ensureSession(finalOptions && typeof finalOptions === 'object' ? finalOptions.session : null);
  if (!session) {
    if (cb) {
      return originalCreate.call(this, docs, finalOptions, cb);
    }
    return originalCreate.call(this, docs, finalOptions);
  }
  if (!finalOptions || typeof finalOptions !== 'object') {
    finalOptions = { session };
  } else if (!finalOptions.session) {
    finalOptions = { ...finalOptions, session };
  }
  if (cb) {
    return originalCreate.call(this, docs, finalOptions, cb);
  }
  return originalCreate.call(this, docs, finalOptions);
};

wrapStaticMethod('insertMany', 1);
wrapStaticMethod('updateOne', 2);
wrapStaticMethod('updateMany', 2);
wrapStaticMethod('findOneAndUpdate', 2);
wrapStaticMethod('findByIdAndUpdate', 2);
wrapStaticMethod('deleteOne', 1);
wrapStaticMethod('deleteMany', 1);
wrapStaticMethod('findOneAndDelete', 1);
wrapStaticMethod('findByIdAndDelete', 1);
