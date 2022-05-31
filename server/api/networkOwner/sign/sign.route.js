const path = require('path');

const Config = require('../../../config/config.js');

const SignServ = require('./sign.service')

const GroupSer = require('../group/group.service')

const AuthCognitoServ = require('../../../components/auth/cognito/auth');

var QueueService        = require('./publish/publish.queue.service');

const CampaignServ = require('../../advertiser/campaign/campaign.service')

const BookingServ = require('./booking/booking.service')

// const UserService = require('./user.service');

const index = `${Config.server.context}/api/networkOwner/sign`;

var momentTime = require('moment-timezone');

var moment         = require('moment');

var timeZones = []

momentTime.tz.names().forEach(tz => {
  var _name = ""
  let nameArray = tz.split("/")
  for (let l = nameArray.length - 1; l >= 0; l--) {
    nameArray[l] = nameArray[l].replace(/_/g, " ")
    if (_name.length === 0) {
      _name = nameArray[l].toString() + ", "
    } else if (l > 0) {
      _name = _name + nameArray[l].toString() + ", "
    } else {
      _name = _name + nameArray[l].toString()
    }
  }
  timeZones.push(
    {
      name: tz,
      _name: _name,
      offset: moment().tz(tz).format("Z"),
      abbrevation: moment().tz(tz).zoneAbbr()
    }
  )
})

const join = link => index + (link != null ? link : '');


module.exports = (app) => {

  app.post(join("/"), this.createSign);

  app.post(join("/:id/update"), this.updateSign);

  app.get(join("/getLocations/:query"), getLocations)

  app.get(join('/:query'), getListingsForAdvertiser)

  app.get(join("/:token/mrss"), getMRSSXml);

  app.get(join("/_mrss/json"), _getMRSSJson);

  app.get(join("/:childIds/getChildDetailsForGroup"), getChildDetailsForGroup);

  app.post(join('/setSession'), this.setListingDetailsInSession)

  app.get(join('/session/getSessionForListingDetails'), this.getListingDetailsFromSession)

  app.post(join('/session/clearSession'), this.clearSession)

  app.post(join("/listings/getTimeZone"), this.getTimeZone);

  app.get(join("/getSign/:id/:signType"), this.getSign);

  app.post(join("/getSignLists/SignLists"),AuthCognitoServ.isAuthenticated(), listAllSigns);

  app.post(join("/:id/status"), AuthCognitoServ.isAuthenticated(), updateStatus);

  app.delete(join("/:id/:signType"), AuthCognitoServ.isAuthenticated(), deleteSign);

  app.put(join("/:id/updateHiddenStatus"), AuthCognitoServ.isAuthenticated(), updateHiddenStatus);

  app.patch(join("/:id/updateParticularField"), this.updateParticularField);

  app.get(join("/getListings/:query"), AuthCognitoServ.isAuthenticated(), this.getListingsForGroup)
  
  app.get(join("/getGroups/:query"), AuthCognitoServ.isAuthenticated(), this.getGroups)
  

  // Create a new group
  app.post(join("/group/createGroup"), AuthCognitoServ.isAuthenticated(), this.createGroup);

  // Update the group
  app.post(join("/:id/group/updateGroup"), AuthCognitoServ.isAuthenticated(), this.updateGroup);

  app.get(join("/:query/getRunningCampaigns"), AuthCognitoServ.isAuthenticated(), this.getRunningCampaigns);

  app.get(join("/:query/getSignAvailableSlots"), AuthCognitoServ.isAuthenticated(), this.getSignAvailableSlots);

  app.post(join("/:id/publish"), AuthCognitoServ.isAuthenticated(), this.publish);

  app.post(join("/getAvailableSlotsForEachSign"), AuthCognitoServ.isAuthenticated(), this.getAvailableSlotsForEachSign);

  // app.post(join('/getAllListings'), findForPagination);
  app.post(join("/claim/device"), AuthCognitoServ.isAuthenticated(), claim);

  app.get(join("/:id/unclaimDevice"), AuthCognitoServ.isAuthenticated(), unclaimDevice);

   // Import bulk listings
   app.post(join("/importBulkListings/listings"), AuthCognitoServ.isAuthenticated(), importBulkListings);

};

