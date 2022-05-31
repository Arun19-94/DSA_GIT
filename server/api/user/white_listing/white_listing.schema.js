const mongoose  = require('mongoose');
const { Schema }    = mongoose;
const Promise   = require("bluebird");

const DB_NAME   = 'white_listing';

const fields = {
  time         : {
    type       : Date,
    default    : Date.now
  },
  ip           : String,
  
};

const collection =
  {collection: DB_NAME};

const schema = new Schema(fields, collection);

const model = mongoose.model(DB_NAME, schema);
Promise.promisifyAll(model);

module.exports = model;
module.exports.col = DB_NAME;