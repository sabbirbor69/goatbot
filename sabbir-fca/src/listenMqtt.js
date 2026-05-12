/* eslint-disable linebreak-style */
'use strict';

const utils = require('../utils');
const log = require('npmlog');
const mqtt = require('mqtt');
const WebSocket = require('ws');
const HttpsProxyAgent = require('https-proxy-agent');
const EventEmitter = require('events');
const Duplexify = require('duplexify');
const {
  Transform
} = require('stream');
var identity = function() {};
var form = {};
var getSeqID = function() {};
global.Fca.Data.MsgCount = new Map();
global.Fca.Data.event = new Map();

const topics = ['/ls_req', '/ls_resp', '/legacy_web', '/webrtc', '/rtc_multi', '/onevc', '/br_sr', '/sr_res', '/t_ms', '/thread_typing', '/orca_typing_notifications', '/notify_disconnect', '/orca_presence', '/inbox', '/mercury', '/messaging_events', '/orca_message_notifications', '/pp', '/webrtc_response'];

let WebSocket_Global;
let _reconnecting = false;

function buildProxy() {
  const Proxy = new Transform({
    objectMode: false,
    transform(chunk, enc, next) {
      if (WebSocket_Global.readyState !== WebSocket_Global.OPEN) {
        return next();
      }

      let data;
      if (typeof chunk === 'string') {
        data = Buffer.from(chunk, 'utf8');
      } else {
        data = chunk;
      }

      WebSocket_Global.send(data);
      next();
    },
    flush(done) {
      WebSocket_Global.close();
      done();
    },
    writev(chunks, cb) {
      const buffers = chunks.map(({ chunk }) => {
        if (typeof chunk === 'string') {
          return Buffer.from(chunk, 'utf8');
        }
        return chunk;
      });
      this._write(Buffer.concat(buffers), 'binary', cb);
    },
  });
  return Proxy;
}

function buildStream(options, WebSocket, Proxy) {
  const Stream = Duplexify(undefined, undefined, options);
  Stream.socket = WebSocket;

  WebSocket.onclose = () => {
    Stream.end();
    Stream.destroy();
  };

  WebSocket.onerror = (err) => {
    Stream.destroy(err);
  };

  WebSocket.onmessage = (event) => {
    const data = event.data instanceof ArrayBuffer ? Buffer.from(event.data) : Buffer.from(event.data, 'utf8');
    Stream.push(data);
  };

  WebSocket.onopen = () => {
    Stream.setReadable(Proxy);
    Stream.setWritable(Proxy);
    Stream.emit('connect');
  };

  WebSocket_Global = WebSocket;
  Proxy.on('close', () => WebSocket.close());

  return Stream;
}

