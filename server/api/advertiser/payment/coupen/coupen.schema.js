var mongoose    = require('mongoose');
var { Schema }  = mongoose;
var Promise     = require("bluebird");
var timestamps  = require('mongoose-timestamp');
var paginate    = require('mongoose-paginate');
var Advertiser  = require('../../advertiser.schema');
var NetworkOwner= require('../../../networkOwner/networkOwner.schema');
var User        = require('../../../user/user.schema');
var Campaign    = require('../../campaign/campaign.schema');
var Sign        = require('../../../networkOwner/sign/sign.schema');

var DB_NAME   = 'coupen';

var fields = {
  name: {
    type: String,
    required: true
  },
  from: {
    type: Date,
    required: true
  },
  to: {
    type: Date,
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  valueType: {
    type: String,
    required: true
  },
  useLimit: {
    type: Number,
  },
  transactionMinLimit: {
    type: Number,
  },
  active: Boolean
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