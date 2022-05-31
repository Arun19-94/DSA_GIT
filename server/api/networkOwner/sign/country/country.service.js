var Country       = require('./country.schema');

var async          = require('asyncawait/async');

var await          = require('asyncawait/await');

var Promise        = require('bluebird');

var config         = require('../../../../config/config.js');

var Sign       = require('../sign.schema');

this.find = async(function(query) {
  if (query == null) { 
    query = {};
  }
  var countries = await(Country.find(query))
  return countries
})

this.getCountries = async(function(country) {
  var _country = country.toLowerCase()
  var countries = []
  var promise = new Promise(function(resolve, reject) {
    var filter = {
      name: {'$regex': new RegExp('^' + _country, 'i')}
    }
    var result = await(Country.find(filter))
    for (var i = 0; i < result.length; i++) {
      countries.push(result[i].name)
    }
    return resolve(countries)
  });
  return promise;
})
