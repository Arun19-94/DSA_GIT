var config = require('../../../../config/config.js');

var path = require("path");

var index = `${config.server.context}/api/advertisers/payment/coupen`;

var CoupenServ = require("./coupen.service");

var CoupenHistoryServ = require("../coupenHistory/coupenHistory.service");

var AuthCognitoServ = require('../../../../components/auth/cognito/auth');

var Coupen = require('./coupen.schema')

var await = require('asyncawait/await');

var moment = require('moment')

var join = link => path.join(index, link != null ? link : "");

module.exports = function (app) {

  app.post(join(), AuthCognitoServ.isAuthenticated(), checkIsValid);

  // insert coupon
  if (config.runningMode === 'automation') {
    app.post(join("/createCoupen"), createCoupen);
  }

};

var checkIsValid = async (req, res) => {
  var user = req.user
  var coupenId = req.body.couponId
  var totalAmount = req.body.totalAmount
  try {
    var query = {
      name: coupenId
    }
    var [coupen] = await (CoupenServ.find(query))
    if (!coupen) {
      res.status(400).send('Invalid coupon id.')
    } else {
      var from = moment(coupen.from).format('YYYY-MM-DD')
      var to = moment(coupen.to).format('YYYY-MM-DD')
      var nowDate = moment(new Date()).format('YYYY-MM-DD')
      if (to < nowDate) {
        res.status(400).send('Coupon id is expired.')
      } else if (from > nowDate) {
        res.status(400).send('Coupon id is not valid for now.')
      } else {
        if (coupen.transactionMinLimit && coupen.transactionMinLimit >= totalAmount) {
          return res.status(400).send('Total cost is not eligible to apply coupon.')
        }
        var query = {
          name: coupenId,
          user: user,
        }
        if (coupen.useLimit) {
          var coupenHistory = await (CoupenHistoryServ.find(query))
          if (coupenHistory.length >= coupen.useLimit) {
            res.status(400).send('This user already used this coupon.')
          } else {
            res.send(coupen)
          }
        } else {
          res.send(coupen)
        }
        // var coupenHistory = await(CoupenHistoryServ.find(query))
        // if (!coupenHistory || coupenHistory.length <= 0) {
        //   if (coupen.name === 'TEN10' && coupen.value !== 10) {
        //     res.status(400).send('Amount is not match for this coupon.')
        //   }
        //   if (coupen.name === 'T525' && coupen.value !== 25) {
        //     res.status(400).send('Amount is not match for this coupon.')
        //   }
        //   if (coupen.name === 'FIFTY' && coupen.value !== 50) {
        //     res.status(400).send('Amount is not match for this coupon.')
        //   }
        //   if (coupen.name === 'HU100' && coupen.value !== 100) {
        //     res.status(400).send('Amount is not match for this coupon.')
        //   }
        //   if (coupen.name === 'NEW10' && coupen.value !== 10) {
        //     res.status(400).send('Amount is not match for this coupon.')
        //   }
        //   if (coupen.name === 'NEW25' && coupen.value !== 25) {
        //     res.status(400).send('Amount is not match for this coupon.')
        //   }
        //   if (coupen.name === 'NEW50' && coupen.value !== 50) {
        //     res.status(400).send('Amount is not match for this coupon.')
        //   }
        //   res.send(coupen)
        // }
        // for (var i = 0; i < coupenHistory.length; i++) {
        //   if (coupenHistory[i].name === coupenId && coupenHistory[i].user.toString() === user._id.toString()) {
        //     res.status(400).send('This user already used this coupon.')
        //   } else {
        //     res.send(coupen)
        //   }
        // }
      }
    }
  } catch (err) {
    res.status(400).send(err)
  }
}

