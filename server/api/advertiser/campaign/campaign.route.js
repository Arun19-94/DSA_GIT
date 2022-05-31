const config = require('../../../config/config.js');

const Promise = require('bluebird');

const path = require("path");

const index = `${config.server.context}/api/advertisers/campaign`;

const CampaignServ = require("./campaign.service");

const AuthCognitoServ = require('../../../components/auth/cognito/auth');

const CoupenServ = require('../payment/coupen/coupen.service');

const CoupenHistoryServ = require("../payment/coupenHistory/coupenHistory.service");

const moment = require('moment');

const dateFormat = require('dateformat')

const SignServ = require('../../networkOwner/sign/sign.service')

const GroupServ = require('../../networkOwner/group/group.service')

const join = link => path.join(index, link != null ? link : "");

module.exports = function (app) {

  app.post(join("/"), AuthCognitoServ.isAuthenticated(), createCampaign);

  app.put(join("/:id"), AuthCognitoServ.isAuthenticated(), updateCampaign);

  app.put(join("/session/set"), AuthCognitoServ.setCurrentSession(), setSession)

  app.put(join("/session/setSessionNewCampaign"),  setSessionNewCampaign)

  app.put(join("/session/delete"), AuthCognitoServ.setCurrentSession(), deleteSession)

  app.get(join("/session/get"), AuthCognitoServ.setCurrentSession(), getSession)

  app.post(join("/makePayment"), AuthCognitoServ.isAuthenticated(), makePayment);

  app.get(join("/payment/success"), paymentSuccess);

  app.get(join("/payment/error"), paymentError);

  app.post(join("/PublishCampaignWithFreeOfCost"), AuthCognitoServ.isAuthenticated(), publishCampaignOnFreeSign);

  app.post(join("/PublishCampaignWithFreeOfCostWithCoupon"), AuthCognitoServ.isAuthenticated(), publishCampaignOnFreeSignWithCoupen);

  app.get(join("/:id"), AuthCognitoServ.isAuthenticated(), getCampaign);

  app.post(join("/getCampaignsList/campaignList"), AuthCognitoServ.isAuthenticated(), paginationForCampaigns);

  app.post(join("/signBookings"), AuthCognitoServ.isAuthenticated(), signBookings);

  app.delete(join("/:id"), AuthCognitoServ.isAuthenticated(), deleteSingleCampaign);

  app.post(join("/:id/resubmit"), AuthCognitoServ.isAuthenticated(), resubmit);

  app.get(join("/:id/cancelCampaign"), AuthCognitoServ.isAuthenticated(), cancelCampaign);

  app.put(join("/:id/replaceMedia"), AuthCognitoServ.isAuthenticated(), replaceMedia);

  app.put(join("/cancelCampaign/byNetworkOwner"), AuthCognitoServ.isAuthenticated(), cancelCampaignByNetworkOwner);

};

const setSession = async (req, res) => {
  try {
    let campaign = req.body
    req.user = req.session.user
    req.session.newCampaign = null
    let checkBlackedUsersListings = await(CampaignServ.checkBlockedUsersListings(req.user._id, campaign))
    if (checkBlackedUsersListings)
      return res.status(400).send(checkBlackedUsersListings);
    req.session.user.userType = 'advertiser'
    req.session.newCampaign = campaign
    return res.send(req.session.newCampaign);
  } catch (err) {
    return res.status(400).send(err);
  }
};

const setSessionNewCampaign = (req, res) => {
  let campaign = req.body
  req.session.newCampaign = campaign
  return res.send(req.session.newCampaign);
};

const deleteSession = (req, res) => {
  let campaign = req.body
  if (req.session && req.session.user && req.session.user.userType )
    req.session.user.userType = 'advertiser'
  req.user = req.session.user
  if (req.session && req.session.newCampaign)
    delete req.session.newCampaign; 
  return res.send();
};

const getSession = (req, res) => {
  if (req.session.newCampaign) {
    return res.send(req.session.newCampaign);
  }
  return res.status(400).send('Session not available');
};

