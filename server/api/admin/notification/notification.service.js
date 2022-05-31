var MailServ = require('../../../components/mail/mail.js')

var UserServ = require('../../user/user.service')

var PaymentService = require('../../advertiser/payment/payment.service')

var Config = require('../../../config/config.js')

var notificationMap = {}

this.init = () => {
  var paymentReceived = {
    key: "PAYMENT_RECEIVED",
    subject: "Payment received; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a new Sale! <br><br> Payment ID <b>{{sale_id}}</b> for ${{amount}} USD. <br><br> You can view the related details on your Payment page in your Digital Smart Ads Marketplace account {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[paymentReceived.key] = paymentReceived
  var paymentReceivedCoupen = {
    key: "PAYMENT_RECEIVED_COUPEN",
    subject: "Payment received; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a new Sale! <br><br> Payment ID <b>{{sale_id}}</b> - you recived ${{amount}} USD. <br><br> - Original Cost: ${{orginalCost}}. <br><br> - Discount Applied: ${{discountAmount}} using Coupon Name: {{coupenName}} <br><br>You can view the related details on your Payment page in your Digital Smart Ads Marketplace account {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[paymentReceivedCoupen.key] = paymentReceivedCoupen
  var paymentFailed = {
    key: "PAYMENT_FAILED",
    subject: "Payment failed; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> We were unable to process your payment. <br><br> Please confirm information was entered correctly and contact your bank or credit card company as needed to resolve the issue. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[paymentFailed.key] = paymentFailed
  var approvalNotification = {
    key: "APPROVAL_NOTIFICATION",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have an approved notification regarding your Digital Smart Ads Marketplace account. <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[approvalNotification.key] = approvalNotification
  var rejectionNotification = {
    key: "REJECTION_NOTIFICATION",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a rejected notification regarding your Digital Smart Ads Marketplace account. <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[rejectionNotification.key] = rejectionNotification
  var unApprovalNotification = {
    key: "UNAPPROVAL_NOTIFICATION",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have an unapproved notification regarding your Digital Smart Ads Marketplace account. <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[unApprovalNotification.key] = unApprovalNotification
  var resubmittedNotification = {
    key: "RESUBMITTED_NOTIFICATION",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a resubmitted notification regarding your Digital Smart Ads Marketplace account. <br><br> Please approve or reject following media <br><br> &emsp; {{media_1}} <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[resubmittedNotification.key] = resubmittedNotification
  var wantToApproveNotification = {
    key: "WANT_TO_APPROVE_NOTIFICATION",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a notification regarding your Digital Smart Ads Marketplace account. <br><br> Please approve or reject following media <br><br> &emsp; {{media_1}} {{media_2}} <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[wantToApproveNotification.key] = wantToApproveNotification
  var preApprovedNotification = {
    key: "PRE_APPROVED_NOTIFICATIONS",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a notification regarding your Digital Smart Ads Marketplace account. <br><br> Following media are pre-approved for the account registered id {{id}} <br><br> &emsp; {{media_1}} {{media_2}} <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[preApprovedNotification.key] = preApprovedNotification
  var replaceMediaPreApprovedNotification = {
    key: "REPLACE_MEDIA_PRE_APPROVED_NOTIFICATIONS",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a notification regarding your Digital Smart Ads Marketplace account. <br><br> Following replaced media are pre-approved for the account registered id {{id}} <table><tr><td>&emsp; {{media_1}} {{media_2}} </td></tr><tr><td>&emsp; {{media_3}} {{media_4}} </td></tr></table> <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[replaceMediaPreApprovedNotification.key] = replaceMediaPreApprovedNotification
  var replaceMediaWantsApprovalNotification = {
    key: "WANT_TO_APPROVE_NOTIFICATION_FOR_REPLACE_MEDIA",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a notification regarding your Digital Smart Ads Marketplace account. <br><br> Please approve or reject following media <table><tr><td>&emsp; {{media_1}} {{media_2}} </td></tr><tr><td>&emsp; {{media_3}} {{media_4}} </td></tr></table> <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[replaceMediaWantsApprovalNotification.key] = replaceMediaWantsApprovalNotification
  var autoApprovedNotification = {
    key: "AUTO_APPROVED_NOTIFICATIONS",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a notification regarding your Digital Smart Ads Marketplace account. <br><br> You have added the following Media to your listing(s). <br><br> &emsp; {{media_1}} {{media_2}} <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[autoApprovedNotification.key] = autoApprovedNotification

  var childRemovableFromGroupNotification = {
    key: "CHILD_REMOVED_FROM_GROUP_NOTIFICATION",
    subject: "Removable notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a notification regarding your Digital Smart Ads Marketplace account. <br><br> Your signs listed below which is part of {{group_name}} removed from that group, as the group is deactivated. <br> {{child_names}} <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[childRemovableFromGroupNotification.key] = childRemovableFromGroupNotification
  var canceledNotification = {
    key: "CANCELED",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a cancel notification regarding your Digital Smart Ads Marketplace account. <br><br> The campaign {{campaignName}} has been canceled .Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[canceledNotification.key] = canceledNotification
  var canceledMediaNotification = {
    key: "CANCELED_MEDIA",
    subject: "New notification; Digital Smart Ads Marketplace",
    content: "Hello {{name}}, <br><br> You have a cancel notification regarding your Digital Smart Ads Marketplace account. <br><br> The campaign {{campaignName}} having following medias has been canceled. <br><br> &emsp; {{media_1}} {{media_2}} <br><br> Please log in to your account for details {{URL}}. <br><br> If you have any questions, please email support@digitalsmartads.com. <br><br> We’re here to help! <br><br> Sincerely, <br><br> Digital Smart Ads Support Team"
  }
  notificationMap[canceledMediaNotification.key] = canceledMediaNotification
}

this.getNotification = key => {
  var key = key.toString()
  return notificationMap[key]
}

this.sendNotificationMailToNetworkOwner = async (notifications) => {
  var notification
  var notificationMail
  var notificationFlag = 0;
  if (notifications.length > 0) {
    var networkOwnerJson = {}
    var networkOwnerArray = []
    for (let i = 0; i < notifications.length; i++) {
      if (!networkOwnerJson[notifications[i].networkOwner]) {
        networkOwnerJson[notifications[i].networkOwner] = notifications[i].networkOwner
        networkOwnerArray.push(notifications[i])
      }
    }
    for (let j = 0; j < networkOwnerArray.length; j++) {
      notificationFlag = 0;
      let networkOwnerId = networkOwnerArray[j].networkOwner.toString()
      let notification = networkOwnerArray[j]
      let advertiserId = notifications[0].advertiser.toString()
      var query = {
        networkOwnerId: networkOwnerId
      }
      var user = await (UserServ.findOne(query))
      var advertiserUser = await (UserServ.findOne({ advertiserId: advertiserId }))
      if (user._id.toString() === advertiserUser._id.toString()) {
        notificationFlag = 1
      } else {
        let query = {
          user: user._id.toString(),
          status: "TRUSTED"
        }
        let usersList = await(UserServ.getApprovedOrBlockedUsersList(query))
        usersList.map(_user => {
          if (_user.whichUser._id.toString() === advertiserUser._id.toString())
            notificationFlag = 2
        })
        // for (let i = 0; i < user.preApprovedAdvertiser.length; i++) {
        //   if (user.preApprovedAdvertiser[i].toString() === advertiserUser._id.toString()) {
        //     notificationFlag = 2
        //   }
        // }
      }
      // var signs = {}
      // var signName = ''
      // var signCount = 0
      // for (let i = 0; i < notifications.length; i++) {
      //   if(!signs[notifications[i].sign._id] && (notifications[i].sign.networkOwnerId.toString() === networkOwnerArray[j].toString()) ) {
      //     signCount = signCount + 1
      //     if ( i == 0 ) {
      //       signName = signName 
      //     } else {
      //       signName = signName + ", " + notifications[i].sign.name
      //     }
      //   }
      // }
      if (notificationFlag > 0) {
        if (notificationFlag === 2) {
          if (notification.type === "REPLACE_MEDIA_PREAPPROVED") {
            notificationMail = await (this.getNotification('REPLACE_MEDIA_PRE_APPROVED_NOTIFICATIONS'))
          } else {
            notificationMail = await (this.getNotification('PRE_APPROVED_NOTIFICATIONS'))
          }
          notificationMail.content = notificationMail.content.replace("{{id}}", advertiserUser.userIdentificationNumber);
          var url = `${Config.baseURL}/networkOwner/notification/preapproved/`
        } else if (notificationFlag === 1) {
          notificationMail = await (this.getNotification('AUTO_APPROVED_NOTIFICATIONS'))
          notificationMail.content = notificationMail.content.replace("{{id}}", advertiserUser.userIdentificationNumber);
          var url = `${Config.baseURL}/networkOwner/notification/approved/`
          // if (signCount > 1) {
          //   notificationMail.content = notificationMail.content.replace("{{listing(s)}}", "listing" + signName);
          // } else {
          //   notificationMail.content = notificationMail.content.replace("{{listing(s)}}", "listing" + signName);
          // }
        }
      } else {
        if (notification.type === "REPLACE_MEDIA") {
          notificationMail = await (this.getNotification('WANT_TO_APPROVE_NOTIFICATION_FOR_REPLACE_MEDIA'))
          var url = `${Config.baseURL}/networkOwner/notification/`
        } else {
          notificationMail = await (this.getNotification('WANT_TO_APPROVE_NOTIFICATION'))
          var url = `${Config.baseURL}/networkOwner/notification/pending/`
        }
      }
      if (notification.type === "REPLACE_MEDIA_PREAPPROVED") {
        notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
        if (notifications[0] && notifications[0].oldMedia) {
          notificationMail.content = notificationMail.content.replace("{{URL}}", url);
          var oldMediaId = notifications[0].oldMedia.toString()
          let oldMediaUrl = `${Config.baseURL}/api/advertisers/media/${oldMediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{media_1}}", `<img alt="Digital Smart Ads" src="${oldMediaUrl}" style="position: relative; width: 95%; object-fit: contain; height: 100px; background: #ecf0f5; margin-right: 6px;"/></td><td><span>replaced with</span></td><td><br>`);
          var mediaId = notifications[0].media.toString()
          let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{media_2}}", `<img alt="Digital Smart Ads" src="${mediaUrl}" style="position: relative; width: 95%; object-fit: contain; height: 100px; background: #ecf0f5; margin-left: 6px;"/>`);
        }
        if (notifications[1] && notifications[1].oldMedia) {
          notificationMail.content = notificationMail.content.replace("{{URL}}", url);
          var oldMediaId = notifications[1].oldMedia.toString()
          let oldMediaUrl = `${Config.baseURL}/api/advertisers/media/${oldMediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{media_3}}", `</tr><tr><td>&emsp; <img alt="Digital Smart Ads" src="${oldMediaUrl}" style="position: relative; width: 95%; object-fit: contain; height: 100px; background: #ecf0f5; margin-right: 6px;"/></td><td><span> replaced with</span></td><td>&emsp;`);
          var mediaId = notifications[1].media.toString()
          let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{media_4}}", `<img alt="Digital Smart Ads" src="${mediaUrl}" style="position: relative; width: 95%; object-fit: contain; height: 100px; background: #ecf0f5; left: -10px;"/>`);
        } else {
          notificationMail.content = notificationMail.content.replace("{{media_3}}", '')
          notificationMail.content = notificationMail.content.replace("{{media_4}}", '')
        }
      } else if (notification.type === "REPLACE_MEDIA") {
        notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
        if (notifications[0] && notifications[0].oldMedia) {
          notificationMail.content = notificationMail.content.replace("{{URL}}", url);
          var oldMediaId = notifications[0].oldMedia.toString()
          let oldMediaUrl = `${Config.baseURL}/api/advertisers/media/${oldMediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{media_1}}", `<img alt="Digital Smart Ads" src="${oldMediaUrl}" style="position: relative; width: 95%; object-fit: contain; height: 100px; background: #ecf0f5; margin-right: 6px;"/></td><td><span>replaced with</span></td><td><br>`);
          var mediaId = notifications[0].media.toString()
          let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{media_2}}", `<img alt="Digital Smart Ads" src="${mediaUrl}" style="position: relative; width: 95%; object-fit: contain; height: 100px; background: #ecf0f5; margin-left: 6px;"/>`);
        }
        if (notifications[1] && notifications[1].oldMedia) {
          notificationMail.content = notificationMail.content.replace("{{URL}}", url);
          var oldMediaId = notifications[1].oldMedia.toString()
          let oldMediaUrl = `${Config.baseURL}/api/advertisers/media/${oldMediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{media_3}}", `</tr><tr><td>&emsp; <img alt="Digital Smart Ads" src="${oldMediaUrl}" style="position: relative; width: 95%; object-fit: contain; height: 100px; background: #ecf0f5; margin-right: 6px;"/></td><td><span> replaced with</span></td><td>&emsp;`);
          var mediaId = notifications[1].media.toString()
          let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{media_4}}", `<img alt="Digital Smart Ads" src="${mediaUrl}" style="position: relative; width: 95%; object-fit: contain; height: 100px; background: #ecf0f5; left: -10px;"/>`);
        } else {
          notificationMail.content = notificationMail.content.replace("{{media_3}}", '')
          notificationMail.content = notificationMail.content.replace("{{media_4}}", '')
        }
      } else {
        notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
        if (notifications[0].media._id)
          var mediaId = notifications[0].media._id.toString()
        else if (notifications[0].media)
          var mediaId = notifications[0].media.toString()
        let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
        notificationMail.content = notificationMail.content.replace("{{URL}}", url);
        notificationMail.content = notificationMail.content.replace("{{media_1}}", `<img alt="Digital Smart Ads" src="${mediaUrl}"/>`);
        if (notifications[1] && (notifications[1].media._id !== notifications[0].media._id)) {
          let mediaId = notifications[1].media._id.toString()
          let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{media_2}}", `&emsp; <img alt="Digital Smart Ads" src="${mediaUrl}"/>`);

        } else {
          notificationMail.content = notificationMail.content.replace("{{media_2}}", '');
        }
      }
      if (notificationMail && user.email) {
        await (MailServ.sendMail('noreply@digitalsmartads.com', [user.email], notificationMail.subject, notificationMail.content))
      }
    }
    return
  } else {
    var notification = notifications
    if (notification.networkOwner) {
      if (notification.networkOwner._id) {
        var query = {
          networkOwnerId: notification.networkOwner._id.toString()
        }
      } else {
        var query = {
          networkOwnerId: notification.networkOwner.toString()
        }
      }
    }
    var user = await (UserServ.findOne(query))
    try {

      if (notification.status === "CANCELED" && notification.notificationType === "approvedOrPendingNotifications") {
        notificationMail = await (this.getNotification('CANCELED_MEDIA'))
        // campaignName
        notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
        notificationMail.content = notificationMail.content.replace("{{campaignName}}", notification.camapignName);
        let url = `${Config.baseURL}/networkOwner/notification/canceled/`
        notificationMail.content = notificationMail.content.replace("{{URL}}", url);
        if (notification.notifications.length > 0) {
          let mediaId = notification.notifications[0].media._id.toString()
          let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{URL}}", url);
          notificationMail.content = notificationMail.content.replace("{{media_1}}", `<img alt="Digital Smart Ads" src="${mediaUrl}"/>`);
          if (notification.notifications[1] && (notification.notifications[1].media._id !== notification.notifications[0].media._id)) {
            let mediaId = notification.notifications[1].media._id.toString()
            let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
            notificationMail.content = notificationMail.content.replace("{{media_2}}", `&emsp; <img alt="Digital Smart Ads" src="${mediaUrl}"/>`);
          } else {
            notificationMail.content = notificationMail.content.replace("{{media_2}}", '');
            notificationMail.content = notificationMail.content.replace("having following medias", 'having following media');
          }
        }
      } else if (notification.status === "CANCELED" && notification.notificationType === "unApproveOrRejectedNotification") {
        notificationMail = await (this.getNotification('CANCELED'))
        notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
        notificationMail.content = notificationMail.content.replace("{{campaignName}}", notification.camapignName);
        let url = `${Config.baseURL}/networkOwner/notification/canceled/`
        notificationMail.content = notificationMail.content.replace("{{URL}}", url);
      } else if (notification.type === 'RESUBMITTED') {
        var advertiserUser = await (UserServ.findOne({ advertiserId: notification.advertiser }))
        if (user._id.toString() === advertiserUser._id.toString()) {
          notificationMail = await (this.getNotification('AUTO_APPROVED_NOTIFICATIONS'))
          notificationMail.content = notificationMail.content.replace("{{id}}", user.userIdentificationNumber);
          var url = `${Config.baseURL}/networkOwner/notification/approved/`
          notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
          let mediaId = notification.media.toString()
          let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
          notificationMail.content = notificationMail.content.replace("{{URL}}", url);
          notificationMail.content = notificationMail.content.replace("{{media_1}}", `<img alt="Digital Smart Ads" src="${mediaUrl}"/>`);
          notificationMail.content = notificationMail.content.replace("{{media_2}}", '');
        } else {
          var notificationFlag = 0
          let query = {
            user: user._id.toString(),
            status: "TRUSTED"
          }
          let usersList = await(UserServ.getApprovedOrBlockedUsersList(query))
          usersList.map(_user => {
            if (_user.whichUser._id.toString() === advertiserUser._id.toString())
              notificationFlag = 1
          })
          // for (let i = 0; i < user.preApprovedAdvertiser.length; i++) {
          //   if (user.preApprovedAdvertiser[i].toString() === advertiserUser._id.toString()) {
          //     notificationFlag = 1
          //   }
          // }
          if (notificationFlag === 1) {
            notificationMail = await (this.getNotification('PRE_APPROVED_NOTIFICATIONS'))
            notificationMail.content = notificationMail.content.replace("{{id}}", advertiserUser.userIdentificationNumber);
            var url = `${Config.baseURL}/networkOwner/notification/preapproved/`
            notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
            let mediaId = notification.media.toString()
            let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
            notificationMail.content = notificationMail.content.replace("{{URL}}", url);
            notificationMail.content = notificationMail.content.replace("{{media_1}}", `<img alt="Digital Smart Ads" src="${mediaUrl}"/>`);
            notificationMail.content = notificationMail.content.replace("{{media_2}}", '');
          } else {
            notificationMail = await (this.getNotification('RESUBMITTED_NOTIFICATION'))
            notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
            let url = `${Config.baseURL}/networkOwner/notification/resubmitted/`
            notificationMail.content = notificationMail.content.replace("{{URL}}", url);
            let mediaId = notification.media.toString()
            let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
            notificationMail.content = notificationMail.content.replace("{{media_1}}", `<img alt="Digital Smart Ads" src="${mediaUrl}"/>`);
          }
        }
      } else if (notification.status === 'SUCCESS' && notification.type === 'PAYMENT') {
        var query = {
          campaign: notification.campaign._id
        }
        var [paymentDetail] = await (PaymentService.find(query))
        if (notification.paid > 0 && !notification.coupen) {
          notificationMail = await (this.getNotification('PAYMENT_RECEIVED'))

          notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
          let url = `${Config.baseURL}/networkOwner/notification/payment/`
          notificationMail.content = notificationMail.content.replace("{{URL}}", url);
          if (paymentDetail && paymentDetail.paymentId) {
            notificationMail.content = notificationMail.content.replace("{{sale_id}}", paymentDetail.paymentId);
          } else {
            notificationMail.content = notificationMail.content.replace("{{sale_id}}", notification.coupen);
          }
          // if (notification.coupen) {
          //   notificationMail.content = notificationMail.content.replace("{{amount}}", notification.paid + ' by coupen');
          // } else {
          //   notificationMail.content = notificationMail.content.replace("{{amount}}", notification.paid);
          // }
          notificationMail.content = notificationMail.content.replace("{{amount}}", notification.paid);
        } else if (notification.coupen) {
          notificationMail = await (this.getNotification('PAYMENT_RECEIVED_COUPEN'))
          notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
          notificationMail.content = notificationMail.content.replace("{{amount}}", notification.paid);
          let url = `${Config.baseURL}/networkOwner/notification/payment/`
          notificationMail.content = notificationMail.content.replace("{{URL}}", url);
          notificationMail.content = notificationMail.content.replace("{{sale_id}}", notification.coupen);
          notificationMail.content = notificationMail.content.replace("{{orginalCost}}", notification.originalAmount);
          if (notification.discountAmount) {
            notificationMail.content = notificationMail.content.replace("{{discountAmount}}", (notification.discountAmount));
          }
          if (notification._coupen) {
            let _coupen = notification._coupen
            notificationMail.content = notificationMail.content.replace("{{coupenName}}", _coupen.name);
          }
        }
      } else if (notification.type === 'CHILDS_REMOVED_FROM_GROUP') {
        notificationMail = await (this.getNotification('CHILD_REMOVED_FROM_GROUP_NOTIFICATION'))
        notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
        notificationMail.content = notificationMail.content.replace("{{group_name}}", notification.sign.name);
        let url = `${Config.baseURL}/networkOwner/notification/`
        notificationMail.content = notificationMail.content.replace("{{URL}}", url);
        var childString = ''
        for (var i = 0; i < notification.childs.length; i++) {
          var n = i + 1
          childString += '&emsp; ' + n + '. ' + (childString === '' ? '' : '') + notification.childs[i].name + '<br>';
        }
        notificationMail.content = notificationMail.content.replace("{{child_names}}", childString);
      }
      // else if (notification.type === 'PREAPPROVED' && notification.status === "APPROVED") {
      //   let networkOwnerId = notification.networkOwner.toString()
      //     var query = {
      //       networkOwnerId: networkOwnerId
      //     }
      //   var user = await(UserServ.findOne(query))
      //   var advQuery = {
      //     advertiserId :notification.advertiser.toString()
      //   }
      //   var _advUser = await(UserServ.findOne(advQuery))
      //   notificationMail = await(this.getNotification('PRE_APPROVED_NOTIFICATIONS'))
      //   notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
      //   let url = `${Config.baseURL}/networkOwner/notification/preapproved`
      //   let mediaId = notification.media._id.toString()
      //   let mediaUrl = `${Config.baseURL}/api/advertisers/media/${mediaId}/thumb/120`
      //   notificationMail.content = notificationMail.content.replace("{{URL}}", url);
      //   notificationMail.content = notificationMail.content.replace("{{media_1}}", `<img alt="Digital Smart Ads" src="${mediaUrl}"`);
      //   notificationMail.content = notificationMail.content.replace("{{id}}", _advUser.userIdentificationNumber);
      // }
    } catch (err) {
      console.log("err")
      console.log(err)
    }
    if (notificationMail && user.email) {
      await (MailServ.sendMail('noreply@digitalsmartads.com', [user.email], notificationMail.subject, notificationMail.content))
    }
    return
  }
}

this.sendNotificationMailToAdvertiser = async (notification) => {
  if (notification.advertiser && notification.advertiser._id) {
    var query = {
      advertiserId: notification.advertiser._id.toString()
    }
  } else if (notification.advertiser) {
    var query = {
      advertiserId: notification.advertiser.toString()
    }
  }
  if (notification.networkOwner && notification.networkOwner._id) {
    var netOwnerQuery = {
      networkOwnerId: notification.networkOwner._id.toString()
    }
  } else if (notification.networkOwner) {
    var netOwnerQuery = {
      networkOwnerId: notification.networkOwner.toString()
    }
  }
  var user = await (UserServ.findOne(query))
  var notificationMail
  if (notification.status === 'APPROVED') {
    notificationMail = await (this.getNotification('APPROVAL_NOTIFICATION'))
    let _networkOwner = await (UserServ.findOne(netOwnerQuery))
    if (_networkOwner._id.toString() !== user._id.toString()) {
      notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
      let url = `${Config.baseURL}/advertiser/notification/approved/`
      notificationMail.content = notificationMail.content.replace("{{URL}}", url);
    } else {
      notificationMail = null
    }
  } else if (notification.status === 'REJECTED') {
    notificationMail = await (this.getNotification('REJECTION_NOTIFICATION'))
    notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
    let url = `${Config.baseURL}/advertiser/notification/rejected/`
    notificationMail.content = notificationMail.content.replace("{{URL}}", url);
  } else if (notification.status === 'UNAPPROVED') {
    notificationMail = await (this.getNotification('UNAPPROVAL_NOTIFICATION'))
    notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
    let url = `${Config.baseURL}/advertiser/notification/unapproved/  `
    notificationMail.content = notificationMail.content.replace("{{URL}}", url);
  } else if (notification.status === 'FAILURE' && notification.type === 'PAYMENT') {
    notificationMail = await (this.getNotification('PAYMENT_FAILED'))
    notificationMail.content = notificationMail.content.replace("{{name}}", user.name);
  }
  if (notificationMail && user.mail) {
    await (MailServ.sendMail('noreply@digitalsmartads.com', [user.email], notificationMail.subject, notificationMail.content))
  }
  return
}

this.init()

module.exports = this;