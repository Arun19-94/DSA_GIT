var mongoose   = require('mongoose');
var { Schema } = mongoose;
var Promise    = require("bluebird");
var timestamps = require('mongoose-timestamp');
var paginate   = require('mongoose-paginate');
var Media      = require('../media/media.schema');
var Location   = require('../sign/location/location.schema');
var Sign       = require('../sign/sign.schema');
var MySchema   = new mongoose.Schema()

var DB_NAME   = 'groupDetails';

var fields = {
  signType: {
    required: true,
    type: String, // 1. SIGN || 2. GROUP
    default: 'GROUP'
  },
  groupType: {
    type: String // 1. PUBLIC || 2. PRIVATE || 3. NONE - when creating a sign.
  },
  childs: [],
  childsDetails: [{ type: Schema.Types.ObjectId, ref: Sign.col }],
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
  country: {
    type: String
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
  discountValue: {
    type: Number
  },
  _location: [{
    type: Schema.Types.ObjectId,
    ref: Location.col
  }],
  locationString: {
    type: String,
    default: ''
  },
  operatingHours: {
    from: String,
    to: String
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
//   unsoldMedia : [{ type: Schema.Types.ObjectId, ref: Media.col }],   // Unsold Media  - For Not booked slots
  serialNumber: {
    type: String,
    required: true
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