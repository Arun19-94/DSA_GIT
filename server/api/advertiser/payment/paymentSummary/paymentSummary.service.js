var PaymentSchema = require('./paymentSummary.schema');

var signServ = require('../../../networkOwner/sign/sign.service')

var campService = require('../../campaign/campaign.service')

// var async = require('asyncawait/async');

// var await = require('asyncawait/await');

var moment = require('moment')

var mongoose = require('mongoose');

var CoupenServ = require('../coupen/coupen.service');

this.create = async (campaign, user) => {
	// var campaignData = await(campService.campaignForPayment(campaign._id))
	let coupen = null
	if (campaign.coupen) {
		let _coupen = await (CoupenServ.find({
			_id: campaign.coupen
		}))
		coupen = _coupen[0]
	}
	var campaign = await (campService.campaignForPayment(campaign._id))
	try {
		if (campaign.signs) {
			var totalAmount = campaign.budget.price;
			var _paymentSummary = [];
			var sign = {}
			var insertPayment = {}
			var paymentStatusMap = {}
			for (let index = 0; index < campaign.signs.length; index++) {
				sign = campaign.signs[index];
				insertPayment = {};
				insertPayment.advertiserId = campaign.advertiserId;
				insertPayment.campaignName = campaign.name;
				insertPayment.campaignId = campaign._id
				insertPayment.campaignStartDate = campaign.budget.from
				insertPayment.campaignEndDate = campaign.budget.to
				insertPayment._createdAt = new Date();
				if (campaign.budget.periodInDays) {
					var datedifference = campaign.budget.periodInDays
				} else {
					var startDate = moment(campaign.budget.from, "YYYY-MM-DD");
					var endDate = moment(campaign.budget.to, "YYYY-MM-DD");
					var datedifference = Math.ceil(moment.duration(endDate.diff(startDate)).asDays()) + 1
				}
				if (sign.signType === 'GROUP') {
					insertPayment.signId = mongoose.Types.ObjectId(sign._id);
					insertPayment.signType = sign.signType;
					insertPayment.signName = sign.name;
					insertPayment.networkOwnerId = sign.networkOwnerId;
					var discountValue = 0;
					if (sign.discountValue) {
						discountValue = sign.discountValue
					} else {
						discountValue = 0
					}
					var pricePerSlotChild = 0;
					var paidAmountSum = 0
					var childInsert = {};
					var signChild = {};
					for (var childlength = 0; childlength < sign.childsDetails.length; childlength++) {
						signChild = sign.childsDetails[childlength];
						childInsert = {};
						childInsert.signId = mongoose.Types.ObjectId(signChild._id)
						childInsert._group = mongoose.Types.ObjectId(sign._id)
						childInsert.signType = signChild.signType;
						childInsert.signName = signChild.name;
						childInsert.networkOwnerId = signChild.networkOwnerId;
						childInsert.advertiserId = campaign.advertiserId;
						childInsert.campaignName = campaign.name;
						childInsert.campaignId = campaign._id
						childInsert.campaignStartDate = campaign.budget.from
						childInsert.campaignEndDate = campaign.budget.to
						childInsert.totalSlot = signChild.availableSlots;
						childInsert._createdAt = new Date();
						if (insertPayment.networkOwnerId.toString() !== user.networkOwnerId.toString()) {
							var pricePerDay = (signChild.pricePerSlot) / 7;
							var actualAmount = 0
							actualAmount = datedifference * pricePerDay
							childInsert.amountPaid = ((actualAmount * ((100 - discountValue) / 100)).toFixed(2) * 1);
							let paid = childInsert.amountPaid
							insertPayment.groupType = "NOENTRY"
							if (coupen) {
								let discountAmount = 0
								if (coupen.valueType === 'FLAT-DISCOUNT') {
									if (totalAmount > 0) {
										let _totalAmount = totalAmount + coupen.value
										discountAmount = (paid / _totalAmount) * coupen.value
										childInsert.amountRecived = (((paid - discountAmount) * (7 / 10)).toFixed(2) * 1)
										childInsert.DSARevenue = (((paid - discountAmount) * (3 / 10)).toFixed(2) * 1)
									} else {
										paid = 0
										childInsert.amountRecived = 0
										childInsert.DSARevenue = 0
									}
								} else {
									paid = (paid * (100 - coupen.value)) / 100
									childInsert.amountRecived = (((paid) * (7 / 10)).toFixed(2) * 1)
									childInsert.DSARevenue = (((paid) * (3 / 10)).toFixed(2) * 1)
								}
							} else {
								childInsert.amountRecived = ((childInsert.amountPaid * (7 / 10)).toFixed(2) * 1)
								childInsert.DSARevenue = ((childInsert.amountPaid * (3 / 10)).toFixed(2) * 1)
							}
							// if (sign.groupType === 'PRIVATE') {
							// 	insertPayment.groupType = 'PRIVATE'
							// 	var pricePerDay = (signChild.pricePerSlot)/7;
							// 	var actualAmount = 0
							// 	actualAmount = (datedifference * pricePerDay)
							// 	childInsert.amountPaid = actualAmount.toFixed(2) * 1;
							// 	childInsert.DSARevenue =  actualAmount * (0.27)
							// 	childInsert.amountRecived =  ((childInsert.amountPaid * (7/10)).toFixed(2) * 1)//70% -sign owner
							// } else {
							// 	var pricePerDay = (signChild.pricePerSlot)/7;
							// 	var actualAmount = 0
							// 	actualAmount = datedifference * pricePerDay
							// 	childInsert.amountPaid = ((actualAmount * ((100 - discountValue)/100)).toFixed(2) * 1);
							// 	childInsert.DSARevenue = actualAmount * ((37-discountValue) / 100).toFixed(2);

							// 	childInsert.amountRecived = ((actualAmount* (6/10)).toFixed(2) *1)

							// }
						} else {
							var pricePerDay = 0;
							var actualAmount = 0
							actualAmount = 0
							insertPayment.groupType = "NOENTRY"
							childInsert.amountPaid = 0;
							childInsert.DSARevenue = 0;
							childInsert.amountRecived = 0;
						}
						pricePerSlotChild = pricePerSlotChild + (childInsert.amountPaid * 1);
						paidAmountSum = (paidAmountSum * 1) + (actualAmount * 1)
						_paymentSummary.push(childInsert);
					}
					insertPayment.amountPaid = pricePerSlotChild;
					insertPayment.amountRecived = paidAmountSum * (3 / 100);
				} else {
					insertPayment.signId = mongoose.Types.ObjectId(sign._id);
					insertPayment.signType = sign.signType;
					insertPayment.signName = sign.name;
					insertPayment.totalSlot = sign.availableSlots;
					insertPayment.networkOwnerId = sign.networkOwnerId;
					var pricePerDay = (sign.pricePerSlot) / 7;
					let paid = datedifference * pricePerDay
					if (insertPayment.networkOwnerId.toString() !== user.networkOwnerId.toString()) {
						insertPayment.amountPaid = ((datedifference * pricePerDay).toFixed(2) * 1);
						if (coupen) {
							let discountAmount = 0
							if (coupen.valueType === 'FLAT-DISCOUNT') {
								if (totalAmount > 0) {
									let _totalAmount = totalAmount + coupen.value
									discountAmount = (paid / _totalAmount) * coupen.value
									insertPayment.amountRecived = (((paid - discountAmount) * (7 / 10)).toFixed(2) * 1)
									insertPayment.DSARevenue = (((paid - discountAmount) * (3 / 10)).toFixed(2) * 1)
								} else {
									insertPayment.amountRecived = 0
									insertPayment.DSARevenue = 0
								}
							} else {
								paid = (paid * (100 - coupen.value)) / 100
								insertPayment.amountRecived = (((paid) * (7 / 10)).toFixed(2) * 1)
								insertPayment.DSARevenue = (((paid) * (3 / 10)).toFixed(2) * 1)
							}
						} else {
							insertPayment.amountRecived = ((datedifference * pricePerDay).toFixed(2) * 0.7);
							insertPayment.DSARevenue = insertPayment.amountPaid * (0.3)
						}
						// insertPayment.amountPaid =(( datedifference * pricePerDay).toFixed(2)*1);
						// insertPayment.DSARevenue = insertPayment.amountPaid * (0.3)

						// insertPayment.amountRecived =  (insertPayment.amountPaid * (7/10)).toFixed(2) * 1

					} else {
						var pricePerDay = 0;
						insertPayment.amountPaid = 0;
						insertPayment.DSARevenue = 0;
						insertPayment.amountRecived = 0;
					}
				}
				if (!insertPayment.groupType) {
					_paymentSummary.push(insertPayment);
				}
			}
			try {
				await (PaymentSchema.insertMany(_paymentSummary))
			} catch (err) {
				console.log(err)
				return err
			}
		} else {
			return
		}
	} catch (err) {
		console.log(err)
		return err
	}
};

