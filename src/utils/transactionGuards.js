const { executeWrite } = require('./executeWrite');

const guardTransaction = (req) => {
  if (!req || !req.transactionActive) {
    const err = new Error('Write attempted without active transaction');
    err.statusCode = 500;
    throw err;
  }
};

const wrapWriteHandler = (handler) => async (...args) => {
  const [req] = args;
  guardTransaction(req);
  return executeWrite({
    req,
    fn: async () => handler(...args),
  });
};

module.exports = {
  guardTransaction,
  wrapWriteHandler,
};
