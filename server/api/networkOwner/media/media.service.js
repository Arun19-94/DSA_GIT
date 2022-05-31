var config = require('../../../config/config.js');

var Promise = require('bluebird');

var path = require('path');

var s3Service = require('../../../components/aws/s3');

var s3 = s3Service.s3

var fse = require("fs-extra");

var fs = require("fs");

var Media = require('./media.schema');

var SignServ = require('../sign/sign.service');

var GroupServ = require('../group/group.service');

// var EventSer = require('../../event/event.service');

var io = require('../../../components/socket/client.socketIO.service');

var imageinfo = require('imageinfo');

const jo = require('jpeg-autorotate')

const piexif = require('piexifjs')

var readChunk = require('read-chunk');

var imageType = require('image-type');

var fileType = require('file-type');

var gm = require('gm').subClass({ imageMagick: true });

var s3Service = require('../../../components/aws/s3');

var s3 = s3Service.s3

var s3Config = config.aws.s3;

var FFMPEGServ = require('../../../components/ffmpeg/ffmpeg');



this.find = (query = {}) => {
  return Media
    .find(query);
};

this.findOne = (query = {}) => {
  return Media
    .findOne(query);
};

this.uploadSignMedia = (file, type, user, res, signId, signType) => {
  if (type !== "PROFILE" && type !== "OWN_MEDIA" && type !== "UNSOLD_MEDIA" && type !== "SYSTEM" && type != "GROUP_MEDIA" && type != "EVENT_PROFILE" && type != "EVENT_OWN_MEDIA" && type != "PUBLIC_CONTENT") {
    return res.status(400).send('File type not valid')
  }
  var readFilePromise = this.readFilePromise
  var getFileType = this.getFileType
  var create = this.create
  var uploadToS3 = this.uploadToS3
  var createThumbnail = this.createThumbnail
  var resizeSourceFile = this.resizeSourceFile
  var deleteFolderRecursive = this.deleteFolderRecursive
  let rotateJPEG = this.rotateJPEG
  var promise = new Promise(async (resolve, reject) => {
    var tmpFilePath = file.path
    var _fileType = getFileType(tmpFilePath)
    if (_fileType === 'other') {
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
      return reject('File format not supported')
    }
    if (_fileType === 'image') {
      try {
        await (rotateJPEG(tmpFilePath))
      } catch (error) {

      }
      var _data = await (readFilePromise(tmpFilePath))
      var info = imageinfo(_data);
      if (!info) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return reject('File format not supported')
      }
      if (info && info.width > 13583) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return reject('High resolution file is not supported')
      }
      var buffer = readChunk.sync(tmpFilePath, 0, 12);
      var mimeType = imageType(buffer);
      if (!mimeType) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return reject('File format not supported')
      }
      var media = {
        name: file.name,
        networkOwnerId: user.networkOwnerId,
        meta: info,
        type: type
      }
      var media = await (create(media))
      if (!media) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return reject('Unable to save media')
      }
      res.send(media)
      res.end()
      var uploadPath = config.upload.path
      var mediaId = media._id.toString()
      var destFilePath = path.join(uploadPath, 'network-owner-media', mediaId);
      fse.ensureDirSync(destFilePath)
      var thumbPath = path.join(destFilePath, 'thumb');
      fse.ensureDirSync(thumbPath)
      var fileName = media._id.toString();
      destFileName = path.join(destFilePath, fileName)
      fse.copySync(file.path, destFileName)

      var sourceFile = path.join(destFilePath, fileName)
      var key = path.join('network-owner-media', mediaId, fileName)
      var totalFiles = config.upload.thumb.size.length + 1
      var singleMediaPercentage = 90 / totalFiles

      var fIdx = 0
      if (type === 'PUBLIC_CONTENT' && (info.width > 2048 || info.height > 1080)) {
        totalFiles = config.upload.thumb.size.length + 3
        singleMediaPercentage = 90 / totalFiles

        let midThumb = path.join(thumbPath, '512_' + fileName)
        var midThumbKey = path.join('network-owner-media', mediaId, 'thumb', '512_' + fileName)
        await (resizeSourceFile(sourceFile, midThumb, 512, 512))
        await (uploadToS3(user, media, midThumb, midThumbKey, singleMediaPercentage, (10 + (singleMediaPercentage * fIdx++))))


        let rawFile = path.join(destFilePath, 'raw')
        let rawKey = path.join('network-owner-media', mediaId, 'raw')
        await (uploadToS3(user, media, sourceFile, rawKey, singleMediaPercentage, (10 + (singleMediaPercentage * fIdx++))))
        fse.copySync(sourceFile, rawFile)
        await (resizeSourceFile(rawFile, sourceFile, 2048, 1080))
      }
      await (uploadToS3(user, media, sourceFile, key, singleMediaPercentage, (10 + (singleMediaPercentage * fIdx++))))
      var thumbFileNames = []
      for (var idx = 0; idx < config.upload.thumb.size.length; idx++) {
        var thumbFileName = config.upload.thumb.size[idx] + '_' + fileName
        var thumbFilePath = path.join(thumbPath, thumbFileName)
        thumbFileNames.push(thumbFileName)
        await (createThumbnail(destFileName, thumbFilePath, config.upload.thumb.size[idx]))
      }

      for (var i = 0; i < thumbFileNames.length; i++) {
        var sourceFile = path.join(thumbPath, thumbFileNames[i])
        var key = path.join('network-owner-media', mediaId, 'thumb', thumbFileNames[i])
        await (uploadToS3(user, media, sourceFile, key, singleMediaPercentage, (10 + (singleMediaPercentage * fIdx++))))
      }

      if (signType) {
        if (signType === "GROUP") {
          if (signId) {
            var sign = await (GroupServ.findOne({ _id: signId }))
            if (!sign.profileMedia) {
              sign.profileMedia = media;
            }
            var _sign = JSON.stringify(sign)
            var sign = JSON.parse(_sign)
            delete sign.createdAt
            await (GroupServ.updateGroup(sign._id, sign))
          }
        } else if (signType === "EVENT") {
          let _eventArray = await (EventSer.find({ _id: signId }))
          let _event = _eventArray[0]
          if (!_event.profileMedia) {
            _event.profileMedia = media;
          }
          let event1 = JSON.stringify(_event)
          _event = JSON.parse(event1)
          delete _event.createdAt
          await (EventSer.update(_event))
        }

      } else {
        if (signId) {
          var sign = await (SignServ.findOneById(signId, user))
          if (!sign.profileMedia) {
            sign.profileMedia = media;
          }
          var _sign = JSON.stringify(sign)
          var sign = JSON.parse(_sign)
          delete sign.createdAt
          await (SignServ.update(sign._id, sign))
        }

      }
      var networkOwnerId = user.networkOwnerId
      var key = media._id
      if (user.advertiserId && user.networkOwnerId) {
        var userId = user.advertiserId.toString()
      } else {
        if (user.advertiserId && !user.networkOwnerId) {
          var userId = user.advertiserId.toString()
        } else if (user.networkOwnerId && !user.advertiserId) {
          var userId = user.networkOwnerId.toString()
        }
      }
      io.sendUser(userId, key, { media, type: 'PROGRESS', message: { progress: 100, status: 'COMPLETED' } });

      var folderPath = path.join(uploadPath, 'network-owner-media', media._id.toString());
      await (deleteFolderRecursive(folderPath))
      var _folderPath = path.join(uploadPath, 'network-owner-media');
      await (deleteFolderRecursive(_folderPath))
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    } else if (_fileType === 'video') {
      var data = await (FFMPEGServ.getMetadata(tmpFilePath))
      if (!data) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return reject('Unable to get video meta data')
      }
      var videoStream = data.streams[0]
      if (data.streams.length > 1) {
        for (var i = 0; i < data.streams.length; i++) {
          var stream = data.streams[i]
          if (stream.codec_type === 'video') {
            videoStream = stream
            break
          }
        }
      }
      var format = data.format
      var meta = {
        width: videoStream.width,
        height: videoStream.height,
        duration: format.duration,
        size: format.size,
        type: 'video'
      }
      var media = {
        name: file.name,
        networkOwnerId: user.networkOwnerId,
        meta: meta,
        type: type
      }
      var media = await (create(media))
      if (!media) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return reject('Unable to save media')
      }
      res.send(media)
      res.end()
      var uploadPath = config.upload.path
      var destFilePath = path.join(uploadPath, 'network-owner-media', media._id.toString());
      fse.ensureDirSync(destFilePath)
      var thumbPath = path.join(destFilePath, 'thumb');
      fse.ensureDirSync(thumbPath)
      var fileName = media._id.toString() + config.upload.video.default.ext;
      var destFile = path.join(destFilePath, fileName);
      await (FFMPEGServ.convertVideo(user, media, tmpFilePath, destFile))
      var previewFileName = 'preview' + config.upload.video.default.ext;
      await (FFMPEGServ.createPreviewVideo(user, media, destFile, path.join(destFilePath, previewFileName)))

      var totalFiles = config.upload.thumb.size.length + 2
      var singleMediaPercentage = 90 / totalFiles

      var fIdx = 0
      var sourceFile = path.join(destFilePath, fileName)
      var key = path.join('network-owner-media', media._id.toString(), fileName)
      await (uploadToS3(user, media, sourceFile, key, singleMediaPercentage, (10 + (singleMediaPercentage * fIdx++))))

      var sourceFile = path.join(destFilePath, previewFileName)
      var key = path.join('network-owner-media', media._id.toString(), previewFileName)
      await (uploadToS3(user, media, sourceFile, key, singleMediaPercentage, (10 + (singleMediaPercentage * fIdx++))))

      await (FFMPEGServ.createThumbnail(destFile, destFilePath))

      var thumbFileNames = []
      for (var idx = 0; idx < config.upload.thumb.size.length; idx++) {
        var thumbFileName = config.upload.thumb.size[idx] + '_' + media._id.toString()
        var thumbFilePath = path.join(thumbPath, thumbFileName)
        thumbFileNames.push(thumbFileName)
        await (createThumbnail(path.join(destFilePath, 'thumb_1.png'), thumbFilePath, config.upload.thumb.size[idx]))
      }

      for (var i = 0; i < thumbFileNames.length; i++) {
        var sourceFile = path.join(thumbPath, thumbFileNames[i])
        var key = path.join('network-owner-media', media._id.toString(), 'thumb', thumbFileNames[i])
        await (uploadToS3(user, media, sourceFile, key, singleMediaPercentage, (singleMediaPercentage * fIdx++)))
      }
      var networkOwnerId = user.networkOwnerId
      var key = media._id
      if (user.advertiserId && user.networkOwnerId) {
        var userId = user.advertiserId.toString()
      } else {
        if (user.advertiserId && !user.networkOwnerId) {
          var userId = user.advertiserId.toString()
        } else if (user.networkOwnerId && !user.advertiserId) {
          var userId = user.networkOwnerId.toString()
        }
      }
      io.sendUser(userId, key, { media, type: 'PROGRESS', message: { progress: 100, status: 'COMPLETED' } });

      var folderPath = path.join(uploadPath, 'network-owner-media', media._id.toString());
      await (deleteFolderRecursive(folderPath))
      var _folderPath = path.join(uploadPath, 'network-owner-media');
      await (deleteFolderRecursive(_folderPath))
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    }
  });
  return promise;
};