const createCampaign = async (req, res) => {
  try {
    var user = req.user;
    if (user.userType !== 'advertiser') {
      return res.status(401).send(user.name + " don't have permission to access");
    }
    var {
      campaign
    } = req.body;
    let checkBlackedUsersListings = await(CampaignServ.checkBlockedUsersListings(user._id, campaign))
    if (checkBlackedUsersListings)
      return res.status(400).send(checkBlackedUsersListings);
    if (campaign._id) {
      delete campaign._id
    }
    for (let i = 0; i < campaign.media.length; i++) {
      if (campaign.media[i].advertiserId !== user.advertiserId)
        return res.status(401).send(user.name + " don't have permission to access");
    }
    // campaign.budget.from = campaign.audience.from
    // campaign.budget.to = campaign.audience.to
    if (campaign.budget && !campaign.budget.from || !campaign.budget.to) {
      return res.status(400).send('Please give the date range')
    }
    if (campaign.signs.length > 0) {
      campaign.signTypeData = []
      for (let signlength = 0; signlength < campaign.signs.length; signlength++) {
        if (campaign.signs[signlength].childs) {
          campaign.signTypeData.push({
            _id: campaign.signs[signlength]._id,
            signType: campaign.signs[signlength].signType,
            childs: campaign.signs[signlength].childs
          })
        } else {
          campaign.signTypeData.push({
            _id: campaign.signs[signlength]._id,
            signType: campaign.signs[signlength].signType
          })
        }
      }
    }
    campaign.advertiserId = user.advertiserId
    campaign.orientation = 'Landscape'
    var result = await (CampaignServ.create(campaign))
    let _result = JSON.stringify(result)
    result = JSON.parse(_result)
    delete result.createdAt
    delete result.updatedAt
    var groupIds = [];
    var _signIds = []
    for (let signlength = 0; signlength < campaign.signs.length; signlength++) {
      if (campaign.signs[signlength].signType === "GROUP") {
        groupIds.push(campaign.signs[signlength]._id)
      } else {
        _signIds.push(campaign.signs[signlength]._id)
      }
    }
    var signs = []
    signs = signs.concat(_signIds)
    signs = signs.concat(groupIds)
    result.signs = signs
    result.audience = campaign.audience
    var result = await (CampaignServ._updateAudience(result, user, res))
    let _campaign = await CampaignServ.getDataForPaymentPage(result._id)
    req.session.newCampaign = _campaign
    return res.send(_campaign)
  } catch (err) {
    return res.status(400).send(err)
  }
};

