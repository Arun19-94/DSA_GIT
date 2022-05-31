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

var DB_NAME   = 'coupen_history';

var fields = {
  name: {
    type: String,
    required: true
  },
  campaign: { 
    type: Schema.Types.ObjectId, 
    ref: Campaign.col,
    required: true
  },
  advertiser: {
    type: Schema.Types.ObjectId, 
    ref: Advertiser.col,
    required: true
  },
  // user - Advertiser user who made payment
  user: {
    type: Schema.Types.ObjectId, 
    ref: User.col,
    required: true
  },
  usedDate: Date,
  status: { // 1. AVAILABLE || 2. USED
    type: String,
    required: true
  },
  amount: { // 1. AVAILABLE || 2. USED
    type: Number,
    required: true
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