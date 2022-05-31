const mongoose = require('mongoose');

const moment = require('moment')

const path = require('path');

const fs = require("fs");

const Promise = require('bluebird');

const s3Service = require('../../../components/aws/s3');

const s3 = s3Service.s3

const fse = require("fs-extra");

const config = require('../../../config/config.js');

const momentTimezone = require('moment-timezone');

const dateFormat = require('dateformat')

const Campaign = require('./campaign.schema');

const BookingService = require('../../networkOwner/sign/booking/booking.service');

const SignService = require('../../networkOwner/sign/sign.service');

const GroupService = require('../../networkOwner/group/group.service');

const GroupServ = require('../../networkOwner/group/group.service');

const PaypalService = require('../../../components/paypal/paypal.service');

const PaymentService = require('../payment/payment.service');

const CoupenServ = require('../payment/coupen/coupen.service')

const UserServ = require('../../user/user.service');

const PaymentSummmaryService = require('../payment/paymentSummary/paymentSummary.service');

const NetworkOwnerServ = require("../../networkOwner/networkOwner.service");

const AdvertiserServ = require('../advertiser.service');

const NotificationServ = require('../../admin/notification/notification.service')

const NetworkOwnerNotificationService = require('../../networkOwner/notification/notification.service')

const AdvertiserNotificationService = require('../notification/notification.service')

const AuditLogServ = require('../../auditLog/audit.log.service')

const User = require('../../user/user.schema');

const url = require('url')

const QueueService = require('../../networkOwner/sign/publish/publish.queue.service')

const CoupenHistory = require('../payment/coupenHistory/coupenHistory.schema')

const AdvertiserNotification = require('../notification/notification.schema')

const Sign = require('../../networkOwner/sign/sign.schema')

this.findQuery = async (query = {}) => {
  var result = await (Campaign.find(query))
  return (result);
};

this.validateCampaign = (campaign) => {
  if (!campaign.name)
    return 'Name required.'
  if (campaign.name.length > 50)
    return 'Campaign name should be less than or equal to 50 characters.'
}

this.create = (campaign) => {
  var message = this.validateCampaign(campaign)
  return new Promise((resolve, reject) => {
    if (message) {
      return reject(message);
    }
    Campaign.createAsync(campaign).then((campaign) => {
      AdvertiserServ.getDashboardData(campaign.advertiserId)
      return resolve(campaign);
    }).catch((err) => {
      return reject(err);
    });
  });
};

this._updateAudience = (campaign, user, res) => {
  // var _updateAudience = async(function(campaign, user, res) {
  var _campaign = campaign
  var promise = new Promise(async (resolve, reject) => {
    var campaign = _campaign
    var id = campaign._id;
    if (!campaign.signTypeData || campaign.signTypeData && campaign.signTypeData.length <= 0) {
      return reject("Please select the listing.")
    }
    var result = await this.calculationAndVerifySignStatus(campaign, user, "FORCREATE")
    var campaign = result.campaign;
    try {
      var _result = await this.update(id, campaign);
      if (result.errData) {
        let err = {}
        err = result.errData
        return res.status(400).send(err)
      }
      return resolve(_result)
    } catch (err) {
      return reject(err)
    }
  });
  return promise;
};

this.calculationAndVerifySignStatus = async (campaign, user, status) => {
  var campaign = campaign
  var signTypeData = campaign.signTypeData;
  var signs = []
  var groups = []
  var groupChildIds = []
  var unavilableSigns = []
  var unavilableGroups = []
  var signNamesString = ''
  var unAvilSignNamesString = ''
  var inactiveSigns = []
  var inactivegroups = []
  var zeroChildGroups = []
  var totalPrice = 0
  var groupPrice = 0
  campaign.signs = []
  var errorFlag = 0
  var _signTypeData = []
  if (campaign.budget.periodInDays) {
    totalDays = campaign.budget.periodInDays
  } else {
    var startDate = dateFormat(campaign.budget.from, "yyyy-mm-dd");
    var endDate = dateFormat(campaign.budget.to, "yyyy-mm-dd");
    var _totalDays = moment(startDate.toString()).diff(moment(endDate.toString()), 'days');
    var totalDays = Math.abs(_totalDays);
    totalDays = totalDays + 1
  }
  for (let i = 0; i < signTypeData.length; i++) {
    if (signTypeData[i].signType === "SIGN") {
      signs.push(signTypeData[i]._id)
    } else {
      if (signTypeData[i].childs) {
        groups.push(signTypeData[i]._id)
        groupChildIds.concat(signTypeData[i].childs)
      }
    }
  }
  if (signs.length > 0) {
    var signData = await (SignService.find({
      _id: {
        $in: signs
      }
    }))
    for (let i = 0; i < signData.length; i++) {
      let sign = signData[i]
      let conditionFlag = 0
      if (sign.availableSlots <= 0) {
        errorFlag = 1
        conditionFlag = 1
        unavilableSigns.push(sign._id)
        unAvilSignNamesString += (unAvilSignNamesString === '' ? '' : ', ') + +'. ' + sign.name
      }
      if (!sign.active) {
        errorFlag = 1
        conditionFlag = 1
        inactiveSigns.push(sign)
        signNamesString += (signNamesString === '' ? '' : ', ') + +'. ' + sign.name
      }

      if (conditionFlag === 0) {
        let _sign = {}
        campaign.signs.push(sign._id)
        if (status === "FORCREATE") {
          _sign = {
            _id: sign._id,
            signType: "SIGN"
          }
        } else {
          _sign = {
            _id: sign,
            signType: "SIGN"
          }
        }
        // let _sign = {_id: sign, signType:"SIGN"}
        _signTypeData.push(_sign)
        if (user.networkOwnerId.toString() === sign.networkOwnerId.toString()) {
          totalPrice = totalPrice + 0
        } else {
          totalPrice = totalPrice + ((sign.pricePerSlot / 7) * totalDays)
        }
      }
    }
  }
  if (groups.length > 0) {
    var groupData = await (GroupServ.find({
      _id: {
        $in: groups
      }
    }))
    for (let i = 0; i < groupData.length; i++) {
      groupPrice = 0
      let _sign = {}
      let childs = []
      let _group = groupData[i];
      if (_group.childsDetails.length <= 0) {
        zeroChildGroups.push(_group._id)
      } else if (!_group.active) {
        inactivegroups.push(_group)
      } else {
        for (let j = 0; j < _group.childsDetails.length; j++) {
          let sign = _group.childsDetails[j];
          conditionFlag = 0
          if (groupChildIds.indexOf(sign._id.toString())) {
            if (sign.availableSlots <= 0) {
              conditionFlag = 1
              unavilableGroups.push({
                sign: sign,
                group: _group
              })
              unAvilSignNamesString += (unAvilSignNamesString === '' ? '' : ', ') + +'. ' + sign.name
            }
            if (!sign.active) {
              conditionFlag = 1
              inactiveSigns.push(sign)
              signNamesString += (signNamesString === '' ? '' : ', ') + +'. ' + sign.name
            }
            if (conditionFlag === 0) {
              // totalPrice = totalPrice + sign.pricePerSlot
              childs.push(sign._id)
              groupPrice = groupPrice + ((sign.pricePerSlot / 7) * totalDays)
            }
          }
        }
        if (user.networkOwnerId.toString() === groupData[i].networkOwnerId.toString()) {
          totalPrice = totalPrice + 0
        } else {
          // if (_group.discountValue && _group.discountValue > 0 && _group.groupType  === "PUBLIC") {
          if (_group.discountValue && _group.discountValue > 0) {
            let discount = (groupPrice * _group.discountValue) / 100
            groupPrice = (groupPrice - discount)
            totalPrice = totalPrice + groupPrice
          } else {
            totalPrice = totalPrice + groupPrice
          }
        }
      }
      if (childs.length > 0) {
        campaign.signs.push(_group._id)
        if (status === "FORCREATE") {
          _sign = {
            _id: _group._id,
            signType: "GROUP",
            childs: childs
          }
        } else {
          _sign = {
            _id: _group,
            signType: "GROUP",
            childs: childs
          }
        }
        _signTypeData.push(_sign)
      }
    }
  }
  if (errorFlag === 1) {
    if (inactiveSigns.length > 0) {
      var data = {
        code: 'CONTAINS_INACTIVE_SIGNS',
        err: 'Following signs are deactivated ' + signNamesString + '. We have deselect the followed sign(s). Please select the sign(s) again.'
      }
    } else if (unavilableSigns.length > 0) {
      var data = {
        code: 'CONTAINS_ZERO_SIGNS',
        err: 'Following signs are no slots ' + unAvilSignNamesString + '. We have deselect the followed sign(s). Please select the sign(s) again.'
      }
    } else if (zeroChildGroups.length > 0) {
      var data = {
        code: 'CONTAINS_ZERO_SIGNS',
        err: 'Following group are sign.'
      }
    } else if (inactivegroups.length > 0) {
      var data = {
        code: 'CONTAINS_INACTIVE_GROUP',
        err: 'Following group are inactive.'
      }
    } else {
      var data = {
        err: 'Regarding inactive sign or group null or zero available slot',
        code: 'ERROR'
      }
    }
  }
  campaign.signTypeData = _signTypeData
  campaign.budget.price = (totalPrice * 1).toFixed(2)
  var result = {}
  result.campaign = campaign
  if (data) {
    result.errData = data
  }
  return result
}

this.avilableSignsAndGroupData = async (id) => {
  try {
    var query = {
      _id: mongoose.Types.ObjectId(id),
    };
    var campaign = await (Campaign.findOne(query).populate('coupen').lean());
    var data = {}
    var userName = []
    var signs = []
    var unwantedSigns = []
    var groupSigns = []
    if (!campaign) {
      data.campaign = campaign
      data.unwantedSigns = unwantedSigns
      data.userName = userName
      return data
    }
    var signIds = []
    var groupIds = []
    for (let i = 0; i < campaign.signTypeData.length; i++) {
      if (campaign.signTypeData[i].signType !== "GROUP") {
        signIds.push(mongoose.Types.ObjectId(campaign.signTypeData[i]._id.toString()))
      } else {
        groupIds.push(campaign.signTypeData[i]._id)
      }
    }
    if (signIds.length > 0) {
      // var projection = {offset:1, timeZone:1, availableSlots:1,networkOwnerId:1,pricePerSlot:1}
      var allSigns = await (SignService.find({
        _id: {
          $in: signIds
        }
      }))
    }
    if (groupIds.length > 0) {
      var allGroup = await (GroupService.find({
        _id: {
          $in: groupIds
        }
      }))
    }
    var $or = [];
    var signs = []
    if (allSigns) {
      for (let j = 0; j < allSigns.length; j++) {
        let getSign = allSigns[j];
        signs.push({
          sign: getSign
        })
        let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${getSign.offset}`;
        let bookingFromUTC = moment(bookingFrom).tz(getSign.timeZone)
        bookingFromUTC.hours(0)
        bookingFromUTC.minutes(0)
        bookingFromUTC.seconds(0)
        bookingFromUTC = bookingFromUTC.utc().format();
        let bookingTo = `${campaign.budget.bookingTo}T23:59:59${getSign.offset}`;
        let bookingToUTC = moment(bookingTo).tz(getSign.timeZone)
        bookingToUTC = bookingToUTC.utc().format();
        let bookingOneElement = this.generateBulkBookingQuery(mongoose.Types.ObjectId(getSign._id), bookingFromUTC, bookingToUTC)
        $or.push(bookingOneElement)
      }
    }
    if (allGroup) {
      for (let j = 0; j < allGroup.length; j++) {
        for (let k = 0; k < allGroup[j].childsDetails.length; k++) {
          let getSign = allGroup[j].childsDetails[k]
          signs.push({
            sign: getSign,
            group: allGroup[j]
          })
          let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${getSign.offset}`;
          let bookingFromUTC = moment(bookingFrom).tz(getSign.timeZone)
          bookingFromUTC.hours(0)
          bookingFromUTC.minutes(0)
          bookingFromUTC.seconds(0)
          bookingFromUTC = bookingFromUTC.utc().format();
          let bookingTo = `${campaign.budget.bookingTo}T23:59:59${getSign.offset}`;
          let bookingToUTC = moment(bookingTo).tz(getSign.timeZone)
          bookingToUTC = bookingToUTC.utc().format();
          $or.push(this.generateBulkBookingQuery(getSign._id, bookingFromUTC, bookingToUTC))
        }
      }
    }
    var bookingArray = await (BookingService.findBookingArray({
      $or
    }))
    var availableSigns = []
    for (let i = 0; i < signs.length; i++) {
      let _sign = signs[i].sign
      let enterFlag = 0
      for (let j = 0; j < bookingArray.length; j++) {
        if (_sign._id.toString() === bookingArray[j]._id.toString()) {
          enterFlag = 1
          if (_sign.availableSlots > bookingArray[j].count) {
            if (signs[i].group) {
              availableSigns.push({
                sign: _sign,
                group: signs[i].group
              })
            } else {
              availableSigns.push({
                sign: _sign
              })
            }
          } else {
            if (signs[i].group) {
              unwantedSigns.push({
                childs: _sign,
                group: signs[i].group
              })
            } else {
              unwantedSigns.push({
                sign: _sign
              })
            }
          }
        }
      }
      if (enterFlag === 0) {
        if (_sign.availableSlots > 0) {
          if (signs[i].group) {
            availableSigns.push({
              sign: _sign,
              group: signs[i].group
            })
          } else {
            availableSigns.push({
              sign: _sign
            })
          }
          // availableSigns.push(_sign)
        } else {
          if (signs[i].group) {
            unwantedSigns.push({
              childs: _sign,
              group: signs[i].group
            })
          } else {
            unwantedSigns.push(_sign)
          }
        }
      }
    }
    var _campaign = JSON.stringify(campaign)
    campaign = JSON.parse(_campaign)
    campaign.signs = availableSigns
    data.campaign = campaign
    data.unwantedSigns = unwantedSigns
    // data.userName = userName
    return data
  } catch (err) {
    console.log(err)
  }
};

this.findOneByIdForPayment = async (id, fromTag) => {
  try {
    var query = {
      _id: mongoose.Types.ObjectId(id),
      // advertiserId: user.advertiserId
    };
    var campaign = await (Campaign.findOne(query).populate('signs').populate('coupen').populate({
      path: 'signs',
      populate: {
        path: 'childs'
      }
    }).populate('media').populate('paymentStatus.sign').populate({
      path: 'signs',
      populate: {
        path: 'profileMedia'
      }
    }).sort('-createdAt').lean());
    // var campaign = await(Campaign.findOne(query).populate('paymentStatus.sign').sort('-createdAt').lean());
    // var campaign = await(Campaign.findOne(query).lean());
    var data = {}
    var userName = []
    var signs = []
    var unwantedSigns = []
    var groupSigns = []
    var addedGroup = {}
    if (!campaign) {
      data.campaign = campaign
      data.unwantedSigns = unwantedSigns
      data.userName = userName
      return data
    }
    var signIds = []
    var groupIds = []
    for (let i = 0; i < campaign.signTypeData.length; i++) {
      if (campaign.signTypeData[i].signType !== "GROUP") {
        // signIds.push({_id:mongoose.Types.ObjectId(campaign.signTypeData[i]._id.toString())})
        if (campaign.signTypeData[i]._id._id) {
          campaign.signTypeData[i]._id = campaign.signTypeData[i]._id._id
        }
        signIds.push(mongoose.Types.ObjectId(campaign.signTypeData[i]._id.toString()))
      } else {
        groupIds.push(campaign.signTypeData[i]._id)
      }
    }
    // console.log(signIds)
    if (signIds.length > 0) {
      var projection = {
        offset: 1,
        timeZone: 1,
        availableSlots: 1,
        networkOwnerId: 1,
        pricePerSlot: 1
      }
      // var allSigns = await(SignService.aggregateFind({_id:{$in:signIds}}, projection))
      var allSigns = await (SignService.find({
        _id: {
          $in: signIds
        }
      }, projection))
      // console.log(JSON.stringify(allSigns))
    }
    if (groupIds.length > 0) {
      var allGroup = await (GroupService.find({
        _id: {
          $in: groupIds
        }
      }))
      // console.log(JSON.stringify(allGroup))
    }
    var $or = [];
    var signs = []
    if (allSigns) {
      for (let j = 0; j < allSigns.length; j++) {
        let getSign = allSigns[j];
        signs.push({
          sign: getSign
        })
        let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${getSign.offset}`;
        let bookingFromUTC = moment(bookingFrom).tz(getSign.timeZone)
        bookingFromUTC.hours(0)
        bookingFromUTC.minutes(0)
        bookingFromUTC.seconds(0)
        bookingFromUTC = bookingFromUTC.utc().format();
        let bookingTo = `${campaign.budget.bookingTo}T23:59:59${getSign.offset}`;
        let bookingToUTC = moment(bookingTo).tz(getSign.timeZone)
        bookingToUTC = bookingToUTC.utc().format();
        let bookingOneElement = this.generateBulkBookingQuery(mongoose.Types.ObjectId(getSign._id), bookingFromUTC, bookingToUTC)
        $or.push(bookingOneElement)
      }
    }
    if (allGroup) {
      for (let j = 0; j < allGroup.length; j++) {
        for (let k = 0; k < allGroup[j].childsDetails.length; k++) {
          let getSign = allGroup[j].childsDetails[k]
          signs.push({
            sign: getSign,
            group: allGroup[j]
          })
          let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${getSign.offset}`;
          let bookingFromUTC = moment(bookingFrom).tz(getSign.timeZone)
          bookingFromUTC.hours(0)
          bookingFromUTC.minutes(0)
          bookingFromUTC.seconds(0)
          bookingFromUTC = bookingFromUTC.utc().format();
          let bookingTo = `${campaign.budget.bookingTo}T23:59:59${getSign.offset}`;
          let bookingToUTC = moment(bookingTo).tz(getSign.timeZone)
          bookingToUTC = bookingToUTC.utc().format();
          $or.push(this.generateBulkBookingQuery(getSign._id, bookingFromUTC, bookingToUTC))
        }
      }
    }
    var bookingArray = await (BookingService.findBookingArray({
      $or
    }))
    var availableSigns = []
    for (let i = 0; i < signs.length; i++) {
      let _sign = signs[i].sign
      let enterFlag = 0
      for (let j = 0; j < bookingArray.length; j++) {
        if (_sign._id.toString() === bookingArray[j]._id.toString()) {
          enterFlag = 1
          if (_sign.availableSlots > bookingArray[j].count) {
            // console.log(fromTag)
            if (fromTag && fromTag === 'AUDIENCE' && signs[i].group) {
              if (!addedGroup[signs[i].group._id.toString()]) {
                addedGroup[signs[i].group._id.toString()] = signs[i].group._id.toString()
                availableSigns.push(signs[i].group)
              }
            } else {
              availableSigns.push(_sign)
            }
          } else {
            if (signs[i].group) {
              unwantedSigns.push({
                childs: _sign,
                group: signs[i].group
              })
            } else {
              unwantedSigns.push(_sign)
            }
          }
        }
      }
      if (enterFlag === 0) {
        if (_sign.availableSlots > 0) {
          if (fromTag && fromTag === 'AUDIENCE' && signs[i].group) {
            if (!addedGroup[signs[i].group._id.toString()]) {
              addedGroup[signs[i].group._id.toString()] = signs[i].group._id.toString()
              availableSigns.push(signs[i].group)
            }
          } else {
            availableSigns.push(_sign)
          }
        } else {
          if (signs[i].group) {
            unwantedSigns.push({
              childs: _sign,
              group: signs[i].group
            })
          } else {
            unwantedSigns.push(_sign)
          }
        }
      }
    }
    var _campaign = JSON.stringify(campaign)
    campaign = JSON.parse(_campaign)
    campaign.signs = availableSigns
    data.campaign = campaign
    data.unwantedSigns = unwantedSigns
    return data
  } catch (err) {
    console.log(err)
  }
};