const updateCampaign = async (req, res) => {
  let user = req.user
  if (user.userType !== 'advertiser') {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  let {
    id
  } = req.params;
  let {
    campaign
  } = req.body;
  let checkBlackedUsersListings = await(CampaignServ.checkBlockedUsersListings(user._id, campaign))
  if (checkBlackedUsersListings)
    return res.status(400).send(checkBlackedUsersListings);
  // campaign.budget.from = campaign.audience.from
  // campaign.budget.to = campaign.audience.to
  if (campaign.budget && !campaign.budget.from || !campaign.budget.to) {
    return res.status(400).send('Please give the date range')
  }
  campaign.orientation = 'Landscape'
  try {
    let [__campaign] = await (CampaignServ.find({
      _id: id
    }))
    if (__campaign.advertiserId.toString() !== user.advertiserId.toString()) {
      return res.status(401).send("Access denied.")
    }
    let _campaign = JSON.stringify(campaign)
    campaign = JSON.parse(_campaign)
    if (campaign.signs.length > 0) {
      campaign.signTypeData = []
      for (let signlength = 0; signlength < campaign.signs.length; signlength++) {
        if (campaign.signs[signlength].childs) {
          campaign.signTypeData.push({
            _id: campaign.signs[signlength]._id,
            signType: campaign.signs[signlength].signType,
            childs: campaign.signs[signlength].childs
          })
        } else {
          campaign.signTypeData.push({
            _id: campaign.signs[signlength]._id,
            signType: campaign.signs[signlength].signType
          })
        }
      }
    }
    let totalCost = await (CampaignServ.calculateBudgetForAudiencePage(campaign, user))
    campaign.budget.price = totalCost
    let result = await (CampaignServ.update(id, campaign))
    _campaign = await CampaignServ.getDataForPaymentPage(result._id)
    req.session.newCampaign = _campaign
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
}

const makePayment = async (req, res) => {
  var user = req.user;
  if (user.userType !== 'advertiser') {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  var id = req.session.newCampaign._id;
  var campaign = req.session.newCampaign;
  let checkBlackedUsersListings = await(CampaignServ.checkBlockedUsersListings(user._id, campaign))
  if (checkBlackedUsersListings)
    return res.status(400).send(checkBlackedUsersListings);
  var startDate = moment(campaign.budget.from).format('YYYY-MM-DD');
  var endDate = moment(campaign.budget.to).format('YYYY-MM-DD');
  var totalStartDays = moment(startDate).diff(moment(new Date()), 'days');
  var totalEndDays = moment(endDate).diff(moment(startDate), 'days');
  if (req.body.coupon)
    var coupen = req.body.coupon.toUpperCase()
  var _id = campaign._id
  var err = {}
  if (campaign.signTypeData.length <= 0) {
    err = 'Select any listing '
    res.status(400).send(err)
  } else {
    var data = await (CampaignServ.avilableSignsAndGroupData(campaign._id))
    var _campaign = data.campaign
    var campaign = calculateAmountForMakePayment(data, res, user)
    var totalAmount = campaign.totalAmount
    if (totalAmount <= 0)
      return res.status(400).send("Total amount should be greater than zero.");
    var amount = JSON.parse(JSON.stringify(campaign.totalAmount))
    campaign.amount = amount
    if (coupen && coupen !== undefined) {
      try {
        var _coupen = await (checkIsValid(user, coupen))
        if (_coupen.err) {
          return res.status(400).send(_coupen.err)
        } else {
          if (_coupen.transactionMinLimit && _coupen.transactionMinLimit >= totalAmount)
            return res.status(400).send('Total cost is not eligible to apply coupon.')
          if (_coupen.valueType && _coupen.valueType === "PERCENTAGE") {
            _coupen.amount = (_coupen.value * totalAmount) / 100;
            totalAmount = (totalAmount - _coupen.amount).toFixed(2)
          } else {
            _coupen.amount = _coupen.value
            totalAmount = (totalAmount - _coupen.amount).toFixed(2)
          }
          totalAmount = totalAmount * 1
        }
      } catch (err) {
        console.log(err)
        return res.status(400).send(err)
      }
    }
    try {
      var result = await (CampaignServ.makePayment(res, id, campaign, user, totalAmount, coupen))
      return res.send(result)
    } catch (err) {
      console.log(err)
      return res.status(400).send(err)
    }
  }
};

var calculateAmountForMakePayment = (data, res, user) => {
  var campaign = data.campaign
  if (campaign.budget.periodInDays) {
    var totalDays = campaign.budget.periodInDays
  } else {
    var from = moment(campaign.budget.from).format('YYYY-MM-DD');
    var to = moment(campaign.budget.to).format('YYYY-MM-DD');
    var _totalDays = moment(from).diff(moment(to), 'days');
    var totalDays = Math.abs(_totalDays) + 1;
  }
  var totalAmount = 0
  var unwantedSigns = data.unwantedSigns
  var signs = campaign.signs
  for (let i = 0; i < unwantedSigns.length; i++) {
    var groupMap = {}
    let _wantedSign = unwantedSigns[i]
    if (!_wantedSign.group) {
      let err = 'No available slot in ' + unwantedSigns[i].sign.name.toString()
      return res.status(400).send(err)
    } else {
      if (groupMap[_wantedSign.group._id]) {
        groupMap[_wantedSign.group._id] = groupMap[_wantedSign.group._id] + 1
      } else {
        groupMap[_wantedSign.group._id] = 1
      }
      if (groupMap[_wantedSign.group._id] === _wantedSign.group.length) {
        let err = 'No available sign in group ' + unwantedSigns[i].group.name.toString()
        return res.status(400).send(err)
      }
    }
  }
  for (let i = 0; i < signs.length; i++) {
    if (!signs[i].group) {
      if (signs[i].sign.networkOwnerId.toString() === user.networkOwnerId) {
        signs[i].sign.paidAmount = 0
        signs[i].sign.Amount = 0
      } else {
        let priceOfSign = (signs[i].sign.pricePerSlot / 7) * totalDays
        totalAmount = totalAmount + (priceOfSign)
        totalAmount = totalAmount * 1
        signs[i].sign.paidAmount = priceOfSign
        signs[i].sign.Amount = priceOfSign
      }
    } else {
      if (signs[i].group.networkOwnerId.toString() === user.networkOwnerId) {
        signs[i].sign.paidAmount = 0
        signs[i].sign.Amount = 0
      } else {
        let priceOfSign = (signs[i].sign.pricePerSlot / 7) * totalDays
        let discountAmount = 0
        if (signs[i].group.discountValue) {
          discountAmount = ((100 - signs[i].group.discountValue) * priceOfSign) / 100;
        } else {
          discountAmount = priceOfSign
        }
        totalAmount = totalAmount + discountAmount
        signs[i].sign.paidAmount = discountAmount
        signs[i].sign.Amount = priceOfSign
        totalAmount = totalAmount * 1
      }
    }
  }
  campaign.totalAmount = totalAmount.toFixed(2)
  return campaign;
}

var checkIsValid = async (user, coupenId) => {
  var couponResult = {}
  try {
    var query = {
      name: coupenId
    }
    var [coupen] = await (CoupenServ.find(query))
    if (!coupen) {
      couponResult.err = 'Invalid coupon id.'
      return couponResult
    } else {
      var from = moment(coupen.from).format('YYYY-MM-DD')
      var to = moment(coupen.to).format('YYYY-MM-DD')
      var nowDate = moment(new Date()).format('YYYY-MM-DD')
      if (to < nowDate) {
        couponResult.err = 'Coupon id is expired.'
        return couponResult
      } else if (from > nowDate) {
        couponResult.err = 'Coupon id is not valid for now.'
        return couponResult
      } else {
        var query = {
          name: coupenId,
          user: user
        }
        // var coupenHistory = await(CoupenHistoryServ.find(query))
        if (coupen.useLimit) {
          var coupenHistory = await (CoupenHistoryServ.find(query))

          if (coupenHistory.length >= couponResult.useLimit) {
            couponResult.err = 'This user already used this coupon.'
            couponResult = coupen
            return couponResult
          } else {
            couponResult = coupen
            return couponResult
          }
        } else {
          couponResult = coupen
          return couponResult
        }
        // if (!coupenHistory || coupenHistory.length <= 0) {
        //   if (coupen.name === 'TEN10' && coupen.value !== 10) {
        //     couponResult.err = 'Amount is not match for this coupon.'
        //     return couponResult
        //   }
        //   if (coupen.name === 'T525' && coupen.value !== 25) {
        //     couponResult.err = 'Amount is not match for this coupon.'
        //     return couponResult
        //   }
        //   if (coupen.name === 'FIFTY' && coupen.value !== 50) {
        //     couponResult.err = 'Amount is not match for this coupon.'
        //     return couponResult
        //   }
        //   if (coupen.name === 'HU100' && coupen.value !== 100) {
        //     couponResult.err = 'Amount is not match for this coupon.'
        //     return couponResult
        //   }
        //   if (coupen.name === 'NEW10' && coupen.value !== 10) {
        //     couponResult.err = 'Amount is not match for this coupon.'
        //     return couponResult
        //   }
        //   if (coupen.name === 'NEW25' && coupen.value !== 25) {
        //     couponResult.err = 'Amount is not match for this coupon.'
        //     return couponResult
        //   }
        //   if (coupen.name === 'NEW50' && coupen.value !== 50) {
        //      couponResult.err = 'Amount is not match for this coupon.'
        //      return couponResult
        //   }
        //   return(coupen)
        // }
        // for (var i = 0; i < coupenHistory.length; i++) {
        //   if (coupenHistory[i].name === coupenId && coupenHistory[i].user.toString() === user._id.toString()) {
        //     couponResult.err ='This user already used this coupon.'
        //     return couponResult
        //   } else {
        //     couponResult.data = coupen
        //     return(couponResult)
        //   }
        // }
      }
    }
  } catch (err) {
    couponResult.err = err
    return couponResult
  }
}

var paymentSuccess = (req, res) => {
  var paymentId = req.query.paymentId;
  var payerId = req.query.PayerID;
  CampaignServ.paymentSuccess(paymentId, payerId, res, req)
    .then(function (campaign) {
      // res.redirect('/advertiser/reviewandpay/' + campaign._id)
    }).catch(function (err) {
      res.redirect('/payment')
    });
}

var paymentError = async (req, res) => {
  try {
    var token = req.query.token;
    let campaign = await(CampaignServ.paymentError(token))
    let _campaign = await(CampaignServ.findOneByIdForPayment(campaign._id))
    req.session.newCampaign = _campaign.campaign
    return res.redirect('/payment')
  } catch (err) {
    let _campaign = await(CampaignServ.findOneByIdForPayment(campaign._id))
    req.session.newCampaign = _campaign.campaign
    return res.redirect('/payment')
  }
}

var publishCampaignOnFreeSign = async (req, res) => {
  var user = req.user;
  if (user.userType !== 'advertiser') {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  var id = req.session.newCampaign._id;
  var campaign = req.session.newCampaign
  let checkBlackedUsersListings = await(CampaignServ.checkBlockedUsersListings(user._id, campaign))
  if (checkBlackedUsersListings)
    return res.status(400).send(checkBlackedUsersListings);
  if (campaign.budget.price > 0)
    return res.status(400).send("This function is only for campaign with zero cost.");
  var startDate = moment(campaign.budget.from).format('YYYY-MM-DD');
  var endDate = moment(campaign.budget.to).format('YYYY-MM-DD');
  var totalStartDays = moment(startDate).diff(moment(new Date()), 'days');
  var totalEndDays = moment(endDate).diff(moment(startDate), 'days');
  // if (totalStartDays < 0 || totalEndDays < 0) {
  //   return res.status(400).send('Please give the valid date range')
  // }
  var err = {}
  if (campaign.signs.length <= 0) {
    err = 'Select any listing '
    res.status(400).send(err)
  } else {
    try {
      var result = await (calculationAndVerifySignStatus(campaign, user))
      var campaign = result.campaign
      if (result.errData) {
        let err = {}
        err = result.errData
        return res.status(400).send(err)
      }
      var _result = await (CampaignServ.publishCampaignOnFreeSign(id, campaign, user, res, req))
      req.session.requestFrom = null
      req.session.newCampaign = null
      req.session.campaignId = null
      res.send(_result)
    } catch (err) {
      res.status(400).send(err)
    }
  }
};

var calculationAndVerifySignStatus = async (campaign, user, status) => {
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
    var signData = await (SignServ.find({
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

var publishCampaignOnFreeSignWithCoupen = async (req, res) => {
  var user = req.user;
  if (user.userType !== 'advertiser') {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  var id = req.session.newCampaign._id;
  var campaign = req.session.newCampaign;
  let checkBlackedUsersListings = await(CampaignServ.checkBlockedUsersListings(user._id, campaign))
  if (checkBlackedUsersListings)
    return res.status(400).send(checkBlackedUsersListings);
  var startDate = moment(campaign.budget.from).format('YYYY-MM-DD');
  var endDate = moment(campaign.budget.to).format('YYYY-MM-DD');
  var totalStartDays = moment(startDate).diff(moment(new Date()), 'days');
  var totalEndDays = moment(endDate).diff(moment(startDate), 'days');
  // if (totalStartDays < 0 || totalEndDays < 0) {
  //   return res.status(400).send('Please give the valid date range')
  // }
  var coupen = req.body.coupon.toUpperCase()
  if (campaign.signs.length <= 0) {
    res.status(400).send('Select any listing')
  } else {
    try {
      var _coupen = await (checkIsValid(user, coupen))
      var totalAmount = 0
      if (_coupen.err) {
        return res.status(400).send(_coupen.err)
      } else {
        var data = await (CampaignServ.avilableSignsAndGroupData(campaign._id))
        var campaign = calculateAmountForMakePayment(data, res, user)
        if (_coupen.transactionMinLimit && _coupen.transactionMinLimit >= totalAmount) {
          return res.status(400).send('Total cost is not eligible to apply coupon.')
        }
        if (_coupen.valueType && _coupen.valueType === "PERCENTAGE") {
          _coupen.amount = (_coupen.value * campaign.totalAmount) / 100;
          totalAmount = (_coupen.amount).toFixed(2)
        } else {
          _coupen.amount = _coupen.value
          totalAmount = (_coupen.amount).toFixed(2)
        }
        totalAmount = totalAmount * 1
        if (campaign.budget.price - totalAmount > 0) {
          res.status(400).send('Access denied.')
        } else {
          await (CampaignServ.publishCampaignOnFreeSignWithCoupen(campaign, user, _coupen, res, req))
        }
      }
    } catch (err) {
      console.log(err)
      res.status(400).send(err)
    }
  }
};

var getCampaign = async (req, res) => {
  var user = req.user;
  var {
    id
  } = req.params;
  try {
    var result = await (CampaignServ.getCampaignDetails(id))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
};

var paginationForCampaigns = async (req, res) => {
  var advertiserId, params, response, user;
  user = req.user;
  advertiserId = user.advertiserId;
  params = req.body;
  response = {};
  try {
    var data = await (CampaignServ.getCampaigns(params, advertiserId))
    return res.send(data)
  } catch (err) {
    console.log("err")
    console.log(err)
    return res.status(400).send(err.message);
  }

};

var deleteSingleCampaign = async (req, res) => {
  var user = req.user;
  // if (user.userType === 'advertiser') {
  //   return res.status(401).send(user.name + " don't have permission to access");
  // }
  var {
    id
  } = req.params;
  try {
    var [_campaign] = await (CampaignServ.find({
      _id: id
    }))
    if (_campaign.advertiserId.toString() !== user.advertiserId.toString()) {
      return res.status(401).send("Access denied.")
    }
    if (_campaign._paymentStatus === "approved") {
      return res.status(400).send("Can't able to delete this campaign because it has published.")
    }
    var result = await (CampaignServ.delete(id, user))
    if (req.session.campaignId === result._id) {
      req.session.campaignId = null
    }
    res.send(result)
  } catch (err) {
    console.log(err)
    res.status(400).send(err)
  }
};

var resubmit = async (req, res) => {
  var user = req.user;
  var {
    id
  } = req.params;
  var data = req.body;
  try {
    let result = await (CampaignServ.resubmit(id, data, user))
    return res.send(result);
  } catch (err) {
    return res.status(400).send(err)
  }
};

var cancelCampaign = async (req, res) => {
  let user = req.user
  let {
    id
  } = req.params
  try {
    let campaign = await (CampaignServ.findOneById(id, user))
    campaign = campaign.campaign
    for (let i = 0; i < campaign.campaignStatus.length; i++) {
      campaign.campaignStatus[i].status = "CANCELED";
    }
    delete campaign.createdAt
    delete campaign.updatedAt
    let data = await (CampaignServ.update(campaign._id.toString(), campaign))
    await (CampaignServ.cancelCampaign(campaign, res, data))
  } catch (err) {
    return res.status(400).send(err)
  }
}

var replaceMedia = async (req, res) => {
  var user = req.user;
  var campaignId = req.params.id;
  var campaignMedia = req.body;
  try {
    await (CampaignServ.replaceMedia(campaignId, campaignMedia, user, res))
  } catch (err) {
    return res.status(400).send(err)
  }
};

const cancelCampaignByNetworkOwner = async (req, res) => {
  let user = req.user
  let campaignId = req.body.campaignId
  let listingId = req.body.listingId
  try {
    let [campaign] = await (CampaignServ.findQuery({_id: campaignId}))
    let isValid = false
    for (let i = 0; i < campaign.campaignStatus.length; i++) {
      if (campaign.campaignStatus[i].sign.toString() === listingId.toString()) {
        isValid = true
        break
      }
    }
    if (!isValid)
      return res.status(401).send('Access denied.')
    for (let i = 0; i < campaign.campaignStatus.length; i++) {
      campaign.campaignStatus[i].status = "CANCELED";
    }
    delete campaign.createdAt
    delete campaign.updatedAt
    let data = await (CampaignServ.update(campaign._id.toString(), campaign))
    await (CampaignServ.cancelCampaign(campaign, res, data))
  } catch (err) {
    return res.status(400).send(err)
  }
}
const signBookings = async (req, res) => {
  try {
    let params = req.body
    let data = await(CampaignServ.signBookings(params.sign,params.from, params.to))
    if (data.err) {
      res.status(400).send(data)
    } else {
      res.send(data)
    }
  } catch (err) {
    return res.status(400).send(err)
  }
}
