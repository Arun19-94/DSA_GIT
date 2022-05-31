var Promise = require('bluebird');

var Notification = require('./notification.schema');

var CampaignServ = require("../../advertiser/campaign/campaign.service");

var AdvertiserNotificationServ = require("../../advertiser/notification/notification.service");

var AdvertiserServ = require("../../advertiser/advertiser.service");

var io = require('../../../components/socket/client.socketIO.service');

var NotificationServ = require('../../admin/notification/notification.service');

var User = require('../../user/user.schema')

let UserServ = require('../../user/user.service')

this.create = notification => {
  var _notification = notification
  var _this = this
  var promise = new Promise(async (resolve, reject) => {
    try {
      var self = _this
      var notification = _notification
      notification = new Notification(notification);
      var notificationFlag = 0
      var networkOwnerUser = await (User.findOne({
        networkOwnerId: notification.networkOwner
      }))
      var advertiserUser = await (User.findOne({
        advertiserId: notification.advertiser
      }))
      let query = {
        user: networkOwnerUser._id.toString(),
        whichUser: advertiserUser._id.toString(),
        status: "TRUSTED"
      }
      let usersList = await(UserServ.getApprovedOrBlockedUsersList(query))
      if (networkOwnerUser._id.toString() === advertiserUser._id.toString()) {
        notificationFlag = 1
        // notification.status = "APPROVED"
      } else {
        usersList.map(user => {
          if (user.whichUser._id.toString() === advertiserUser._id.toString())
            notificationFlag = 2
        })
        // for (let i = 0; i < networkOwnerUser.preApprovedAdvertiser.length; i++) {
        //   if (networkOwnerUser.preApprovedAdvertiser[i].toString() === advertiserUser._id.toString()) {
        //     notificationFlag = 2
        //     // notification.status = "APPROVED"
        //     // notification.type = "PREAPPROVED"
        //   }
        // }
      }
      let _anotification = JSON.stringify(await (notification.save()))
      var notification = JSON.parse(_anotification)
      var updateFlag = 0
      if (notificationFlag === 1 && (notification.type === "MEDIA" || notification.type === "RESUBMITTED")) {
        notification.status = "APPROVED"
        updateFlag = 1
      } else if (notificationFlag === 2 && (notification.type === "MEDIA" || notification.type === "RESUBMITTED")) {
        notification.status = "APPROVED"
        notification.type = "PREAPPROVED"
        updateFlag = 1
      } else if (notificationFlag === 1 || notificationFlag === 2 && notification.type === "REPLACE_MEDIA") {
        notification.status = "APPROVED"
        notification.type = "REPLACE_MEDIA_PREAPPROVED"
        notification = await (self.update(notification._id, notification))
      } else if (notification.bookingByGroup && notification.bookingByGroup === true) {
        delete notification.createdAt
        delete notification.updatedAt
        notification.status = "APPROVED"
        notification = await (self.update(notification._id, notification))
      }
      if (updateFlag === 1) {
        delete notification.createdAt
        delete notification.updatedAt
        notification = await (self.update(notification._id, notification, "CREATEUPDATE"))
      }
      return resolve(notification);
    } catch (err) {
      return reject(err);
    };
  });
  return promise;
};

this.count = (query = {}) => {
  return Notification
    .count(query);
};

this.find = (query = {}, limit) => {
  return Notification
    .find(query).limit(limit).populate('sign').populate('media').populate({
      path: 'campaign',
      populate: {
        path: 'media'
      }
    }).populate('networkOwner').populate('advertiser').sort('-createdAt');
};

this.findNotificationsWithDetails = user => {
  let promise
  return promise = new Promise(async (rs, rj) => {
    try {
      let data = {}
      let count = {}
      let query = {
        networkOwner: user.networkOwnerId,
        $or: [{
            status: "PENDING"
          },
          {
            status: "RESUBMITTED"
          }
        ]
      }
      count.pendingNotificationCount = await (this.count(query))
      data.notifications = await (this.find(query, 5))
      query = {
        networkOwner: user.networkOwnerId,
        status: "REJECTED"
      }
      count.rejectedNotificationCount = await (this.count(query))
      query = {
        networkOwner: user.networkOwnerId,
        status: "APPROVED"
      }
      count.approvedNotificationCount = await (this.count(query))
      data.count = count
      return rs(data)
    } catch (err) {
      return rj(err)
    }
  })
}

