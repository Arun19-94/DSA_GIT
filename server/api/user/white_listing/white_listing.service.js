var WhiteListing = require('./white_listing.schema');

var UserServ = require('../user.service');

// var async = require('asyncawait/async');

// var await = require('asyncawait/await');


this.create = async(ip, userId) => {
	var whitelisting = { ip: ip, userId: userId }
	return await(WhiteListing.createAsync(whitelisting))
}

this.findByQuery = async(Query) => {
	try {
		var result = await(WhiteListing.find(Query))
		return result
	} catch (err) {
		return err
	}
}

this.create = async() => {
	try {
		var _ip = ["103.35.198.25"]
		for (let i = 0; i < _ip.length; i++) {
			let ipAddress = _ip[i];
			let query = { ip: ipAddress }
			var data = await(WhiteListing.find(query))
			if (data.length <= 0) {
				var result = await(WhiteListing.createAsync({ ip: ipAddress }))
			}
		}
		// return result
	} catch (err) {
		console.log(err)
		return err
	}
}

this.create()