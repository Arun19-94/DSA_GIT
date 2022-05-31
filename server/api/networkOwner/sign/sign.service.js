const Promise = require('bluebird');

const config = require('../../../config/config.js');

const Sign = require('./sign.schema');

var mongoose = require('mongoose');

var arraySort = require('array-sort');

var uniqid = require('uniqid');

var Booking = require('./booking/booking.schema')

var BookingServ = require("./booking/booking.service");

var moment = require('moment')

var Group = require('../group/group.schema')

var GroupSer = require("../group/group.service");

var CampaignServ = require("../../advertiser/campaign/campaign.service");

const s3Service = require('../../../components/aws/s3');

const Country = require('./country/country.schema')

const LocationServ = require('./location/location.service')

var NotificationServ = require('../../admin/notification/notification.service');

const NetworkOwnerMedia = require('../media/media.schema')

const QueueService = require('./publish/publish.queue.service')

const NetworkOwnerServ = require('../networkOwner.service')

const Counters = require('../serialNumber/serialnumber.schema')

const PaymentSummary = require('../../advertiser/payment/paymentSummary/paymentSummary.schema')

const NetworkOwnerNotificationService = require('../notification/notification.service')

var NotificationServ = require('../../admin/notification/notification.service');

var SocketServ = require('../../../components/socket/socketIO.service');

var OfflineService = require('./offline/offline.service');

var Random = require('randomstring')

var timeoutCallback = require('timeout-callback');

const s3 = s3Service.s3

var fs = require('fs');

var path = require('path');

var io = require('../../../components/socket/client.socketIO.service');

deviceIO = SocketServ.io.of('/android')
//Init devices Object
var devices = {}

deviceIO.on('connection', async (socket) => {
	var {
		mac,
		lanmac,
		displaywidth,
		displayheight,
		model,
		appversion,
		buildid,
		date,
		firmware,
		freespace,
		ip,
		manufacturer,
		maxvolume,
		offset,
		orientation,
		rooted,
		timezone,
		token,
		totalspace,
		usedspace,
		volume,
		host,
		connection,
		package,
		lastcheckintime
	} = socket.handshake.headers
	console.log(`${mac} Device connected!`)
	self.pushDevice(mac, socket)
	self.pushDevice(lanmac, socket)
	let hr = Math.abs(offset / 3600000) + '';
	hr = hr.indexOf('.') > -1 ? hr.split('.')[0] : hr
	hr = hr.length > 1 ? hr : `0${hr}`
	if (offset < 0) {
		hr = '-' + hr
	} else {
		hr = '+' + hr
	}
	let mn = Math.abs((offset / 60000) % 60) + ''
	mn = mn.length > 1 ? mn : `0${mn}`
	let _offset = hr + ':' + mn
	var query = {}
	if (mac && lanmac) {
		query.$or = [];
		var _macQuery = {
			mac: mac
		}
		var _lanMacQuery = {
			"info.lanmac": lanmac
		}
		query.$or.push(_macQuery)
		query.$or.push(_lanMacQuery)
	} else if (mac) {
		query = {
			mac: mac
		}
	} else {
		query = {
			"info.lanmac": lanmac
		}
	}
	var sign = await (Sign.findOne(query))
	var info = socket.handshake.headers
	delete(info.accept)
	delete(info['user-agent'])
	delete(info.connection)
	delete(info.encoding)
	delete(info['accept-encoding'])
	delete(info.token)
	if (sign) {
		var claimId = sign.claimId
		if (!sign.claimId || sign.claimId === null || sign.claimId === '') {
			claimId = await (self.generateClaimId())
		}
		sign.offset = _offset
		sign.timeZone = timezone
		self.updatePromise(sign._id, {
			claimId: claimId,
			info: info,
			offset: _offset,
			timeZone: timezone,
			lastCheckin: lastcheckintime
		})
		self.authDevice(mac, info.lanmac, claimId)
		self.emitEvent(mac, info.lanmac, "mock_device_initialise", {
			name: sign.name
		})
		OfflineService.handleOfflineAction(sign.info.mac, sign.info.lanmac);
	} else {
		if (mac) {
			var name = mac
		} else {
			var name = lanmac
		}
		name = name.replace(new RegExp(':', 'g'), ' ')
		var sign = {}
		sign.mac = mac
		sign.name = name
		var claimId = await (self.generateClaimId())
		sign.claimId = claimId
		sign.info = info
		sign.offset = _offset
		sign.timeZone = timezone
		sign.signType = 'SIGN'
		sign.orientation = 'Landscape'
		sign.screenType = 'Mobile'
		sign.dimension = 7
		sign.dimensionUnit = 'inches'
		sign.sizeUnit = 'feet'
		sign.location = 'Your location'
		sign.currency = 'USD'
		sign.pricePerSlot = 5
		sign.slotPeriod = 'perWeek'
		sign.holdTime = 10
		sign.holdTimeUnit = 'sec'
		sign.slots = 7
		sign.availableSlots = 7
		sign.viewers = []
		sign.viewers.push('Walking')
		sign.avgViewersCountWalking = 1
		sign.active = false
		sign.networkOwnerId = null
		sign.lastCheckin = lastcheckintime
		var fromDate = new Date();
		fromDate.setHours(09, 00, 00)
		var toDate = new Date();
		toDate.setHours(18, 00, 00)
		sign.operatingHours = {
			from: fromDate,
			to: toDate
		}
		sign.package = package
		try {
			var locationArray = []
			locationArray.push({
				text: 'App Location'
			})
			sign = await (self.create(sign, locationArray))
			self.authDevice(sign.mac, sign.info.lanmac, sign.claimId)
			OfflineService.handleOfflineAction(sign.info.mac, sign.info.lanmac);
			var queue = [{
				signId: sign._id.toString(),
				time: new Date()
			}]
			QueueService.insetMany(queue);
		} catch (e) {
			console.log(e)
		}
	}
	self.emitEvent(mac, info.lanmac, "test-emit-connection", {
		sign: sign
	})
	socket.on('disconnect', () => {
		let {
			mac,
			lanmac
		} = socket.handshake.headers
		delete devices[mac]
		delete devices[lanmac]
		console.log(`${mac} Device disconnected!`)
	});
	socket.on('LAST_CHECK_IN', (data) => {
		data = JSON.parse(data)
		Sign.findOne({
			claimId: data.claimId
		}).then(sign => {
			self.updatePromise(sign._id, {
				lastCheckin: data.lastCheckinTime
			})
		})
	});
});


this.pushDevice = (mac, socket) => {
	var oSocket = devices[mac]
	if (oSocket != null && oSocket != undefined) {
		oSocket.disconnect()
	}
	devices[mac] = socket
};

this.authDevice = (mac, lanmac, claimId) => {
	this.emitEvent(mac, lanmac, "AUTH", {
		claimId: claimId
	})
}

this.emitEvent = (mac, lanmac, e, params) => {
	var promise = new Promise(function (rs, rj) {
		if (mac) {
			var device = self.getDevice(mac, "MAC");
		}
		if (!device) {
			if (lanmac) {
				var device = self.getDevice(lanmac, "LAN_MAC");
			}
		}
		var deviceStatus = {}
		if (!device) {
			deviceStatus.code = 'OFFLINE'
			deviceStatus.status = 'Device is offline ' + mac
			return rj(deviceStatus);

		}
		device.emit(e, params, timeoutCallback(function (err, data) {
			if (err) {

				return rj(err);
			}
			if (data.status === "NOK") {
				return rj(data != null ? data.message : '');
			}
			return rs(data);
		}));
	});
	return promise;
}

this.generateClaimId = () => {
	var promise = new Promise(async (rs, rj) => {
		var claimid = Random.generate({
			length: 4
		})
		var now = Date.now()
		var hexString = now.toString(16)
		var hexString = hexString.substring(hexString.length - 2, hexString.length)
		claimid = claimid + hexString
		var query = {
			claimId: claimid
		}
		var sign = await (self.findOne(query))
		if (!sign) {
			return rs(claimid.toUpperCase())
		}
		var _claimId = await (self.generateClaimId())
		return rs(_claimId.toUpperCase())
	});
	return promise;
};

this.getDevice = (mac, deviceGetBy) => {
	if (deviceGetBy === "MAC") {
		self.updateLastUsed(mac, {
			lastUsedMacAddress: "MAC"
		}, "MAC")
	} else if (deviceGetBy === "LAN_MAC") {
		self.updateLastUsed(mac, {
			lastUsedMacAddress: "LAN_MAC"
		}, "LAN_MAC")
	}
	return devices[mac]
}

this.updateLastUsed = (mac, sign, lastUsed) => {
	var promise = new Promise(function (resolve, reject) {
		if (lastUsed === "MAC") {
			var query = {
				mac: mac
			}
		} else if (lastUsed === "LAN_MAC") {
			var query = {
				"info.lanmac": mac
			}
		}
		return Sign.findOneAndUpdate(query, {
			'$set': sign
		}, {
			new: true
		}, function (err, sign) {
			if (err) {
				return reject(err);
			} else if (sign === null) {
				return reject(new Error("Sign not exists!"));
			} else {
				return resolve(sign);
			}
		});
	});
	return promise;
}

this.find = (query = {}, projection = {}) => {
	return Sign
		.find(query).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').populate('childs').lean();
};

this.count = (query = {}) => {
	return Sign
		.count(query);
};

this.findOne = query => {
	return Sign
		.findOne(query).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').populate('childs');
};

this.findOneById = (id, user) => {
	var query = {
		_id: id,
		networkOwnerId: user.networkOwnerId
	};
	return Sign
		.findOne(query).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location');
};

this.findsignsById = async (query = {}) => {
	var result = await (Sign.find(query).populate('_location').populate('childs'));
	return result
};

