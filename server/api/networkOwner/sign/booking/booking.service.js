var cron      = require('node-cron')

var Booking 	= require('./booking.schema');

// var Campaign  = require('../../../advertisers/campaign/campaign.schema');

var await          = require('asyncawait/await');

var async          = require('asyncawait/async');
/*
* Clear Booking history until payment done within 5 min
*/
this.init = function() {
  // * * * * * - start every 1 min
  cron.schedule('* * * * *', function() {
    var d = new Date()
    d.setMinutes(d.getMinutes() -5)

    var query = {
      'createdAt': {$lte: d}
    }
    Booking.find(query).populate('campaign')
    .then(function(bookings) {
      for(var i = 0; i < bookings.length; i++) {
        var booking = bookings[i]
        if (booking.campaign) {
          if(!booking.campaign._paymentStatus || booking.campaign._paymentStatus !== 'approved') {
            var _id = booking.campaign._id
            Campaign.findOneAndUpdate({_id}, {'$set': {signs: [], _paymentStatus: 'error'}}, {new: true}, function(err, result) {
              Booking.remove({campaign: booking.campaign._id}, function(err) {
              });
            });
          }
        }
      }
    }).catch(function(err) {
      console.log(err)
    });
  });
}

// this.init();

this.create = function(booking) {
  booking = new Booking(booking);
  return booking.save();
};

this.find = function(query, projection) {
  if (query == null) { query = {}; }
  if (projection == null) { projection = {}; }
  return Booking
    .find(query, projection);
};

this.findWithCamapignName = function(query, projection) {
  if (query == null) { query = {}; }
  if (projection == null) { projection = {}; }
  return Booking
    .find(query, projection).populate('campaign', { name: 1, budget: 1});
};

this.findBookingArray = async(function(query, projection) {
  try{
    var bookingArray = await(Booking.aggregate(
     [
       {
         "$match":query
        },
       {
         $group : {
           _id : "$sign",
           count: { $sum: 1 }
         }
       }
     ])
   )
   return bookingArray

  } catch (err) {
    console.log(err)
  }
});

this.findBookingArrayWithSlot = async(function(query, projection) {
  try{
    var bookingArray = await(Booking.aggregate(
     [
       {
         "$match":query
        },
       {
         $group : {
           _id : "$sign",
           "slots":{$push:"$slotCode"},
           count: { $sum: 1 }
         }
       }
     ])
   )
   return bookingArray

  } catch (err) {
    console.log(err)
  }
});

this.bookingBulkInsert = async(function(bookingArray) {
  try{
    await(Booking.insertMany(bookingArray))

  } catch (err) {
    console.log(err)
  }
});

this.listBookings = function(signIds, from, to) {
  // var from = new Date(from)
  // from.setHours(0);
  // from.setMinutes(0);
  // from.setSeconds(0);
  // from.setMilliseconds(0);
  // var to = new Date(to)
  // to.setHours(23);
  // to.setMinutes(59);
  // to.setSeconds(59);
  // to.setMilliseconds(0);
  var query = {
    '$and': [
      {sign : {"$in": signIds}},
      {
        '$and': [
          {
            '$or': [
              {
                "from": {
                  "$lte": from
                }
              },
              {
                "to": {
                  "$gte": to
                }
              },
              {
                "from": {
                  "$gte": from
                }
              },
              {
                "to": {
                  "$lte": to
                }
              }
            ] 
          }, {
            '$and': [
              {
                "from": {
                  "$lte": to
                }
              },
              {
                "to": {
                  "$gte": from
                }
              }
            ]
          }
        ]
      }
    ]
  }
  return Booking
    .find(query);
};

this.listBookingsByQuery = function(query) {
  return Booking
    .find(query).populate('sign').populate('paymentStatus').populate({path: 'campaign', populate: {path: 'media'}, populate: {path: 'campaignStatus.media'}}).sort('createdAt');
};

this.delete = function(query) {
  var promise = new Promise(function(resolve, reject) {
    Booking.remove(query, function(err) {
      if (err) {
        return reject(err);
      } else {
        return resolve();
      }
    });
  });
  return promise;
};

this.insertDataIntoBookingAndPayment = async(function(query) {
  try {
    var groupPayment = await(Booking.aggregate([
      {
        $match:query
      },{
        $group:{
          _id:"$campaign",
          "paymentType":{$push:"$paymentType"},
          "slotCode":{$push:"$slotCode"},
          "from":{$push:"$from"},
          "to":{$push:"$to"},
          "signId":{$push:"$sign"}
        }
      }
    ]))
    return groupPayment
  } catch (e) {
    console.log(e)
  }
  return groupPayment
})