function listenMqtt(defaultFuncs, api, ctx, globalCallback) {
  const chatOn = ctx.globalOptions.online;
  const foreground = false;

  const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
  const GUID = utils.getGUID()
  const username = {
    u: ctx.userID,
    s: sessionID,
    chat_on: chatOn,
    fg: foreground,
    d: GUID,
    ct: 'websocket',
    aid: '219994525426954',
    aids: null,
    mqtt_sid: '',
    cp: 3,
    ecp: 10,
    st: [],
    pm: [],
    dc: '',
    no_auto_fg: true,
    gas: null,
    pack: [],
    p: null,
    php_override: ""
  };

  const cookies = ctx.jar.getCookies('https://www.facebook.com').join('; ');

  let host;
  if (ctx.mqttEndpoint) {
    host = `${ctx.mqttEndpoint}&sid=${sessionID}&cid=${GUID}`;
  } else if (ctx.region) {
    host = `wss://edge-chat.facebook.com/chat?region=${ctx.region.toLowerCase()}&sid=${sessionID}&cid=${GUID}`;
  } else {
    host = `wss://edge-chat.facebook.com/chat?sid=${sessionID}&cid=${GUID}`;
  }

  const options = {
    clientId: 'mqttwsclient',
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    username: JSON.stringify(username),
    clean: true,
    wsOptions: {
      headers: {
        Cookie: cookies,
        Origin: 'https://www.facebook.com',
        'User-Agent': ctx.globalOptions.userAgent,
        Referer: 'https://www.facebook.com/',
        Host: new URL(host).hostname,
      },
      origin: 'https://www.facebook.com',
      protocolVersion: 13,
      binaryType: 'arraybuffer',
    },
    keepalive: 60,
    reschedulePings: true,
    reconnectPeriod: 0,
  };

  if (ctx.globalOptions.proxy !== undefined) {
    const agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
    options.wsOptions.agent = agent;
  }

  ctx.mqttClient = new mqtt.Client(() => buildStream(options, new WebSocket(host, options.wsOptions), buildProxy()), options);
  global.mqttClient = ctx.mqttClient;

  global.mqttClient.on('error', (err) => {
    log.error('listenMqtt', err);

    if (_reconnecting) return;
    _reconnecting = true;

    try { global.mqttClient.end(true); } catch (_) {}

    if (ctx.globalOptions.autoReconnect) {
      setTimeout(() => {
        getSeqID();
      }, 5000);
    } else {
      globalCallback({
        type: 'stop_listen',
        error: 'Server Down - Auto Restart'
      }, null);
      return process.exit(1);
    }
  });

  global.mqttClient.on('close', () => {
    if (_reconnecting) return;
    if (!ctx.globalOptions.autoReconnect) return;
    if (global.Fca.Data.StopListening) return;
    _reconnecting = true;
    setTimeout(() => {
      getSeqID();
    }, 5000);
  });

  global.mqttClient.on('connect', () => {
    _reconnecting = false;
    if (!global.Fca.Data.Setup || global.Fca.Data.Setup === undefined) {
      if (global.Fca.Require.FastConfig.RestartMQTT_Minutes !== 0 && global.Fca.Data.StopListening !== true) {
        global.Fca.Data.Setup = true;
        setTimeout(() => {
          global.Fca.Require.logger.Warning('Closing MQTT Client...');
          ctx.mqttClient.end();
          global.Fca.Require.logger.Warning('Reconnecting MQTT Client...');
          global.Fca.Data.Setup = false;
          getSeqID();
        }, Number(global.Fca.Require.FastConfig.RestartMQTT_Minutes) * 60 * 1000);
      }
    }

    if (process.env.OnStatus === undefined) {
      global.Fca.Require.logger.Normal('Running Version: Premium Access');

      if (Number(global.Fca.Require.FastConfig.AutoRestartMinutes) === 0) {
        // something
      } else if (Number(global.Fca.Require.FastConfig.AutoRestartMinutes) < 10) {
        log.warn('AutoRestartMinutes', 'The number of minutes to automatically restart must be more than 10 minutes');
      } else if (Number(global.Fca.Require.FastConfig.AutoRestartMinutes) < 0) {
        log.warn('AutoRestartMinutes', 'Invalid auto-restart minutes!');
      } else {
        global.Fca.Require.logger.Normal(global.Fca.getText(global.Fca.Require.Language.Src.AutoRestart, global.Fca.Require.FastConfig.AutoRestartMinutes));
        global.Fca.Require.logger.Normal(`Auto Restart MQTT Client After: ${global.Fca.Require.FastConfig.RestartMQTT_Minutes} Minutes`);
        setTimeout(() => {
          global.Fca.Require.logger.Normal(global.Fca.Require.Language.Src.OnRestart);
          process.exit(1);
        }, Number(global.Fca.Require.FastConfig.AutoRestartMinutes) * 60000);
      }
      require('../broadcast').startBroadcasting();
      const MemoryManager = require('../Extra/Src/Release_Memory');
      const path = require('path');

      const SettingMemoryManager = {
        warningThreshold: 0.7,
        releaseThreshold: 0.8,
        maxThreshold: 0.9,
        interval: 300 * 1000,
        logLevel: 'warn',
        logFile: path.join(process.cwd(), 'Horizon_Database' ,'memory.log'),
        smartReleaseEnabled: true,
        allowLog: (global.Fca.Require.FastConfig.AntiStuckAndMemoryLeak.LogFile.Use || false)
      };

      const memoryManager = new MemoryManager(SettingMemoryManager);

      memoryManager.autoStart(60 * 60 * 1000);

      if (global.Fca.Require.FastConfig.AntiStuckAndMemoryLeak.AutoRestart.Use) {
        memoryManager.onMaxMemory(function() {
          global.Fca.Require.logger.Warning('Memory Usage >= 90% - Auto Restart Avoid Crash');
          process.exit(1);
        });
      }
      process.env.OnStatus = true;
    }

    topics.forEach((topicsub) => global.mqttClient.subscribe(topicsub));


    let topic;
    const queue = {
      sync_api_version: 11,
      max_deltas_able_to_process: 100,
      delta_batch_size: 500,
      encoding: 'JSON',
      entity_fbid: ctx.userID,
    };

    topic = "/messenger_sync_create_queue";
    queue.initial_titan_sequence_id = ctx.lastSeqId;
    queue.device_params = null;

    global.mqttClient.publish(topic, JSON.stringify(queue), {
      qos: 1,
      retain: false
    });

    var rTimeout = setTimeout(function() {
      global.mqttClient.end();
      getSeqID();
    }, 3000);

    ctx.tmsWait = function() {
      clearTimeout(rTimeout);
      ctx.globalOptions.emitReady ? globalCallback({
        type: "ready",
        error: null
      }) : '';
      delete ctx.tmsWait;
    };
  });

  const HandleMessage = function(topic, message, _packet) {
    const jsonMessage = JSON.parse(message.toString());
    if (topic === "/t_ms") {
      if (ctx.tmsWait && typeof ctx.tmsWait == "function") ctx.tmsWait();

      if (jsonMessage.firstDeltaSeqId && jsonMessage.syncToken) {
        ctx.lastSeqId = jsonMessage.firstDeltaSeqId;
        ctx.syncToken = jsonMessage.syncToken;
      }

      if (jsonMessage.lastIssuedSeqId) ctx.lastSeqId = parseInt(jsonMessage.lastIssuedSeqId);
      //If it contains more than 1 delta
      for (var i in jsonMessage.deltas) {
        var delta = jsonMessage.deltas[i];
        parseDelta(defaultFuncs, api, ctx, globalCallback, {
          "delta": delta
        });
      }
    } else if (topic === "/ls_resp") {
      const payload = JSON.parse(jsonMessage.payload); //'{"name":null,"step":[1,[1,[4,0,1,[5,"taskExists",[19,"415"]]],[23,[2,0],[1,[5,"replaceOptimsiticMessage","7192532113093667880","mid.$gABfX5li9LA6VdUymnWPRAdlkiawo"]]]],[1,[4,0,1,[5,"taskExists",[19,"415"]]],[23,[2,0],[1,[5,"mailboxTaskCompletionApiOnTaskCompletion",[19,"415"],true]]]],[1,[4,0,1,[5,"taskExists",[19,"415"]]],[23,[2,0],[1,[5,"removeTask",[19,"415"],[9]]]]]]}'
      const request_ID = jsonMessage.request_id;

      if (ctx.callback_Task[request_ID] != undefined && ctx.callback_Task[request_ID].type != undefined) {
        const {
          callback,
          type
        } = ctx.callback_Task[request_ID];
        const Data = new getRespData(type, payload);
        if (!callback) {
          return;
        }
        else if (!Data) {
          callback("Something went wrong 🐳", null);
        } else {
          callback(null, Data);
        }
      }
    } else if (topic === "/thread_typing" || topic === "/orca_typing_notifications") {
      var typ = {
        type: "typ",
        isTyping: !!jsonMessage.state,
        from: jsonMessage.sender_fbid.toString(),
        threadID: utils.formatID((jsonMessage.thread || jsonMessage.sender_fbid).toString())
      };
      (function() {
        globalCallback(null, typ);
      })();
    } else if (topic === "/orca_presence") {
      if (!ctx.globalOptions.updatePresence) {
        for (var i in jsonMessage.list) {
          var data = jsonMessage.list[i];
          var userID = data["u"];

          var presence = {
            type: "presence",
            userID: userID.toString(),
            //Convert to ms
            timestamp: data["l"] * 1000,
            statuses: data["p"]
          };
          (function() {
            globalCallback(null, presence);
          })();
        }
      }
    }

  };

  global.mqttClient.on('message', HandleMessage);

  // Remove old listeners before adding new ones — prevents MaxListenersExceededWarning
  // when listenMqtt() is called repeatedly on reconnect cycles.
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('exit');

  process.on('SIGINT', () => {
    LogUptime();
    process.kill(process.pid);
  });

  process.on('exit', LogUptime);


}