this.findAllNotificationsWithDetails = async (user, query) => {
  let limit = query.limit
  let skip = query.skip

  let _query = {}
  let notificationFilter = {};
  let searchText = "";
  let status = null
  let type = null
  let isRead = true
  if (query.status && query.status !== "ALL" && query.status !== null) {
    status = query.status
  } else if (query.type) {
    type = query.type
  } else if (query.isRead === false) {
    isRead = false
  }
  _query.networkOwner = user.networkOwnerId
  let networkOwnerId = user.networkOwnerId
  notificationFilter.networkOwner = user.networkOwnerId
  if (query.searchText) {
    searchText = query.searchText
  }
  let data = {}
  if (status && status !== undefined) {
    notificationFilter = {
      networkOwner: networkOwnerId,
      status: status
    };
  }
  if (status === "PENDING") {
    notificationFilter = {
      networkOwner: networkOwnerId,
      $or: [{
          type: "MEDIA",
          status: status,
        },
        {
          type: "REPLACE_MEDIA",
          status: {
            $exists: false
          }
        }
      ]
    }
  }
  if (status === "APPROVED") {
    notificationFilter = {
      networkOwner: networkOwnerId,
      status: status,
      $and: [{
          type: {
            $ne: "PREAPPROVED"
          },
        },
        {
          type: {
            $ne: "REPLACE_MEDIA_PREAPPROVED"
          }
        }
      ]
    }
  }
  if (isRead === false) {
    notificationFilter = {
      networkOwner: networkOwnerId,
      isRead: isRead
    };
  }
  if (type && type !== undefined) {
    if (type === "PREAPPROVED") {
      notificationFilter = {
        networkOwner: networkOwnerId,
        $or: [{
            type: type,
            status: "APPROVED"
          },
          {
            type: "REPLACE_MEDIA_PREAPPROVED",
            status: "APPROVED"
          }
        ],
      };
    } else {
      notificationFilter = {
        networkOwner: networkOwnerId,
        type: type
      };
    }
  }
  // if (type && type !== undefined ) {
  //   notificationFilter = {
  //     networkOwner: networkOwnerId,
  //     type: type,
  //   };
  // }
  let result = await (this.find(notificationFilter))
  let _searchText = searchText.toLowerCase()
  let _notifications = []
  if (searchText && searchText.length > 0) {
    for (var i = 0; i < result.length; i++) {
      let notification = result[i]
      if ((notification.media && notification.media.name.toLowerCase().indexOf(_searchText) >= 0) || (notification.sign && notification.sign.name.toLowerCase().indexOf(_searchText) >= 0) || (notification.campaign && notification.campaign.name.toLowerCase().indexOf(_searchText) >= 0)) {
        _notifications.push(notification)
      }
    }
  } else {
    _notifications = result
  }
  let _limit = skip + limit
  let __notifications = _notifications.slice(skip, _limit)
  data.notifications = __notifications
  data.count = _notifications.length

  return data
}

this.findQuery = async (query = {}) => {
  return await (Notification
    .find(query).populate('sign').populate('media').populate({
      path: 'campaign',
      populate: {
        path: 'media'
      }
    }).populate('networkOwner').populate('advertiser').sort('-createdAt'));
};

this.notifyCount = (networkOwnerId, query = {}, userId) => {
  Notification.count(query)
    .then(count => {
      var key = networkOwnerId + '_NOTIFICATION_UPDATE_COUNT';
      io.sendUser(userId, key, {
        type: 'NOTIFICATION_UPDATE_COUNT',
        message: count
      });
    })
};

this.notifyRefreshList = (networkOwnerId, userId) => {
  var key = networkOwnerId + '_NOTIFICATION_REFRESH_LIST'
  io.sendUser(userId, key, {
    type: 'NOTIFICATION_REFRESH_LIST',
    message: {}
  });
};

