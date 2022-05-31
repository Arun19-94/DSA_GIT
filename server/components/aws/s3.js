/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
var AWS       = require('aws-sdk');
var moment    = require('moment');
var crypto    = require('crypto');
var config    = require('../../config/config.js');
var s3Config  = config.aws.s3;
var Promise   = require('bluebird');
var fs        = require('fs');
var path      = require('path');

// AWS Options
var options = {
    accessKeyId: s3Config.key,
    secretAccessKey: s3Config.secret,
    params: {
      Bucket: s3Config.bucket
    },
    signatureVersion: 'v2'
  };

var s3 = new AWS.S3(options);

var signing = function(filename, type, path) {

  // Read Type
  var readType = 'private';

  // Policy
  var policy = {
    expiration: moment().add(s3Config.expiration, 'm').toDate(),
    conditions: [
      { bucket: s3Config.bucket },
      [ 'starts-with', '$key', path ],
      { 'acl': readType },
      { 'success_action_status': '201' },
      [ 'starts-with', '$Content-Type', type ]
    ]
  };

  var strPolicy     = JSON.stringify(policy);
  var base64Policy  = new Buffer(strPolicy, 'utf-8').toString('base64');
  var signature     = crypto
    .createHmac('sha1', s3Config.secret)
    .update(new Buffer(base64Policy, 'utf-8'))
    .digest('base64');

  var credentials   = {
    url: s3Config.url,
    fields: {
      key: path,
      AWSAccessKeyId: s3Config.key,
      acl: readType,
      policy: base64Policy,
      signature,
      'Content-Type': type,
      success_action_status: 201
    }
  };

  return credentials;
};

var removeDir = dir =>
  new Promise(function(resolve, reject) {
    s3.listObjects({
      Bucket: s3Config.bucket,
      Prefix: dir
    }, function(err, data) {
      let s3Obj = undefined;
      if (err) {
        console.log(err);
        return reject(err);
      }
      s3Obj = {
        Bucket: s3Config.bucket,
        Delete: { Objects: []
      }
      };
      return Promise.each(data.Contents, obj => s3Obj.Delete.Objects.push({Key: obj.Key})).then(function() {
        if (s3Obj.Delete.Objects.length > 0) {
          return s3.deleteObjects(s3Obj, function(err, data) {
            if (err) {
              console.log(err);
              return reject(err);
            }
            return resolve(data);
        });
        }
      }).catch(function(err) {
        console.log(err);
        return reject(err);
      });
    });
})
;

var downloadAsFile = (src, dst) =>
  new Promise(function(resolve, reject) {
    var file = fs.createWriteStream(dst);
    file.on('close', () => resolve());
    var fileStream = s3.getObject({
      Bucket: s3Config.bucket,
      Key: src}).createReadStream().on('error', err => reject(err)).pipe(file);
})
;

var downloadAsStream = function(src, res) {
  res.setHeader('Content-Disposition',
   `attachment;filename=${path.basename(src)}`);
  var params = {
    Bucket: s3Config.bucket,
    Key: src
  };
  return s3.getObject(params).on('httpData', function(chunk) {
    res.write(chunk);
  }).on('httpDone', function() {
    res.end();
  }).send();
};

var listFile = dir =>
  new Promise(function(resolve, reject) {
    s3.listObjects({
      Bucket: s3Config.bucket,
      Prefix: dir
    }, function(err, data) {
      if (err) {
        console.log(err);
        return reject(err);
      }
      return resolve(data.Contents);
    });
})
;

var fnc = {
  s3,
  signing,
  bucket: s3Config.bucket,
  deleteDir: removeDir,
  downloadAsFile,
  downloadAsStream,
  listFile
};

module.exports = fnc;