function getRespData(Type, payload) {
  try {
    switch (Type) {
      case "sendMqttMessage": {
        return {
          type: Type,
          threadID: payload.step[1][2][2][1][2], //this is sick bro
          messageID: payload.step[1][2][2][1][3],
          payload: payload.step[1][2]
        };
      }
      default: { //!very LAZY :> cook yourself
        return {
          Data: payload.step[1][2][2][1],
          type: Type,
          payload: payload.step[1][2]
        };
      }
    }
  } catch (e) {
    return null;
  }
}

function LogUptime() {
  const uptime = process.uptime();
  const {
    join
  } = require('path');
  const filePath = join(__dirname, '../CountTime.json');

  let time1;
  if (global.Fca.Require.fs.existsSync(filePath)) {
    time1 = Number(global.Fca.Require.fs.readFileSync(filePath, 'utf8')) || 0;
  } else {
    time1 = 0;
  }

  global.Fca.Require.fs.writeFileSync(filePath, String(Number(uptime) + time1), 'utf8');
}

if (global.Fca.Require.FastConfig.AntiGetInfo.AntiGetThreadInfo) {
    setInterval(() => {
        try {
            const { updateMessageCount, getData, hasData } = require('../Extra/ExtraGetThread');
            const Data = global.Fca.Data.MsgCount;
            const Arr = Array.from(Data.keys());
            for (let i of Arr) {
                const Count = parseInt(Data.get(i));
                if (hasData(i)) {
                    let x = getData(i);
                    x.messageCount += Count;
                    updateMessageCount(i, x);
                    Data.delete(i);
                }
            }
            
        } catch (e) {
            console.log(e);
        }
    }, 30 * 1000);
}

function isEditedMessage(delta) {
  // Facebook sends edited messages as NewMessage deltas.
  // Tags live in multiple places depending on FB version — check all of them.
  const tagSources = [
    delta.tags,
    delta.messageMetadata && delta.messageMetadata.tags,
    delta.data && delta.data.tags,
  ];
  for (const tags of tagSources) {
    if (!Array.isArray(tags)) continue;
    if (tags.some(t => {
      const s = String(t).toLowerCase();
      return s === 'edit' ||
             s === 'msg_edit' ||
             s.includes('edit_message') ||
             s.includes('source:edit') ||
             s.includes(':edit');
    })) return true;
  }
  // Also catch the requestContext type used in some FCA versions
  if (delta.requestContext && String(delta.requestContext.type).toUpperCase() === 'EDIT') return true;
  return false;
}