this.unReadNotifyRefreshList = (networkOwnerId, userId) => {
  var key = networkOwnerId + 'UNREAD_NOTIFICATION_REFRESH_LIST'
  io.sendUser(userId, key, {
    type: 'UNREAD_NOTIFICATION_REFRESH_LIST',
    message: {}
  });
};

this._updateBulkNotification = async (status, notifications, user) => {
  var ids = []
  var notifyCount = this.notifyCount
  var _status;
  if (status === "unread") {
    _status = false
  } else if (status === "read") {
    _status = true
  }
  for (let index = 0; index < notifications.length; index++) {
    ids.push(notifications[index]._id);
  }
  try {
    var updateData = await (Notification.update({
      _id: {
        "$in": ids
      }
    }, {
      "$set": {
        "isRead": _status
      }
    }, {
      multi: true
    }))
    if (user.advertiserId && user.networkOwnerId) {
      var userId = user.advertiserId.toString()
    } else {
      if (user.advertiserId && !user.networkOwnerId) {
        var userId = user.advertiserId.toString()
      } else if (user.networkOwnerId && !user.advertiserId) {
        var userId = user.networkOwnerId.toString()
      }
    }
    notifyCount(user.networkOwnerId.toString(), {
      networkOwner: user.networkOwnerId.toString(),
      isRead: false
    }, userId.toString())
    return updateData
  } catch (err) {
    return err
  }
};

this.unReadPendingNotifyRefreshList = (networkOwnerId, userId) => {
  var key = networkOwnerId + 'UNREAD_PENDING_NOTIFICATION_REFRESH_LIST'
  io.sendUser(userId, key, {
    type: 'UNREAD_PENDING_NOTIFICATION_REFRESH_LIST',
    message: {}
  });
};

this.reSubmitNotifyRefreshList = (networkOwnerId, userId) => {
  var key = networkOwnerId + 'RESUBMIT_NOTIFICATION_REFRESH_LIST'
  io.sendUser(userId, key, {
    type: 'RESUBMIT_NOTIFICATION_REFRESH_LIST',
    message: {}
  });
};

this.paymentNotifyRefreshList = (networkOwnerId, userId) => {
  var key = networkOwnerId + 'PAYMENT_NOTIFICATION_REFRESH_LIST'
  io.sendUser(userId, key, {
    type: 'PAYMENT_NOTIFICATION_REFRESH_LIST',
    message: {}
  });
};

this.mediaNotifyRefreshList = (networkOwnerId, userId) => {
  var key = networkOwnerId + 'MEDIA_NOTIFICATION_REFRESH_LIST'
  io.sendUser(userId, key, {
    type: 'MEDIA_NOTIFICATION_REFRESH_LIST',
    message: {}
  });
};

this.update = (_id, notification, status) => {
  var promise = new Promise((resolve, reject) => {
    let _notification = JSON.stringify(notification)
    notification = JSON.parse(_notification)
    delete notification.createdAt;
    delete notification.updatedAt;
    return Notification.findOneAndUpdate({
      _id
    }, {
      '$set': notification
    }, {
      new: true
    }, (err, result) => {
      if (err) {
        return reject(err);
      } else if (result === null) {
        return reject(new Error("Notification not exists!"));
      } else if (result.isRead === true && result.type === "PAYMENT") {
        return resolve(result)
      } else if (result.status === "CANCELED") {
        return resolve(result)
      } else {
        var query = {
          networkOwnerId: result.networkOwner.toString()
        }
        return User.findOne(query).then(() => {
          var advertiserNotification = {
            type: notification.type,
            status: notification.status,
            isRead: false,
            sign: notification.sign,
            media: notification.media,
            campaign: notification.campaign,
            networkOwner: notification.networkOwner,
            advertiser: notification.advertiser,
            reason: notification.reason,
            comment: notification.comment
          }
          if (notification.campaign.advertiserId) {
            AdvertiserServ.getDashboardData(notification.campaign.advertiserId)
          } else {
            AdvertiserServ.getDashboardData(notification.advertiser)
          }
          AdvertiserNotificationServ.create(advertiserNotification);
          CampaignServ.updateCampaignStatus(result.campaign.toString(), result.media.toString(), result.sign.toString(), result.status, result.campaignStatusId)
          if (!status || status !== "CREATEUPDATE") {
            NotificationServ.sendNotificationMailToAdvertiser(advertiserNotification)
          }
          return resolve(result);
        }).catch(err => {
          console.log(err)
          return reject(err)
        })
      }
    });
  });
  return promise;
};

