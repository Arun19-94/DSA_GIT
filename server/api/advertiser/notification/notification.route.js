var config = require('../../../config/config.js');

var path = require("path");

var index = `${config.server.context}/api/advertiser/notification`;

var NotificationServ = require("./notification.service");

var AuthCognitoServ = require('../../../components/auth/cognito/auth');

var join = link => path.join(index, link != null ? link : "");

module.exports = app => {

  // Search notification 
  app.get(join("/:query"), AuthCognitoServ.isAuthenticated(), paginationForNotification);

  app.get(join("/:query/count"), notificationCount);

  app.get(join("/:query/unreadNotificationCount"), unreadNotificationCount);

  app.post(join("/:id"), update);

  app.post(join("/:id/markAsRead"), markAsRead);

  app.get(join("/:id/getSingleNotification"), AuthCognitoServ.isAuthenticated(), getNotificationById);

  // app.post(join("/"), AuthCognitoServ.isAuthenticated(), paginationForNotification);

  app.get(join("/notification/paginationForTopNavNotification"), AuthCognitoServ.isAuthenticated(), paginationForTopNavNotification);

};

var notificationCount = async (req, res) => {
  let query = JSON.parse(req.params.query)
  try {
    var count = await (NotificationServ.getNotificationCount(query.advertiser))
    return res.send(count)
  } catch (err) {
    return res.status(400).send(err)
  }
  // return NotificationServ
  //   .count(query)
  //   .then(result => res.send({count: result})).catch(err => res.status(400).send(err));
};

var unreadNotificationCount = async (req, res) => {
  let query = JSON.parse(req.params.query)
  try {
    var count = await (NotificationServ.count(query))
    let data = {
      count: count
    }
    return res.send(data)
  } catch (err) {
    return res.status(400).send(err)
  }
}

var getNotificationById = async (req, res) => {
  var user = req.user;
  var { id } = req.params;
  try {
    if (!user)
      return res.status(401).send('Access denied.')
    let notification = await(NotificationServ.findOneById({_id: id}))
    return res.send(notification)
  } catch (err) {
    return res.status(400).send(err)
  }
}

var notificationList = (req, res) => {
  var query = JSON.parse(req.params.query)
  return NotificationServ
    .find(query)
    .then(result => res.send(result)).catch(err => res.status(400).send(err));
};

var update = (req, res) => {
  var { id } = req.params;
  var { notification } = req.body;
  return NotificationServ
    .update(id, notification)
    .then(result => res.send(result)).catch(err => res.status(400).send(err));
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
  var advertiserId, params, user;
  user = req.user;
  advertiserId = user.advertiserId;
  params = JSON.parse(req.params.query);
  try {
    let data = await (NotificationServ.getPaginationNotifications(params, advertiserId))
    return res.send(data);
  } catch (err) {
    return res.status(400).send(err.message);
  }
};

var paginationForTopNavNotification = async (req, res) => {
  var advertiserId, user;
  user = req.user;
  advertiserId = user.advertiserId;
  try {
    let data = await (NotificationServ.getPaginationTopNavNotifications(advertiserId))
    return res.send(data);
  } catch (err) {
    return res.status(400).send(err.message);
  }
};