this.findNetworkOwnerId = async (networkOwnerId) => {
	try {
		var paymentData = await (PaymentSchema.find({
			networkOwnerId: networkOwnerId
		}))
		return paymentData
	} catch (e) {
		return e
	}
}
this.UpdateSignId = async () => {
	try {
		var payments = await (PaymentSchema.find())
		for (let i = 0; i < payments.length; i++) {
			let signId = mongoose.Types.ObjectId(payments[i].signId)
			await (PaymentSchema.update({
				_id: payments[i]._id
			}, {
				$set: {
					"signId": signId
				}
			}))
		}
	} catch (err) {
		return err
	}
	return
}

this.findQuery = async (Query) => {
	try {
		var paymentData = await (PaymentSchema.find(Query))
		return paymentData
	} catch (e) {
		return e
	}
}

this.findOldAdvertiser = async (networkOwner, advertiserId) => {
	var _networkOwner = networkOwner.toString()
	try {
		// var _oldAdvertiser = await(PaymentSchema.find({ networkOwnerId: _networkOwner}))
		var _oldAdvertiser = await (PaymentSchema.aggregate(
			[{
					$match: {
						networkOwnerId: _networkOwner
					}
				},
				{
					$group: {
						_id: '$advertiserId'
					}
				}
			]
		))
		var oldAdvertiser = []
		for (let i = 0; i < _oldAdvertiser.length; i++) {
			if (_oldAdvertiser[i]._id.toString() !== advertiserId.toString()) {
				oldAdvertiser.push(_oldAdvertiser[i]._id)
			}
		}
		return oldAdvertiser
	} catch (e) {
		return e
	}
}

