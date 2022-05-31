var mongoose = require('mongoose');
var { Schema } = mongoose;

var DB_NAME = 'user';
var MySchema = new mongoose.Schema()

var fields = {
  name: {
    required: true,
    type: String
  },
  password: {
    required: true,
    type: String
  },
  userType: {
    required: true,
    type: String,
    default: "advertiser"
  },
  networkOwnerId: String,
  advertiserId: String,
  // role: {
  //   required: true,
  //   type: String
  // },
  email: String,
  company: String,
  auth: Object,
  permissions: [],
  disableSessionTimeout: Boolean,
  language: String,
  profileImage: String,
  paypalEmail: String,
  userIdentificationNumber: {
    required: true,
    type: String
  },
  // reseller: {
  //   type: Schema.Types.ObjectId,
  //   ref: Reseller.collectionName
  // },
  customer: {
    type: mongoose.Schema.ObjectId,
    ref: 'user'
  },
  type: String // 1. RESELLER_USER || 2. CUSTOMER_ADMIN || 3. CUSTOMER_USER
};

var collection =
  { collection: DB_NAME };

var schema = new Schema(fields, collection);

