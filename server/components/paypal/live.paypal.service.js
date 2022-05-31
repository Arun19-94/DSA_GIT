var config  	= require('../../config/config.js');

var paypal 		= require('paypal-rest-sdk');

paypal.configure(config.paypal.api);

this.payNow = function(paymentData) {
	var promise = new Promise(function(resolve, reject) {
		var response = {};
		paypal.payment.create(paymentData, function (error, payment) {
			if (error) {
				return reject(error);
			} else {
		    	if(payment.payer.payment_method === 'paypal') {
		    		var redirectUrl;
		    		response.payment = payment;
		    		for(var i=0; i < payment.links.length; i++) {
		    			var link = payment.links[i];
		    			if (link.method === 'REDIRECT') {
		    				redirectUrl = link.href;
		    			}
		    		}
		    		response.redirectUrl = redirectUrl;
		    	}
		    }
		    return resolve(response);
		});

	})
	return promise;
}

this.execute = function(payment, payerId) {
	var promise = new Promise(function(resolve, reject) {
		var serverAmount = parseFloat(payment.createResponse.payment.transactions[0].amount.total);
		var clientAmount = parseFloat(payment.paidAmount);
		if(serverAmount !== clientAmount ) {
			return reject("Payment amount doesn't matched.")
		}

		var paymentId = payment.createResponse.payment.id;
		var details = {
			payer_id: payerId
		}
		paypal.payment.execute(paymentId, details, function (error, payment) {
			if (error) {
				return reject(error)
			} else {
				return resolve(payment)
			}
		});
	});
	return promise;
}