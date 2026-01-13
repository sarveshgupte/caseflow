const { AsyncLocalStorage } = require('async_hooks');

const sessionStore = new AsyncLocalStorage();

const runWithSession = (session, fn) => sessionStore.run(session || null, fn);

const getActiveSession = () => sessionStore.getStore() || null;

module.exports = {
  runWithSession,
  getActiveSession,
};
