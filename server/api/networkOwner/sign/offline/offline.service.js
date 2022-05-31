const Promise = require('bluebird');

const OfflineAction = require('./offline.schema');

const SignService = require('../sign.service');

const UserService = require('../../../user/user.service');

this.findOne = (query) => {
  return OfflineAction.findOne(query);
};

this.createIfNotExists = async (mac, lanMac, action, userId) => {
  let query = {
    $and: [
      {
        $or: [
          { 
            "mac": mac
          },
          {
            "lanmac": lanMac
          }
        ]
      },
      {
        action: 'CLAIM'
      }
    ]
  }
  return new Promise(async (resolve, reject) => {
    let offlineAction = await(this.findOne(query))
    if(offlineAction) {
      return resolve(offlineAction)
    }
    try {
      let offlineAction = await(this.create(mac, lanMac, action, userId))
      return resolve(offlineAction)
    } catch(e) {
      return reject(e)
    }
  });
  
}

this.create = (mac, lanMac, action, userId) => {
  let offlineAction = {
    mac         : mac,
    lanMac      : lanMac,
    action      : action,
    time        : new Date(),
    userId      : userId
  }
  offlineAction = new OfflineAction(offlineAction);
  offlineAction.save()
};

this.delete = (mac, lanMac, action) => {
  return new Promise((resolve, reject) => {
    let query = {
      $and: [
        {
          $or: [
            { 
              "mac": mac
            },
            {
              "lanmac": lanMac
            }
          ]
        },
        {
          action: action
        }
      ]
    }
    OfflineAction.remove(query, (err, offlineAction) => {
      if(err) {
        return reject(err)
      }
      resolve(offlineAction)  
    });
  });
};

this.handleOfflineAction = (mac, lanMac) => {
  this.handleOfflineClaim(mac, lanMac);
};

this.handleOfflineClaim = async (mac, lanMac) => {
  let query = {
    $and: [
      {
        $or: [
          { 
            "mac": mac
          },
          {
            "lanmac": lanMac
          }
        ]
      },
      {
        action: 'CLAIM'
      }
    ]
  }
  let offlineAction = await(this.findOne(query))
  if(!offlineAction) {
    return;
  }
  let user = await(UserService.findOne({ _id: offlineAction.userId }))
  query = {
    $or: [
      { 
        "info.mac": mac
      },
      {
        "info.lanmac": lanMac
      }
    ]
  }
  let sign = await(SignService.findOne(query))
  if(!sign) {
    return
  }
  SignService.singleDeviceClaim(user, sign, sign.name, sign.claimId, user.email);
  this.delete(mac, lanMac, 'CLAIM')
};