this.getLocations = async (_location) => {
	try {
		// location = 'ba'
		let location = _location.replace(/"/g, '');
		var locations = await (Sign.aggregate([{

				$match: {
					$and: [{
						"$or": [
							// {
							// 	streetAddress1: {
							// 		'$regex': '.*' + location + '.*',
							// 		$options: 'ig',
							// 	}
							// },
							// {
							// 	streetAddress2: {
							// 		'$regex': '.*' + location + '.*',
							// 		$options: 'ig',
							// 	}
							// },
							{
								city: {
									'$regex': '.*' + location + '.*',
									$options: 'ig',
								}
							},
							// {
							// 	state: {
							// 		'$regex': '.*' + location + '.*',
							// 		$options: 'ig',
							// 	}
							// },
							// {
							// 	locationString: {
							// 		'$regex': '.*' + location + '.*',
							// 		$options: 'ig',
							// 	}
							// },
							{
								country: {
									'$regex': '.*' + location + '.*',
									$options: 'ig',
								}
							},
						]
					}, {
						city: {
							$ne: null
						}
					}]
				}
			}, {
				$group: {
					_id: "$city",
					city: {
						$first: "$city"
					},
					country: {
						$first: "$country"
					},
				}
			}, {
				$limit: 5
			}]

		))

		return locations
	} catch (e) {
		return (e)
	}
}

this.getSignsForAudiencePage = async (params, user) => {
	try {
		var query = params.audience
		if (query.location) {
			var location = query.location;
		}
		var skip;
		if (!params.skip || params.skip === null || params.skip < 0) {
			skip = 0
		} else {
			skip = params.skip
		}
		var limit = params.limit
		var orientations = query.orientations
		var screenTypes = query.screenTypes
		var viewers = query.viewers
		var showListings = query.showListings
		var showListingsCriteria = query.showListingsCriteria
		var _fromDate = moment(query.from).toDate()
		var _toDate = moment(query.to).toDate()
		var fromDate = new Date(_fromDate.setHours(0, 0, 0, 0))
		var toDate = new Date(_toDate.setHours(24, 0, 0, 0))
		var viewsRange = query.viewsRange
		var priceRange = query.priceRange
		var listingId = params.listingId;

		var totalCount = 0;
		// or
		var ownPriceFilter = {}
		if (showListings === "myListings") {
			var OwnListing = user.networkOwnerId;
			showListings = "showAllListings"
		}
		if (user.networkOwnerId && priceRange.from > 0 && !OwnListing) {
			ownPriceFilter = {
				networkOwnerId: {
					$ne: mongoose.Types.ObjectId(user.networkOwnerId)
				}
			}
		}
		var _orientations = {}
		var $match = {}
		if (orientations && orientations.length !== 2 && orientations.length > 0) {
			if (!$match.$and) {
				$match.$and = []
			}
			_orientations = {
				orientation: orientations[0]
			}
			$match.$and.push(_orientations)
		}
		var _screenTypes = {}
		if (screenTypes.length !== 3 && screenTypes.length > 0) {
			if (!$match.$and) {
				$match.$and = []
			}
			_screenTypes.screenType = {
				$in: screenTypes
			}
			screenType = {}
			screenType = _screenTypes.screenType
			$match.$and.push({
				screenType
			})
		}
		var _viewers = {}
		if (viewers.length !== 3 && viewers.length > 0) {
			if (!$match.$and) {
				$match.$and = []
			}
			if (!$match.$and) {
				$match.$and = []
			}
			_viewers.viewers = {
				$in: viewers
			}
			viewers = {}
			viewers = _viewers.viewers
			$match.$and.push({
				viewers
			})
		}
		if ($match) {
			if ($match.$and) {
				$match.$and.push({
					isHidden: false
				})
				$match.$and.push({
					isEvent: false
				})

			}
			var soldOutGroupMatch = JSON.parse(JSON.stringify($match))
		}
		var finalQuery = []
		if (ownPriceFilter.networkOwnerId) {
			finalQuery.push(ownPriceFilter)
		}
		if (viewsRange.from > 0) {
			var viewersUpperLimit = {
				totalAvgViewersCount: {
					$gte: query.viewsRange.from
				}
			}
			finalQuery.push(viewersUpperLimit)
		}
		if (viewsRange.to < 10000) {
			var viewersLowerLimit = {
				totalAvgViewersCount: {
					$lte: query.viewsRange.to
				}
			}
			finalQuery.push(viewersLowerLimit)
		}
		if (priceRange.from > 0) {
			var pricePerslotFilterlowerLimit = {
				pricePerSlot: {
					$gte: query.priceRange.from
				}
			}
			finalQuery.push(pricePerslotFilterlowerLimit)
		}
		if (priceRange.to < 100) {
			var pricePerslotFilterUpperLimit = {
				pricePerSlot: {
					$lte: query.priceRange.to
				}
			}
			finalQuery.push(pricePerslotFilterUpperLimit)
		}
		if (query.location) {
			// or condition
			// var _locationWithOutSpecialCharacter = location.replace("%", "")
			var locationOrCondition = [];
			var _FinalLocation = ''
			for (let k = 0; k < location.length; k++) {
				let _locationReplace = location[k]
				_locationReplace = _locationReplace.replace("\\", "\\\\")
				_locationReplace = _locationReplace.replace("*", "\\*")
				_locationReplace = _locationReplace.replace("(", "\\(")
				_locationReplace = _locationReplace.replace(")", "\\)")
				_locationReplace = _locationReplace.replace("+", "\\+")
				_locationReplace = _locationReplace.replace("[", "\\[")
				_locationReplace = _locationReplace.replace("|", "\\|")
				_locationReplace = _locationReplace.replace(",", "\\,")
				_locationReplace = _locationReplace.replace(".", "\\.")
				_locationReplace = _locationReplace.replace("?", "\\?")
				_locationReplace = _locationReplace.replace("^", "\\^")
				_locationReplace = _locationReplace.replace("$", "\\$")
				_FinalLocation = _FinalLocation.toString() + _locationReplace.toString()
			}
			location = _FinalLocation
			locationOrCondition.push({
				name: {
					$regex: location,
					$options: 'ig',
				}
			})
			locationOrCondition.push({
				description: {
					$regex: location,
					$options: 'ig',
				}
			})
			locationOrCondition.push({
				streetAddress1: {
					$regex: location,
					$options: 'ig',
				}
			})
			locationOrCondition.push({
				streetAddress2: {
					$regex: location,
					$options: 'ig',
				}
			})
			locationOrCondition.push({
				city: {
					$regex: location,
					$options: 'ig',
				}
			})
			locationOrCondition.push({
				state: {
					$regex: location,
					$options: 'ig',
				}
			})
			locationOrCondition.push({
				country: {
					$regex: location,
					$options: 'ig',
				}
			})
			locationOrCondition.push({
				serialNumber: {
					$regex: location,
					$options: 'ig',
				}
			})
			if (location.includes("^")) {
				var _locationWithOutSpecialCharacter = location.replace("^", "")
			}
			if (location.includes("%")) {
				var _locationWithOutSpecialCharacter = location.replace("%", "")
			}
			if (_locationWithOutSpecialCharacter) {
				locationOrCondition.push({
					locationString: {
						$regex: _locationWithOutSpecialCharacter,
						$options: 'ig',
					}
				})
			} else {
				locationOrCondition.push({
					locationString: {
						$regex: location,
						$options: 'ig',
					}
				})
			}
			if (!isNaN(location)) {
				// locationOrCondition.push({ serialNumber:{$eq:location} })
				locationOrCondition.push({
					serialNumber: location.toString()
				})
			}
			var locationQuery = {
				$or: locationOrCondition
			}
			finalQuery.push(locationQuery)
		}
		if (listingId) {
			finalQuery.push({
				serialNumber: (listingId).toString()
			})
		}
		if (OwnListing) {
			finalQuery.push({
				networkOwnerId: (OwnListing).toString()
			})
		}
		if (finalQuery.length > 1) {
			for (let z = 0; z < finalQuery.length; z++) {
				if (finalQuery[z].networkOwnerId && !OwnListing) {
					finalQuery[z].networkOwnerId.$ne = finalQuery[z].networkOwnerId.$ne.toString()
				}
			}
			var viewsCountQuery = {
				$and: finalQuery
			}
		} else {
			var viewsCountQuery = finalQuery[0]
		}
		if (finalQuery && finalQuery.length > 0) {
			// let copyOf = finalQuery
			var _signFindCondition = JSON.stringify(finalQuery)
			var signFindCondition = JSON.parse(_signFindCondition)
		}
		try {
			var _unavilablesign = []
			// var unavilablesign = await(PaymentSummary.aggregate(
			//   [
			//     { "$match": 
			//       {
			//         $or: [	
			//         {
			//           "campaignStartDate" : {"$gte" : fromDate, "$lt": toDate}
			//         },
			//         {
			//           "campaignEndDate" : {"$gte" : fromDate, "$lt": toDate}
			//         },
			//         {
			//           $and : [
			//           {
			//             "campaignStartDate" : {"$lte" : fromDate},
			//             "campaignEndDate" : {"$gt": toDate},
			//           }
			//           ]
			//         }

			//         ]
			//       }
			//     },
			//     {
			//     $lookup:{
			//       from : "sign",
			//       localField : "signId",
			//       foreignField : "_id",
			//       as : "signDetail"
			//     }
			//     },
			//     { '$unwind': { 'path': '$signDetail', 'preserveNullAndEmptyArrays': true } },
			//     {
			//     $group : {
			//       // _id : {sign : "$signDetail._id"},
			//       _id : {sign : "$signDetail._id"},
			//       availableSlots: { $first: "$signDetail.availableSlots" },
			//       pricePerSlot: { $first: "$signDetail.pricePerSlot" },
			//       signId: { $first: "$signDetail._id" },
			//       occupied: { $sum: 1 }
			//     }
			//     },
			//     {
			//       "$project": { 
			//         "_id": 1,
			//         "isSlotsAvailable": { 
			//           "$gt" : [ "$availableSlots", "$occupied" ] 
			//         }
			//       }
			//     },    
			//     {
			//       "$match": {            
			//         "isSlotsAvailable": false
			//       }
			//     },
			//     {
			//       "$group": {
			//         "_id":null,
			//         "signId":{$push:"$_id.sign"}
			//         }
			//     }
			//   ]
			// ))
			var unavilablesign = await (Booking.aggregate(
				[{
						"$match": {
							$or: [{
									"from": {
										"$gte": fromDate,
										"$lt": toDate
									}
								},
								{
									"to": {
										"$gte": fromDate,
										"$lt": toDate
									}
								},
								{
									$and: [{
										"from": {
											"$lte": fromDate
										},
										"to": {
											"$gt": toDate
										},
									}]
								}

							]
						}
					},
					{
						$lookup: {
							from: "sign",
							localField: "sign",
							foreignField: "_id",
							as: "signDetail"
						}
					},
					{
						'$unwind': {
							'path': '$signDetail',
							'preserveNullAndEmptyArrays': true
						}
					},
					{
						$group: {
							// _id : {sign : "$signDetail._id"},
							_id: {
								sign: "$signDetail._id"
							},
							availableSlots: {
								$first: "$signDetail.availableSlots"
							},
							pricePerSlot: {
								$first: "$signDetail.pricePerSlot"
							},
							signId: {
								$first: "$signDetail._id"
							},
							occupied: {
								$sum: 1
							}
						}
					},
					{
						"$project": {
							"_id": 1,
							"isSlotsAvailable": {
								"$gt": ["$availableSlots", "$occupied"]
							}
						}
					},
					{
						"$match": {
							"isSlotsAvailable": false
						}
					},
					{
						"$group": {
							"_id": null,
							"signId": {
								$push: "$_id.sign"
							}
						}
					}
				]
			))
			if ($match.$and) {
				if (unavilablesign.length > 0) {
					$match.$and.push({
						_id: {
							$nin: unavilablesign[0].signId
						}
					})
				}
				if (showListings !== "showAllListings") {
					$match.$and.push({
						availableSlots: {
							$gt: 0
						}
					})
				}
				$match.$and.push({
					status: {
						$ne: "DELETED"
					}
				})
				$match.$and.push({
					active: true
				})
			} else {
				$match.$and = []
				if (unavilablesign.length > 0) {
					$match.$and.push({
						_id: {
							$nin: unavilablesign[0].signId
						}
					})
				}
				if (showListings !== "showAllListings") {
					$match.$and.push({
						availableSlots: {
							$gt: 0
						}
					})
				}
				$match.$and.push({
					status: {
						$ne: "DELETED"
					}
				})
				$match.$and.push({
					active: true
				})
				// $match.$and.push({isHidden: false})
				$match.$and.push({
					isEvent: false
				})
			}
			// avilable signs with condition
			// var avilablesignsWithCondition = await(SignDetail.aggregate(
			var signMatchQuery = JSON.parse(JSON.stringify($match))
			var avilablesignsWithCondition = await (Sign.aggregate(
				[{
						$match
					},
					{
						"$group": {
							"_id": null,
							// "signId":{$push:"$signId"}
							"signId": {
								$push: "$_id"
							}

						}
					}
				]))

			// group details
			var $match = {}
			if (avilablesignsWithCondition.length == 0) {
				var resultJSon = {}
				resultJSon.count = 0
				resultJSon.signs = []
				return JSON.stringify(resultJSon)
			}
			if (showListingsCriteria !== "showAllSigns") {
				// var avilableIds = avilablesignsWithCondition[0].signId.map(function(el) { return mongoose.Types.ObjectId(el) })
				var findGroupId = []
				if (!OwnListing) {
					findGroupId.push({
						$match: {
							$or: [{
									isHidden: false
								},
								{
									isHidden: {
										$exists: false
									}
								}
							]
						}
					})
					findGroupId.push({
						$match: {
							$or: [{
									isEvent: false
								},
								{
									isEvent: {
										$exists: false
									}
								}
							]
						}
					})
				}
				findGroupId.push({
					'$unwind': {
						'path': '$childs',
						'preserveNullAndEmptyArrays': true
					}
				})
				findGroupId.push({
					$match: {
						$and: [{
								'childs._id': {
									$in: avilablesignsWithCondition[0].signId
								}
							}, {
								'childs.availableSlots': {
									$gt: 0
								}
							},
							{
								status: {
									$ne: "DELETED"
								}
							},
							{
								active: true
							}
						]
					}
				})
				findGroupId.push({
					"$group": {
						"_id": null,
						"signId": {
							$push: "$_id"
						}
					}
				})
				var groupIds = await (Group.aggregate(findGroupId))
				var groupDetailQuery = []
				groupDetailQuery.push({
					'$unwind': {
						'path': '$childs',
						'preserveNullAndEmptyArrays': true
					}
				})
				if (groupIds.length > 0) {
					if (unavilablesign.length === 0) {
						unavilablesign.push({
							signId: []
						})
					}
					groupDetailQuery.push({
						$match: {
							$and: [{
									'childs._id': {
										$nin: unavilablesign[0].signId
									}
								},
								{
									'childs.availableSlots': {
										$gt: 0
									}
								},
								{
									'_id': {
										$in: groupIds[0].signId
									}
								},
								{
									status: {
										$ne: "DELETED"
									}
								},
								{
									active: true
								}
							]
						}
					})
				} else if (groupIds.length > 0) {
					groupDetailQuery.push({
						$match: {
							$and: [{
									'_id': {
										$in: groupIds[0].signId
									}
								}, {
									status: {
										$ne: "DELETED"
									}
								},
								{
									active: true
								}
							]
						}
					})
				}
				groupDetailQuery.push({
					"$group": {
						"_id": "$_id",
						signId: {
							$first: "$_id"
						},
						signType: {
							$first: "$signType"
						},
						groupType: {
							$first: "$groupType"
						},
						createdAt: {
							$first: "$createdAt"
						},
						name: {
							$first: "$name"
						},
						_location: {
							$first: "$_location"
						},
						totalAvgViewersCount: {
							$sum: '$childs.totalAvgViewersCount'
						},
						pricePerSlot: {
							$sum: '$childs.pricePerSlot'
						},
						childs: {
							$push: {
								childs: "$childs"
							}
						},
						serialNumber: {
							$first: "$serialNumber"
						},
						discountValue: {
							$first: "$discountValue"
						},
						profileMedia: {
							$first: "$profileMedia"
						},
						networkOwnerId: {
							$first: "$networkOwnerId"
						},
						description: {
							$first: "$description"
						},
						locationString: {
							$first: "$locationString"
						},

					}
				})
				groupDetailQuery.push({
					"$project": {
						"_id": 1,
						signId: 1,
						signType: 1,
						groupType: 1,
						createdAt: 1,
						name: 1,
						_location: 1,
						totalAvgViewersCount: 1,
						discountValue: 1,
						pricePerSlot: {
							"$multiply": ["$pricePerSlot", {
								"$divide": [{
									$subtract: [100, "$discountValue"]
								}, 100]
							}]
						},
						childs: 1,
						serialNumber: 1,
						profileMedia: 1,
						networkOwnerId: 1,
						description: 1,
						locationString: 1
					}
				})
				if (viewsCountQuery) {
					groupDetailQuery.push({
						$match: viewsCountQuery
					})
					// groupDetailQuery.push({$match:{serialNumber: 1000004}})
				}
				groupDetailQuery.push({
					$sort: {
						createdAt: 1
					}
				})
				// groupDetailQuery.push( { $limit : limit })
				// executing query   
				if (groupIds.length > 0) {
					var groupdetails = await (Group.aggregate([
						groupDetailQuery
					]))
				}
				// if (groupdetails && groupdetails.length > 0) {
				//   totalCount = totalCount + groupdetails.length
				//   groupdetails = groupdetails.splice(0,limit)
				// }
				// sold group query
				if (showListings !== "showAvailable") {
					var soldGroupQuery = []
					if (soldOutGroupMatch.$and) {
						if (unavilablesign[0].signId) {
							soldOutGroupMatch.$and.push({
								$or: [{
									_id: {
										$in: unavilablesign[0].signId
									}
								}, {
									availableSlots: {
										$eq: 0
									}
								}]
							})
						} else {
							soldOutGroupMatch.$and.push({
								availableSlots: {
									$eq: 0
								}
							})
						}
						var soldOutSignForGroup = await (Sign.aggregate([{
								$match: soldOutGroupMatch
							},
							{
								$group: {
									"_id": null,
									"signId": {
										$push: "$_id"
									}
								}
							}
						]))
						if (soldOutSignForGroup.length > 0) {
							var includedGroupQuery = []
							includedGroupQuery.push({
								"childs._id": {
									"$in": soldOutSignForGroup[0].signId
								}
							})
						} else {
							var soldOutGroupFlag = 2
						}
						if (groupIds && groupIds[0] && groupIds[0].signId && includedGroupQuery) {
							includedGroupQuery.push({
								'_id': {
									$nin: groupIds[0].signId
								}
							})
						}
						if (includedGroupQuery) {
							var includedGroup = await (Group.aggregate([{
									$match: {
										$and: includedGroupQuery
									}
								},
								{
									$group: {
										"_id": null,
										"signId": {
											$push: "$_id"
										}
									}
								}
							]))
						}
					}
					if (groupIds.length > 0 && groupIds[0].signId.length > 0 && (!includedGroup || includedGroup.length === 0)) {
						soldGroupQuery.push({
							$match: {
								$and: [{
									active: true
								}, {
									'_id': {
										$nin: groupIds[0].signId
									}
								}, {
									status: {
										$ne: "DELETED"
									}
								}]
							}
						})
						if (!OwnListing) {
							soldGroupQuery[0].$match.$and.push({
								$or: [{
									isHidden: false
								}, {
									isHidden: {
										$exists: false
									}
								}]
							})
							soldGroupQuery[0].$match.$and.push({
								$or: [{
									isEvent: false
								}, {
									isEvent: {
										$exists: false
									}
								}]
							})
						}
					} else if (includedGroup && includedGroup.length > 0) {
						soldGroupQuery.push({
							$match: {
								$and: [{
									active: true
								}, {
									'_id': {
										$in: includedGroup[0].signId
									}
								}, {
									status: {
										$ne: "DELETED"
									}
								}]
							}
						})
						if (!OwnListing) {
							soldGroupQuery[0].$match.$and.push({
								$or: [{
									isHidden: false
								}, {
									isHidden: {
										$exists: false
									}
								}]
							})
							soldGroupQuery[0].$match.$and.push({
								$or: [{
									isEvent: false
								}, {
									isEvent: {
										$exists: false
									}
								}]
							})
						}
					} else {
						soldGroupQuery.push({
							$match: {
								$and: [{
									active: true
								}, {
									status: {
										$ne: "DELETED"
									}
								}]
							}
						})
						if (!OwnListing) {
							soldGroupQuery[0].$match.$and.push({
								$or: [{
									isHidden: false
								}, {
									isHidden: {
										$exists: false
									}
								}]
							})
							soldGroupQuery[0].$match.$and.push({
								$or: [{
									isEvent: false
								}, {
									isEvent: {
										$exists: false
									}
								}]
							})
						}
					}
					soldGroupQuery.push({
						'$unwind': {
							'path': '$childs',
							'preserveNullAndEmptyArrays': true
						}
					})
					soldGroupQuery.push({
						"$group": {
							"_id": "$_id",
							signId: {
								$first: "$_id"
							},
							signType: {
								$first: "$signType"
							},
							groupType: {
								$first: "$groupType"
							},
							createdAt: {
								$first: "$createdAt"
							},
							name: {
								$first: "$name"
							},
							_location: {
								$first: "$_location"
							},
							totalAvgViewersCount: {
								$sum: '$childs.totalAvgViewersCount'
							},
							pricePerSlot: {
								$sum: '$childs.pricePerSlot'
							},
							childs: {
								$push: {
									childs: "$childs"
								}
							},
							serialNumber: {
								$first: "$serialNumber"
							},
							discountValue: {
								$first: "$discountValue"
							},
							profileMedia: {
								$first: "$profileMedia"
							},
							networkOwnerId: {
								$first: "$networkOwnerId"
							},
							description: {
								$first: "$description"
							},
							active: {
								$first: "$active"
							},
							locationString: {
								$first: "$locationString"
							},

						}
					})
					soldGroupQuery.push({
						"$project": {
							"_id": 1,
							signId: 1,
							signType: 1,
							groupType: 1,
							createdAt: 1,
							name: 1,
							_location: 1,
							totalAvgViewersCount: 1,
							discountValue: 1,
							pricePerSlot: {
								"$multiply": ["$pricePerSlot", {
									"$divide": [{
										$subtract: [100, "$discountValue"]
									}, 100]
								}]
							},
							childs: 1,
							serialNumber: 1,
							profileMedia: 1,
							networkOwnerId: 1,
							description: 1,
							active: 1,
							locationString: 1
						}
					})
					if (viewsCountQuery) {
						soldGroupQuery.push({
							$match: viewsCountQuery
						})

					}
					soldGroupQuery.push({
						$addFields: {
							unavilable: "soldOut",
						}
					})
					soldGroupQuery.push({
						$match: {
							$and: [{
								active: true
							}]
						}
					})
					soldGroupQuery.push({
						$sort: {
							createdAt: 1
						}
					})
					if (!soldOutGroupFlag) {
						var soldOutgroupdetails = await (
							Group.aggregate([
								soldGroupQuery
							]))
					}
					// soldOutgroupdetails = []
					if (groupdetails && soldOutgroupdetails && soldOutgroupdetails.length > 0) {
						// totalCount = totalCount + soldOutgroupdetails.length
						// soldOutgroupdetails = soldOutgroupdetails.splice( 0, limit)
						groupdetails = groupdetails.concat(soldOutgroupdetails)
					} else if (!groupdetails) {
						var groupdetails = soldOutgroupdetails
					}
				}
			}
			if (finalQuery.length >= 1) {
				if (!OwnListing) {
					finalQuery.push({
						$or: [{
								isHidden: false
							},
							{
								isHidden: {
									$exists: false
								}
							}
						]
					})
					finalQuery.push({
						$or: [{
								isEvent: false
							},
							{
								isEvent: {
									$exists: false
								}
							}
						]
					})
				}
				finalQuery.push({
					_id: {
						$in: avilablesignsWithCondition[0].signId
					}
				})
				var getSignQuery = {
					$and: finalQuery
				}
			} else {
				var getSignQuery = {}
				getSignQuery.$and = []
				getSignQuery.$and.push({
					_id: {
						$in: avilablesignsWithCondition[0].signId
					}
				})
				if (!OwnListing) {
					getSignQuery.$and.push({
						$or: [{
								isHidden: false
							},
							{
								isHidden: {
									$exists: false
								}
							}
						]
					})
					getSignQuery.$and.push({
						$or: [{
								isEvent: false
							},
							{
								isEvent: {
									$exists: false
								}
							}
						]
					})
				}

				// var getSignQuery = {_id:{
				//   $in:avilablesignsWithCondition[0].signId
				// }}
			}
			// if (getSignQuery.$and) {
			//   getSignQuery
			// }
			if (showListingsCriteria !== "showAllGroups") {
				// var avaliableSignData =  await(Sign.find(getSignQuery).populate('_location').sort({createdAt:1}).lean())
				let _limit = skip + limit
				var avaliableSignData = await (Sign.find(getSignQuery).sort({
					createdAt: 1
				}).skip(0).limit(_limit).lean())
				var _avaliableSignDataCount = await (Sign.find(getSignQuery).count().lean())
				_avaliableSignDataCount = _avaliableSignDataCount - _limit
				// console.log(JSON.stringify(getSignQuery))
			}
			if (showListingsCriteria === "showAll") {
				if (groupdetails && groupdetails.length > 0) {
					var resultArray = avaliableSignData.concat(groupdetails)
				} else {
					var resultArray = avaliableSignData
				}
			} else if (showListingsCriteria === "showAllGroups") {
				var resultArray = groupdetails
			} else {
				var resultArray = avaliableSignData
			}
			if (showListings === "showAllListings" && unavilablesign.length > 0 && showListingsCriteria !== "showAllGroups") {
				ids = unavilablesign[0].signId
				if (!signFindCondition || signFindCondition.length <= 0) {
					var signFindCondition = []
				}
				if (signMatchQuery) {
					for (let signMatch = 0; signMatch < signMatchQuery.$and.length; signMatch++) {
						if (!signMatchQuery.$and[signMatch]._id) {
							signFindCondition.push(signMatchQuery.$and[signMatch])
						}
					}
					signFindCondition.push({
						"_id": {
							$in: ids
						}
					})
				} else {
					signFindCondition.push({
						status: {
							$ne: "DELETED"
						}
					})
					signFindCondition.push({
						active: true
					})
				}
				// var soldOutSign = await(Sign.aggregate([
				//   {
				//     $match:{
				//       $and:[
				//         {"_id": {$in:ids}},
				//         {status: {$ne:"DELETED"}},
				//         {active: true}
				//       ]
				//     }
				//   },{
				//     $addFields: {
				//       unavilable: "soldOut" ,
				//     }
				//   }
				// ]

				// ))
				var soldOutSign = await (Sign.aggregate([{
						$match: {
							$and: signFindCondition
						}
					}, {
						$addFields: {
							unavilable: "soldOut",
						}
					},
					{
						$sort: {
							createdAt: 1
						}
					}
				]))
				if (soldOutSign.length > 0) {
					// totalCount = totalCount + soldOutSign.length
					// soldOutSign = soldOutSign.splice( 0, limit)
					resultArray = resultArray.concat(soldOutSign)
				}
			}
			var result = arraySort(resultArray, ['createdAt']);
			var resultJSon = {}
			if (_avaliableSignDataCount && _avaliableSignDataCount > 0) {
				resultJSon.count = result.length + _avaliableSignDataCount
			} else {
				resultJSon.count = result.length

			}
			// resultJSon.count = totalCount
			resultJSon.signs = result.splice(skip, limit)
			for (let index = 0; index < resultJSon.signs.length; index++) {
				if (user.networkOwnerId) {
					if (resultJSon.signs[index].networkOwnerId.toString() === user.networkOwnerId.toString()) {
						resultJSon.signs[index].ownSign = true
					} else {
						resultJSon.signs[index].ownSign = false
					}
				}
				if (resultJSon.signs[index].unavilable) {
					resultJSon.signs[index].availableSlots = 0
				}
				if (resultJSon.signs[index].signType === "SIGN") {
					if (resultJSon.signs[index].ownSign) {
						// resultJSon.signs[index].pricePerSlot = 0
					}
				}
				if (resultJSon.signs[index].signType === 'GROUP') {
					resultJSon.signs[index]._totalAvgViewersCount = resultJSon.signs[index].totalAvgViewersCount
					// if(resultJSon.signs[index].ownSign) {
					//   // resultJSon.signs[index]._totalPrice = (0 * 1)
					// } else {
					if (!resultJSon.signs[index].pricePerSlot) {
						resultJSon.signs[index].pricePerSlot = 0
					}
					resultJSon.signs[index]._totalPrice = resultJSon.signs[index].pricePerSlot
					// }
					if (resultJSon.signs[index].unavilable) {
						resultJSon.signs[index].availableSlots = 0
					} else {
						resultJSon.signs[index].availableSlots = 1
					}
					var timeInSec = 0
					resultJSon.signs[index].timeInSec = 0;
					if (resultJSon.signs[index].childs[0].childs) {
						for (let childLength = 0; childLength < resultJSon.signs[index].childs.length; childLength++) {
							timeInSec = timeInSec + resultJSon.signs[index].childs[childLength].childs.holdTime
							resultJSon.signs[index].childs[childLength].childs._id = resultJSon.signs[index].childs[childLength].childs._id
							resultJSon.signs[index].childs[childLength] = resultJSon.signs[index].childs[childLength].childs
						}
					} else {
						resultJSon.signs[index].childs = [];
					}
					resultJSon.signs[index]["timeInSec"] = timeInSec
				}
			}
			resultJSon.signs = JSON.stringify(resultJSon.signs)
			return resultJSon
		} catch (err) {
			console.log(err)
			return err
		}
	} catch (err) {
		console.log(err)
		return err
	}
	return
}

this.getSelectedSignsData = async (ids, groupIds, params, user) => {
	var promise = new Promise(function (resolve, reject) {
		try {
			let query = {
				_id: {
					$in: ids
				}
			}
			var projection, location
			var signs = await (self.findForSearch(query, projection, location))
			if (groupIds && groupIds.length > 0) {
				let groupQuery = {
					_id: {
						$in: groupIds
					}
				}
				var group = await (GroupSer.findForSearch(groupQuery, projection, location))
				var _group = JSON.stringify(group)
				var group = JSON.parse(_group)
				if (group.length > 0) {
					signs = signs.concat(group)
				}
			}
			var signIds = []
			for (var i = 0; i < signs.length; i++) {
				if (signs[i].profileMedia) {
					if (signs[i].profileMedia._id) {
						signs[i].profileMedia = signs[i].profileMedia._id
					}
				}
				if (signs[i].signType !== 'GROUP') {
					signIds.push(signs[i]._id)
				} else if (signs[i].signType === 'GROUP') {
					var childs = signs[i].childs
					for (var j = 0; j < childs.length; j++) {
						signIds.push(childs[j]._id)
					}
				}
			}
			let audience = JSON.parse(params.audience)
			let from = audience.from
			let to = audience.to
			var bookings = await (BookingServ.listBookings(signIds, from, to))
			var signMap = {}
			for (var i = 0; i < bookings.length; i++) {
				var booking = bookings[i]
				if (!signMap[booking.sign]) {
					signMap[booking.sign] = []
				}
				var bookedSlotArray = signMap[booking.sign]
				bookedSlotArray.push(booking.slotCode)
				signMap[booking.sign] = bookedSlotArray
			}
			var _signs = []
			for (var i = 0; i < signs.length; i++) {
				var sign = signs[i]
				var _sign = JSON.stringify(sign)
				sign = JSON.parse(_sign)
				sign._totalPrice = 0
				var bookedSlotArray = []
				if (signMap[sign._id]) {
					bookedSlotArray = signMap[sign._id]
				}
				sign.availableSlots = sign.availableSlots - bookedSlotArray.length
				sign.ownSign = false
				if (user.networkOwnerId && sign.networkOwnerId.toString() === user.networkOwnerId.toString()) {
					sign.ownSign = true
				}
				if (sign.signType !== 'GROUP') {
					_signs.push(sign)
				} else if (sign.signType === 'GROUP') {
					var childSigns = []
					sign.availableSlots = 0
					sign._totalAvgViewersCount = 0
					sign._totalPrice = 0
					if (sign.childs.length > 0) {
						for (var j = 0; j < sign.childs.length; j++) {
							if (signMap[sign.childs[j]._id]) {
								bookedSlotArray = signMap[sign.childs[j]._id]
							}
							sign.childs[j].availableSlots = sign.childs[j].availableSlots - bookedSlotArray.length
							if (sign.childs[j].availableSlots > 0) {
								// if (sign.childs[j].slotPeriod === 'perWeek') {
								sign._totalPrice += sign.childs[j].pricePerSlot
								sign.availableSlots += (sign.childs[j].availableSlots * 1)
								// } else if (sign.childs[j].slotPeriod === 'perMonth') {
								//   var _totalPrice = sign.childs[j].pricePerSlot / 30
								//   sign._totalPrice += _totalPrice * 7
								// }
								if (!sign.childs[j].totalAvgViewersCount) {
									sign.childs[j].totalAvgViewersCount = 0
								}
								sign._totalAvgViewersCount += sign.childs[j].totalAvgViewersCount
								childSigns.push(sign.childs[j])
								// sign.childs.splice(j, 1)
							}
						}
						sign.childs = []
						sign.childs = childSigns
						if (!sign.discountValue || sign.discountValue <= 0) {
							var _totalPrice = sign._totalPrice
						} else if (sign.discountValue > 0) {
							var discount = ((sign._totalPrice * sign.discountValue) / 100)
							var _totalPrice = sign._totalPrice - discount
						}
						// var _totalPrice = (sign._totalPrice * 0.9)
						sign._totalPrice = (Math.round(_totalPrice * 100) / 100).toFixed(2) * 1

						_signs.push(sign)
					}
				}
			}
			// for (let k = 0; k < _signs.length; k++) {
			//   let sign = _signs[k]
			//   let _sign = JSON.stringify(sign)
			//   sign = JSON.parse(_sign)
			//   sign.ownSign = false
			//   if (user.networkOwnerId) {
			//     if (sign.networkOwnerId.toString() === user.networkOwnerId.toString()) {
			//       sign.ownSign = true
			//       // if (sign.signType === "SIGN") {
			//       //   sign.pricePerSlot = 0
			//       // } else if (sign.signType === "GROUP") {
			//       //   for (let l = 0; l < sign.childs.length; l++) {
			//       //     sign.childs[l].pricePerSlot = 0
			//       //   }
			//       //   sign.pricePerSlot = 0
			//       //   sign._totalPrice= 0
			//       // }
			//     }
			//   }
			// }
			return resolve(_signs)
		} catch (err) {
			return reject(err)
		}
	});
	return promise;
};

this.getHiddenSignsDataCount = async (params, user) => {
	try {
		let query = {
			networkOwnerId: user.networkOwnerId,
			isHidden: true,
			status: {
				$ne: "DELETED"
			},
			active: true
		}
		let signsCount = await (Sign.count(query))
		let groupCount = await (Group.count(query))
		let totalCount = signsCount + groupCount
		return totalCount
	} catch (err) {
		return err
	}
}

this.getHiddenSignsData = async (params, user) => {
	try {
		let query = {
			networkOwnerId: user.networkOwnerId,
			isHidden: true,
			status: {
				$ne: "DELETED"
			},
			active: true,
			$or: [{
					isEvent: false
				},
				{
					isEvent: {
						$exists: false
					}
				}
			]
		}
		let signs = await (Sign.find(query, {
			signType: 1,
			name: 1,
			orientation: 1,
			dimension: 1,
			locationString: 1,
			availableSlots: 1,
			holdTime: 1,
			holdTimeUnit: 1,
			pricePerSlot: 1,
			slotPeriod: 1,
			viewers: 1,
			totalAvgViewersCount: 1,
			avgViewersCountWalking: 1,
			avgViewersCountDriving: 1,
			avgViewersCountTrain: 1,
			operatingHours: 1,
			establishmentType: 1,
			establishmentName: 1,
			description: 1,
			networkOwnerId: 1,
			active: 1,
			isHidden: 1,
			profileMedia: 1,
			serialNumber: 1,
			timeZone: 1,
			offset: 1,
			token: 1
		}).lean())
		let groupQuery = {
			networkOwnerId: user.networkOwnerId,
			isHidden: true,
			status: {
				$ne: "DELETED"
			},
			active: true,
		}
		let group = await (Group.find(groupQuery).lean())
		let _group = JSON.stringify(group)
		group = JSON.parse(_group)
		var groupMap = {}
		var childMap = {}
		var allChilds = []
		for (let i = 0; i < group.length; i++) {
			let childs = []
			if (group[i].childs.length > 0) {
				// groupMap[group[i]._id.toString()] = group[i].childs
				for (let j = 0; j < group[i].childsDetails.length; j++) {
					let child = group[i].childsDetails[j]
					if (!childMap[child.toString()]) {
						childMap[child.toString()] = child.toString()
						childs.push(child.toString())
						allChilds.push(child.toString())

					} else {
						// childMap[child.toString()] = child.toString()
					}
				}
				groupMap[group[i]._id.toString()] = childs
			}
		}
		var _allChilds = await (Sign.find({
			_id: {
				$in: allChilds
			}
		}, {
			signType: 1,
			name: 1,
			orientation: 1,
			dimension: 1,
			locationString: 1,
			availableSlots: 1,
			holdTime: 1,
			holdTimeUnit: 1,
			pricePerSlot: 1,
			slotPeriod: 1,
			viewers: 1,
			totalAvgViewersCount: 1,
			avgViewersCountWalking: 1,
			avgViewersCountDriving: 1,
			avgViewersCountTrain: 1,
			operatingHours: 1,
			establishmentType: 1,
			establishmentName: 1,
			description: 1,
			networkOwnerId: 1,
			active: 1,
			isHidden: 1,
			profileMedia: 1,
			serialNumber: 1,
			timeZone: 1,
			offset: 1
		}).lean())
		// console.log(JSON.stringify(_allChilds))
		for (let i = 0; i < group.length; i++) {
			// group[i].childs = group[i].childsDetails
			let childs = []
			if (groupMap[group[i]._id.toString()]) {
				for (let j = 0; j < _allChilds.length; j++) {
					if ((groupMap[group[i]._id.toString()]).indexOf(_allChilds[j]._id.toString()) >= 0) {
						childs.push(_allChilds[j])
					}

				}
				group[i].childs = childs
			}
		}
		if (group.length > 0) {
			signs = signs.concat(group)
		}
		var signIds = []
		for (var i = 0; i < signs.length; i++) {
			if (signs[i].profileMedia) {
				if (signs[i].profileMedia._id) {
					signs[i].profileMedia = signs[i].profileMedia._id
				}
			}
			if (signs[i].signType !== 'GROUP') {
				signIds.push(signs[i]._id)
			} else if (signs[i].signType === 'GROUP') {
				var childs = signs[i].childs
				for (var j = 0; j < childs.length; j++) {
					signIds.push(childs[j]._id)
				}
			}
		}
		let audience = params.audience
		let from = audience.from
		let to = audience.to
		var bookings = await (BookingServ.listBookings(signIds, from, to))
		var signMap = {}
		for (var i = 0; i < bookings.length; i++) {
			var booking = bookings[i]
			if (!signMap[booking.sign]) {
				signMap[booking.sign] = []
			}
			var bookedSlotArray = signMap[booking.sign]
			bookedSlotArray.push(booking.slotCode)
			signMap[booking.sign] = bookedSlotArray
		}
		_signs = []
		for (var i = 0; i < signs.length; i++) {
			var sign = signs[i]
			var _sign = JSON.stringify(sign)
			sign = JSON.parse(_sign)
			sign._totalPrice = 0
			var bookedSlotArray = []
			if (signMap[sign._id]) {
				bookedSlotArray = signMap[sign._id]
			}
			sign.availableSlots = sign.availableSlots - bookedSlotArray.length
			sign.ownSign = true
			if (sign.signType !== 'GROUP') {
				_signs.push(sign)
			} else if (sign.signType === 'GROUP') {
				let childSigns = []
				sign.availableSlots = 0
				sign._totalAvgViewersCount = 0
				sign._totalPrice = 0
				for (let j = 0; j < sign.childs.length; j++) {
					if (signMap[sign.childs[j]._id]) {
						bookedSlotArray = signMap[sign.childs[j]._id]
					}
					sign.childs[j].availableSlots = sign.childs[j].availableSlots - bookedSlotArray.length
					if (sign.childs[j].availableSlots > 0) {
						sign._totalPrice += sign.childs[j].pricePerSlot
						sign.availableSlots += (sign.childs[j].availableSlots * 1)
						if (!sign.childs[j].totalAvgViewersCount) {
							sign.childs[j].totalAvgViewersCount = 0
						}
						sign._totalAvgViewersCount += sign.childs[j].totalAvgViewersCount
						childSigns.push(sign.childs[j])
					}
				}
				sign.childs = []
				sign.childs = childSigns
				if (!sign.discountValue || sign.discountValue <= 0) {
					var _totalPrice = sign._totalPrice
				} else if (sign.discountValue > 0) {
					var discount = ((sign._totalPrice * sign.discountValue) / 100)
					var _totalPrice = sign._totalPrice - discount
				}
				sign._totalPrice = (Math.round(_totalPrice * 100) / 100).toFixed(2) * 1
				sign.totalPrice = sign._totalPrice
				sign.pricePerSlot = sign._totalPrice
				_signs.push(sign)
			}
		}
		return _signs
	} catch (err) {
		console.log(err)
	}

};

this.publish = id => {
	var promise = new Promise(async (resolve, reject) => {
		try {
			/*
			  Generate and upload MRSS xml to s3
			*/
			var mrss = await (CampaignServ.generateSignMRSS(id))
			await (CampaignServ.writeFile(id, 'mrss.xml', mrss))
			await (CampaignServ.uploadToS3(id, 'mrss.xml'))
			/*
			  Generate and upload JSON to s3
			*/
			var json = await (CampaignServ.generateSignJSON(id))
			var json = JSON.stringify(json)
			await (CampaignServ.writeFile(id, 'mrss.json', json))
			await (CampaignServ.uploadToS3(id, 'mrss.json'))
			var dsaAppPath = config.upload.path
			var signPath = path.join(dsaAppPath, 'sign')
			await (self.deleteAllFolderRecursive(signPath))
			let _json = JSON.parse(json)
			let updatedSign = await (self.updatePromise(id, {
				publishedTime: _json.publishedTime
			}))
			resolve(updatedSign)
		} catch (err) {
			reject(err)
		}
	});
	return promise;
}

this.deleteAllFolderRecursive = path => {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(file => {
			let curPath = path + '/' + file
			if (fs.lstatSync(curPath).isDirectory()) // recurse
				self.deleteAllFolderRecursive(curPath);
			else // delete file
				fs.unlinkSync(curPath);
		});
		fs.rmdirSync(path);
	}
};