this.markAsRead = (_id, notification) => {
  var notifyCount = this.notifyCount
  var promise = new Promise((resolve, reject) => {
    return Notification.findOneAndUpdate({
      _id
    }, {
      '$set': notification
    }, {
      new: true
    }, (err, result) => {
      if (err) {
        return reject(err);
      } else if (result === null) {
        return reject(new Error("Notification not exists!"));
      } else {
        var query = {
          networkOwnerId: result.networkOwner.toString()
        }
        return User.findOne(query).then(user => {
          if (user.advertiserId && user.networkOwnerId) {
            var userId = user.advertiserId.toString()
          } else {
            if (user.advertiserId && !user.networkOwnerId) {
              var userId = user.advertiserId.toString()
            } else if (user.networkOwnerId && !user.advertiserId) {
              var userId = user.networkOwnerId.toString()
            }
          }
          notifyCount(result.networkOwner.toString(), {
            networkOwner: result.networkOwner.toString(),
            isRead: false
          }, userId.toString())
          return resolve(result);
        }).catch(err => {
          return reject(err)
        })
      }
    });
  });
  return promise;
};

this.getPaginationNotifications = (params, networkOwnerId, user) => {
  var promise;
  promise = new Promise(async (resolve, reject) => {
    var notificationFilter, limit, searchText, skip;
    skip = params.skip;
    limit = params.limit;
    searchText = params.searchText;
    var status = params.status;
    var isRead = params.isRead;
    var type = params.type;
    var data = {}
    filter = [];
    notificationFilter = {
      networkOwner: networkOwnerId
    };
    if (status && status !== undefined) {
      notificationFilter = {
        networkOwner: networkOwnerId,
        status: status
      };
    }
    if (status === "PENDING") {
      notificationFilter = {
        networkOwner: networkOwnerId,
        $or: [{
            type: "MEDIA",
            status: status,
          },
          {
            type: "REPLACE_MEDIA",
            status: {
              $exists: false
            }
          }
        ]
      }
    }
    if (status === "APPROVED") {
      notificationFilter = {
        networkOwner: networkOwnerId,
        status: status,
        $and: [{
            type: {
              $ne: "PREAPPROVED"
            },
          },
          {
            type: {
              $ne: "REPLACE_MEDIA_PREAPPROVED"
            }
          }
        ]
      }
    }
    if (isRead === false) {
      notificationFilter = {
        networkOwner: networkOwnerId,
        isRead: isRead
      };
    }
    if (type && type !== undefined) {
      if (type === "PREAPPROVED") {
        notificationFilter = {
          networkOwner: networkOwnerId,
          $or: [{
              type: type,
              status: "APPROVED"
            },
            {
              type: "REPLACE_MEDIA_PREAPPROVED",
              status: "APPROVED"
            }
          ],
        };
      } else {
        notificationFilter = {
          networkOwner: networkOwnerId,
          type: type
        };
      }
    }
    if (type && type !== undefined && status === null) {
      notificationFilter = {
        networkOwner: networkOwnerId,
        type: type,
        status: status
      };
    }
    try {
      var notifications = await (Notification.find(notificationFilter).populate('sign').populate('media').populate('oldMedia').populate('campaign').populate({
        path: 'campaign',
        populate: {
          path: 'media'
        }
      }).populate('networkOwner').populate('advertiser').populate('childs').sort('-createdAt').lean())
      var _notifications = []
      var __notifications = []
      var _limit = 0;
      for (var i = 0; i < notifications.length; i++) {
        var notification = notifications[i]
        var _searchText = searchText.toLowerCase()
        if ((notification.media && notification.media.name.toLowerCase().indexOf(_searchText) >= 0) || (notification.sign && notification.sign.name.toLowerCase().indexOf(_searchText) >= 0) || (notification.campaign && notification.campaign.name.toLowerCase().indexOf(_searchText) >= 0)) {
          _notifications.push(notification)
        }
      }
      data.count = _notifications.length
      _limit = skip + limit
      __notifications = _notifications.slice(skip, _limit)
      var preApprovedAdvertiser = {}
      let query = {
        user: user._id.toString(),
        status: "TRUSTED"
      }
      let usersList = await(UserServ.getApprovedOrBlockedUsersList(query))
      // user = await (User.findOne({
      //   _id: user._id
      // }).lean())
      usersList.map(user => preApprovedAdvertiser[user.whichUser._id] = user.whichUser._id )
      // if (user.preApprovedAdvertiser) {
      //   for (let i = 0; i < user.preApprovedAdvertiser.length; i++) {
      //     preApprovedAdvertiser[user.preApprovedAdvertiser[i]] = user.preApprovedAdvertiser[i]
      //   }
      // }
      for (let i = 0; i < __notifications.length; i++) {
        let notification = __notifications[i];
        let notificationUser = await (User.findOne({
          advertiserId: notification.advertiser._id
        }))
        if (preApprovedAdvertiser[notificationUser._id.toString()]) {
          notification.alreadyInPreapprovedList = true
        } else {
          notification.alreadyInPreapprovedList = false
        }
      }
      data.notifications = __notifications
      return resolve(data);
    } catch (err) {
      return reject(err);
    };
  });
  return promise;
};

