var Payment = require('./payment.schema');

var signServ = require('../../networkOwner/sign/sign.service')

var GroupSer = require('../../networkOwner/group/group.service')

var CampaignServ = require('../campaign/campaign.service')

var BookingServ = require('../../networkOwner/sign/booking/booking.service')

var UserServ = require('../../user/user.service')

var moment = require('moment')

var async = require('asyncawait/async');

var await = require('asyncawait/await');

var PaymentSchema = require('./paymentSummary/paymentSummary.schema');

var mongoose = require('mongoose');

var PaymentSummaryService = require('./paymentSummary/paymentSummary.service');

this.create = function (payment) {
  payment = new Payment(payment);
  return payment.save();
};

this.update = function (_id, payment) {
  var promise = new Promise(function (resolve, reject) {
    return Payment.findOneAndUpdate({
      _id
    }, {
      '$set': payment
    }, {
      new: true
    }, function (err, result) {
      if (err) {
        return Payment(err);
      } else if (payment === null) {
        return reject(new Error("Payment not exists!"));
      } else {
        return resolve(result);
      }
    });
  });
  return promise;
};

this.find = function (query) {
  if (query == null) {
    query = {};
  }
  return Payment
    .find(query).populate('campaign').populate('advertiser').sort('-createdAt');
};