function parseDelta(defaultFuncs, api, ctx, globalCallback, {
  delta
}) {
  if (delta.class === 'NewMessage') {
    if (ctx.globalOptions.pageID && ctx.globalOptions.pageID !== delta.queue) return;

    // Detect edited messages — they arrive as NewMessage but must NOT re-trigger
    // command handlers (that causes the animation/command loop). Emit them as
    // a distinct 'message_edit' event so listeners that care can handle them.
    if (isEditedMessage(delta)) {
      if (!ctx.globalOptions.listenEvents) return;
      let fmtMsg;
      try {
        fmtMsg = utils.formatDeltaMessage(delta);
      } catch (err) {
        return log.error('Minor Error', err);
      }
      if (fmtMsg) {
        fmtMsg.type = 'message_edit';
        fmtMsg.isEdited = true;
        globalCallback(null, fmtMsg);
      }
      return;
    }

    const resolveAttachmentUrl = (i) => {
      if (!delta.attachments || i === delta.attachments.length || utils.getType(delta.attachments) !== 'Array') {
        let fmtMsg;
        try {
          fmtMsg = utils.formatDeltaMessage(delta);
        } catch (err) {
          return log.error('Minor Error', err);
        }
        
        if (fmtMsg) {
            const isGroup = fmtMsg.isGroup;
            const threadID = fmtMsg.threadID;
            const messageID = fmtMsg.messageID;

            global.Fca.Data.event.set("Data", {
                isGroup,
                threadID,
                messageID
            });

            // Cache thread vs user routing so sendMessage knows how to address replies.
            // This is the authoritative source: messageMetadata.threadKey.threadFbId is set
            // for groups, otherUserFbId for 1-on-1. Without this cache, sendMessage falls
            // back to broken length-heuristics and gets FB error 1545012 in groups.
            try {
              if (isGroup) {
                if (!global.Fca.isThread.includes(threadID)) global.Fca.isThread.push(threadID);
              } else {
                if (!global.Fca.isUser.includes(threadID)) global.Fca.isUser.push(threadID);
              }
            } catch (_) {}

            if (global.Fca.Require.FastConfig.AntiGetInfo.AntiGetThreadInfo) {
                global.Fca.Data.MsgCount.set(fmtMsg.threadID, ((global.Fca.Data.MsgCount.get(fmtMsg.threadID)) + 1 || 1));
            }    

          if (ctx.globalOptions.autoMarkDelivery) {
            markDelivery(ctx, api, fmtMsg.threadID, fmtMsg.messageID);
          }

          if (!ctx.globalOptions.selfListen && fmtMsg.senderID === ctx.userID) return;
          globalCallback(null, fmtMsg);
        }
      } else {
        const attachment = delta.attachments[i];
        if (attachment.mercury.attach_type === 'photo') {
          api.resolvePhotoUrl(attachment.fbid, (err, url) => {
            if (!err) attachment.mercury.metadata.url = url;
            resolveAttachmentUrl(i + 1);
          });
        } else {
          resolveAttachmentUrl(i + 1);
        }
      }
    };

    // If body has '@' but no prng data, fetch mention ranges from GraphQL
    const hasMentionText = delta.body && delta.body.includes('@');
    const hasPrng = delta.data && delta.data.prng != null;

    if (hasMentionText && !hasPrng && delta.messageMetadata) {
      const msgID = delta.messageMetadata.messageId;
      const threadKey = delta.messageMetadata.threadKey;
      const threadID = threadKey && (threadKey.threadFbId || threadKey.otherUserFbId);

      if (msgID && threadID) {
        defaultFuncs.post('https://www.facebook.com/api/graphqlbatch/', ctx.jar, {
          av: ctx.globalOptions.pageID,
          queries: JSON.stringify({
            o0: {
              doc_id: '2848441488556444',
              query_params: {
                thread_and_message_id: {
                  thread_id: String(threadID),
                  message_id: msgID
                }
              }
            }
          })
        })
        .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
        .then((resData) => {
          try {
            if (
              resData && resData[0] &&
              resData[0].o0 && resData[0].o0.data &&
              resData[0].o0.data.message &&
              resData[0].o0.data.message.message &&
              Array.isArray(resData[0].o0.data.message.message.ranges) &&
              resData[0].o0.data.message.message.ranges.length > 0
            ) {
              const prng = resData[0].o0.data.message.message.ranges.map(r => ({
                i: r.entity && r.entity.id,
                o: r.offset,
                l: r.length
              })).filter(r => r.i);
              if (prng.length > 0) {
                if (!delta.data) delta.data = {};
                delta.data.prng = JSON.stringify(prng);
                log.info('MentionFetch', `Injected ${prng.length} mention(s) for msgID ${msgID}`);
              }
            }
          } catch (_) {}
        })
        .catch(() => {})
        .finally(() => resolveAttachmentUrl(0));
        return;
      }
    }

    resolveAttachmentUrl(0);
  } else if (delta.class === 'ClientPayload') {
    const clientPayload = utils.decodeClientPayload(delta.payload);
    if (clientPayload && clientPayload.deltas) {
      for (const delta of clientPayload.deltas) {
        if (delta.deltaMessageReaction && !!ctx.globalOptions.listenEvents) {
          const messageReaction = {
            type: 'message_reaction',
            threadID: (delta.deltaMessageReaction.threadKey.threadFbId ? delta.deltaMessageReaction.threadKey.threadFbId : delta.deltaMessageReaction.threadKey.otherUserFbId).toString(),
            messageID: delta.deltaMessageReaction.messageId,
            reaction: delta.deltaMessageReaction.reaction,
            senderID: delta.deltaMessageReaction.senderId.toString(),
            userID: delta.deltaMessageReaction.userId.toString(),
          };
          globalCallback(null, messageReaction);
        } else if (delta.deltaRecallMessageData && !!ctx.globalOptions.listenEvents) {
          const messageUnsend = {
            type: 'message_unsend',
            threadID: (delta.deltaRecallMessageData.threadKey.threadFbId ? delta.deltaRecallMessageData.threadKey.threadFbId : delta.deltaRecallMessageData.threadKey.otherUserFbId).toString(),
            messageID: delta.deltaRecallMessageData.messageID,
            senderID: delta.deltaRecallMessageData.senderID.toString(),
            deletionTimestamp: delta.deltaRecallMessageData.deletionTimestamp,
            timestamp: delta.deltaRecallMessageData.timestamp,
          };
          globalCallback(null, messageUnsend);
        } else if (delta.deltaMessageReply) {
          const _msg = delta.deltaMessageReply.message || {};
          const _msgBody = _msg.body || '';
          let _prngRaw = null;
          try {
            if (_msg.data && _msg.data.prng != null) _prngRaw = _msg.data.prng;
            else if (_msg.metadata && _msg.metadata.prng != null) _prngRaw = _msg.metadata.prng;
            else if (_msg.messageMetadata && _msg.messageMetadata.prng != null) _prngRaw = _msg.messageMetadata.prng;
          } catch (_) {}
          let _mdata = [];
          try { if (_prngRaw) { _mdata = typeof _prngRaw === 'string' ? JSON.parse(_prngRaw) : _prngRaw; if (!Array.isArray(_mdata)) _mdata = []; } } catch (_) { _mdata = []; }
          const m_id = _mdata.map((u) => u.i);
          const m_offset = _mdata.map((u) => u.o);
          const m_length = _mdata.map((u) => u.l);

          const mentions = {};
          for (let i = 0; i < m_id.length; i++) {
            if (m_id[i] != null) mentions[String(m_id[i])] = _msgBody.substring(m_offset[i], m_offset[i] + m_length[i]);
          }

          const callbackToReturn = {
            type: 'message_reply',
            threadID: (delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId ? delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId : delta.deltaMessageReply.message.messageMetadata.threadKey.otherUserFbId).toString(),
            messageID: delta.deltaMessageReply.message.messageMetadata.messageId,
            senderID: delta.deltaMessageReply.message.messageMetadata.actorFbId.toString(),
            attachments: ( delta.deltaMessageReply.message.attachments || [] )
              .map((att) => {
                const mercury = JSON.parse(att.mercuryJSON);
                Object.assign(att, mercury);
                return att;
              })
              .map((att) => {
                let x;
                try {
                  x = utils._formatAttachment(att);
                } catch (ex) {
                  x = att;
                  x.error = ex;
                  x.type = 'unknown';
                }
                return x;
              }),
            args: (delta.deltaMessageReply.message.body || '').trim().split(/\s+/),
            body: delta.deltaMessageReply.message.body || '',
            isGroup: !!delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId,
            mentions,
            timestamp: parseInt(delta.deltaMessageReply.message.messageMetadata.timestamp),
            participantIDs: (delta.deltaMessageReply.message.participants || []).map((e) => e.toString()),
          };

          // Cache thread vs user routing for replies (same fix as NewMessage path)
          try {
            if (callbackToReturn.isGroup) {
              if (!global.Fca.isThread.includes(callbackToReturn.threadID)) global.Fca.isThread.push(callbackToReturn.threadID);
            } else {
              if (!global.Fca.isUser.includes(callbackToReturn.threadID)) global.Fca.isUser.push(callbackToReturn.threadID);
            }
          } catch (_) {}

          if (delta.deltaMessageReply.repliedToMessage) {
            const _rMsg = delta.deltaMessageReply.repliedToMessage || {};
            const _rBody = _rMsg.body || '';
            let _rPrngRaw = null;
            try {
              if (_rMsg.data && _rMsg.data.prng != null) _rPrngRaw = _rMsg.data.prng;
              else if (_rMsg.metadata && _rMsg.metadata.prng != null) _rPrngRaw = _rMsg.metadata.prng;
              else if (_rMsg.messageMetadata && _rMsg.messageMetadata.prng != null) _rPrngRaw = _rMsg.messageMetadata.prng;
            } catch (_) {}
            let _rMdata = [];
            try { if (_rPrngRaw) { _rMdata = typeof _rPrngRaw === 'string' ? JSON.parse(_rPrngRaw) : _rPrngRaw; if (!Array.isArray(_rMdata)) _rMdata = []; } } catch (_) { _rMdata = []; }
            const m_id = _rMdata.map((u) => u.i);
            const m_offset = _rMdata.map((u) => u.o);
            const m_length = _rMdata.map((u) => u.l);

            const rmentions = {};
            for (let i = 0; i < m_id.length; i++) {
              if (m_id[i] != null) rmentions[String(m_id[i])] = _rBody.substring(m_offset[i], m_offset[i] + m_length[i]);
            }

            callbackToReturn.messageReply = {
              threadID: (delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.threadFbId ? delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.threadFbId : delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.otherUserFbId).toString(),
              messageID: delta.deltaMessageReply.repliedToMessage.messageMetadata.messageId,
              senderID: delta.deltaMessageReply.repliedToMessage.messageMetadata.actorFbId.toString(),
              attachments: delta.deltaMessageReply.repliedToMessage.attachments
              .map((att) => {
                let mercury;
                try {
                  mercury = JSON.parse(att.mercuryJSON);
                  Object.assign(att, mercury);
                } catch (ex) {
                  mercury = {};
                }
                return att;
              })
              .map((att) => {
                let x;
                try {
                  x = utils._formatAttachment(att);
                } catch (ex) {
                  x = att;
                  x.error = ex;
                  x.type = 'unknown';
                }
                return x;
              }),
              args: (delta.deltaMessageReply.repliedToMessage.body || '').trim().split(/\s+/),
              body: delta.deltaMessageReply.repliedToMessage.body || '',
              isGroup: !!delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.threadFbId,
              mentions: rmentions,
              timestamp: parseInt(delta.deltaMessageReply.repliedToMessage.messageMetadata.timestamp),
              participantIDs: (delta.deltaMessageReply.repliedToMessage.participants || []).map((e) => e.toString()),
            };
          } else if (delta.deltaMessageReply.replyToMessageId) {
            return defaultFuncs
              .post('https://www.facebook.com/api/graphqlbatch/', ctx.jar, {
                av: ctx.globalOptions.pageID,
                queries: JSON.stringify({
                  o0: {
                    doc_id: '2848441488556444',
                    query_params: {
                      thread_and_message_id: {
                        thread_id: callbackToReturn.threadID,
                        message_id: delta.deltaMessageReply.replyToMessageId.id,
                      },
                    },
                  },
                }),
              })
              .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
              .then((resData) => {
                if (resData[resData.length - 1].error_results > 0) throw resData[0].o0.errors;
                if (resData[resData.length - 1].successful_results === 0) throw {
                  error: 'forcedFetch: there was no successful_results',
                  res: resData
                };
                const fetchData = resData[0].o0.data.message;
                const mobj = {};

                for (const n in fetchData.message.ranges) {
                  mobj[fetchData.message.ranges[n].entity.id] = (fetchData.message.text || '').substr(fetchData.message.ranges[n].offset, fetchData.message.ranges[n].length);
                }
                callbackToReturn.messageReply = {
                  type: 'Message',
                  threadID: callbackToReturn.threadID,
                  messageID: fetchData.message_id,
                  senderID: fetchData.message_sender.id.toString(),
                  attachments: fetchData.message.blob_attachment.map((att) => utils._formatAttachment({
                    blob_attachment: att
                  })),
                  args: (fetchData.message.text || '').trim().split(/\s+/) || [],
                  body: fetchData.message.text || '',
                  isGroup: callbackToReturn.isGroup,
                  mentions: mobj,
                  timestamp: parseInt(fetchData.timestamp_precise),
                };
              })

              .catch((err) => log.error('forcedFetch', err))
              .finally(() => {
                if (ctx.globalOptions.autoMarkDelivery) {
                  markDelivery(ctx, api, callbackToReturn.threadID, callbackToReturn.messageID);
                }

                if (!ctx.globalOptions.selfListen && callbackToReturn.senderID === ctx.userID) return;
                globalCallback(null, callbackToReturn);
              });
          } else {
            callbackToReturn.delta = delta;
          }
          if (ctx.globalOptions.autoMarkDelivery) {
            markDelivery(ctx, api, callbackToReturn.threadID, callbackToReturn.messageID);
          }

          if (!ctx.globalOptions.selfListen && callbackToReturn.senderID === ctx.userID) return;
          globalCallback(null, callbackToReturn);
        }
      }

      return;
    }
  }
  switch (delta.class) {
    case 'ReadReceipt': {
      let fmtMsg;
      try {
        fmtMsg = utils.formatDeltaReadReceipt(delta);
      } catch (err) {
        return log.error('Lỗi Nhẹ', err);
      }
      globalCallback(null, fmtMsg);
      break;
    }
    case 'AdminTextMessage': {
      switch (delta.type) {
        case 'joinable_group_link_mode_change':
        case 'magic_words':
        case 'pin_messages_v2':
        case 'change_thread_theme':
        case 'change_thread_icon':
        case 'change_thread_nickname':
        case 'change_thread_admins':
        case 'change_thread_approval_mode':
        case 'group_poll':
        case 'messenger_call_log':
        case 'participant_joined_group_call': {
          let fmtMsg;
          try {
            fmtMsg = utils.formatDeltaEvent(delta);
          } catch (err) {
            console.log(delta);
            return log.error('Minor Error', err);
          }
          globalCallback(null, fmtMsg);
          break;
        }
      }
      break;
    }

    //For group images
    case 'ForcedFetch': {
      if (!delta.threadKey) return;
      const mid = delta.messageId;
      const tid = delta.threadKey.threadFbId;

      if (mid && tid) {
        const form = {
          av: ctx.globalOptions.pageID,
          queries: JSON.stringify({
            o0: {
              doc_id: '2848441488556444',
              query_params: {
                thread_and_message_id: {
                  thread_id: tid.toString(),
                  message_id: mid,
                },
              },
            },
          }),
        };
        defaultFuncs
          .post('https://www.facebook.com/api/graphqlbatch/', ctx.jar, form)
          .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
          .then((resData) => {
            if (resData[resData.length - 1].error_results > 0) throw resData[0].o0.errors;

            if (resData[resData.length - 1].successful_results === 0) throw {
              error: 'forcedFetch: there was no successful_results',
              res: resData
            };

            const fetchData = resData[0].o0.data.message;

            if (utils.getType(fetchData) === 'Object') {
              log.info('forcedFetch', fetchData);
              switch (fetchData.__typename) {
                case 'ThreadImageMessage':
                  if (!ctx.globalOptions.selfListen && fetchData.message_sender.id.toString() === ctx.userID) return;
                  if (!ctx.loggedIn) return;

                  globalCallback(null, {
                    type: 'change_thread_image',
                    threadID: utils.formatID(tid.toString()),
                    snippet: fetchData.snippet,
                    timestamp: fetchData.timestamp_precise,
                    author: fetchData.message_sender.id,
                    image: {
                      attachmentID: fetchData.image_with_metadata && fetchData.image_with_metadata.legacy_attachment_id,
                      width: fetchData.image_with_metadata && fetchData.image_with_metadata.original_dimensions.x,
                      height: fetchData.image_with_metadata && fetchData.image_with_metadata.original_dimensions.y,
                      url: fetchData.image_with_metadata && fetchData.image_with_metadata.preview.uri,
                    },
                  });
                  break;
                case 'UserMessage': {
                  const event = {
                    type: 'message',
                    senderID: utils.formatID(fetchData.message_sender.id),
                    body: fetchData.message.text || '',
                    threadID: utils.formatID(tid.toString()),
                    messageID: fetchData.message_id,
                    attachments: [{
                      type: 'share',
                      ID: fetchData.extensible_attachment.legacy_attachment_id,
                      url: fetchData.extensible_attachment.story_attachment.url,
                      title: fetchData.extensible_attachment.story_attachment.title_with_entities.text,
                      description: fetchData.extensible_attachment.story_attachment.description.text,
                      source: fetchData.extensible_attachment.story_attachment.source,
                      image: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).uri,
                      width: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).width,
                      height: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).height,
                      playable: (fetchData.extensible_attachment.story_attachment.media || {}).is_playable || false,
                      duration: (fetchData.extensible_attachment.story_attachment.media || {}).playable_duration_in_ms || 0,
                      subattachments: fetchData.extensible_attachment.subattachments,
                      properties: fetchData.extensible_attachment.story_attachment.properties,
                      }],
                    mentions: {},
                    timestamp: parseInt(fetchData.timestamp_precise),
                    isGroup: (fetchData.message_sender.id !== tid.toString()),
                  };

                  log.info('ff-Return', event);
                  globalCallback(null, event);
                  break;
                }
                default:
                  log.error('forcedFetch', fetchData);
              }
            } else {
              log.error('forcedFetch', fetchData);
            }
          })
          .catch((err) => log.error('forcedFetch', err));
      }
      break;
    }
    case 'ThreadName':
    case 'ParticipantsAddedToGroupThread':
    case 'ParticipantLeftGroupThread': {
      let formattedEvent;
      try {
        formattedEvent = utils.formatDeltaEvent(delta);
      } catch (err) {
        console.log(err);
        return log.error('Lỗi Nhẹ', err);
      }

      if (!ctx.globalOptions.selfListen && formattedEvent.author.toString() === ctx.userID) return;
      if (!ctx.loggedIn) return;
      globalCallback(null, formattedEvent);
      break;
    }
    case 'NewMessage': {
      const hasLiveLocation = delta => {
        const attachment = delta.attachments?.[0]?.mercury?.extensible_attachment;
        const storyAttachment = attachment?.story_attachment;
        return storyAttachment?.style_list?.includes('message_live_location');
      };
      
      if (delta.attachments?.length === 1 && hasLiveLocation(delta)) {
        delta.class = 'UserLocation';
        
        try {
          const fmtMsg = utils.formatDeltaEvent(delta);
          globalCallback(null, fmtMsg);
        } catch (err) {
          console.log(delta);
          log.error('Lỗi Nhẹ', err);
        }
      }
      break;
    }
  }
}

