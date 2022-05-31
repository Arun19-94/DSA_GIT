var mongoose = require('mongoose');
var { Schema } = mongoose;
var Promise = require("bluebird");
var timestamps = require('mongoose-timestamp');
var paginate = require('mongoose-paginate');
var Sign = require('../../networkOwner/sign/sign.schema');
var Media = require('../media/media.schema');
var Campaign = require('../campaign/campaign.schema');
var NetworkOwner = require('../../networkOwner/networkOwner.schema');
var Advertiser = require('../advertiser.schema');

var DB_NAME = 'advertisers_notification';

var fields = {
  type: String,   // MEDIA || CAMPAIGN_START || CAMPAIGN_END
  status: String, // 1) Media - APPROVED || REJECTED || REPLACE_MEDIA
  reason: String, // 1) Media Rejected Reason
  comment: String, // Rejected Comment
  isRead: Boolean, // TRUE || FALSE
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