this.getPaginationForTopNavNotification = networkOwnerId => {
  var promise;
  promise = new Promise(async (resolve, reject) => {
    let data = {}
    let notificationFilter = {
      networkOwner: networkOwnerId
    };
    try {
      var notifications = await (Notification.find(notificationFilter).populate('sign').populate('media').populate('oldMedia').populate('campaign').populate({
        path: 'campaign',
        populate: {
          path: 'media'
        }
      }).populate('networkOwner').populate('advertiser').populate('childs').sort('-createdAt').lean().skip(0).limit(5))
      data.notifications = notifications
      return resolve(data);
    } catch (err) {
      return reject(err);
    };
  });
  return promise;
};

// this.getPaginationNotificationCount = function(params, networkOwnerId) {
//   var promise;
//   promise = new Promise(function(resolve, reject) {
//     var notificationFilter, filter;
//     var searchText = params.searchText;
//     var status = params.status;
//     var isRead = params.isRead;
//     var type = params.type;
//     filter = [];
//     notificationFilter = {
//       networkOwner: networkOwnerId
//     };
//     if (status && status !== undefined) {
//       notificationFilter = {
//         networkOwner: networkOwnerId,
//         status: status
//       };
//     }
//     if (isRead === false) {
//       notificationFilter = {
//         networkOwner: networkOwnerId,
//         isRead: isRead
//       };
//     }
//     if (type && type !== undefined) {
//       notificationFilter = {
//         networkOwner: networkOwnerId,
//         type: type
//       };
//     }
//     if (type && type !== undefined && status === null) {
//       notificationFilter = {
//         networkOwner: networkOwnerId,
//         type: type,
//         status: status
//       };
//     }
//     Notification
//     .find(notificationFilter)
//     .populate('sign')
//     .populate('media')
//     .populate('campaign')
//     .populate({path: 'campaign', populate: {path: 'media'}})
//     .populate('networkOwner')
//     .populate('advertiser')
//     .sort('-createdAt')
//     .then(function(notifications) {
//       var _notifications = []
//       for (var i = 0; i < notifications.length; i++) {
//         var notification = notifications[i]
//         var _searchText = searchText.toLowerCase()
//         if ((notification.media && notification.media.name.toLowerCase().indexOf(_searchText) >= 0) || (notification.sign && notification.sign.name.toLowerCase().indexOf(_searchText) >= 0) || (notification.campaign && notification.campaign.name.toLowerCase().indexOf(_searchText) >= 0)) {
//           _notifications.push(notification)  
//         }
//       }
//       return resolve(_notifications.length);
//     }).catch(function(err){
//       return reject(err)
//     });
//   });
//   return promise;
// };

module.exports = this;