this.paginationForPayments = async (function (params, networkOwnerId) {
  var promise;
  promise = new Promise(function (resolve, reject) {
    var paymentFilter, filter, limit, searchText, skip;
    skip = params.skip;
    limit = params.limit;
    searchText = params.searchText;
    filter = params.filter;
    paymentFilter = {
      networkOwnerId: networkOwnerId,
      status: {
        '$ne': 'DELETED'
      }
    };
    var signMap = {}
    var paymentMap = {}
    var _payments = []
    var _amount = []
    var signs = []
    var paymentStatusMap = {}
    var paymentMapForTotalRevenue = {}
    var paymentMapForTotalRevenue1 = {}
    var paymentMapForTotalRevenue2 = {}
    var paymentMapForLastWeek = {}
    var paymentMapForCurrentWeek = {}
    var paymentStatusForEachSign = []
    var totalRevenue = 0
    var lastWeekRevenue = 0
    var currentWeekRevenue = 0
    var _limit = 0
    var _searchText = searchText.toLowerCase()
    if (filter !== "all") {
      var currentDate = moment().format('YYYY-MM-DD')
      var filterDate = moment().subtract(filter, "days").format('YYYY-MM-DD')
    }
    var currentWeekStartDate = moment().isoWeekday(1).startOf('week').format('YYYY-MM-DD')
    var currentWeekEndDate = moment().isoWeekday(1).endOf('week').format('YYYY-MM-DD')
    var lastWeekStartDate = moment().isoWeekday(-1).startOf('week').format('YYYY-MM-DD')
    var lastWeekEndDate = moment().isoWeekday(-1).endOf('week').format('YYYY-MM-DD')
    var signs = await (signServ.find(paymentFilter).sort('-createdAt'))
    for (var i = 0; i < signs.length; i++) {
      var sign = signs[i]
      if (!signMap[sign._id]) {
        signMap[sign._id] = sign._id
      }
    }
    var payments = await (Payment.find().populate('campaign').populate('advertiser').populate('user').sort('-createdAt'))
    var originalAmount = 0
    for (var i = 0; i < payments.length; i++) {
      var payment = payments[i]
      for (var j = 0; j < payment.paymentDetails.length; j++) {
        if (signMap[payment.paymentDetails[j].sign] && payment.campaign !== null) {
          for (var k = 0; k < signs.length; k++) {
            if (signs[k]._id.toString() === payment.paymentDetails[j].sign.toString()) {
              if (filter === "all") {
                if (payment.status === 'approved') {
                  if (!paymentMapForTotalRevenue[payment.paymentDetails[j]._id]) {
                    if (payment.paymentDetails[j].paymentType !== 'GROUP_PAYMENT') {
                      totalRevenue += (payment.paymentDetails[j].amount * 70) / 100
                    } else if (payment.paymentDetails[j].paymentType === 'GROUP_PAYMENT') {
                      if (payment.paymentDetails[j].originalAmount) {
                        var discount = payment.paymentDetails[j].amount / payment.paymentDetails[j].originalAmount
                      } else if (!payment.paymentDetails[j].originalAmount) {
                        var discount = 0.90
                      }
                      discount = Math.round(discount * 100)
                      discount = 100 - discount
                      var calculateDiscountedValue = 70 - discount
                      if (!payment.paymentDetails[j].originalAmount) {
                        originalAmount = payment.paymentDetails[j].amount / 0.9
                      } else if (payment.paymentDetails[j].originalAmount) {
                        originalAmount = payment.paymentDetails[j].originalAmount
                      }
                      totalRevenue += (originalAmount * calculateDiscountedValue) / 100;
                      for (var signIndex = 0; signIndex < signs.length; signIndex++) {
                        if (signs[signIndex].signType === 'GROUP') {
                          for (var childlength = 0; childlength < signs[signIndex].childs.length; childlength++) {
                            if (signs[signIndex].childs[childlength]._id.toString() === payment.paymentDetails[j].sign.toString()) {
                              if (payment.paymentDetails[j].originalAmount) {
                                var discount = payment.paymentDetails[j].amount / payment.paymentDetails[j].originalAmount
                              } else if (!payment.paymentDetails[j].originalAmount) {
                                var discount = 0.90
                              }
                              discount = Math.round(discount * 100)
                              discount = 100 - discount
                              var calculateDiscountedValue = 70 - discount
                              if (!payment.paymentDetails[j].originalAmount) {
                                originalAmount = payment.paymentDetails[j].amount / 0.9
                              } else if (payment.paymentDetails[j].originalAmount) {
                                originalAmount = payment.paymentDetails[j].originalAmount
                              }
                              // originalAmount = payment.paymentDetails[j].amount / 0.9
                              totalRevenue += (originalAmount * 3) / 100;
                            }
                          }
                        }
                      }
                    }
                    if (!paymentMap[payment._id]) {
                      paymentStatusForEachSign.push(payment)
                    }
                    paymentMapForTotalRevenue[payment.paymentDetails[j]._id] = payment.paymentDetails[j]._id
                    paymentMap[payment._id] = payment._id
                  }
                  if (!paymentMap[payment._id]) {
                    paymentStatusForEachSign.push(payment)
                  }
                  paymentMapForTotalRevenue[payment.paymentDetails[j]._id] = payment.paymentDetails[j]._id
                  paymentMap[payment._id] = payment._id
                }
              }
              if (filter !== "all") {
                if (payment.status === 'approved' && (payment.successResponse && moment(payment.successResponse.create_time).format('YYYY-MM-DD') || moment(payment.createdAt).format('YYYY-MM-DD')) <= currentDate && (payment.successResponse && moment(payment.successResponse.create_time).format('YYYY-MM-DD') || moment(payment.createdAt).format('YYYY-MM-DD')) >= filterDate) {
                  if (!paymentMapForTotalRevenue[payment.paymentDetails[j]._id]) {
                    if (payment.paymentDetails[j].paymentType !== 'GROUP_PAYMENT') {
                      totalRevenue += (payment.paymentDetails[j].amount * 70) / 100
                    } else if (payment.paymentDetails[j].paymentType === 'GROUP_PAYMENT') {
                      originalAmount = payment.paymentDetails[j].amount / 0.9
                      totalRevenue += (originalAmount * 60) / 100
                      for (var signIndex = 0; signIndex < signs.length; signIndex++) {
                        if (signs[signIndex].signType === 'GROUP') {
                          for (var childlength = 0; childlength < signs[signIndex].childs.length; childlength++) {
                            if (signs[signIndex].childs[childlength]._id.toString() === payment.paymentDetails[j].sign.toString()) {
                              if (payment.paymentDetails[j].originalAmount) {
                                var discount = payment.paymentDetails[j].amount / payment.paymentDetails[j].originalAmount
                              } else if (!payment.paymentDetails[j].originalAmount) {
                                var discount = 0.90
                              }
                              discount = Math.round(discount * 100)
                              discount = 100 - discount
                              var calculateDiscountedValue = 70 - discount
                              if (!payment.paymentDetails[j].originalAmount) {
                                originalAmount = payment.paymentDetails[j].amount / 0.9
                              } else if (payment.paymentDetails[j].originalAmount) {
                                originalAmount = payment.paymentDetails[j].originalAmount
                              }
                              // originalAmount = payment.paymentDetails[j].amount / 0.9
                              totalRevenue += (originalAmount * 3) / 100;
                            }
                          }
                        }
                      }
                    }
                    // totalRevenue += (payment.amount * 70) / 100
                    if (!paymentMap[payment._id]) {
                      paymentStatusForEachSign.push(payment)
                    }
                    paymentMapForTotalRevenue[payment.paymentDetails[j]._id] = payment.paymentDetails[j]._id
                    paymentMap[payment._id] = payment._id
                  }
                }
              }
              if (payment.status === 'approved' && (payment.successResponse && moment(payment.successResponse.create_time).format('YYYY-MM-DD') || moment(payment.createdAt).format('YYYY-MM-DD')) >= currentWeekStartDate && (payment.successResponse && moment(payment.successResponse.create_time).format('YYYY-MM-DD') || moment(payment.createdAt).format('YYYY-MM-DD')) <= currentWeekEndDate) {
                // if (!paymentMap[payment._id]) {
                if (!paymentMapForTotalRevenue1[payment.paymentDetails[j]._id]) {
                  if (payment.paymentDetails[j].paymentType !== 'GROUP_PAYMENT') {
                    // if (payment.paymentDetails[j].paymentType !== 'GROUP_PAYMENT' && payment.paymentDetails[j].paymentType === 'NORMAL_PAYMENT') {
                    currentWeekRevenue += (payment.paymentDetails[j].amount * 70) / 100
                  } else if (payment.paymentDetails[j].paymentType === 'GROUP_PAYMENT') {
                    originalAmount = payment.paymentDetails[j].amount / 0.9
                    currentWeekRevenue += (originalAmount * 60) / 100
                    for (var signIndex = 0; signIndex < signs.length; signIndex++) {
                      if (signs[signIndex].signType === 'GROUP') {
                        for (var childlength = 0; childlength < signs[signIndex].childs.length; childlength++) {
                          if (signs[signIndex].childs[childlength]._id.toString() === payment.paymentDetails[j].sign.toString()) {
                            if (payment.paymentDetails[j].originalAmount) {
                              var discount = payment.paymentDetails[j].amount / payment.paymentDetails[j].originalAmount
                            } else if (!payment.paymentDetails[j].originalAmount) {
                              var discount = 0.90
                            }
                            discount = Math.round(discount * 100)
                            discount = 100 - discount
                            var calculateDiscountedValue = 70 - discount
                            if (!payment.paymentDetails[j].originalAmount) {
                              originalAmount = payment.paymentDetails[j].amount / 0.9
                            } else if (payment.paymentDetails[j].originalAmount) {
                              originalAmount = payment.paymentDetails[j].originalAmount
                            }
                            // originalAmount = payment.paymentDetails[j].amount / 0.9
                            currentWeekRevenue += (originalAmount * 3) / 100;
                          }
                        }
                      }
                    }
                  }
                  paymentMapForTotalRevenue1[payment.paymentDetails[j]._id] = payment.paymentDetails[j]._id
                  paymentMap[payment._id] = payment._id
                }
              }
              if (payment.status === 'approved' && (payment.successResponse && moment(payment.successResponse.create_time).format('YYYY-MM-DD') || moment(payment.createdAt).format('YYYY-MM-DD')) >= lastWeekStartDate && (payment.successResponse && moment(payment.successResponse.create_time).format('YYYY-MM-DD') || moment(payment.createdAt).format('YYYY-MM-DD')) <= lastWeekEndDate) {
                // if (!paymentMap[payment._id]) {
                if (!paymentMapForTotalRevenue2[payment.paymentDetails[j]._id]) {
                  if (payment.paymentDetails[j].paymentType !== 'GROUP_PAYMENT') {
                    // if (payment.paymentDetails[j].paymentType !== 'GROUP_PAYMENT' && payment.paymentDetails[j].paymentType === 'NORMAL_PAYMENT') {
                    lastWeekRevenue += (payment.paymentDetails[j].amount * 70) / 100
                  } else if (payment.paymentDetails[j].paymentType === 'GROUP_PAYMENT') {
                    originalAmount = payment.paymentDetails[j].amount / 0.9
                    lastWeekRevenue += (originalAmount * 60) / 100
                    for (var signIndex = 0; signIndex < signs.length; signIndex++) {
                      if (signs[signIndex].signType === 'GROUP') {
                        for (var childlength = 0; childlength < signs[signIndex].childs.length; childlength++) {
                          if (signs[signIndex].childs[childlength]._id.toString() === payment.paymentDetails[j].sign.toString()) {
                            if (payment.paymentDetails[j].originalAmount) {
                              var discount = payment.paymentDetails[j].amount / payment.paymentDetails[j].originalAmount
                            } else if (!payment.paymentDetails[j].originalAmount) {
                              var discount = 0.90
                            }
                            discount = Math.round(discount * 100)
                            discount = 100 - discount
                            var calculateDiscountedValue = 70 - discount
                            if (!payment.paymentDetails[j].originalAmount) {
                              originalAmount = payment.paymentDetails[j].amount / 0.9
                            } else if (payment.paymentDetails[j].originalAmount) {
                              originalAmount = payment.paymentDetails[j].originalAmount
                            }
                            // originalAmount = payment.paymentDetails[j].amount / 0.9
                            lastWeekRevenue += (originalAmount * 3) / 100;
                          }
                        }
                      }
                    }
                  }
                  // lastWeekRevenue += (payment.amount * 70) / 100
                  paymentMapForTotalRevenue2[payment.paymentDetails[j]._id] = payment.paymentDetails[j]._id
                  paymentMap[payment._id] = payment._id
                }
              }

            }
          }
        }
      }
    }
    var _signs = []
    var totalRevenueOfEachSign = []
    var paymentStatusForSign = []
    var paymentStatusMap = {}
    var _totalRevenueOfEachSign = 0
    var _currentWeekRevenueOfEachSign = 0
    var currentWeekRevenueOfEachSign = []
    var _lastWeekRevenueOfEachSign = 0
    var lastWeekRevenueOfEachSign = []
    var _bookingArrayForCurrentWeek = 0
    var bookingArrayForCurrentWeek = []
    var _bookingArrayForLastWeek = 0
    var bookingArrayForLastWeek = []
    var totalBookingsForCurrentWeek = 0
    var totalBookingsForLastWeek = 0
    var lifetimeSlotBookingForEachSign = []
    var _lifetimeSlotBookingForEachSign = 0
    var totalLifetimeSlotBooking = 0

    for (var i = 0; i < signs.length; i++) {
      var sign = signs[i]
      var bookingsForCurrentWeek = await (BookingServ.listBookings(sign._id, currentWeekStartDate, currentWeekEndDate).sort('-createdAt'))
      var bookingsForLastWeek = await (BookingServ.listBookings(sign._id, lastWeekStartDate, lastWeekEndDate).sort('-createdAt'))
      if (filter === "all") {
        var query = {
          sign: sign._id
        }
        var lifetimeSlotBooking = await (BookingServ.listBookingsByQuery(query).sort('-createdAt'))
      }
      if (filter !== "all") {
        var lifetimeSlotBooking = await (BookingServ.listBookings(sign._id, filterDate, currentDate).sort('-createdAt'))
      }
      if (sign.name && sign.name.toLowerCase().indexOf(_searchText) >= 0) {
        _signs.push(sign)
        _totalRevenueOfEachSign = 0
        _currentWeekRevenueOfEachSign = 0
        _lastWeekRevenueOfEachSign = 0
        for (var j = 0; j < paymentStatusForEachSign.length; j++) {
          var _paymentDetails = paymentStatusForEachSign[j]

          if (_paymentDetails.status === 'approved') {

            for (var k = 0; k < _paymentDetails.paymentDetails.length; k++) {

              if (sign.signType === "SIGN") {
                if (sign._id.toString() === _paymentDetails.paymentDetails[k].sign.toString() && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) >= currentWeekStartDate && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) <= currentWeekEndDate) {
                  if (_paymentDetails.paymentDetails[k].paymentType !== 'GROUP_PAYMENT') {
                    _currentWeekRevenueOfEachSign += (_paymentDetails.paymentDetails[k].amount * 70) / 100
                  } else if (_paymentDetails.paymentDetails[k].paymentType === 'GROUP_PAYMENT') {
                    if (_paymentDetails.paymentDetails[k].originalAmount) {
                      var discount = _paymentDetails.paymentDetails[k].amount / _paymentDetails.paymentDetails[k].originalAmount
                    } else if (!_paymentDetails.paymentDetails[k].originalAmount) {
                      var discount = 0.90
                    }
                    discount = Math.round(discount * 100)
                    discount = 100 - discount
                    var calculateDiscountedValue = 70 - discount
                    if (!_paymentDetails.paymentDetails[k].originalAmount) {
                      originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                    } else if (_paymentDetails.paymentDetails[k].originalAmount) {
                      originalAmount = _paymentDetails.paymentDetails[k].originalAmount
                    }
                    _currentWeekRevenueOfEachSign += (originalAmount * calculateDiscountedValue) / 100;
                    // var originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                    // _currentWeekRevenueOfEachSign += (originalAmount * 60) / 100
                  }
                }
                if (sign._id.toString() === _paymentDetails.paymentDetails[k].sign.toString() && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) >= lastWeekStartDate && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) <= lastWeekEndDate) {
                  if (_paymentDetails.paymentDetails[k].paymentType !== 'GROUP_PAYMENT') {
                    _lastWeekRevenueOfEachSign += (_paymentDetails.paymentDetails[k].amount * 70) / 100
                  } else if (_paymentDetails.paymentDetails[k].paymentType === 'GROUP_PAYMENT') {
                    if (_paymentDetails.paymentDetails[k].originalAmount) {
                      var discount = _paymentDetails.paymentDetails[k].amount / _paymentDetails.paymentDetails[k].originalAmount
                    } else if (!_paymentDetails.paymentDetails[k].originalAmount) {
                      var discount = 0.90
                    }
                    discount = Math.round(discount * 100)
                    discount = 100 - discount
                    var calculateDiscountedValue = 70 - discount
                    if (!_paymentDetails.paymentDetails[k].originalAmount) {
                      originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                    } else if (_paymentDetails.paymentDetails[k].originalAmount) {
                      originalAmount = _paymentDetails.paymentDetails[k].originalAmount
                    }
                    _lastWeekRevenueOfEachSign += (originalAmount * calculateDiscountedValue) / 100;
                    // var originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                    // _lastWeekRevenueOfEachSign += (originalAmount * 60) / 100
                  }
                  // _lastWeekRevenueOfEachSign += (_paymentDetails.paymentDetails[k].amount * 70) / 100
                }
                if (filter === "all") {
                  if (sign._id.toString() === _paymentDetails.paymentDetails[k].sign.toString()) {
                    if (_paymentDetails.paymentDetails[k].paymentType !== 'GROUP_PAYMENT') {
                      _totalRevenueOfEachSign += (_paymentDetails.paymentDetails[k].amount * 70) / 100
                    } else if (_paymentDetails.paymentDetails[k].paymentType === 'GROUP_PAYMENT') {
                      if (_paymentDetails.paymentDetails[k].originalAmount) {
                        var discount = _paymentDetails.paymentDetails[k].amount / _paymentDetails.paymentDetails[k].originalAmount
                      } else if (!_paymentDetails.paymentDetails[k].originalAmount) {
                        var discount = 0.90
                      }
                      discount = Math.round(discount * 100)
                      discount = 100 - discount
                      var calculateDiscountedValue = 70 - discount
                      if (!_paymentDetails.paymentDetails[k].originalAmount) {
                        originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                      } else if (_paymentDetails.paymentDetails[k].originalAmount) {
                        originalAmount = _paymentDetails.paymentDetails[k].originalAmount
                      }
                      _totalRevenueOfEachSign += (originalAmount * calculateDiscountedValue) / 100;
                      // var originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                      // _totalRevenueOfEachSign += (originalAmount * 60) / 100
                    }
                    // _totalRevenueOfEachSign += (_paymentDetails.paymentDetails[k].amount * 70) / 100
                  }
                }
                if (filter !== "all") {
                  if (sign._id.toString() === _paymentDetails.paymentDetails[k].sign.toString() && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) <= currentDate && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) >= filterDate) {
                    if (_paymentDetails.paymentDetails[k].paymentType !== 'GROUP_PAYMENT') {
                      _totalRevenueOfEachSign += (_paymentDetails.paymentDetails[k].amount * 70) / 100
                    } else if (_paymentDetails.paymentDetails[k].paymentType === 'GROUP_PAYMENT') {
                      if (_paymentDetails.paymentDetails[k].originalAmount) {
                        var discount = _paymentDetails.paymentDetails[k].amount / _paymentDetails.paymentDetails[k].originalAmount
                      } else if (!_paymentDetails.paymentDetails[k].originalAmount) {
                        var discount = 0.90
                      }
                      discount = Math.round(discount * 100)
                      discount = 100 - discount
                      var calculateDiscountedValue = 70 - discount
                      if (!_paymentDetails.paymentDetails[k].originalAmount) {
                        originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                      } else if (_paymentDetails.paymentDetails[k].originalAmount) {
                        originalAmount = _paymentDetails.paymentDetails[k].originalAmount
                      }
                      _totalRevenueOfEachSign += (originalAmount * calculateDiscountedValue) / 100;
                      // var originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                      // _totalRevenueOfEachSign += (originalAmount * 60) / 100

                    }
                    // _totalRevenueOfEachSign += (_paymentDetails.paymentDetails[k].amount * 70) / 100
                  }
                }
              } else if (sign.signType === "GROUP") {
                for (var child = 0; child < sign.childs.length; child++) {
                  if (sign.childs[child]._id.toString() === _paymentDetails.paymentDetails[k].sign.toString() && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) >= currentWeekStartDate && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) <= currentWeekEndDate) {
                    // var originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                    if (_paymentDetails.paymentDetails[k].originalAmount) {
                      var discount = _paymentDetails.paymentDetails[k].amount / _paymentDetails.paymentDetails[k].originalAmount
                    } else if (!_paymentDetails.paymentDetails[k].originalAmount) {
                      var discount = 0.90
                    }
                    discount = Math.round(discount * 100)
                    discount = 100 - discount
                    var calculateDiscountedValue = 70 - discount
                    if (!_paymentDetails.paymentDetails[k].originalAmount) {
                      originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                    } else if (_paymentDetails.paymentDetails[k].originalAmount) {
                      originalAmount = _paymentDetails.paymentDetails[k].originalAmount
                    }
                    _currentWeekRevenueOfEachSign += (originalAmount * 3) / 100
                  }
                  if (sign.childs[child]._id.toString() === _paymentDetails.paymentDetails[k].sign.toString() && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) >= lastWeekStartDate && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) <= lastWeekEndDate) {
                    if (_paymentDetails.paymentDetails[k].originalAmount) {
                      var discount = _paymentDetails.paymentDetails[k].amount / _paymentDetails.paymentDetails[k].originalAmount
                    } else if (!_paymentDetails.paymentDetails[k].originalAmount) {
                      var discount = 0.90
                    }
                    discount = Math.round(discount * 100)
                    discount = 100 - discount
                    var calculateDiscountedValue = 70 - discount
                    if (!_paymentDetails.paymentDetails[k].originalAmount) {
                      originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                    } else if (_paymentDetails.paymentDetails[k].originalAmount) {
                      originalAmount = _paymentDetails.paymentDetails[k].originalAmount
                    }
                    // var originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                    _lastWeekRevenueOfEachSign += (originalAmount * 3) / 100
                  }
                  if (filter === "all") {
                    if (sign.childs[child]._id.toString() === _paymentDetails.paymentDetails[k].sign.toString() && _paymentDetails.paymentDetails[k].paymentType === 'GROUP_PAYMENT') {
                      if (_paymentDetails.paymentDetails[k].originalAmount) {
                        var discount = _paymentDetails.paymentDetails[k].amount / _paymentDetails.paymentDetails[k].originalAmount
                      } else if (!_paymentDetails.paymentDetails[k].originalAmount) {
                        var discount = 0.90
                      }
                      discount = Math.round(discount * 100)
                      discount = 100 - discount
                      var calculateDiscountedValue = 70 - discount
                      if (!_paymentDetails.paymentDetails[k].originalAmount) {
                        originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                      } else if (_paymentDetails.paymentDetails[k].originalAmount) {
                        originalAmount = _paymentDetails.paymentDetails[k].originalAmount
                      }
                      // var originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                      _totalRevenueOfEachSign += (originalAmount * 3) / 100

                    }
                  }
                  if (filter !== "all") {
                    if (sign.childs[child]._id.toString() === _paymentDetails.paymentDetails[k].sign.toString() && _paymentDetails.paymentDetails[k].paymentType === 'GROUP_PAYMENT' && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) <= currentDate && (_paymentDetails.successResponse && moment(_paymentDetails.successResponse.create_time).format('YYYY-MM-DD') || moment(_paymentDetails.createdAt).format('YYYY-MM-DD')) >= filterDate) {
                      if (_paymentDetails.paymentDetails[k].originalAmount) {
                        var discount = _paymentDetails.paymentDetails[k].amount / _paymentDetails.paymentDetails[k].originalAmount
                      } else if (!_paymentDetails.paymentDetails[k].originalAmount) {
                        var discount = 0.90
                      }
                      discount = Math.round(discount * 100)
                      discount = 100 - discount
                      var calculateDiscountedValue = 70 - discount
                      if (!_paymentDetails.paymentDetails[k].originalAmount) {
                        originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                      } else if (_paymentDetails.paymentDetails[k].originalAmount) {
                        originalAmount = _paymentDetails.paymentDetails[k].originalAmount
                      }
                      // var originalAmount = _paymentDetails.paymentDetails[k].amount / 0.9
                      _totalRevenueOfEachSign += (originalAmount * 3) / 100

                      // _totalRevenueOfEachSign += (_paymentDetails.paymentDetails[k].amount * 70) / 100
                    }
                  }
                }

              }

            }
          }
        }
        totalRevenueOfEachSign.push(_totalRevenueOfEachSign)
        currentWeekRevenueOfEachSign.push(_currentWeekRevenueOfEachSign)
        lastWeekRevenueOfEachSign.push(_lastWeekRevenueOfEachSign)
        _bookingArrayForCurrentWeek = 0
        _bookingArrayForLastWeek = 0
        _lifetimeSlotBookingForEachSign = 0
        var _j = 0
        for (var j = 0; j < lifetimeSlotBooking.length; j++) {
          if (moment(lifetimeSlotBooking[j].createdAt).format('YYYY-MM-DD') >= currentWeekStartDate && moment(lifetimeSlotBooking[j].createdAt).format('YYYY-MM-DD') <= currentWeekEndDate) {
            _bookingArrayForCurrentWeek = _j + 1
            _j++
          }
        }
        var _k = 0
        for (var j = 0; j < lifetimeSlotBooking.length; j++) {
          if (moment(lifetimeSlotBooking[j].createdAt).format('YYYY-MM-DD') >= lastWeekStartDate && moment(lifetimeSlotBooking[j].createdAt).format('YYYY-MM-DD') <= lastWeekEndDate) {
            _bookingArrayForLastWeek = _k + 1
            _k++
          }
        }
        for (var j = 0; j < lifetimeSlotBooking.length; j++) {
          _lifetimeSlotBookingForEachSign = j + 1
        }
        bookingArrayForCurrentWeek.push(_bookingArrayForCurrentWeek)
        bookingArrayForLastWeek.push(_bookingArrayForLastWeek)
        lifetimeSlotBookingForEachSign.push(_lifetimeSlotBookingForEachSign)
      }
      totalBookingsForLastWeek += bookingsForLastWeek.length
      totalBookingsForCurrentWeek += bookingsForCurrentWeek.length
      totalLifetimeSlotBooking += lifetimeSlotBooking.length

    }
    _limit = skip + limit
    var __signs = _signs.slice(skip, _limit)
    var __totalRevenueOfEachSign = totalRevenueOfEachSign.slice(skip, _limit)
    var __currentWeekRevenueOfEachSign = currentWeekRevenueOfEachSign.slice(skip, _limit)
    var __lastWeekRevenueOfEachSign = lastWeekRevenueOfEachSign.slice(skip, _limit)
    var __bookingArrayForCurrentWeek = bookingArrayForCurrentWeek.slice(skip, _limit)
    var __bookingArrayForLastWeek = bookingArrayForLastWeek.slice(skip, _limit)
    var __lifetimeSlotBookingForEachSign = lifetimeSlotBookingForEachSign.slice(skip, _limit)
    var data = {
      signs: __signs,
      totalRevenue: totalRevenue,
      currentWeekRevenue: currentWeekRevenue,
      lastWeekRevenue: lastWeekRevenue,
      totalRevenueOfEachSign: __totalRevenueOfEachSign,
      currentWeekRevenueOfEachSign: __currentWeekRevenueOfEachSign,
      lastWeekRevenueOfEachSign: __lastWeekRevenueOfEachSign,
      bookingArrayForCurrentWeek: __bookingArrayForCurrentWeek,
      bookingArrayForLastWeek: __bookingArrayForLastWeek,
      totalBookingsForCurrentWeek: totalBookingsForCurrentWeek,
      totalBookingsForLastWeek: totalBookingsForLastWeek,
      lifetimeSlotBookingForEachSign: __lifetimeSlotBookingForEachSign,
      totalLifetimeSlotBooking: totalLifetimeSlotBooking
    }
    return resolve(data)
  });
  return promise;
});

