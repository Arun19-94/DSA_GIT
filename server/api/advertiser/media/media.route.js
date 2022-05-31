const config = require('../../../config/config.js');

const path = require("path");

const index = `${config.server.context}/api/advertisers/media`;

const MediaServ = require("./media.service");

const AuthCognitoServ = require('../../../components/auth/cognito/auth');

const UtilService = require('../../../components/util.service');

const join = link => path.join(index, link != null ? link : "");

module.exports = (app) => {

  app.get(join("/"), AuthCognitoServ.isAuthenticated(), findAll);

  app.get(join("/query/:query"), AuthCognitoServ.isAuthenticated(), findAll);

  app.post(join("/"), AuthCognitoServ.isAuthenticated(), create);

  app.put(join("/:id"), AuthCognitoServ.isAuthenticated(), update);

  app.delete(join("/:id"), AuthCognitoServ.isAuthenticated(), _delete);

  app.get(join("/:id/image/"), downloadMedia);

  app.get(join("/:id/thumb/:size"), downloadThumb);

  // app.get(join("/:id/video/"), downloadVideo);

  app.get(join("/:id/video/preview/"), downloadVideoPreview);

};

const findAll = (req, res) => {
  let user = req.user;
  let _query = req.params.query;
  let name = ''
  if(_query) {
    _query = JSON.parse(_query)
    if(_query && _query.name) {
      name = UtilService.skipSpecialChar(_query.name)
    }
  }
  let query = { 
    $and: [
      {
        advertiserId: user.advertiserId,
      },
      {
        name: {
					$regex: name,
					$options: 'ig',
				}
      }
    ]
  }
  if(_query.hasOwnProperty('favourite') && _query.favourite !== undefined) {
    query.$and.push({favourite: true})
  }
  return MediaServ
    .find(query)
    .then((result) => {
      return res.send(result);
    }).catch(err => res.error(err));
};

const create = (req, res) => {
  let user = req.user;
  if(!user.advertiserId) {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  if(!req.files.file && req.files.file.length <= 0) {
    return res.status(400).send(new Error('No files upload.'))
  }
  let mediaName = ''
  if(req.body && req.body.name) {
    mediaName = req.body.name
  }
  let file = req.files
  MediaServ.createMedia(user, file, mediaName, res)
};

const update = (req, res) => {
  let user = req.user;
  if(!user.advertiserId) {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  let media = req.body;
  MediaServ.update(media)
  .then((_media) => {
    return res.send(_media);
  }).catch((err) => {
    return res.status(400).send(err);
  });
}

const _delete = (req, res) => {
  let user = req.user;
  if(!user.advertiserId) {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  let mediaId;
  if(!req.params.id) {
    return res.status(400).send("Something went wrong, Unable to delete");
  }
  mediaId = req.params.id.toString();
  MediaServ.delete(mediaId, user)
  .then((_media) => {
    return res.send(_media);
  }).catch((err) => {
    return res.status(400).send(err);
  });
}

const downloadMedia = (req, res) => {
  let mediaId = req.params.id.toString();
  let url = config.aws.s3.publicURL + '/media/' + mediaId + '/' + mediaId
  res.redirect(url)
};

const downloadThumb = function(req, res) {
  let thumbSize = req.params.size.toString();
  let mediaId = req.params.id.toString();
  let url = config.aws.s3.publicURL + '/media/' + mediaId + '/thumb/' + thumbSize + '_' + mediaId
  res.redirect(url)
};

// const downloadVideo = function(req, res) {
//   let mediaId = req.params.id.toString();
//   let fileName = mediaId + config.upload.video.default.ext;
//   let url = config.aws.s3.publicURL + '/media/' + mediaId + '/' + fileName
//   res.redirect(url)
// };

const downloadVideoPreview = function(req, res) {
  let mediaId = req.params.id.toString();
  let fileName = 'preview' + config.upload.video.default.ext;
  let url = config.aws.s3.publicURL + '/media/' + mediaId + '/' + fileName
  res.redirect(url)
};