this.updatePromise = (signId, sign) => {
	var _sign = JSON.stringify(sign)
	sign = JSON.parse(_sign)
	if (sign.slots)
		this.initSlots(sign)
	if (sign.createdAt)
		delete sign.createdAt
	var promise = new Promise((resolve, reject) => {
		return Sign.findOneAndUpdate({
			_id: signId
		}, {
			'$set': sign
		}, {
			new: true
		}, (err, sign) => {
			if (err) {
				return reject(err);
			} else if (sign === null) {
				return reject(new Error("Sign not exists!"));
			} else {
				let queue = [{
					signId: sign._id.toString(),
					time: new Date()
				}]
				QueueService.insetMany(queue);
				return resolve(sign);
			}
		});
	});
	return promise;
}

this.getMRSSXml = async (res, token, type) => {
	var fileName = 'mrss.xml'
	var _this = this
	if (type === 'json') {
		fileName = 'mrss.json'
	}
	try {
		var sign = await (Sign.findOne({
			token: token
		}))

		if (sign) {
			var signId = sign._id.toString()
			var key = path.join('sign', signId, fileName)

			var s3Obj = {
				Bucket: s3Service.bucket,
				Key: key
			}
			try {
				let url = await (s3.getSignedUrl('getObject', s3Obj))
				return res.send({
					url: url
				})
			} catch (err) {
				return res.status(400).send(error)
			}
		} else {
			res.status(400).send(new Error('invalid token'))
		}
	} catch (err) {

		console.log(err)
		res.status(400).send(new Error('invalid token'))
	};
};

