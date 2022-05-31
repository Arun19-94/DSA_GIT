var config = require('../../../config/config.js');

var path = require("path");

var index = `${config.server.context}/api/networkOwner/notification`;

var NotificationServ = require("./notification.service");

var AdvertiserNotificationServ = require("../../advertiser/notification/notification.service");

var AuthCognitoServ = require('../../../components/auth/cognito/auth');

var User = require('../../user/user.schema');

var UserServ = require('../../user/user.service');

var join = link => path.join(index, link != null ? link : "");

module.exports = app => {

  // Search notification 
  app.get(join("/:query"), notificationList);

  app.get(join("/notifications/withDetails"), AuthCognitoServ.isAuthenticated(), notificationsListWithDetails);

  app.get(join("/notifications/:query"), AuthCognitoServ.isAuthenticated(), findAllNotificationsWithDetails);
  

  app.get(join("/:query/count"), notificationCount);

  app.post(join("/:id"), update);

  app.put(join("/:id"), AuthCognitoServ.isAuthenticated(), updateNotification);

  app.post(join("/updateBulkNotification/bulk"), updateBulkNotification);

  app.post(join("/updateBulkNotification/campaign"), unApproveCampaign);

  app.post(join("/:id/markAsRead"), markAsRead);

  app.post(join("/"), AuthCognitoServ.isAuthenticated(), paginationForNotification);

  app.get(join("/notification/paginationForTopNavNotification"), AuthCognitoServ.isAuthenticated(), paginationForTopNavNotification);

  app.post(join("/notification/approveAll"), AuthCognitoServ.isAuthenticated(), approveAllNotifications);

};

var notificationCount = (req, res) => {
  var query = JSON.parse(req.params.query)
  if (query.status === "PENDING")
    query = {
      networkOwner: req.session.user.networkOwnerId,
      $or: [
        {
          type: "MEDIA",
          status: "PENDING",
        },
        {
          type: "REPLACE_MEDIA",
          status: { $exists: false }
        }
      ]
    }
  return NotificationServ
    .count(query)
    .then(result => res.send({ count: result })).catch(err => res.status(400).send(err));
};

var notificationList = (req, res) => {
  var query = JSON.parse(req.params.query)
  return NotificationServ
    .find(query)
    .then(result => res.send(result)).catch(err => res.status(400).send(err));
};