this.paginationForPaymentCount = async (function (params, networkOwnerId) {
  var promise;
  promise = new Promise(function (resolve, reject) {
    var paymentFilter, filter, limit, searchText, skip;
    skip = params.skip;
    limit = params.limit;
    searchText = params.searchText;
    filter = [];
    paymentFilter = {
      networkOwnerId: networkOwnerId
    };
    var _signs = []
    var _searchText = searchText.toLowerCase()
    var signs = await (signServ.find(paymentFilter))
    for (var i = 0; i < signs.length; i++) {
      var sign = signs[i]
      if (sign.name && sign.name.toLowerCase().indexOf(_searchText) >= 0) {
        _signs.push(sign)
      }
    }
    resolve(_signs.length)
  });
  return promise;
});


this.paginationForPaymentDetails = async (function (params, advertiser) {
  var promise;
  promise = new Promise(function (resolve, reject) {
    var paymentFilter, filter, limit, searchText, skip;
    skip = params.skip;
    limit = params.limit;
    var _limit = skip + limit
    searchText = params.searchText;
    var dateFilter = params.dateFilter
    var transactionFilter = params.transactionFilter
    var sortAmountByOrder = params.isSortAmount
    var condtionQuery = []
    if (params.transactionFilter === 'successful') {
      var transactionFilter = "approved"
      condtionQuery.push({
        status: "approved"
      })
    } else if (params.transactionFilter === 'pending') {
      var transactionFilter = 'created'
      condtionQuery.push({
        status: "created"
      })
    } else if (params.transactionFilter === 'failed') {
      var transactionFilter = 'error'
      condtionQuery.push({
        status: "error"
      })
    }
    paymentFilter = {
      advertiser: advertiser
    };
    if (!sortAmountByOrder || sortAmountByOrder === '') {
      var _sort = {
        createdAt: -1
      }
    } else if (!sortAmountByOrder || sortAmountByOrder === '') {
      var _sort = {
        amount: 1
      }
    } else {
      var _sort = {
        amount: -1
      }

    }
    if (dateFilter !== "all") {
      var currentDate = moment().format('YYYY-MM-DD')
      var filterDate = moment().subtract(dateFilter, "days").format('YYYY-MM-DD')
      if (condtionQuery.length === 0) {
        condtionQuery.push({
          "updatedAt": {
            $gte: filterDate
          }
        })
      } else {
        condtionQuery = []
        condtionQuery.push({
          $and: [{
            status: transactionFilter
          }, {
            "updatedAt": {
              $gte: filterDate
            }
          }]
        })
      }
    }
    var paymentMap = {}
    var _payments = []
    var _amount = []
    var campaignIds = await (Payment.find({
      advertiser: mongoose.Types.ObjectId(advertiser)
    }, {
      campaign: 1
    }).lean())
    var campaigns = []
    for (let i = 0; i < campaignIds.length; i++) {
      campaigns.push(campaignIds[i].campaign.toString())
    }
    if (searchText && searchText.length > 0) {
      var _searchWord = ""
      for (let k = 0; k < searchText.length; k++) {
        let searchWord = searchText[k]
        searchWord = searchWord.replace("\\", "\\\\")
        searchWord = searchWord.replace("*", "\\*")
        searchWord = searchWord.replace("(", "\\(")
        searchWord = searchWord.replace(")", "\\)")
        searchWord = searchWord.replace("+", "\\+")
        searchWord = searchWord.replace("[", "\\[")
        searchWord = searchWord.replace("|", "\\|")
        searchWord = searchWord.replace(",", "\\,")
        searchWord = searchWord.replace(".", "\\.")
        searchWord = searchWord.replace("?", "\\?")
        searchWord = searchWord.replace("^", "\\^")
        searchWord = searchWord.replace("$", "\\$")
        _searchWord = _searchWord.toString() + searchWord.toString()
      }
      var campaignData = await (CampaignServ.getCamapaignNameForPaymentHistory(campaigns, advertiser, _searchWord))
      var campaignIds = []
      for (let j = 0; j < campaignData.length; j++) {
        campaignIds.push(mongoose.Types.ObjectId(campaignData[j]._id))
      }
      if (condtionQuery.length > 0) {
        var orCondition = {
          "$or": condtionQuery
        }
        var payments = await (Payment.find({
          $and: [{
            $or: condtionQuery
          }, {
            campaign: {
              $in: campaignIds
            }
          }]
        }).sort(_sort).limit(_limit).lean())
        var paymentCount = await (Payment.find({
          $and: [{
            $or: condtionQuery
          }, {
            campaign: {
              $in: campaignIds
            }
          }]
        }).count())
      } else {
        var payments = await (Payment.find({
          campaign: {
            $in: campaignIds
          }
        }).sort(_sort).limit(_limit).lean().lean())
        var paymentCount = await (Payment.find({
          campaign: {
            $in: campaignIds
          }
        }).count())
      }
    } else {
      var campaignData = await (CampaignServ.getCamapaignNameForPaymentHistory(campaigns, advertiser))
      var campaignIds = []
      for (let j = 0; j < campaignData.length; j++) {
        campaignIds.push(mongoose.Types.ObjectId(campaignData[j]._id))
      }
      if (condtionQuery.length > 0) {
        var orCondition = {
          "$or": condtionQuery
        }
        var payments = await (Payment.find({
          $and: [{
            $or: condtionQuery
          }, {
            campaign: {
              $in: campaignIds
            }
          }]
        }).sort(_sort).limit(_limit).lean())
        var paymentCount = await (Payment.find({
          $and: [{
            $or: condtionQuery
          }, {
            campaign: {
              $in: campaignIds
            }
          }]
        }).count())
      } else {
        var payments = await (Payment.find({
          campaign: {
            $in: campaignIds
          }
        }).sort(_sort).limit(_limit).lean())
        var paymentCount = await (Payment.find({
          campaign: {
            $in: campaignIds
          }
        }).count())
      }
    }
    for (var i = 0; i < payments.length; i++) {
      for (let k = 0; k < campaignData.length; k++) {
        if (payments[i].campaign.toString() === campaignData[k]._id.toString()) {
          payments[i].campaign = campaignData[k]
          break
        }
      }
      var payment = payments[i]
      payment.amount = Math.round(payment.amount * 100) / 100
      _payments.push(payment)
      _amount.push(payment.paidAmount)
    }
    _limit = skip + limit
    var __payments = _payments.slice(skip, _limit)
    var __amount = _amount.slice(skip, _limit)
    var data = {
      totalAmount: __amount,
      totalPayments: __payments,
      count: paymentCount
    }
    resolve(data)
  });
  return promise;
});

