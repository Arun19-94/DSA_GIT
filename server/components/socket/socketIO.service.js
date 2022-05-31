/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Config
var config            = require('../../config/config.js');

// Lib
var Promise           = require('bluebird');

let sharedsession = require("express-socket.io-session");

var ClientSocketServ  = require('./client.socketIO.service');

let express = require('../express/express.service')

this.connect = app => {
  
  return new Promise((rs, rj) => {
    this.io = require('socket.io')(app, { pingInterval: 10000, pingTimeout: 5000 });
    this.io.of('/clientUI').use(sharedsession(express.session, {
      autoSave: true
    }));
    return rs(ClientSocketServ.watchSocket());
  });
};

module.exports = this;