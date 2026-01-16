const noFirmNoTransaction = (req, _res, next) => {
  req.skipFirmContext = true;
  req.skipTransaction = true;
  next();
};
module.exports = { noFirmNoTransaction };