this.findOne = function (query) {
  return Payment
    .findOne(query).populate({
      path: 'campaign',
      populate: {
        path: 'signs'
      }
    });
};

this.getGroupRevenue = async (function (id, _childIds) {
  try {
    var query = {
      _id: id
    }
    var group = await (GroupSer.findOne(query))
    var childIds = []
    if (group.childs.length > 0) {
      if (_childIds) {
        for (let i = 0; i < _childIds.length; i++) {
          childIds.push(mongoose.Types.ObjectId(_childIds[i]))
        }
      } else {
        for (let i = 0; i < group.childs.length; i++) {
          childIds.push(mongoose.Types.ObjectId(group.childs[i]._id))
        }
      }
      var groupId = mongoose.Types.ObjectId(id)
      var payments = await (PaymentSchema.find({
        $and: [{
          signId: {
            $in: childIds
          }
        }, {
          _group: groupId
        }]
      }).lean())
      var signMap = {}
      var eachSignAmount = []
      var totalAmount = 0;

      for (let j = 0; j < payments.length; j++) {
        totalAmount = totalAmount + payments[j].amountPaid
        if (!signMap[payments[j].signId]) {
          signMap[payments[j].signId] = payments[j].signId

        }
        eachSignAmount.push({
          amount: payments[j].amountPaid,
          sign: payments[j].signId,
          signRevenue: payments[j].amountRecived
        })
      }
      var data = {}
      data.eachSignAmount = eachSignAmount
      data.totalAmount = (totalAmount * 3 / 100)
    } else {
      var data = {}
      data.eachSignAmount = []
      data.totalAmount = 0
    }
    return (data)
  } catch (e) {
    return e
  }

})

