const Promise = require('bluebird');

const path = require('path');

const express = require('express');

const bodyParser = require('body-parser');

const multipart = require('connect-multiparty');

const cors = require('cors');

const session = require('express-session');

const Config = require('../../config/config.js');

const routeHandler = require('../handler/route.handler');

this.connect = () => {
  return new Promise((rs, rj) => {
    const app = express();
    const port = Config.server.port != null ? Config.server.port : 8080;
    app.disable('x-powered-by');

    app.use(bodyParser.urlencoded({
      extended: false,
      limit: '5mb'
    }));
    app.use(bodyParser.json({ limit: '5mb' }));
    app.use(multipart({ uploadDir: Config.tmp }));
    app.use(cors());
    app.use(routeHandler.clientErrorHandler);
    const sess = {
      secret: 'Dcs@123',
      resave: false,
      saveUninitialized: false,
      cookie: {
        path: '/'
      }
    };
    const tSession = session(sess);
    app.use(tSession);

    this.server = app.listen(port, () => {
      this.app = app;
      this.session = tSession;
      console.log(`App listening on port ${port}!`);
      return rs();
    });
  });
};