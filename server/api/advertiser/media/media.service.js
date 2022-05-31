const fs = require('fs');

const fse = require("fs-extra");

const path = require('path');

const readChunk = require('read-chunk');

const imageinfo = require('imageinfo');

const imageType = require('image-type');

const fileType = require('file-type');

var gm = require('gm').subClass({imageMagick: true});

const s3Service = require('../../../components/aws/s3');

const s3 = s3Service.s3;

const FFMPEGServ = require('../../../components/ffmpeg/ffmpeg');

const CampaignService = require('../campaign/campaign.service');

const io = require('../../../components/socket/client.socketIO.service');

const UtilService = require('../../../components/util.service');

const Media = require('./media.schema');

const config = require('../../../config/config.js');

this.find = (query = {}) => {
  return Media
    .find(query);
};

this.create = (media) => {
  return new Promise((resolve, reject) => {
    Media.createAsync(media).then((media) => {
    	return resolve(media);
    }).catch((err) => {
      return reject(err);
    });  
  });
};

this.update = (media) => {
  return new Promise((rs, rj) => {
    Media.findOneAndUpdate({ _id : media._id }, { '$set': media }, { new: true }, (err, _media) => {
      if (err) {
        return rj(err);
      }
      return rs(_media);
    });   
  });
};

this.delete = (id, user) => {
  let promise = new Promise(async (resolve, reject) => {
    let mediaQuery = {media : {"$in": [id]}}
    let campaigns = await(CampaignService.find(mediaQuery))
    let message = '';
    if (campaigns.length < 2) {
      message = 'Media already using in following campaign'
    } else {
      message = 'Media already using in following campaigns'
    }
    if(campaigns && campaigns.length > 0) {
      for(let idx = 0; idx < campaigns.length; idx ++) {
        message += ', ' + campaigns[idx].name
      }
      let err = {code: 'ForeignKeyException', message: message};
      return reject(err)
    } else {
      let query = { 
        _id: id,
        advertiserId: user.advertiserId 
      };
      try {
        let media = await(Media.findOneAndRemove(query))
        if (media === null) {
          return reject(new Error("Media not exists!"));
        } else {
          let mediaId = id.toString();
          let key = path.join('media', mediaId)
          await(this.removeS3Media(key, media))
          return resolve(media);
        }
      } catch (err) {
        return reject(err);
      }
    }
  })
  return promise;
};