this.getDetailOfNetwork = async (params, networkOwnerId) => {
  var paymentFilter, filter, limit, searchText, skip;
  skip = params.skip;
  limit = params.limit;
  searchText = params.searchText;
  filter = params.filter;
  var distinctQuery = {
    networkOwnerId: networkOwnerId,
    signType: "SIGN"
  }
  if (filter !== "all") {
    var currentDate = moment().format('YYYY-MM-DD')
    var filterDate = moment().subtract(filter, "days")
  }
  try {
    var count = 0;
    var distinctDate = [];
    if (filter === 'all') {
      distinctQuery = {
        networkOwnerId: networkOwnerId,
        signType: "SIGN"
      }
      if (searchText === '') {
        distinctDate = await (PaymentSchema.distinct('signId', distinctQuery));
      } else {
        var regex = new RegExp(searchText, 'i');
        var searchQuery = {
          signName: regex
        };
        distinctQuery.signName = regex;
        distinctDate = await (PaymentSchema.distinct('signId', distinctQuery));
      }

    } else {
      if (searchText === '') {
        distinctQuery = {
          networkOwnerId: networkOwnerId,
          signType: "SIGN"
        }
        distinctQuery._createdAt = {
          $gte: filterDate
        }
        distinctDate = await (PaymentSchema.distinct('signId', distinctQuery));
      } else {
        distinctQuery = {
          networkOwnerId: networkOwnerId,
          signType: "SIGN"
        }
        distinctQuery._createdAt = {
          $gte: filterDate
        }
        var regex = new RegExp(searchText, 'i');
        distinctQuery.signName = regex;
        distinctDate = await (PaymentSchema.distinct('signId', distinctQuery));
      }

      //var distinctQuery2 = {_createdAt:{$gte: filterDate}}
      // distinctDate = await (PaymentSchema.distinct('signId', distinctQuery));
    }

    count = distinctDate.length;
    if (count <= 0) {
      var resultJson = {};
      resultJson.count = 0
      return resultJson
    }
    var signIdArray = [];
    var start;
    var end;
    if (skip === null || !skip) {
      skip = 0;
    }
    if (limit === null || !limit) {
      limit = 5
    }
    if (count > skip) {
      start = skip;
      end = skip + limit
    } else if (count === skip) {
      return
    }
    for (var distinctDateCount = start; distinctDateCount < end; distinctDateCount++) {
      signIdArray.push(mongoose.Types.ObjectId(distinctDate[distinctDateCount]))
    }
    var wholeSignDetailsQuery = {
      $and: [{
        'signId': {
          $in: signIdArray
        }
      }, {
        networkOwnerId: networkOwnerId
      }]
    }
    var wholeData = await (PaymentSchema.find(wholeSignDetailsQuery).lean().sort({
      signId: 1
    }))
    var currentWeekStartDate = moment().isoWeekday(1).startOf('week')
    var currentWeekEndDate = moment().isoWeekday(1).endOf('week')
    var lastWeekStartDate = moment().isoWeekday(-1).startOf('week')
    var lastWeekEndDate = moment().isoWeekday(-1).endOf('week')
    var result = [];
    var resultObl = {}
    var mapResult = {};
    for (let index = 0; index < wholeData.length; index++) {
      for (let signLength = 0; signLength < signIdArray.length; signLength++) {
        if (signIdArray[signLength].toString() === wholeData[index].signId.toString()) {
          if (!mapResult[signIdArray[signLength]]) {
            resultObl = {}
            var maplength = Object.keys(mapResult).length;
            mapResult[signIdArray[signLength]] = maplength + 1;
            resultObl.name = wholeData[index].signName
            resultObl.totalSlot = wholeData[index].totalSlot;
            resultObl.signId = signIdArray[signLength]
            resultObl.amountRecived = wholeData[index].amountRecived;
            resultObl.preBook = 0
            resultObl.slotBooked = 1;
            resultObl.preAmountRecived = 0
            resultObl.currBook = 0;
            resultObl.currAmountRecived = 0;
            if (wholeData[index]._createdAt >= lastWeekStartDate && wholeData[index]._createdAt <= lastWeekEndDate) {
              resultObl.preBook = 1;
              resultObl.preAmountRecived = wholeData[index].amountRecived;
            } else if (wholeData[index]._createdAt >= currentWeekStartDate && wholeData[index]._createdAt <= currentWeekEndDate) {
              resultObl.currBook = 1;
              resultObl.currAmountRecived = wholeData[index].amountRecived;
            }
            var _resultObl = JSON.stringify(resultObl)
            resultObl = JSON.parse(_resultObl)
            result.push(resultObl)
          } else {
            resultObl.name = wholeData[index].signName
            resultObl.totalSlot = wholeData[index].totalSlot;
            result[mapResult[signIdArray[signLength]] - 1].slotBooked = result[mapResult[signIdArray[signLength]] - 1].slotBooked + 1;
            result[mapResult[signIdArray[signLength]] - 1].amountRecived = result[mapResult[signIdArray[signLength]] - 1].amountRecived + wholeData[index].amountRecived;
            if (wholeData[index]._createdAt >= lastWeekStartDate && wholeData[index]._createdAt <= lastWeekEndDate) {
              result[mapResult[signIdArray[signLength]] - 1].preBook++;
              result[mapResult[signIdArray[signLength]] - 1].preAmountRecived = result[mapResult[signIdArray[signLength]] - 1].preAmountRecived + wholeData[index].amountRecived;
            } else if (wholeData[index]._createdAt >= currentWeekStartDate && wholeData[index]._createdAt <= currentWeekEndDate) {
              result[mapResult[signIdArray[signLength]] - 1].currBook++;
              result[mapResult[signIdArray[signLength]] - 1].currAmountRecived = result[mapResult[signIdArray[signLength]] - 1].currAmountRecived + wholeData[index].amountRecived;
            }
          }
        }

      }
    }
    var resultJson = {};
    resultJson.count = count;
    resultJson.signs = result;
  } catch (err) {
    return err
  }
  return resultJson
};

