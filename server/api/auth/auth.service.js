const Promise = require('bluebird');

//const jwt = require('jsonwebtoken');

const bcrypt = require('bcrypt');

const Config = require('../../config/config');

const UserService = require('../user/user.service');

const User = require('../user/user.schema')

const AdvertisersService = require('../advertiser/advertiser.service')

const NetworkOwnerService = require('../networkOwner/networkOwner.service')

this.login = (req, user) => {
  return new Promise((rs, rj) => {
    if(!user.email) {
      return rj('E-mail required');
    }
    if(!user.password) {
      return rj('Password required');
    }
    UserService.findOne({ email: user.email })
    .then(_user => {
      bcrypt.compare(user.password, _user.password).then(match => {
        if (!match) {
          return rj('Incorrect username or password.');
        }
        //const token = jwt.sign(user, Config.jwtSecret);
        delete _user.password
        req.session.user = _user
        return rs(_user);
      });
    }).catch(err => {
      return rj('Incorrect username or password.');
    })
  });
};

this.update = (_id, user) => {
  var promise = new Promise(async (resolve, reject) => {
    return User.findOneAndUpdate({ _id }, { '$set': user }, { new: true }, (err, result) => {
      if (err) {
        return reject(err);
      } else if (user === null) {
        return reject(new Error("User not exists!"));
      } else {
        if (user.userType === 'advertiser') {
          AdvertisersService.update(result.advertiserId, { name: result.name })
        } else if (user.userType === 'networkOwner') {
          NetworkOwnerService.update(result.networkOwnerId, { name: result.name })
        }
        return resolve(result);
      }
    });
  });
  return promise;
};