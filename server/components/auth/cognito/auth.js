/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
var config = require('../../../config/config.js');

var Promise = require('bluebird');
var AWS = require('aws-sdk');
var CognitoSDK = require('amazon-cognito-identity-js-node');
var compose = require('composable-middleware');

var s3Config = config.aws.s3;
var options = {
  accessKeyId: s3Config.key,
  secretAccessKey: s3Config.secret,
};
AWS.config = new AWS.Config(options);

AWS.CognitoIdentityServiceProvider.AuthenticationDetails = CognitoSDK.AuthenticationDetails;
AWS.CognitoIdentityServiceProvider.CognitoUserPool = CognitoSDK.CognitoUserPool;
AWS.CognitoIdentityServiceProvider.CognitoUser = CognitoSDK.CognitoUser;
AWS.CognitoIdentityServiceProvider.CognitoUserAttribute = CognitoSDK.CognitoUserAttribute;
var { CognitoIdentityServiceProvider } = AWS;
var client = new CognitoIdentityServiceProvider({ apiVersion: '2016-04-18', region: 'us-west-2' });

var { CognitoUserPool } = AWS.CognitoIdentityServiceProvider;
var userPool = new AWS.CognitoIdentityServiceProvider.CognitoUserPool(config.cognito.poolData);

var UserServ = require('../../../api/user/user.service');
var LoginHistoryServ = require('../../../api/user/login.history/login.history.service');
var WhiteListingServ = require('../../../api/user/white_listing/white_listing.service');
//var CustomerServ     = require('../../../api/customer/customer.service');
// var RoleServ         = require('../../../api/admin/role/role.service');

var MailServ = require('../../mail/mail');

// var async          = require('asyncawait/async');

// var await          = require('asyncawait/await');

var randomstring = require('randomstring');

this.signUpCognito = (user, sendWelcomeMessage) =>
  new Promise(async(resolve, reject) => {
    var attributeList = [];
    var attributeEmail = new (AWS.CognitoIdentityServiceProvider.CognitoUserAttribute)('email', user.email);
    attributeList.push(attributeEmail);
    return userPool.signUp(user.email, user.password, attributeList, null, function (err, result) {
      if (err) {
        // Handle user already exists in amazon congnito server
        if (err.code === 'UsernameExistsException') {
          return UserServ.findOne({ email: user.email })
            .then(function (eUser) {
              if (eUser) {
                // Throw err if user already exists amazon cognito server and local db
                err = {
                  code: 'UsernameExistsException',
                  message: 'User already exists.'
                };
                return reject(err);
              } else {
                // Create local db user if user already exists in amazon cognito server and not exists in local db
                return UserServ.createLocalUser(user)
                  .then(_user => resolve(_user)).catch(err => reject(err));
              }
            });
        } else {
          // Throw if any other err from amazon congnito server
          return reject(err);
        }
      } else {
        if (sendWelcomeMessage) {
          MailServ.sendMail('noreply@digitalsmartads.com', [user.email], 'Welcome', '<h4>Welcome to ' + config.baseURL + '</h4><h5>Please use ' + user.password + ' to login</h5>')
        }
        // Handle user successfully created in amazon congnito server
        return UserServ.findOne({ email: user.email })
          .then(function (eUser) {
            if (eUser) {
              // Return success if user already exists in local db
              return resolve(user);
            } else {
              // Create local db user if user successfully created in amazon cognito server and not exists in local db
              return UserServ.createLocalUser(user)
                .then(_user => resolve(_user)).catch(err => reject(err));
            }
          });
      }
    });
  })
  ;

this.login = (user, req) =>
  new Promise(function (resolve, reject) {
    if (config.runningMode === 'automation') {
      var jwtToken = randomstring.generate();
      return setUserSession(user, jwtToken, req)
        .then(function (result) {
          return resolve(result)
        }).catch(function (err) {
          return reject(err)
        });
    }
    return authenticateUser(user)
      .then(function (jwtToken) {
        setUserSession(user, jwtToken, req)
          .then(function (result) {
            return resolve(result)
          }).catch(function (err) {
            return reject(err)
          });
      }).catch(function (err) {
        return reject(err)
      });
  })
  ;

  this.facebookLogin = async (user, req) => {
    let eUser;
    try {
      eUser = await(UserServ.findOne({$or:[{ email: user.email },{facebookId: user.facebookId}]}))
    } catch (e) {
      console.log(e)
    }
    if(!eUser) {
      try {
        if (!user.name) {
          user.name = user.email
        }
        eUser = await(UserServ.createLocalUser(user))
      } catch (e) {
        console.log(e)
        throw e;
      }
    }
    if(eUser) {
      if(user.photoUrl) {
        eUser.photoUrl = user.photoUrl
      }
      eUser = await(setUserSession(eUser, user.id_token, req, 'FACEBOOK'));
    } else {
      throw 'Something went wrong!'
    }
    return eUser;
  };

