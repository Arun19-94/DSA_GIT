var mongoose = require('mongoose');
var { Schema } = mongoose;
var Promise = require("bluebird");
var timestamps = require('mongoose-timestamp');
var paginate = require('mongoose-paginate');
var User = require('../user/user.schema');
var MySchema = new mongoose.Schema()

var DB_NAME = 'log';

var fields = {
  user: {
    type: Schema.ObjectId,
    ref: User.col,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  logType: {
    type: String, // CURD || TRANSACTION
    default: 'CURD',
    required: true
  },
  action: {
    type: String, // TRANSACTION_WITHOUT_COUPON_PENDING || TRANSACTION_WITH_COUPON_PENDING || TRANSACTION_WITHOUT_COUPON_COMPLETED || TRANSACTION_WITH_COUPON_COMPLETED || // FOR IMPORT LISTING 1. CREATED || 2. UPDATE
    required: true
  },
  time: {
    type: Date,
    required: true
  },
  status: String, // 1. SUCCESS || 2. ERROR   // When the user try to import listings, then the created status will be updated here.
  reason: String, // If the import listing having any error while creating a listing then it will store that reason here.
  detail: {
    type: Object
  }
}

var collection =
  { collection: DB_NAME };

var schema = new Schema(fields, collection);

schema.plugin(timestamps);
schema.plugin(paginate);

var model = mongoose.model(DB_NAME, schema);
Promise.promisifyAll(model);

module.exports = model;
module.exports.col = DB_NAME;