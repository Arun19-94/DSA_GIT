const path = require('path');

const Config = require('../../config/config');

const AuthService = require('./auth.service');

const index = `${Config.server.context}/api/auth`;

const join = link => index + (link != null ? link : '');

const AuthCognitoServ = require('../../components/auth/cognito/auth')

const GoogleAuthOServ = require('../../components/auth/google-auth')

module.exports = (app) => {
  app.get(join('/'), this.currentUser);
  app.post(join('/'), this.login);
  app.post(join('/logout'), this.logout);
  app.post(join("/login/facebook"), this.facebookLogin);
  app.post(join("/google/auth"), this.googleAuth);
  app.get(join("/google/authenticated"), this.googleAuthenticated);
  app.put(join("/:id/switchUserType"), AuthCognitoServ.isAuthenticated(), this.changeUserType)
};

this.currentUser  = (req, res) => {
  let user = req.session.user;
  if(user) {
    return res.json(user);
  }
  return res.status(400).send('Invalid session');
};

this.login = (req, res) => {
  // const { user } = req.body;
  // console.log(user)
  // AuthService.login(req, user).then((_user) => {
  //   return res.json({ _user });
  // }).catch((err) => {
  //   return res.status(400).send(err);
  // });
  const { user } = req.body;
  console.log(user)
  if ((user == null)) {
    return res.status(400).send("user not found");
  }
  user.email = user.email.toLowerCase()
  return AuthCognitoServ
    .login(user, req)
    .then(function(result) { res.send(result)}).catch(function(err) { console.log(err);res.status(400).send(err)});
};

this.logout = (req, res) => {
  delete req.session.user;
  if (req.session.newCampaign)
    delete req.session.newCampaign
  res.json({status: 'OK'});
};

this.facebookLogin = async (req, res) => {
  let user = req.body;
  if ((user == null)) {
    return res.status(400).send("user not found");
  }
  try {
    let result = await(AuthCognitoServ.facebookLogin(user, req));
    return res.status(200).send(result);
  } catch (e) {
    console.log(e);
    return res.status(400).send(e);
  }
};

this.googleAuth = async (req, res) => {
  let { redirectUrl } = req.body;
  if(redirectUrl) {
    req.session.redirectUrl = redirectUrl;
  }

  let data = await GoogleAuthOServ.authenticate()
  res.status(200).send(data);
};

this.googleAuthenticated = async (req, res) => {
  await GoogleAuthOServ.authenticated(req, res)
  let url = Config.baseURL
  if(req.session.redirectUrl) {
    url = `${url}${req.session.redirectUrl}`
  }
  res.redirect(url);
}

this.changeUserType = async (req, res) => {
  let { id } = req.params;
  let { userType } = req.body
  try {
    if (userType === "advertiser")
      userType = "networkOwner"
    else
      userType = "advertiser"
    let user = await (AuthService.update({ _id: id }, { userType: userType }))
    req.session.newCampaign = null
    req.session.requestFrom = null
    req.session.campaignId = null
    req.session.user = user
    res.send(user)
  } catch (err) {
    res.status(400).send(err)
  }
};