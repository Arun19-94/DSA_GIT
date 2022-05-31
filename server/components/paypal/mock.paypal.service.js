var Random    = require('randomstring')

this.payNow = function(paymentData) {
	var promise = new Promise(function(resolve, reject) {
		var id = Random.generate(25)
		var token = Random.generate(17)
		var response = {
		  payment: {
		    id: 'PAY-' + id,
		    intent: 'sale',
		    state: 'created',
		    payer: {
		      payment_method: 'paypal'
		    },
		    transactions: paymentData.transactions,
		    create_time: new Date(),
		    links: [
		      {
		        "href": "https://api.sandbox.paypal.com/v1/payments/payment/PAY-" + id,
		        "rel": "self",
		        "method": "GET"
		      },
		      {
		        "href": "https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=EC-" + token,
		        "rel": "approval_url",
		        "method": "REDIRECT"
		      },
		      {
		        "href": "https://api.sandbox.paypal.com/v1/payments/payment/PAY-" + id + "/execute",
		        "rel": "execute",
		        "method": "POST"
		      }
		    ],
		    httpStatusCode: 201
		  },
		  redirectUrl: 'https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=EC-' + token
		}
		return resolve(response)
	})
	return promise;
}

this.execute = function(payment, payerId) {
	var promise = new Promise(function(resolve, reject) {
		/*if(serverAmount !== clientAmount ) {
			return reject("Payment amount doesn't matched.")
		}*/

		var response = {
		  "id": payment.createResponse.payment.id,
		  "intent": "sale",
		  "state": "approved",
		  "cart": "07S60549HJ400872T",
		  "payer": {
		    "payment_method": "paypal",
		    "status": "VERIFIED",
		    "payer_info": {
		      "email": "sales-buyer@digitalsmartads.com",
		      "first_name": "test",
		      "last_name": "buyer",
		      "payer_id": "GKNDZGKBFT9DC",
		      "shipping_address": {
		        "recipient_name": "test buyer",
		        "line1": "1 Main St",
		        "city": "San Jose",
		        "state": "CA",
		        "postal_code": "95131",
		        "country_code": "US"
		      },
		      "country_code": "US"
		    }
		  },
		  "transactions": [
		    {
		      "amount": payment.createResponse.payment.transactions[0].amount,
		      "payee": {
		        "merchant_id": "KVP65H3E8YXW6",
		        "email": "sales-facilitator@digitalsmartads.com"
		      },
		      "description": "Payment for Campaign sdfsdf",
		      "item_list": {
		        "shipping_address": {
		          "recipient_name": "test buyer",
		          "line1": "1 Main St",
		          "city": "San Jose",
		          "state": "CA",
		          "postal_code": "95131",
		          "country_code": "US"
		        }
		      },
		      "related_resources": [
		        {
		          "sale": {
		            "id": "04X42022BS259371U",
		            "state": "completed",
		            "amount": {
		              "total": "10.00",
		              "currency": "USD",
		              "details": {
		                "subtotal": "10.00"
		              }
		            },
		            "payment_mode": "INSTANT_TRANSFER",
		            "protection_eligibility": "ELIGIBLE",
		            "protection_eligibility_type": "ITEM_NOT_RECEIVED_ELIGIBLE,UNAUTHORIZED_PAYMENT_ELIGIBLE",
		            "transaction_fee": {
		              "value": "0.59",
		              "currency": "USD"
		            },
		            "parent_payment": payment.createResponse.payment.id,
		            "create_time": "2018-06-13T09:58:48Z",
		            "update_time": "2018-06-13T09:58:48Z",
		            "links": [
		              {
		                "href": "https://api.sandbox.paypal.com/v1/payments/sale/04X42022BS259371U",
		                "rel": "self",
		                "method": "GET"
		              },
		              {
		                "href": "https://api.sandbox.paypal.com/v1/payments/sale/04X42022BS259371U/refund",
		                "rel": "refund",
		                "method": "POST"
		              },
		              {
		                "href": "https://api.sandbox.paypal.com/v1/payments/payment/" + payment.createResponse.payment.id,
		                "rel": "parent_payment",
		                "method": "GET"
		              }
		            ],
		            "soft_descriptor": "PAYPAL *TESTFACILIT"
		          }
		        }
		      ]
		    }
		  ],
		  "create_time": "2018-06-13T09:58:49Z",
		  "links": [
		    {
		      "href": "https://api.sandbox.paypal.com/v1/payments/payment/" + payment.createResponse.payment.id,
		      "rel": "self",
		      "method": "GET"
		    }
		  ],
		  "httpStatusCode": 200
		}
		return resolve(response)
		/*var paymentId = payment.createResponse.payment.id;
		var details = {
			payer_id: payerId
		}
		paypal.payment.execute(paymentId, details, function (error, payment) {
			if (error) {
				return reject(error)
			} else {
				return resolve(payment)
			}
		});*/
	});
	return promise;
}