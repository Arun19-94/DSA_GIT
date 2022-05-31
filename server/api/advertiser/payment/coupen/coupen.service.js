var Coupen      = require('./coupen.schema');

var signServ     = require('../../../networkOwner/sign/sign.service')

var CampaignServ = require('../../campaign/campaign.service')

var BookingServ  = require('../../../networkOwner/sign/booking/booking.service')

var moment       = require('moment')

var async        = require('asyncawait/async');

var await        = require('asyncawait/await');

this.find = function(query) {
  if (query === null) {
    query = {}
  }
  return Coupen
    .find(query)
}

this.updateCoupon = async(function(_id, coupon) {
  var promise = new Promise(function(resolve, reject) {
    try {
      var _coupon = await(Coupen.findOneAndUpdate({_id}, {'$set': coupon}, {new: true}))
      if (_coupon === null) {
        return reject(new Error("Coupen not exists!"));
      } else {
        return resolve(_coupon)
      }
    } catch(err) {
      return reject(err)
    }
  });
  return promise;
})

this.createCoupen = async(function(coupon) {
  var promise = new Promise(function(resolve, reject) {
    try {
      var _coupon = await(Coupen.createAsync(coupon))
      return resolve("created Coupen")
    } catch(err) {
      return reject(err)
    }
  });
  return promise;
})