const fs = require('fs');
const path = require('path');
const url = require('url');
const { google } = require('googleapis');
const plus = google.plus('v1');
const config = require('../../config/config.js');
const AuthCognitoServ = require('../auth/cognito/auth');

keys = config.google_oauth.web;

const oauth2Client = new google.auth.OAuth2(
  keys.client_id,
  keys.client_secret,
  keys.redirect_uris[0]
);

google.options({auth: oauth2Client});

const scopes = ['https://www.googleapis.com/auth/plus.me', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'];

this.authenticate = () => {
  return new Promise((resolve, reject) => {
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes.join(' '),
    });
    return resolve({authorizeUrl: authorizeUrl})
  });
}

this.authenticated = async (req, res) => {
  const qs = new url.URL(req.url, config.baseURL).searchParams;
  const { tokens } = await oauth2Client.getToken(qs.get('code'));
  oauth2Client.credentials = tokens;
  const _res = await plus.people.get({userId: 'me'});
  let user = {
    name: _res.data.displayName,
    email: _res.data.emails[0].value,
    photoUrl: _res.data.image.url,
    id_token: tokens. id_token
  }
  await(AuthCognitoServ.googelLogin(user, req));
}