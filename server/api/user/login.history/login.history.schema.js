const mongoose  = require('mongoose');
const { Schema }    = mongoose;
const Promise   = require("bluebird");

const DB_NAME   = 'login_history';

const fields = {
  userId       : String,
  action       : String,
  time         : {
    type       : Date,
    default    : Date.now
  },
  ip           : String,
  geo          : Object,
  userAgent    : Object,
  browser      : String,
  os           : String,
  device       : String,
  cookieToken  : String,
  status       : String,
  cognitoToken : String
};

const collection =
  {collection: DB_NAME};

const schema = new Schema(fields, collection);

const model = mongoose.model(DB_NAME, schema);
Promise.promisifyAll(model);

module.exports = model;
module.exports.col = DB_NAME;