const mongoose = require('mongoose');

const request = require('request');

const Config = require('../../../config/config');

const UserService = require('../../user/user.service');

const index = `${Config.server.context}/api/admin/user`;

const AdvertiserService = require('../../advertiser/advertiser.service')

const NetworkOwnerService = require('../../networkOwner/networkOwner.service')

var AuthCognitoServ = require('../../../components/auth/cognito/auth');

const join = link => index + (link != null ? link : '');

module.exports = (app) => {
  app.get(join('/'), this.find);
  app.get(join('/customer/:customerId/:searchParams'), this.find);
  app.post(join('/reseller'), this.findResellerUSersList);
  app.get(join('/:id'), this.findOne);
  app.get(join('/search/:searchParams'), this.search);
  app.post(join('/'), this.create);
  app.put(join('/:id'), this.update);
  app.delete(join('/:id'), this.delete);
  app.post(join('/getUsers'), this.getPaginatedUsers);
};

this.find = (req, res) => {
  let { customerId, searchParams } = req.params;
  searchParams = JSON.parse(searchParams);
  let searchText = (searchParams && searchParams.query) ? searchParams.query : ''
  var _searchText = ''
  if (searchText.length > 0) {
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
  }
  const query = {
    $and: [
      {
        customer: mongoose.Types.ObjectId(customerId),
        type: "CUSTOMER_USER"
      },
      {
        $or: [
          {
            name: {
              $regex: `${searchText}`,
              $options: 'ig'
            }
          },
          {
            email: {
              $regex: `${searchText}`,
              $options: 'ig'
            }
          },
        ]
      }
    ]
  }
  UserService.find(query)
    .then(users => {
      res.send(users);
    }).catch(err => {
      return res.status(400).send(err);
    })
};

this.findResellerUSersList = (req, res) => {
  let { resellerId, searchParams } = req.body;
  searchParams = JSON.parse(searchParams);
  let searchText = (searchParams && searchParams.query) ? searchParams.query : ''
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
    $and: [
      {
        reseller: mongoose.Types.ObjectId(resellerId),
        type: "RESELLER_USER"
      },
      {
        $or: [
          {
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
  UserService.find(query)
    .then(users => {
      res.send(users);
    }).catch(err => {
      return res.status(400).send(err);
    })
};

this.findOne = (req, res) => {
  const { id } = req.params;
  UserService.findOne({ _id: id })
    .then(user => {
      res.send(user);
    }).catch(err => {
      return res.status(400).send(err);
    });
};

this.search = (req, res) => {
  let { searchParams } = req.params;
  if (!searchParams) {
    return res.send([]);
  }
  searchParams = JSON.parse(searchParams);
  if (!searchParams || !searchParams.name) {
    return res.send([]);
  }
  const query = {
    name: {
      $regex: `${searchParams.name}`,
      $options: 'ig'
    }
  }
  UserService.find(query)
    .then(states => {
      return res.send(states);
    }).catch(err => {
      return res.status(400).send(err);
    })
};

this.create = async (req, res) => {
  const user = req.body;
  try {
    if (user == null) {
      return res.status(400).send("user not found");
    }
    let message = this.validate(user)
    if (message)
      return res.status(400).send(message);
    user.email = user.email.toLowerCase()
    var { recaptchaResponse } = user;
    var url = `https://www.google.com/recaptcha/api/siteverify?secret=6LcnYzAUAAAAAG5gumTfH21OP3yHGxaEJ0J-UkF9&response=${recaptchaResponse}`;
    return request.post({
      url,
      timeout: 5000
    }, async (err) => {
      if (err) {
        res.status(400).send("Captcha Error");
      }
      user.userType = "advertiser"
      try {
        let result = await (AuthCognitoServ.signUpCognito(user))
        return res.send(result)
      } catch (err) {
        return res.status(400).send(err);
      }
    });
  } catch (err) {
    return res.status(400).send(err);
  }
};

this.validate = (user) => {
  if (!user)
    return "User required."
  if (!user.name)
    return "Name required."
  if (user.name)
    if (user.name.length > 30)
      return 'Please enter name with character less than 30.';
  if (!user.email)
    return "Email required."
  if (!user.password)
    return "Password required."
  if (!user.customer && !user.reseller)
    return "Customer or reseller required."
  return false
}

this.update = (req, res) => {
  const user = req.body;
  let _user = {
    _id: user._id,
    name: user.name,
    company: user.company
  }
  UserService.update(_user)
    .then((_user) => {
      return res.send(_user);
    }).catch((err) => {
      return res.status(400).send(err);
    });
};

this.delete = (req, res) => {
  const { id } = req.params;
  UserService.delete({ _id: id })
    .then(user => {
      res.send(user);
    }).catch(err => {
      return res.status(400).send(err);
    });
};

this.getPaginatedUsers = async (req, res) => {
  let params = req.body
  try {
    let data = await (UserService.findPaginatedUsers(params))
    return res.send(data);
  } catch (err) {
    return res.status(400).send(err);
  }
}
