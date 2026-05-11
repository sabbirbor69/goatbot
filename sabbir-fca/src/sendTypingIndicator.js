"use strict";

var utils = require("../utils");
var log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {

  function makeTypingIndicator(
    isTyping,
    threadID,
    callback,
    isGroup
  ) {

    if (typeof callback !== "function")
      callback = () => {};

    try {

      if (!ctx.mqttClient) {
        return callback(
          new Error("MQTT client not available")
        );
      }

      const taskPayload = JSON.stringify({
        thread_key: threadID,
        is_group_thread: isGroup ? 1 : 0,
        is_typing: isTyping ? 1 : 0
      });

      const form = JSON.stringify({

        app_id: "2220391788200892",

        payload: JSON.stringify({

          tasks: [
            {
              label: "3",
              payload: taskPayload,
              queue_name: "MarkThreadTyping",
              task_id: Math.floor(
                Math.random() * 1000000
              ),
              failure_count: null
            }
          ],

          epoch_id:
            utils.generateOfflineThreadingID(),

          version_id: "2220391788200892"

        }),

        request_id: ++ctx.req_ID,
        type: 3
      });

      ctx.mqttClient.publish(
        "/ls_req",
        form,
        {
          qos: 1,
          retain: false
        },
        function (err) {

          if (err) {
            log.error(
              "sendTypingIndicator",
              err
            );

            return callback(err);
          }

          callback();
        }
      );

    }
    catch (err) {

      log.error(
        "sendTypingIndicator",
        err
      );

      callback(err);
    }
  }

  return function sendTypingIndicator(
    threadID,
    callback,
    isGroup
  ) {

    if (typeof callback !== "function") {

      if (typeof callback === "boolean")
        isGroup = callback;

      callback = () => {};
    }

    makeTypingIndicator(
      true,
      threadID,
      callback,
      isGroup
    );

    return function end(cb) {

      if (typeof cb !== "function")
        cb = () => {};

      makeTypingIndicator(
        false,
        threadID,
        cb,
        isGroup
      );
    };
  };
};
