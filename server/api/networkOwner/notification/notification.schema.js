var mongoose = require('mongoose');
var { Schema } = mongoose;
var Promise = require("bluebird");
var timestamps = require('mongoose-timestamp');
var paginate = require('mongoose-paginate');
var Sign = require('../sign/sign.schema');
var Media = require('../../advertiser/media/media.schema');
var Campaign = require('../../advertiser/campaign/campaign.schema');
var NetworkOwner = require('../networkOwner.schema');
var Advertiser = require('../../advertiser/advertiser.schema');

var DB_NAME = 'network_owner_notification';

var fields = {
  type: String,   // MEDIA, PAYMENT, CHILDS_REMOVED_FROM_GROUP
  status: String, // 1) Campaing - PENDING || RESUBMITED || APPROVED || REJECTED || REPLACE_MEDIA 2) Payment - SUCCESS || FAILURE 3) REMOVED_FROM_GROUP
  reason: String, // 1) Media Rejected Reason 2) Payment Failure Reason
  comment: String, // Rejected Comment
  isRead: Boolean, // TRUE || FALSE
  paid: Number,
  originalAmount: Number,
  coupenName: String,
  paymentType: {
    type: String, // 1. NORMAL_PAYMENT || GROUP_PAYMENT
    default: 'NORMAL_PAYMENT'
  },
  childs: [{ // For send a notification to particular child owner when the group deactivated.
    type: Schema.Types.ObjectId,
    ref: Sign.col
  }],
  sign: {
    type: Schema.Types.ObjectId,
    ref: Sign.col
  },
  media: {
    type: Schema.Types.ObjectId,
    ref: Media.col
  },
  oldMedia: {
    type: Schema.Types.ObjectId,
    ref: Media.col
  },
  campaign: {
    type: Schema.Types.ObjectId,
    ref: Campaign.col
  },
  networkOwner: {
    type: Schema.Types.ObjectId,
    ref: NetworkOwner.col
  },
  advertiser: {
    type: Schema.Types.ObjectId,
    ref: Advertiser.col
  },
  campaignStatusId: {
    type: String
  },
  bookingByGroup: {
    type: Boolean,
    default: false
  }
};


var collection =
  { collection: DB_NAME };

var schema = new Schema(fields, collection);

schema.plugin(timestamps);
schema.plugin(paginate);

var model = mongoose.model(DB_NAME, schema);
Promise.promisifyAll(model);

module.exports = model;
module.exports.col = DB_NAME;