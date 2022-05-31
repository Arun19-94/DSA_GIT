var mongoose   = require('mongoose');
var { Schema } = mongoose;
var Promise    = require("bluebird");
var timestamps = require('mongoose-timestamp');
var paginate   = require('mongoose-paginate');
var Media      = require('../media/media.schema');
var Location   = require('./location/location.schema');
var MySchema   = new mongoose.Schema()

var DB_NAME   = 'sign';

var fields = {
  signType: {
    required: true,
    type: String, // 1. SIGN || 2. GROUP
    default: 'SIGN'
  },
  groupType: {
    type: String // 1. PUBLIC || 2. PRIVATE || 3. NONE - when creating a sign.
  },
  childs: [{ type: mongoose.Schema.ObjectId, ref: MySchema.col }],
  name: {
    required: true,
    type: String
  },
  token: {
    required: true,
    type: String,
    unique : true
  },
  claimId: String,
  claimable: Boolean,
  mac: {
    type: String
  },
  ip: {
    type: String
  },
  info: Object,
  orientation: {
    required: true,
    type: String
  },
  screenType: {
    required: true,
    type: String
  },
  dimension: {
    type: Number
  },
  dimensionUnit: {
    type: String
  },
  height: {
    type: Number
  },
  width: {
    type: Number
  },
  sizeUnit: {
    type: String
  },
  streetAddress1: {
    type: String
  },
  streetAddress2: {
    type: String
  },
  city: {
    type: String
  },
  state: {
    type: String
  },
  postalCode: {
    type: String
  },
  locationString: {
    type: String
  },
  country: {
    type: String
  },
  slots: { // Total No of slots
    required: true,
    type: Number
  },
  availableSlots: { // Public slots
    required: true,
    type: Number
  },
  _slots: [
    {
      code: String, // System genterated like 1, 2 etc upto Number of slots not able to change by customer
      name: String, // By default same code will assigned as name, Customer can able to change
    }
  ],
  ownSlots: [
    {
      code: String, // System genterated like 1, 2 etc upto Number of slots not able to change by customer
      name: String, // By default same code will assigned as name, Customer can able to change
    }
  ],
  holdTime: {
    required: true,
    type: Number
  },
  holdTimeUnit: {
    required: true,
    type: String
  },
  pricePerSlot: {
    required: true,
    type: Number
  },
  discountValue: {
    type: Number
  },
  currency: {
    required: true,
    type: String
  },
  slotPeriod: {
    required: true,
    type: String,
    default: 'perWeek'
  },
  viewers: {
    type: [String]
  },
  totalAvgViewersCount: {
    type: Number
  },
  avgViewersCountWalking: {
    type: Number
  },
  avgViewersCountDriving: {
    type: Number
  },
  avgViewersCountTrain: {
    type: Number
  },
  requestInterval: {
    type: Number,
    default:30
  },
  _location: [{
    type: Schema.Types.ObjectId,
    ref: Location.col
  }],
  operatingHours: {
    from: String,
    to: String
  },
  establishmentType: {
    type: String
  },
  establishmentName: {
    type: String
  },
  description: {
    type: String
  },
  networkOwnerId: {
    type: String
  },
  active: {
    type: Boolean,
    required: true,
    default: false
  },
  isHidden: {
    type: Boolean,
    required: true,
    default: true
  },
  status: {  // 1. CREATED || 2. DELETED || 3. CLAIMED || 4. UNCLAIMED
    type: String,
    required: true,
    default: 'CREATED'
  },
  profileMedia: {
    type: Schema.Types.ObjectId,
    ref: Media.col
  },
  ownMedia : [{ type: Schema.Types.ObjectId, ref: Media.col }],     // Own Media - For Network owner reserved slot
  unsoldMedia : [{ type: Schema.Types.ObjectId, ref: Media.col }],   // Unsold Media  - For Not booked slots
  serialNumber: {
    type: String,
    required: true
  },
  timeZone: {
    type: String,
    default: 'America/New_York'
  },
  offset: {
    type: String,
    default: '-05:00'
  },
  forceFullyUpdatePlaylist: {
    type: Boolean,
    default: true
  },
  package: String,
  lastUsedMacAddress: String,
  isEvent: {
    type: Boolean,
    default: false
  },
  animation: {
    type: Boolean,
    default: true
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