this.campaignPayment = async (campaign, fromTag) => {
  try {
    // var query = {
    //   _id: mongoose.Types.ObjectId(id),
    //   // advertiserId: user.advertiserId
    // };
    // var campaign = await (Campaign.findOne(query).populate('signs').populate('coupen').populate({
    //   path: 'signs',
    //   populate: {
    //     path: 'childs'
    //   }
    // }).populate('media').populate('paymentStatus.sign').populate({
    //   path: 'signs',
    //   populate: {
    //     path: 'profileMedia'
    //   }
    // }).sort('-createdAt').lean());
    // // var campaign = await(Campaign.findOne(query).populate('paymentStatus.sign').sort('-createdAt').lean());
    // // var campaign = await(Campaign.findOne(query).lean());
    var data = {}
    var userName = []
    var signs = []
    var unwantedSigns = []
    var groupSigns = []
    var addedGroup = {}
    if (!campaign) {
      data.campaign = campaign
      data.unwantedSigns = unwantedSigns
      data.userName = userName
      return data
    }
    var signIds = []
    var groupIds = []
    console.log("campaign.signTypeData.length")
    console.log(JSON.stringify(campaign.signTypeData))
    for (let i = 0; i < campaign.signTypeData.length; i++) {
      if (campaign.signTypeData[i].signType !== "GROUP") {
        // signIds.push({_id:mongoose.Types.ObjectId(campaign.signTypeData[i]._id.toString())})
        if (campaign.signTypeData[i]._id._id) {
          campaign.signTypeData[i]._id = campaign.signTypeData[i]._id._id
        }
        signIds.push(mongoose.Types.ObjectId(campaign.signTypeData[i]._id.toString()))
      } else {
        groupIds.push(campaign.signTypeData[i]._id)
      }
    }
    // console.log(signIds)
    if (signIds.length > 0) {
      var projection = {
        offset: 1,
        timeZone: 1,
        availableSlots: 1,
        networkOwnerId: 1,
        pricePerSlot: 1
      }
      // var allSigns = await(SignService.aggregateFind({_id:{$in:signIds}}, projection))
      var allSigns = await (SignService.find({
        _id: {
          $in: signIds
        }
      }, projection))
      // console.log(JSON.stringify(allSigns))
    }
    if (groupIds.length > 0) {
      var allGroup = await (GroupService.find({
        _id: {
          $in: groupIds
        }
      }))
      // console.log(JSON.stringify(allGroup))
    }
    var $or = [];
    var signs = []
    if (allSigns) {
      for (let j = 0; j < allSigns.length; j++) {
        let getSign = allSigns[j];
        signs.push({
          sign: getSign
        })
        let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${getSign.offset}`;
        let bookingFromUTC = moment(bookingFrom).tz(getSign.timeZone)
        bookingFromUTC.hours(0)
        bookingFromUTC.minutes(0)
        bookingFromUTC.seconds(0)
        bookingFromUTC = bookingFromUTC.utc().format();
        let bookingTo = `${campaign.budget.bookingTo}T23:59:59${getSign.offset}`;
        let bookingToUTC = moment(bookingTo).tz(getSign.timeZone)
        bookingToUTC = bookingToUTC.utc().format();
        let bookingOneElement = this.generateBulkBookingQuery(mongoose.Types.ObjectId(getSign._id), bookingFromUTC, bookingToUTC)
        $or.push(bookingOneElement)
      }
    }
    if (allGroup) {
      for (let j = 0; j < allGroup.length; j++) {
        for (let k = 0; k < allGroup[j].childsDetails.length; k++) {
          let getSign = allGroup[j].childsDetails[k]
          signs.push({
            sign: getSign,
            group: allGroup[j]
          })
          let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${getSign.offset}`;
          let bookingFromUTC = moment(bookingFrom).tz(getSign.timeZone)
          bookingFromUTC.hours(0)
          bookingFromUTC.minutes(0)
          bookingFromUTC.seconds(0)
          bookingFromUTC = bookingFromUTC.utc().format();
          let bookingTo = `${campaign.budget.bookingTo}T23:59:59${getSign.offset}`;
          let bookingToUTC = moment(bookingTo).tz(getSign.timeZone)
          bookingToUTC = bookingToUTC.utc().format();
          $or.push(this.generateBulkBookingQuery(getSign._id, bookingFromUTC, bookingToUTC))
        }
      }
    }
    var bookingArray = await (BookingService.findBookingArray({
      $or
    }))
    var availableSigns = []
    for (let i = 0; i < signs.length; i++) {
      let _sign = signs[i].sign
      let enterFlag = 0
      for (let j = 0; j < bookingArray.length; j++) {
        if (_sign._id.toString() === bookingArray[j]._id.toString()) {
          enterFlag = 1
          if (_sign.availableSlots > bookingArray[j].count) {
            // console.log(fromTag)
            if (fromTag && fromTag === 'AUDIENCE' && signs[i].group) {
              if (!addedGroup[signs[i].group._id.toString()]) {
                addedGroup[signs[i].group._id.toString()] = signs[i].group._id.toString()
                availableSigns.push(signs[i].group)
              }
            } else {
              availableSigns.push(_sign)
            }
          } else {
            if (signs[i].group) {
              unwantedSigns.push({
                childs: _sign,
                group: signs[i].group
              })
            } else {
              unwantedSigns.push(_sign)
            }
          }
        }
      }
      if (enterFlag === 0) {
        if (_sign.availableSlots > 0) {
          if (fromTag && fromTag === 'AUDIENCE' && signs[i].group) {
            if (!addedGroup[signs[i].group._id.toString()]) {
              addedGroup[signs[i].group._id.toString()] = signs[i].group._id.toString()
              availableSigns.push(signs[i].group)
            }
          } else {
            availableSigns.push(_sign)
          }
        } else {
          if (signs[i].group) {
            unwantedSigns.push({
              childs: _sign,
              group: signs[i].group
            })
          } else {
            unwantedSigns.push(_sign)
          }
        }
      }
    }
    var _campaign = JSON.stringify(campaign)
    campaign = JSON.parse(_campaign)
    campaign.signs = availableSigns
    data.campaign = campaign
    data.unwantedSigns = unwantedSigns
    return data
  } catch (err) {
    console.log(err)
  }
};


this.calculateBudgetForAudiencePage = async (campaign, user) => {
  if (campaign.budget.periodInDays) {
    totalDays = campaign.budget.periodInDays
  } else {
    let startDate = dateFormat(campaign.budget.from, "yyyy-mm-dd");
    let endDate = dateFormat(campaign.budget.to, "yyyy-mm-dd");
    let _totalDays = moment(startDate.toString()).diff(moment(endDate.toString()), 'days');
    let totalDays = Math.abs(_totalDays);
    totalDays = totalDays + 1
  }
  let totalCost = 0
  let campaignsResult = await (this.campaignPayment(campaign, user))
  let unwantedSignsMap = {}
  for (let j = 0; j < campaignsResult.unwantedSigns.length; j++) {
    unwantedSignsMap[campaignsResult.unwantedSigns[j].childs._id] = campaignsResult.unwantedSigns[j].childs._id
  }
  for (let i = 0; i < campaignsResult.campaign.signs.length; i++) {
    if (campaignsResult.campaign.signs[i].signType === 'GROUP') {
      for (let k = campaignsResult.campaign.signs[i].childs.length - 1; k >= 0; k--) {
        if (campaignsResult.unwantedSigns.length > 0) {
          if (unwantedSignsMap[campaignsResult.campaign.signs[i].childs[k]._id]) {
            campaignsResult.campaign.signs[i].childs.splice(k, 1)
          }
        }
      }
    }
  }
  campaign = campaignsResult.campaign
  for (let i = 0; i < campaign.signs.length; i++) {
    let sign = campaign.signs[i]
    if (user && user.networkOwnerId.toString() === sign.networkOwnerId.toString()) {
      totalCost = totalCost + (0 * 1)
    } else {
      if (sign.signType !== 'GROUP') {
        let x = (sign.pricePerSlot) / 7
        totalCost += (x * totalDays)
      } else if (sign.signType === 'GROUP') {
        let childs = sign.childs
        var totalPrice = 0
        for (let j = 0; j < childs.length; j++) {
          totalPrice += childs[j].pricePerSlot
        }
        if (sign.discountValue && sign.discountValue > 0) {
          let discount = (totalPrice * sign.discountValue) / 100
          totalPrice = (totalPrice - discount)
        }
        totalCost += (Math.round(totalPrice * 100) / 100)
        let x = (totalCost) / 7
        totalCost = (x * totalDays)
      }
    }
  }
  totalCost = (Math.round(totalCost * 100) / 100);
  return totalCost
}

this.generateBulkBookingQuery = (signId, from, to) => {
  var query = {
    '$and': [{
        sign: mongoose.Types.ObjectId(signId)
      },
      {
        '$and': [{
          '$or': [{
              "from": {
                "$lte": new Date(from)
              }
            },
            {
              "to": {
                "$gte": new Date(to)
              }
            },
            {
              "from": {
                "$gte": new Date(from)
              }
            },
            {
              "to": {
                "$lte": new Date(to)
              }
            }
          ]
        }, {
          '$and': [{
              "from": {
                "$lte": new Date(to)
              }
            },
            {
              "to": {
                "$gte": new Date(from)
              }
            }
          ]
        }]
      }
    ]
  }
  // var query = {
  //   $in:[mongoose.Types.ObjectId(signId)]
  // }
  return query
}

this.makePayment = async (res, id, campaign, user, totalPrice, coupen) => {
  try {
    var totalPrice = (totalPrice * 1).toFixed(2)
    var campaign = campaign
    var return_url = config.paypal.return_url.replace('<<port>>', config.server.port)
    var cancel_url = config.paypal.cancel_url.replace('<<port>>', config.server.port)
    var paymentData = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      redirect_urls: {
        return_url: return_url,
        cancel_url: cancel_url
      },
      transactions: [{
        amount: {
          total: totalPrice + '',
          currency: 'USD'
        },
        description: 'Payment for Campaign ' + campaign.name
      }]
    };
    var result = await (PaypalService.payNow(paymentData))
    var _url = url.parse(result.redirectUrl, true)
    var token = _url.query.token
    var payment = {
      paymentMethod: 'paypal',
      currency: 'USD',
      amount: campaign.amount,
      paidAmount: totalPrice,
      status: result.payment.state, // created || approved || canceled
      reason: '',
      paymentId: result.payment.id, // id received from Paypal or other provider
      token: token,
      createResponse: result, // Response received from Paypal or other provider
      paymentDetails: [], // Amount per sign
      campaign: campaign,
      advertiser: campaign.advertiserId,
      paidDate: new Date(),
      // user - Advertiser user who made payment
      user: user
    }
    campaign.paymentStatus = []
    var amount = 0;
    var signMap = []
    var signIds = []
    var groupMap = {}
    // var _signType
    for (let i = 0; i < campaign.signs.length; i++) {
      let _sign = campaign.signs[i];
      if (!_sign.group) {
        var nPaymentStatus = {
          sign: _sign.sign._id,
          paid: _sign.sign.paidAmount,
          paymentType: 'NORMAL_PAYMENT',
          originalAmount: _sign.sign.Amount,
          bookingStatus: 'PENDING'
        }
        if (!signMap[_sign.sign._id.toString()]) {
          signIds.push(_sign.sign._id.toString())
        }
      } else {
        var nPaymentStatus = {
          sign: _sign.sign._id,
          paid: _sign.sign.paidAmount,
          paymentType: 'GROUP_PAYMENT',
          originalAmount: _sign.sign.Amount,
          bookingStatus: 'PENDING'
        }
        if (!signMap[_sign.group._id.toString()] && !groupMap[_sign.group._id.toString()]) {
          groupMap[_sign.group._id.toString()] = _sign.group._id.toString()
          signIds.push(_sign.group._id.toString())
        }
      }
      campaign.paymentStatus.push(nPaymentStatus)
    }
    var listingDetails = []
    for (var i = 0; i < campaign.paymentStatus.length; i++) {
      var _paymentStatus = campaign.paymentStatus[i];
      var originalAmount = _paymentStatus.originalAmount.toFixed(2)
      var nPaymentStatus = {
        sign: _paymentStatus.sign,
        amount: _paymentStatus.paid,
        paymentType: _paymentStatus.paymentType,
        originalAmount: originalAmount
      }
      payment.paymentDetails.push(nPaymentStatus)
      if (_paymentStatus.sign._id)
        listingDetails.push(_paymentStatus.sign._id)
      else
        listingDetails.push(_paymentStatus.sign)
    }
    var payment = await (PaymentService.create(payment))
    var action = 'TRANSACTION_WITHOUT_COUPON_PENDING'
    var [_coupen] = await (CoupenServ.find({
      name: coupen
    }))
    if (_coupen) {
      _coupen.amount = coupen.amount
      var _coupenDelete = JSON.stringify(_coupen)
      _coupen = JSON.parse(_coupenDelete)
      delete _coupen.createdAt;
      action = 'TRANSACTION_WITH_COUPON_PENDING'
    }
    var couponAmount = null
    if (_coupen && _coupen.amount) {
      couponAmount = _coupen.amount
    }
    var detail = {}
    detail = {
      campaign: campaign._id.toString(),
      listing: listingDetails,
      coupon: _coupen,
      discountAmount: couponAmount,
      paidAmount: totalPrice,
      actualAmount: amount
    }
    var type = 'TRANSACTION'
    var query = {
      'detail.campaign': campaign._id.toString()
    }
    var [existLog] = await (AuditLogServ.find(query))
    if (existLog) {
      await (AuditLogServ.updateLog(existLog._id, {
        action: action,
        detail: detail,
        time: new Date()
      }))
    } else {
      await (AuditLogServ.createLog(user, action, detail, type))
    }
    await (Campaign.findOneAndUpdate({
      _id: campaign._id
    }, {
      '$set': {
        'budget.price': totalPrice,
        paymentStatus: campaign.paymentStatus,
        _paymentStatus: payment.status,
        coupen: _coupen,
        signs: signIds
      }
    }, {
      new: true
    }))
    return result
  } catch (err) {
    return res.status(400).send(err)
  }
}

