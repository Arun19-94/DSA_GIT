var config 							= require('../../config/config.js');

var AWS                 = require('aws-sdk')

var s3Config            = config.aws.s3

var Promise             = require('bluebird');

//AWS Options
options = {
  accessKeyId: s3Config.key,
  secretAccessKey: s3Config.secret,
  region: 'us-west-2'
}

var ses                 = new AWS.SES(options);

this.sendMail = function(sender, receivers, subject, content) {
  var promise = new Promise(function(resolve, reject) {
    ses.sendEmail({
      Source: sender,
      Destination: {
        ToAddresses: receivers
      },
      Message: {
        Subject: {
          Data: subject
        },
        Body: {
          Html: {
            Data: content
          }
        }
      }
    }, function(err, data) {
      if (err) {
        console.log(err)
        reject(err)
      }
      resolve(data)
    });
  });
  return promise 
};