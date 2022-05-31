var mongoose   = require('mongoose');
var { Schema } = mongoose;
var Promise    = require("bluebird");
var timestamps = require('mongoose-timestamp');
var paginate   = require('mongoose-paginate');

var DB_NAME   = 'offline_service';

var fields = {
  mac: String,
  lanMac: String,
  userId: String,
  action: String,
  time: {
    type: Date,
    default: Date.now
  }
};

var collection =
  {collection: DB_NAME};

var schema = new Schema(fields, collection);

schema.plugin(timestamps);
schema.plugin(paginate);

var model = mongoose.model(DB_NAME, schema);
Promise.promisifyAll(model);

module.exports = model;
module.exports.col = DB_NAME;