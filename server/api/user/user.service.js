const Config = require('../../config/config');

const path = require('path');

const fse = require("fs-extra");

const User = require('./user.schema');

const mongoose = require('mongoose');

const randomstring = require('randomstring');

const readChunk = require('read-chunk');

const imageinfo = require('imageinfo');

const imageType = require('image-type');

const fileType = require('file-type');

const fs = require('fs');

const gm = require('gm').subClass({
  imageMagick: true
});

const UserRestriction = require('./user_restriction.schema')

const NetworkOwnerService = require('../networkOwner/networkOwner.service');

const AdvertisersService = require('../advertiser/advertiser.service');

const PaymentSummaryService = require('../advertiser/payment/paymentSummary/paymentSummary.service')

const UtilService = require('../../components/util.service');

const s3Service = require('../../components/aws/s3');

const s3 = s3Service.s3;

const io = require('../../components/socket/client.socketIO.service');

this.find = (query) => {
  return User.find(query).lean();
};

this.getRestrictedUsers = (query = {}) => {
  return UserRestriction.find(query).populate('whichUser').lean();
};

this.findOne = (query) => {
  return User.findOne(query).lean();
};

this.findForChangeSchema = () => {
  return User.find().lean().populate('preApprovedAdvertiser');
}

this.findOneById = function (id) {
  var query = {
    _id: id
  };
  return User
    .findOne(query)
};

this.create = (user) => {
  return new Promise(async (rs, rj) => {
    let message = this.validate(user)
    if (message)
      return rj(message)
    let userIdentificationNumber = await (this.generateUserNumber())
    user.userIdentificationNumber = userIdentificationNumber
    User.create(user, (err, _user) => {
      if (err) {
        return rj(err);
      }
      return rs(_user);
    });
  });
};

this.createLocalUser = (user) => {
  var self = this
  var _user = user
  return new Promise(async (resolve, reject) => {
    try {
      var _self = self
      let user = _user
      user.password = randomstring.generate();
      let userIdentificationNumber = await (_self.generateUserNumber())
      user.userIdentificationNumber = userIdentificationNumber
      let networkOwner = await (NetworkOwnerService.create(user))
      user.networkOwnerId = networkOwner._id
      let advertiser = await (AdvertisersService.create(user))
      user.advertiserId = advertiser._id
      let __user = await (User.create(user))
      return resolve(__user)
    } catch (err) {
      return reject(err)
    }
  });
};

this.validate = (user) => {
  if (!user)
    return "User required."
  if (!user.name)
    return "Name required."
  if (!user.email)
    return "Email required."
  if (!user.password)
    return "Password required."
  if (!user.customer && !user.reseller)
    return "Customer or reseller required."
  return false
}

this.generateUserNumber = async () => {
  var userIdentificationNumber = randomstring.generate({
    length: 6,
    numeric: true,
    letters: true,
    charset: 'alphanumeric'
  });
  var pattern = /\d/g
  if (!userIdentificationNumber.match(pattern)) {
    var num = Math.floor(Math.random() * 10)
    var index = Math.floor(Math.random() * 7)
    userIdentificationNumber = userIdentificationNumber.substr(0, index - 1) + num + userIdentificationNumber.substr(index, 5)
  }
  userIdentificationNumber = userIdentificationNumber.toUpperCase()
  var users = await (User.find({
    userIdentificationNumber: userIdentificationNumber
  }))
  if (users.length > 0) {
    this.generateUserNumber()
  } else {
    return userIdentificationNumber
  }
}

this.update = (user) => {
  return new Promise((rs, rj) => {
    let message = this.validateUserForUpdate(user)
    if (message)
      return rj(message)
    User.findOneAndUpdate({
      _id: user._id
    }, {
      '$set': user
    }, {
      new: true
    }, (err, _user) => {
      if (err) {
        return rj(err);
      }
      return rs(_user);
    });
  });
};

this.validateUserForUpdate = (user) => {
  if (!user)
    return "User required."
  if (user.name.length > 100)
    return 'User name should be lesser or equal to 100.'
  if (!user.name)
    return "Name required."
  if (user.company && user.company.length > 100)
    return 'Company name should be lesser or equal to 100.'
  return false
}

