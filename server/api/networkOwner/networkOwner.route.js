var config = require('../../config/config.js');

var path = require("path");

var AuthCognitoServ = require('../../components/auth/cognito/auth');

var NetworkOwnerServ = require('./networkOwner.service')

var index = `${config.server.context}/api/networkOwner`;

var join = link => path.join(index, link != null ? link : "");

module.exports = app => {

  app.get(join("/:dateFilter/dashboard"), AuthCognitoServ.isAuthenticated(), dashboardDetails);

  app.get(join("/:query"), AuthCognitoServ.isAuthenticated(), getRevenue);

};

var dashboardDetails = async (req, res) => {
  try {
    let user = req.user
    let dateFilter = JSON.parse(req.params.dateFilter)
    let result = await (NetworkOwnerServ._getDashboardData(user.networkOwnerId, user.advertiserId, dateFilter))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
}

var getRevenue = async (req, res) => {
  try {
    let user = req.user
    let dateFilter = JSON.parse(req.params.query)
    let result = await (NetworkOwnerServ.getFilteredRevenue(user.networkOwnerId, dateFilter))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
}