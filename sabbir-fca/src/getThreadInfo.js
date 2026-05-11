/* eslint-disable linebreak-style */
"use strict";

var utils = require("../utils");

// =======================
// FORMAT EVENT REMINDER
// =======================
function formatEventReminders(reminder) {
  return {
    reminderID: reminder.id,
    eventCreatorID: reminder.lightweight_event_creator.id,
    time: reminder.time,
    eventType: reminder.lightweight_event_type.toLowerCase(),
    locationName: reminder.location_name,
    locationCoordinates: reminder.location_coordinates,
    locationPage: reminder.location_page,
    eventStatus: reminder.lightweight_event_status.toLowerCase(),
    note: reminder.note,
    repeatMode: reminder.repeat_mode.toLowerCase(),
    eventTitle: reminder.event_title,
    triggerMessage: reminder.trigger_message,
    secondsToNotifyBefore: reminder.seconds_to_notify_before,
    allowsRsvp: reminder.allows_rsvp,
    relatedEvent: reminder.related_event,
    members: reminder.event_reminder_members.edges.map(function(member) {
      return {
        memberID: member.node.id,
        state: member.guest_list_state.toLowerCase()
      };
    })
  };
}

// =======================
// FORMAT THREAD DATA
// =======================
function formatThreadGraphQLResponse(data) {
  try {
    var messageThread = data.message_thread;
  }
  catch (err) {
    console.error("GetThreadInfoGraphQL", "Can't get this thread info!");
    return { err: err };
  }

  var threadID = messageThread.thread_key.thread_fbid
    ? messageThread.thread_key.thread_fbid
    : messageThread.thread_key.other_user_id;

  return {
    threadID: threadID,
    threadName: messageThread.name,

    participantIDs: messageThread.all_participants.edges.map(
      d => d.node.messaging_actor.id
    ),

    userInfo: messageThread.all_participants.edges.map(d => ({
      id: d.node.messaging_actor.id,
      name: d.node.messaging_actor.name,
      firstName: d.node.messaging_actor.short_name,
      vanity: d.node.messaging_actor.username,
      thumbSrc: d.node.messaging_actor.big_image_src.uri,
      profileUrl: d.node.messaging_actor.big_image_src.uri,
      gender: d.node.messaging_actor.gender,
      type: d.node.messaging_actor.__typename,
      isFriend: d.node.messaging_actor.is_viewer_friend,
      isBirthday: !!d.node.messaging_actor.is_birthday
    })),

    unreadCount: messageThread.unread_count,
    messageCount: messageThread.messages_count,
    timestamp: messageThread.updated_time_precise,
    muteUntil: messageThread.mute_until,

    isGroup: messageThread.thread_type == "GROUP",
    isSubscribed: messageThread.is_viewer_subscribed,
    isArchived: messageThread.has_viewer_archived,

    emoji: messageThread.customization_info
      ? messageThread.customization_info.emoji
      : null,

    color:
      messageThread.customization_info &&
      messageThread.customization_info.outgoing_bubble_color
        ? messageThread.customization_info.outgoing_bubble_color.slice(2)
        : null,

    nicknames:
      messageThread.customization_info &&
      messageThread.customization_info.participant_customizations
        ? messageThread.customization_info.participant_customizations.reduce(
            function(res, val) {
              if (val.nickname)
                res[val.participant_id] = val.nickname;
              return res;
            },
            {}
          )
        : {},

    adminIDs: messageThread.thread_admins,

    imageSrc: messageThread.image
      ? messageThread.image.uri
      : null,

    approvalMode: Boolean(messageThread.approval_mode),

    approvalQueue: messageThread.group_approval_queue.nodes.map(a => ({
      inviterID: a.inviter.id,
      requesterID: a.requester.id,
      timestamp: a.request_timestamp,
      request_source: a.request_source
    })),

    eventReminders: messageThread.event_reminders
      ? messageThread.event_reminders.nodes.map(formatEventReminders)
      : null,

    TimeCreate: Date.now(),
    TimeUpdate: Date.now()
  };
}

// =======================
// SETTINGS
// =======================

// আগে 6 ছিল
const MAX_ARRAY_LENGTH = 15;

// =======================

var updateTimeout;
let Queues = [];

// =======================
// ADD TO QUEUE
// =======================
function addToQueues(num) {

  const existingArray = Queues.some(
    subArr => subArr.some(
      obj => obj.threadID == num.threadID
    )
  );

  if (!existingArray) {

    if (
      Queues.length > 0 &&
      Queues[Queues.length - 1].length === MAX_ARRAY_LENGTH
    ) {
      Queues.push([num]);
    }
    else {
      const lastArray =
        Queues.length > 0
          ? Queues[Queues.length - 1]
          : [];

      lastArray.push(num);

      if (Queues.length === 0) {
        Queues.push(lastArray);
      }
    }
  }
}