this.getNetworkAll = async (params, networkOwnerId) => {
  var paymentFilter, filter, limit, searchText, skip;
  skip = params.skip;
  limit = params.limit;
  searchText = params.searchText;
  filter = params.filter;
  if (filter !== "all") {
    var currentDate = moment().format('YYYY-MM-DD')
    var filterDate = moment().subtract(filter, "days")
    filterDate = filterDate.toISOString();
  }
  var currentWeekStartDate = moment().isoWeekday(1).startOf('week')
  var currentWeekEndDate = moment().isoWeekday(1).endOf('week')
  var lastWeekStartDate = moment().isoWeekday(-1).startOf('week')
  var lastWeekEndDate = moment().isoWeekday(-1).endOf('week')
  lastWeekStartDate = lastWeekStartDate.toISOString();
  var query = {}

  try {
    if (filter === 'all') {
      var groupQuery = [{
        $match: {
          networkOwnerId: networkOwnerId,
          signType: "SIGN"
        }
      }, {
        $group: {
          _id: {
            networkOwnerId: "$networkOwnerId"
          },
          totalAmount: {
            $sum: "$amountRecived"
          },
          count: {
            $sum: 1
          }
        }
      }]
    } else {
      var groupQuery = [{
          $match: {
            $and: [{
              _createdAt: {
                $gte: new Date(filterDate)
              }
            }, {
              networkOwnerId: networkOwnerId
            }, {
              signType: "SIGN"
            }]
          }
        },
        {
          $group: {
            _id: {
              networkOwnerId: "$networkOwnerId"
            },
            totalAmount: {
              $sum: "$amountRecived"
            },
            count: {
              $sum: 1
            }
          }
        }
      ]
    }
    var groupData = await (PaymentSchema.aggregate(groupQuery));
    var dataPreviousWeekQuery = {
      $and: [{
        _createdAt: {
          $gte: lastWeekStartDate
        }
      }, {
        networkOwnerId: networkOwnerId
      }]
    }
    var dataPreviousWeek = await (PaymentSchema.find(dataPreviousWeekQuery).lean());
    var previousWeek = []
    var thisWeekData = []
    if (groupData.length <= 0) {
      return
    }
    groupData[0].preAmountRecived = 0
    groupData[0].currAmountRecived = 0
    groupData[0].preBook = 0
    groupData[0].currBook = 0
    for (let index = 0; index < dataPreviousWeek.length; index++) {
      if (dataPreviousWeek[index]._createdAt <= lastWeekEndDate) {
        groupData[0].preBook++
        groupData[0].preAmountRecived = groupData[0].preAmountRecived + dataPreviousWeek[index].amountRecived
      } else if (dataPreviousWeek[index]._createdAt >= currentWeekStartDate && dataPreviousWeek[index]._createdAt <= currentWeekEndDate) {
        groupData[0].currBook++
        groupData[0].currAmountRecived = groupData[0].currAmountRecived + dataPreviousWeek[index].amountRecived
      }
    }
    var _groupData = JSON.stringify(groupData)
    var groupData = JSON.parse(_groupData)

    return groupData
  } catch (err) {
    return err
  }
};