this.getSign = (req, res) => {
  if (req.session && req.session.user)
  var user = req.session.user
  var { id } = req.params;
  var { signType } = req.params;
  if (signType !== "GROUP") {
    return SignServ.findOne({_id: id}).then(sign => {
      return SignServ.findGroup(sign).then(result => {
        return res.send(result);
      })
    })
  } else {
    return GroupSer.findOneById(id, user).then(result => {
      return res.send(result);
    })
  }
};

var getLocations = async (req, res) => {
  var params = req.body
  let location = req.params.query.toString()
  try {
    var result = await (SignServ.getLocations(location))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err);
  };
};

this.getListingsForGroup = async (req, res) => {
  if (req.session && req.session.user)
    var user = req.session.user
  let searchText = req.params.query.toString()
  try {
    var result = await (SignServ.getListingsForGroup(searchText, user))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err);
  };
};

this.getGroups = async (req, res) => {
  if (req.session && req.session.user)
    var user = req.session.user
  let params = JSON.parse(req.params.query)
  try {
    var result = await (SignServ.getGroups(params, user.networkOwnerId))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err);
  };
};

var getListingsForAdvertiser = async (req, res) => {
  let params = JSON.parse(req.params.query)
  response = {};
  try {
    let ids = params.selectedListingIdsForGetUpdations
    var signIds = []
    var groupIds = []
    var selectedSigns = []
    var signsCount = {}
    if (ids && ids.length > 0) {
      for (let idLength = 0; idLength < ids.length; idLength++) {
        if (ids[idLength].signType == 'SIGN') {
          signIds.push(ids[idLength]._id)
        } else {
          groupIds.push(ids[idLength]._id)
        }
      }
    }
    if (signIds.length > 0 || groupIds.length > 0) {
      selectedSigns = await (SignServ.getSelectedSignsData(signIds, groupIds, params, _user))
      signsCount.selectedSigns = selectedSigns
    }
    if (Config.NATURE && Config.NATURE === 'SCHOOL') {
      let skip = params.skip
      let limit = params.limit
      let signs = await(SignServ.schoolList(skip, limit))
      signsCount.count = signs.length
      signsCount.signs = JSON.stringify(signs)
    } else {
      var _user = {}
      if (req.session) {
        if (req.session.user) {
          _user = req.session.user
        }
      }
      if (!params.audience.isHiddenListing) {
        signsCount = await (SignServ.getSignsForAudiencePage(params, _user))
      } else {
        var hiddenSigns = []
        if (_user && _user.networkOwnerId) {
          hiddenSigns = await (SignServ.getHiddenSignsData(params, _user))
          signsCount.signs =  JSON.stringify(hiddenSigns)
          signsCount.count = hiddenSigns.length
        }
  
      }
    }
    var signsString = JSON.stringify(signsCount);
    return res.send(signsString)  
  } catch (err) {
    console.log(err)
    res.status(400).send(err)
  }
}

var getMRSSXml = (req, res) => {
  var { token } = req.params;
  var { type } = (req.query)
  return SignServ
    .getMRSSXml(res, token, type)
};

var _getMRSSJson = (req, res) => {
  var token = req.headers.token
  var type = 'json'
  if(!token) {
    return res.status(401).json(new Error("Invalid request"));
  }
  return SignServ
    .getMRSSXml(res, token, type)
};

