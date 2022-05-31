var mongoose  = require('mongoose');
var { Schema }    = mongoose;
var Promise   = require("bluebird");
var timestamps = require('mongoose-timestamp');
var paginate  = require('mongoose-paginate');
var Sign        = require('../sign.schema');
var Campaign        = require('../../../advertiser/campaign/campaign.schema');
var Group        = require('../../group/group.schema');

var DB_NAME   = 'booking';

var fields = {
  slotCode: {
    required: true,
    type: String
  },
  from: {
    required: true,
    type: Date
  },
  to: {
    required: true,
    type: Date
  },
  sign: {
    required: true,
    type: Schema.Types.ObjectId, 
    ref: Sign.col
  },
  campaign: {
    required: true,
    type: Schema.Types.ObjectId, 
    ref: Campaign.col
  },
  paymentType: {
    type: String, // 1. NORMAL_PAYMENT || GROUP_PAYMENT
    default: 'NORMAL_PAYMENT'
  },
  bookingByGroup: {
    type: Boolean,
    default: false
  },
  group: {
    type: Schema.Types.ObjectId, 
    ref: Group.col
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