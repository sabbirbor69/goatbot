"use strict";

var utils = require("../utils");
var log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
  function makeTypingIndicator(typ, threadID, callback, isGroup) {
    var form = {
      typ: +typ,
      to: threadID, // ডিফল্টভাবে সরাসরি আইডি বসিয়ে দেওয়া হয়েছে গতি বাড়াতে
      source: "mercury-chat",
      thread: threadID
    };

    // যদি এটি গ্রুপ চ্যাট না হয় (অর্থাৎ সিঙ্গেল চ্যাট), তবে 'to' প্যারামিটার ব্যবহার হয়
    if (isGroup === false) {
        form.to = threadID;
    } else if (isGroup === true) {
        form.to = ""; // গ্রুপের ক্ষেত্রে 'to' খালি রাখতে হয়
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
      // যদি ইউজার ৩য় প্যারামিটারে callback না দিয়ে সরাসরি Boolean (true/false) দেয়
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