var getChildDetailsForGroup = async (req, res) => {
  let childIds = JSON.parse(req.params.childIds)
  try {
    var result = await (SignServ.getChildDetails(childIds))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err);
  };
};
this.setListingDetailsInSession = async(req, res) => {
  try {
    let listing = req.body;
    let message = await(SignServ.validateListing(listing))
    if (message)
      return res.status(400).send(message)
    req.session.newListing = listing;
    return res.send(req.session.newListing);
  } catch (err) {
    res.status(400).send(err)
  }
}

this.getListingDetailsFromSession = (req, res) => {
  return res.send(req.session.newListing);
}

this.clearSession = (req, res) => {
  req.session.newListing = null
  return res.send();
}

this.getTimeZone = async(req, res) => {
  try {
    if (req.body.searchText) {
      var regex = new RegExp( req.body.searchText, 'ig' );
      var _timezone = []
      var _timeZoneArray = JSON.parse(JSON.stringify(timeZones))
      for (let i = 0; i < _timeZoneArray.length; i++) {
        if (_timeZoneArray[i]._name.match(regex) || _timeZoneArray[i].abbrevation.match(regex)) {
          _timezone.push(_timeZoneArray[i])
        }
      }
      return res.send(_timezone)
    } else {
      return res.send(timeZones)
    }
  } catch (err) {
    return res.status(400).send(err)
  }
}