var installCoupen = async () => {
  var coupen = []
  var from = moment(new Date('JAN, 15, 2019'))
  var to = moment(new Date('DEC, 31, 2020'))
  coupen.push({ name: 'TEN10', from: from, to: to, value: 10, valueType: "FLAT-DISCOUNT", active: true, transactionMinLimit: 10 })
  coupen.push({ name: 'MACN1000', from: from, to: to, value: 10, valueType: "FLAT-DISCOUNT", active: true })
  coupen.push({ name: 'T525', from: from, to: to, value: 25, valueType: "FLAT-DISCOUNT", active: true, transactionMinLimit: 50 })
  coupen.push({ name: 'FIFTY', from: from, to: to, value: 50, valueType: "FLAT-DISCOUNT", active: true })
  coupen.push({ name: 'HU100', from: from, to: to, value: 100, valueType: "FLAT-DISCOUNT", active: true })
  coupen.push({ name: 'NEW75', from: from, to: to, value: 75, valueType: "FLAT-DISCOUNT", active: true })
  coupen.push({ name: 'AY4R6GU', from: from, to: to, value: 100, valueType: "FLAT-DISCOUNT", active: true })
  coupen.push({ name: 'DT3H8FW', from: from, to: to, value: 10, valueType: "FLAT-DISCOUNT", active: true })
  coupen.push({ name: 'PR8X2AQ', from: from, to: to, value: 25, valueType: "FLAT-DISCOUNT", active: true })
  coupen.push({ name: 'KT5S7BE', from: from, to: to, value: 75, valueType: "FLAT-DISCOUNT", active: true })
  coupen.push({ name: 'NEW10', from: from, to: to, value: 10, valueType: "FLAT-DISCOUNT", active: true, useLimit: 1 })
  coupen.push({ name: 'NEW25', from: from, to: to, value: 25, valueType: "FLAT-DISCOUNT", active: true, useLimit: 1 })
  coupen.push({ name: 'NEW50', from: from, to: to, value: 50, valueType: "FLAT-DISCOUNT", active: true, useLimit: 1 })
  coupen.push({ name: 'HALF', from: from, to: to, value: 50, valueType: "PERCENTAGE", active: true })
  coupen.push({ name: 'NEWHALF', from: from, to: to, value: 50, valueType: "PERCENTAGE", active: true, useLimit: 1 })
  coupen.push({ name: '10%', from: from, to: to, value: 10, valueType: "PERCENTAGE", active: true, transactionMinLimit: 50 })
  coupen.push({ name: '20%', from: from, to: to, value: 20, valueType: "PERCENTAGE", active: true })
  coupen.push({ name: '30%', from: from, to: to, value: 30, valueType: "PERCENTAGE", active: true })
  coupen.push({ name: '25%', from: from, to: to, value: 25, valueType: "PERCENTAGE", active: true })
  coupen.push({ name: 'NEW25%', from: from, to: to, value: 25, valueType: "PERCENTAGE", active: true, useLimit: 1 })
  for (var i = 0; i < coupen.length; i++) {
    var [existCoupen] = await(Coupen.find({ name: coupen[i].name }))
    if (!existCoupen) {
      //   var couponId = existCoupen._id
      //   if (moment(existCoupen.to).toISOString() !== moment(coupen[i].to).toISOString()) {
      //     await(CoupenServ.updateCoupon(couponId, coupen[i]))
      //   }
      // } else {
      var _coupen = new Coupen(coupen[i])
      _coupen.save()
    }
  }
}

var createCoupen = async (req, res) => {
  try {
    var coupen = req.body.coupen
    coupen.from = new Date()
    coupen.to = new Date()
    coupen.active = true
    if (!coupen.name) {
      return res.status(400).send('please enter name.')
    }
    if (!coupen.value) {
      return res.status(400).send('please enter value.')
    }
    if (!coupen.valueType) {
      return res.status(400).send('please enter coupon Type.')
    }
    var name = coupen.name.toUpperCase()
    coupen.name = name
    var query = { name: name };
    var previousCoupon = await (CoupenServ.find(query))
    if (previousCoupon.length > 0) {
      return res.status(400).send('Coupon name already used.')
    }
    try {
      await (CoupenServ.createCoupen(coupen))
      return res.status(200).send("Coupen Created")
    } catch (err) {
      return res.status(400).send(err)
    }
  } catch (err) {
    return res.status(400).send(err)
  }
}

installCoupen()