this.delete = (user) => {
  return new Promise((rs, rj) => {
    User.findByIdAndRemove(user._id, (err, _user) => {
      if (err) {
        return rj(err);
      }
      return rs(_user);
    });
  });
};

this.findPaginatedUsers = (params) => {
  return new Promise(async (rs, rj) => {
    try {
      let limit = params.pageSize
      let skip = params.skip
      let searchParams = params.searchText;
      let resellerId = params.resellerId
      let searchText = (searchParams) ? searchParams : ''
      var _searchText = ''
      for (let k = 0; k < searchText.length; k++) {
        let searchTextReplace = searchText[k]
        searchTextReplace = searchTextReplace.replace("\\", "\\\\")
        searchTextReplace = searchTextReplace.replace("*", "\\*")
        searchTextReplace = searchTextReplace.replace("(", "\\(")
        searchTextReplace = searchTextReplace.replace(")", "\\)")
        searchTextReplace = searchTextReplace.replace("+", "\\+")
        searchTextReplace = searchTextReplace.replace("[", "\\[")
        searchTextReplace = searchTextReplace.replace("|", "\\|")
        searchTextReplace = searchTextReplace.replace(",", "\\,")
        searchTextReplace = searchTextReplace.replace(".", "\\.")
        searchTextReplace = searchTextReplace.replace("?", "\\?")
        searchTextReplace = searchTextReplace.replace("^", "\\^")
        searchTextReplace = searchTextReplace.replace("$", "\\$")
        _searchText = _searchText.toString() + searchTextReplace.toString()
      }
      const query = {
        $and: [{
            reseller: mongoose.Types.ObjectId(resellerId),
            type: "RESELLER_USER"
          },
          {
            $or: [{
                name: {
                  $regex: `${_searchText}`,
                  $options: 'ig'
                }
              },
              {
                email: {
                  $regex: `${_searchText}`,
                  $options: 'ig'
                }
              }
            ]
          }
        ]
      }
      let users = await (User.find(query).lean().limit(limit).skip(skip))
      let usersCount = await (User.count(query))
      let data = {
        users: users,
        usersCount: usersCount
      }
      return rs(data)
    } catch (err) {
      return rj(err)
    }
  })
}

this.uploadProfileImage = (_user, file, req, res) => {
  let promise = new Promise(async (resolve, reject) => {
    let tmpFilePath = file.path
    let _data = await (this.readFilePromise(tmpFilePath))
    let _fileType = await (this.getFileType(tmpFilePath))
    if (_fileType === 'other') {
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
      return res.status(400).send('File format not supported')
    }
    let info = imageinfo(_data);
    if (!info) {
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
      return reject('File format not supported')
    }
    let buffer = readChunk.sync(tmpFilePath, 0, 12);
    let mimeType = imageType(buffer);
    if (!mimeType) {
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
      return reject('File format not supported')
    }
    res.end()
    let userDeleteCreatedAt = JSON.stringify(_user)
    let user = JSON.parse(userDeleteCreatedAt)
    delete user.createdAt
    let uploadPath = Config.upload.path
    let destFilePath = path.join(uploadPath, 'user', user._id.toString());
    fse.ensureDirSync(destFilePath)
    let thumbPath = path.join(destFilePath, 'thumb');
    fse.ensureDirSync(thumbPath)
    let fileName = file.name
    let sourceFile = path.join(destFilePath, fileName)
    fse.copySync(file.path, sourceFile)
    let key = path.join('user', 'profile', user._id.toString(), fileName)
    let totalFiles = Config.upload.thumb.size.length + 1
    let singleMediaPercentage = 90 / totalFiles
    let fIdx = 0
    await (this.uploadToS3(user, sourceFile, key, singleMediaPercentage, (10 + (singleMediaPercentage * fIdx++))))
    let thumbFileNames = []
    for (let idx = 0; idx < Config.upload.thumb.size.length; idx++) {
      let thumbFileName = Config.upload.thumb.size[idx] + '_' + fileName
      let thumbFilePath = path.join(thumbPath, thumbFileName)
      thumbFileNames.push(thumbFileName)
      await (this.createThumbnail(sourceFile, thumbFilePath, Config.upload.thumb.size[idx]))
    }
    for (let i = 0; i < thumbFileNames.length; i++) {
      let sourceFile = path.join(thumbPath, thumbFileNames[i])
      key = path.join('user', 'profile', user._id.toString(), 'thumb', thumbFileNames[i])
      await (this.uploadToS3(user, sourceFile, key, singleMediaPercentage, (10 + (singleMediaPercentage * fIdx++))))
    }
    user.profileImage = file.name
    user = await (this.update(user))
    let userId;
    if (user.advertiserId && user.networkOwnerId) {
      userId = user.advertiserId.toString()
    } else {
      if (user.advertiserId && !user.networkOwnerId) {
        userId = user.advertiserId.toString()
      } else if (user.networkOwnerId && !user.advertiserId) {
        userId = user.networkOwnerId.toString()
      }
    }
    key = user._id.toString() + '_profileMedia'
    io.sendUser(userId, key, {
      user,
      type: 'PROGRESS',
      message: {
        progress: 100,
        status: 'COMPLETED',
        profileImage: user.profileImage
      }
    });
    key = "Dynamic_updation_for_to_navigation"
    io.sendUser(userId, key, {
      user,
      type: 'PROGRESS',
      message: {
        progress: 100,
        status: 'COMPLETED'
      }
    });

    let folderPath = path.join(uploadPath, 'user', user._id.toString());
    await (UtilService.deleteFolderRecursive(folderPath))
    let _folderPath = path.join(uploadPath, 'user');
    await (UtilService.deleteFolderRecursive(_folderPath))
    if (fs.existsSync(tmpFilePath)) {
      fs.unlinkSync(tmpFilePath);
    }
    // req.session.user.profileImage = user.profileImage
    // photoUrl = '/api/user/'+user._id+'/thumb/75_' + user.profileImage
    // req.session.user.photoUrl = photoUrl
  });
  return promise;
}

