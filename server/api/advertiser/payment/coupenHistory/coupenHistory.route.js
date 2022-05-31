var config          = require('../../../../config/config.js');

var path            = require("path");

var index           = `${config.server.context}/api/advertiser/payment/coupenHistory`;

var CoupenHistoryServ     = require("./coupenHistory.service");

var AuthCognitoServ = require('../../../../components/auth/cognito/auth');

var async          = require('asyncawait/async');

var await          = require('asyncawait/await');

var moment              = require('moment')

var join = link => path.join(index, link != null ? link : "");

module.exports = function(app) {

};