this.findRevenue = async query => {
	try {
		return await (PaymentSchema.aggregate([{
			$match: query
		}, {
			$group: {
				_id: null,
				sum: {
					$sum: "$amountRecived"
				}
			}
		}]));
	} catch (err) {
		return err
	}
}

this.graphData = async () => {
	try {
		let advertiserId = "5d2da085b2c9c350de748e79"
		let query = {
			"lastDay": "Mon Aug 19 2019 16:46:17 GMT+0530 (India Standard Time)",
			"criteria": "This week",
			"startDay": "2019-08-12"
		}
		let criteria = query.criteria
		// let count = ((a < b) ? 'minor' : 'major');
		let count = ((criteria === 'This week') ? 7 : ((criteria === 'This month') ? 10 : ((criteria === 'This year') ? 12 : "all")));
		let startDay = query.startDay
		let _query = {
			_createdAt: {
				"$gte": new Date(startDay)
			}
		}
		let graph = await (this.graphWeek(advertiserId, startDay))
	} catch (err) {
		return err
	}
}

this.graphWeek = async (advertiserId, startDay) => {
	let _query = {
		_createdAt: {
			"$gte": new Date(startDay)
		},
		advertiserId: advertiserId
	}
	let graph = await (PaymentSchema.aggregate(
		[{
			$match: _query
		}, {
			$project: {
				_id: 0,
				amountPaid: "$amountPaid",
				amountRecived: "$amountRecived",
				DSARevenue: "$DSARevenue",
				_createdAt: "$_createdAt",
				weekNumber: {
					$isoWeek: "$_createdAt"
				}
			}
		}, {
			$group: {
				_id: "$weekNumber",
				amountPaid: {
					$sum: "$amountPaid"
				},
				amountRecived: {
					$sum: "$amountRecived"
				},
				DSARevenue: {
					$sum: "$DSARevenue"
				},
				totalNumber: {
					$sum: 1
				}
			}
		}]
	))
	return graph
}

