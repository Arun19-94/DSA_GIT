var config          = require('../../../config/config');

var path            = require("path");

var index           = `${config.server.context}/api/advertisers/payment`;

var PaymentServ     = require("./payment.service");

var AuthCognitoServ = require('../../../components/auth/cognito/auth');

var async          = require('asyncawait/async');

var await          = require('asyncawait/await');

// var PaymentSer = require('./paymentSummary/paymentSummary.service');

var join = link => path.join(index, link != null ? link : "");

module.exports = function(app) {

  app.get(join("/:id"), AuthCognitoServ.isAuthenticated(), getGroupRevenue);

  app.post(join("/getDataOfAddedSign"), AuthCognitoServ.isAuthenticated(), getDataOfAddedSign);

  app.post(join("/paginationForPayment"), AuthCognitoServ.isAuthenticated(), paginationForPayment);

  app.get(join("/UpdateSignId/updateSignsOfRevenue"),  UpdateSignId);

  app.get(join("/getGraph/:periodCriteria"), AuthCognitoServ.isAuthenticated(),  getGraph);

  // For advertiser payment history page
  app.post(join("/paginationForPaymentDetails"), AuthCognitoServ.isAuthenticated(), paginationForPaymentDetails);

  app.get(join("/networkOwnerRevenueSummary/:conditionsData"), AuthCognitoServ.isAuthenticated(), networkOwnerRevenueSummary);

  app.get(join("/networkOwnerGeneratedRevenue/:conditionsData"), AuthCognitoServ.isAuthenticated(), networkOwnerGeneratedRevenue);

  app.get(join("/networkOwnerBookedSlot/:conditionsData"), AuthCognitoServ.isAuthenticated(), networkOwnerBookedSlot);

  app.get(join("/networkOwnerCampaignCount/:conditionsData"), AuthCognitoServ.isAuthenticated(), networkOwnerCampaignCount);

};

var networkOwnerRevenueSummary = async(req, res) => {
  try {
    let user = req.session.user;
    let networkOwnerId = user.networkOwnerId;
    let params = JSON.parse(req.params.conditionsData)
    let data = await(PaymentServ.networkOwnerPaymentSummary(params, networkOwnerId))
    res.send(data);
  } catch(err) {
    res.status(400).send(err.message);
  }

}

var networkOwnerGeneratedRevenue = async(req, res) => {
  try {
    let user = req.session.user;
    let networkOwnerId = user.networkOwnerId;
    let params = JSON.parse(req.params.conditionsData)
    let data = await(PaymentServ.networkOwnerGeneratedRevenue(params, networkOwnerId))
    res.send(data);
  } catch(err) {
    res.status(400).send(err.message);
  }

}

var networkOwnerBookedSlot = async(req, res) => {
  try {
    let user = req.session.user;
    let networkOwnerId = user.networkOwnerId;
    let params = JSON.parse(req.params.conditionsData)
    let data = await(PaymentServ.networkOwnerBookedSlot(params, networkOwnerId))
    res.send(data);
  } catch(err) {
    res.status(400).send(err.message);
  }

}

var networkOwnerCampaignCount = async(req, res) => {
  try {
    try {
      let user = req.session.user;
      let networkOwnerId = user.networkOwnerId;
      let params = JSON.parse(req.params.conditionsData)
      let data = await(PaymentServ.networkOwnerCampaignCount(params, networkOwnerId))
      res.send(data);
    } catch(err) {
      res.status(400).send(err.message);
    }
  } catch(err) {
    res.status(400).send(err.message);
  }

}

var paginationForPayment = async(req, res)=> {
  var networkOwnerId, params, response, user;
  user = req.user;
  networkOwnerId = user.networkOwnerId;
  params = req.body;
  response = {};
  try {
    var counts = await(PaymentServ.getDetailOfNetwork(params, networkOwnerId))
    response.count = counts.count;
    if (response.count <=0) {
      return res.send(response)
    }
    response.signs = counts.signs;
    // if (params.previousCount !== response.count || params.previousFilter!== params.filter || params.searchText !== params.previousSearchTest){
    //   var payments = await(PaymentServ.getNetworkAll(params, networkOwnerId))
    //   response.payments = payments;
    // }
    res.send(response);
  } catch(err) {
    res.status(400).send(err.message);
  }
};

var paginationForPaymentDetails = async(req, res) =>{
  var advertiserId, params, response, user;
  user = req.user;
  advertiserId = user.advertiserId;
  params = req.body;
  response = {};
  try {
    var paymentDetails = await(PaymentServ.paginationForPaymentDetails(params, advertiserId))
    response.count = paymentDetails.count;
    response.paymentDetails = paymentDetails;
    res.send(response);
  } catch(err) {
    res.status(400).send(err.message);
  }
};

var getGroupRevenue = async(function(req, res) {
  user = req.user;
  var groupId = req.params.id
  try {
    var data = {}
    var groupRevenue = await(PaymentServ.getGroupRevenue(groupId))
    data.groupRevenue = groupRevenue
    res.send(groupRevenue);
  } catch (err) {
    res.status(400).send(err);
  }
})

var getDataOfAddedSign = async(function(req, res) {
  user = req.user;
  var groupId = req.params.id
  var params = req.body;
  try {
    var data = {}
    var groupRevenue = await(PaymentServ.getGroupRevenue(params.groupId, params.childIds))
    data.groupRevenue = groupRevenue
    res.send(groupRevenue);
  } catch (err) {
    res.status(400).send(err);
  }
})

var UpdateSignId = async(function(req, res) {
  await(PaymentSer.UpdateSignId())
  return
})

var getGraph = async(function(req, res) {
  user = req.user;
  var period = req.params.period
  res.send()
  try {
    // var data = {}
    // var groupRevenue = await(PaymentServ.getGroupRevenue(groupId))
    // data.groupRevenue = groupRevenue
    // res.send(groupRevenue);
  } catch (err) {
    res.status(400).send(err);
  }
})