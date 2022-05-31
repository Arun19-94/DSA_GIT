var mongoose    = require('mongoose');
var { Schema }  = mongoose;
var Promise     = require("bluebird");
var timestamps  = require('mongoose-timestamp');
var paginate    = require('mongoose-paginate');

var DB_NAME   = 'network_owner_media';

var fields = {
  type: String, // 1. PROFILE, 2. OWN_MEDIA 3. UNSOLD_MEDIA
  name: {
    required: true,
    type: String
  },
  meta: Object,
  networkOwnerId: String
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