this.networkOwnerPaymentSummary = async (conditions, networkOwnerId) => {
	let query = {
		_createdAt: {
			$gte: conditions
		},
		networkOwnerId: networkOwnerId
	}
	let networkOwnerPaymentSummary = await (PaymentSchema.aggregate(
		[{
				$match: query
			},
			{
				$group: {
					_id: null,
					campaign: {
						$addToSet: "$campaignId"
					},
					bookings: {
						$sum: 1
					},
					amountRecived: {
						$sum: "$amountRecived"
					}
				},
			},
			{
				$project: {
					"bookings": 1,
					"amountRecived": 1,
					campaign: {
						$size: "$campaign"
					}
				}
			}
		]
	))
	if (networkOwnerPaymentSummary.length === 0) {
		networkOwnerPaymentSummary[0] = {}
		networkOwnerPaymentSummary[0]["bookings"] = 0
		networkOwnerPaymentSummary[0]["amountRecived"] = 0
		networkOwnerPaymentSummary[0]["campaign"] = 0
	}
	return networkOwnerPaymentSummary[0]
}

this.networkOwnerGeneratedRevenue = async (date, networkOwnerId) => {
	try {
		let isWhole = false
		let data;
		let fromDate;
		if (date.from)  {
			if (date.from !== 'ALL' ) {
				isWhole = true
				fromDate = new Date(date.from)
			} 
		} else {
			isWhole = false
		}
		if (!isWhole) {
			data = await(
				PaymentSchema.aggregate(
					[
						{$match:{
							networkOwnerId: networkOwnerId
							}
						},
						{
							$group: {
								_id: null,
								revenueGenerated: {
									$sum: "$amountRecived"
								}
							}
						}
					]
				)
			)
		} else {
			data = await(
				PaymentSchema.aggregate(
					[	
						{$match:{
							networkOwnerId: networkOwnerId,
							_createdAt: {
								$gte: fromDate
							}
	
							}
						},
						{
							$group: {
								_id: null,
								revenueGenerated: {
									$sum: "$amountRecived"
								}
							}
						}
					]
				)
			)
		}
		return ({"revenueGenerated": data[0].revenueGenerated})
	} catch (err) {
		return err
	}
}

this.networkOwnerCampaignCount = async (date, networkOwnerId) => {
	try {
		let isWhole = false
		let data;
		let fromDate;
		if (date.from)  {
			if (date.from !== 'ALL' ) {
				isWhole = true
				fromDate = new Date(date.from)
			} 
		} else {
			isWhole = false
		}
		if (!isWhole) {
			data = await(
				PaymentSchema.aggregate(
					[
						{$match:{
							networkOwnerId: networkOwnerId
							}
						},
						{
							$group: {
								_id: "$campaignId",
							}
						}, {
								$count: "camapignCount"
						}
					]
				)
			)
		} else {
			data = await(
				PaymentSchema.aggregate(
					[	
						{$match:{
							networkOwnerId: networkOwnerId,
							_createdAt: {
								$gte: fromDate
							}
	
							}
						},
						{
							$group: {
								_id: "$campaignId",
							}
						}, {
								$count: "camapignCount"
						}
					]
				)
			)
		}
		return (data[0])
	} catch (err) {
		return err
	}
}

this.networkOwnerBookedSlot = async (date, networkOwnerId) => {
	try {
		let isWhole = false
		let data;
		let fromDate;
		if (date.from)  {
			if (date.from !== 'ALL' ) {
				isWhole = true
				fromDate = new Date(date.from)
			} 
		} else {
			isWhole = false
		}
		if (!isWhole) {
			data = await(PaymentSchema.find({ networkOwnerId: networkOwnerId, signType : "SIGN"}).count())
		} else {
			data = await( PaymentSchema.find({ 	networkOwnerId: networkOwnerId, _createdAt: { $gte: fromDate },signType : "SIGN" }).count())
		}
		return ({"bookings": data})
	} catch (err) {
		console.log(err)
		return err
	}
}

// this.networkOwnerBookedSlot( { from: '2019-08-18T18:30:00.000Z' }, "5d25d80b2132ec444174352c")
// this.networkOwnerBookedSlot( { from: 'ALL' }, "5d25d80b2132ec444174352c")


// week number
// day
// year
// month

// this.graphData()
module.exports = this;