this.getChildDetails = childIds => {
	let promise
	return promise = new Promise(async (rs, rj) => {
		try {
			let query = {
				_id: {
					'$in': childIds
				}
			}
			let projection = {
				orientation: 1,
				viewers: 1
			}
			let result = await (Sign.find(query, projection))
			return rs(result)
		} catch (err) {
			return rj(err)
		}
	})
}

this.getAllSignsForPagination = async (params, networkOwnerId) => {
	var promise = new Promise(async (resolve, reject) => {
		var skip = params.skip
		var limit = params.limit
		var searchText = params.searchText
		var _searchText = ''
		for (let k = 0; k < searchText.length; k++) {
			let _searchTextReplace = searchText[k]
			_searchTextReplace = _searchTextReplace.replace("\\", "\\\\")
			_searchTextReplace = _searchTextReplace.replace("*", "\\*")
			_searchTextReplace = _searchTextReplace.replace("(", "\\(")
			_searchTextReplace = _searchTextReplace.replace(")", "\\)")
			_searchTextReplace = _searchTextReplace.replace("+", "\\+")
			_searchTextReplace = _searchTextReplace.replace("[", "\\[")
			_searchTextReplace = _searchTextReplace.replace("|", "\\|")
			_searchTextReplace = _searchTextReplace.replace(",", "\\,")
			_searchTextReplace = _searchTextReplace.replace(".", "\\.")
			_searchTextReplace = _searchTextReplace.replace("?", "\\?")
			_searchTextReplace = _searchTextReplace.replace("^", "\\^")
			_searchTextReplace = _searchTextReplace.replace("$", "\\$")
			_searchText = _searchText.toString() + _searchTextReplace.toString()
		}
		searchText = _searchText
		var query = {
			$and: [{
				status: {
					$ne: "DELETED"
				},
				name: {
					'$regex': '.*' + searchText + '.*',
					$options: 'i'
				},
				networkOwnerId: networkOwnerId
			}]
		}
		try {
			var signs = await (Sign.find(query).sort('-updatedAt').lean())
			var dataLength = signs.length
			var _limit = skip + limit
			var _signs = signs.slice(0, _limit)
			var signs = _signs
			var groups = await (GroupSer.listAllGroups(query))
			dataLength = dataLength + groups.length
			signs = signs.concat(groups)
			var signs = arraySort(signs, 'updatedAt', {
				reverse: true
			})
			var data = {}
			data.count = dataLength
			var _limit = skip + limit
			var _signs = signs.slice(skip, _limit)
			for (let j = 0; j < _signs.length; j++) {
				if (_signs[j].signType === "SIGN") {
					_signs[j].group = await (GroupSer.getSignContainGroup(_signs[j]._id))
				}
			}
			data.signs = _signs
			return resolve(data)
		} catch (err) {
			return reject(err)
		}
	})
	return promise;
}

this.updateStatus = async (_id, status) => {
	var promise = new Promise(async (resolve, reject) => {
		try {
			var result = await (Sign.findOneAndUpdate({
				_id
			}, {
				'$set': {
					active: status
				}
			}, {
				new: true
			}).populate('childs'))
			if (result === null) {
				return reject(new Error("Listing not exists!"));
			} else {
				NetworkOwnerServ.getDashboardData(result.networkOwnerId)
				return resolve(result);
			}
		} catch (err) {
			return reject(err);
		}
	});
	return promise;
};

this.removeSignsFromGroup = function (_id, group) {
	var promise = new Promise(async (resolve, reject) => {
		try {
			var networkOwnerIds = []
			var notifications = []
			for (var i = 0; i < group.childs.length; i++) {
				if (group.networkOwnerId !== group.childs[i].networkOwnerId) {
					if (networkOwnerIds.indexOf(group.childs[i].networkOwnerId) <= -1) {
						var _signs = []
						_signs.push(group.childs[i])
						var notification = {
							type: "CHILDS_REMOVED_FROM_GROUP",
							status: "REMOVED_FROM_GROUP",
							isRead: false,
							networkOwner: group.childs[i].networkOwnerId,
							childs: _signs,
							sign: group
						}
						networkOwnerIds.push(group.childs[i].networkOwnerId)
						notifications.push(notification)
					} else if (networkOwnerIds.indexOf(group.childs[i].networkOwnerId) > -1) {
						for (var j = 0; j < notifications.length; j++) {
							if (group.childs[i].networkOwnerId.toString() === notifications[j].networkOwner.toString()) {
								var _signs = notifications[j].childs
								if (_signs.indexOf(group.childs[i]) <= -1) {
									_signs.push(group.childs[i])
								}
								notifications[j].childs = []
								notifications[j].childs = _signs
								break;
							}
						}
					}
				}
			}
			for (var i = 0; i < notifications.length; i++) {
				var notification = notifications[i]
				await (NetworkOwnerNotificationService.create(notification))
				NotificationServ.sendNotificationMailToNetworkOwner(notification)
				var networkOwnerId = notification.networkOwner
				NetworkOwnerNotificationService.notifyCount(networkOwnerId, {
					networkOwner: networkOwnerId,
					isRead: false
				})
			}
			var result = await (Group.findOneAndUpdate({
				_id
			}, {
				'$set': {
					childs: []
				}
			}, {
				new: true
			}))
			if (result === null) {
				return reject(new Error("Group not exists!"));
			} else {
				return resolve(result);
			}
		} catch (err) {
			return reject(err);
		}
	});
	return promise;
};

this.removeListingFromGroup = async (_id, group, removedSignId) => {
	var promise = new Promise(async (resolve, reject) => {
		if (!group._id) {
			return reject('Group required.')
		}
		var _group = JSON.stringify(group)
		group = JSON.parse(_group)
		delete group.createdAt;
		var result = await (GroupSer.updateGroup(group._id, group))
		if (result === null) {
			return reject(new Error("Group not exists!"));
		} else {
			if (result.groupType === 'PRIVATE') {
				var queue = [{
					signId: removedSignId.toString(),
					time: new Date()
				}]
				QueueService.insetMany(queue);
			}
			return resolve(result);
		}
	});
	return promise;
};

this.delete = async (id, user, signType, res) => {
	deleteFolderRecursive = this.deleteFolderRecursive
	var promise = new Promise(async (resolve, reject) => {
		var signQuery = {
			signs: {
				"$in": [id]
			}
		}
		if (signType === "GROUP") {
			var signtemp = await (GroupSer.findOne({
				_id: id
			}))
		} else {
			var signtemp = await (Sign.findOne({
				_id: id
			}))
		}
		if (signtemp.signType === 'SIGN') {
			var paymentResult = await (CampaignServ.findoneBySignId(id))
			if (paymentResult.length > 0) {
				var message = []
				if (paymentResult.length === 1) {
					message.push('Listing already using in following campaign')
				} else {
					message.push('Listing already using in following campaigns')
				}
				for (var i = paymentResult.length - 1; i >= 0; i--) {
					if (message.length === 1) {
						message[0] = message[0] + ' - ' + paymentResult[i].name

					} else {
						message.push(paymentResult[i].name)
					}
				}
				var err = {
					code: 'ForeignKeyException',
					message: message,
					type: signtemp.signType
				};
				return reject(err)
			}

		}
		var campaigns = await (CampaignServ.find(signQuery))
		var message = []
		if (signtemp.signType === "SIGN") {
			if (campaigns.length < 2) {
				message.push('Listing already using in following campaign')
			} else {
				message.push('Listing already using in following campaigns')
			}
		} else if (signtemp.signType === "GROUP") {
			if (campaigns.length < 2) {
				message.push('Group already using in following campaign')
			} else {
				message.push('Groups already using in following campaigns')
			}
		}

		if (campaigns && campaigns.length > 0) {
			for (var idx = 0; idx < campaigns.length; idx++) {
				// message.push(campaigns[idx].name)
				if (message.length === 1) {
					message[0] = message[0] + ' - ' + campaigns[idx].name
				} else {
					message.push(campaigns[idx].name)
				}
			}
			var err = {
				code: 'ForeignKeyException',
				message: message,
				type: signtemp.signType
			};
			return reject(err)
		} else {
			var query = {
				_id: id,
				networkOwnerId: user.networkOwnerId
			};
			if (signtemp.signType === "SIGN") {
				var _sign = await (self.findOne({
					_id: id
				}))
				if (_sign.claimId) {
					var sign = await (Sign.findOneAndUpdate(query, {
						'$set': {
							status: "DELETED",
							claimId: null,
							ownMedia: [],
							unsoldMedia: [],
							profileMedia: null,
							networkOwnerId: null,
							active: false
						}
					}, {
						new: true
					}))
				} else {
					var sign = await (Sign.findOneAndUpdate(query, {
						'$set': {
							status: "DELETED",
							ownMedia: [],
							unsoldMedia: [],
							profileMedia: null
						}
					}, {
						new: true
					}))
				}
				if (sign === null) {
					return reject(new Error("Listing not exists!"));
				} else {
					res.send(sign)
					res.end()
					var folderPath = path.join(config.upload.path, 'sign', sign._id.toString());
					await (deleteFolderRecursive(folderPath));
					var query = {
						childsDetails: {
							'$in': [id]
						}
					}
					var group = await (GroupSer.find(query))
					for (var i = 0; i < group.length; i++) {
						for (var j = 0; j < group[i].childs.length; j++) {
							if (group[i].childs[j]._id.toString() === id.toString()) {
								group[i].childs.splice(j, 1)
							}
							if (group[i].childsDetails[j].toString() === id.toString()) {
								group[i].childsDetails.splice(j, 1)
							}
						}
						await (GroupSer.updateGroup(group[i]._id, group[i]))
					}
					var queue = [{
						signId: sign._id.toString(),
						time: new Date()
					}]
					QueueService.insetMany(queue);
				}
			} else if (signtemp.signType === "GROUP") {
				var sign = await (GroupSer.deleteGroup(query))
				if (sign === null) {
					return reject(new Error("Group not exists!"));
				} else {
					res.send(sign)
					res.end()
					var folderPath = path.join(config.upload.path, 'sign', sign._id.toString());
					await (deleteFolderRecursive(folderPath));
					if (sign.signType === 'GROUP') {
						if (sign.groupType === 'PRIVATE') {
							if (sign.childs) {
								var childs = sign.childs
								var queue = []
								for (var j = 0; j < childs.length; j++) {
									var q = {
										signId: childs[j]._id.toString(),
										time: new Date()
									}
									queue.push(q)
								}
								QueueService.insetMany(queue);
							}
						}
					}
				}
			}
		}
	});
	return promise;
};

