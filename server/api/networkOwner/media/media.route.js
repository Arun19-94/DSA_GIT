const config = require('../../../config/config.js');

const path = require("path");

const index = `${config.server.context}/api/networkOwner/media`;

const MediaServ = require("./media.service");

const AuthCognitoServ = require('../../../components/auth/cognito/auth');

const join = link => path.join(index, link != null ? link : "");

module.exports = (app) => {

	app.get(join("/:id/thumb/:size"), downloadThumb);
	
  app.get(join("/:type/listingMedia"), AuthCognitoServ.isAuthenticated(), this.getListingMedia);
  
  app.post(join("/"), AuthCognitoServ.isAuthenticated(), this.createMedia);
  
  app.delete(join("/:signId/:mediaId/:type"), AuthCognitoServ.isAuthenticated(), this.deleteMedia);

};

const downloadThumb = function (req, res) {
	let thumbSize = req.params.size.toString();
	let mediaId = req.params.id.toString();
	let url = config.aws.s3.publicURL + '/network-owner-media/' + mediaId + '/thumb/' + thumbSize + '_' + mediaId
	res.redirect(url)
};

this.getListingMedia = async (req, res) => {
  if (req.session && req.session.user)
    var user = req.user;
  try {
    let type = req.params.type
    let query = {}
    if (type === 'UNSOLD_MEDIA' || type === 'SYSTEM') {
      query = {
        $or: [
          {
            networkOwnerId: user.networkOwnerId,
            type: 'UNSOLD_MEDIA'
          },
          {
            type: 'SYSTEM'
          },
        ]
      }
    } else {
      query = {
        networkOwnerId: user.networkOwnerId,
        type: type
      }
    }
    let result = await (MediaServ.find(query))
    return res.send(result);
  } catch (err) {
    return res.status(400).send(err)
  }
};

this.createMedia = async(req, res) => {
  if (req.session && req.session.user)
    var user = req.user;
  let type = req.body.type
  if(!user.networkOwnerId) {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  if(!req.files.file && req.files.file.length <= 0) {
    return res.status(400).send('No files upload.')
  }
  try {
    await(MediaServ.uploadSignMedia(req.files.file, type, user, res))
  } catch(err) {
    return res.status(400).send(err)
  }
};

this.deleteMedia = async (req, res) => {
  if (req.session && req.session.user)
    var user = req.user;
  if (user.userType !== 'networkOwner')
    return res.status(401).send(user.name + " don't have permission to access");
  let signId = req.params.signId;
  let mediaId = req.params.mediaId;
  let type = req.params.type
  let userDeleteCreatedAt = JSON.stringify(user)
  user = JSON.parse(userDeleteCreatedAt)
  delete user.createdAt
  try {
    let _media = await (MediaServ.findOne({ _id: mediaId }))
    if (_media.networkOwnerId.toString() !== user.networkOwnerId.toString())
      return res.status(401).send("Access denied.")
    let media = await (MediaServ.delete(mediaId, user, signId, type))
    return res.send(media);
  } catch (err) {
    return res.status(400).send(err)
  }
};