const Config = require('../../config/config.js');

if(Config.mongo.applicationDB === 'local') {
  const local = require('./mongoose.local.service')
  this.connect = local.connect
  this.connectAndDrop = local.connectAndDrop
} else {
  const atlas = require('./mongoose.atlas.service')
  this.connect = atlas.connect
}