this.uploadToS3 = (user, sourceFile, key, singleMediaPercentage, completedProgress) => {
  let promise = new Promise((resolve, reject) => {
    let ext = path.extname(sourceFile)
    let contentType = ''
    if (ext === '.json') {
      contentType = 'application/json'
    } else {
      contentType = 'image/png'
    }
    s3Obj = {
      Bucket: s3Service.bucket,
      Key: key,
      Body: fs.createReadStream(sourceFile),
      ContentType: contentType
    }

    s3.putObject(s3Obj).on('httpUploadProgress', (e) => {
      let _p = e.loaded / e.total;
      let progress = (_p * singleMediaPercentage) + completedProgress
      let key = user._id.toString() + '_profileMedia'
      let userId;
      if (user.advertiserId && user.networkOwnerId) {
        userId = user.advertiserId.toString()
      } else {
        if (user.advertiserId && !user.networkOwnerId) {
          userId = user.advertiserId.toString()
        } else if (user.networkOwnerId && !user.advertiserId) {
          userId = user.networkOwnerId.toString()
        }
      }
      io.sendUser(userId, key, {
        user,
        type: 'PROGRESS',
        message: {
          progress: progress,
          status: 'IN_PROGRESS'
        }
      });
    }).send((err) => {
      if (err) {
        reject()
      }
      resolve()
    });

  });
  return promise;
}

this.readFilePromise = (filePath) => {
  let promise = new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        return reject(err)
      }
      return resolve(data);
    });
  });
  return promise;
}

this.getFileType = (src) => {
  let buffer = readChunk.sync(src, 0, 4100);
  let _fileType = fileType(buffer);
  if (_fileType && (_fileType.mime === 'image/jpeg' || _fileType.mime === 'image/jpg' || _fileType.mime === 'image/png')) {
    return 'image'
    // if(_fileType.mime.startsWith('image')) {
    //   return 'image'
  } else if (_fileType && _fileType.mime.startsWith('video')) {
    return 'video'
  }
  return 'other'
}


this.createThumbnail = (source, dest, size) => {
  return new Promise((resolve, reject) => {
    gm(source)
      .resize(size, size, '^')
      .gravity('Center')
      .write(dest, (err) => {
        resolve()
      });
  });
};