this.paymentSuccess = async (paymentId, payerId, res, req) => {
  var query = {
    paymentId: paymentId
  };
  _self = this
  try {
    var payment = await (PaymentService.findOne(query))
    if (!payment) {
      return reject('Invalid request');
    }
    var query = {
      _id: payment.campaign._id
    };
    var user = {}
    user.advertiserId = payment.advertiser;
    var _campaign = await (this.getSlotCode(payment.campaign._id))
    var campaign = _campaign.camapign
    var user = await (UserServ.findOne({
      advertiserId: campaign.advertiserId
    }))
    var slots = _campaign.slots;
    var _coupen = JSON.parse(JSON.stringify(campaign.coupen))
    if (_coupen) {
      if (campaign.budget.price) {
        let totalPrice = campaign.budget.price
        if (_coupen.valueType && _coupen.valueType === "PERCENTAGE") {
          let couponDiscountAmount = (100 * totalPrice) / (100 - _coupen.value)
          _coupen.amount = (couponDiscountAmount - totalPrice);
        } else {
          _coupen.amount = _coupen.value
        }
      }
      var coupen = {
        name: _coupen.name,
        campaign: campaign,
        advertiser: campaign.advertiserId,
        user: user,
        usedDate: new Date(),
        status: 'USED',
        amount: _coupen.amount
      }
      coupenHistory = new CoupenHistory(coupen);
      coupenHistory.save()
    }
    try {
      response = await (PaypalService.execute(payment, payerId))
    } catch (err) {
      var _campaign = await (_self.updatePromise(campaign._id, {
        _paymentStatus: 'error',
        paymentErrorResponse: err.response
      }))
      await (PaymentService.update(payment._id, {
        status: 'error',
        errorResponse: err.response
      }))
      var notification = {
        type: 'PAYMENT',
        status: 'FAILURE',
        advertiser: campaign.advertiserId
      }
      NotificationServ.sendNotificationMailToAdvertiser(notification)
      // req.session.requestFrom = null
      // req.session.newCampaign = null
      // req.session.campaignId = null
      res.redirect('/payment')
      return res.end()
    }
    var bookingInsertArray = []
    var paymentStatusArray = []
    for (let i = 0; i < slots.length; i++) {
      let details = slots[i];
      let booking = {}
      // resultArray.push({sign:tempSign,slotCode:slotCode,Status:"UNBOOKED",group:sign.group})
      if (details.group && details.Status !== "UNBOOKED") {
        booking = {
          campaign: campaign._id,
          sign: details.sign._id,
          slotCode: details.slotCode,
          from: details.sign.bookingFromUTC,
          to: details.sign.bookingToUTC,
          paymentType: 'GROUP_PAYMENT',
          group: details.group._id
        }
      } else {
        booking = {
          campaign: campaign._id,
          sign: details.sign._id,
          slotCode: details.slotCode,
          from: details.sign.bookingFromUTC,
          to: details.sign.bookingToUTC,
          paymentType: 'NORMAL_PAYMENT'
          // group: details.group._id
        }
      }
      if (booking) {
        bookingInsertArray.push(booking)
      }
      for (let j = 0; j < campaign.paymentStatus.length; j++) {
        var paymentStatus = {}
        if (campaign.paymentStatus[j].sign.toString() === details.sign._id.toString()) {
          paymentStatus.sign = campaign.paymentStatus[j].sign;
          paymentStatus.paid = campaign.paymentStatus[j].paid.toFixed(2) * 1;
          paymentStatus.originalAmount = campaign.paymentStatus[j].originalAmount.toFixed(2) * 1;
          paymentStatus.paidDate = new Date();
          if (details.group) {
            paymentStatus.paymentType = 'GROUP_PAYMENT'
          } else {
            paymentStatus.paymentType = 'NORMAL_PAYMENT'
          }
          if (details.Status !== "UNBOOKED") {
            paymentStatus.bookingStatus = 'BOOKED';
          } else {
            paymentStatus.bookingStatus = 'UNBOOKED';
            if (details.reason && details.reason === "NOTAVALIABLE") {
              paymentStatus.bookingErrorReason = details.sign.name + ' the sign is currently unavailable because of it is not in an active stage '
            } else {
              paymentStatus.bookingErrorReason = 'Slot not available for listing ' + details.sign.name
            }
          }
          paymentStatusArray.push(paymentStatus);
        }
      }
    }
    await (BookingService.bookingBulkInsert(bookingInsertArray))
    campaign.paymentStatus = paymentStatusArray
    // var campaignBooked = await(_self.updatePromise(campaign._id, campaign))
    await (PaymentService.update(payment._id, {
      payerId: payerId,
      status: response.state,
      successResponse: response
    }))
    var query = {
      'detail.campaign': campaign._id.toString()
    }
    var [existLog] = await (AuditLogServ.find(query))
    var action = 'TRANSACTION_WITHOUT_COUPON_COMPLETED'
    if (existLog.detail.coupon) {
      action = 'TRANSACTION_WITH_COUPON_COMPLETED'
    }
    await (AuditLogServ.updateLog(existLog._id, {
      action: action,
      time: new Date()
    }))
    await (this.updateStatusOfCampaignAndNotifications(campaign, slots, res, user, req))
  } catch (err) {
    console.log(err)
    return res.status(err)
  }
}

this.getSlotCode = async (id) => {
  try {
    var query = {
      _id: mongoose.Types.ObjectId(id),
    };
    var _campaign = await (Campaign.findOne(query).populate("coupen").lean());
    var campaign = JSON.parse(JSON.stringify(_campaign))
    var data = {}
    var userName = []
    var signs = []
    var unwantedSigns = []
    var groupSigns = []
    if (!campaign) {
      data.campaign = campaign
      data.unwantedSigns = unwantedSigns
      data.userName = userName
      return data
    }
    var signIds = []
    var groupIds = []
    var signStatus = {}
    for (let j = 0; j < campaign.paymentStatus.length; j++) {
      signStatus[campaign.paymentStatus[j].sign.toString()] = campaign.paymentStatus[j].sign.toString()
    }
    for (let i = 0; i < campaign.signTypeData.length; i++) {
      if (campaign.signTypeData[i].signType !== "GROUP") {
        if (signStatus[campaign.signTypeData[i]._id.toString()]) {
          signIds.push(mongoose.Types.ObjectId(campaign.signTypeData[i]._id.toString()))
        }
      } else {
        groupIds.push(campaign.signTypeData[i]._id)
      }
    }
    if (signIds.length > 0) {
      var allSigns = await (SignService.find({
        _id: {
          $in: signIds
        }
      }))
    }
    if (groupIds.length > 0) {
      var allGroup = await (GroupService.find({
        _id: {
          $in: groupIds
        }
      }))
    }
    var $or = [];
    var signs = []
    if (allSigns) {
      for (let j = 0; j < allSigns.length; j++) {
        let getSign = allSigns[j];
        let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${getSign.offset}`;
        let bookingFromUTC = moment(bookingFrom).tz(getSign.timeZone)
        bookingFromUTC.hours(0)
        bookingFromUTC.minutes(0)
        bookingFromUTC.seconds(0)
        bookingFromUTC = bookingFromUTC.utc().format();
        let bookingTo = `${campaign.budget.bookingTo}T23:59:59${getSign.offset}`;
        let bookingToUTC = moment(bookingTo).tz(getSign.timeZone)
        bookingToUTC = bookingToUTC.utc().format();
        getSign.bookingToUTC = bookingToUTC
        getSign.bookingFromUTC = bookingFromUTC
        signs.push({
          sign: getSign
        })
        let bookingOneElement = this.generateBulkBookingQuery(mongoose.Types.ObjectId(getSign._id), bookingFromUTC, bookingToUTC)
        $or.push(bookingOneElement)
      }
    }
    if (allGroup) {
      for (let j = 0; j < allGroup.length; j++) {
        for (let k = 0; k < allGroup[j].childsDetails.length; k++) {
          let getSign = allGroup[j].childsDetails[k]
          if (signStatus[getSign._id.toString()]) {
            let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${getSign.offset}`;
            let bookingFromUTC = moment(bookingFrom).tz(getSign.timeZone)
            bookingFromUTC.hours(0)
            bookingFromUTC.minutes(0)
            bookingFromUTC.seconds(0)
            bookingFromUTC = bookingFromUTC.utc().format();
            let bookingTo = `${campaign.budget.bookingTo}T23:59:59${getSign.offset}`;
            let bookingToUTC = moment(bookingTo).tz(getSign.timeZone)
            bookingToUTC = bookingToUTC.utc().format();
            getSign.bookingToUTC = bookingToUTC
            getSign.bookingFromUTC = bookingFromUTC
            signs.push({
              sign: getSign,
              group: allGroup[j]
            })
            $or.push(this.generateBulkBookingQuery(getSign._id, bookingFromUTC, bookingToUTC))
          }
        }
      }
    }
    var bookingArray = await (BookingService.findBookingArrayWithSlot({
      $or
    }))
    var availableSigns = []
    var bookingMap = {}
    for (let i = 0; i < bookingArray.length; i++) {
      bookingMap[bookingArray[i]._id.toString()] = bookingArray[i].slots
    }
    campaign.signs = []
    campaign.signs = signs
    var resultArray = []
    for (let i = 0; i < signs.length; i++) {
      let sign = signs[i];
      var slotCode = 0
      if (!sign.group) {
        let tempSign = sign.sign;
        if (bookingMap[tempSign._id.toString()]) {
          if (tempSign.availableSlots > 0 && (tempSign.availableSlots > bookingMap[tempSign._id.toString()].length)) {
            for (let j = 0; j < tempSign.availableSlots; j++) {
              let k = j + 1
              if (bookingMap[tempSign._id.toString()].indexOf(k.toString()) <= -1) {
                slotCode = k
                break
              }
            }
            if (slotCode > 0) {
              if (tempSign.active) {
                resultArray.push({
                  sign: tempSign,
                  slotCode: slotCode,
                  Status: "BOOKED"
                })
                bookingMap[tempSign._id.toString()].push(slotCode.toString())
              } else {
                resultArray.push({
                  sign: tempSign,
                  slotCode: slotCode,
                  Status: "UNBOOKED",
                  reason: "INACTIVE"
                })
              }
            }
          } else {
            resultArray.push({
              sign: tempSign,
              slotCode: slotCode,
              Status: "UNBOOKED",
              reason: "NOTAVALIABLE"
            })
          }
        } else {
          if (tempSign.availableSlots > 0) {
            if (tempSign.active) {
              resultArray.push({
                sign: tempSign,
                slotCode: slotCode,
                Status: "BOOKED"
              })
              bookingMap[tempSign._id.toString()] = [slotCode.toString()]
            } else {
              resultArray.push({
                sign: tempSign,
                slotCode: slotCode,
                Status: "UNBOOKED",
                reason: "INACTIVE"
              })
            }
          } else {
            resultArray.push({
              sign: tempSign,
              slotCode: slotCode,
              Status: "UNBOOKED",
              reason: "NOTAVALIABLE"
            })
          }
        }
      } else {
        // grup
        let tempSign = sign.sign;
        if (bookingMap[tempSign._id.toString()]) {
          if (tempSign.availableSlots > 0 && (tempSign.availableSlots > bookingMap[tempSign._id.toString()].length)) {
            for (let j = 0; j < tempSign.availableSlots; j++) {
              let k = j + 1
              if (bookingMap[tempSign._id.toString()].indexOf(k.toString()) <= -1) {
                slotCode = k
                break
              }
            }
            if (slotCode > 0) {
              if (tempSign.active) {
                resultArray.push({
                  sign: tempSign,
                  slotCode: slotCode,
                  Status: "BOOKED",
                  group: sign.group
                })
                bookingMap[tempSign._id.toString()].push(slotCode.toString())
              } else {
                resultArray.push({
                  sign: tempSign,
                  slotCode: slotCode,
                  Status: "UNBOOKED",
                  group: sign.group,
                  reason: "INACTIVE"
                })
              }
            }
          } else {
            resultArray.push({
              sign: tempSign,
              slotCode: slotCode,
              Status: "UNBOOKED",
              group: sign.group,
              reason: "NOTAVALIABLE"
            })
          }
        } else {
          if (tempSign.availableSlots > 0) {
            if (tempSign.active) {
              resultArray.push({
                sign: tempSign,
                slotCode: slotCode,
                Status: "BOOKED",
                group: sign.group
              })
              // bookingMap[tempSign._id.toString()].push(slotCode.toString())
              bookingMap[tempSign._id.toString()] = [slotCode.toString()]
            } else {
              resultArray.push({
                sign: tempSign,
                slotCode: slotCode,
                Status: "UNBOOKED",
                group: sign.group,
                reason: "INACTIVE"
              })
            }
          } else {
            resultArray.push({
              sign: tempSign,
              slotCode: slotCode,
              Status: "UNBOOKED",
              group: sign.group,
              reason: "NOTAVALIABLE"
            })
          }
        }
      }
    }
    var campaignData = {}
    campaignData.camapign = _campaign;
    campaignData.slots = resultArray;
    return campaignData
  } catch (err) {
    return err
  }
};

this.updatePromise = (campaignId, campaign) => {
  var _campaign = JSON.stringify(campaign)
  var campaign = JSON.parse(_campaign)
  delete campaign.createdAt
  var promise = new Promise(function (resolve, reject) {
    return Campaign.findOneAndUpdate({
      _id: campaignId
    }, {
      '$set': campaign
    }, {
      new: true
    }, function (err, campaign) {
      if (err) {
        return reject(err);
      } else if (campaign === null) {
        return reject(new Error("Campaign not exists!"));
      } else {
        return resolve(campaign);
      }
    });
  });
  return promise;
}

