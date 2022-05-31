var Schema = require('./networkOwner.schema');

var paymentSummary = require('../advertiser/payment/paymentSummary/paymentSummary.service')

var SignServ = require('../networkOwner/sign/sign.service')

var User = require('../user/user.service')

var io = require('../../components/socket/client.socketIO.service')

var Campaign = require('../advertiser/campaign/campaign.schema')

this.create = networkOwner => {
  networkOwner = new Schema({ name: networkOwner.name });
  return networkOwner.save();
};

this.update = (_id, networkOwner) => {
  var promise = new Promise((resolve, reject) => {
    return Schema.findOneAndUpdate({ _id }, { '$set': networkOwner }, { new: true }, (err, result) => {
      if (err)
        return reject(err);
      else
        return resolve(result);
    });
  });
  return promise;
};

this.getDashboardData = networkOwnerId => {
  var promise = new Promise(async (resolve, reject) => {
    try {
      if (!networkOwnerId)
        resolve()
      var data = {}
      // var signs = await(SignServ.find({networkOwnerId: networkOwnerId}, {_id: 1}))
      // data.totalSigns = signs.length
      // var signIds = []
      // for(var i = 0; i < signs.length; i++) {
      //   signIds.push(signs[i]._id.toString())
      // }
      // var query = { 'signs' : { $in : signIds } }
      // var campaigns = await(CampaignServ.find(query))
      // data.totalCampaign = campaigns.length
      var advertiserMap = {}
      var campaignMap = {}
      var totalAdvertisers = 0;
      var totalRevenue = 0;
      var _totalCampaign = 0;
      // for(var i = 0; i < campaigns.length; i++) {
      //   var campaign = campaigns[i]
      //   if(!advertiserMap[campaign.advertiserId] && campaign._paymentStatus === 'approved') {
      //     advertiserMap[campaign.advertiserId] = campaign.advertiserId
      //     totalAdvertisers++;
      //   }
      //   var paymentStatus = campaign.paymentStatus
      //   for(var j = 0; j < paymentStatus.length; j++) {
      //     var _paymentStatus = paymentStatus[j]
      //     if(signIds.indexOf(_paymentStatus.sign.toString()) > -1 && campaign._paymentStatus === 'approved') {
      //       if (_paymentStatus.paymentType === 'GROUP_PAYMENT' && _paymentStatus.paid) {
      //         var originalRate = _paymentStatus.paid / 0.9
      //         var revenue = (originalRate * 60) / 100
      //         totalRevenue += revenue.toFixed() * 1
      //       } else if (_paymentStatus.paymentType !== 'GROUP_PAYMENT' && _paymentStatus.paid) {
      //         var revenue = (_paymentStatus.paid * 70) / 100
      //         totalRevenue += revenue.toFixed() * 1
      //       }
      //     }
      //   }
      // }
      var paymentData = await (paymentSummary.findNetworkOwnerId(networkOwnerId))
      for (let paymentLength = 0; paymentLength < paymentData.length; paymentLength++) {
        var payment = paymentData[paymentLength]
        if (!advertiserMap[payment.advertiserId]) {
          advertiserMap[payment.advertiserId] = payment.advertiserId
          totalAdvertisers++;
        }
        if (!campaignMap[payment.campaignId]) {
          campaignMap[payment.advertiserId] = payment.campaignId
          _totalCampaign++;
        }
        totalRevenue = totalRevenue + payment.amountRecived
      }
      data.totalAdvertisers = totalAdvertisers
      data.totalCampaign = _totalCampaign
      data.totalRevenue = totalRevenue
      var signs = await (SignServ.find({ networkOwnerId: networkOwnerId, active: true, status: { $ne: "DELETED" }, signType: { $ne: 'GROUP' } }).lean())
      data.activeSigns = signs.length;
      var query = {
        networkOwnerId: networkOwnerId.toString()
      }
      var user = await (User.findOne(query))
      data.user = user
      if (user.advertiserId && user.networkOwnerId)
        var userId = user.advertiserId.toString()
      else
        if (user.advertiserId && !user.networkOwnerId)
          var userId = user.advertiserId.toString()
        else if (user.networkOwnerId && !user.advertiserId)
          var userId = user.networkOwnerId.toString()
      var key = user.networkOwnerId + '_DASHBOARD_DATA_CHANGE';
      io.sendUser(userId, key, {
        type: 'DASHBOARD_DATA_CHANGE',
        message: data
      });
      resolve(data)
    } catch (err) {
      reject(err)
    }
  })
  return promise;
}

this._getDashboardData = (networkOwnerId, advertiserId, dateFilter) => {
  let promise
  return promise = new Promise(async (rs, rj) => {
    try {
      let data = {}
      data.activeSignsCount = await (SignServ.count({ networkOwnerId: networkOwnerId, active: true, status: { $ne: "DELETED" }, signType: { $ne: 'GROUP' } }).lean())
      // let payments = await (paymentSummary.findNetworkOwnerId(networkOwnerId))
      // data.totalRevenue = payments.reduce((totalPrice, payment) => totalPrice + payment.amountRecived, 0)
      let activeCampaignQuery = {
        $and: [
          {
            advertiserId: advertiserId
          },
          {
            'budget.bookingTo': {
              $gte: dateFilter.currentDate
            }
          },
          {
            'budget.bookingFrom': {
              $gte: dateFilter.currentDate
            }
          },
          {
            _paymentStatus: 'approved'
          }
        ]
      }
      let campaigns = await(Campaign.find(activeCampaignQuery))
      let activeCampaigns = []
      for (let i = 0; i < campaigns.length; i++) {
        let campaign = campaigns[i];
        for (let j = 0; j < campaign.campaignStatus.length; j++) {
          let campaignStatus = campaign.campaignStatus[j];
          if (campaignStatus.status !== "APPROVED")
            break
          else if (j + 1 === campaign.campaignStatus.length)
            activeCampaigns.push(campaign)
        }
      }
      data.activeCampaignsCount = activeCampaigns.length
      return rs(data)
    } catch (err) {
      return rj(err)
    }
  })
}

this.getFilteredRevenue = (networkOwnerId, dateFilter) => {
  let promise
  return promise = new Promise(async (rs, rj) => {
    try {
      if (dateFilter !== 'all')
        var query = {
          $and: [
            { networkOwnerId: networkOwnerId },
            {
              campaignStartDate: { $gte: new Date(dateFilter.from) }
            },
            // {
            //   campaignEndDate: { $lte: new Date(dateFilter.to) }
            // }
          ]
        }
      else
        var query = { networkOwnerId: networkOwnerId }
      let [totalRevenue] = await (paymentSummary.findRevenue(query))
      return rs(totalRevenue)
    } catch (err) {
      return rj(err)
    }
  })
}