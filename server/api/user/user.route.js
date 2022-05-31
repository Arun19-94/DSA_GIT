const request = require('request');

const Config = require('../../config/config');

const UserService = require('./user.service');

const User = require('./user.schema');

// const ResellerService = require('../admin/reseller/reseller.service')

const AuthCognitoServ = require('../../components/auth/cognito/auth')

const index = `${Config.server.context}/api/user`;

const join = link => index + (link != null ? link : '');

module.exports = (app) => {
  app.get(join("/me"), AuthCognitoServ.isAuthenticated(), this.getProfile);
  app.patch(join("/"), AuthCognitoServ.isAuthenticated(), this.updateProfileImage);
  app.get(join('/'), this.findAll);
  app.get(join('/:id'), this.findOne);
  // app.post(join('/'), this.create);
  app.post(join('/'), this.create);
  app.put(join('/:id'), AuthCognitoServ.isAuthenticated(), this.update);
  // app.post(join('/loginUser'), this.loginUser);
  app.delete(join('/:id'), this.delete);
  //Download Profile image
  app.get(join("/:id/image/:fileName"), AuthCognitoServ.isAuthenticated(), this.downloadProfileImage);

  //Download Profile thumb
  app.get(join("/:id/thumb/:fileName"), AuthCognitoServ.isAuthenticated(), this.downloadProfileThumb);

  app.post(join("/profile/upload"), AuthCognitoServ.isAuthenticated(), this.uploadProfileImage);

  app.post(join("/password/forgot"), this.forgotPassword);

  app.post(join("/password/change"), this.confirmResetPassword);

  app.get(join('/:id/getTrustedAdvertisersList'), this.getTrustedAdvertisersList);

  app.get(join("/forAdd/addAdvertiser/ADVERTISER/:query"), this.getAllAdvertiser);

  app.get(join("/user/updatedUser"), AuthCognitoServ.isAuthenticated(), this.getUpdatedUser);

  app.get(join("/:query/getFilteredBlacklistedUser"), AuthCognitoServ.isAuthenticated(), this.getBlacklistedUser);

  app.get(join("/:query/getFilteredRestrictedUsers"), AuthCognitoServ.isAuthenticated(), this.getRestrictedUser);

  app.get(join("/:query/getRestrictedUsers"), AuthCognitoServ.isAuthenticated(), this.getRestrictedUsers);

  app.get(join("/:query/getIsRestrictedUsers"), AuthCognitoServ.isAuthenticated(), this.getIsRestrictedUsers);
  
  app.put(join('/:id/restictedUserUpdate'), AuthCognitoServ.isAuthenticated(), this.updateRestictedUser);

};

this.getProfile = async (req, res) => {
  if (req.session.user == null) {
    return res.status(401).send('Unauthorized');
  } else {
    let user = await (UserService.findOneById(req.session.user._id))
    req.session.user.profileImage = user.profileImage
    req.user.profileImage = req.session.user.profileImage
    return res.send(req.session.user);
  }
};

this.updateProfileImage = (req, res) => {
  let user = req.session.user
  if (user == null) {
    return res.status(401).send('Unauthorized');
  } else {
    let { profileImage } = req.body
    req.session.user.profileImage = profileImage
    let photoUrl = '/api/user/'+user._id+'/thumb/75_' + profileImage
    req.user.photoUrl = photoUrl
    return res.send(req.session.user);
  }
};


this.findAll = (req, res) => {
  res.send([{ _id: '11225512aaa54sds55', name: 'Richardson M', company: 'Digital Smart Ads' }, { _id: '11225512aaa54sds56', name: 'Vinoth Kumar S', company: 'Digital Smart Ads.com' }]);
};

this.findOne = (req, res) => {
  res.send({ username: 'Hello world' });
};

this.get = (req, res) => {
  res.send({ username: 'Hello world' });
};

