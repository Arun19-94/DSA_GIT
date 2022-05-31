const Promise = require('bluebird');

const Config = require('../../../config/config.js');


var Group = require('./group.schema');

var mongoose = require('mongoose');

var async = require('asyncawait/async');

var await = require('asyncawait/await');

var timeoutCallback = require('timeout-callback');


this.findSortWithUpdate = async(function (query) {
  try {
    var groups = await(Group.find(query).sort('-updatedAt').lean())
    return groups
  } catch (err) {
    return err
  }
})

// this.getSignContainGroup = async(function (signId) {
//   try {
//     var id = mongoose.Types.ObjectId(signId)
//     var query = {
//       signType: 'GROUP',
//       "childs._id":
//       {
//         "$in": [
//           id
//         ]
//       }
//     }
//     var groups = await(Group.find(query))
//     return groups
//   } catch (err) {
//     return err
//   }
// })

this.find = async(function (query) {
  try {
    var result = await(Group.find(query).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').populate('childsDetails').lean())
    return result
  } catch (err) {
    return err
  }
});

this.findOneById = (id, user) => {
  var query = {
    _id: id,
    networkOwnerId: user.networkOwnerId
  };
  return Group
    .findOne(query).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').populate('childsDetails');
};

this.findWithChilds = async (query) => {
  try {
    var result = await (Group.find(query).lean())
    return result
  } catch (err) {
    return err
  }
};

this.findWithSortUpdatedAtDesc = async (query) => {
  try {
    var result = await (Group.find(query).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').sort({ updatedAt: -1 }))
    return result
  } catch (err) {
    return err
  }
};

this.findOne = async (query = {}) => {
  return await (Group.findOne(query).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').populate("childsDetails"))
};

this.getSignContainGroup = async (signId) => {
  try {
    var id = mongoose.Types.ObjectId(signId)
    var query = {
      signType: 'GROUP',
      "childs._id": { "$in": [id] }
    }
    var groups = await(Group.find(query).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location'))
    return groups
  } catch (err) {
    return err
  }
}

this.updateGroupForSignUpdate = async (signId, sign) => {
  try {
    var _groups = JSON.stringify(await (this.getSignContainGroup(signId)))
    var groups = JSON.parse(_groups)
    for (let i = 0; i < groups.length; i++) {
      let childs = groups[i].childs;
      for (let j = 0; j < childs.length; j++) {
        let child = childs[j]
        if (child._id.toString() === signId.toString()) {
          child.name = sign.name
          child.totalAvgViewersCount = sign.totalAvgViewersCount;
          child.networkOwnerId = sign.networkOwnerId;
          child.pricePerSlot = (sign.pricePerSlot * 1);
          child.availableSlots = (sign.availableSlots * 1);
          if (sign.profileMedia) {
            if (sign.profileMedia._id) {
              child.profileMedia = sign.profileMedia._id;
            } else {
              child.profileMedia = sign.profileMedia;
            }
          }
          if (sign.holdTimeUnit === "min") {
            child.holdTime = sign.holdTime * 60
          } else {
            child.holdTime = sign.holdTime
          }
          child.slotPeriod = sign.slotPeriod
        }
      }
      await (this.updateGroup(groups[i]._id, groups[i]))
    }
    return
  } catch (err) {
    return err
  }
}

this.addOrUpdateGroupWithSigns = async (addGroup, sign) => {
  try {
    let groups = JSON.parse(JSON.stringify(await(Group.find({_id:{$in: addGroup}},{childs:1, childsDetails:1,profileMedia:1,name:1}).lean())))
    let signId = sign._id
    for (let i = 0; i < groups.length; i++) {
      let childs = groups[i].childs;
      let isChild = false
      for (let j = 0; j < childs.length; j++) {
        let child = childs[j]
        if (child._id.toString() === signId.toString()) {
          isChild = true
          child._id = mongoose.Types.ObjectId(child._id)
          child.name = sign.name
          child.totalAvgViewersCount = sign.totalAvgViewersCount;
          child.networkOwnerId = sign.networkOwnerId;
          child.pricePerSlot = (sign.pricePerSlot * 1);
          child.availableSlots = (sign.availableSlots * 1);
          if (sign.profileMedia) {
            if (sign.profileMedia._id) {
              child.profileMedia = sign.profileMedia._id;
            } else {
              child.profileMedia = sign.profileMedia;
            }
          }
          if (sign.holdTimeUnit === "min") {
            child.holdTime = sign.holdTime * 60
          } else {
            child.holdTime = sign.holdTime
          }
          child.slotPeriod = sign.slotPeriod
        }
      }
      if ( !isChild) {
        let addChild = {}
        addChild.name = sign.name
        addChild._id =  mongoose.Types.ObjectId(sign._id)
        addChild.totalAvgViewersCount = sign.totalAvgViewersCount;
        addChild.networkOwnerId = sign.networkOwnerId;
        addChild.pricePerSlot = (sign.pricePerSlot * 1);
        addChild.availableSlots = (sign.availableSlots * 1);
        if (sign.profileMedia) {
          if (sign.profileMedia._id) {
            addChild.profileMedia = sign.profileMedia._id;
          } else {
            addChild.profileMedia = sign.profileMedia;
          }
        }
        if (sign.holdTimeUnit === "min") {
          addChild.holdTime = sign.holdTime * 60
        } else {
          addChild.holdTime = sign.holdTime
        }
        addChild.slotPeriod = sign.slotPeriod
        groups[i].childs.push(addChild)
        groups[i].childsDetails.push(mongoose.Types.ObjectId(sign._id))
      }
      await (Group.update({_id: groups[i]._id},{ '$set': groups[i]}))
    }
    return groups
  } catch(err) {
    return err
  }
}

this.updatePromise = async (_id, group) => {
  try {
    let result = await (Group.findOneAndUpdate({ _id: _id }, { '$set': group }, { new: true }))
    if (result.childs && result.childs.length > 0) {
      let queue = []
      for (let i = 0; i < result.childs.length; i++) {
        let q = {
          signId: result.childs[i]._id.toString(),
          time: new Date()
        }
        queue.push(q)
      }
      QueueService.insetMany(queue);
    }
    return result
  } catch (err) {
    return err
  }
}

this.updateGroup = async (_id, group) => {
  var _grooup = JSON.stringify(group)
  var group = JSON.parse(_grooup)
  if (group.updatedAt)
    delete group.updatedAt
  if (group.createdAt) {
    delete group.createdAt
    delete group.serialNumber
  }
  group = this.setchilds(group)
  if (group._location && group._location.length > 0) {
    group.locationString = ''
    for (let location = 0; location < group._location.length; location++) {
      group.locationString = group.locationString + group._location[location].name + "^%"
    }
  } else {
    group.locationString = ''
  }
  try {
    var result = await (Group.findOneAndUpdate({ _id: _id }, { '$set': group }, { new: true }).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location'))
    return result
  } catch (err) {
    console.log(err)
    return err
  }
}

this.setchilds = group => {
  try {
    var childs = [];
    var childsDetails = [];
    if (group.childs.length > 0) {
      childs = group.childs
      group.childs = [];
      for (let childLength = 0; childLength < childs.length; childLength++) {
        let _child = {}
        _child._id = mongoose.Types.ObjectId(childs[childLength]._id)
        childsDetails.push(childs[childLength]._id.toString())
        _child.name = childs[childLength].name
        if (childs[childLength].profileMedia) {
          if (childs[childLength].profileMedia._id) {
            _child.profileMedia = childs[childLength].profileMedia._id
          } else {
            _child.profileMedia = childs[childLength].profileMedia
          }
        }
        _child.totalAvgViewersCount = (childs[childLength].totalAvgViewersCount * 1);
        _child.networkOwnerId = childs[childLength].networkOwnerId;
        _child.availableSlots = (childs[childLength].availableSlots * 1);
        if (childs[childLength].holdTimeUnit === 'min') {
          _child.holdTime = childs[childLength].holdTime * 60;
        } else {
          _child.holdTime = (childs[childLength].holdTime * 1);
        }
        _child.pricePerSlot = (childs[childLength].pricePerSlot * 1)
        _child.slotPeriod = childs[childLength].slotPeriod
        group.childs.push(_child)
        group.childsDetails = childsDetails
      }
    }
    return group
  } catch (err) {
    return err
  }
}

this.listAllGroups = async (query) => {
  try {
    var groups = await (Group.find(query).sort('-updatedAt').lean())
    return groups
  } catch (err) {
    return err
  }
}

// this.getSignContainGroup = async(signId) => {
//   try{
//     var id = mongoose.Types.ObjectId(signId)
//     var query = { signType: 'GROUP',
//     "childs._id": { "$in" : [id]}}
//     var groups =  await(Group.find(query).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location'))
//     return groups
//   } catch(err){
//     return err
//   }
// }

// this.updateGroup = async (_id, group) => {
//   var _grooup = JSON.stringify(group)
//   var group = JSON.parse(_grooup)
//   if (group.createdAt) {
//     delete group.createdAt
//   }
//   if (group.updatedAt) {
//     delete group.updatedAt
//   }
//   if (group.createdAt) {
//     delete group.serialNumber
//   }
//   group = self.setchilds(group)
//   if (group._location && group._location.length > 0) {
//     group.locationString = ''
//     for (let location = 0; location < group._location.length; location++) {
//       group.locationString = group.locationString + group._location[location].name + "^%"
//     }
//   } else {
//     group.locationString = ''
//   }
//   try {
//     var result = await (Group.findOneAndUpdate({ _id: _id }, { '$set': group }, { new: true }).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location'))
//     return result
//   } catch (err) {
//     return err
//   }

// }

// this.setchilds = function (group) {
//   try {
//     var childs = [];
//     var childsDetails = [];
//     if (group.childs.length > 0) {
//       childs = group.childs
//       group.childs = [];
//       for (let childLength = 0; childLength < childs.length; childLength++) {
//         let _child = {}
//         _child._id = mongoose.Types.ObjectId(childs[childLength]._id)
//         childsDetails.push(childs[childLength]._id.toString())
//         _child.name = childs[childLength].name
//         if (childs[childLength].profileMedia) {
//           if (childs[childLength].profileMedia._id) {
//             _child.profileMedia = childs[childLength].profileMedia._id
//           } else {
//             _child.profileMedia = childs[childLength].profileMedia
//           }
//         }
//         _child.totalAvgViewersCount = (childs[childLength].totalAvgViewersCount * 1);
//         _child.networkOwnerId = childs[childLength].networkOwnerId;
//         _child.availableSlots = (childs[childLength].availableSlots * 1);
//         if (childs[childLength].holdTimeUnit === 'min') {
//           _child.holdTime = childs[childLength].holdTime * 60;
//         } else {
//           _child.holdTime = (childs[childLength].holdTime * 1);
//         }
//         _child.pricePerSlot = (childs[childLength].pricePerSlot * 1)
//         _child.slotPeriod = childs[childLength].slotPeriod
//         group.childs.push(_child)
//         group.childsDetails = childsDetails
//       }
//     }
//     return group
//   } catch (err) {
//     return err
//   }

// }

this.updateGroupStatusChange = async(function (_id, status) {
  var id = mongoose.Types.ObjectId(_id)
  try {
    if (!status) {
      var result = await(Group.findOneAndUpdate({ _id: id }, { '$set': { active: status, childs: [], childsDetails: [] } }, { new: true }))
    } else {
      var result = await(Group.findOneAndUpdate({ _id: id }, { '$set': { active: status } }, { new: true }))
    }
    return result
  } catch (e) {
    return e
  }
})

this.findOne = async (query) => {
  return await (Group.findOne(query).populate('ownMedia').populate('unsoldMedia').populate('profileMedia').populate('_location').populate("childsDetails"))
};

this.deleteGroup = async (query) => {
  try {
    var result = await (Group.findOneAndUpdate(query, { '$set': { status: "DELETED", childs: [], ownMedia: [], unsoldMedia: [], profileMedia: null } }, { new: true }))
    return result
  } catch (err) {
    return err
  }
}

this.updateGroupHiddenStatusChange = async(function (_id, hiddenStatus) {
  var id = mongoose.Types.ObjectId(_id)
  try {
    var result = await(Group.findOneAndUpdate({ _id: id }, { '$set': { isHidden: hiddenStatus } }, { new: true }))
    return result
  } catch (err) {
    return err
  }
})

this.createGroup = async group => {
  try {
    var _group = self.setchilds(group)
    group = _group
    if (group._location && group._location.length > 0) {
      group.locationString = ''
      for (let location = 0; location < group._location.length; location++) {
        group.locationString = group.locationString + group._location[location].name + "^%"
      }
    }
    var result = await (Group.createAsync(group))
    return result
  } catch (err) {
    return err
  }
}

var self = this