var Schema = require('./advertiser.schema');

// var CampaignServ = require('./campaign/campaign.service')

var io           = require('../../components/socket/client.socketIO.service');

this.create = function(advertiser) {
  advertiser = new Schema({name : advertiser.name});
  return advertiser.save();
};

this.update = function(_id, advertiser) {
  var promise = new Promise(function(resolve, reject) {
    return Schema.findOneAndUpdate({_id}, {'$set':advertiser}, {new: true}, function(err, result) {
      if (err) {
        return reject(err);
      } else if (advertiser === null) {
        return reject(new Error("Advertiser not exists!"));
      } else {
        return resolve(result);
      }
    });
  });
  return promise;
};

this.find = function(query, projection) {
  if (query == null) { query = {}; }
  if (projection == null) { projection = {}; }
  return Schema
    .find(query, projection);
};

this.getDashboardData = (user, res) => {
  var promise = new Promise(async(resolve, reject) => {
    try {
      var advertiserId = user.advertiserId
      if (!advertiserId) {
        resolve()
      }
      var data = {}
      var query = {
        advertiserId: advertiserId
      }
      // var campaigns = await(CampaignServ.find(query))
      // data.totalCampaigns = campaigns.length
      data.user = user
      res.send(data)
      res.end()
      // var activeCampaign = []
      // var pendingCampaign = [] 
      var totalMoneySpent = 0
      var usedCoupon = 0
      for (var i = 0; i < campaigns.length; i++) {
        var campaign = campaigns[i]
        // var _activeCampaignMap = {}
        // var _activeCampaign = []
        // var _pendingCampaign = []
        var _totalMoneySpent = 0
        var __totalMoneySpent = 0
        // for (var j = 0; j < campaign.campaignStatus.length; j++) {
        //   if (!_activeCampaignMap[campaign._id]) {
        //     _activeCampaignMap[campaign._id] = campaign._id
        //     _activeCampaign.push(campaign)
        //   }
        //   if (campaign.campaignStatus[j].status !== "APPROVED") {
        //     _pendingCampaign.push(campaign)
        //     _activeCampaign = []
        //     break;
        //   }
        // }
        // if (campaign.campaignStatus.length < 1) {
        //   _pendingCampaign.push(campaign)
        // }
        // for (var idx = 0; idx < _activeCampaign.length; idx++) {
        //   activeCampaign.push(_activeCampaign[idx])
        // }
        // data.activeCampaigns = activeCampaign.length;
        // for (var idx = 0; idx < _pendingCampaign.length; idx++) {
        //   pendingCampaign.push(_pendingCampaign[idx])
        // }
        // data.pendingCampaigns = pendingCampaign.length;
        if (campaign._paymentStatus === "approved") {
          for (var idx = 0; idx < campaign.paymentStatus.length; idx++) {
            _totalMoneySpent += campaign.paymentStatus[idx].paid
          }
        }
        __totalMoneySpent = _totalMoneySpent * 1
        if (campaign.coupen && campaign._paymentStatus === "approved") {
          var _usedCoupon = 0
          _usedCoupon = (__totalMoneySpent * 1) - (campaign.coupen.value  * 1)
          if (_usedCoupon <= 0) {
            _usedCoupon = __totalMoneySpent  * 1
          } else if (_usedCoupon > 0) {
            _usedCoupon = campaign.coupen.value  * 1
          }
          usedCoupon += _usedCoupon  * 1
          _totalMoneySpent = (_totalMoneySpent * 1) - (campaign.coupen.value  * 1)
          if ((_totalMoneySpent  * 1) <= 0) {
            _totalMoneySpent = 0
          }
        }
        totalMoneySpent = (_totalMoneySpent  * 1) + (totalMoneySpent  * 1)
        if ((totalMoneySpent  * 1) <= 0) {
          totalMoneySpent = 0
        }
      }
      data.totalMoneySpent = totalMoneySpent  * 1;
      data.usedCoupon = Math.round(usedCoupon * 100) / 100
      // var startDate = moment(new Date()).subtract(30, 'days');
      // var query = { 
      //   createdAt: { $gte: startDate } 
      // }
      // var signs = await(SignServ.find(query))
      // data.newSigns = signs.length;
      // var query = {
      //   advertiserId: advertiserId.toString()
      // }
      // var user = await(User.findOne(query))
      // data.user = user
      var key = advertiserId + 'ADVERTISER_DASHBOARD_DATA_CHANGE';
      io.sendUser(advertiserId, key, {
        type: 'DASHBOARD_DATA_CHANGE',
        message: data
      });
      // return resolve(data)
    } catch (err) {
      return reject(err)
    }
  });
  return promise;
}