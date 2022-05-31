var mongoose = require('mongoose');
var { Schema } = mongoose;
var Promise = require("bluebird");

var DB_NAME = 'serialnumber';

var fields = {
    type: {
        type: String
    },
    serialNumber: {
        type: Number
    }
}
var collection = { collection: DB_NAME };

var schema = new Schema(fields, collection);

var model = mongoose.model(DB_NAME, schema);
Promise.promisifyAll(model);

module.exports = model;
module.exports.col = DB_NAME;