const path = require('path');

const express = require('express');

const angularJson = require('../angular.json');

module.exports = (app) => {
  let dist = path.join(__dirname, `../${angularJson.projects['digital-smart'].architect.build.options.outputPath}/`)
  app.use('/', express.static(dist));
  
  require('./api/admin/user/user.route')(app);
  require('./api/advertiser/campaign/campaign.route')(app);
  require('./api/advertiser/media/media.route')(app);
  require('./api/advertiser/notification/notification.route')(app);
  require('./api/advertiser/payment/payment.route')(app);
  require('./api/advertiser/payment/coupen/coupen.route')(app);
  require('./api/advertiser/payment/coupenHistory/coupenHistory.route')(app);
  require('./api/auth/auth.route')(app);
  require('./api/networkOwner/sign/sign.route')(app);
  require('./api/networkOwner/media/media.route')(app);
  require('./api/networkOwner/notification/notification.route')(app);
  require('./api/networkOwner/sign/location/location.route')(app);
  require('./api/networkOwner/sign/country/country.route')(app);
  require('./api/networkOwner/networkOwner.route')(app);
  require('./api/user/user.route')(app);

  return app.get('*', (req, res) => res.sendFile(path.join(__dirname, `../${angularJson.projects['digital-smart'].architect.build.options.outputPath}/index.html`)));
}