this.create = (req, res) => {
  const { company, user } = req.body;
  UserService.create({ name: company }, user)
    .then((_user) => {
      return res.send(_user);
    }).catch((err) => {
      return res.status(400).send(err);
    });

};

this.create = async (req, res) => {
  let user = req.body;
  if ((user == null)) {
    return res.status(400).send("user not found");
  }
  // let reseller = await (ResellerService.findOne(Config.reseller))
  // user.reseller = reseller
  user.type = "CUSTOMER_ADMIN"
  user.email = user.email.toLowerCase()
  var { recaptchaResponse } = user;
  var url = `https://www.google.com/recaptcha/api/siteverify?secret=6LcnYzAUAAAAAG5gumTfH21OP3yHGxaEJ0J-UkF9&response=${recaptchaResponse}`;
  return request.post({
    url,
    timeout: 5000
  }, function (err, result, body) {
    if (err) {
      console.log(err);
      res.status(400).send("Captcha Error");
    }
    //console.log  body
    user.userType = "advertiser"
    AuthCognitoServ
      .signUpCognito(user, undefined)
      .then(result => res.send(result)).catch(function (err) {
        console.log(err);
        return res.status(400).send(err);
      });
  });
};

this.loginUser = (req, res) => {
  let user = req.body;
  if ((user == null)) {
    return res.status(400).send("user not found");
  }
  user.email = user.email.toLowerCase()
  return AuthCognitoServ
    .login(user, req)
    .then(function (result) { res.send(result) }).catch(function (err) { console.log(err); res.status(400).send(err) });
};

this.update = async(req, res) => {
  try {
    let user = req.body
    delete user.createdAt
    delete user.updatedAt
    let updatedUser = await(UserService.update(user))
    user = await(UserService.findOneById(updatedUser._id))
    // user.preApprovedAdvertiser
    req.session.user = user
    return res.send(user);
  } catch (err) {
    return res.status(400).send(err);
  }
  // let cUser = req.user;
  // delete user.createdAt
  // delete user.updatedAt
  // UserService.update(user)
  // .then((_user) => {
  //   if(cUser && cUser._id == user._id) {
  //     UserService.findOneById(_user._id).then(updatedUser => {
  //       req.session.user.name = updatedUser.name
  //       req.session.user.company = updatedUser.company
  //       req.session.user = updatedUser
  //       return res.send(updatedUser);
  //     })
  //   }
  // }).catch((err) => {
  //   return res.status(400).send(err);
  // });
};

this.delete = (req, res) => {
  res.send({ username: 'Hello world' });
};

this.downloadProfileImage = (req, res) => {
  let userId = req.params.id.toString();
  let fileName = req.params.fileName;
  let url = Config.aws.s3.publicURL + '/user/profile/' + userId + '/' + fileName
  res.redirect(url)
};

this.downloadProfileThumb = (req, res) => {
  let userId = req.params.id.toString();
  let fileName = req.params.fileName;
  let url = Config.aws.s3.publicURL + '/user/profile/' + userId + '/thumb/' + fileName
  res.redirect(url)
};