var notificationsListWithDetails = async (req, res) => {
  try {
    let user = req.user
    let result = await(NotificationServ.findNotificationsWithDetails(user))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
};

var findAllNotificationsWithDetails = async (req, res) => {
  try {
    let user = req.user
    let query = JSON.parse(req.params.query)
    let result = await(NotificationServ.findAllNotificationsWithDetails(user, query))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
};

var update = async (req, res) => {
  var { id } = req.params;
  var { notification } = req.body;
  try {
    let result = await (NotificationServ.update(id, notification))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
};

var updateNotification = async (req, res) => {
  var { id } = req.params;
  var notification = req.body;
  try {
    let result = await (NotificationServ.update(id, notification))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
};

var updateBulkNotification = async (req, res) => {
  var { notification } = req.body;
  var { status } = req.body;
  var user = req.session.user
  try {
    // var result = await(NotificationServ.updateBulkNotification(status, notifications))
    if (status !== "read" && status !== "unread" && status !== 'trustedAdvertisers') {
      let networkOwnerIdMap = {}
      for (let notificationLength = 0; notificationLength < notification.length; notificationLength++) {
        let _notification = notification[notificationLength]
        var result = await (NotificationServ.update(_notification._id, _notification))
        networkOwnerIdMap[result.networkOwner] = result.networkOwner
      }
      for (let key in networkOwnerIdMap) {
        if (networkOwnerIdMap.hasOwnProperty(key)) {
          let networkOwnerId = networkOwnerIdMap[key]
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
          NotificationServ.notifyCount(networkOwnerId, { networkOwner: networkOwnerId, isRead: false }, userId)
          AdvertiserNotificationServ.notifyCount(user.advertiserId.toString(), { advertiser: user.advertiserId.toString(), isRead: false })
        }
      }
    } else if (status === 'trustedAdvertisers') {
      let advertisersIds = []
      for (let i = 0; i < notification.length; i++) {
        let _notification = notification[i]
        advertisersIds.push(_notification.advertiser._id.toString())
      }
      let query = {
        user: user._id.toString(),
        status: "TRUSTED",
        whichUser: { $in: advertisersIds }
      }
      let usersList = await(UserServ.getApprovedOrBlockedUsersList(query))
      // if (!user.preApprovedAdvertiser)
      //   user.preApprovedAdvertiser = []
      let preapprovedList = []
      usersList.map(user => preapprovedList.push(user.whichUser._id))
      // for (let i = 0; i < user.preApprovedAdvertiser.length; i++) {
      //   let preApprovedAdvertiser = user.preApprovedAdvertiser[i];
      //   if (preApprovedAdvertiser._id) {
      //     preapprovedList.push(preApprovedAdvertiser._id)
      //   } else {
      //     preapprovedList.push(preApprovedAdvertiser)
      //   }
      // }
      let advertiserIdMap = {}
      for (let i = 0; i < notification.length; i++) {
        let _notification = notification[i]
        if (!advertiserIdMap[_notification.advertiser._id])
          advertiserIdMap[_notification.advertiser._id] = _notification.advertiser._id
      }
      for (let key in advertiserIdMap) {
        if (advertiserIdMap.hasOwnProperty(key)) {
          let advertiserId = advertiserIdMap[key]
          let query = {
            advertiserId: advertiserId.toString()
          }
          let advertiserUser = await (User.findOne(query))
          if (advertiserUser._id.toString() !== user._id.toString() && preapprovedList.indexOf(advertiserUser._id.toString()) <= -1) {
            // user.preApprovedAdvertiser.push(advertiserUser)
            let data = {
              user: user._id,
              whichUser: advertiserUser._id,
              status: "TRUSTED"
            }
            UserServ.updateRestictedUser(data)
          }
        }
      }
      var userDeleteCreatedAt = JSON.stringify(user)
      var user = JSON.parse(userDeleteCreatedAt)
      delete user.createdAt
      var result = await (UserServ.updateForPreApproved(user._id, user))
      if (user._id === req.session.user._id) {
        req.session.user = result;
      }
    } else {
      var result = await (NotificationServ._updateBulkNotification(status, notification, user))
    }
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
  // return NotificationServ
  //   .then(result => res.send(result)).catch(err => res.status(400).send(err));
};

var unApproveCampaign = async (req, res) => {
  var params = req.body;
  if (!params._id) {
    return res.status(400).send("Please select any campaign")
  }
  var query = { campaign: params._id, status: "APPROVED" }
  var _notifications = await (NotificationServ.findQuery(query))
  var ___notifications = JSON.stringify(_notifications)
  var _notifications = JSON.parse(___notifications)
  var result = []
  for (let index = 0; index < _notifications.length; index++) {
    _notifications[index].status = "UNAPPROVED"
    // delete _notifications[index].createdAt;
    delete _notifications[index].updatedAt;
    if (params.generalReason) {
      _notifications[index].reason = params.generalReason
    }
    if (params.generalcomment) {
      _notifications[index].comment = params.generalcomment
    }
    result.push(await (NotificationServ.update(_notifications[index]._id, _notifications[index])))
  }
  return res.send(result)
};

var markAsRead = (req, res) => {
  var { id } = req.params;
  var notification = {
    isRead: true
  }
  return NotificationServ
    .markAsRead(id, notification)
    .then(result => res.send(result)).catch(err => res.status(400).send(err));
};

var paginationForNotification = async (req, res) => {
  var networkOwnerId, params, user;
  user = req.user;
  networkOwnerId = user.networkOwnerId;
  params = req.body;
  response = {};
  try {
    var data = await (NotificationServ.getPaginationNotifications(params, networkOwnerId, user))
    return res.send(data);
  } catch (err) {
    return res.status(400).send(err.message);
  };
};

var paginationForTopNavNotification = async (req, res) => {
  let user = req.user;
  let networkOwnerId = user.networkOwnerId;
  try {
    var data = await (NotificationServ.getPaginationForTopNavNotification(networkOwnerId))
    return res.send(data);
  } catch (err) {
    return res.status(400).send(err.message);
  };
};

var approveAllNotifications = async (req, res) => {
  var { notifications } = req.body;
  try {
    for (var i = 0; i < notifications.length; i++) {
      var notification = notifications[i]
      var result = await (NotificationServ.update(notification._id, notification))
    }
    res.send(result);
  } catch (err) {
    res.status(400).send(err)
  }
};