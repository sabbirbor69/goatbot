"use strict";

var utils = require("../utils");
var log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
  function makeTypingIndicator(typ, threadID, callback, isGroup) {
    var form = {
      typ: +typ,
      source: "mercury-chat"
    };

    if (isGroup === true) {
      form.thread_fbid = threadID;
    } else {
      form.to = threadID;
    }

    defaultFuncs
      .post("https://www.facebook.com/ajax/messaging/typ.php", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (resData) {
        if (resData.error) throw resData;
        return callback();
      })
      .catch(function (err) {
        log.error("sendTypingIndicator", err);
        if (utils.getType(err) == "Object" && err.error === "Not logged in") {
          ctx.loggedIn = false;
        }
        return callback(err);
      });
  }

  return function sendTypingIndicator(threadID, callback, isGroup) {
    if (typeof callback !== "function") {
      if (typeof callback === "boolean") {
        isGroup = callback;
      }
      callback = () => { };
    }

    makeTypingIndicator(true, threadID, callback, isGroup);

    return function end(cb) {
      if (typeof cb !== "function") cb = () => { };
      makeTypingIndicator(false, threadID, cb, isGroup);
    };
  };
};