this.googelLogin = async(user, req) => {
  let eUser;
  try {
    eUser = await (UserServ.findOne({ email: user.email }))
  } catch (e) {
    console.log(e)
  }
  if (!eUser) {
    try {
      if (!user.name) {
        user.name = user.email
      }
      eUser = await (UserServ.createLocalUser(user))
    } catch (e) {
      console.log(e)
      throw e;
    }
  }
  if (eUser) {
    if(user.photoUrl) {
      eUser.photoUrl = user.photoUrl
    }
    eUser = await (setUserSession(eUser, user.id_token, req, 'GOOGLE'));
  } else {
    throw 'Something went wrong!'
  }
  return eUser;
};

var setUserSession = (user, jwtToken, req, provider = 'DSA') =>
  new Promise(function (resolve, reject) {
    UserServ.findOne({ email: user.email })
      .then(function (eUser) {
        if (!eUser) {
          var err = {
            code: 'UserNotFoundException',
            message: 'User does not exist.'
          };
          return reject(err);
        } else {
          LoginHistoryServ
            .create(req, jwtToken, eUser);
          // return RoleServ.findOne({ _id: eUser.role })
          //   .then(function (role) {
              if (req.session && req.session.requestFrom === 'guestAudiencePage') {
                eUser.userType = 'advertiser'
              }
              state = eUser.userType;
              /*if (role.ui) {
                state = role.ui;
              }*/
              let photoUrl = '';
              if(user.photoUrl) {
                photoUrl = user.photoUrl
              } else {
                if(eUser.profileImage) {
                  console.log(eUser.profileImage)
                  photoUrl = '/api/user/'+eUser._id+'/thumb/75_' + eUser.profileImage
                } else {
                  photoUrl = '/api/user/'+eUser._id+'/thumb/75_' + eUser._id
                }
              }
              eUser.photoUrl = photoUrl
              var res = {
                token: jwtToken,
                state: state,
                redirectFrom: req.session.requestFrom,
                user: eUser
              };
              //req.user = user
              eUser.provider = provider
              req.session.user = eUser;
              req.user = req.session.user;
              return resolve(res);
            // }).catch(err => reject(err));
        }
      }).catch(err => reject(err))
  })


var authenticateUser = user =>
  new Promise(function (RES, REJ) {
    var userData = {
      Username: user.email,
      Pool: userPool
    };

    var cognitoUser = new AWS.CognitoIdentityServiceProvider.CognitoUser(userData);
    var authenticationData = {
      Username: user.email,
      Password: user.password
    };

    var authenticationDetails = new AWS.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData);
    return cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess(result) {
        return RES(result.getAccessToken().getJwtToken());
      },
      onFailure(err) {
        return REJ(err);
      }
    }
    );
  })
  ;

this.isSessionValid = (token, req) =>
  new Promise(function (resolve, reject) {
    return LoginHistoryServ
      .findCognitoToken(token)
      .then(function (cognitoToken) {
        var params =
          { AccessToken: cognitoToken };
        return client.getUser(params, function (err, data) {
          if (err) {
            return reject(err);
          } else {
            var query =
              { email: data.Username };
            return UserServ
              .findOne(query)
              .then(user =>
                RoleServ.findOne({ _id: user.role })
                  .then(function (role) {
                    let state = user.userType;
                    var res = {
                      isValid: true,
                      state
                    };
                    //req.user = user
                    req.session.user = user;
                    req.user = req.session.user;
                    return resolve(res);
                  }).catch(err => reject(new Error('Something went wrong!')))).catch(err => reject(err));
          }
        });
      }).catch(err => reject(err));
  })
  ;

this.confirmCognito = user =>
  new Promise(function (resolve, reject) {
    if (user) {
      var userData = {
        Username: user.email,
        Pool: userPool
      };
      var cognitoUser = new AWS.CognitoIdentityServiceProvider.CognitoUser(userData);
      return cognitoUser.confirmRegistration(user.code, true, function (err, result) {
        if (err) {
          reject(err);
        }
        return resolve(result);
      });
    } else {
      return reject(new Error('Something went wrong.'));
    }
  })
  ;