this.createSign = async (req, res) => {
  if (req.session && req.session.user)
    var user = req.session.user
  if (user.userType !== 'networkOwner')
    return res.status(401).send(user.name + " don't have permission to access");
  var sign = req.body.sign;
  sign.groupType = 'NONE'
  sign.signType = 'SIGN'
  var locationNames = sign.locationNames
  sign.networkOwnerId = user.networkOwnerId
  if (!sign.avgViewersCountDriving)
    sign.avgViewersCountDriving = 0
  if (!sign.avgViewersCountWalking)
    sign.avgViewersCountWalking = 0
  if (!sign.avgViewersCountTrain)
    sign.avgViewersCountTrain = 0
  sign.totalAvgViewersCount = sign.avgViewersCountDriving + sign.avgViewersCountWalking + sign.avgViewersCountTrain
  if (sign.claimable === 'true') {
    var claimId = sign.claimId.toString()
    if (claimId.length > 6) {
      return res.status(400).send('Please enter the valid claim id.')
    }
    sign.claimId = claimId.toUpperCase()
  }
  try {
    sign.locationString = "";
    if (locationNames && locationNames.length > 0) {
      for (let i = 0; i < locationNames.length; i++) {
        sign.locationString = sign.locationString + locationNames[i].text + "^%"
      }
    }
    var result = await (SignServ.create(sign, locationNames, user.email, res, req))

    result.networkOwnerId = user.networkOwnerId
    if (sign.childs && sign.childs.length > 0) {
      sign._id = result._id
      var childs = await (SignServ.addAndRemoveSignFromGroup(sign._id, sign, 'CREATED'))
      result.childs = childs
      if ((result.forceFullyUpdatePlaylist) || (result.networkOwnerId.toString() === _group[0].networkOwnerId.toString())) {
        await (SignServ.insertDataIntoBookingAndPayment(result._id, _group[0]))
      }
    }
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
};

this.updateSign = async (req, res) => {
  if (req.session && req.session.user)
    var user = req.session.user
  if (user.userType !== 'networkOwner')
    return res.status(401).send(user.name + " don't have permission to access");
  var { id } = req.params;
  var sign = req.body.sign;
  if (sign.signType === "SIGN")
    var validateUser = await (SignServ.findOne({ _id: sign._id }))
  else
    var validateUser = await (GroupSer.findOne({ _id: sign._id }))
  if (validateUser.networkOwnerId.toString() !== user.networkOwnerId.toString())
    return res.status(401).send("Access denied.");
  if (!sign.avgViewersCountDriving)
    sign.avgViewersCountDriving = 0
  if (!sign.avgViewersCountWalking)
    sign.avgViewersCountWalking = 0
  if (!sign.avgViewersCountTrain)
    sign.avgViewersCountTrain = 0
  sign.totalAvgViewersCount = sign.avgViewersCountDriving + sign.avgViewersCountWalking + sign.avgViewersCountTrain
  if (sign.signType !== 'GROUP') {
    sign.signType = 'SIGN'
    var locationNames = sign.locationNames
    try {
      var _ownMedia = []
      for (var i = 0; i < sign.ownMedia.length; i++) {
        if (sign.ownMedia[i].type !== "SYSTEM") {
          _ownMedia.push(sign.ownMedia[i])
        }
        if (sign.ownMedia[i].networkOwnerId.toString() !== sign.networkOwnerId.toString()) {
          return res.status(401).send("Access denied.");
        }
      }
      sign.ownMedia = []
      sign.ownMedia = _ownMedia
      sign.locationString = ""
      if (locationNames && locationNames.length > 0) {
        for (let i = 0; i < locationNames.length; i++) {
          sign.locationString = sign.locationString + locationNames[i].text + "^%"
        }
      }
      var result = await (SignServ.updateSign(id, sign, locationNames, res))
      res.send(result)
    } catch (err) {
      res.status(400).send(err)
    }
  } else {
    try {
      var result = await (SignServ.updateGroupProfile(id, sign, res))
      if (sign.groupType === 'PRIVATE') {
        var queue = []
        for (let childLength = 0; childLength < sign.childs.length; childLength++) {
          let q = {
            signId: sign.childs[childLength]._id.toString(),
            time: new Date()
          }
          queue.push(q);
        }
        QueueService.insetMany(queue);
      }
      res.send(result)
    } catch (err) {
      res.status(400).send(err)
    }
  }
};

var listAllSigns = async (req, res)=> {
  var user = req.session.user
  var networkOwnerId = user.networkOwnerId
  var query = req.body
  try {
    var response = {}
    var result = await (SignServ.getAllSignsForPagination(query, networkOwnerId))
    response.signs = result.signs
    response.count = result.count
    return res.send(response)
  } catch(err) {
    return res.status(400).send(err);  
  };
};

var updateStatus = async(req, res)=> {
  try {
  var user = req.user;
  if(user.userType !== 'networkOwner' && user.userType !== 'admin') {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  var { id } = req.params;
  var { status } = req.body;
  var { signType } = req.body;
  if(status === undefined) {
    res.status(400).send('Status required.')
    return;
  }
    if (signType !== "GROUP"){
      var result = await(SignServ.updateStatus(id, status))
    } else{
      var groupSign =  await(GroupSer.find({_id: id})) 
      var result = await(GroupSer.updateGroupStatusChange(id, status))
    }
    var queue = []
    if (result.active) {
      if (result.signType !== 'GROUP') {
        queue = [
          {
            signId: result._id,
            time: new Date()
          }
        ]
        QueueService.insetMany(queue);
      }
      res.send(result)
    } else if (result.signType === 'GROUP' && result.active === false) {
      var group = await(SignServ.removeSignsFromGroup(result._id, result))
      var _group = groupSign[0]
      for (let i = 0; i < _group.childs.length; i++) { 
        let q = {
          signId: _group.childs[i]._id,
          time: new Date()
        }
        queue.push(q);
      }
      QueueService.insetMany(queue);
      res.send(group)
    } else if (result.signType === 'SIGN' && result.active === false) {
      var group;
      var resultremovedGroup ;
      var query = {childs: {$in: [id]}}
      var resultGroup = await(GroupSer.getSignContainGroup(id))
      for (var i = 0; i < resultGroup.length ; i++) {
        group = resultGroup[i]
        for (var j = 0; j < group.childs.length; j++) {
          if (group.childs[j]._id.toString() === id.toString()) {
            group.childs.splice(j, 1)
          }
          if(group.childsDetails[j].toString() ===id.toString()) {
            group.childsDetails.splice(j, 1)
          }
        }
        resultremovedGroup = await(SignServ.removeListingFromGroup(group._id, group, id.toString()))
      }
      var queue = [
        {
          signId: result._id,
          time: new Date()
        }
      ]
      QueueService.insetMany(queue);
      res.send(result)
    }
  } catch(err) {
    res.status(400).send(err)
  }
};

var deleteSign = async(req, res) => {
  var user = req.user;
  if(user.userType !== 'networkOwner') {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  var { id } = req.params;
  var { signType } = req.params;
  try {
    if(signType !== "GROUP") {
      var sign = await(SignServ.findOne({_id: id}))
    } else {
      var sign = await(GroupSer.findOne({_id: id}))
    }
    if (sign.networkOwnerId.toString() !== user.networkOwnerId.toString()) {
      return res.status(401).send('Access denied.')
    }
    await(SignServ.delete(id, user,signType, res))
    
  } catch(err) {
    res.status(400).send(err)
  }
};

var updateHiddenStatus = async(req, res) => {
  var user = req.user;
  if (user.userType !== 'networkOwner' && user.userType !== 'admin') {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  var { id } = req.params;
  var { hiddenStatus } = req.body;
  var { signType } = req.body;
  if (hiddenStatus === undefined) {
    return res.status(400).send('Status required.')
  }
  try {
    if (signType !== "GROUP") {
      var result = await(SignServ.updateHiddenStatus(id, hiddenStatus))
    } else {
      var result = await(GroupSer.updateGroupHiddenStatusChange(id, hiddenStatus))
    }
    return res.send(result)
    
  } catch(err) {
    return res.status(400).send(err)
  }
};

this.updateParticularField = async(req, res) => {
  try {
    let listingId = req.params.id
    let data = req.body
    if (data._id)
      delete data._id
    if (data.type === "GROUP") {
      var result = await(GroupSer.updatePromise(listingId, data))
      result = await(GroupSer.findOne({_id: result._id}))
    } else {
      var result = await(SignServ.updatePromise(listingId, data))
      result = await(SignServ.findOne({_id: result._id}))
    }
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
}

this.createGroup = async (req, res) => {
  var user = req.user;
  if (user.userType !== 'networkOwner') {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  let group = req.body.group;
  let locationNames = req.body.locationNames
  group.networkOwnerId = user.networkOwnerId
  group.signType = 'GROUP'
  try {
    var result = await (SignServ.createGroup(group, locationNames, res, req))
    req.session.newListing = null;
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
};

this.updateGroup = async (req, res) => {
  var user = req.user;
  if (user.userType !== 'networkOwner') {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  var { id } = req.params;
  var group = req.body.group;
  // var validateUser = await(SignServ.findOne({_id: group._id}))
  var validateUser = await (GroupSer.find({ _id: group._id }))
  var savedSignIds = {}
  var inCommingSignsIds = {}
  for (let i = 0; i < validateUser[0].childs.length; i++) {
    if (validateUser[0].childs && validateUser[0].childs[i]._id) {
      savedSignIds[validateUser[0].childs[i]._id.toString()] = validateUser[0].childs[i]._id.toString()
    }
  }
  for (let i = 0; i < group.childs.length; i++) {
    if (group.childs && group.childs[i]._id) {
      inCommingSignsIds[group.childs[i]._id.toString()] = group.childs[i]._id.toString()
    }
  }
  var newlyAddedSign = {}
  for (var key in inCommingSignsIds) {
    if (!savedSignIds[key]) {
      newlyAddedSign[key] = inCommingSignsIds[key]
    }
  }
  validateUser = validateUser[0]
  if (validateUser.networkOwnerId.toString() !== user.networkOwnerId.toString()) {
    return res.status(401).send("Access denied.");
  }
  var locationNames = req.body.locationNames;
  var childsArray = []
  if (!group.active && group.childs.length > 0) {
    return res.status(400).send("Can not add signs to the deactivated group.");
  }
  // if (group.isHidden && group.childs.length > 0) {
  //   return res.status(400).send("Can not add signs to the hidden group.");
  // }
  if (group.groupType === "PRIVATE") {
    for (var i = 0; i < group.childs.length; i++) {
      if (user.networkOwnerId.toString() !== group.childs[i].networkOwnerId.toString()) {
        return res.status(401).send("Access denied.");
      }
    }
  }
  for (var i = group.childs.length - 1; i >= 0; i--) {
    childsArray.push(group.childs[i]._id)
  }
  var query = { _id: { "$in": childsArray } }
  try {
    var check_deactive = '';
    var checkChildsSign = await (SignServ.find(query))
    for (var k = checkChildsSign.length - 1; k >= 0; k--) {
      if (!checkChildsSign[k].active && check_deactive.length === 0) {
        check_deactive = checkChildsSign[k].name
      } else if (!checkChildsSign[k].active) {
        check_deactive = check_deactive + ", " + checkChildsSign[k].name
      }
    }
    if (check_deactive.length > 0) {
      if (check_deactive.indexOf(',') > -1) {
        return res.status(400).send('Following signs ' + check_deactive + " were deactived. Please select another sign.")
      } else {
        return res.status(400).send('Sign ' + check_deactive + " is deactived. Please select another sign.")
      }
    }
  } catch (err) {
    return res.status(400).send(err)
  }
  try {
    var result = await (SignServ.updateGroupWithLocation(id, group, locationNames, res))
    // if (group.forceFullyUpdatePlaylist) {
    for (var key in newlyAddedSign) {
      var newlyAddedSignData = await (SignServ.findOne({ _id: newlyAddedSign[key] }))
      if ((newlyAddedSignData.forceFullyUpdatePlaylist) || (newlyAddedSignData.networkOwnerId.toString() === group.networkOwnerId.toString())) {
        await (SignServ.insertDataIntoBookingAndPayment(newlyAddedSign[key], group))
      }
    }
    // }
    res.send(result)
  } catch (err) {
    res.status(400).send(err)
  }
};

this.getRunningCampaigns = async (req, res) => {
  var params = JSON.parse(req.params.query)
  try {
    var response = await (CampaignServ.findRunningCampaigns(params))
    return res.send(response)
  } catch (err) {
    return res.status(400).send(err);
  };
};

this.getSignAvailableSlots = async (req, res) => {
  try {
    let user = req.user;
    let query = JSON.parse(req.params.query)
    let result = await (SignServ.findOneById(query._id, user))
    let bookings = await (BookingServ.listBookings(query._id, query.from, query.to))
    _availableSlots = result._slots.length - bookings.length
    result.availableSlots = _availableSlots
    return res.send(result);
  } catch (err) {
    return res.status(400).send(err);
  }
};

this.publish = async(req, res) => {
  try {
    var user = req.user;
    if(user.userType !== 'networkOwner')
      return res.status(401).send(user.name + " don't have permission to access");
    var { id } = req.params;
    let result = await(SignServ.publish(id))
    return res.send(result)
  } catch (err) {
    return res.status(400).send(err)
  }
}

this.getAvailableSlotsForEachSign = async (req, res) => {
  let details = req.body
  let from = details.from
  let to = details.to
  let query = { _id: { $in: details.childIds } }
  let availableSlots = {}
  let booking;
  let avilableSlotsArray = []
  try {
    let result = await (SignServ.findsignsById(query))
    for (var i = 0; i < result.length; i++) {
      booking = await (BookingServ.listBookings(result[i]._id, from, to))
      _availableSlots = result[i]._slots.length - booking.length
      availableSlots = {
        _id: result[i]._id,
        availableSlots: _availableSlots,
        totalSlots: result[i]._slots.length,
        name: result[i].name
      }
      avilableSlotsArray.push(availableSlots)
    }
    return res.send(avilableSlotsArray);
  }
  catch (err) {
    return res.status(400).send(err);
  }
};

var claim = async(req, res)=> {
  var user = req.session.user
  var email = user.email
  // if(user.userType !== 'networkOwner') {
  //   return res.status(401).send(user.name + " don't have permission to access");
  // }
  var claimId = req.body.data.claimId;
  if (!claimId) {
    return res.status(400).send('Please enter the valid claim id.')
  }
  claimId = claimId.toUpperCase()
  var signName = req.body.data.name;
  if (!signName) {
    return res.status(400).send('Please enter the name for your sign.')
  }
  try {
    var sign = await(SignServ.findOne({claimId: claimId}))
    if(!sign || sign === null) {
      return res.status(400).send('Invalid claimId')
    }
    let _sign = await(SignServ.singleDeviceClaim(user, sign, signName, claimId, email))
    res.send(_sign)
  } catch(err) {
    return res.status(400).send(err)
  }
};

var unclaimDevice = async(req, res) => {
  try {
    var user = req.session.user
    var { id } = req.params
    let deviceStatus = 'ONLINE';
    let message = {};
    var device = await(SignServ.findOne({_id: id}))
    message.device = device
    if (user.userType !== "admin" && user.userType !== "networkOwner" || user.userType !== "admin" && user.networkOwnerId && user.networkOwnerId.toString() !== device.networkOwnerId.toString()) {
      return res.status(401).send('Access denied.')
    }
    var sign = await(SignServ.findOne({_id: id}));
    try {
      await(SignServ.unclaimDevice(user, id))
    } catch (e) {
      deviceStatus = 'OFFLINE';
    }
    var resultGroup = await(GroupSer.getSignContainGroup(id))
    for (var i = 0; i < resultGroup.length ; i++) {
      var group = resultGroup[i]
      for (var j = 0; j < group.childs.length; j++) {
        if (group.childs[j]._id.toString() === id.toString()) {
          group.childs.splice(j, 1)
        }
        if(group.childsDetails[j].toString() ===id.toString()) {
          group.childsDetails.splice(j, 1)
        }
      }
      resultremovedGroup = await(SignServ.removeListingFromGroup(group._id, group, id.toString()))
    }
    // await(SignServ.publish(sign._id.toString()))
    let queue = [{
      signId: sign._id.toString(),
      time: new Date()
    }]
    QueueService.insetMany(queue);
    var query = {
      signType: 'GROUP',
      childs: { "$in" : [sign._id]},
    }
    var group = await(SignServ.find(query))
    for (let groupLength = 0; groupLength < group.length; groupLength++) {
      var child = group[groupLength].childs
      for (var childLength = child.length-1; childLength >= 0 ; childLength--) {
        if (child[childLength]._id.toString() === sign._id.toString()){
          group[groupLength].childs.splice(childLength,1)
          group[groupLength].childsDetails.splice(childLength,1)
          var _group = JSON.stringify(group[groupLength])
          groupCreatedAt = JSON.parse(_group)
          delete groupCreatedAt.createdAt;
          await(Sign.update({_id:groupCreatedAt._id}, {'$set': groupCreatedAt}))
        }
      }
    }
    message._id = sign._id;
    message.deviceStatus = deviceStatus;
    if(deviceStatus === 'ONLINE') {
      message.message = `Device ${device.name} unclaimed Successfully`;
    } else {
      message.message = `Device ${device.mac} offline, once the device gets online it will be unclaimed.`;
    }
    let _sign = await(SignServ.findOne({_id: id}));
    message.updatedSign = _sign
    return res.send(_sign)
  } catch(err) {
    return res.status(400).send(err)
  }
}

var importBulkListings = async(req, res)=> {
  var user = req.user;
  if(user.userType !== 'networkOwner') {
    return res.status(401).send(user.name + " don't have permission to access");
  }
  console.log("******************123***")
  return SignServ .importBulkListings(req, res);
};