this.getAllAdvertiser = async (includedUserId, searchText, skip, limit, networkOwnerId, advertiserId) => {
  let result = {}
  try {
    let OldAdvertiser = await (PaymentSummaryService.findOldAdvertiser(networkOwnerId, advertiserId))
    if (searchText && searchText.length > 0) {
      let searchQuery = [];
      searchQuery.push({
        name: {
          $regex: searchText,
          $options: 'ig',
        }
      })
      searchQuery.push({
        userIdentificationNumber: {
          $regex: searchText,
          $options: 'ig',
        }
      })
      searchQuery.push({
        company: {
          $regex: searchText,
          $options: 'ig',
        }
      })
      let relatedAdvertisers = await (User.find({
        $and: [{
            advertiserId: {
              $in: OldAdvertiser
            }
          },
          {
            userType: {
              $ne: "admin"
            }
          },
          {
            $or: searchQuery
          }
        ]
      }, {
        email: 0,
        paypalEmail: 0,
        password: 0,
        permissions: 0
      }).skip(skip).limit(limit))
      let relatedAdvertisersCount = await (User.count({
        $and: [{
            advertiserId: {
              $in: OldAdvertiser
            }
          },
          {
            userType: {
              $ne: "admin"
            }
          },
          {
            $or: searchQuery
          }
        ]
      }))
      result.count = relatedAdvertisersCount
      result.data = relatedAdvertisers
    } else {
      let relatedAdvertisers = await (User.find({
        $and: [{
            advertiserId: {
              $in: OldAdvertiser
            }
          },
          {
            userType: {
              $ne: "admin"
            }
          },
        ]
      }, {
        email: 0,
        paypalEmail: 0,
        password: 0,
        permissions: 0
      }).skip(skip).limit(limit))
      let relatedAdvertisersCount = await (User.count({
        $and: [{
            advertiserId: {
              $in: OldAdvertiser
            }
          },
          {
            userType: {
              $ne: "admin"
            }
          },
        ]
      }))
      result.count = relatedAdvertisersCount
      result.data = relatedAdvertisers
    }
    return result
  } catch (err) {
    return err
  }
}

this.getBlacklistedUser = async (userId, searchText, skip, limit) => {
  try {
    let result = await (User.findOne({
      _id: userId
    }).populate('blacklistedUsers'))
    let _searchText = searchText.toLowerCase()
    let filteredUsers = []
    result.blacklistedUsers.map(user => {
      if (user.name && user.name.toLowerCase().indexOf(_searchText) >= 0 || user.company && user.company.toLowerCase().indexOf(_searchText) >= 0 || user.userIdentificationNumber && user.userIdentificationNumber.toLowerCase().indexOf(_searchText) >= 0)
        filteredUsers.push(user)
    })
    result.blacklistedUsers = filteredUsers
    return result
  } catch (err) {
    return err
  }
}

this.getRestrictedUser = async (userId, status, searchText, skip, limit) => {
  try {
    let query = {
      user: userId.toString(),
      status: status
    }
    let result = await (UserRestriction.find(query).populate('whichUser'))
    let _searchText = searchText.toLowerCase()
    let filteredUsers = []
    result.map(user => {
      if (user.whichUser.name && user.whichUser.name.toLowerCase().indexOf(_searchText) >= 0 || user.whichUser.company && user.whichUser.company.toLowerCase().indexOf(_searchText) >= 0 || user.whichUser.userIdentificationNumber && user.whichUser.userIdentificationNumber.toLowerCase().indexOf(_searchText) >= 0)
        filteredUsers.push(user)
    })
    return filteredUsers
  } catch (err) {
    return err
  }
}

this.getApprovedOrBlockedUsersList = async query => {
  try {
    return await (UserRestriction.find(query).populate('whichUser'))
  } catch (err) {
    return err
  }
}

this.checkIsBlockedUser = async userId => {
  try {
    return await (User.find({
      blacklistedUsers: userId.toString()
    }))
  } catch (err) {
    return err
  }
}