this.test = async (function () {
  var condtionQuery = []
  var filterDate = moment().subtract(30, "days").format('YYYY-MM-DD')
  condtionQuery.push({
    $and: [{
        status: "error"
      },
      {
        $cond: [{
          "successResponse.payment": {
            $exists: true
          }
        }, {
          "successResponse.payment.0.create_time": {
            $gte: filterDate
          }
        }, {
          "createdAt": {
            $gte: filterDate
          }
        }]
      },
      // {
      //   $or:[
      //     {
      //       "createdAt":{$gte:filterDate}
      //     }, {
      //       "successResponse.payment.0.create_time":{$gte:filterDate}
      //     }
      //   ]
      // } 
    ]
  })

  try {

    var payment = await (Payment.aggregate([{
      $match: condtionQuery[0]
    }]))
  } catch (err) {
    console.log(err)
  }
})

this.findForPaymenyStatus = async (query) => {
  if (query == null) {
    query = {};
  }
  return await (Payment
    .findOne(query));
};
// { periodCriteria: '{"lastDay":"Mon Aug 19 2019 16:46:17 GMT+0530 (India Standard Time)","criteria":"This week","startDay":"Mon Aug 12 2019 00:00:00 GMT+0530 (India Standard Time)"}' }
//  5d2da085b2c9c350de748e79
// this.test()