this.uploadProfileImage = (req, res) => {
  let user = req.user;
  if(!user.advertiserId) {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  if(!req.files.file && req.files.file.length <= 0) {
    return res.status(400).send(new Error('No files upload.'))
  }
  let file = req.files.file
  console.log(file)
  UserService.uploadProfileImage(user, file, req, res)
  .catch((err) => {
    console.log(err)
    return res.status(400).send(err);
  });
}

this.forgotPassword = async(req, res) => {
  const { user } = req.body;
  if(!user) {
    return res.status(400).send("user not found"); 
  }
  let _user = await(UserService.findOne(user)) 
  if (!_user || !_user._id) {
    return res.status(400).send("user not found");
  }
  return AuthCognitoServ
    .forgotPassword(user)
    .then(result => res.send(result)).catch(err => res.status(400).send(err));
}

this.confirmResetPassword = (req, res) => {
  const { user } = req.body;
  if (!user) {
    return res.status(400).send("user not found");
  }
  return AuthCognitoServ
    .confirmResetPassword(user)
    .then(result => res.send(result)).catch(err => res.status(400).send(err));
};

this.getTrustedAdvertisersList = async (req, res) => {
  try {
    let userId = req.params.id
    let user = await(UserService.findOneById(userId))
    return res.send(user.preApprovedAdvertiser)
  } catch (err) {
    return res.status(400).send(err)
  }
};

this.getAllAdvertiser = async(req, res) => {
  try {
    let data = JSON.parse(req.params.query)
    let _user = await(UserService.findOne({_id: data.userId.toString()}))
    let limit = data.limit
    let skip = data.skip
    let includedUserId = []
    // if (_user.preApprovedAdvertiser.length > 0) {
    //   for (let i = 0; i < _user.preApprovedAdvertiser.length; i++) {
    //     if (_user.preApprovedAdvertiser[i]._id)
    //       includedUserId.push(_user.preApprovedAdvertiser[i]._id)
    //     else
    //       includedUserId.push(_user.preApprovedAdvertiser[i])
    //   }
    // }
    // includedUserId.push(_user._id)
    let searchText
    if (data.searchText)
      searchText = data.searchText
    let allUser = await(UserService.getAllAdvertiser(includedUserId, searchText, skip, limit, _user.networkOwnerId, _user.advertiserId))
    return res.send(allUser);
  } catch (err) {
    console.log(err)
    return res.status(400).send(err)
  }
}

this.getUpdatedUser = async (req, res) => {
  let user = await (UserService.findOneById(req.session.user._id))
  req.session.user = user
  return res.send(user);
};

this.getBlacklistedUser = async (req, res) => {
  try {
    let data = JSON.parse(req.params.query)
    let result = await(UserService.getBlacklistedUser(data.userId, data.searchText, data.skip, data.limit))
    return res.send(result);
  } catch(err) {
    return res.status(400).send(err)
  }
};

this.getRestrictedUser = async (req, res) => {
  try {
    let data = JSON.parse(req.params.query)
    let result = await(UserService.getRestrictedUser(data.userId, data.status, data.searchText, data.skip, data.limit))
    return res.send(result);
  } catch(err) {
    return res.status(400).send(err)
  }
};

this.getRestrictedUsers = async (req, res) => {
  try {
    let data = JSON.parse(req.params.query)
    let users = await(UserService.getRestrictedUsers(data))
    return res.send(users)
  } catch (err) {
    return res.status(400).send(err)
  }
};


this.getIsRestrictedUsers = async (req, res) => {
  try {
    let data = JSON.parse(req.params.query)
    let userId = req.session.user._id
    let users = await(UserService.getIsRestrictedUsers(data, userId))
    return res.send(users)
  } catch (err) {
    console.log(err)
    return res.status(400).send(err)
  }
};

this.updateRestictedUser = async (req, res) => {
  try {
    let data = req.body
    let result
    if (data.type && data.type==="MULTIPLE")
      result = await (UserService.updateMultipleRestictedUser(data))
    else
      await (UserService.updateRestictedUser(data))
    return res.send(result)
  } catch (err) {
    console.log(err)
    return res.status(400).send(err)
  }
}











this.init = async () => {
  try {
    console.log('Init started')
    let users = await (UserService.findForChangeSchema())
    users.map(user => {
      if (user.preApprovedAdvertiser && user.preApprovedAdvertiser.length > 0) {
        user.preApprovedAdvertiser.map(_user => {
          let data = {
            user: user._id,
            whichUser: _user._id,
            status: 'TRUSTED'
          }
          UserService.updateRestictedUser(data)
        })
      }
    })
    User.updateMany({}, { $unset: { preApprovedAdvertiser: 1 } })
    console.log('Init finished')
  } catch (err) {
    console.log(err)
  }
}

this.init()