function markDelivery(ctx, api, threadID, messageID) {
  if (threadID && messageID) {
    api.markAsDelivered(threadID, messageID, (err) => {
      if (err) log.error('markAsDelivered', err);
      else {
        if (ctx.globalOptions.autoMarkRead) {
          api.markAsRead(threadID, (err) => {
            if (err) log.error('markAsDelivered', err);
          });
        }
      }
    });
  }
}



module.exports = function(defaultFuncs, api, ctx) {
  var globalCallback = identity;
  var okeoke;
  getSeqID = function getSeqID() {
    ctx.t_mqttCalled = false;
    defaultFuncs
      .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
      .then(res => {
        okeoke = res;
        return res;
      })
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then((resData) => {
        if (utils.getType(resData) != "Array") {
          if (okeoke.request.uri && okeoke.request.uri.href.includes("https://www.facebook.com/checkpoint/")) {
            if (okeoke.request.uri.href.includes('601051028565049')) {
                return global.Fca.BypassAutomationNotification(undefined, ctx.jar, ctx.globalOptions, undefined ,process.env.UID)
            }
          }
          if (global.Fca.Require.FastConfig.AutoLogin) {
            return global.Fca.Require.logger.Warning(global.Fca.Require.Language.Index.AutoLogin, function() {
              return global.Fca.Action('AutoLogin');
            });
          } else if (!global.Fca.Require.FastConfig.AutoLogin) {
            return global.Fca.Require.logger.Error(global.Fca.Require.Language.Index.ErrAppState);
          }
          return;
        } else {
          if (resData && resData[resData.length - 1].error_results > 0) throw resData[0].o0.errors;
          if (resData[resData.length - 1].successful_results === 0) throw {
            error: "getSeqId: there was no successful_results",
            res: resData
          };
          if (resData[0].o0.data.viewer.message_threads.sync_sequence_id) {
            ctx.lastSeqId = resData[0].o0.data.viewer.message_threads.sync_sequence_id;
            listenMqtt(defaultFuncs, api, ctx, globalCallback);
          } else throw {
            error: "getSeqId: no sync_sequence_id found.",
            res: resData
          };
        }
      })
      .catch((err) => {
        log.error("getSeqId", err);
        if (okeoke.request.uri && okeoke.request.uri.href.includes("https://www.facebook.com/checkpoint/")) {
              if (okeoke.request.uri.href.includes('601051028565049')) {
                  return global.Fca.BypassAutomationNotification(undefined, ctx.jar, ctx.globalOptions, undefined ,process.env.UID)
              }
          }
        if (utils.getType(err) == "Object" && err.error === global.Fca.Require.Language.Index.ErrAppState) ctx.loggedIn = false;
        return globalCallback(err);
      });
  };

  return function(callback) {
    class MessageEmitter extends EventEmitter {
      stopListening(callback) {
        callback = callback || (() => {});
        globalCallback = identity;
        if (ctx.mqttClient) {
          ctx.mqttClient.unsubscribe("/webrtc");
          ctx.mqttClient.unsubscribe("/rtc_multi");
          ctx.mqttClient.unsubscribe("/onevc");
          ctx.mqttClient.publish("/browser_close", "{}");
          ctx.mqttClient.end(false, function(...data) {
            ctx.mqttClient = undefined;
          });
        }
        global.Fca.Data.StopListening = true;
      }
    }

    var msgEmitter = new MessageEmitter();
    globalCallback = (callback || function(error, message) {
      if (error) return msgEmitter.emit("error", error);
      msgEmitter.emit("message", message);
    });

    //Reset some stuff
    if (!ctx.firstListen) ctx.lastSeqId = null;
    ctx.syncToken = undefined;
    ctx.t_mqttCalled = false;

    //Same request as getThreadList
    form = {
      av: ctx.globalOptions.pageID,
      queries: JSON.stringify({
        o0: {
          doc_id: '3336396659757871',
          query_params: {
            limit: 1,
            before: null,
            tags: ['INBOX'],
            includeDeliveryReceipts: false,
            includeSeqID: true,
          },
        },
      }),
    };


    if (!ctx.firstListen || !ctx.lastSeqId) getSeqID();
    else listenMqtt(defaultFuncs, api, ctx, globalCallback);
    ctx.firstListen = false;

    return msgEmitter;
  };
};