this.graphData = async (advertiserId, query) => {
  // let advertiserId = "5d2da085b2c9c350de748e79"
  // let query =  {"lastDay":"Mon Aug 19 2019 16:46:17 GMT+0530 (India Standard Time)","criteria":"This week","startDay":"Mon Aug 12 2019 00:00:00 GMT+0530 (India Standard Time)"}
};

this.networkOwnerPaymentSummary = async (query,user ) => {
  try {
    let conditionsData = query
    let fromDate = new Date(conditionsData.revenueGeneratedPeriod.from)
    let summary = await (PaymentSummaryService.networkOwnerPaymentSummary(fromDate, user))
    let params = {
      skip: 0,
      limit: 20,
      searchText: '',
      filter: 'all',
      previousSearchTest: '',
      previousFilter: 'all',
      previousCount: 0
    }
    let result = {}
    result['summary'] = summary
    let counts = await(this.getDetailOfNetwork(params, user))
    let response = {};
    response.count = counts.count;
    if (response.count <=0) {
      return res.send(response)
    } 
    response.signs = counts.signs;
    result["data"] = response
    return result
  } catch (err) {
    return err
  }

}

this.networkOwnerGeneratedRevenue = async (query,user ) => {
  try {
    let revenue = await (PaymentSummaryService.networkOwnerGeneratedRevenue(query, user))
    return revenue
  } catch(err) {
    return err
  }
}

this.networkOwnerCampaignCount = async (query,user ) => {
  try {
    let campaignCount = await (PaymentSummaryService.networkOwnerCampaignCount(query, user))
    return campaignCount
  } catch(err) {
    return err
  }
}

this.networkOwnerBookedSlot = async (query,user ) => {
  try {
    let bookingCount = await (PaymentSummaryService.networkOwnerBookedSlot(query, user))
    return bookingCount
  } catch(err) {
    return err
  }
}


module.exports = this;