this.updateMultipleRestictedUser = async data => {
  try {
    let status = data.status
    let query = {
      $and: [{
          user: data.user.toString()
        },
        {
          whichUser: {
            $in: data.whichUser
          }
        }
      ]
    }
    let users = await (UserRestriction.find(query).populate('whichUser'))
    let userMap = {}
    let restrictedUsers = []
    users.map(user => {
      userMap[user.whichUser._id] = user.whichUser._id
      if (status === "TRUSTED" && user.status === "BLOCKED")
        restrictedUsers.push(user.whichUser)
      else if (status === "BLOCKED" && user.status === "TRUSTED")
        restrictedUsers.push(user.whichUser)
    })
    if (restrictedUsers.length > 0 && !data.confirm) {
      let restrictedUsersMap = {}
      restrictedUsers.map(_user => {
        restrictedUsersMap[_user._id.toString()] = _user._id.toString()
      })
      let dummyUsers = []
      data.whichUser.map(_user => {
        if (!restrictedUsersMap[_user.toString()])
          dummyUsers.push(_user)
      })
      data.whichUser = dummyUsers
      // restrictedUsers.map(_user => {
      //   if (data.whichUser.indexOf(_user._id.toString()) > -1)
      //     data.whichUser.splice(data.whichUser.indexOf(_user._id.toString()), 1)
      // })
      query = {
        $and: [{
            user: data.user.toString()
          },
          {
            whichUser: {
              $in: data.whichUser
            }
          }
        ]
      }
    }
    data.whichUser.map(user => {
      if (!userMap[user]) {
        let _data = {
          user: data.user,
          whichUser: user,
          status: data.status
        }
        let userRestriction = new UserRestriction(_data)
        userRestriction.save()
      }
    })
    await (UserRestriction.updateMany(query, {
      $set: {
        status: data.status
      }
    }))
    if (restrictedUsers.length > 0 && !data.confirm) {
      return restrictedUsers
    }
    return
  } catch (err) {
    console.log(err)
    return err
  }
}

this.updateRestictedUser = async data => {
  try {
    let query = {
      user: data.user.toString(),
      whichUser: data.whichUser.toString()
    }
    let user = await (UserRestriction.findOne(query))
    if (user) {
      return await (UserRestriction.findOneAndUpdate({
        _id: user._id
      }, {
        '$set': {
          status: data.status
        }
      }, {
        new: true
      }))
    }
    let userRestriction = new UserRestriction(data)
    userRestriction.save()
    return
  } catch (err) {
    return err
  }
}

this.updateToNewSchema = async data => {
  try {
    let user = await (UserRestriction.find(data))
    if (user.length > 0)
      return
    let userRestriction = new UserRestriction(data)
    userRestriction.save()
  } catch (err) {
    console.log(err)
  }
}

this.getIsRestrictedUsers = async (data, userId) => {
  try {
    let networkOwnerId = []
    Object.keys(data).forEach(function (key) {
      networkOwnerId.push(key)
    });
    let users = await (User.find({
      networkOwnerId: {
        "$in": networkOwnerId
      }
    }, {
      _id: 1,
      networkOwnerId: 1
    }))
    let userIds = users.map(user => {
      return user._id
    })
    let userMap = {}
    for (let j = 0; j < users.length; j++) {
      userMap[(users[j]._id).toString()] = users[j].networkOwnerId.toString()
    }
    let restrictedUsers = await (
      UserRestriction.find({
        $and: [{
          user: {
            "$in": userIds
          }
        }, {
          whichUser: userId
        }, {
          status: 'BLOCKED'
        }]

      })
    )
    let result = {}
    let blockSigns = ''
    if (restrictedUsers && restrictedUsers.length > 0) {
      let message = []
      for (let i = 0; i < restrictedUsers.length; i++) {
        let restuser = restrictedUsers[i];
        if (userMap[restuser.user.toString()]) {
          if (data[userMap[restuser.user.toString()]]) {
            blockSigns = blockSigns + "," + data[userMap[restuser.user.toString()]].join()
          }
        }
      }
      result.data = blockSigns
    } else {
      result.data = "No error"
    }
    return  result
  } catch (err) {
    console.log(err)
  }
}

// this.getIsRestrictedUsers({
//   "5d25d80b2132ec444174352c": ["16", "15"]
// }, "5d2da085b2c9c350de748e7a")