this.updateStatusOfCampaignAndNotifications = async (campaign, slots, res, user, req, criteria) => {
  var campaign = campaign
  var slots = slots
  var res = res
  var campaignStatus = []
  var days = campaign.budget.periodInDays
  let totalPrice = campaign.budget.price
  campaign.campaignStatus = []
  for (let k = 0; k < campaign.paymentStatus.length; k++) {
    var _paymentStatus = campaign.paymentStatus[k]
    if (_paymentStatus.bookingStatus === "BOOKED") {
      for (let j = 0; j < campaign.media.length; j++) {
        let _campaignStatus = {
          sign: _paymentStatus.sign,
          media: campaign.media[j],
          publishedDate: new Date(),
          statusChangingDate: new Date(),
          status: 'PENDING'
        }
        campaignStatus.push(_campaignStatus)
      }
    }
  }
  campaign._paymentStatus = "approved"
  campaign.campaignStatus = campaignStatus
  let _coupen = null
  if (campaign.coupen) {
    _coupen = JSON.parse(JSON.stringify(campaign.coupen))
  }
  var campaign = await (this.update(campaign._id, campaign))
  req.session.requestFrom = null
  req.session.newCampaign = null
  req.session.campaignId = null
  if (!criteria) {
    res.redirect('/payment/success/' + campaign._id)
    res.end()
  } else
    res.end(JSON.stringify(campaign))
  var networkOwnerIds = []
  var notificationsArray = []
  var signs = []
  for (let k = 0; k < slots.length; k++) {
    var enterFlag = 0
    var notification = {}
    let listingData = slots[k]
    if (listingData.group && listingData.Status === "BOOKED") {
      signs.push(listingData.sign._id.toString())
      enterFlag = 1
      var paid = 0;
      notification = {
        type: 'PAYMENT',
        status: 'SUCCESS',
        isRead: false,
        sign: listingData.sign,
        // paid: paid,
        campaign: campaign,
        networkOwner: listingData.sign.networkOwnerId,
        advertiser: campaign.advertiserId,
        paymentType: 'GROUP_PAYMENT'
      }
      if (campaign.coupen) {
        notification.coupen = campaign.coupen
      }
      if (!listingData.group.discountValue) {
        listingData.group.discountValue = 0
      }
      let _paid = ((days * listingData.sign.pricePerSlot / 7) * (100 - listingData.group.discountValue)) / 100
      if (_coupen) {
        notification._coupen = _coupen
        notification.coupenName = _coupen.name
        let discountAmount = 0
        if (_coupen.valueType === 'FLAT-DISCOUNT') {
          if (totalPrice > 0) {
            let _totalPrice = totalPrice + _coupen.value
            // }
            // if (totalPrice > _coupen.value) {
            discountAmount = (_paid / _totalPrice) * _coupen.value
            paid = _paid - discountAmount
          } else {
            paid = 0,
              discountAmount = _paid
          }
        } else {
          discountAmount = (_paid * _coupen.value) / 100
          paid = (_paid * (100 - _coupen.value)) / 100
        }
        notification.discountAmount = discountAmount.toFixed(2)
      } else {
        paid = _paid
      }
      paid = paid * (70 / 100)
      notification.paid = paid.toFixed(2)
      notification.originalAmount = _paid.toFixed(2)
      // if (listingData.group.groupType === "PRIVATE") {
      //   paid = (( days *listingData.sign.pricePerSlot / 7 )* (70/100))
      //   notification.paid = paid
      // } else {
      //   let _paid = (( days * listingData.sign.pricePerSlot / 7 ) * (100-listingData.group.discountValue))/100
      //   paid = _paid * (70 / 100)
      //   notification.paid = paid
      // }
    } else if (listingData.Status === "BOOKED") {
      signs.push(listingData.sign._id.toString())
      enterFlag = 1
      // let paidAmount = (( days *listingData.sign.pricePerSlot / 7 ) * (70/100)).toFixed(2)
      let paidAmount = (days * listingData.sign.pricePerSlot / 7)
      let _paidAmount = 0
      let discountAmount = 0
      if (_coupen) {
        if (_coupen.valueType === 'FLAT-DISCOUNT') {
          if (totalPrice > 0) {
            let _totalPrice = totalPrice + _coupen.value
            discountAmount = (paidAmount / _totalPrice) * _coupen.value
            _paidAmount = paidAmount - discountAmount
          } else {
            _paidAmount = 0
            discountAmount = paidAmount
          }
        } else {
          discountAmount = (paidAmount * _coupen.value) / 100
          _paidAmount = (paidAmount * (100 - _coupen.value)) / 100
        }
      } else {
        _paidAmount = paidAmount
      }
      _paidAmount = _paidAmount * (70 / 100)
      notification = {
        type: 'PAYMENT',
        status: 'SUCCESS',
        isRead: false,
        sign: listingData.sign,
        paid: _paidAmount.toFixed(2).toString(),
        originalAmount: paidAmount.toFixed(2).toString(),
        campaign: campaign,
        networkOwner: listingData.sign.networkOwnerId,
        advertiser: campaign.advertiserId,
        paymentType: 'NORMAL_PAYMENT'
      }
      if (campaign.coupen) {
        notification.coupen = campaign.coupen
        notification._coupen = _coupen
        notification.coupenName = _coupen.name
        notification.discountAmount = discountAmount.toFixed(2).toString()
      }
    }
    if (user.networkOwnerId.toString() === listingData.sign.networkOwnerId.toString())
      enterFlag = 0
    if (enterFlag === 1) {
      if (networkOwnerIds.indexOf(listingData.sign.networkOwnerId.toString()) <= -1) {
        networkOwnerIds.push(listingData.sign.networkOwnerId.toString())
      }
      await (NetworkOwnerNotificationService.create(notification))
      await (NotificationServ.sendNotificationMailToNetworkOwner(notification))
    }
    for (let l = 0; l < campaign.campaignStatus.length; l++) {
      let _status = campaign.campaignStatus[l]
      if (_status.sign.toString() === listingData.sign._id.toString()) {
        var notificationMedia = {
          type: 'MEDIA',
          status: 'PENDING',
          isRead: false,
          sign: listingData.sign,
          media: _status.media,
          campaign: campaign,
          networkOwner: listingData.sign.networkOwnerId,
          advertiser: campaign.advertiserId,
          campaignStatusId: _status._id
        }
        notificationsArray.push(notificationMedia)
      }
    }
  }
  await (PaymentSummmaryService.create(campaign, user))
  for (var i = 0; i < notificationsArray.length; i++) {
    var notification = notificationsArray[i]
    try {
      await (NetworkOwnerNotificationService.create(notification))
    } catch (err) {
      console.log(err)
    }
    // var networkOwnerId = notification.sign.networkOwnerId
    // await(NetworkOwnerNotificationService.notifyCount(networkOwnerId, {networkOwner: networkOwnerId, isRead: false}))
  }
  for (var i = 0; i < networkOwnerIds.length; i++) {
    var networkOwnerId = networkOwnerIds[i].toString()
    NetworkOwnerServ.getDashboardData(networkOwnerId)
    AdvertiserServ.getDashboardData(campaign.advertiserId)
    let query = {
      networkOwnerId: networkOwnerId.toString()
    }
    let user = await (User.findOne(query))
    if (user.advertiserId && user.networkOwnerId) {
      var userId = user.advertiserId.toString()
    } else {
      if (user.advertiserId && !user.networkOwnerId) {
        var userId = user.advertiserId.toString()
      } else if (user.networkOwnerId && !user.advertiserId) {
        var userId = user.networkOwnerId.toString()
      }
    }
    NetworkOwnerNotificationService.notifyCount(networkOwnerId, {
      networkOwner: networkOwnerId,
      isRead: false
    }, userId)
  }
  AdvertiserNotificationService.notifyCount(user.advertiserId.toString(), {
    advertiser: user.advertiserId.toString(),
    isRead: false
  })
  await (NotificationServ.sendNotificationMailToNetworkOwner(notificationsArray))
  var queue = []
  for (var i = 0; i < signs.length; i++) {
    var sign = signs[i]
    let q = {
      signId: sign,
      time: new Date()
    }
    queue.push(q);
  }
  QueueService.insetMany(queue);
}

this.update = (_id, campaign) => {
  // var message = this.validateCampaign(campaign)
  var _campaign = JSON.stringify(campaign)
  campaign = JSON.parse(_campaign)
  delete campaign.createdAt
  delete campaign.updatedAt
  var promise = new Promise(function (resolve, reject) {
    return Campaign.findOneAndUpdate({
      _id
    }, {
      '$set': campaign
    }, {
      new: true
    }, function (err, result) {
      if (err) {
        return reject(err);
      } else if (campaign === null) {
        return reject(new Error("Campaign not exists!"));
      } else {
        return resolve(result);
      }
    });
  });
  return promise;
};

this.paymentError = token => {
  var promise = new Promise(async (resolve, reject) => {
    var query = {
      token: token
    };
    var payment = await (PaymentService.findOne(query))
    var campaign = payment.campaign
    var _payment = await (PaymentService.update(payment._id, {
      status: 'error'
    }))
    var signPaymentMap = {}
    var paymentDetail = []
    var paymentStatusMap = {}
    var notifications = []
    var networkOwnerIds = []
    for (var j = 0; j < campaign.paymentStatus.length; j++) {
      if (!paymentStatusMap[campaign.paymentStatus[j]._id]) {
        if (campaign.paymentStatus[j].paymentType === 'GROUP_PAYMENT') {
          var isDiscounted = campaign.paymentStatus[j].paid / campaign.paymentStatus[j].originalAmount
          if (isDiscounted < 1) {
            var paid = (campaign.paymentStatus[j].paid * 70) / 100
          } else if (isDiscounted === 1) {
            var paid = (campaign.paymentStatus[j].paid * 70) / 100
          }
        } else if (campaign.paymentStatus[j].paymentType === 'NORMAL_PAYMENT') {
          var paid = (campaign.paymentStatus[j].originalAmount * 70) / 100
        }
        paid = paid.toFixed(2) * 1
        var signId = campaign.paymentStatus[j].sign.toString()
        var sign = await (SignService.findOne({
          _id: signId
        }))
        var notification = {
          type: 'PAYMENT',
          status: 'FAILURE',
          isRead: false,
          sign: sign,
          paid: paid,
          campaign: campaign,
          networkOwner: sign.networkOwnerId,
          advertiser: campaign.advertiserId,
          reason: 'Canceled'
        }
        if (networkOwnerIds.indexOf(sign.networkOwnerId) <= -1) {
          networkOwnerIds.push(sign.networkOwnerId)
        }
        notifications.push(await (NetworkOwnerNotificationService.create(notification)))
        NotificationServ.sendNotificationMailToAdvertiser(notification)
        paymentStatusMap[campaign.paymentStatus[j]._id] = campaign.paymentStatus[j]._id
      }
    }
    Promise.all(notifications)
      .then(() => {
        Promise.each(networkOwnerIds, (networkOwnerId) => {
          return new Promise(async (res, rej) => {
            let query = {
              networkOwnerId: networkOwnerId.toString()
            }
            let user = await (User.findOne(query))
            if (user.advertiserId && user.networkOwnerId) {
              var userId = user.advertiserId.toString()
            } else {
              if (user.advertiserId && !user.networkOwnerId) {
                var userId = user.advertiserId.toString()
              } else if (user.networkOwnerId && !user.advertiserId) {
                var userId = user.networkOwnerId.toString()
              }
            }
            NetworkOwnerNotificationService.notifyCount(networkOwnerId, {
              networkOwner: networkOwnerId,
              isRead: false
            }, userId)
            NetworkOwnerServ.getDashboardData(networkOwnerId)
            AdvertiserServ.getDashboardData(campaign.advertiserId)
            res()
          });
        }).then(() => {
          Campaign.update({
            _id: campaign._id
          }, {
            _paymentStatus: _payment.status
          }, (err, _campaign) => {
            if (err) {
              return reject(err);
            } else {
              return resolve(campaign)
            }
          });
        }).catch(err => reject(err));
      });
  });
  return promise;
}