this.deleteFolderRecursive = function (path) {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function (file, index) {
			var curPath = path + "/" + file;
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else {
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};

this.updateHiddenStatus = async (_id, hiddenStatus) => {
	var promise = new Promise(async (resolve, reject) => {
		try {
			var result = await (Sign.findOneAndUpdate({
				_id
			}, {
				'$set': {
					isHidden: hiddenStatus
				}
			}, {
				new: true
			}).populate('childs'))
			if (result === null) {
				return reject(new Error("Listing not exists!"));
			} else {
				return resolve(result);
			}
		} catch (err) {
			return reject(err);
		}
	});
	return promise;
};

this.validateListing = listing => {
	if (!listing.name)
		return "Name required."
	if (!listing.signType)
		return "Screen type required."
	if (!listing.claimable && listing.claimId)
		return "Content display method required."
	if (listing.claimable && !listing.claimId)
		return "Claim id required."
	return false
}

this.initSlots = sign => {
	/*
	 * Init avaliable slot for public
	 * Here we creating an array may be used later
	 * User may need to rename slot name etc
	 */
	sign._slots = []
	if (!sign.availableSlots)
		sign.availableSlots = 0
	var availableSlots = sign.availableSlots
	for (var i = 1; i <= availableSlots; i++) {
		var _slot = {
			code: i,
			name: i
		}
		sign._slots.push(_slot)
	}
	/*
	 * Init own slot for public
	 * Here we creating an array may be used later
	 * User may need to rename slot name etc
	 */
	sign.ownSlots = []
	if (!sign.slots)
		sign.slots = 0
	var totalSlots = sign.slots
	var ownSlots = totalSlots - availableSlots
	for (var i = 1; i <= ownSlots; i++) {
		var _slot = {
			code: i,
			name: i
		}
		sign.ownSlots.push(_slot)
	}
}

this.validate = sign => {
	if (!sign.name)
		return 'Name required.'
	if (sign.name.length > 200)
		return 'Name should be less than or equal to 200 characters.'
	if (sign.description) {
		var _description = sign.description ? sign.description.split(/\s+/) : 0;
		if ((_description ? _description.length : '') > 150)
			return 'Description should be less than or equal to 150 words.'
	}
	if (!sign.signType)
		return 'Sign type required.'
	if (sign.signType !== 'SIGN')
		return 'Sign type should be sign.'
	if (!sign.screenType)
		return 'Screen type required.'
	if (sign.screenType !== 'Outdoor' && sign.screenType !== 'Indoor' && sign.screenType !== 'Mobile')
		return 'Screen type should be outdoor or indoor or mobile'
	if (sign.screenType === 'Outdoor') {
		if (!sign.width)
			return 'Width required.'
		if (!sign.height)
			return 'Height required.'
		if (!sign.sizeUnit)
			return 'Size unit required ex.feet.'
		if (sign.sizeUnit !== 'feet')
			return 'Size unit should be feet.'
		if (sign.width < 0)
			return 'Width should be positive.'
		if (sign.height < 0)
			return 'Height should be positive.'
	}
	if (sign.screenType === 'Indoor') {
		if (!sign.dimension)
			return 'Dimension required.'
		if (sign.dimension <= 0 || sign.dimension > 70)
			return 'Dimension should be 1 to 70.'
		if (!sign.dimensionUnit)
			return 'Dimension unit required.'
		if (sign.dimensionUnit !== 'inches')
			return 'Dimension unit should be inches.'
	}
	if (sign.screenType === 'Mobile') {
		if (!sign.dimension)
			return 'Dimension required.'
		if (sign.dimension <= 0 || sign.dimension > 30)
			return 'Dimension should be 1 to 30.'
		if (!sign.dimensionUnit)
			return 'Dimension unit required.'
		if (sign.dimensionUnit !== 'inches')
			return 'Dimension unit should be inches.'
	}
	if (!sign.orientation)
		return 'Orientation required.'
	if (sign.orientation !== 'Portrait' && sign.orientation !== 'Landscape')
		return 'Orientation should be portrait or landscape.'
	if (sign.orientation === 'Portrait' && sign.height < sign.width)
		return 'In portrait mode the height should be greater than or equal to width.'
	if (sign.orientation === 'Landscape' && sign.height > sign.width)
		return 'In landscape mode the width should be greater than or equal to height.'
	if (!sign.slots)
		return 'Slots required.'
	if (sign.slots <= 0)
		return 'Slots should be positive.'
	if (sign.slots > 86400)
		return 'Slots should be less than or equal to 86400.'
	if (sign.availableSlots === undefined)
		return 'Available slots required.'
	if (sign.availableSlots < 0)
		return 'Available slots should be positive.'
	if (!sign._id && sign.availableSlots > sign.slots)
		return 'Total slots should be greater than or equal to public slots.'
	if (sign._id && sign.availableSlots > sign.slots)
		return 'Total slots should be greater than or equal to public slots.'
	if (sign._id && (sign.slots - sign.availableSlots) < (sign.ownMedia.length / 2)) {
		let count = (sign.slots - sign.availableSlots) - (sign.ownMedia.length / 2)
		count = Math.abs(count) * 2
		return `Please remove the ${count} excess own media.`
	}
	// if (sign.availableSlots != sign._slots.length)
	//   return 'Available slots array not matched.'
	// if ((sign.slots - sign.availableSlots) != sign.ownSlots.length)
	//   return 'Own slots array not matched.'
	if (!sign.holdTime)
		return 'Hold time required.'
	if (sign.holdTime <= 0 || sign.holdTime > 60)
		return 'Hold time should be 1 to 60.'
	if (!sign.holdTimeUnit)
		return 'Hold time Unit required.'
	if (sign.holdTimeUnit !== 'sec' && sign.holdTimeUnit !== 'min')
		return 'Hold time Unit should be sec or min.'
	if (sign.pricePerSlot < 0)
		return 'Price per slot required.'
	if (!sign.currency)
		return 'Currency required.'
	if (sign.currency !== 'USD')
		return 'Currency should be USD.'
	if (!sign.slotPeriod)
		return 'Slot period required.'
	if (sign.slotPeriod !== 'perWeek' && sign.slotPeriod !== 'perMonth')

		if (!config.NATURE && config.NATURE !== 'SCHOOL')
			return 'Slot period should be per week or per month.'
	else if (sign.slotPeriod !== 'perYear')
		return 'Slot period should be per week or per month or per year.'

	if (sign.viewers.length <= 0) {
		return 'Viewers should be walking or driving or train.'
	}
	if (sign.viewers.length > 0) {
		for (var i = 0; i < sign.viewers.length; i++) {
			if (sign.viewers[i] !== 'Walking' && sign.viewers[i] !== 'Driving' && sign.viewers[i] !== 'Train')
				return 'Viewers should be walking or driving or train.'
		}
	}
	if (sign.viewers.length > 0) {
		for (var i = 0; i < sign.viewers.length; i++) {
			if (sign.viewers[i] === 'Walking')
				if (!sign.avgViewersCountWalking)
					return 'Average viewers count for walking required.'
			if (sign.viewers[i] === 'Driving')
				if (!sign.avgViewersCountDriving)
					return 'Average viewers count for driving required.'
			if (sign.viewers[i] === 'Train')
				if (!sign.avgViewersCountTrain)
					return 'Average viewers count for train required.'
		}
	}
	if (sign.avgViewersCountDriving && sign.avgViewersCountDriving < 1)
		return 'Average viewers count for driving required.'
	if (sign.avgViewersCountDriving && sign.avgViewersCountDriving > 10000000)
		return 'Average viewers count for driving should be less than or equal to 10000000.'
	if (sign.avgViewersCountWalking && sign.avgViewersCountWalking < 1)
		return 'Average viewers count for walking required.'
	if (sign.avgViewersCountWalking && sign.avgViewersCountWalking > 10000000)
		return 'Average viewers count for walking should be less than or equal to 10000000.'
	if (sign.avgViewersCountTrain && sign.avgViewersCountTrain < 1)
		return 'Average viewers count for train required.'
	if (sign.avgViewersCountTrain && sign.avgViewersCountTrain > 10000000)
		return 'Average viewers count for train should be less than or equal to 10000000.'
	if (sign.totalAvgViewersCount && sign.totalAvgViewersCount < 1)
		return 'Total average viewers count required.'
	if (sign.establishmentType) {
		if (sign.establishmentType !== 'Retail' && sign.establishmentType !== 'Restaurant' && sign.establishmentType !== 'Hospitality' && sign.establishmentType !== 'Medical' && sign.establishmentType !== 'Education' && sign.establishmentType !== 'Entertainment' && sign.establishmentType !== 'Other') {
			return 'Establishment type should be retail or restaurant or hospitality or medical or education or entertainment or other.'
		}
	}
	if (sign.operatingHours) {
		if (!sign.operatingHours.from || !sign.operatingHours.to)
			return 'Please enter the valid time.'
	}
	if (sign.active === undefined)
		return 'Status required.'
	if (sign.establishmentName && sign.establishmentName.length > 50)
		return 'Establishment name should be less than or equal to 50 characters.'
	if (sign.streetAddress1 && sign.streetAddress1.length > 30)
		return 'Street address 1 should be less than or equal to 30 characters.'
	if (sign.streetAddress2 && sign.streetAddress2.length > 30)
		return 'Street address 2 should be less than or equal to 30 characters.'
	if (sign.city && /\d/.test(sign.city) || (/^[a-zA-Z0-9- ]*$/.test(sign.city)) === false) {
		return "Please enter the valid city."
	}
	if (sign.city && sign.city.length > 25)
		return 'City name should be less than or equal to 25 characters.'
	if (sign.state && /\d/.test(sign.state) || (/^[a-zA-Z0-9- ]*$/.test(sign.state)) === false) {
		return "Please enter the valid state."
	}
	if (sign.state && sign.state.length > 20)
		return 'State name should be less than or equal to 20 characters.'
	// if (sign.country && /\d/.test(sign.country) || (/^[a-zA-Z0-9- ]*$/.test(sign.country)) === false) {
	//   return "Please enter the valid country."
	// }
	if (sign.postalCode && (/^[a-zA-Z0-9- ]*$/.test(sign.postalCode)) === false)
		return 'Please enter the valid zip code'
	if (sign.postalCode && sign.postalCode.length > 10)
		return 'Zip code should be less than or equal to 10 characters.'
	if (sign.unsoldMedia && sign.unsoldMedia.length > 1) {
		return "Please select only one media for promotional media content."
	}
	// if (!sign.timeZone || sign.timeZone === '')
	// 	return 'Please select the timezone'
	var ownSlots = sign.slots - sign.availableSlots
	var allowedSlotMedia = ownSlots * 2
	if (sign.ownMedia && sign.ownMedia.length > allowedSlotMedia)
		return "You have reached maximum media per slot."
	return false
}

// this.updatePromise = (signId, sign) => {
//   var _sign = JSON.stringify(sign)
//   sign = JSON.parse(_sign)
//   if (sign.createdAt)
//     delete sign.createdAt
//   var promise = new Promise((resolve, reject) => {
//     return Sign.findOneAndUpdate({ _id: signId }, { '$set': sign }, { new: true }, (err, sign) => {
//       if (err) {
//         return reject(err);
//       } else if (sign === null) {
//         return reject(new Error("Sign not exists!"));
//       } else {
//         return resolve(sign);
//       }
//     });
//   });
//   return promise;
// }

this.create = async (sign, locationNames, email, res, req) => {
	this.initSlots(sign)
	var locationMap = {}
	var _locationNames = []
	var message = this.validate(sign)
	return new Promise(async (resolve, reject) => {
		try {
			if (locationNames && locationNames.length > 0) {
				for (var i = 0; i < locationNames.length; i++) {
					if (!locationMap[locationNames[i].text]) {
						if (locationNames[i].text.length > 30) {
							return reject('Location name should be less than or equal to 30 characters.')
						}
						_locationNames.push(locationNames[i])
						locationMap[locationNames[i].text] = locationNames[i].text
					}
				}
			}
			if (message) {
				return reject(message);
			}
			if (sign.country) {
				var isValidCountry = await (Country.findOne({
					name: sign.country
				}))
				if (!isValidCountry) {
					return reject('Please select the country from given country name.');
				}
			}
			sign.token = uniqid.time().toUpperCase()
			if (sign.claimable === 'true') {
				var existSign = await (self.findOne({
					claimId: sign.claimId
				}))
				if (!existSign) {
					return reject('Invalid claim id.')
				}
				if (existSign && !existSign.networkOwnerId) {
					var existSignId = existSign._id
					if (_locationNames && _locationNames.length > 0) {
						sign._location = []
						var _locations = await (LocationServ.create(_locationNames))
						for (var i = 0; i < _locations.length; i++) {
							sign._location.push(_locations[i])
						}
					}
					existSign.token = sign.token // Have to implement the claim options
					await (self.emitEventForSingleDevice(existSign.mac, existSign.info.lanmac, "CLAIM", {
						claimId: claimId,
						token: existSign.token,
						email: email
					}))
					sign.status = 'CLAIMED'
					sign.active = true
					var systemMedia = await (NetworkOwnerMedia.find({
						type: "SYSTEM"
					}))
					sign.unsoldMedia = systemMedia[0]
					var _sign = await (self.updatePromise(existSignId, sign))

					if (res) {
						res.send(_sign)
						res.end()
					}
					var queue = [{
						signId: _sign._id.toString(),
						time: new Date()
					}]
					QueueService.insetMany(queue);
					await (NetworkOwnerServ.getDashboardData(_sign.networkOwnerId))
				} else if (sign.networkOwnerId.toString() === existSign.networkOwnerId.toString()) {
					var existSignId = existSign._id
					if (_locationNames && _locationNames.length > 0) {
						sign._location = []
						var _locations = await (LocationServ.create(_locationNames))
						for (var i = 0; i < _locations.length; i++) {
							sign._location.push(_locations[i])
						}
					}
					existSign.token = sign.token
					await (self.emitEventForSingleDevice(existSign.mac, existSign.info.lanmac, "CLAIM", {
						claimId: claimId,
						token: existSign.token,
						email: email
					}))
					sign.status = 'CLAIMED'
					sign.active = true
					sign.unsoldMedia = existSign.unsoldMedia
					sign.ownMedia = []
					for (var i = 0; i < existSign.ownMedia.length; i++) {
						if (existSign.ownMedia[i].type !== "SYSTEM") {
							sign.ownMedia.push(existSign.ownMedia[i])
						}
					}
					var _sign = await (self.updatePromise(existSignId, sign))
					if (req)
						req.session.newListing = null;
					if (res) {
						res.send(_sign)
						res.end()
					}
					var queue = [{
						signId: _sign._id.toString(),
						time: new Date()
					}]
					QueueService.insetMany(queue);
					await (NetworkOwnerServ.getDashboardData(_sign.networkOwnerId))
				} else if (existSign && sign.networkOwnerId.toString() !== existSign.networkOwnerId.toString()) {
					return reject('This device already claimed by another network owner.')
				}
			} else {
				if (_locationNames && _locationNames.length > 0) {
					try {
						var locations = await (LocationServ.create(_locationNames))
						sign._location = []
						for (var i = 0; i < locations.length; i++) {
							sign._location.push(locations[i])
						}
					} catch (err) {
						reject(err)
					}
				}
				var systemMedia = await (NetworkOwnerMedia.find({
					type: "SYSTEM"
				}))
				sign.unsoldMedia = systemMedia[0]
				var counterData = await (Counters.find({
					type: "sign"
				}))
				var count;
				if (counterData === null || counterData.length <= 0) {
					count = 100000;
				} else {
					count = counterData[0].serialNumber + 1;
				}
				sign.serialNumber = count;
				if (sign.slotPeriod === 'perMonth') {
					sign.pricePerSlot = (sign.pricePerSlot * 7) / 30;
				}
				if (sign.slotPeriod === 'perYear') {
					sign.pricePerSlot = (sign.pricePerSlot * 7) / 365;
				}
				var _sign = JSON.parse(JSON.stringify(await (Sign.createAsync(sign))))
				if (sign.childs && sign.childs.length > 0) {
					sign._id = _sign._id
					let childs = await (this.addAndRemoveSignFromGroup(sign._id, sign, 'CREATED'))
					_sign.childs = []
					_sign.childs = childs
				}
				if (req)
					req.session.newListing = null;
				if (res) {
					res.send(_sign)
					res.end()
				}
				await (self.counterUpdate(count))
				var queue = [{
					signId: _sign._id.toString(),
					time: new Date()
				}]
				QueueService.insetMany(queue);
				if (_sign.networkOwnerId) {
					await (NetworkOwnerServ.getDashboardData(_sign.networkOwnerId))
				}
				if (!res) {
					return resolve(_sign)
				}
			}
		} catch (err) {
			reject(err)
		}
	});
};

this.counterUpdate = async count => {
	var query = {
		type: 'sign'
	};
	try {
		var counter = await (Counters.findOneAndUpdate(query, {
			'$set': {
				serialNumber: count
			}
		}, {
			new: true
		}))
		if (counter === null || counter.length <= 0) {
			await (Counters.createAsync({
				type: 'sign',
				serialNumber: 1000000
			}))
			return
		} else {
			return
		}
	} catch (err) {
		return err
	}
}

this.addSignToGroup = (groups, sign, signId) => {
	var promise = new Promise(async (resolve, reject) => {
		if (sign.slotPeriod === "perMonth") {
			sign.pricePerSlot = (sign.pricePerSlot / 30) * 7
		} else if (sign.slotPeriod === "perYear") {
			sign.pricePerSlot = (sign.pricePerSlot / 365) * 7
		}
		try {
			for (var i = 0; i < groups.length; i++) {
				var group = groups[i]
				var _group = JSON.stringify(group)
				group = JSON.parse(_group)
				delete group.createdAt;
				sign._id = signId
				for (let index = 0; index < group.childs.length; index++) {
					if (group.childs[index]._id.toString() === signId.toString()) {
						group.childs.splice(index, 1)
						break
					}
				}
				group.childs.push(sign)
				var result = await (GroupSer.updateGroup(group._id, group))
			}
			var queue = [{
				signId: signId.toString(),
				time: new Date()
			}]
			QueueService.insetMany(queue);
			return resolve(groups);
		} catch (err) {
			return reject(err)
		}
	});
	return promise;
};

this.insertDataIntoBookingAndPayment = async (sign, group) => {
	try {
		var date = new Date()
		var query = {
			$and: [{
					group: group._id
				},
				// {
				//   from:{
				//     $lte:date
				//   }
				// },
				{
					to: {
						$gte: date
					}
				}
			]
		}
		var sign = await (self.findOne({
			_id: sign
		}))
		var bookings = await (BookingServ.find(query)).sort({
			createdAt: -1
		})
		var campaigns = {}
		var notNeededcampaigns = {}
		for (let i = 0; i < bookings.length; i++) {
			if (!campaigns[bookings[i].campaign.toString()]) {
				campaigns[bookings[i].campaign.toString()] = bookings[i].campaign.toString()
			}
			if (bookings[i].sign.toString() === sign._id.toString()) {
				notNeededcampaigns[bookings[i].campaign.toString()] = bookings[i].campaign.toString()
			}
		}
		var addedCampaign = {}
		var sortedCampaign = []
		for (var key in campaigns) {
			if (!notNeededcampaigns[key]) {
				sortedCampaign.push(campaigns[key])
			}
		}
		var sortedCampaignJson = {}
		var _sortedCampaign = await (CampaignServ.findQuery({
			_id: {
				$in: sortedCampaign
			}
		}))
		for (let z = _sortedCampaign.length - 1; z >= 0; z--) {
			sortedCampaignJson[_sortedCampaign[z]._id.toString()] = _sortedCampaign[z]._id.toString()

		}
		for (var key in sortedCampaignJson) {
			if (!notNeededcampaigns[key]) {
				for (let i = 0; i < bookings.length; i++) {
					if ((campaigns[bookings[i].campaign.toString()] === campaigns[key]) && !addedCampaign[bookings[i].campaign.toString()]) {
						addedCampaign[bookings[i].campaign.toString()] = bookings[i].campaign.toString()

						var query = {
							$or: [
								// {
								//   '$and': [
								//       { sign : sign._id },
								//       { to: { "$lte": bookings[i].to} },
								//       { from: { "$gte":  bookings[i].from } }
								//     ]
								// },
								{
									'$and': [{
											sign: sign._id
										},
										{
											to: {
												"$gte": bookings[i].from
											}
										},
										{
											from: {
												"$lte": bookings[i].from
											}
										}
									]
								},
								{
									'$and': [{
											sign: sign._id
										},
										{
											to: {
												"$gte": bookings[i].to
											}
										},
										{
											from: {
												"$lte": bookings[i].to
											}
										}
									]
								},
								{
									'$and': [{
											sign: sign._id
										},
										{
											to: {
												"$gte": bookings[i].to
											}
										},
										{
											from: {
												"$lte": bookings[i].from
											}
										}
									]
								}
							]
						}
						var _bookings = await (BookingServ.listBookingsByQuery(query))
						var nSlot = null
						var bookingSlot = []
						for (let k = 0; k < _bookings.length; k++) {
							bookingSlot.push(_bookings[k].slotCode)
						}
						var isSlotsAvailableSlot = 0
						if (bookingSlot.length < sign.availableSlots) {
							if (bookingSlot.length > 0) {
								for (let j = 0; j < sign._slots.length; j++) {
									if (bookingSlot.indexOf(sign._slots[j].code) <= -1) {
										nSlot = sign._slots[j].code
										isSlotsAvailableSlot = 1
										break;
									}
								}
								// if ((isSlotsAvailableSlot === 0) || sign.availableSlots <= 0 ) {
								//   return
								// }
							} else if (sign.availableSlots >= 1) {
								nSlot = 1;
								isSlotsAvailableSlot = 1
							} else {
								isSlotsAvailableSlot = 0
								// return
							}
						} else {
							return
						}
						if (isSlotsAvailableSlot === 1) {
							var _campaign = await (CampaignServ.findQuery({
								_id: bookings[i].campaign
							}))
							var campaign = _campaign[0]
							let bookingFrom = `${campaign.budget.bookingFrom}T00:00:00${sign.offset}`;
							let bookingFromUTC = moment(bookingFrom).tz(sign.timeZone)
							bookingFromUTC.hours(0)
							bookingFromUTC.minutes(0)
							bookingFromUTC.seconds(0)
							bookingFromUTC = bookingFromUTC.utc().format();
							let bookingTo = `${campaign.budget.bookingTo}T23:59:59${sign.offset}`;
							let bookingToUTC = moment(bookingTo).tz(sign.timeZone)
							bookingToUTC = bookingToUTC.utc().format();
							var booking = {
								campaign: bookings[i].campaign,
								sign: sign._id,
								slotCode: nSlot,
								from: bookingFromUTC,
								to: bookingToUTC,
								paymentType: 'GROUP_PAYMENT',
								bookingByGroup: true,
								group: group._id
							}
							var paymentStatus = {
								paymentType: "NORMAL_PAYMENT",
								sign: sign._id,
								paid: 0,
								bookingByGroup: true,
								bookingStatus: "BOOKED"
							}
							var mediaMap = {}
							var mediaArray = []
							for (let l = 0; l < campaign.campaignStatus.length; l++) {
								if (!mediaMap[campaign.campaignStatus[l].media] && ((campaign.campaignStatus[l].status === "APPROVED") || (campaign.campaignStatus[l].status === "PENDING") || (campaign.campaignStatus[l].status === "RESUBMITTED"))) {
									mediaMap[campaign.campaignStatus[l].media] = campaign.campaignStatus[l].media.toString()
									mediaArray.push(campaign.campaignStatus[l].media)
								}
							}
							if (mediaArray.length > 2) {
								var mediaLength = 2
							} else {
								var mediaLength = mediaArray.length
							}
							for (let m = 0; m < mediaLength; m++) {
								var campaignStatus = {
									status: 'APPROVED',
									sign: sign._id,
									media: mediaArray[m],
									bookingByGroup: true,
									statusChangingDate: new Date(),
									publishedDate: new Date()
								}
								campaign.campaignStatus.push(campaignStatus)
							}
							campaign.paymentStatus.push(paymentStatus)
							var paymentsummary = {
								signType: sign.signType,
								totalSlot: sign.availableSlots,
								signId: sign._id,
								_group: group._id,
								signName: sign.name,
								networkOwnerId: sign.networkOwnerId,
								advertiserId: campaign.advertiserId,
								campaignName: campaign.name,
								campaignStartDate: campaign.budget.from,
								campaignEndDate: campaign.budget.to,
								amountPaid: 0,
								DSARevenue: 0,
								amountRecived: 0,
								bookingByGroup: true
							}
							await (BookingServ.create(booking))
							var campaign = await (CampaignServ.update(campaign._id, campaign))
							await (PaymentSummary.createAsync(paymentsummary))
							for (let m = 0; m < mediaArray.length; m++) {
								var notification = {
									type: 'MEDIA',
									status: 'PENDING',
									isRead: false,
									sign: sign,
									media: mediaArray[m],
									campaign: campaign._id,
									networkOwner: sign.networkOwnerId,
									advertiser: campaign.advertiserId,
									bookingByGroup: true,
									paymentType: "GROUP_PAYMENT"
								}
								// console.log(notification)
								await (NetworkOwnerNotificationService.create(notification))
							}
							// var
							// await(self.publish(sign._id.toString()))
							var queue = [{
								signId: sign._id.toString(),
								time: new Date()
							}]
							QueueService.insetMany(queue);
						}
					}
				}
			}
		}
		return
	} catch (e) {
		return e
	}
}

this.updateSign = (_id, sign, locationNames, res) => {
	this.initSlots(sign)
	var locationMap = {}
	var _locationNames = []
	if (sign.unsoldMedia.length > 1) {
		sign.unsoldMedia = sign.unsoldMedia[sign.unsoldMedia.length - 1]
	}
	var promise = new Promise(async (resolve, reject) => {
		if (!sign._id)
			return reject('Listing required.')
		var message = await (this.validate(sign))
		if (message)
			return reject(message);
		if (sign.country) {
			var isValidCountry = await (Country.findOne({
				name: sign.country
			}))
			if (!isValidCountry)
				return reject('Please select the country from given country name.');
		}
		if (sign.slotPeriod === "perMonth")
			sign.pricePerSlot = sign.pricePerSlot * 7 / 30
		if (sign.slotPeriod === "perYear")
			sign.pricePerSlot = sign.pricePerSlot * 7 / 365
		if (locationNames && locationNames.length > 0) {
			for (var i = 0; i < locationNames.length; i++) {
				if (!locationMap[locationNames[i].text]) {
					if (locationNames[i].text.length > 30) {
						return reject('Location name should be less than or equal to 30 characters.')
					}
					_locationNames.push(locationNames[i])
					locationMap[locationNames[i].text] = locationNames[i].text
				}
			}
			sign._location = []
			var _locations = await (LocationServ.create(_locationNames))
			for (var i = 0; i < _locations.length; i++) {
				sign._location.push(_locations[i])
			}
		} else {
			sign._location = []
		}
		// if (sign.slotPeriod === "perMonth"){
		//   sign.pricePerSlot =  ((sign.pricePerSlot * 7) /30)
		// }
		delete sign.createdAt;
		delete sign.serialNumber;
		var result = await (Sign.findOneAndUpdate({
			_id
		}, {
			'$set': sign
		}, {
			new: true
		}).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').populate('childs'))
		// await (GroupSer.updateGroupForSignUpdate(result._id, result))
		let childs = await (this.addAndRemoveSignFromGroup(result._id, sign, 'UPDATE'))
		result.childs = childs
		if (result === null) {
			return reject(new Error("Listing not exists!"));
		} else {
			if (res) {
				res.send(result)
				res.end()
			}
			var queue = [{
				signId: result._id.toString(),
				time: new Date()
			}]
			QueueService.insetMany(queue);
			if (!res)
				return resolve(result);
		}
	});
	return promise;
};

this.addAndRemoveSignFromGroup = async (signId, sign, condition) => {
	try {
		let query = {
			"childs._id": {
				"$in": [mongoose.Types.ObjectId(signId)]
			},
		}
		let groups = []
		if (condition === 'UPDATE') {
			groups = JSON.parse(JSON.stringify(await (GroupSer.findWithChilds(query))));
		}
		let addedGroupMap = {}
		let newGroupMap = {}
		let removeGroup = []
		let addGroup = []
		if (!sign.childs) {
			for (let j = 0; j < sign.childs.length; j++) {
				let group = sign.childs[j];
				newGroupMap[group._id.toString()] = group._id.toString()
				addGroup.push(group._id.toString())
			}
		}
		if (groups && groups.length > 0) {
			for (let i = 0; i < groups.length; i++) {
				let group = groups[i];
				if (!newGroupMap[group._id.toString()]) {
					removeGroup.push(group)
				}
			}
		}
		if (removeGroup.length > 0) {
			for (let k = 0; k < removeGroup.length; k++) {
				for (let l = 0; l < removeGroup[k].childs.length; l++) {
					let child = removeGroup[k].childs[l];
					if (child._id.toString() === sign._id.toString()) {
						removeGroup[k].childs.splice(l, 1)
						removeGroup[k].childsDetails.splice(l, 1)
					}
				}
				await (GroupSer.updateGroup(removeGroup[k]._id, removeGroup[k]))
			}
		}
		let result = []
		if (addGroup.length > 0) {
			result = await (GroupSer.addOrUpdateGroupWithSigns(addGroup, sign))
		}
		return result
	} catch (err) {
		console.log("err---------------")
		console.log(err)
		return err
	}
}

this.updateGroupProfile = (_id, sign) => {
	this.initSlots(sign)
	var promise = new Promise(async (resolve, reject) => {
		if (!sign._id)
			return reject('Listing required.')
		delete sign.createdAt
		delete sign.serialNumber
		var result = await (GroupSer.updateGroup(_id, sign))
		if (result === null)
			return reject(new Error("Group not exists!"));
		else
			return resolve(result);
	});
	return promise;
};

this.updateGroup = (_id, group) => {
	var promise = new Promise(async (resolve, reject) => {
		try {
			if (!group._id) {
				return reject('Group required.')
			}
			var message = await (this.validateGroup(group, _id))
			var result;
			if (message) {
				return reject(message);
			}

			result = await (GroupSer.findOne({
				_id
			}));
			if (result.groupType === 'PUBLIC' && group.groupType === "PRIVATE") {
				for (var i = 0; i < group.childs.length; i++) {
					if (group.networkOwnerId !== group.childs[i].networkOwnerId) {
						group.childs.splice(i, 1);
						i--;
					}
				}
			}
			var _group = JSON.stringify(group)
			group = JSON.parse(_group)
			delete group.createdAt;
			delete group.serialNumber;
			//result = await(Sign.findOneAndUpdate({_id}, {'$set': group}, {new: true}))
			result = await (GroupSer.updateGroup(_id, group))
			// await(SignDetailSer.updateGroupIntoDetailPage(result))
			if (result === null) {
				return reject(new Error("Group not exists!"));
			} else {
				return resolve(result);
			}
		} catch (err) {
			return reject(err)
		}
	});
	return promise;
};

this.update = (_id, sign) => {
	this.initSlots(sign)
	var promise = new Promise(async (resolve, reject) => {
		var message = await (this.validate(sign))
		if (!sign._id) {
			return reject('Listing required.')
		}
		if (message) {
			return reject(message);
		}
		if (sign.country) {
			var isValidCountry = await (Country.findOne({
				name: sign.country
			}))
			if (!isValidCountry) {
				return reject('Please select the country from given country name.');
			}
		}
		var result = await (Sign.findOneAndUpdate({
			_id
		}, {
			'$set': sign
		}, {
			new: true
		}).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').populate('childs'))
		if (result === null) {
			return reject(new Error("Listing not exists!"));
		} else {
			// await(self.publish(result._id.toString()))
			var queue = [{
				signId: result._id.toString(),
				time: new Date()
			}]
			QueueService.insetMany(queue);
			return resolve(result);
		}
	});
	return promise;
};

this.getListingsForGroup = async (searchText, user) => {
	try {
		searchText = searchText.replace(/"/g, '');
		var listings = await (Sign.aggregate(
			[{
				$match: {
					$and: [{
							networkOwnerId: user.networkOwnerId.toString()
						},
						{
							status: {
								$ne: "DELETED"
							}
						},
						{
							"$or": [{
								name: {
									'$regex': '.*' + searchText + '.*',
									$options: 'ig',
								}
							}, ]
						}
					]
				}
			}, {
				$group: {
					_id: "$_id",
					listing: {
						$push: "$$ROOT"
					},
				}
			}]
		))
		return listings
	} catch (err) {
		return (err)
	}
}

this.getGroups = async (params, networkOwnerId) => {
	try {
		let searchText = params.searchText.replace(/"/g, '');
		let filter = {
			$and: [{
				$or: [{
						networkOwnerId: networkOwnerId,
						name: {
							'$regex': '.*' + searchText + '.*',
							$options: 'i'
						},
						status: {
							$ne: "DELETED"
						},
						active: true
					},
					{
						networkOwnerId: {
							$ne: networkOwnerId
						},
						name: {
							'$regex': '.*' + searchText + '.*',
							$options: 'i'
						},
						groupType: "PUBLIC",
						status: {
							$ne: "DELETED"
						},
						active: true
					}
				]
			}, {
				_id: {
					$nin: params.addedListings
				}
			}]

		}
		let groups = await (GroupSer.findWithChilds(filter))
		return groups
	} catch (err) {
		console.log(err)
	}
}

this.createGroup = (group, locationNames, res, req) => {
	group.active = true
	var locationMap = {}
	var _locationNames = []
	var message = this.validateGroup(group)
	var promise = new Promise(async (resolve, reject) => {
		if (locationNames && locationNames.length > 0) {
			for (var i = 0; i < locationNames.length; i++) {
				if (!locationMap[locationNames[i].text]) {
					if (locationNames[i].text.length > 30) {
						return reject('Location name should be less than or equal to 30 characters.')
					}
					_locationNames.push(locationNames[i])
					locationMap[locationNames[i].text] = locationNames[i].text
				}
			}
		}
		if (message) {
			return reject(message);
		}
		// var _message = ''
		// for(var i = 0; i < group.childs.length; i++) {
		//   var child = group.childs[i]
		//   var childId = child._id.toString()
		//   var query = {
		//     signType: 'GROUP',
		//     childs: { "$in" : [childId]}
		//   }
		//   var groups = await(self.find(query))
		//   if(groups && groups.length > 0) {
		//     _message += child.name + ' already added to some other group'
		//     _message += '<br>'
		//   }
		// }
		// if(_message) {
		//   return reject(_message);
		// }
		group.orientation = 'Landscape'
		group.screenType = 'Indoor'
		group.slots = 1
		group.availableSlots = 1
		group.holdTime = 1
		group.holdTimeUnit = 'Sec'
		group.pricePerSlot = 1
		group.currency = 'USD'
		group.slotPeriod = 'perWeek'
		group.token = uniqid.time().toUpperCase()
		if (_locationNames && _locationNames.length > 0) {
			try {
				var locations = await (LocationServ.create(_locationNames))
				group._location = []
				for (var i = 0; i < locations.length; i++) {
					group._location.push(locations[i])
					group.locationString = group.locationString + locations[i].text + "^%"
				}
			} catch (err) {
				reject(err)
			}
		}
		try {
			var counterData = await (Counters.find({
				type: "sign"
			}))
			var count;
			if (counterData === null || counterData.length <= 0) {
				count = 100000;
			} else {
				count = counterData[0].serialNumber + 1;
			}
			group.serialNumber = count;
			//var result = await(Sign.createAsync(group))
			var result = await (GroupSer.createGroup(group))
			if (req)
				req.session.newListing = null;
			if (res) {
				res.send(result)
				res.end()
			}

			// await(SignDetailSer.insertGroupIntoDetailPage(result))
			await (self.counterUpdate(count))
			var queue = []
			for (let childsIndex = 0; childsIndex < result.childs.length; childsIndex++) {
				// await(self.publish(result.childs[childsIndex]._id.toString()))
				var q = {
					signId: result.childs[childsIndex]._id.toString(),
					time: new Date()
				}
				queue.push(q)
			}
			QueueService.insetMany(queue);
			if (!res)
				return resolve(result);
		} catch (err) {
			return reject(err);
		}
	});
	return promise;
};

this.validateGroup = group => {
	if (!group.name)
		return 'Name required.'
	if (group.name.length > 200)
		return 'Name should be less than or equal to 200 characters.'
	if (!group.groupType)
		return 'Group type required.'
	if (group.groupType !== 'PUBLIC' && group.groupType !== 'PRIVATE')
		return 'Group type should be public or private.'
	if (!group.signType)
		return 'Sign type required.'
	if (group.signType !== 'GROUP')
		return 'Sign type should be group.'
	if (group.description) {
		var _description = group.description ? group.description.split(/\s+/) : 0;
		if ((_description ? _description.length : '') > 150)
			return 'Description should be less than or equal to 150 words.'
	}
	if (group.active === undefined)
		return 'Status required.'
	return false
}

this.updateGroupWithLocation = (_id, group, locationNames, res) => {
	var publish = this.publish
	var locationMap = {}
	var _locationNames = []
	var result;
	var promise = new Promise(async (resolve, reject) => {
		var message = await (this.validateGroup(group, _id))
		try {
			if (!group._id) {
				return reject('Group required.')
			}
			// if (!locationNames) {
			//   return reject('Tags required.')
			// }
			if (locationNames && locationNames.length > 0) {
				for (var i = 0; i < locationNames.length; i++) {
					if (!locationMap[locationNames[i].text]) {
						if (locationNames[i].text.length > 30) {
							return reject('Location name should be less than or equal to 30 characters.')
						}
						_locationNames.push(locationNames[i])
						locationMap[locationNames[i].text] = locationNames[i].text
					}
				}
			}
			if (message) {
				return reject(message);
			}

			// result = await(Sign.findOne({_id})) ;
			result = await (GroupSer.findOne({
				_id
			}));
			var oldGroup = result
			if (result.groupType === 'PUBLIC' && group.groupType === "PRIVATE") {
				for (var i = 0; i < group.childs.length; i++) {
					if (group.networkOwnerId !== group.childs[i].networkOwnerId) {
						group.childs.splice(i, 1);
						i--;
					}
				}
			}
			if (_locationNames && _locationNames.length > 0) {
				var locations = await (LocationServ.create(_locationNames))
				group._location = []
				for (var i = 0; i < locations.length; i++) {
					group._location.push(locations[i])
					group.locationString = group.locationString + locations[i].text + "^%"
				}
			} else {
				group._location = []
			}
			var _group = JSON.stringify(group)
			group = JSON.parse(_group)
			delete group.createdAt;
			//result = await(Sign.findOneAndUpdate({_id}, {'$set': group}, {new: true}).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').populate('childs')) 
			result = await (GroupSer.updateGroup(_id, group))
			// await(SignDetailSer.updateGroupIntoDetailPage(result))
			if (result === null) {
				return reject(new Error("Group not exists!"));
			} else {
				if (res) {
					res.send(result)
					res.end()
				} else {
					return resolve(result);
				}
			}
			var queue = []
			for (let childsIndex = 0; childsIndex < result.childs.length; childsIndex++) {
				// await(self.publish(result.childs[childsIndex]._id.toString()))
				var q = {
					signId: result.childs[childsIndex]._id.toString(),
					time: new Date()
				}
				queue.push(q)
			}
			for (let childsIndex = 0; childsIndex < oldGroup.childs.length; childsIndex++) {
				// await(self.publish(oldGroup.childs[childsIndex]._id.toString()))
				var q = {
					signId: oldGroup.childs[childsIndex]._id.toString(),
					time: new Date()
				}
				queue.push(q)
			}
			QueueService.insetMany(queue);
		} catch (err) {
			return reject(err)
		}
	});
	return promise;
};

this.singleDeviceClaim = async (user, sign, signName, claimId, email) => {
	var promise = new Promise(async (rs, rj) => {
		if (sign.networkOwnerId && sign.networkOwnerId !== user.networkOwnerId) {
			return rj('This device already claimed by another network owner.')
		} else if (!sign.networkOwnerId) {
			try {
				let result = await (self.emitEvent(sign.mac, sign.info.lanmac, "CLAIM", {
					claimId: claimId,
					token: sign.token,
					email: email
				}))
				sign.slots = 10
				sign.pricePerSlot = 10
				sign.avgViewersCountDriving = 0
				sign.avgViewersCountWalking = 1
				sign.avgViewersCountTrain = 0
				sign.availableSlots = 5
				sign.totalAvgViewersCount = 0
				sign.slotPeriod = "perWeek";
				sign.holdTime = 8;
				sign.holdTimeUnit = "sec";
				sign.orientation = "Landscape";
				sign.screenType = "Indoor";
				sign.dimension = 7;
				sign.dimensionUnit = "inches";
				sign.sizeUnit = "feet";
				sign.requestInterval = 30;
				sign.description = "";
				sign.locationString = "";
				sign.establishmentType = "Retail";
				sign.forceFullyUpdatePlaylist = true;
				sign.postalCode = "";
				sign.isHidden = true;
				sign.active = true;
				sign.animation = true;
				sign.city = "";
				sign.country = "";
				sign.establishmentName = "";
				sign.state = "";
				sign.viewers = ["Walking"];
				sign.streetAddress1 = "";
				sign.streetAddress2 = "";
				var toDate = new Date();
				var fromDate = new Date();
				if (sign.offset) {
					var _offset = sign.offset.split(":");
					if (_offset[1] !== "00") {
						var _time = parseInt(_offset[1]) + .5
					} else {
						var _time = parseInt(_offset[1])

					}
				}
				fromDate.setHours(09, 00, 00)
				var toDate = new Date();
				toDate.setHours(18, 00, 00)
				if (_time) {
					fromDate.setHours(fromDate.getHours() - _time);
					toDate.setHours(toDate.getHours() - _time);
				}
				sign.operatingHours = {
					from: fromDate,
					to: toDate
				}

				sign._location = [];
				let name;
				if (signName) {
					name = signName
				} else if (sign.mac) {
					name = sign.mac.replace(new RegExp(':', 'g'), ' ')
				} else if (sign.info.lanmac) {
					name = sign.info.lanmac.replace(new RegExp(':', 'g'), ' ')
				}
				sign.name = name
				sign.networkOwnerId = user.networkOwnerId
				sign.status = 'CLAIMED'
				sign.active = true
				var systemMedia = await (NetworkOwnerMedia.find({
					type: "SYSTEM"
				}))
				sign.unsoldMedia = systemMedia[0]
				var _sign = await (self.updatePromise(sign._id, sign))
				// await(self.publish(_sign._id.toString()))
				var queue = [{
					signId: _sign._id.toString(),
					time: new Date()
				}]
				QueueService.insetMany(queue);
				return rs(_sign)
			} catch (e) {
				OfflineService.createIfNotExists(sign.mac, sign.info.lanmac, "CLAIM", user._id.toString());
				return rj(e)
			}
		} else if (sign.networkOwnerId === user.networkOwnerId) {
			try {
				if (!sign.unsoldMedia || sign.unsoldMedia.length <= 0) {
					let systemMedia = await (NetworkOwnerMedia.find({
						type: "SYSTEM"
					}))
					sign.unsoldMedia = systemMedia[0]
				}
				let name;
				if (signName) {
					name = signName
				} else if (sign.mac) {
					name = sign.mac.replace(new RegExp(':', 'g'), ' ')
				} else if (sign.info.lanmac) {
					name = sign.info.lanmac.replace(new RegExp(':', 'g'), ' ')
				}
				sign.name = name
				let _sign = await (self.updatePromise(sign._id, sign))
				let result = await (self.emitEvent(sign.mac, sign.info.lanmac, "CLAIM", {
					claimId: claimId,
					token: sign.token,
					email: email
				}))
				// await(self.publish(sign._id.toString()))
				var queue = [{
					signId: sign._id.toString(),
					time: new Date()
				}]
				QueueService.insetMany(queue);
				return rs(_sign)
			} catch (e) {
				OfflineService.createIfNotExists(sign.mac, sign.info.lanmac, "CLAIM", user._id.toString());
				return rj(e)
			}
		}
	});
	return promise;
};

this.unclaimDevice = async (user, id) => {
	// return new Promise(function(rs, rj) {
	return new Promise(async (rs, rj) => {
		let claimId = await (self.generateClaimId())
		let _sign = await (Sign.findOneAndUpdate({
			_id: id
		}, {
			'$set': {
				claimId: claimId,
				networkOwnerId: null,
				status: 'UNCLAIMED',
				profileMedia: null,
				ownMedia: [],
				unsoldMedia: [],
				active: false
			}
		}, {
			new: true
		}))
		try {
			await (OfflineService.delete(_sign.mac, _sign.info.lanmac, 'CLAIM'));
			await (self.emitEvent(_sign.mac, _sign.info.lanmac, 'UNCLAIM', {}));
			return rs(_sign)
		} catch (e) {
			return rj(e);
		}
	});
};

this.schoolList = async (skip, limit) => {
	let signs = await (Sign.find())
	return signs
}

this.findGroup = async sign => {
	let query = {
		"childs._id": {
			"$in": [mongoose.Types.ObjectId(sign._id)]
		},
	}
	let _groupData = await (GroupSer.findWithChilds(query));
	sign.childs = _groupData
	return sign
}


this.findOneByIdWithDetails = async sign => {
	try {
		var signId = sign._id.toString();
		var _Sign = JSON.stringify(sign)
		var sign = JSON.parse(_Sign)
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
		// var _groupData = await(self.find(query).sort({"updatedAt":-1}));
		var _groupData = await (GroupSer.findWithSortUpdatedAtDesc(query));
		sign.childs = _groupData
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
				sign.ownContentGroupName = groupData[0].name;
				if (groupData[0].ownMedia.length === privateOwnMedia) {
					sign.ownMedia = groupData[0].ownMedia;
					var _ownMediaFinal = JSON.stringify(sign.ownMedia)
					sign.ownMedia = JSON.parse(_ownMediaFinal)
					for (let index = 0; index < sign.ownMedia.length; index++) {
						sign.ownMedia[index].mediaType = 'GROUP';
					}
				} else if (groupData[0].ownMedia.length < privateOwnMedia) {
					var ownMediaFinal = [];
					var _ownMediaFinal = JSON.stringify(groupData[0].ownMedia)
					ownMediaFinal = JSON.parse(_ownMediaFinal)
					for (let index = 0; index < ownMediaFinal.length; index++) {
						ownMediaFinal[index].mediaType = 'GROUP';
					}
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
					var _ownMediaFinal = JSON.stringify(sign.ownMedia)
					sign.ownMedia = JSON.parse(_ownMediaFinal)
					for (let index = 0; index < sign.ownMedia.length; index++) {
						sign.ownMedia[index].mediaType = 'GROUP';
					}
				}
			}
		}
		var signDetails = JSON.stringify(sign)
		return sign
	} catch (e) {
		return e
	}
};

this.importBulkListings = async (req, res) => {
	try {
		let user = req.user;
		let params = (JSON.parse(req.body.data))
		let dateInString = params.date
		if (!dateInString) {
			dateInString = new Date()
			dateInString = dateInString.toString()
		}
		let userId
		if (user.advertiserId && user.networkOwnerId) {
			userId = user.advertiserId.toString()
		} else {
			if (user.advertiserId && !user.networkOwnerId) {
				userId = user.advertiserId.toString()
			} else if (user.networkOwnerId && !user.advertiserId) {
				userId = user.networkOwnerId.toString()
			}
		}
		let key = 'Listing_progress_of_import_listing'
		
		let overwriteStatus = params.status;

		let overwriteFilePath = null
		if (params.filePath && params.filePath.length > 0) {
			overwriteFilePath	= params.filePath[0];
		}
		res.send();
		res.end()
		let signs = []
		let logs = []
		if (overwriteStatus && overwriteStatus === "CONFIRMATION_APPROVED") {
			this.parse(overwriteFilePath, signs, logs, dateInString, user);
		} else {
			this.parse(req.files.file, signs, logs, dateInString, user);
		}
		if (logs.length > 0) {
			setTimeout(() => {
				io.sendUser(userId, key, {
					type: 'PROGRESS',
					message: {
						progress: 100,
						status: 'COMPLETED',
						data: {
							logs: logs
						}
					}
				});
			}, 1000)
			return;
		}
		if (!overwriteStatus || overwriteStatus !== "CONFIRMATION_APPROVED") {
			let existingSignNames = [];
			let existingSigns = [];
			let confirmationRequiredFilePaths = [];
			for (let j = 0; j < signs.length; j++) {
				let _sign = signs[j];
				let sign = await (this.findExistingSign(_sign, user));
				if (sign) {
					existingSignNames.push({
						name: sign.name
					});
					existingSigns.push(sign);
				}
			}
			if (existingSignNames.length > 0) {
				
				let file = req.files.file
				confirmationRequiredFilePaths.push({
					name: file.path,
					path: file.path
				})
				io.sendUser(userId, key, {
					type: 'PROGRESS',
					message: {
						progress: 0,
						status: 'CONFIRMATION_REQUIRED',
						signs: existingSignNames,
						filePath: confirmationRequiredFilePaths
					}
				});
				return
			}
		}
		let messages = [];
		let progress = 0;
		let totalLengthOfSigns = signs.length
		let lengthOfSignsCompleted = 0;
		console.log("JSON.stringify(signs)")
		console.log(JSON.stringify(signs))
		for (let j = 0; j < signs.length; j++) {
			let _sign = signs[j];
			let existingSign = await (self.findExistingSignToImport(_sign, user));
			let skip = false;
			if (_sign.mac || (_sign.info && _sign.info.lanmac)) {
				let mac = '',
					lanmac = '';
				if (_sign.mac) {
					mac = _sign.mac;
				}
				if (_sign.info && _sign.info.lanmac) {
					lanmac = _sign.info.lanmac;
				}
				try {
					if (existingSign && existingSign.networkOwnerId && existingSign.networkOwnerId !== _sign.networkOwnerId) {
						let message = {
							status: 'NOK',
							saveOrUpdate: 'NOK',
							claimed: 'NOK',
							joined: 'NOK',
							message: `WIFI MAC: ${mac} LAN MAC: ${lanmac} unable to process, device claimed by another customer.`
						}
						console.log('...g')
						messages.push(message);
						skip = true;
					}
				} catch (e) {
					console.log(e)
				}

			}
			if (!skip) {
				let saveOrUpdate = 'NOK',
					claimed = 'NOK',
					joined = 'NOK';
				if (existingSign) {
					if (existingSign.unsoldMedia) {
						_sign.unsoldMedia = existingSign.unsoldMedia
					}
					if (existingSign.ownMedia) {
						_sign.ownMedia = existingSign.ownMedia
					}
					if (existingSign.profileMedia) {
						_sign.profileMedia = existingSign.profileMedia
					}
					_sign._id = existingSign._id
					if (_sign.signType === 'SIGN') {
						if (!_sign.unsoldMedia || _sign.unsoldMedia.length <= 0) {
							let systemMedia = await (NetworkOwnerMedia.find({
								type: 'SYSTEM'
							}))
							_sign.unsoldMedia = systemMedia[0]
						}
						try {
							console.log("0-0")
							await (self.updateSign(existingSign._id, _sign, _sign.locationNames))
							console.log("0-1")
							_sign._id = existingSign._id
							let m = `Line #${j + 1}, ${_sign.name} successfully updated.`;
							saveOrUpdate = 'OK';
							console.log("0-2")
							console.log(_sign.mac)
							if (_sign.mac || (_sign.info && _sign.info.lanmac)) {
								let mac = '',
									lanmac = '';
								if (_sign.mac) {
									mac = _sign.mac;
								}
								if (_sign.info && _sign.info.lanmac) {
									lanmac = _sign.info.lanmac;
								}
								let claimId;
								if ((_sign.mac || (_sign.info && _sign.info.lanmac)) && !existingSign.claimId) {
									claimId = await (self.generateClaimId())
								} else {
									claimId = existingSign.claimId
								}
								await (self.updatePromise(existingSign._id, {
									claimId: claimId,
									claimable: 'true'
								}))
								try {
									await (self._singleDeviceClaim(user, existingSign, existingSign.claimId, user.email))
									m += `, Device ${mac} successfully claimed`
									claimed = 'OK';
								} catch (e) {
									console.log("e-7")
									console.log(e)
									claimed = 'NOK';
									m += ` ${e instanceof Object ? (e.code == 'OFFLINE' ? `, Device ${mac} offline, once the device gets online it will be claimed ` : e.status) : e}`
								}
							}
							if (_sign.groupToken) {
								let query = {
									token: _sign.groupToken
								}
								let group = await (GroupSer.listAllGroups(query))
								if (group && group.length > 0) {
									await (self.addSignToGroup(group, _sign, _sign._id))
									try {
										for (let k = 0; k < group.length; k++) {
											let _group = group[k]
											await (self.insertDataIntoBookingAndPayment(_sign._id, _group))
										}
									} catch (e) {}
									m += `, And successfully joined to group token ${_sign.groupToken} `
									joined = 'OK'
								} else {
									m += `. Unable to join to group, there is no group with token ${_sign.groupToken} `
									joined = 'NOK'
								}
							} else {
								joined = 'N/A'
							}
							let message = {
								status: 'OK',
								saveOrUpdate: saveOrUpdate,
								claimed: claimed,
								joined: joined,
								message: m
							}
							messages.push(message);
						} catch (e) {
							console.log("e-6")
							console.log(e)
							let message = {
								status: 'NOK',
								saveOrUpdate: saveOrUpdate,
								claimed: claimed,
								joined: joined,
								message: `Line #${j + 1}, ${e}`
							}
							messages.push(message);
						}
					} else if (_sign.signType === "GROUP") {
						try {
							if (existingSign.childs && existingSign.childs.length > 0) {
								_sign.childs = existingSign.childs
							} else {
								_sign.childs = []
							}
							await (self.updateGroupWithLocation(existingSign._id, _sign, []));
							saveOrUpdate = 'OK'
							claimed = 'N/A';
							joined = 'N/A';
							let message = {
								status: 'OK',
								saveOrUpdate: saveOrUpdate,
								claimed: claimed,
								joined: joined,
								message: `Line #${j + 1}, ${_sign.name} successfully updated.`
							}
							messages.push(message);
						} catch (e) {
							console.log("e5-0")
							console.log(e)
							saveOrUpdate = 'NOK'
							claimed = 'N/A';
							joined = 'N/A';
							let message = {
								status: 'NOK',
								saveOrUpdate: saveOrUpdate,
								claimed: claimed,
								joined: joined,
								message: `Line #${j + 1}, ${e}`
							}
							messages.push(message);
						}
					}
				} else {
					if (_sign.signType === 'SIGN') {
						try {
							let result = await (self.create(_sign, _sign.locationNames, user.email))
							_sign._id = result._id;
							let m = `Line #${j + 1}, ${_sign.name} successfully created.`;
							saveOrUpdate = 'OK';
							if (_sign.mac || (_sign.info && _sign.info.lanmac)) {
								let mac = '',
									lanmac = '';
								if (_sign.mac) {
									mac = _sign.mac;
								}
								if (_sign.info && _sign.info.lanmac) {
									lanmac = _sign.info.lanmac;
								}
								let claimId = await (self.generateClaimId())
								_sign.claimId = claimId
								_sign.claimable = 'true'
								await (self.updatePromise(result._id, {
									claimId: _sign.claimId,
									claimable: _sign.claimable
								}))
								try {
									await (self._singleDeviceClaim(user, _sign, _sign.claimId, user.email))
									m += `, Device ${mac} successfully claimed`;
									claimed = 'OK'
								} catch (e) {
									m += ` ${e instanceof Object ? (e.code == 'OFFLINE' ? `, Device ${mac} offline, once the device gets online it will be claimed ` : e.status) : e}`
									claimed = 'NOK'
								}
							}
							if (_sign.groupToken) {
								let query = {
									token: _sign.groupToken
								}
								let group = await (GroupSer.listAllGroups(query))
								if (group && group.length > 0) {
									await (self.addSignToGroup(group, _sign, _sign._id))
									try {
										for (let k = 0; k < group.length; k++) {
											let _group = group[k]
											await (self.insertDataIntoBookingAndPayment(_sign._id, _group))
										}
									} catch (e) {}
									m += `, And successfully joined to group token ${_sign.groupToken} `
									joined = 'OK';
								} else {
									m += `. Unable to join to group, there is no group with token ${_sign.groupToken} `
									joined = 'NOK';
								}
							}
							let message = {
								status: 'OK',
								saveOrUpdate: saveOrUpdate,
								claimed: claimed,
								joined: joined,
								message: m
							}
							messages.push(message);
						} catch (e) {
							console.log("e-20")
							console.log(e)
							let message = {
								status: 'NOK',
								saveOrUpdate: saveOrUpdate,
								claimed: claimed,
								joined: joined,
								message: `Line #${j + 1}, ${e}`
							}
							messages.push(message);
						}
					} else if (_sign.signType === 'GROUP') {
						try {
							_sign.childs = []
							await (self.createGroup(_sign, []));
							saveOrUpdate = 'OK';
							claimed = 'N/A';
							joined = 'N/A';
							let message = {
								status: 'OK',
								saveOrUpdate: saveOrUpdate,
								claimed: claimed,
								joined: joined,
								message: `Line #${j + 1}, ${_sign.name} successfully created.`
							}
							messages.push(message);
						} catch (e) {
							console.log("e-0")
							console.log(e)
							saveOrUpdate = 'NOK';
							claimed = 'N/A';
							joined = 'N/A';
							let message = {
								status: 'NOK',
								saveOrUpdate: saveOrUpdate,
								claimed: claimed,
								joined: joined,
								message: `Line #${j + 1}, ${e}`
							}
							messages.push(message);
						}
					}
				}
			}
			lengthOfSignsCompleted++;
			user.progressBarStatus = 'INPROGRESS'
			req.session.user = JSON.parse(JSON.stringify(user))
			user.progressBarStatus = 'Inprogress'

			if (totalLengthOfSigns === lengthOfSignsCompleted) {
				if (user["progressBarStatus"]) {
					delete user["progressBarStatus"]
					req.session.user = JSON.parse(JSON.stringify(user))
				}
				progress = 100
				io.sendUser(userId, key, {
					type: 'PROGRESS',
					message: {
						progress: progress,
						status: 'COMPLETED',
						data: {
							signs: [],
							logs: messages
						}
					}
				});
			} else {
				progress = (lengthOfSignsCompleted / totalLengthOfSigns) * 100
				io.sendUser(userId, key, {
					type: 'PROGRESS',
					message: {
						progress: progress,
						status: 'IN_PROGRESS'
					}
				});
			}
		}
	} catch (err) {
		console.log("err---------------")
		console.log(err)
	}
};

this.parse = (files, signs, logs, dateInString, user) => {
	console.log("80888------------")
	console.log(files)
	let _files = [files]
  for (let i = 0; i < _files.length; i++) {
		let file = _files[i]
		console.log("file")
		console.log(file)
    let _ext = file.name.split('.')
    let ext = _ext[_ext.length-1]
    let contentArray = [];
    if (ext === 'xls' || ext === 'xlsx') {
      let [ obj ] = xlsx.parse(fs.readFileSync(file.path));
      let _contentArray = []
      for (let j = 1; j < obj.data.length; j++) {
        _contentArray.push(obj.data[j].toString().split('\n'));
      }
      //let content = obj.data
      _contentArray.splice(0, 0, "dummy")
      contentArray = _contentArray
    } else if (ext === 'csv') {
      let content = fs.readFileSync(file.path, 'utf8');
      contentArray = content.toString().split('\n');
    }
    let saveOrUpdate = 'NOK', claimed = 'N/A', joined = 'N/A';
    for (let j = 1; j < contentArray.length; j++) {
      let _content;
      if (Array.isArray(contentArray[j])) {
        [_content] = contentArray[j]
      } else {
        _content = contentArray[j]
      }
      if(_content) {
        let fields = _content.split(',').toString()
        let _fields = fields.split(',')
        if(_fields.length < 37) {
          let message = {
            saveOrUpdate: saveOrUpdate,
            claimed: claimed,
            joined: joined,
            message: `Line #${j}, unable to parse data, ${37 - _fields.length} fields missing`
          }
          logs.push(message);
          continue;
        }
        let sign = {};
        sign.operatingHours = {}
        sign.name = _fields[0]
        sign.signType = _fields[1]
        sign.orientation = _fields[2]
        sign.screenType = _fields[3]
        sign.dimension = _fields[4]
        sign.dimensionUnit = _fields[5]
        sign.height = _fields[6]
        sign.width = _fields[7]
        sign.slots = _fields[8]
        sign.availableSlots = _fields[9]
        sign.holdTime = _fields[10]
        sign.holdTimeUnit = _fields[11]
        sign.pricePerSlot = _fields[12] ? (_fields[12].includes('$') ? _fields[12].replace('$', '') : _fields[12]) : 0;
        if (!sign.pricePerSlot) {
          sign.pricePerSlot = 0;
        }
        sign.currency = _fields[13]
        sign.slotPeriod = _fields[14]
        sign.viewers = _fields[15]
        if(sign.viewers) {
          let viewers = sign.viewers.split(' ').join('');
          viewers = viewers.split(';');
          sign.viewers = viewers
        }
        sign.offset = _fields[16] ? _fields[16] : '-05:00'
        var tempOffset = sign.offset
        var _tempOffset = tempOffset.split(":");
        if (_tempOffset.length > 2) {
          sign.offset = _tempOffset[0]+":"+_tempOffset[1]
        }

        sign.groupType = _fields[17]
        sign.streetAddress1 = _fields[18].replace(";", ",");
        sign.streetAddress2 = _fields[19].replace(";", ",");
        sign.city = _fields[20]
        sign.state = _fields[21]
        sign.postalCode = _fields[22]
        sign.country = _fields[23]
        sign.discountValue = _fields[24]
        if (sign.groupType && sign.groupType === "PUBLIC" && !sign.discountValue) {
          sign.discountValue = 0
        }
        sign.avgViewersCountWalking = _fields[25]
        sign.avgViewersCountDriving = _fields[26]
        sign.avgViewersCountTrain = _fields[27]
        if(sign.viewers) {
          if (sign.viewers.indexOf("Walking") <= -1) {
            sign.avgViewersCountWalking = 0
          }
          if (sign.viewers.indexOf("Driving") <= -1) {
            sign.avgViewersCountDriving = 0
          }
          if (sign.viewers.indexOf("Train") <= -1) {
            sign.avgViewersCountTrain = 0
          }
        }
        sign.locationTags = _fields[28]
        sign.operatingHours.from = _fields[29] ? _fields[29] : '09:00'
        sign.operatingHours.to = _fields[30] ? _fields[30] : '18:00'
        sign.establishmentType = _fields[31]
        if (sign.operatingHours.from) {
          let _from = sign.operatingHours.from.split(':')
          let _dateLength = dateInString.length
          let _timeZonePosition = dateInString.indexOf("GMT")
          let getDateString = dateInString.substring(_timeZonePosition, _dateLength)
          let fromDate = new Date()
          fromDate.setHours(_from[0],_from[1],_from[2],0)
          let _fromDate = new Date(fromDate).toString()
          let dateLength = _fromDate.length
          let timeZonePosition = _fromDate.indexOf("GMT")
          let replaceString = _fromDate.substring(timeZonePosition, dateLength)
					let date = _fromDate.replace(replaceString, getDateString)
					console.log("date")
					console.log(date)
					console.log(getDateString)
					console.log(replaceString)
          date = new Date(date).toISOString()
          sign.operatingHours.from = date
        }
        if (sign.operatingHours.to) {
          let _to = sign.operatingHours.to.split(':')
          let _dateLength = dateInString.length
          let _timeZonePosition = dateInString.indexOf("GMT")
          let getDateString = dateInString.substring(_timeZonePosition, _dateLength)
          let toDate = new Date()
          toDate.setHours(_to[0],_to[1],_to[2],0)
          let _toDate = new Date(toDate).toString()
          let dateLength = _toDate.length
          let timeZonePosition = _toDate.indexOf("GMT")
          let replaceString = _toDate.substring(timeZonePosition, dateLength)
          let date = _toDate.replace(replaceString, getDateString)
          date = new Date(date).toISOString()
          sign.operatingHours.to = date
        }
        if (!sign.establishmentType || sign.establishmentType === '') {
          sign.establishmentType = "Retail"
        }
        sign.establishmentName = _fields[32]
        sign.description = _fields[33]
        sign.groupToken = _fields[34]
        let mac = _fields[35]
        if(mac) {
          let lanmac = _fields[36] ? _fields[36] : ''
          sign.mac = mac
          //sign.claimable = 'true'
          sign.info = {
            mac: _fields[35],
            lanmac: lanmac
          } 
        }
        sign.active = true
        sign.status = 'CREATED'
        sign.sizeUnit = 'feet'
        sign.networkOwnerId = user.networkOwnerId
        if (!sign.avgViewersCountDriving)
          sign.avgViewersCountDriving = 0
        if (!sign.avgViewersCountWalking)
          sign.avgViewersCountWalking = 0
        if (!sign.avgViewersCountTrain)
          sign.avgViewersCountTrain = 0
        sign.totalAvgViewersCount = parseInt(sign.avgViewersCountDriving) + parseInt(sign.avgViewersCountWalking) + parseInt(sign.avgViewersCountTrain)
        sign.unsoldMedia = []
        let locationNames = []
        if (sign.locationTags) {
          let location = sign.locationTags.split(';')
          for (let j = 0; j < location.length; j++) {
            locationNames.push({text: location[j]})
          }
        }
        sign.locationNames = locationNames;
				sign.isHidden = true;
        signs.push(sign)
      }
    }
  }
}

this.findExistingSign = async(sign, user) => {
  let _sign;
  if (sign.signType === 'GROUP') {
    let query = {
      name: sign.name,
      status: {$ne: "DELETED"},
      networkOwnerId: user.networkOwnerId
    }
    _sign = await(GroupSer.findOne(query))
  } else {
    let query;
    if(sign.mac || (sign.info && sign.info.lanmac)) {
      let mQuery = []
      if(sign.mac) {
        mQuery.push({ mac: sign.mac })
      }
      if(sign.info && sign.info.lanmac) {
        mQuery.push({ 'info.lanmac': sign.info.lanmac })
      }
      query = {
        $and: [
          {
            $or: mQuery
          }, 
          {
            status: {$ne: "DELETED"},
          },
          {
            networkOwnerId: user.networkOwnerId
          }
        ]
      }
    } else {
      query = {
        name: sign.name,
        status: {$ne: "DELETED"},
        networkOwnerId: user.networkOwnerId
      }
    }
    _sign = await(self.findOne(query))
  }
  return _sign;
}

this.findExistingSignToImport = async(sign, user) => {
  let _sign;
  if (sign.signType === 'GROUP') {
    let query = {
      name: sign.name,
      status: {$ne: "DELETED"},
      networkOwnerId: user.networkOwnerId
    }
    _sign = await(GroupSer.findOne(query))
  } else {
    let query;
    if(sign.mac || (sign.info && sign.info.lanmac)) {
      let mQuery = []
      if(sign.mac) {
        mQuery.push({ mac: sign.mac })
      }
      if(sign.info && sign.info.lanmac) {
        mQuery.push({ 'info.lanmac': sign.info.lanmac.toString() })
      }
      query = {
        $and: [
          {
            $or: mQuery
          }, 
          {
            status: {$ne: "DELETED"},
          }
        ]
      }
    } else {
      query = {
        name: sign.name,
        status: {$ne: "DELETED"},
        networkOwnerId: user.networkOwnerId
      }
    }
    _sing = await(self.findOne(query))
  }
  return _sing;
}

var self = this
// this.addAndRemoveSignFromGroup('5da577108073b51449f3da58',{"operatingHours":{"from":"09:00","to":"18:00"},"signType":"SIGN","childs":[{"_id":"5d7b34f7b82f6c2f5df67f2c","signType":"GROUP","childs":[{"_id":"5d63811f2fb00046f775c585","name":"Its been long Day","totalAvgViewersCount":1,"networkOwnerId":"5d2da085b2c9c350de748e78","availableSlots":50,"holdTime":8,"pricePerSlot":100,"slotPeriod":"perWeek"},{"_id":"5d4bd4dc2a638f4a7f2ef172","name":"test -playlist","profileMedia":"5d300807eff74a31616ba468","totalAvgViewersCount":1,"networkOwnerId":"5d2da085b2c9c350de748e78","availableSlots":5,"holdTime":8,"pricePerSlot":10,"slotPeriod":"perWeek"}],"childsDetails":["5d63811f2fb00046f775c585","5d4bd4dc2a638f4a7f2ef172"],"locationString":"India^%","active":true,"isHidden":true,"status":"CREATED","ownMedia":[],"forceFullyUpdatePlaylist":true,"claimable":false,"description":"","name":"GROUP-100","groupType":"PUBLIC","networkOwnerId":"5d25d80b2132ec444174352c","orientation":"Landscape","token":"K0HQEZ5H","serialNumber":"1000024","_slots":[],"ownSlots":[],"updatedAt":"2019-09-13T06:20:44.240Z","createdAt":"2019-09-13T06:19:35.676Z","__v":0,"selected":true}],"slotPeriod":"perWeek","viewers":["Walking"],"requestInterval":30,"_location":[],"active":true,"isHidden":true,"status":"CREATED","ownMedia":[],"unsoldMedia":[{"_id":"5d25d7e52132ec444174344a","type":"SYSTEM","name":"default_9.png","meta":{"height":2168,"width":3840,"mimeType":"image/png","format":"PNG","type":"image"},"updatedAt":"2019-07-10T12:19:49.372Z","createdAt":"2019-07-10T12:19:49.372Z","__v":0}],"timeZone":"Calcutta, Asia - IST","offset":"-05:00","forceFullyUpdatePlaylist":true,"isEvent":false,"animation":true,"_id":"5da577108073b51449f3da58","name":"Dssss001","description":null,"claimable":false,"orientation":"Landscape","screenType":"Indoor","dimension":7,"dimensionUnit":"inches","width":45,"height":18,"sizeUnit":"feet","slots":20,"holdTime":8,"holdTimeUnit":"sec","availableSlots":15,"pricePerSlot":10,"currency":"USD","avgViewersCountDriving":1,"avgViewersCountWalking":1,"avgViewersCountTrain":1,"totalAvgViewersCount":3,"establishmentType":"Retail","establishmentName":"","streetAddress1":"","city":"","state":"","postalCode":"","country":"India","groupType":"NONE","networkOwnerId":"5d25d80b2132ec444174352c","locationString":"","_slots":[{"code":1,"name":1},{"code":2,"name":2},{"code":3,"name":3},{"code":4,"name":4},{"code":5,"name":5},{"code":6,"name":6},{"code":7,"name":7},{"code":8,"name":8},{"code":9,"name":9},{"code":10,"name":10},{"code":11,"name":11},{"code":12,"name":12},{"code":13,"name":13},{"code":14,"name":14},{"code":15,"name":15}],"ownSlots":[{"code":1,"name":1},{"code":2,"name":2},{"code":3,"name":3},{"code":4,"name":4},{"code":5,"name":5}],"token":"K1RJ9JIF","updatedAt":"2019-10-15T08:44:02.476Z","__v":0,"locationNames":[],"_price":"NaN","_holdTime":"NaN"}
// )