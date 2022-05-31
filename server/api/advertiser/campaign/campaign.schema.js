var mongoose    = require('mongoose');
var { Schema }  = mongoose;
var Promise     = require("bluebird");
var timestamps  = require('mongoose-timestamp');
var paginate    = require('mongoose-paginate');
var Media       = require('../media/media.schema');
var Sign        = require('../../networkOwner/sign/sign.schema');
var Coupen      = require('../payment/coupen/coupen.schema')

var DB_NAME   = 'campaign';

var fields = {
  name: {
    required: true,
    type: String
  },
  orientation: {
    required: true,
    type: String
	},
  media : [{ type: Schema.Types.ObjectId, ref: Media.col }],
	audience: {
    location: String,
    /*radius: Number,*/ // Implement later
    priceRange: {
      from: Number,
      to: Number
    },
    viewsRange: {
      from: Number,
      to: Number
    },
    orientations: [String],
    //starRating: Number,
    screenTypes: [String],
    viewers: [String], // Walking, Driving, Train
    showListings: String, // 1. showAvailable, 2. showAllListings
    showListingsCriteria: String //1.showAllSigns, 2.showAllGroups, 3.showAll
  },
  signs : [{ type: Schema.Types.ObjectId, ref: Sign.col }],
  signTypeData:[],
	budget: {
    period: String,
    price: Number,
    currency: String,
    setDateRange: Boolean,
    from: Date,
    to: Date,
    bookingFrom: String,
    bookingTo: String,
    timeZoneOffset: String,
    periodInDays:Number
  },
  advertiserId: {
    type: String,
    required: true
  },
  _paymentStatus: String,
  paymentErrorResponse: Object,
  paymentStatus: [
    {
      paid: Number, // Amount with discount
      originalAmount: Number, // Amount without discount
      status: String, // Payment - SUCCESS || FAILURE
      reason: String, // Payment Failure Reason
      bookingStatus: String, // BOOKED || UNBOOKED
      bookingErrorReason: String,
      paidDate: Date,
      bookingByGroup: {
        type: Boolean,
        default: false
      },
      sign: {
        type: Schema.Types.ObjectId, 
        ref: Sign.col
      },
      paymentType: {
        type: String, // 1. NORMAL_PAYMENT || GROUP_PAYMENT
        default: 'NORMAL_PAYMENT'
      }
    }
  ], 
  campaignStatus: [
    {
      status: String, // Campaing - PENDING || RESUBMITED || APPROVED || REJECTED
      media: {
        type: Schema.Types.ObjectId, 
        ref: Media.col
      },
      sign: {
        type: Schema.Types.ObjectId, 
        ref: Sign.col
      },
      bookingByGroup: {
        type: Boolean,
        default: false
      },
      publishedDate: Date,
      statusChangingDate: Date
    }
  ],
  coupen: {
    type: Schema.Types.ObjectId, 
    ref: Coupen.col
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