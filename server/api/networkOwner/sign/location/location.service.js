var Location       = require('./location.schema');

var Promise        = require('bluebird');


this.find = async (query = {}) => {
  return await (Location.find(query))
}

this.create = locations => {
  var promise = new Promise(async (resolve, reject) => {
    if (!locations || locations.length <= 0) {
      return reject('Location required.')
    }
    var _locations = []
    for (var i = 0; i < locations.length; i++) {
      var location = {
        name: locations[i].text
      }
      var result = await (Location.find(location))
      if (result.length > 0) {
        for (var j = 0; j < result.length; j++) {
          _locations.push(result[0])
        }
      } else if (result.length <= 0) {
        _locations.push(await (Location.createAsync(location)))
      }
    }
    return resolve(_locations);
  });
  return promise;
};

this.getLocations = location => {
  var locations = []
  var promise = new Promise(async (resolve, reject) => {
    var filter = {
      name: { '$regex': '.*' + location + '.*', $options: 'i' },
    }
    var result = await (Location.find(filter))
    for (var i = 0; i < result.length; i++) {
      locations.push(result[i].name)
    }
    return resolve(locations)
  });
  return promise;
}