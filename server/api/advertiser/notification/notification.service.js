var Promise = require('bluebird');

var Notification = require('./notification.schema');

var io = require('../../../components/socket/client.socketIO.service');

var mongoose = require('mongoose');

this.create = async (notification) => {
  var _notification = notification
  var promise = new Promise(async (resolve, reject) => {
    try {
      var notification = _notification
      notification = new Notification(notification);
      var notification = await (notification.save())
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

this.find = (query = {}) => {
  return Notification
    .find(query).populate('sign').populate('media').populate('campaign').populate('networkOwner').populate('advertiser').sort('-createdAt');
};

this.findOneById = (query = {}) => {
  return Notification
    .findOne(query).populate('sign').populate('media').populate('campaign').populate('networkOwner').populate('advertiser').sort('-createdAt');
};

this.notifyCount = (advertiserId, query = {}) => {
  Notification.count(query)
    .then(count => {
      var key = advertiserId + 'NOTIFICATION_UPDATE_COUNT';
      io.sendUser(advertiserId, key, {
        type: 'NOTIFICATION_UPDATE_COUNT',
        message: count
      });
    })
};

this.notifyRefreshList = advertiserId => {
  var key = advertiserId + 'NOTIFICATION_REFRESH_LIST';
  io.sendUser(advertiserId, key, {
    type: 'NOTIFICATION_REFRESH_LIST',
    message: {}
  });
};

this.unReadNotifyRefreshList = advertiserId => {
  var key = advertiserId + 'UNREAD_NOTIFICATION_REFRESH_LIST';
  io.sendUser(advertiserId, key, {
    type: 'UNREAD_NOTIFICATION_REFRESH_LIST',
    message: {}
  });
};

this.rejectNotifyRefreshList = advertiserId => {
  var key = advertiserId + 'REJECT_NOTIFICATION_REFRESH_LIST';
  io.sendUser(advertiserId, key, {
    type: 'REJECT_NOTIFICATION_REFRESH_LIST',
    message: {}
  });
};

this.approveNotifyRefreshList = advertiserId => {
  var key = advertiserId + 'APPROVE_NOTIFICATION_REFRESH_LIST';
  io.sendUser(advertiserId, key, {
    type: 'APPROVE_NOTIFICATION_REFRESH_LIST',
    message: {}
  });
};

this.update = (_id, notification) => {
  var notifyCount = this.notifyCount
  var notifyRefreshList = this.notifyRefreshList
  var promise = new Promise((resolve, reject) => {
    let _notification = JSON.stringify(notification)
    notification = JSON.parse(_notification)
    delete notification.createdAt
    delete notification.updatedAt
    return Notification.findOneAndUpdate({ _id }, { '$set': notification }, { new: true }, (err, result) => {
      if (err) {
        return reject(err);
      } else if (result === null) {
        return reject(new Error("Notification not exists!"));
      } else {
        notifyCount(result.advertiser.toString(), { advertiser: result.advertiser.toString(), isRead: false })
        notifyRefreshList(result.advertiser.toString())
        return resolve(result);
      }
    });
  });
  return promise;
};

this.markAsRead = (_id, notification) => {
  var notifyCount = this.notifyCount
  var promise = new Promise((resolve, reject) => {
    return Notification.findOneAndUpdate({ _id }, { '$set': notification }, { new: true }, (err, result) => {
      if (err) {
        return reject(err);
      } else if (result === null) {
        return reject(new Error("Notification not exists!"));
      } else {
        //CampaignServ.updateCampaignStatus(result.campaign.toString(), result.media.toString(), result.sign.toString(), result.status)
        notifyCount(result.advertiser.toString(), { advertiser: result.advertiser.toString(), isRead: false })
        return resolve(result);
      }
    });
  });
  return promise;
};

this.getPaginationNotifications = (params, advertiserId) => {
  var promise = new Promise(async (resolve, reject) => {
    var notificationFilter, limit, searchText, skip;
    skip = params.skip;
    limit = params.limit;
    searchText = params.searchText;
    var status = params.status;
    var isRead = params.isRead;
    var type = params.type;
    notificationFilter = {
      advertiser: advertiserId
    };
    if (status && status !== undefined) {
      notificationFilter = {
        advertiser: advertiserId,
        status: status
      };
    }
    if (isRead === false) {
      notificationFilter = {
        advertiser: advertiserId,
        isRead: isRead
      };
    }
    if (type && type !== undefined) {
      notificationFilter = {
        advertiser: advertiserId,
        type: type
      };
    }
    if (!status) {
      // notificationFilter. = { $ne: "CANCELED" }
      notificationFilter["$and"]= [
        { status: { $ne: "CANCELED" } },
        { status: { $ne: "PENDING" } }
      ]
    }
    try {
      let notifications = await (Notification.find(notificationFilter).populate('sign').populate('media').populate('oldMedia').populate('campaign').populate({ path: 'campaign', populate: { path: 'media' } }).populate('networkOwner').populate('advertiser').sort('-createdAt').lean())
      var _notifications = []
      var _searchText = ''
      if (searchText)
        _searchText = searchText.toLowerCase()
      for (i = 0; i < notifications.length; i++) {
        var notification = notifications[i]
        if ((notification.media && notification.media.name.toLowerCase().indexOf(_searchText) >= 0) || (notification.sign && notification.sign.name.toLowerCase().indexOf(_searchText) >= 0) || (notification.campaign && notification.campaign.name.toLowerCase().indexOf(_searchText) >= 0)) {
          _notifications.push(notification)
        }
      }
      let query = {
        advertiser: advertiserId,
        isRead: false
      }
      let unreadCount = await(Notification.count(query))
      let data = {
        notifications: _notifications.slice(skip, limit),
        count: _notifications.length,
        unreadNotificationCount: unreadCount
      }
      return resolve(data);
    } catch (err) {
      return reject(err);
    }
  });
  return promise;
};

// this.getPaginationNotificationCount = function(params, advertiserId) {
//   var promise;
//   promise = new Promise(function(resolve, reject) {
//     var notificationFilter, filter;
//     var searchText = params.searchText;
//     var status = params.status;
//     var isRead = params.isRead;
//     var type = params.type;
//     filter = [];
//     notificationFilter = {
//       advertiser: advertiserId
//     };
//     if (status && status !== undefined) {
//       notificationFilter = {
//         advertiser: advertiserId,
//         status: status
//       };
//     }
//     if (isRead === false) {
//       notificationFilter = {
//         advertiser: advertiserId,
//         isRead: isRead
//       };
//     }
//     if (type && type !== undefined) {
//       notificationFilter = {
//         advertiser: advertiserId,
//         type: type
//       };
//     }
//     if (!status) {
//       notificationFilter.status = { $ne: "CANCELED"}
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

this.getNotificationCount = advertiserId => {
  var promise = new Promise(async (resolve, reject) => {
    try {
      var notificationsCount = await (Notification.aggregate(
        [
          {
            "$match": {
              advertiser: mongoose.Types.ObjectId(advertiserId),
              status: { $exists: true }
            }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ])
      )
      let approvedCount = 0
      let unapprovedCount = 0
      let rejectedCount = 0
      let unreadCount = 0
      for (let i = 0; i < notificationsCount.length; i++) {
        let _count = notificationsCount[i];
        if (_count._id === "APPROVED") {
          approvedCount = _count.count
        }
        if (_count._id === "UNAPPROVED") {
          unapprovedCount = _count.count
        }
        if (_count._id === "REJECTED") {
          rejectedCount = _count.count
        }
      }
      let query = {
        advertiser: mongoose.Types.ObjectId(advertiserId),
        isRead: false
      }
      unreadCount = await (Notification.count(query))
      let data = {
        approvedNotificationsCount: approvedCount,
        unApprovedNotificationsCount: unapprovedCount,
        unReadCountNotificationsCount: unreadCount,
        rejectedNotificationsCount: rejectedCount
      }
      return resolve(data)
    } catch (err) {
      return reject(err)
    }
  });
  return promise;
}

this.getPaginationTopNavNotifications = advertiserId => {
  var promise;
  promise = new Promise(async (resolve, reject) => {
    var notificationFilter;
    notificationFilter = {
      advertiser: advertiserId
    };
    try {
      let notifications = await (Notification.find(notificationFilter).populate('sign').populate('media').populate('oldMedia').populate('campaign').populate({ path: 'campaign', populate: { path: 'media' } }).populate('networkOwner').populate('advertiser').sort('-createdAt').lean().limit(5))
      let data = {
        notifications: notifications
      }
      return resolve(data);
    } catch (err) {
      return reject(err);
    }
  });
  return promise;
};

module.exports = this;