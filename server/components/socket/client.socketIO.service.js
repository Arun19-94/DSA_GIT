/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// IO
var clients, customerId, idx, macIds, userId;
var SocketServ        = require(('./socketIO.service'));

// Lib
var Promise     = require('bluebird');

var session     = require('client-sessions');

var cookie      = require('cookie');

var clientMacIds = {};
var clientSockets = {};

this.watchSocket = () => {
  return new Promise((rs, rj) => {
    buildListener();
    return rs();
  });
};

var buildListener = () => {
  return SocketServ.io.of('/clientUI').on('connect', socket => {
    var _cookie;
    // io.sockets.connected[clients.socket].emit('user-already-joined',data);
    let user = socket.handshake.session.user
    if(!user) {
      return;
    }
    var advertiserId = user.advertiserId;
    var networkOwnerId = user.networkOwnerId;
    var userId = advertiserId ? advertiserId : networkOwnerId;
    var cSockets = clientSockets[userId];
    if (!cSockets) {
      cSockets = [];
    }
    clientSockets[userId] = cSockets;
    cSockets.push(socket);
    
    return socket.on('disconnect', () => {
      let user = socket.handshake.session.user
      if(!user) {
        return;
      }
      var advertiserId = user.advertiserId;
      var networkOwnerId = user.networkOwnerId;
      var userId = advertiserId ? advertiserId : networkOwnerId;
      var cSockets = clientSockets[userId];
      if (cSockets) {
        var idx = cSockets.indexOf(socket);
        return cSockets.splice(idx, 1);
      }
    });
  });
};

this.sendUser = (userId, key, msg) => {
  if (!key) {
    return;
  }
  var clients = clientSockets[userId];
  if (!clients) {
    return;
  }
  if(!key) {
    return;
  }
  return Array.from(clients).map((client) =>
    client.emit(key, msg));
};

this.logout = user => {
  if (!user) {
    return;
  }
  var advertiserId = user.advertiserId;
  var networkOwnerId = user.networkOwnerId;
  var userId = advertiserId ? advertiserId : networkOwnerId;
  delete clientMacIds[userId];
  return delete clientSockets[userId];
};

module.exports = this;