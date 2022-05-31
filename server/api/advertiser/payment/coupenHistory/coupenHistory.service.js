var CoupenHistory = require('./coupenHistory.schema');

this.find = (query = {}) => {
  return CoupenHistory
    .find(query)
}

this.update = (id, coupen) => {
  var promise = new Promise((resolve, reject) => {
    return CoupenHistory.findOneAndUpdate({ _id: id }, { '$set': coupen }, { new: true }, (err, coupenHistory) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(coupenHistory);
      }
    });
  });
  return promise;
}