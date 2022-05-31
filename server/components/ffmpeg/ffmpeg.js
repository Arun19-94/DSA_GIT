var ffmpeg  = require('fluent-ffmpeg');

var path    = require('path');

var fs      = require('fs');

var Promise = require('bluebird');

var fse     = require("fs-extra");

var config  = require('../../config/config.js');

var io      = require('../../components/socket/client.socketIO.service');

this.convertVideo = function(user, media, src, dest, p=10) {
  var promise = new Promise(function(resolve, reject) {
    var ext = path.extname(src)
    if(ext === '.mp4') {
      fse.copySync(src, dest)
      var id = ''
      if(user.advertiserId) {
        id = user.advertiserId
      } else {
        id = user.networkOwnerId
      }
      var key = id + '_' + media._id
      console.log('% ' + 10)
      io.sendUser(id, key, { type: 'PROGRESS', message: {progress: 10, status: 'IN_PROGRESS', description: 'Converting video..' + 100 + '%'}});
     return resolve() 
    }
    ffmpeg(src)
    .videoCodec(config.upload.video.default.codec)
    .format(config.upload.video.default.ext.replace('.', ''))
    .on('start', function(cmd) {
      //console.log(cmd)
    })
    .on('error', function(err) {
      return reject(err)
    })
    .on('end', function() {
      return resolve(dest)
    })
    .on('progress', function(progress) {
      var id = ''
      if(user.advertiserId) {
        id = user.advertiserId
      } else {
        id = user.networkOwnerId
      }
      var key = id + '_' + media._id
      let percentage10 = progress.percent / p
      var percent = Math.round(percentage10)
      io.sendUser(id, key, { type: 'PROGRESS', message: {progress: percent, status: 'IN_PROGRESS', description: 'Converting video..' + percent + '%'}});
    })
    .save(dest);
  });

  return promise;
}

this.createPreviewVideo = function(user, media, src, dest, p=10, c=10) {
  var promise = new Promise(function(resolve, reject) {
    ffmpeg(src)
    .duration(10)
    .on('error', function(err) {
      return reject(err)
    })
    .on('end', function() {
      return resolve(dest)
    })
    .on('progress', function(progress) {
      var id = ''
      if(user.advertiserId) {
        id = user.advertiserId
      } else {
        id = user.networkOwnerId
      }
      var key = id + '_' + media._id

      let percentage10 = progress.percent / p
      percentage10 = percentage10 + c
      var percent = Math.round(percentage10)
      io.sendUser(id, key, { type: 'PROGRESS', message: {progress: percent, status: 'IN_PROGRESS', description: 'Generating video preview..' + percent + '%'}});
    })
    .save(dest);
  });

  return promise;
}

this.createThumbnail = function(src, dest) {
  var getMetadata = this.getMetadata
  var promise = new Promise(function(resolve, reject) {
    getMetadata(src)
    .then(function(meta) {
      var options = {
        count: 4,
        folder: dest
      }
      var videoStream = meta.streams[0]
      if(meta.streams.length > 1) {
        for(var i =0; i < meta.streams.length; i++) {
          var stream =  meta.streams[i]
          if(stream.codec_type === 'video') {
            videoStream = stream
            break
          }
        } 
      }
      var { width, height } = videoStream
      var videoThumbSize = 300; 
      if(width > height && width > videoThumbSize) {
        var ratio = width / videoThumbSize
        width = videoThumbSize
        height = height / ratio
      } else if(height > width && height > videoThumbSize) {
        var ratio = height / videoThumbSize
        height = videoThumbSize
        width = width / ratio
      }
      ffmpeg(src)
      .screenshots({
        count: 1,
        folder: dest,
        size: Math.round(width)+'x'+Math.round(height),
        filename: 'thumb_%i.png'
      })
      .on('end', function() {
        resolve(dest)
      });
    }).catch(function(err) {
      reject(err)
    });
  });
  return promise;
}

this.getMetadata = function(src) {
  var promise = new Promise(function(resolve, reject) {
    ffmpeg.ffprobe(src, function(err, metadata) {
      if(err) {
        reject(err);
      } else {
        resolve(metadata)
      }
    });
  });
  return promise;
}

self = this