// =======================
// MAIN EXPORT
// =======================
module.exports = function(defaultFuncs, api, ctx) {

  var {
    createData,
    getData,
    hasData,
    updateData
  } = require("../Extra/ExtraGetThread");

  return async function getThreadInfoGraphQL(threadID, callback) {

    var resolveFunc = function() {};
    var rejectFunc = function() {};

    var returnPromise = new Promise(function(resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (
      utils.getType(callback) != "Function" &&
      utils.getType(callback) != "AsyncFunction"
    ) {
      callback = function(err, data) {
        if (err) {
          return rejectFunc(err);
        }
        resolveFunc(data);
      };
    }

    if (utils.getType(threadID) !== "Array")
      threadID = [threadID];

    // =======================
    // GET MULTI INFO
    // =======================
    const getMultiInfo = async function(threadIDs) {

      let form = {};
      let tempThreadInf = [];

      threadIDs.forEach((x, y) => {

        form["o" + y] = {
          doc_id: "3449967031715030",
          query_params: {
            id: x,
            message_limit: 0,
            load_messages: false,
            load_read_receipts: false,
            before: null
          }
        };

      });

      let Submit = {
        queries: JSON.stringify(form),
        batch_name: "MessengerGraphQLThreadFetcher"
      };

      const promise = new Promise((resolve, reject) => {

        defaultFuncs
          .post(
            "https://www.facebook.com/api/graphqlbatch/",
            ctx.jar,
            Submit
          )

          .then(utils.parseAndCheckLogin(ctx, defaultFuncs))

          .then(resData => {

            if (
              resData.error ||
              resData[resData.length - 1].error_results !== 0
            )
              throw "Error";

            resData = resData
              .slice(0, -1)
              .sort((a, b) =>
                Object.keys(a)[0].localeCompare(
                  Object.keys(b)[0]
                )
              );

            resData.forEach((x, y) =>
              tempThreadInf.push(
                formatThreadGraphQLResponse(
                  x["o" + y].data
                )
              )
            );

            return resolve({
              Success: true,
              Data: tempThreadInf
            });

          })

          .catch(() => {
            reject({
              Success: false,
              Data: ""
            });
          });

      });

      return await promise;
    };

    // =======================
    // UPDATE CHECK
    // =======================
    const checkAverageStaticTimestamp = function(avgTimeStamp) {

      // আগে 15 মিনিট ছিল
      const DEFAULT_UPDATE_TIME = 60 * 1000;

      const MAXIMUM_ERROR_TIME = 10 * 1000;

      return {
        Check:
          (
            parseInt(avgTimeStamp) +
            parseInt(DEFAULT_UPDATE_TIME)
          ) +
            parseInt(MAXIMUM_ERROR_TIME) >=
          Date.now(),

        timeLeft:
          (
            parseInt(avgTimeStamp) +
            parseInt(DEFAULT_UPDATE_TIME)
          ) -
            Date.now() +
          parseInt(MAXIMUM_ERROR_TIME)
      };
    };

    // =======================
    // AUTO UPDATE
    // =======================
    const autoUpdateData = async function() {

      let doUpdate = [];

      Queues.forEach((i, index) => {

        const averageTimestamp = Math.round(
          i.reduce(
            (acc, obj) =>
              acc + obj.TimeCreate,
            0
          ) / i.length
        );

        const DataAvg =
          checkAverageStaticTimestamp(
            averageTimestamp
          );

        if (!DataAvg.Check) {
          doUpdate.push(i);
          Queues.splice(index, 1);
        }

      });

      if (doUpdate.length >= 1) {

        let ids = [];

        doUpdate.forEach(i => {

          const onlyThreadID = [
            ...new Set(
              i.map(obj => obj.threadID)
            )
          ];

          ids.push(onlyThreadID);

        });

        ids.forEach(async function(i) {

          const dataResp =
            await getMultiInfo(i);

          if (dataResp.Success == true) {

            let MultiThread =
              dataResp.Data;

            MultiThread.forEach(
              threadInf =>
                updateData(
                  threadInf.threadID,
                  threadInf
                )
            );

          }

        });

      }
    };

    // =======================
    // AUTO CHECK LOOP
    // =======================
    const autoCheckAndUpdateRecallTime = () => {

      autoUpdateData();

      // আগে 30 sec ছিল
      const MAXIMUM_RECALL_TIME =
        10 * 1000;

      clearTimeout(updateTimeout);

      updateTimeout = setTimeout(() => {
        autoCheckAndUpdateRecallTime();
      }, MAXIMUM_RECALL_TIME);

    };

    // =======================
    // START AUTO SYSTEM
    // =======================
    if (global.Fca.Data.Already != true) {

      global.Fca.Data.Already = true;

      autoCheckAndUpdateRecallTime();

    }

    // =======================
    // CREATE / GET THREAD
    // =======================
    let cbThreadInfos = [];

    for (const id of threadID) {

      if (hasData(id)) {

        const data = getData(id);

        cbThreadInfos.push(data);

        addToQueues({
          threadID: data.threadID,
          TimeCreate: Date.now()
        });

      }
      else {

        const newThreadInf =
          await getMultiInfo([id]);

        if (newThreadInf.Success == true) {

          let MultiThread =
            newThreadInf.Data;

          MultiThread.forEach(
            threadInf =>
              createData(
                threadInf.threadID,
                threadInf
              )
          );

          cbThreadInfos =
            cbThreadInfos.concat(
              MultiThread
            );

        }

      }
    }

    return cbThreadInfos.length == 1
      ? callback(null, cbThreadInfos[0])
      : callback(null, cbThreadInfos);

  };
};
