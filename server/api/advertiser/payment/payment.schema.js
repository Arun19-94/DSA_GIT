var mongoose    = require('mongoose');
var { Schema }  = mongoose;
var Promise     = require("bluebird");
var timestamps  = require('mongoose-timestamp');
var paginate    = require('mongoose-paginate');
var Advertiser  = require('../advertiser.schema');
var NetworkOwner= require('../../networkOwner/networkOwner.schema');
var User        = require('../../user/user.schema');
var Campaign    = require('../campaign/campaign.schema');
var Sign        = require('../../networkOwner/sign/sign.schema');

var DB_NAME   = 'payment_history';

var fields = {
  paymentMethod: String, // Paypal, netbanking, credit card, debit card etc.
  currency: String,
  amount: {
    required: true,
    type: Number
  },
  paidAmount: Number,
  status: String, // created || approved || error
  reason: String,
  payerId: String,
  paymentId: String, // id received from Paypal or other provider
  token: String,
  createResponse: Object, // Intermediate Response received from Paypal or other provider
  successResponse: Object, // Success Response received from Paypal or other provider
  errorResponse: Object, // Cancel or Error Response received from Paypal or other provider
  period: {
    from: Date,
    to: Date
  },
  paymentDetails: [
    {
      amount: Number, // Amount with discount
      sign: {
        type: Schema.Types.ObjectId, 
        ref: Sign.col
      },
      paymentType: {
        type: String, // 1. NORMAL_PAYMENT || GROUP_PAYMENT
        default: 'NORMAL_PAYMENT'
      },
      originalAmount: Number // Amount without discount
    }
  ],
  campaign: { 
    type: Schema.Types.ObjectId, 
    ref: Campaign.col 
  },
  advertiser: {
    type: Schema.Types.ObjectId, 
    ref: Advertiser.col 
  },
  // user - Advertiser user who made payment
  user: {
    type: Schema.Types.ObjectId, 
    ref: User.col 
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