this.publishCampaignOnFreeSign = async (id, campaign, user, res, req) => {
  await (BookingService.delete({
    campaign: id
  }))
  var signIds = []
  var $or = []
  var campaign = campaign
  campaign.paymentStatus = []
  var paymentArray = []
  var signMap = {}
  try {
    for (var i = 0; i < campaign.signTypeData.length; i++) {
      if (campaign.signTypeData[i].signType === "SIGN") {
        signIds.push({
          _id: mongoose.Types.ObjectId(campaign.signTypeData[i]._id._id)
        })
        getSign = campaign.signTypeData[i]._id
        let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${getSign.offset}`;
        let bookingFromUTC = momentTimezone(bookingFrom).tz(getSign.timeZone)
        bookingFromUTC.hours(0)
        bookingFromUTC.minutes(0)
        bookingFromUTC.seconds(0)
        bookingFromUTC = bookingFromUTC.utc().format();
        let bookingTo = `${campaign.budget.bookingTo}T23:59:59${getSign.offset}`;
        let bookingToUTC = momentTimezone(bookingTo).tz(getSign.timeZone)
        bookingToUTC = bookingToUTC.utc().format();
        let bookingOneElement = this.generateBulkBookingQuery(mongoose.Types.ObjectId(getSign._id), bookingFromUTC, bookingToUTC)
        $or.push(bookingOneElement)
      } else {
        if (campaign.signTypeData[i]._id.childsDetails.length <= 0) {
          return res.status(400).send('Slot no listing for in group ' + campaign.signTypeData)
        }
        for (let j = 0; j < campaign.signTypeData[i]._id.childsDetails.length; j++) {
          let getSign = campaign.signTypeData[i]._id.childsDetails[j]
          signIds.push({
            _id: mongoose.Types.ObjectId(getSign._id)
          })
          let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${getSign.offset}`;
          let bookingFromUTC = momentTimezone(bookingFrom).tz(getSign.timeZone)
          bookingFromUTC.hours(0)
          bookingFromUTC.minutes(0)
          bookingFromUTC.seconds(0)
          bookingFromUTC = bookingFromUTC.utc().format();
          let bookingTo = `${campaign.budget.bookingTo}T23:59:59${getSign.offset}`;
          let bookingToUTC = momentTimezone(bookingTo).tz(getSign.timeZone)
          bookingToUTC = bookingToUTC.utc().format();
          let bookingOneElement = this.generateBulkBookingQuery(mongoose.Types.ObjectId(getSign._id), bookingFromUTC, bookingToUTC)
          $or.push(bookingOneElement)
        }
      }
    }
    var bookings = await (BookingService.findBookingArrayWithSlot({
      $or
    }))
    var bookingMap = {}
    var bookingArray = []
    for (let i = 0; i < bookings.length; i++) {
      bookingMap[bookings[i]._id.toString()] = bookings[i].slots
    }
    for (let i = 0; i < campaign.signTypeData.length; i++) {
      var slotCode = 0
      if (campaign.signTypeData[i].signType === "SIGN") {
        let tempSign = campaign.signTypeData[i]._id
        if (bookingMap[tempSign._id.toString()]) {
          if (tempSign.availableSlots > 0 && (tempSign.availableSlots > bookingMap[tempSign._id.toString()].length)) {
            for (let j = 0; j < tempSign.availableSlots; j++) {
              var k = j + 1
              if (bookingMap[tempSign._id.toString()].indexOf(k.toString()) <= -1) {
                slotCode = k
                break
              }
            }
            if (slotCode > 0) {
              let booking = {}
              booking.sign = tempSign._id;
              signMap[tempSign._id.toString()] = tempSign
              booking.slotCode = slotCode;
              bookingMap[tempSign._id.toString()].push(slotCode.toString())
              let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${tempSign.offset}`;
              let bookingFromUTC = moment(bookingFrom).tz(tempSign.timeZone)
              bookingFromUTC.hours(0)
              bookingFromUTC.minutes(0)
              bookingFromUTC.seconds(0)
              bookingFromUTC = bookingFromUTC.utc().format();
              let bookingTo = `${campaign.budget.bookingTo}T23:59:59${tempSign.offset}`;
              let bookingToUTC = moment(bookingTo).tz(tempSign.timeZone)
              bookingToUTC = bookingToUTC.utc().format();
              booking.from = bookingFromUTC
              booking.to = bookingToUTC
              booking.campaign = campaign._id
              let paymentStatus = {}
              paymentStatus.sign = tempSign._id
              paymentStatus.paid = 0
              paymentStatus.paymentType = "NORMAL_PAYMENT"
              paymentArray.push(payment)
              paymentStatus.bookingByGroup = false
              paymentStatus.bookingStatus = "BOOKED"
              campaign.paymentStatus.push(paymentStatus)
              bookingArray.push(booking)
            }
          } else {
            return res.status(400).send('Slot not available for in sign ' + tempSign.name)
          }
        } else {
          if (tempSign.availableSlots > 0) {
            slotCode = "1";
            let booking = {}
            booking.sign = tempSign._id;
            signMap[tempSign._id.toString()] = tempSign
            booking.slotCode = slotCode;
            bookingMap[tempSign._id.toString()] = [slotCode]
            let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${tempSign.offset}`;
            let bookingFromUTC = moment(bookingFrom).tz(tempSign.timeZone)
            bookingFromUTC.hours(0)
            bookingFromUTC.minutes(0)
            bookingFromUTC.seconds(0)
            bookingFromUTC = bookingFromUTC.utc().format();
            let bookingTo = `${campaign.budget.bookingTo}T23:59:59${tempSign.offset}`;
            let bookingToUTC = moment(bookingTo).tz(tempSign.timeZone)
            bookingToUTC = bookingToUTC.utc().format();
            booking.from = bookingFromUTC
            booking.to = bookingToUTC
            booking.campaign = campaign._id
            let paymentStatus = {}
            paymentStatus.sign = tempSign._id
            paymentStatus.bookingByGroup = false
            paymentStatus.paid = 0
            paymentStatus.bookingStatus = "BOOKED"
            paymentStatus.paymentType = "NORMAL_PAYMENT"
            campaign.paymentStatus.push(paymentStatus)
            bookingArray.push(booking)
          } else {
            return res.status(400).send('Slot not available for in sign ' + tempSign.name)
          }
        }
      } else {
        let anychilds = 0
        for (let j = 0; j < campaign.signTypeData[i]._id.childsDetails.length; j++) {
          let tempSign = campaign.signTypeData[i]._id.childsDetails[j]
          if (bookingMap[tempSign._id.toString()]) {
            if (tempSign.availableSlots > 0 && (tempSign.availableSlots > (bookingMap[tempSign._id.toString()].length))) {
              for (let j = 0; j < tempSign.availableSlots; j++) {
                let k = j + 1
                if (bookingMap[tempSign._id.toString()].indexOf(k.toString()) <= -1) {
                  slotCode = k
                  break
                }
              }
              if (slotCode > 0) {
                anychilds = 1
                let booking = {}
                let paymentStatus = {}
                paymentStatus.sign = tempSign._id
                paymentStatus.bookingByGroup = false
                paymentStatus.paid = 0
                paymentStatus.bookingStatus = "BOOKED"
                paymentStatus.paymentType = "GROUP_PAYMENT"
                campaign.paymentStatus.push(paymentStatus)
                booking.sign = tempSign._id;
                signMap[tempSign._id.toString()] = tempSign
                bookingMap[tempSign._id.toString()].push(slotCode.toString())
                booking.slotCode = slotCode;
                let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${tempSign.offset}`;
                let bookingFromUTC = moment(bookingFrom).tz(tempSign.timeZone)
                bookingFromUTC.hours(0)
                bookingFromUTC.minutes(0)
                bookingFromUTC.seconds(0)
                bookingFromUTC = bookingFromUTC.utc().format();
                let bookingTo = `${campaign.budget.bookingTo}T23:59:59${tempSign.offset}`;
                let bookingToUTC = moment(bookingTo).tz(tempSign.timeZone)
                bookingToUTC = bookingToUTC.utc().format();
                booking.from = bookingFromUTC
                booking.to = bookingToUTC
                booking.campaign = campaign._id
                booking.group = campaign.signTypeData[i]._id._id
                bookingArray.push(booking)
              }
            }
          } else {
            if (tempSign.availableSlots > 0) {
              anychilds = 1
              slotCode = "1";
              bookingMap[tempSign._id.toString()] = [slotCode]
              let booking = {}
              booking.sign = tempSign._id;
              signMap[tempSign._id.toString()] = tempSign
              booking.slotCode = slotCode;
              let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${tempSign.offset}`;
              let bookingFromUTC = moment(bookingFrom).tz(tempSign.timeZone)
              bookingFromUTC.hours(0)
              bookingFromUTC.minutes(0)
              bookingFromUTC.seconds(0)
              bookingFromUTC = bookingFromUTC.utc().format();
              let bookingTo = `${campaign.budget.bookingTo}T23:59:59${tempSign.offset}`;
              let bookingToUTC = moment(bookingTo).tz(tempSign.timeZone)
              bookingToUTC = bookingToUTC.utc().format();
              booking.from = bookingFromUTC
              booking.to = bookingToUTC
              booking.campaign = campaign._id
              booking.group = campaign.signTypeData[i]._id._id
              let paymentStatus = {}
              paymentStatus.sign = tempSign._id
              paymentStatus.bookingByGroup = false
              paymentStatus.paid = 0
              paymentStatus.bookingStatus = "BOOKED"
              paymentStatus.paymentType = "GROUP_PAYMENT"
              campaign.paymentStatus.push(paymentStatus)
              bookingArray.push(booking)
            }
          }
        }
        if (anychilds === 0) {
          return res.status(400).send('Slot not available for in group ' + campaign.signTypeData[i]._id.name)
        }
      }
    }
    await (BookingService.bookingBulkInsert(bookingArray))
    campaign._paymentStatus = 'approved'
    var user = user
    var payment = {
      currency: 'USD',
      amount: 0,
      paidAmount: 0,
      status: 'approved', // created || approved || canceled
      reason: '',
      paymentDetails: campaign.paymentStatus, // Amount per sign
      campaign: campaign,
      advertiser: campaign.advertiserId,
      paidDate: new Date(),
      // user - Advertiser user who made payment
      user: user
    }
    var campaign = await (this.updateCampaignStatusAndPaymentStatus(campaign, bookingArray, signMap, res, user, req))
    var payment = await (PaymentService.create(payment))
    // await(PaymentSummmaryService.create(campaign))
    // return campaign
  } catch (err) {
    return res.status(400).send(err)
  }
}

this.updateCampaignStatusAndPaymentStatus = async (campaign, bookingArray, signMap, res, user, req) => {
  var campaign = campaign
  var bookingArray = bookingArray;
  campaign.campaignStatus = [];
  var notifications = []
  for (let i = 0; i < campaign.paymentStatus.length; i++) {
    for (let j = 0; j < campaign.media.length; j++) {
      let campaignStatus = {}
      campaignStatus.sign = campaign.paymentStatus[i].sign
      campaignStatus.status = 'PENDING'
      campaignStatus.media = campaign.media[j]
      campaignStatus.publishedDate = new Date(),
        campaignStatus.statusChangingDate = new Date()
      campaign.campaignStatus.push(campaignStatus)
    }
  }
  delete campaign.createdAt
  delete campaign.updatedAt
  campaign.budget.price = 0
  var _camaignData = JSON.parse(JSON.stringify(campaign))
  for (let i = 0; i < _camaignData.signTypeData.length; i++) {
    if (_camaignData.signTypeData[i]._id && _camaignData.signTypeData[i]._id._id) {
      _camaignData.signTypeData[i]._id = _camaignData.signTypeData[i]._id._id
    }
  }
  var _campaign = await (Campaign.findOneAndUpdate({
    _id: mongoose.Types.ObjectId(campaign._id)
  }, {
    '$set': _camaignData
  }, {
    new: true
  }))
  _campaign.campaignStatus.map(campaignStatus => {
    _campaign.media.map(media => {
      if (campaignStatus.media.toString() === media.toString()) {
        let notification = {
          type: 'MEDIA',
          status: 'PENDING',
          isRead: false,
          sign: signMap[campaignStatus.sign.toString()],
          media: media,
          campaign: _campaign,
          campaignStatusId: campaignStatus._id,
          networkOwner: signMap[campaignStatus.sign.toString()].networkOwnerId,
          advertiser: _campaign.advertiserId
        }
        notifications.push(notification)
      }
    })
  })
  // var _campaign = await(Campaign.findOne({_id: campaign.id}))
  // let campaignStatusSignMap = {}
  // for (let i = 0; i < _campaign.campaignStatus.length; i++) {
  //   if (!campaignStatusSignMap[_campaign.campaignStatus[i].sign]) {
  //     for (let j = 0; j < _campaign.media.length; j++) {
  //       let notification = {
  //         type: 'MEDIA',
  //         status: 'PENDING',
  //         isRead: false,
  //         sign: signMap[_campaign.campaignStatus[i].sign.toString()],
  //         media: _campaign.media[j],
  //         campaign: _campaign,
  //         campaignStatusId: _campaign.campaignStatus[i]._id,
  //         networkOwner: signMap[_campaign.campaignStatus[i].sign.toString()].networkOwnerId,
  //         advertiser: _campaign.advertiserId
  //       }
  //       notifications.push(notification)
  //     }
  //     campaignStatusSignMap[_campaign.campaignStatus[i].sign] = _campaign.campaignStatus[i].sign
  //   }
  // }
  req.session.requestFrom = null
  req.session.newCampaign = null
  req.session.campaignId = null
  res.end(JSON.stringify(_campaign))
  await (PaymentSummmaryService.create(_campaign, user))
  let queue = [];
  for (var i = 0; i < bookingArray.length; i++) {
    let sign = bookingArray[i].sign;
    let q = {
      signId: sign._id,
      time: new Date()
    }
    queue.push(q);
  }
  QueueService.insetMany(queue);
  let networkOwnerIdMap = {}
  NotificationServ.sendNotificationMailToNetworkOwner(notifications)
  for (var i = 0; i < notifications.length; i++) {
    var notification = notifications[i]
    await (NetworkOwnerNotificationService.create(notification))
    networkOwnerIdMap[notification.sign.networkOwnerId] = notification.sign.networkOwnerId
  }
  for (let key in networkOwnerIdMap) {
    if (networkOwnerIdMap.hasOwnProperty(key)) {
      let networkOwnerId = networkOwnerIdMap[key]
      let query = {
        networkOwnerId: networkOwnerId.toString()
      }
      let user = await (User.findOne(query).lean())
      if (user.advertiserId && user.networkOwnerId) {
        var userId = user.advertiserId.toString()
      } else {
        if (user.advertiserId && !user.networkOwnerId) {
          var userId = user.advertiserId.toString()
        } else if (user.networkOwnerId && !user.advertiserId) {
          var userId = user.networkOwnerId.toString()
        }
      }
      NetworkOwnerNotificationService.notifyCount(networkOwnerId, {
        networkOwner: networkOwnerId,
        isRead: false
      }, userId)
    }
  }
  AdvertiserNotificationService.notifyCount(user.advertiserId.toString(), {
    advertiser: user.advertiserId.toString(),
    isRead: false
  })
}

this.publishCampaignOnFreeSignWithCoupen = async (campaign, user, coupon, res, req) => {
  try {
    var query = {
      _id: campaign._id
    };
    campaign.paymentStatus = []
    var signMap = []
    var signIds = []
    for (let i = 0; i < campaign.signs.length; i++) {
      let sign = campaign.signs[i].sign;
      if (user.networkOwnerId.toString() === sign.networkOwnerId.toString()) {
        sign.paidAmount = 0
        sign.Amount = 0
      }
      if (!sign.group) {
        var nPaymentStatus = {
          sign: sign._id.toString(),
          paid: sign.paidAmount,
          paymentType: 'NORMAL_PAYMENT',
          originalAmount: sign.Amount,
          bookingStatus: 'PENDING'
        }
        if (!signMap[sign._id.toString()]) {
          signIds.push(sign._id.toString())
        }
      } else {
        var nPaymentStatus = {
          sign: sign._id.toString(),
          paid: sign.paidAmount,
          paymentType: 'GROUP_PAYMENT',
          originalAmount: sign.Amount,
          bookingStatus: 'PENDING'
        }
        if (!signMap[sign._id.toString()]) {
          signIds.push(sign._id.toString())
        }
      }
      campaign.paymentStatus.push(nPaymentStatus)
    }
    await (Campaign.findOneAndUpdate({
      _id: campaign._id
    }, {
      '$set': {
        paymentStatus: campaign.paymentStatus,
        coupen: coupon
      }
    }, {
      new: true
    }))
    var _campaign = await (this.getSlotCode(campaign._id))
    var campaign = _campaign.camapign
    var slots = _campaign.slots;
    var bookingInsertArray = []
    var paymentStatusArray = []
    for (let i = 0; i < slots.length; i++) {
      let details = slots[i];
      let booking = {}
      if (details.group && details.Status !== "UNBOOKED") {
        booking = {
          campaign: campaign._id,
          sign: details.sign._id,
          slotCode: details.slotCode,
          from: details.sign.bookingFromUTC,
          to: details.sign.bookingToUTC,
          paymentType: 'GROUP_PAYMENT',
          group: details.group._id
        }
      } else {
        booking = {
          campaign: campaign._id,
          sign: details.sign._id,
          slotCode: details.slotCode,
          from: details.sign.bookingFromUTC,
          to: details.sign.bookingToUTC,
          paymentType: 'NORMAL_PAYMENT'
          // group: details.group._id
        }
      }
      if (booking) {
        bookingInsertArray.push(booking)
      }
      for (let j = 0; j < campaign.paymentStatus.length; j++) {
        var paymentStatus = {}
        if (campaign.paymentStatus[j].sign.toString() === details.sign._id.toString()) {
          paymentStatus.sign = campaign.paymentStatus[j].sign;
          paymentStatus.paid = campaign.paymentStatus[j].paid.toFixed(2) * 1;
          paymentStatus.originalAmount = campaign.paymentStatus[j].originalAmount.toFixed(2) * 1;
          paymentStatus.paidDate = new Date();
          if (details.group) {
            paymentStatus.paymentType = 'GROUP_PAYMENT'
          } else {
            paymentStatus.paymentType = 'NORMAL_PAYMENT'
          }
          if (details.Status !== "UNBOOKED") {
            paymentStatus.bookingStatus = 'BOOKED';
          } else {
            paymentStatus.bookingStatus = 'UNBOOKED';
            if (details.reason && details.reason === "NOTAVALIABLE") {
              paymentStatus.bookingErrorReason = details.sign.name + ' the sign is currently unavailable because of it is not in an active stage '
            } else {
              paymentStatus.bookingErrorReason = 'Slot not available for listing ' + details.sign.name
            }
          }
          paymentStatusArray.push(paymentStatus);
        }
      }
    }
    await (BookingService.bookingBulkInsert(bookingInsertArray))
    campaign.paymentStatus = paymentStatusArray
    var couponAmount = null
    var action = 'TRANSACTION_WITHOUT_COUPON'
    if (coupon) {
      var action = 'TRANSACTION_WITH_COUPON'
      coupon.amount = campaign.budget.price
    }
    var detail = {
      campaign: campaign._id.toString(),
      listing: listingDetails,
      coupon: coupon,
      discountAmount: couponAmount,
      paidAmount: 0,
      actualAmount: campaign.budget.price
    }
    var type = 'TRANSACTION'
    var query = {
      'detail.campaign': campaign._id.toString()
    }
    var [existLog] = await (AuditLogServ.find(query))
    if (existLog) {
      await (AuditLogServ.updateLog(existLog._id, {
        action: action,
        detail: detail,
        time: new Date()
      }))
    } else {
      await (AuditLogServ.createLog(user, action, detail, type))
    }
    var payment = {
      currency: 'USD',
      amount: campaign.budget.price,
      paidAmount: campaign.budget.price,
      status: 'approved', // created || approved || canceled
      reason: '',
      paymentDetails: [], // Amount per sign
      campaign: campaign,
      advertiser: campaign.advertiserId,
      paidDate: new Date(),
      // user - Advertiser user who made payment
      user: user
    }
    var listingDetails = []
    for (var i = 0; i < campaign.paymentStatus.length; i++) {
      var _paymentStatus = campaign.paymentStatus[i];
      _paymentStatus.paid = _paymentStatus.paid * 1
      var originalAmount = _paymentStatus.originalAmount * 1
      var nPaymentStatus = {
        sign: _paymentStatus.sign,
        amount: _paymentStatus.paid,
        paymentType: _paymentStatus.paymentType,
        originalAmount: originalAmount
      }
      payment.paymentDetails.push(nPaymentStatus)
      if (_paymentStatus.sign._id)
        listingDetails.push(_paymentStatus.sign._id)
      else
        listingDetails.push(_paymentStatus.sign)
      // listingDetails.push(_paymentStatus.sign)
    }
    var payment = await (PaymentService.create(payment))
    if (coupon) {
      var coupon = {
        name: coupon.name,
        campaign: campaign,
        advertiser: campaign.advertiserId,
        user: user,
        usedDate: new Date(),
        status: 'USED',
        amount: coupon.amount
      }
      coupenHistory = new CoupenHistory(coupon);
      coupenHistory.save()
    }
    campaign.budget.price = 0
    await (this.updateStatusOfCampaignAndNotifications(campaign, slots, res, user, req, true))
  } catch (err) {
    console.log(err)
    return res.status(err)
  }
}

this.getDataForPaymentPage = async (id) => {
  try {
    var campaign = JSON.parse(JSON.stringify(await (Campaign.findOne({
      _id: id
    }).populate('media').populate('coupen').populate('paymentStatus.sign'))))
    var signIds = []
    var signs = []
    var _signs = []
    var groups = []
    if (campaign.signTypeData) {
      var signTypeData = campaign.signTypeData
      for (let i = 0; i < signTypeData.length; i++) {
        if (signTypeData[i].signType === "SIGN") {
          signs.push(signTypeData[i]._id)
        } else {
          if (signTypeData[i].childs) {
            groups.push(signTypeData[i]._id)
            // groupChildIds = groupChildIds.concat(signTypeData[i].childs)
          }
        }
      }
    }
    if (signs.length > 0) {
      var signData = await (SignService.find({
        _id: {
          $in: signs
        }
      }))
      _signs = _signs.concat(signData)
    }
    if (groups.length > 0) {
      var groupData = await (GroupService.findWithChilds({
        _id: {
          $in: groups
        }
      }))
      _signs = _signs.concat(groupData)
    }
    campaign.signs = []
    campaign.signs = _signs
    // let data = {
    //   campaign: campaign
    // }
    return campaign
  } catch (err) {
    return err
  }
}

this.campaignForPayment = async (id) => {
  try {
    var query = {
      _id: mongoose.Types.ObjectId(id),
    };
    var campaign = JSON.parse(JSON.stringify(await (Campaign.findOne(query).lean())))
    var paymentStatus = campaign.paymentStatus
    var groupSignsIds = []
    var signsIds = []
    var groupId = []
    for (let i = 0; i < paymentStatus.length; i++) {
      if (paymentStatus[i].paymentType && paymentStatus[i].paymentType === "GROUP_PAYMENT") {
        groupSignsIds.push(paymentStatus[i].sign.toString())
      } else {
        signsIds.push(paymentStatus[i].sign.toString())
      }
    }
    for (let j = 0; j < campaign.signTypeData.length; j++) {
      if (campaign.signTypeData[j].signType === "GROUP") {
        groupId.push(campaign.signTypeData[j]._id.toString())
      }
    }
    if (groupId.length > 0) {
      var groups = await (GroupService.find({
        _id: {
          $in: groupId
        }
      }))
    }
    if (groups) {
      for (let i = 0; i < groups.length; i++) {
        for (let j = 0; j < groups[i].childsDetails.length; j++) {
          let signId = groups[i].childsDetails[j]._id.toString()
          if (!groupSignsIds.includes(signId)) {
            groups[i].childsDetails.splice(j, 1)
          }
        }
        if (groups[i].childsDetails.length <= 0) {
          groups.splice(i, 1)
        }
      }
    }
    if (signsIds.length > 0) {
      var _signs = await (SignService.find({
        _id: {
          $in: signsIds
        }
      }))
    }
    campaign.signs = []
    if (_signs && _signs.length > 0) {
      campaign.signs = campaign.signs.concat(_signs)
    }
    if (groups && groups.length > 0) {
      campaign.signs = campaign.signs.concat(groups)
    }
    return campaign
  } catch (err) {
    console.log(err)
  }
};

this.getCampaignDetails = async (id) => {
  try {
    var campaign = JSON.parse(JSON.stringify(
      await (Campaign.findOne({
        _id: id
      }).populate("media").populate("coupen"))))
    var signIds = []
    var groupIds = []
    // if (campaign.paymentStatus) {
    //   for (let i = 0; i < campaign.paymentStatus.length; i++) {
    //     signIds.push(campaign.paymentStatus[i].sign)
    //   }
    // }
    let payment = await (PaymentService.findForPaymenyStatus({
      campaign: id
    }))
    if (payment && payment._id) {
      campaign.payment = payment
    }
    for (let i = 0; i < campaign.signTypeData.length; i++) {
      if (campaign.signTypeData[i].signType === "SIGN") {
        signIds.push(campaign.signTypeData[i]._id)
      } else {
        groupIds.push(campaign.signTypeData[i]._id)
      }
    }
    var signs = await (SignService.find({
      _id: {
        $in: signIds
      }
    }))
    var groups = await (GroupService.find({
      _id: {
        $in: groupIds
      }
    }))
    if (campaign.campaignStatus && campaign.campaignStatus.length > 0) {
      let campaignMedia = {}
      for (let i = 0; i < campaign.campaignStatus.length; i++) {
        if (!campaignMedia[campaign.campaignStatus[i].media]) {
          campaignMedia[campaign.campaignStatus[i].media] = campaign.campaignStatus[i].media
        }
      }

      for (let i = 0; i < campaign.media.length; i++) {
        if (!campaignMedia[campaign.media[i]._id]) {
          campaign.media.splice(i, 1)
        }
      }
    }
    signs = signs.concat(groups)
    campaign.signs = signs
    let data = {
      campaign: campaign
    }
    return data
  } catch (err) {
    return err
  }
}

this.generateSignMRSS = signId => {
  var _this = this
  var mrss = '';
  var promise = new Promise(async (resolve, reject) => {
    _self = _this
    var sign = await (SignService.findOne({
      _id: signId
    }))
    if (!sign.active) {
      return resolve("")
    }
    var query = {
      signType: 'GROUP',
      "childs._id": {
        "$in": [mongoose.Types.ObjectId(signId)]
      },
      groupType: 'PRIVATE',
    }
    var _groupData = await (GroupService.findWithSortUpdatedAtDesc(query));
    var privateSlot = sign.slots - sign.availableSlots
    var privateOwnMedia = 2 * privateSlot;
    var groupData = [];
    for (let groupDataLength = 0; groupDataLength < _groupData.length; groupDataLength++) {
      if (_groupData[groupDataLength].ownMedia.length > 0) {
        groupData.push(_groupData[groupDataLength])
        break;
      }
    }
    if (groupData.length > 0) {
      if (groupData[0].ownMedia.length > 0) {
        if (groupData[0].ownMedia.length === privateOwnMedia) {
          // sign.ownMedia = [];
          sign.ownMedia = groupData[0].ownMedia;
        } else if (groupData[0].ownMedia.length < privateOwnMedia) {
          var ownMediaFinal = [];
          ownMediaFinal = groupData[0].ownMedia
          var mediaDifference = privateOwnMedia - groupData[0].ownMedia.length
          var pushindex = sign.ownMedia.length
          if (mediaDifference > sign.ownMedia.length) {
            mediaDifference = sign.ownMedia.length
          }
          for (let index = 0; index < mediaDifference; index++) {
            pushindex = pushindex - 1
            if (!sign.ownMedia[pushindex] || sign.ownMedia[pushindex] !== null) {
              ownMediaFinal.push(sign.ownMedia[pushindex])
            }
          }
          sign.ownMedia = ownMediaFinal
        } else {
          var changeLength = groupData[0].ownMedia.length - privateOwnMedia
          changeLength = changeLength
          var _ownMedia = groupData[0].ownMedia.splice(0, changeLength)
          sign.ownMedia = groupData[0].ownMedia
        }
      }
    }
    // if (groupData.length > 0) {
    //   if (groupData[0].ownMedia.length > 0) {
    //     var privateSlot = sign.slots - sign.availableSlots
    //     var privateOwnMedia = 2 * privateSlot;
    //     if (groupData[0].ownMedia.length <= privateOwnMedia) {
    //       sign.ownMedia =  groupData[0].ownMedia;
    //     } else {
    //       var changeLength = groupData[0].ownMedia.length - privateOwnMedia
    //       var _ownMedia = groupData[0].ownMedia.splice(0,changeLength)
    //       sign.ownMedia = _ownMedia
    //     }

    //   } 
    // }

    if (!sign) {
      // If sign not exists return empty json object
      var json = {}
      return resolve(json)
    }
    /*
     * Convert slot duration to sec
     */
    var duration = sign.holdTime
    switch (sign.holdTimeUnit) {
      case 'min':
        duration = duration * 60
        break;
      default:
        duration = duration
    }
    /*
     * Set JSON valid for 10 days
     * We need to regenerate JSON after 10 days
     */

    let validFrom = moment();

    let validTo = moment();
    validTo = validTo.add(23, 'hours');
    validTo = validTo.add(59, 'minutes');
    validTo = validTo.add(10, 'days');

    mrss += '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dcterms="http://purl.org/dc/terms/">';
    mrss += '<channel>';
    mrss += '<title>' + sign.name + '</title>';
    mrss += '<link></link>';
    mrss += '<description>' + sign.name + '</description>';
    mrss += '<animation>' + sign.animation + '</animation>';
    mrss += '<publishedTime>' + validFrom.toISOString() + '</publishedTime>';
    if (sign.requestInterval) {
      mrss += '<requestInterval>' + sign.requestInterval + '</requestInterval>';
    } else {
      mrss += '<requestInterval>' + 30 + '</requestInterval>';
    }
    mrss += '<dcterms:valid>start=' + validFrom.toISOString() + ';end=' + validTo.toISOString() + ';scheme=W3C-DTF</dcterms:valid>';

    /*
     * Fetch booking list which bookings end date greater than today(00:00:00)
     */
    let _from = moment();
    _from = _from.toISOString()

    let _to = moment(_from).tz(sign.timeZone)
    _to.hours(23)
    _to.minutes(59)
    _to.seconds(59)
    _to = _to.toISOString()

    var query = {
      '$and': [{
          sign: signId
        },
        // {to: {"$gte": new Date(from)}}
        {
          to: {
            "$gte": _from
          }
        },
        {
          from: {
            "$lte": _from
          }
        }
      ]
    }
    var bookings = await (BookingService.listBookingsByQuery(query))
    var slotMap = {}
    var bookedSlots = []
    //var campaignApprovedMedia = []
    var campaigns = []
    /*
     * Find all booked campaign with approved media
     */
    var hasMoreThanOneMedia = false
    var noOfCycleRequired = 1
    if (bookings) {
      var campaignStatusMap = {}
      for (var i = 0; i < bookings.length; i++) {
        var __paymentStatusMap = {}
        var booking = bookings[i]
        var campaign = booking.campaign
        if (!campaign) {
          continue
        }
        if (campaign && campaign !== null) {
          var booked = false
          for (var k = 0; k < campaign.paymentStatus.length; k++) {
            var __paymentStatus = campaign.paymentStatus[k]
            if (!__paymentStatusMap[__paymentStatus._id] && signId.toString() === __paymentStatus.sign.toString()) {
              if (__paymentStatus.bookingStatus && __paymentStatus.bookingStatus === 'BOOKED') {
                booked = true
                __paymentStatusMap[__paymentStatus._id] = __paymentStatus._id
              }
            }
          }
          if (booked) {
            if (!slotMap[booking.campaign._id]) {
              slotMap[booking.campaign._id] = campaign._id
              bookedSlots.push(booking.slotCode)
              var approvedMedia = _self.listApprovedMedia(campaign, signId, campaignStatusMap)
              if (approvedMedia && approvedMedia.length > 0) {
                /*
                 * Refer mail subjected 'Questions on slot management' 
                 * Question :  So if a advertiser want to publish more than 2 media, they have to book more slot as part of next campaign? 
                 * Yes 
                 * As per mail only support first two media from campaign
                 */
                var _approvedMedia = []
                for (var j = 0; j < approvedMedia.length; j++) {
                  _approvedMedia[j] = approvedMedia[j]
                  if (j === 1) {
                    break
                  }
                }
                if (!hasMoreThanOneMedia && approvedMedia.length > 1) {
                  hasMoreThanOneMedia = true
                  noOfCycleRequired = 2
                }
                //campaignApprovedMedia.push({campaignId: campaign._id, approvedMedia: _approvedMedia})
                campaign.media = _approvedMedia
                campaigns.push(campaign)
              }
            }
          }
        }
      }
    }
    var ownMedia = sign.ownMedia
    var unsoldMedia = sign.unsoldMedia
    var totalSlots = sign.slots
    var publicSlots = sign.availableSlots
    var ownSlots = totalSlots - publicSlots;
    var noOfPromotion = unsoldMedia.length

    var moreLoopRequired = Math.ceil(sign.ownMedia.length / ownSlots) >= 2 ? true : false
    var noOfLoops = noOfCycleRequired >= 2 || moreLoopRequired ? 2 : 1


    var noOfCampaignsWithPro = (publicSlots > campaigns.length && noOfPromotion > 0) ? (campaigns.length + 1) : campaigns.length;
    var tempNoOfOwnSlots = ownSlots
    var ownIdx = 0
    for (var i = 0; i < noOfLoops; i++) {
      var excess_NOW_Media = tempNoOfOwnSlots - noOfCampaignsWithPro
      var ownMediaCurrentIdx = 0
      for (var j = 0; j < noOfCampaignsWithPro; j++) {
        if (publicSlots > campaigns.length && noOfPromotion > 0 && j === noOfCampaignsWithPro - 1) {
          var media = unsoldMedia[0]
          mrss += _self.getItemXml(campaign, '/network-owner-media', media, duration, 'NWO')
        } else {
          if (i >= 1 && campaigns[j].media.length > 1) {
            var media = campaigns[j].media[1]
            mrss += _self.getItemXml(campaigns[j], '/media', media, duration, 'ADV')
          } else {
            var media = campaigns[j].media[0]
            mrss += _self.getItemXml(campaigns[j], '/media', media, duration, 'ADV')
          }
        }
        if (ownMediaCurrentIdx < ownSlots && ownIdx < ownMedia.length) {
          var media = ownMedia[ownIdx]
          mrss += _self.getItemXml(campaign, '/network-owner-media', media, duration, 'NWO')
          ownIdx++
          ownMediaCurrentIdx++
        }
        tempNoOfOwnSlots--
      }
      for (var j = 0; j < excess_NOW_Media; j++) {
        if (ownMediaCurrentIdx < ownSlots && ownIdx < ownMedia.length) {
          var media = ownMedia[ownIdx]
          mrss += _self.getItemXml(campaign, '/network-owner-media', media, duration, 'NWO')
          ownIdx++
          ownMediaCurrentIdx++
        }
      }
      if (ownIdx == sign.ownMedia.length) {
        tempNoOfOwnSlots = ownSlots
        ownIdx = 0
      }
    }
    mrss += '</channel>';
    mrss += '</rss>';
    return resolve(mrss)
  }); // END promise
  return promise;
};

this.generateSignJSON = signId => {
  var json = {
    items: []
  };
  var promise = new Promise(async (resolve, reject) => {
    var sign = await (SignService.findOne({
      _id: signId
    }))
    if (!sign.active) {
      return resolve(json)
    }
    var query = {
      signType: 'GROUP',
      "childs._id": {
        "$in": [mongoose.Types.ObjectId(signId)]
      },
      groupType: 'PRIVATE',
      status: {
        $ne: 'DELETED'
      },
      active: true
    }
    var _groupData = await (GroupService.findWithSortUpdatedAtDesc(query));
    var privateSlot = sign.slots - sign.availableSlots
    var privateOwnMedia = 2 * privateSlot;
    var groupData = [];
    for (let groupDataLength = 0; groupDataLength < _groupData.length; groupDataLength++) {
      if (_groupData[groupDataLength].ownMedia.length > 0) {
        groupData.push(_groupData[groupDataLength])
        break;
      }
    }
    if (groupData.length > 0) {
      if (groupData[0].ownMedia.length > 0) {
        if (groupData[0].ownMedia.length === privateOwnMedia) {
          sign.ownMedia = groupData[0].ownMedia;
        } else if (groupData[0].ownMedia.length < privateOwnMedia) {
          var ownMediaFinal = [];
          ownMediaFinal = groupData[0].ownMedia
          var mediaDifference = privateOwnMedia - groupData[0].ownMedia.length
          var pushindex = sign.ownMedia.length
          if (mediaDifference > sign.ownMedia.length) {
            mediaDifference = sign.ownMedia.length
          }
          for (let index = 0; index < mediaDifference; index++) {
            pushindex = pushindex - 1
            if (!sign.ownMedia[pushindex] || sign.ownMedia[pushindex] !== null) {
              ownMediaFinal.push(sign.ownMedia[pushindex])
            }
          }
          sign.ownMedia = ownMediaFinal
        } else {
          var changeLength = groupData[0].ownMedia.length - privateOwnMedia
          changeLength = changeLength
          var _ownMedia = groupData[0].ownMedia.splice(0, changeLength)
          sign.ownMedia = groupData[0].ownMedia
        }
      }
    }
    if (!sign) {
      // If sign not exists return empty json object
      return resolve(json)
    }
    /*
     * Convert slot duration to sec
     */
    var duration = sign.holdTime
    switch (sign.holdTimeUnit) {
      case 'min':
        duration = duration * 60
        break;
      default:
        duration = duration
    }
    /*
     * Set JSON valid for 10 days
     * We need to regenerate JSON after 10 days
     */
    let validFrom = moment();

    let validTo = moment();
    validTo = validTo.add(23, 'hours');
    validTo = validTo.add(59, 'minutes');
    validTo = validTo.add(10, 'days');

    json.title = sign.name;
    json.description = sign.name;
    json.animation = sign.animation;
    json.publishedTime = validFrom.toISOString();
    json.start = validFrom.toISOString()
    json.end = validTo.toISOString()
    if (sign.requestInterval) {
      json.requestInterval = sign.requestInterval;
    } else {
      json.requestInterval = 30
    }

    /*
     * Fetch booking list which bookings end date greater than today(00:00:00)
     */
    let _from = moment();
    _from = _from.toISOString()

    let _to = moment(_from).tz(sign.timeZone)
    _to.hours(23)
    _to.minutes(59)
    _to.seconds(59)
    _to = _to.toISOString()

    var query = {
      '$and': [{
          sign: signId
        },
        // {to: {"$gte": new Date(from)}}
        {
          to: {
            "$gte": _from
          }
        },
        {
          from: {
            "$lte": _from
          }
        }
      ]
    }
    var bookings = await (BookingService.listBookingsByQuery(query))
    console.log(`${bookings && bookings.length > 0 ? bookings.length : 0} BOOKING FOUND FOR SIGN ${sign.name}`);
    var slotMap = {}
    var bookedSlots = []
    //var campaignApprovedMedia = []
    var campaigns = []
    /*
     * Find all booked campaign with approved media
     */
    var hasMoreThanOneMedia = false
    var noOfCycleRequired = 1
    if (bookings) {
      var campaignStatusMap = {}
      for (var i = 0; i < bookings.length; i++) {
        var __paymentStatusMap = {}
        var booking = bookings[i]
        var campaign = booking.campaign
        if (!campaign) {
          continue
        }
        if (campaign && campaign !== null) {
          var booked = false
          for (var k = 0; k < campaign.paymentStatus.length; k++) {
            var __paymentStatus = campaign.paymentStatus[k]
            if (!__paymentStatusMap[__paymentStatus._id] && signId.toString() === __paymentStatus.sign.toString()) {
              if (__paymentStatus.bookingStatus && __paymentStatus.bookingStatus === 'BOOKED') {
                booked = true
                __paymentStatusMap[__paymentStatus._id] = __paymentStatus._id
              }
            }
          }
          if (booked) {
            if (!slotMap[booking.campaign._id]) {
              slotMap[booking.campaign._id] = campaign._id
              bookedSlots.push(booking.slotCode)
              var approvedMedia = _self.listApprovedMedia(campaign, signId, campaignStatusMap)
              if (approvedMedia && approvedMedia.length > 0) {
                /*
                 * Refer mail subjected 'Questions on slot management' 
                 * Question :  So if a advertiser want to publish more than 2 media, they have to book more slot as part of next campaign? 
                 * Yes 
                 * As per mail only support first two media from campaign
                 */
                var _approvedMedia = []
                for (var j = 0; j < approvedMedia.length; j++) {
                  _approvedMedia[j] = approvedMedia[j]
                  if (j === 1) {
                    break
                  }
                }
                if (!hasMoreThanOneMedia && approvedMedia.length > 1) {
                  hasMoreThanOneMedia = true
                  noOfCycleRequired = 2
                }
                //campaignApprovedMedia.push({campaignId: campaign._id, approvedMedia: _approvedMedia})
                campaign.media = _approvedMedia
                campaigns.push(campaign)
              }
            }
          }
        }
      }
    }
    var ownMedia = sign.ownMedia
    var unsoldMedia = sign.unsoldMedia
    var totalSlots = sign.slots
    var publicSlots = sign.availableSlots
    var ownSlots = totalSlots - publicSlots;
    var noOfPromotion = unsoldMedia.length

    var moreLoopRequired = Math.ceil(sign.ownMedia.length / ownSlots) >= 2 ? true : false
    var noOfLoops = noOfCycleRequired >= 2 || moreLoopRequired ? 2 : 1


    var noOfCampaignsWithPro = (publicSlots > campaigns.length && noOfPromotion > 0) ? (campaigns.length + 1) : campaigns.length;
    var tempNoOfOwnSlots = ownSlots
    var ownIdx = 0
    for (var i = 0; i < noOfLoops; i++) {
      var excess_NOW_Media = tempNoOfOwnSlots - noOfCampaignsWithPro
      var ownMediaCurrentIdx = 0
      for (var j = 0; j < noOfCampaignsWithPro; j++) {
        if (publicSlots > campaigns.length && noOfPromotion > 0 && j === noOfCampaignsWithPro - 1) {
          var media = unsoldMedia[0]
          var item = _self.getItemJson(campaign, '/network-owner-media', media, duration, 'NWO')
          json.items.push(item)
        } else {
          if (i >= 1 && campaigns[j].media.length > 1) {
            var media = campaigns[j].media[1]
            var item = _self.getItemJson(campaigns[j], '/media', media, duration, 'ADV')
            json.items.push(item)
          } else {
            var media = campaigns[j].media[0]
            var item = _self.getItemJson(campaigns[j], '/media', media, duration, 'ADV')
            json.items.push(item)
          }
        }
        if (ownMediaCurrentIdx < ownSlots && ownIdx < ownMedia.length) {
          var media = ownMedia[ownIdx]
          var item = _self.getItemJson(campaign, '/network-owner-media', media, duration, 'NWO')
          json.items.push(item)
          ownIdx++
          ownMediaCurrentIdx++
        }
        tempNoOfOwnSlots--
      }
      for (var j = 0; j < excess_NOW_Media; j++) {
        if (ownMediaCurrentIdx < ownSlots && ownIdx < ownMedia.length) {
          var media = ownMedia[ownIdx]
          var item = _self.getItemJson(campaign, '/network-owner-media', media, duration, 'NWO')
          json.items.push(item)
          ownIdx++
          ownMediaCurrentIdx++
        }
      }
      if (ownIdx == sign.ownMedia.length) {
        tempNoOfOwnSlots = ownSlots
        ownIdx = 0
      }
    }
    // console.log("JSON.stringify(json)")
    // console.log(JSON.stringify(json))
    return resolve(json)
  });
  return promise;
};

this.writeFile = (signId, fileName, mrss, folderName = 'sign') => {
  signId = signId.toString()
  var promise = new Promise((resolve, reject) => {
    var dsaAppPath = config.upload.path
    var signPath = path.join(dsaAppPath, folderName, signId)
    fse.ensureDirSync(signPath)
    var filePath = path.join(signPath, fileName);
    fs.writeFile(filePath, mrss, 'utf8', err => {
      if (err) {
        return reject(err)
      }
      return resolve()
    });
  });
  return promise;
}

this.uploadToS3 = (signId, fileName) => {
  signId = signId.toString()
  var promise = new Promise((resolve, reject) => {
    var dsaAppPath = config.upload.path
    var signPath = path.join(dsaAppPath, 'sign', signId)
    var filePath = path.join(signPath, fileName);
    var key = path.join('sign', signId, fileName)
    var ext = path.extname(key)
    var contentType = ''
    if (ext === '.json') {
      contentType = 'application/json'
    } else {
      contentType = 'text/xml'
    }
    s3Obj = {
      Bucket: s3Service.bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType
    }
    s3.upload(s3Obj, (err, data) => {
      resolve()
    });
  });
  return promise;
}

this.listApprovedMedia = (campaign, signId, campaignStatusMap) => {
  var media = []
  var mediaMap = {}
  for (var i = 0; i < campaign.campaignStatus.length; i++) {
    var _campaignStatus = campaign.campaignStatus[i]
    if (!mediaMap[_campaignStatus.media._id] && !campaignStatusMap[_campaignStatus._id] && _campaignStatus.sign && _campaignStatus.sign.toString() === signId.toString() && _campaignStatus.status === 'APPROVED') {
      media.push(_campaignStatus.media)
      campaignStatusMap[_campaignStatus._id] = _campaignStatus._id
      mediaMap[_campaignStatus.media._id] = _campaignStatus.media._id
    }
  }
  return media
}

this.getItemXml = (campaign, s3PathPrefix, media, duration, owner) => {
  var mediaS3Path = config.aws.s3.publicURL + s3PathPrefix
  var start = new Date()
  start = start.toISOString();
  var end = new Date()
  end.setHours(23);
  end.setMinutes(59);
  end.setSeconds(59);
  end.setDate(end.getDate() + 10);
  end = end.toISOString();
  if (campaign) {
    start = new Date(campaign.budget.from).toISOString()
    end = new Date(campaign.budget.to).toISOString()
  }
  var type = 'image/jpeg'
  var medium = 'image';
  var url = ''
  var vDuration = 0
  if (media.meta.type === 'video') {
    type = 'video/mp4'
    medium = 'video'
    url = mediaS3Path + '/' + media._id.toString() + '/' + media._id + '.mp4'
  } else {
    if (media.meta && media.meta.mimeType) {
      type = media.meta.mimeType;
    }
    if (media.meta && media.meta.type) {
      medium = media.meta.type;
    }
    url = mediaS3Path + '/' + media._id.toString() + '/' + media._id
  }
  if (media.meta && media.meta.duration) {
    vDuration = media.meta.duration
  }
  mrss = ''
  mrss += '<item>';
  mrss += '<dcterms:valid>start=' + start + ';end=' + end + ';scheme=W3C-DTF</dcterms:valid>';
  mrss += '<media:content';
  mrss += ' url="' + url + '"';
  mrss += ' type="' + type + '"';
  mrss += ' owner="' + owner + '"';
  mrss += ' medium="' + medium + '"';
  mrss += ' vDuration="' + vDuration + '"';
  mrss += ' duration="' + duration + '">';
  mrss += '<dcterms:valid>start=' + start + ';end=' + end + ';scheme=W3C-DTF</dcterms:valid>';
  mrss += '</media:content>';
  mrss += '</item>';
  return mrss
}

/*
 * s3PathPrefix is /media or /network-owner-media the child of bucket
 * Returns Json object
 * With Advertiser media url or Network owner own content url or unsold slot url
 */
this.getItemJson = (campaign, s3PathPrefix, media, duration, owner) => {
  var mediaS3Path = config.aws.s3.publicURL + s3PathPrefix
  var start = new Date()
  start = start.toISOString();
  var end = new Date()
  end.setHours(23);
  end.setMinutes(59);
  end.setSeconds(59);
  end.setDate(end.getDate() + 10);
  end = end.toISOString();
  if (campaign) {
    start = new Date(campaign.budget.from).toISOString()
    end = new Date(campaign.budget.to).toISOString()
  }
  var type = 'image/jpeg'
  var medium = 'image';
  var url = ''
  if (media.meta.type === 'video') {
    type = 'video/mp4'
    medium = 'video'
    url = mediaS3Path + '/' + media._id.toString() + '/' + media._id + '.mp4'
  } else {
    if (media.meta && media.meta.mimeType) {
      type = media.meta.mimeType;
    }
    if (media.meta && media.meta.type) {
      medium = media.meta.type;
    }
    url = mediaS3Path + '/' + media._id.toString() + '/' + media._id
  }
  var item = {}
  item.start = start
  item.end = end
  item.url = url
  item.type = type
  item.medium = medium
  item.owner = owner
  item.duration = duration;
  if (media.meta && media.meta.duration) {
    item.vDuration = media.meta.duration
  }
  return item
}

this.getCampaigns = function (params, advertiserId) {
  var _this = this
  var promise;
  promise = new Promise(function (resolve, reject) {
    var self = _this
    var campaignFilter, filter, limit, searchText, skip;
    skip = params.skip;
    limit = params.limit;
    searchText = params.searchText;
    let sort = params.sort;
    let date = params.date
    filter = [];
    if (searchText && searchText.length > 0) {
      var searchWord = ""
      for (let k = 0; k < searchText.length; k++) {
        let _searchText = searchText[k]
        _searchText = _searchText.replace("\\", "\\\\")
        _searchText = _searchText.replace("*", "\\*")
        _searchText = _searchText.replace("(", "\\(")
        _searchText = _searchText.replace(")", "\\)")
        _searchText = _searchText.replace("+", "\\+")
        _searchText = _searchText.replace("[", "\\[")
        _searchText = _searchText.replace("|", "\\|")
        _searchText = _searchText.replace(",", "\\,")
        _searchText = _searchText.replace(".", "\\.")
        _searchText = _searchText.replace("?", "\\?")
        _searchText = _searchText.replace("^", "\\^")
        _searchText = _searchText.replace("$", "\\$")
        searchWord = searchWord.toString() + _searchText.toString()
      }
      campaignFilter = {
        advertiserId: advertiserId,
        name: {
          $regex: searchWord,
          $options: 'ig',
        }

      };
    } else {
      campaignFilter = {
        advertiserId: advertiserId
      };
    }
    self.getCampaignListForAdvertiser(campaignFilter, sort, skip, limit)
      .then(function (data) {
        campaigns = data.campaigns
        for (var i = 0; i < campaigns.length; i++) {
          var campaign = campaigns[i]
          var date = moment().format('YYYY-MM-DD');
          if (campaign.budget.bookingTo)
            var endDate = campaign.budget.bookingTo;
          else
            var endDate = moment(campaign.budget.to).format('YYYY-MM-DD');
          var _totalDays = moment(date).diff(moment(endDate), 'days');
          campaign["_status"] = "Pending"
          if (campaign._paymentStatus !== "approved") {
            campaign["_status"] = 'Payment pending'
          } else {
            for (var j = 0; j < campaign.campaignStatus.length; j++) {
              if (campaign.campaignStatus[j].status === "CANCELED") {
                campaign["_status"] = 'Canceled'
                break;
              } else if (campaign.campaignStatus[j].status === "REJECTED") {
                campaign["_status"] = 'Rejected'
                break;
              } else if (campaign.campaignStatus[j].status !== "APPROVED") {
                campaign["_status"] = 'Pending'
                break;
              } else if (campaign.budget.bookingFrom && date <= campaign.budget.bookingTo) {
                let difference = moment(date).diff(moment(campaign.budget.bookingFrom), 'days')
                if (difference >= 0)
                  campaign["_status"] = 'Active'
                else
                  campaign["_status"] = 'Approved'
              }
            }
          }
          if (_totalDays > 0) {
            campaign["_status"] = 'Completed'
          }
        }
        var _data = {
          campaigns: campaigns,
        }
        var result = {}
        result.count = data.count
        result._data = _data
        return resolve(result);
      }).catch(function (err) {
        return reject(err);
      });
  });
  return promise;
};

this.getCampaignListForAdvertiser = async (query, sort, skip, limit) => {
  let _limit = skip + limit
  var _camaigns = await (Campaign.find(query, {
    budget: 1,
    campaignStatus: 1,
    name: 1,
    _paymentStatus: 1,
    createdAt: 1
  }).sort(sort).limit(_limit).lean())
  var count = await (Campaign.count(query).lean())
  let ___campaigns = JSON.stringify(_camaigns)
  var _campaigns = JSON.parse(___campaigns)
  var campaigns = _campaigns.splice(skip, limit)
  let data = {
    campaigns: campaigns,
    count: count
  }
  return data
}

this.delete = async (id, user) => {
  var _this = this
  var promise = new Promise(async (resolve, reject) => {
    var _self = _this
    var query = {
      _id: id,
      advertiserId: user.advertiserId
    };
    var campaign = await (_self.findOneAndRemove(query))
    await (BookingService.delete({
      campaign: id
    }))
    var queue = []
    for (var i = 0; i < campaign.signs.length; i++) {
      if (campaign.signs[i].signType !== 'GROUP') {
        var signId = campaign.signs[i]
        // await(SignService.publish(signId))
        let q = {
          signId: signId,
          time: new Date()
        }
        queue.push(q);
      } else if (campaign.signs[i].signType === 'GROUP') {
        var childs = campaign.signs[i].childs
        for (var j = 0; j < childs.length; j++) {
          var signId = childs[j]
          // await(SignService.publish(signId))
          let q = {
            signId: signId,
            time: new Date()
          }
          queue.push(q);
        }
      }
    }
    QueueService.insetMany(queue);
    // for(var i = 0; i < campaign.signs.length; i++) {
    // }
    await (AdvertiserServ.getDashboardData(user.advertiserId))
    resolve(campaign)
  });
  return promise;
};

this.find = function (query) {
  if (query == null) {
    query = {};
  }
  return Campaign
    .find(query);
};

this.findOneAndRemove = function (query) {
  var promise = new Promise(function (resolve, reject) {
    Campaign.findOneAndRemove(query, function (err, campaign) {
      if (err) {
        return reject(err)
      }
      if (!campaign && campaign === null) {
        return reject(new Error("Campaign not exists!"));
      }
      return resolve(campaign);
    });
  });
  return promise;
}

this.updateCampaignStatus = (campaignId, mediaId, signId, status, campaignStatusId) => {
  var promise = new Promise((resolve, reject) => {
    if (campaignStatusId !== undefined) {
      return Campaign.findOneAndUpdate({
        _id: campaignId,
        campaignStatus: {
          $elemMatch: {
            _id: campaignStatusId,
            media: mediaId,
            sign: signId
          }
        }
      }, {
        '$set': {
          'campaignStatus.$.status': status,
          'campaignStatus.$.statusChangingDate': new Date()
        }
      }, {
        new: true
      }, (err, campaign) => {
        if (err) {
          return reject(err);
        } else if (campaign === null) {
          return reject(new Error("Campaign not exists!"));
        } else {
          /*
           * Publish MRSS XML & JSON if any media approved
           */
          // SignService.publish(signId)

          let queue = [];
          let q = {
            signId: signId,
            time: new Date()
          }
          queue.push(q);
          QueueService.insetMany(queue);
          return resolve(campaign);
        }
      });
    } else if (campaignStatusId === undefined) {
      return Campaign.findOneAndUpdate({
        _id: campaignId,
        campaignStatus: {
          $elemMatch: {
            media: mediaId,
            sign: signId
          }
        }
      }, {
        '$set': {
          'campaignStatus.$.status': status,
          'campaignStatus.$.statusChangingDate': new Date()
        }
      }, {
        new: true
      }, (err, campaign) => {
        if (err) {
          return reject(err);
        } else if (campaign === null) {
          return reject(new Error("Campaign not exists!"));
        } else {
          /*
           * Publish MRSS XML & JSON if any media approved
           */
          // SignService.publish(signId)
          let queue = [];
          let q = {
            signId: signId,
            time: new Date()
          }
          queue.push(q);
          QueueService.insetMany(queue);
          return resolve(campaign);
        }
      });
    }
  });
  return promise;
};

this.resubmit = (_id, data, user) => {
  var _this = this
  var oldMediaId = data.oldMediaId.toString()
  var resubmittedMediaId = data.resubmittedMediaId.toString()
  var notificationId = data.notificationId.toString()
  var promise = new Promise(async (resolve, reject) => {
    try {
      var _self = _this
      let campaign = await (_self.findOneByIdForPayment(_id, user))
      var _campaign = campaign.campaign
      campaign = _campaign
      for (var i = 0; i < campaign.media.length; i++) {
        if (campaign.media[i]._id)
          var media = campaign.media[i]._id.toString()
        else
          var media = campaign.media[i].toString()
        if (media === oldMediaId) {
          campaign.media.splice(i, 1);
          break;
        }
      }
      campaign.media.push(resubmittedMediaId);
      let _notification = await(AdvertiserNotification.findOne({_id: notificationId}))
      var __campaignStatus = campaign.campaignStatus
      campaign.campaignStatus = []
      for (var i = 0; i < __campaignStatus.length; i++) {
        if (__campaignStatus[i].media) {
          var _campaignStatus = __campaignStatus[i]
          var media = _campaignStatus.media.toString()
          if (media === oldMediaId && _notification.sign.toString() === __campaignStatus[i].sign.toString()) {
            continue;
          }
          campaign.campaignStatus.push(__campaignStatus[i]);
        }
      }
      // var signs = []
      // for (var i = 0; i < campaign.signs.length; i++) {
      //   var sign = campaign.signs[i]
      //   if (sign.signType !== "GROUP") {
      //     signs.push(sign)
      //   } else if (sign.signType === "GROUP") {
      //     for (var j = 0; j < sign.childs.length; j++) {
      //       signs.push(sign.childs[j])
      //     }
      //   }
      // }
      // for (var idx = 0; idx < signs.length; idx++) {
        // var sign = signs[idx];
        var _campaignStatus = {
          status: 'RESUBMITTED',
          sign: _notification.sign,
          media: resubmittedMediaId,
          statusChangingDate: new Date()
        }
        campaign.campaignStatus.push(_campaignStatus);
      // }
      var deleteCampaignCreatedAt = JSON.stringify(campaign)
      campaign = JSON.parse(deleteCampaignCreatedAt)
      delete campaign.createdAt
      let result = await (Campaign.findOneAndUpdate({
        _id
      }, {
        '$set': campaign
      }, {
        new: true
      }))
      campaign = await (_self.findOneByIdForPayment(_id, user))
      _campaign = campaign.campaign
      campaign = _campaign
      AdvertiserNotificationService.update(notificationId, {
        status: 'RESUBMITTED'
      });
      // signs = []
      // for (var i = 0; i < campaign.signs.length; i++) {
      //   var sign = campaign.signs[i]
      //   if (sign.signType !== "GROUP") {
      //     signs.push(sign)
      //   } else if (sign.signType === "GROUP") {
      //     for (var j = 0; j < sign.childs.length; j++) {
      //       signs.push(sign.childs[j])
      //     }
      //   }
      // }
      // for (var idx = 0; idx < signs.length; idx++) {
      //   var sign = signs[idx];
      let _sign = await(SignService.findOne({_id: _notification.sign.toString()}))
      var notification = {
        type: 'RESUBMITTED',
        isRead: false,
        sign: _notification.sign,
        media: resubmittedMediaId,
        campaign: campaign,
        networkOwner: _sign.networkOwnerId,
        advertiser: campaign.advertiserId
      }
      NetworkOwnerNotificationService.create(notification);
      NotificationServ.sendNotificationMailToNetworkOwner(notification)
      // }
      return resolve(campaign);
    } catch (err) {
      console.log(err)
      return reject(err)
    }
  });
  return promise;
}

this.cancelCampaign = async (campaign, res, data) => {
  try {
    let query = {
      $and: [{
          campaign: campaign._id
        },
        {
          type: {
            $ne: "PAYMENT"
          }
        }
      ]
    }
    let notifications = await (NetworkOwnerNotificationService.findQuery(query))
    res.json(data)
    var approvedOrPendingNotifications = []
    var unApproveOrRejectedNotification = []
    var networkOwners = []
    var networkOwnersMap = {}
    var mediaMap = {}
    var queue = []
    for (let i = 0; i < notifications.length; i++) {
      let notification = notifications[i];
      if (notification.networkOwner._id && !networkOwnersMap[notification.networkOwner._id]) {
        networkOwners.push(notification.networkOwner._id)
        networkOwnersMap[notification.networkOwner._id] = notification.networkOwner._id
      } else if (notification.networkOwner && !networkOwnersMap[notification.networkOwner]) {
        networkOwners.push(notification.networkOwner)
        networkOwnersMap[notification.networkOwner] = notification.networkOwner
      }
      if (!mediaMap[notification.media._id]) {
        if (notification.status === 'UNAPPROVED' || notification.status === 'REJECTED' && notification.type !== "PAYMENT") {
          unApproveOrRejectedNotification.push(notification)
        } else if (notification.status === 'APPROVED' || notification.status === 'PENDING' && notification.type !== "PAYMENT") {
          approvedOrPendingNotifications.push(notification)
        }
        mediaMap[notification.media._id] = notification.media._id
      }
      notification.status = 'CANCELED'
      if (notification.isRead) {
        notification.isRead = false
      }
      if (notification.sign && notification.sign._id) {
        let q = {
          signId: notification.sign._id,
          time: new Date()
        }
        queue.push(q);
      } else {
        let q = {
          signId: notification.sign,
          time: new Date()
        }
        queue.push(q);
      }
      delete notification.createdAt
      delete notification.updatedAt
      NetworkOwnerNotificationService.update(notification._id, notification)
    }
    QueueService.insetMany(queue);
    for (let i = 0; i < networkOwners.length; i++) {
      let networkOwner = networkOwners[i];
      var cancelNotification = {
        status: "CANCELED",
        camapignName: campaign.name,
        networkOwner: networkOwner
      }
      for (let j = 0; j < approvedOrPendingNotifications.length; j++) {
        if (approvedOrPendingNotifications[j].networkOwner.toString() === networkOwner.toString()) {
          cancelNotification.notificationType = "approvedOrPendingNotifications"
          cancelNotification.notifications = approvedOrPendingNotifications
        }
      }
      if (approvedOrPendingNotifications <= 0) {
        cancelNotification.notificationType = "unApproveOrRejectedNotification"
        cancelNotification.notifications = unApproveOrRejectedNotification
      }
      NotificationServ.sendNotificationMailToNetworkOwner(cancelNotification)
    }
  } catch (e) {
    return e
  }
}
this.findOneById = async (id, user) => {
  var query = {
    _id: id,
    advertiserId: user.advertiserId
  };
  try {
    var campaign = await (Campaign.findOne(query).populate('signs').populate({
      path: 'signs',
      populate: {
        path: 'childs'
      }
    }).populate('media').populate('paymentStatus.sign').populate('coupen').sort('-createdAt'));
    var data = {}
    var userName = []
    data.campaign = campaign
    if (!campaign) {
      data.userName = userName
      return data
    }
    // for (var i = 0; i < campaign.signs.length; i++) {
    //   if (campaign.signs[i].signType !== "GROUP" && campaign.signs[i].networkOwnerId) {
    //     var networkOwnerId = campaign.signs[i].networkOwnerId.toString()
    //     var user = await(UserServ.findOne({networkOwnerId: networkOwnerId}))
    //   } else if (campaign.signs[i].signType === "GROUP" && campaign.signs[i].networkOwnerId) {
    //     var sign = campaign.signs[i]
    //     for (var j = 0; j < sign.childs.length; j++) {
    //       var networkOwnerId = sign.childs[j].networkOwnerId.toString()
    //       var user = await(UserServ.findOne({networkOwnerId: networkOwnerId}))
    //     }
    //   }
    //   userName.push(user.name)
    // }
    data.campaign.signs = []
    for (let i = 0; i < campaign.paymentStatus.length; i++) {
      data.campaign.signs.push(campaign.paymentStatus[i].sign)
      var networkOwnerId = campaign.paymentStatus[i].sign.networkOwnerId.toString()
      var user = await (UserServ.findOne({
        networkOwnerId: networkOwnerId
      }))
      userName.push(user.name)
    }
    data.userName = userName
    return data
  } catch (err) {
    console.log(err)
  }
};

this.getCampaignDetailsForReplaceMedia = async (id) => {
  try {
    var campaign = JSON.parse(JSON.stringify(await (Campaign.findOne({
      _id: id
    }).populate('media').populate('coupen').populate('paymentStatus.sign'))))
    var _signs = []
    for (let i = 0; i < campaign.paymentStatus.length; i++) {
      _signs.push(campaign.paymentStatus[i].sign)
    }
    campaign.signs = []
    campaign.signs = _signs
    let data = {
      campaign: campaign
    }
    return data
  } catch (err) {
    return err
  }
}

this.replaceMedia = (_id, campaignMedia, user, res) => {
  var _this = this
  var promise = new Promise(async (resolve, reject) => {
    try {
      var self = _this
      let campaign = await (self.getCampaignDetailsForReplaceMedia(_id))
      if (!campaign)
        return reject('Campaign not exists.')
      campaign = campaign.campaign
      var signs = []
      for (var i = 0; i < campaign.signs.length; i++) {
        var sign = campaign.signs[i]
        if (sign.signType !== "GROUP") {
          signs.push(sign)
        } else if (sign.signType === "GROUP") {
          for (var j = 0; j < sign.childs.length; j++) {
            signs.push(sign.childs[j])
          }
        }
      }
      var oldMediaId = []
      var campaignStatus = campaign.campaignStatus
      campaign.campaignStatus = []
      campaignMediaMap = {}
      for (let i = 0; i < campaign.media.length; i++) {
        campaign.media[i].position = i
        campaignMediaMap[campaign.media[i]._id] = campaign.media[i]
      }
      for (let i = 0; i < campaignMedia.length; i++) {
        media = campaignMedia[i]
        if (!campaignMediaMap[media._id]) {
          for (let key in campaignMediaMap) {
            if (campaignMediaMap.hasOwnProperty(key)) {
              let value = campaignMediaMap[key];
              campaign.media.splice(value.position, 1, media);
              oldMediaId.push(value._id)
              media.oldMedia = value
              delete campaignMediaMap[key]
              break
            }
          }
          for (var idx = 0; idx < signs.length; idx++) {
            var sign = signs[idx];
            var _campaignStatus = {
              status: 'REPLACE_MEDIA',
              sign: sign,
              media: media,
              publishedDate: new Date(),
              statusChangingDate: new Date()
            }
            campaign.campaignStatus.push(_campaignStatus);
          }
        } else {
          for (let k = 0; k < campaignStatus.length; k++) {
            let _campaignStatus = campaignStatus[k];
            for (var idx = 0; idx < signs.length; idx++) {
              var sign = signs[idx];
              if (_campaignStatus.media.toString() === media._id.toString() && _campaignStatus.sign.toString() === sign._id.toString()) {
                campaign.campaignStatus.push(_campaignStatus);
                break
              }
            }
          }
          delete campaignMediaMap[media._id]
        }
      }
      var deleteCampaignCreatedAt = JSON.stringify(campaign)
      campaign = JSON.parse(deleteCampaignCreatedAt)
      delete campaign.createdAt
      delete campaign.updatedAt
      try {
        campaign = await (Campaign.findOneAndUpdate({
          _id
        }, {
          '$set': campaign
        }, {
          new: true
        }))
      } catch (err) {
        return reject(err);
      }
      let query = {
        campaign: mongoose.Types.ObjectId(campaign._id),
        media: {
          '$in': oldMediaId
        },
        status: "APPROVED"
      }
      var notifications = await (AdvertiserNotificationService.find(query))
      var notificationsForEmail = []
      let notificationsId = []
      for (let i = 0; i < campaignMedia.length; i++) {
        let _campaignMedia = campaignMedia[i];
        if (_campaignMedia.oldMedia) {
          for (var idx = 0; idx < signs.length; idx++) {
            var sign = signs[idx];
            var notification = {
              type: 'REPLACE_MEDIA',
              isRead: false,
              sign: sign,
              media: _campaignMedia._id,
              campaign: campaign,
              networkOwner: sign.networkOwnerId,
              advertiser: campaign.advertiserId,
              oldMedia: _campaignMedia.oldMedia._id
            }
            for (let j = 0; j < campaign.campaignStatus.length; j++) {
              let campaignStatus = campaign.campaignStatus[j];
              if (campaignStatus.media.toString() === notification.media.toString() && campaignStatus.sign.toString() === notification.sign.toString()) {
                notification.campaignStatusId = campaignStatus._id
                break
              }
            }
            notificationsForEmail.push(notification)
            NetworkOwnerNotificationService.create(notification)
          }
          for (var j = 0; j < notifications.length; j++) {
            if (notifications[j].media._id.toString() === _campaignMedia.oldMedia._id.toString()) {
              notificationsId.push(notifications[j]._id)
            }
          }
          AdvertiserNotification.updateMany({
            _id: notificationsId
          }, {
            "$set": {
              status: 'REPLACE_MEDIA',
              media: notification.media,
              oldMedia: _campaignMedia.oldMedia._id
            }
          })
        }
      }
      AdvertiserNotificationService.notifyCount(user.advertiserId.toString(), {
        advertiser: user.advertiserId.toString(),
        isRead: false
      })
      AdvertiserNotificationService.notifyRefreshList(user.advertiserId.toString())
      campaign = await (self.getCampaignDetailsForReplaceMedia(_id))
      res.end(JSON.stringify(campaign.campaign))
      NotificationServ.sendNotificationMailToNetworkOwner(notificationsForEmail)
    } catch (err) {
      return reject(err);
    }
  })
  return promise;
}

this.getCamapaignNameForPaymentHistory = async (campaignIds, advertiser, searchText) => {
  if (searchText) {
    var query = {
      $and: [{
        _id: {
          $in: campaignIds
        }
      }, {
        name: {
          $regex: searchText,
          $options: 'ig'
        }
      }, {
        advertiserId: advertiser.toString()
      }]
    }
  } else {
    var query = {
      $and: [{
        _id: {
          $in: campaignIds
        }
      }, {
        advertiserId: advertiser.toString()
      }]
    }
  }

  var campaigns = await (Campaign.find(query, {
    name: 1,
    budget: 1
  }).populate("coupen").lean())

  return campaigns
};

this.findoneBySignId = async (id) => {
  var _id = id.toString();
  var queryCampine = {
    paymentStatus: {
      $elemMatch: {
        sign: id
      }
    }
  }
  var result = await (Campaign.find(queryCampine))
  return (result);
};

this.findRunningCampaigns = params => {
  var promise;
  promise = new Promise(async (resolve, reject) => {
    var campaignFilter, searchText;
    var _statusOfCampaign = []
    var id = params.signId.toString()
    try {
      var sign = await (Sign.findOne({ _id: id }).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').populate('childs'))
      if (sign.signType !== 'GROUP') {
        var activeCampigns = []
        var campaignMap = {}
        var bookingMap = {}
        var signIds = []
        signIds.push(sign._id)
        campaignFilter = {
          campaignStatus: { $elemMatch: { sign: signIds } }
        }
        var campaigns = await (Campaign.find(campaignFilter).populate('media').populate('campaignStatus.media'))
        for (var i = 0; i < campaigns.length; i++) {
          campaign = campaigns[i]
          var x = 0
          if (!campaignMap[campaign._id]) {
            if (campaign.campaignStatus.length > 0) {
              var checkCampaing = 0;
              for (var j = 0; j < campaign.campaignStatus.length; j++) {
                var signId = sign._id.toString()
                if (campaign.campaignStatus[j].status !== "APPROVED" && campaign.campaignStatus[j].sign.toString() === signId.toString()) {
                  checkCampaing = checkCampaing + 1;
                  if (checkCampaing === 2) {
                    x++
                  }
                }
              }
            } else {
              x++;
            }
            campaignMap[campaign._id] = campaign._id
          }
          if (x <= 0) {
            activeCampigns.push(campaign)
          }
        }
        let _from = moment();
        _from = _from.toISOString()

        let _to = moment(_from).tz(sign.timeZone)
        _to.hours(23)
        _to.minutes(59)
        _to.seconds(59)
        _to = _to.toISOString()
        var query = {
          '$and': [
            { sign: signId },
            // {to: {"$gte": new Date(from)}}
            { to: { "$gte": _from } },
            { from: { "$lte": _from } }
          ]
        }
        var bookings = await (BookingService.listBookingsByQuery(query))
        let bookingFrom = `${moment().format('YYYY-MM-DD')}T00:00:00${sign.offset}`;
        let bookingFromUTC = moment(bookingFrom).tz(sign.timeZone)
        bookingFromUTC.hours(0)
        bookingFromUTC.minutes(0)
        bookingFromUTC.seconds(0)
        bookingFromUTC = bookingFromUTC.utc().format();

        let bookingTo = `${moment().format('YYYY-MM-DD')}T23:59:59${sign.offset}`;
        let bookingToUTC = moment(bookingTo).tz(sign.timeZone)
        bookingToUTC = bookingToUTC.utc().format();
        // var bookings = await(BookingService.listBookings(sign._id, bookingFromUTC, bookingToUTC))
        var _activeCampigns = []
        for (var i = 0; i < bookings.length; i++) {
          var booking = bookings[i]
          if (!bookingMap[booking.campaign]) {
            bookingMap[booking.campaign] = booking.campaign
            for (var j = 0; j < activeCampigns.length; j++) {
              if (activeCampigns[j]._id.toString() === booking.campaign._id.toString()) {
                _activeCampigns.push(activeCampigns[j])
              }
            }
          }
        }
      } else if (sign.signType === 'GROUP') {
        var activeCampigns = []
        var campaignMap = {}
        var bookingMap = {}
        var date = new Date()
        campaignFilter = {
          signs: { "$in": [sign._id] }
        };
        var campaigns = await (Campaign.find(campaignFilter).populate('media').populate({ path: 'campaignStatus', populate: { path: 'media' } }))
        for (var i = 0; i < campaigns.length; i++) {
          campaign = campaigns[i]
          var x = 0
          if (!campaignMap[campaign._id]) {
            if (campaign.campaignStatus.length > 0) {
              var checkCampaing = 0
              for (var j = 0; j < campaign.campaignStatus.length; j++) {
                for (var k = 0; k < sign.childs.length; k++) {
                  var child = sign.childs[k]
                  if (campaign.campaignStatus[j].status !== "APPROVED" && campaign.campaignStatus[j].sign.toString() === child._id.toString()) {
                    if (checkCampaing === 2) {
                      x++
                    }
                  }
                }
              }
            } else {
              x++;
            }
            campaignMap[campaign._id] = campaign._id
          }
          if (x <= 0) {
            activeCampigns.push(campaign)
          }
        }
        for (var k = 0; k < sign.childs.length; k++) {
          let sign = sign.childs[k]
          let bookingFrom = `${moment().format('YYYY-MM-DD')}T00:00:00${sign.offset}`;
          let bookingFromUTC = moment(bookingFrom).tz(sign.timeZone)
          bookingFromUTC.hours(0)
          bookingFromUTC.minutes(0)
          bookingFromUTC.seconds(0)
          bookingFromUTC = bookingFromUTC.utc().format();

          let bookingTo = `${moment().format('YYYY-MM-DD')}T23:59:59${sign.offset}`;
          let bookingToUTC = moment(bookingTo).tz(sign.timeZone)
          bookingToUTC = bookingToUTC.utc().format();
          var bookings = await (BookingService.listBookings(sign._id, bookingFromUTC, bookingToUTC))
          var _activeCampigns = []
          for (var i = 0; i < bookings.length; i++) {
            var booking = bookings[i]
            if (!bookingMap[booking.campaign]) {
              bookingMap[booking.campaign] = booking.campaign
              for (var j = 0; j < activeCampigns.length; j++) {
                if (activeCampigns[j]._id.toString() === booking.campaign.toString()) {
                  _activeCampigns.push(activeCampigns[j])
                }
              }
            }
          }
        }
      }
      var data = {}
      data.count = _activeCampigns.length
      data.campaigns = _activeCampigns
      return resolve(data);
    } catch (err) {
      return reject(err)
    }
  });
  return promise;
};

this.signBookings = async (sign, from, to) => {
  let bookings = await(BookingService.listBookings(sign._id, from, to))
  let data = {}
  if (bookings && (bookings.length >= sign.availableSlots)) {
    data.err = bookings
  } else {
    data.result = bookings
  }
  return data
}

this.checkBlockedUsersListings = async (userId, campaign) => {
  let users = await (UserServ.checkIsBlockedUser(userId))
  if (users.length > 0) {
    let usersMap = {}
    users.map(user => {
      usersMap[user.networkOwnerId] = user.networkOwnerId
    })
    let signNames = ''
    campaign.signs.map(sign => {
      if (usersMap[sign.networkOwnerId])
        signNames += signNames === '' ? sign.name : ', ' + sign.name
    })
    if (signNames.length > 0)
      return `${signNames} these sign owners have blocked you. Please select another networkowners signs to publish.`
    return false
  } 
}