this.resendConfimationCode = user =>
  new Promise(function (resolve, reject) {
    if (user) {
      var userData = {
        Username: user.email,
        Pool: userPool
      };
      var cognitoUser = new AWS.CognitoIdentityServiceProvider.CognitoUser(userData);
      return cognitoUser.resendConfirmationCode(function (err, result) {
        if (err) {
          reject(err);
        }
        return resolve(result);
      });
    } else {
      return reject(new Error('Something went wrong.'));
    }
  })
  ;

this.forgotPassword = user =>
  new Promise(function (resolve, reject) {
    if (user) {
      var userData = {
        Username: user.email,
        Pool: userPool
      };
      var cognitoUser = new AWS.CognitoIdentityServiceProvider.CognitoUser(userData);
      return cognitoUser.forgotPassword({
        onSuccess(result) {
          return resolve(result);
        },
        onFailure(err) {
          return reject(err);
        }
      });
    }
  })
  ;

this.confirmResetPassword = user =>
  new Promise(function (resolve, reject) {
    if (user) {
      var userData = {
        Username: user.email,
        Pool: userPool
      };
      var cognitoUser = new AWS.CognitoIdentityServiceProvider.CognitoUser(userData);
      return cognitoUser.confirmPassword(user.passwordResetCode, user.newPassword, {
        onSuccess(result) {
          return resolve(result);
        },
        onFailure(err) {
          return reject(err);
        }
      }
      );
    }
  })
  ;

this.deleteUser = user =>
  new Promise(function (resolve, reject) {
    var userData = {
      UserPoolId: config.cognito.poolData.UserPoolId,
      Username: user.email
    };
    return client.adminDeleteUser(userData, function (err, data) {
      if (err) {
        return reject(err);
      } else {
        return resolve(data);
      }
    });
  })
  ;

this.logoutCognito = (token, req) =>
  new Promise(function (resolve, reject) {
    return LoginHistoryServ
      .logoutCognito(token, req)
      .then(result => resolve(result)).catch(err => reject(err));
  })
  ;

this.getUser = function (email) {
  var promise = new Promise(function (resolve, reject) {
    var userData = {
      UserPoolId: config.cognito.poolData.UserPoolId,
      Username: email
    };
    client.adminGetUser(userData, function (err, data) {
      if (err) {
        console.log(err)
        return reject(err);
      }
      resolve(data)
    });
  });
  return promise;
};

this.isAuthenticated = (req, res, next) =>
  compose()
    .use(function (req, res, next) {
      /*{ access_token } = req.query
      if access_token
        token = access_token
      else  
        token = req.headers.authorization
        token = req.headers.authorization.replace 'Bearer ', ''*/

      if (!req.session || !req.session.user) {
        res.status(401).json(new Error("Session Invalid"));
        return;
      }
      req.user = req.session.user;
      return next();

      /*
      LoginHistoryServ
        .findActiveUser token
        .then (user) ->
          req.user = user
          next()
        .catch (err) ->
          next err
      */
    })
  ;

this.isAdmin = (req, res, next) =>
  compose()
    .use(async(function (req, res, next) {
      var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
      ip = ip.split(',')[0];
      ip = ip.split(':').slice(-1);
      if (ip && (ip.length > 0)) {
        ip = ip[0];
      }
      console.log("ip- test--")
      console.log(ip)
      var query = { ip: ip }
      var addressOfAdmin = await(WhiteListingServ.findByQuery(query))
      if (!addressOfAdmin || addressOfAdmin.length <= 0) {
        delete req.session.user;
        delete req.session.newCampaign
        delete req.session.requestFrom
        delete req.session.campaignId
        res.status(401).json(new Error("Session Invalid"));
        return;
      }
      if (!req.session || !req.session.user) {
        res.status(401).json(new Error("Session Invalid"));
        return;
      }
      req.user = req.session.user;
      return next();

    })
    );

this.uiAuth = (req, res, next) =>
  compose()
    .use(function (req, res, next) {
      if (!req.session || !req.session.user) {
        res.status(400).send('invalid session')
        return;
      }
      req.user = req.session.user;
      return next();
    })
  ;

this.setCurrentSession = (req, res, next) =>
  compose()
    .use(function (req, res, next) {
      /*{ access_token } = req.query
      if access_token
        token = access_token
      else  
        token = req.headers.authorization
        token = req.headers.authorization.replace 'Bearer ', ''*/

      if (!req.session || !req.session.user) {
        //res.status(401).json(new Error("Session Invalid"));
        return next();
      }
      req.user = req.session.user;
      return next();

      /*
      LoginHistoryServ
        .findActiveUser token
        .then (user) ->
          req.user = user
          next()
        .catch (err) ->
          next err
      */
    })
  ;