this.readFilePromise = filePath => {
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

this.getFileType = src => {
  let buffer = readChunk.sync(src, 0, 4100);
  let _fileType = fileType(buffer);
  if (_fileType.mime === 'image/jpeg' || _fileType.mime === 'image/jpg' || _fileType.mime === 'image/png')
    return 'image'
  else if (_fileType.mime.startsWith('video'))
    return 'video'
  return 'other'
}

this.create = (media, file) => {
  // let file = file;
  return new Promise((resolve, reject) => {
    Media.createAsync(media).then(media => {
      return resolve(media);
    }).catch(err => {
      return reject(err);
    });
  });
};

this.uploadToS3 = (user, media, sourceFile, key, singleMediaPercentage, completedProgress) => {
  let promise = new Promise((resolve, reject) => {
    let ext = path.extname(sourceFile)
    let contentType = ''
    if (ext === '.json')
      contentType = 'application/json'
    else if (!ext)
      contentType = 'image/png'
    else
      contentType = 'video/mp4'
    s3Obj = {
      Bucket: s3Service.bucket,
      Key: key,
      Body: fs.createReadStream(sourceFile),
      ContentType: contentType
    }

    s3.putObject(s3Obj).on('httpUploadProgress', e => {
      let _p = e.loaded / e.total;
      let progress = (_p * singleMediaPercentage) + completedProgress
      let key = media._id
      if (user.advertiserId && user.networkOwnerId) {
        var userId = user.advertiserId.toString()
      } else {
        if (user.advertiserId && !user.networkOwnerId) {
          var userId = user.advertiserId.toString()
        } else if (user.networkOwnerId && !user.advertiserId) {
          var userId = user.networkOwnerId.toString()
        }
      }
      io.sendUser(userId, key, { media, type: 'PROGRESS', message: { progress: progress, status: 'IN_PROGRESS' } });
    }).send(err => {
      if (err) {
        reject()
      }
      resolve()
    });
  });
  return promise;
}

this.createThumbnail = (source, dest, size) => {
  return new Promise((resolve, reject) => {
    gm(source)
      .resize(size, size, '^')
      .gravity('Center')
      .write(dest, err => {
        resolve()
      });
  });
};

this.resizeSourceFile = (source, dest, width, height) => {
  return new Promise((resolve, reject) => {
    gm(source)
      .quality(100)
      .resize(width, height)
      .write(dest, err => {
        resolve()
      });
  });
};

this.deleteThumbnailFromExif = imageBuffer => {
  const imageString = imageBuffer.toString('binary')
  const exifObj = piexif.load(imageString)
  delete exifObj.thumbnail
  delete exifObj['1st']
  const exifBytes = piexif.dump(exifObj)
  const newImageString = piexif.insert(exifBytes, imageString)
  return Buffer.from(newImageString, 'binary')
}

this.rotateJPEG = tempFilePath => {
  let buffer = fs.readFileSync(tempFilePath);
  let bufferNoThumb = this.deleteThumbnailFromExif(buffer)
  fs.writeFileSync(tempFilePath, bufferNoThumb)
  const options = { quality: 100 }
  let promise = new Promise((resolve, reject) => {
    jo.rotate(tempFilePath, options, (error, buffer, orientation) => {
      if (error) {
        return reject(error)
      }
      fs.writeFile(tempFilePath, buffer, (err) => {
        if (err) {
          return reject(err)
        }
        return resolve()
      })
    })
  })
  return promise;
}

this.deleteFolderRecursive = path => {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file, index) => {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        mSelf.deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

this.delete = (mediaId, user, signId, type) => {
  var _mediaId = mediaId
  var user = user
  var signId = signId
  var type = type
  // deleteFolderRecursive = this.deleteFolderRecursive
  var promise = new Promise(async (resolve, reject) => {
    try {
      var mediaId = _mediaId
      var mediaQuery = {
        $or: [
          { profileMedia: { "$in": [mediaId] } },
          { ownMedia: { "$in": [mediaId] } },
          { unsoldMedia: { "$in": [mediaId] } }
        ]
      }
      var signs = await (SignServ.find(mediaQuery))
      var groups = await (GroupServ.find(mediaQuery))
      signs = signs.concat(groups)
      if (signs.length === 1) {
        for (var i = 0; i < signs.length; i++) {
          if (signs[i]._id.toString() === signId.toString()) {
            var media = await (Media.find({ networkOwnerId: user.networkOwnerId }))
            if (type === "GROUP") {
              var sign = await (GroupServ.findOneById(signId, user))
            } else {
              var sign = await (SignServ.findOneById(signId, user))
            }
            var profileFlag = 0
            if (media) {
              if (sign.profileMedia && sign.profileMedia._id.toString() === mediaId.toString()) {
                for (var i = 0; i < media.length; i++) {
                  if (sign.signType === "GROUP" && media[i]._id.toString() !== mediaId.toString()) {
                    if (media[i].type === "GROUP_MEDIA" && media[i]._id.toString() !== mediaId.toString()) {
                      profileFlag = 1
                      sign.profileMedia = media[i]
                      break;
                    }
                  } else {
                    if (media[i].type === "PROFILE" && media[i]._id.toString() !== mediaId.toString()) {
                      profileFlag = 1
                      sign.profileMedia = media[i]
                      break;
                    }
                  }
                }
              } else {
                profileFlag = 1
              }
              if (profileFlag === 0) {
                sign.profileMedia = null
              }
              var _sign = JSON.stringify(sign)
              var sign = JSON.parse(_sign)
              delete sign.createdAt
              if (sign.signType === 'GROUP') {
                await (SignServ.updateGroup(sign._id, sign))
              } else if (sign.signType !== 'GROUP') {
                await (SignServ.update(sign._id, sign))
              }
            }
            var query = {
              _id: mediaId,
              networkOwnerId: user.networkOwnerId
            };
            var media = await (Media.findOneAndRemove(query))
            if (media === null) {
              return reject(new Error("Media not exists!"));
            } else {
              var mediaId = media._id.toString();
              var key = path.join('network-owner-media', mediaId)
              await (mSelf.removeS3Media(key, media))
              // var folderPath = path.join(config.upload.path, 'network-owner-media', media._id.toString());
              // deleteFolderRecursive(folderPath);
              return resolve(media);
            }
          }
        }
      }
      if (type === 'SIGN') {
        if (signs.length < 2) {
          var message = 'Media already using in following sign'
        } else {
          var message = 'Media already using in following signs'
        }
      }
      else {
        if (signs.length < 2) {
          var message = 'Media already using in following group'
        } else {
          var message = 'Media already using in following groups'
        }

      }

      if (signs && signs.length > 0) {
        for (var idx = 0; idx < signs.length; idx++) {
          message += ` ${idx + 1}. ${signs[idx].name}`
        }
        var err = { code: 'ForeignKeyException', message: message };
        return reject(err)
      } else {
        if (signId !== 'undefined') {
          var media = await (Media.find({ networkOwnerId: user.networkOwnerId }))
          if (type === "GROUP") {
            var sign = await (GroupServ.findOneById(signId, user))
          } else {
            var sign = await (SignServ.findOneById(signId, user))
          }
          // var sign = await(SignServ.findOneById(signId, user))
          var profileFlag = 0
          if (media) {
            if (sign.profileMedia && sign.profileMedia._id.toString() === mediaId.toString()) {
              for (var i = 0; i < media.length; i++) {
                if (sign.signType === "GROUP" && media[i]._id.toString() !== mediaId.toString()) {
                  if (media[i].type === "GROUP_MEDIA" && media[i]._id.toString() !== mediaId.toString()) {
                    profileFlag = 1
                    sign.profileMedia = media[i]
                    break;
                  }
                } else {
                  if (media[i].type === "PROFILE" && media[i]._id.toString() !== mediaId.toString()) {
                    profileFlag = 1
                    sign.profileMedia = media[i]
                    break;
                  }
                }
              }
            } else {
              profileFlag = 1
            }
            if (profileFlag === 0) {
              sign.profileMedia = null
            }
            var _sign = JSON.stringify(sign)
            var sign = JSON.parse(_sign)
            delete sign.createdAt
            if (sign.signType === 'GROUP') {
              await (SignServ.updateGroup(sign._id, sign))
            } else if (sign.signType !== 'GROUP') {
              await (SignServ.update(sign._id, sign))
            }
          }
          // if (media) {
          //   if (sign.profileMedia && sign.profileMedia._id.toString() === mediaId.toString()) {
          //     for (var i = 0; i < media.length; i++) {
          //       if (media[i].type === "PROFILE") {
          //         sign.profileMedia = media[i]
          //         break;
          //       }
          //     }
          //   }
          //   var _sign = JSON.stringify(sign)
          //   var sign = JSON.parse(_sign)
          //   delete sign.createdAt
          //   if (sign.signType === 'GROUP') {
          //     await(SignServ.updateGroup(sign._id, sign))
          //   } else if (sign.signType !== 'GROUP') {
          //     await(SignServ.update(sign._id, sign))
          //   }
          // }
        }
        var query = {
          _id: mediaId,
          networkOwnerId: user.networkOwnerId
        };
        var media = await (Media.findOneAndRemove(query))
        if (media === null) {
          return reject(new Error("Media not exists!"));
        } else {
          var mediaId = media._id.toString();
          var key = path.join('network-owner-media', mediaId)
          await (mSelf.removeS3Media(key, media))
          // var folderPath = path.join(config.upload.path, 'network-owner-media', media._id.toString());
          // deleteFolderRecursive(folderPath);
          return resolve(media);
        }
      }
    } catch (err) {
      return reject(err)
    }
  });
  return promise;
};

this.removeS3Media = (key, media) => {
  var s3Obj = {
    Key: key,
    Bucket: s3Service.bucket
  };
  return new Promise((resolve, reject) => {
    return s3.listObjects({
      Bucket: s3Service.bucket,
      Prefix: key
    }, (err, data) => {
      if (err) {
        return;
      }
      s3Obj = {
        Bucket: s3Service.bucket,
        Delete: {
          Objects: []
        }
      };
      return Promise.each(data.Contents, obj => {
        return s3Obj.Delete.Objects.push({
          Key: obj.Key
        });
      }).then(() => {
        return s3.deleteObjects(s3Obj, err => {
          return resolve(media);
        });
      }).catch(err => {
        return reject(media);
      });
    });
  });
};

mSelf = this
module.exports = this;