const Promise = require('bluebird');

const cron = require('node-cron')

const Queue = require('./publish.queue.schema');

const SignService = require('../sign.service');

let isRunning = false

this.init = function() {
  // 0 0 * * * - start at 0h 0m
  // * * * * * - start every 1 min - testing purpose only
  var _this = this
  cron.schedule('* * * * *', function() {
    console.log(`${new Date()} - publish cron started running...`);
    _this.run();
  });
}

this.run = async () => {
  let queue = await(this.queue({}))
  let signIdMap = {}
  if(!isRunning && queue && queue.length > 0) {
    console.log('queue length: ' + queue.length)
    for (let i = 0; i < queue.length; i++) {
      isRunning = true
      let signId = queue[i].signId
      try {
        if (!signIdMap[signId.toString()]) {
          await(SignService.publish(signId))
          signIdMap[signId.toString()] = signId.toString()
        }
      } catch (err) {
        isRunning = false    
      }
      this.delete(signId);
    }
    isRunning = false
  }
}

this.init();

this.queue = (query) => {
  return Queue.find(query).sort({time: 1});
};

this.findOne = (query) => {
  return Queue.findOne(query);
};

this.insetMany = (queueArray) => {
  return Queue.insertMany(queueArray);
};

this.delete = (signId) => {
  return new Promise((resolve, reject) => {
    let query = {
      signId: { 
        $in: [ signId ]
      }
    }
    Queue.remove(query, (err, queue) => {
      if(err) {
        return reject(err)
      }
      resolve(queue)  
    });
  });
};