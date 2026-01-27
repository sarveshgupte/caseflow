const noFirmNoTransaction = (req, _res, next) => {
  if (req.user?.role === 'SuperAdmin') {
    return next();
  }
  req.skipFirmContext = true;
  req.skipTransaction = true;
  next();
};
module.exports = { noFirmNoTransaction };
