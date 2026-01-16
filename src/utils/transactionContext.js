const { AsyncLocalStorage } = require('async_hooks');

const sessionStore = new AsyncLocalStorage();

const SKIP_TRANSACTION_SESSION = { skipTransaction: true };

const runWithSession = (session, fn) => sessionStore.run(session || null, fn);

const runWithoutTransaction = (fn) => sessionStore.run(SKIP_TRANSACTION_SESSION, fn);

const getActiveSession = () => sessionStore.getStore() || null;

module.exports = {
  runWithoutTransaction,
  runWithSession,
  getActiveSession,
};
