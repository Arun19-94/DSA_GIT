this.clientErrorHandler = (err, req, res, next) => {
  if (req.xhr) {
    return res.status(500).send(err);
  }
  return next(err);
};

module.exports = this;
