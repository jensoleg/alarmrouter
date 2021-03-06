'use strict';

var request = require('request'),
    _ = require('lodash'),
    Installation = require('devices'),
    operators = {
        lt: '<',
        lte: '<=',
        gt: '>',
        gte: '>=',
        eq: '=='
    };

function Triggers(connection, mqttClient) {

    this.handle = function (topic, message) {
        // parse topic
        var topics = topic.split('/'),
            domain = topics[1],
            deviceId = topics[2],
            stream = topics[3],

            installation = new Installation(connection, domain + '.installation');

        // find device
        installation.findDevice(deviceId, function (error, result) {
            var inst = result.installation,
                device = result.device;


            if (!error && device) {
                var index = 0,
                    doActivate,
                    notified = false;

                /* run through triggers and match stream topic */
                _.each(device.triggers, function (trigger) {

                    index = 0;

                    if (trigger.stream_id === stream) {

                        _.each(trigger.requests, function (httpRequest) {
                            // evaluate expression
                            doActivate = eval(message + operators[trigger.trigger_type] + trigger.threshold_value);

                            if (doActivate) {

                                if (_.isEmpty(trigger.triggered_value) || _.isUndefined(trigger.triggered_value)) {
                                    installation.updateTriggerValue(device.id, index, message, function (error) {
                                        if (!error) {
                                            // perform request
                                            request(httpRequest.request_options, function (error, response, body) {
                                                if (error) {
                                                    console.log('Request error: ', error);
                                                } else {
                                                    console.log('Request response: ', body);
                                                }
                                            });
                                        }
                                    });

                                    notified = true;
                                }
                            } else {
                                installation.updateTriggerValue(device.id, index, undefined, function (error) {
                                });
                            }
                        });

                        index++;
                    }

                });

                if (notified) {
                    mqttClient.publish('/' + domain + '/alarm/' + inst.id + '/' + device.id + '/' + stream, '1', {retain: true});
                } else {
                    mqttClient.publish('/' + domain + '/alarm/' + inst.id + '/' + device.id + '/' + stream, '0', {retain: true});
                }

            }
        });
    };
}

Triggers.prototype.handle = function () {

    var self = this;

    return function (packet, client) {

        self.handle(packet, client, function (send, err) {
        });
    };
};

module.exports = Triggers;