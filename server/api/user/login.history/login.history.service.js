/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Lib
var Promise = require('bluebird');
var path = require('path');
var useragent = require('useragent');
useragent(true);
var IPLocation = require('iplocation').default;

// var async = require('asyncawait/async');

// var await = require('asyncawait/await');
// Schema
var LoginHistory = require('./login.history.schema');
var UserServ = require('../user.service');
var ClientServSocket = require('../../../components/socket/client.socketIO.service');

this.getAllLoginLogs = function (mac, params) {
  var { skip } = params;
  var { limit } = params;
  var { searchText } = params;
  var filter = [];
  filter = {
    $and: [
      { mac },
      {
        $or: [
          { action: 'login' }
        ]
      }
    ]
  };
  return LoginHistory.find(filter).sort('-time').lean().skip(skip).limit(limit);
};

this.getTotalLoginLogCount = (mac, searchText) =>
  new Promise(function (resolve, reject) {
    var filter = [];
    filter = {
      $and: [
        { mac },
        {
          $or: [
            { action: 'login' }
          ]
        }
      ]
    };
    return LoginHistory.count(filter, function (err, count) {
      if (err) {
        return reject(err);
      } else {
        return resolve(count);
      }
    });
  })
  ;

this.create = function (req, token, user) {
  var ua = useragent.is(req.headers['user-agent']);
  var agent = useragent.parse(req.headers['user-agent']);
  var browser = agent.toAgent();
  var os = agent.os.toString();
  var device = agent.device.toString();
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
  ip = ip.split(',')[0];
  ip = ip.split(':').slice(-1);
  if (ip && (ip.length > 0)) {
    ip = ip[0];
  }
  //geo = IPLocation.lookup(ip)
  IPLocation(ip).then(function(location) {
    var loginHistory = {
      userId: user._id,
      action: 'login',
      time: new Date(),
      ip,
      geo: location,
      userAgent: ua,
      browser,
      os,
      device,
      cookieToken: token,
      status: 'IN',
      cognitoToken: token
    };

    loginHistory = new LoginHistory(loginHistory);
    return loginHistory.save();
  });

  var query =
    { userId: user._id };
  return LoginHistory.findOneAndUpdate(query, { '$set': { cognitoToken: token } }, { multi: true }, function (err, result) { });
};

this.findActiveUser = token =>
  new Promise(function (resolve, reject) {
    var query = {
      cookieToken: token,
      status: 'IN'
    };
    return LoginHistory
      .findOne(query)
      .then(function (loginHistory) {
        if (loginHistory && loginHistory.userId) {
          return UserServ
            .findOne({ _id: loginHistory.userId })
            .then(user => resolve(user)).catch(err => reject(err));
        } else {
          return reject(new Error('Invalid token.'));
        }
      }).catch(err => reject(err));
  })
  ;

this.findCognitoToken = cookieToken =>
  new Promise(function (resolve, reject) {
    var query = {
      cookieToken,
      status: 'IN'
    };
    return LoginHistory
      .findOne(query)
      .then(function (loginHistory) {
        if (loginHistory) {
          return resolve(loginHistory.cognitoToken);
        } else {
          return reject(new Error('Invalid token.'));
        }
      }).catch(err => reject(err));
  })
  ;

this.logoutCognito = (cookieToken, req) =>
  new Promise(function (resolve, reject) {
    var query = {
      cookieToken,
      status: 'IN'
    };
    return LoginHistory.findOneAndUpdate(query, { '$set': { status: 'OUT' } }, { multi: true }, function (err, result) {
      if (err) {
        return reject(err);
      } else {
        ClientServSocket.logout(req.session.user);
        return resolve(result);
      }
    });
  })
  ;

this.findByQuery = async(query) => {
  try {
    var result = await(LoginHistory.find(query))
    return result
  } catch (err) {
    return err
  }
};

module.exports = this;