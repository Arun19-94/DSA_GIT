var mongoose    = require('mongoose');
var { Schema }  = mongoose;
var Promise     = require("bluebird");
var timestamps  = require('mongoose-timestamp');
var paginate    = require('mongoose-paginate');

var DB_NAME   = 'payment_summary';

var fields = {
  signId: {
    required: true,
    type: mongoose.Schema.ObjectId
  },
  signType: {
    type: String, 
    default: 'SIGN'
  },
  signName:{
    type: String,
    required: true
  },
  networkOwnerId: {
    type: String,
    required: true
  },
  amountRecived :{
    type: Number,
    required: true
  },
  amountPaid :{
    type: Number,
    required: true
  },
  DSARevenue :{
    type: Number
  },
  _group:{
    type: mongoose.Schema.ObjectId
  },
  advertiserId: {
    type: String,
    required: true
  },
  campaignName: {
    type: String,
  },
  coupenAmount: {
    type: Number  
  },
  campaignStatus: {
    type: String
  },
  campaignId: {
    type: String,
  },
  campaignStartDate: {
    type: Date,
  },
  campaignEndDate: {
    type: Date,
  },
  totalSlot: {
    type: Number,
    default:0
  },
  bookingByGroup: {
    type: Boolean,
    default: false
  },
  _createdAt: {
    type: Date,
    default: new Date()
  }
}
var collection = {collection: DB_NAME};

var schema = new Schema(fields, collection);

schema.plugin(timestamps);
schema.plugin(paginate);

var model = mongoose.model(DB_NAME, schema);
Promise.promisifyAll(model);

module.exports = model;
module.exports.col = DB_NAME;