this.createMedia = async (user, file, mediaName, res) => {
  try {
    let tmpFilePath = file.file.path
    let _data = await(this.readFilePromise(tmpFilePath))

    let _fileType = this.getFileType(tmpFilePath)
    if(_fileType === 'other') {
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
      return res.status(400).send('File format not supported')
    }
    if(_fileType === 'image') {
      let info = imageinfo(_data);
      if(!info) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return res.status(400).send('File format not supported')
      }
      if (info && info.width > 13583) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return res.status(400).send('High resolution file is not supported')
      }
      let buffer = readChunk.sync(tmpFilePath, 0, 12);
      let mimeType = imageType(buffer);
      if(!mimeType) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return res.status(400).send('File format not supported')
      }
      
      let media = {
        name: mediaName,
        advertiserId: user.advertiserId,
        meta: info
      }

      media = await(this.create(media))
      if(!media) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return res.status(400).send('Unable to save media')
      }
      res.send(media)
      res.end()
      let uploadPath = config.upload.path
      let mediaId = media._id.toString()
      let destFilePath = path.join(uploadPath, 'media', mediaId);
      fse.ensureDirSync(destFilePath)
      let thumbPath = path.join(destFilePath, 'thumb');
      fse.ensureDirSync(thumbPath)
      let fileName = media._id.toString();
      destFileName = path.join(destFilePath, fileName)
      fse.copySync(file.file.path, destFileName)

      let sourceFile = path.join(destFilePath, fileName)
      let key = path.join('media', mediaId, fileName) 

      let totalFiles = config.upload.thumb.size.length + 1
      let singleMediaPercentage = 90 / totalFiles

      let fIdx = 0
      await(this.uploadToS3(user, media, sourceFile, key, singleMediaPercentage, (10 + (singleMediaPercentage * fIdx++))))
      let thumbFileNames = []
      for(let idx = 0; idx < config.upload.thumb.size.length; idx++) {
        let thumbFileName = config.upload.thumb.size[idx] + '_' + fileName
        let thumbFilePath = path.join(thumbPath, thumbFileName)
        thumbFileNames.push(thumbFileName)
        await(this.createThumbnail(destFileName, thumbFilePath, config.upload.thumb.size[idx]))
      }
      for (let i = 0; i < thumbFileNames.length; i++) {
        let sourceFile = path.join(thumbPath, thumbFileNames[i])
        key = path.join('media', mediaId, 'thumb', thumbFileNames[i]) 
        await(this.uploadToS3(user, media, sourceFile, key, singleMediaPercentage, (10 + (singleMediaPercentage * fIdx++))))
      }
      let advertiserId = user.advertiserId
      key = advertiserId + '_' + media._id
      io.sendUser(advertiserId, key, { type: 'PROGRESS', message: {progress: 100, status: 'COMPLETED'}});
      let folderPath = path.join(uploadPath, 'media', media._id.toString());
      await(UtilService.deleteFolderRecursive(folderPath));
      let _folderPath = path.join(uploadPath, 'media');
      await(UtilService.deleteFolderRecursive(_folderPath));
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
      console.log('image process done')
    } else if(_fileType === 'video') {
      let data = await(FFMPEGServ.getMetadata(tmpFilePath))
      if(!data) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return reject('Unable to get video meta data')
      }
      let videoStream = data.streams[0]
      if(data.streams.length > 1) {
        for(let i =0; i < data.streams.length; i++) {
          let stream =  data.streams[i]
          if(stream.codec_type === 'video') {
            videoStream = stream
            break
          }
        } 
      }
      let format = data.format
      let meta = {
        width: videoStream.width,
        height: videoStream.height,
        duration: format.duration,
        size: format.size,
        type: 'video'
      }
      media = {
        name: mediaName,
        advertiserId: user.advertiserId,
        meta: meta
      }
      media = await(this.create(media))
      if(!media) {
        if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
        }
        return res.status(400).send('Unable to save media')
      }
      res.send(media)
      res.end()
      let uploadPath = config.upload.path
      let destFilePath = path.join(uploadPath, 'media', media._id.toString());
      fse.ensureDirSync(destFilePath)
      let thumbPath = path.join(destFilePath, 'thumb');
      fse.ensureDirSync(thumbPath)
      let fileName = media._id.toString() + config.upload.video.default.ext;
      let destFile = path.join(destFilePath, fileName);
      
      await(FFMPEGServ.convertVideo(user, media, tmpFilePath, destFile, 10))
      
      let previewFileName = 'preview' + config.upload.video.default.ext;
      await(FFMPEGServ.createPreviewVideo(user, media, destFile, path.join(destFilePath, previewFileName), 10, 10))

      let totalFiles = config.upload.thumb.size.length + 2
      let singleMediaPercentage = 80 / totalFiles

      let fIdx = 0
      let sourceFile = path.join(destFilePath, fileName) 
      key = path.join('media', media._id.toString(), fileName)
      await(this.uploadToS3(user, media, sourceFile, key, singleMediaPercentage, (20 + (singleMediaPercentage * fIdx++))))

      sourceFile = path.join(destFilePath, previewFileName) 
      key = path.join('media', media._id.toString(), previewFileName)
      await(this.uploadToS3(user, media, sourceFile, key, singleMediaPercentage, (20 + (singleMediaPercentage * fIdx++))))

      await(FFMPEGServ.createThumbnail(destFile, destFilePath))

      let thumbFileNames = []
      for(let idx = 0; idx < config.upload.thumb.size.length; idx++) {
        let thumbFileName = config.upload.thumb.size[idx] +'_' + media._id.toString()
        let thumbFilePath = path.join(thumbPath, thumbFileName)
        thumbFileNames.push(thumbFileName)
        await(this.createThumbnail(path.join(destFilePath, 'thumb_1.png'), thumbFilePath, config.upload.thumb.size[idx]))
      }

      for (let i = 0; i < thumbFileNames.length; i++) {
        sourceFile = path.join(thumbPath, thumbFileNames[i]) 
        key = path.join('media', media._id.toString(), 'thumb', thumbFileNames[i])  
        await(this.uploadToS3(user, media, sourceFile, key, singleMediaPercentage, (singleMediaPercentage * fIdx++)))
      }
      let advertiserId = user.advertiserId
      key = advertiserId + '_' + media._id
      io.sendUser(advertiserId, key, { type: 'PROGRESS', message: {progress: 100, status: 'COMPLETED'}});
      let folderPath = path.join(uploadPath, 'media', media._id.toString());
      await(UtilService.deleteFolderRecursive(folderPath));
      let _folderPath = path.join(uploadPath, 'media');
      await(UtilService.deleteFolderRecursive(_folderPath));
    }
    if (fs.existsSync(tmpFilePath)) {
      fs.unlinkSync(tmpFilePath);
    }
  } catch (e) {
    console.log(e)
  }
};

this.getFileType = (src) => {
  let buffer = readChunk.sync(src, 0, 4100);
  let _fileType = fileType(buffer);
  if (_fileType && (_fileType.mime === 'image/jpeg' || _fileType.mime === 'image/jpg' || _fileType.mime === 'image/png')) {
    return 'image'
  // if(_fileType.mime.startsWith('image')) {
  //   return 'image'
  } else if(_fileType && _fileType.mime.startsWith('video')) {
    return 'video'
  }
  return 'other'
}

this.readFilePromise = (filePath) => {
  let promise = new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if(err) {
        return reject(err)
      }
      return resolve(data);
    });
  });
  return promise;
}

this.createThumbnail = (source, dest, size) => {
  let promise = new Promise((resolve, reject) => {
    gm(source)
    .resize(size, size, '^')
    .gravity('Center')
    .write(dest, (err) => {
      resolve()
    });
  });
  return promise;
};

this.uploadToS3 = (user, media, sourceFile, key, singleMediaPercentage, completedProgress) => {
  let promise = new Promise((resolve, reject) => {
    let ext = path.extname(sourceFile)
    let contentType = ''
    if(ext === '.json') {
      contentType = 'application/json'
    } else if (!ext) {
      contentType = 'image/png'
    } else {
      contentType = 'video/mp4'
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
      let advertiserId = user.advertiserId
      let key = advertiserId + '_' + media._id
      io.sendUser(advertiserId, key, { type: 'PROGRESS', message: {progress: progress, status: 'IN_PROGRESS'}});
    }).send((err) => {
      if(err) {
        reject(err)
      }
      resolve()
    });

  });
  return promise;
}

this.removeS3Media = (key, media) => {
  let s3Obj = {
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

      for(let i = 0; i < data.Contents.length; i++) {
        let obj = data.Contents[i];
        s3Obj.Delete.Objects.push({Key: obj.Key});
      }
      return s3.deleteObjects(s3Obj, (err) => {
        return resolve(media);
      });
    });
  });
};

module.exports = this;