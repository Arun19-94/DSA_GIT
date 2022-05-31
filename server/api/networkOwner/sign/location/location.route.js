var config         = require('../../../../config/config.js');

var path           = require("path");

var index          = `${config.server.context}/api/networkOwner/sign/location`;

var LocationServ    = require("./location.service");

var AuthCognitoServ       = require('../../../../components/auth/cognito/auth');

var join = link => path.join(index, link != null ? link : "");

module.exports = function(app) {

  // Get locations dynamically
  app.get(join("/getLocations/:searchText"), AuthCognitoServ.isAuthenticated(), listLocations);

};

var listLocations = async(req, res) => {
  var location = JSON.parse(req.params.searchText)
  try {
    if (!location) {
      let locations = await(LocationServ.find())
      return res.send(locations)
    }
    var locations = await(LocationServ.getLocations(location))
    return res.send(locations)
  } catch(err) {
    return res.status(400).send(err) 
  }
}