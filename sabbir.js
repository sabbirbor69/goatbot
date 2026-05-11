"use strict";

process.on('unhandledRejection', error => console.log(error));
process.on('uncaughtException', error => console.log(error));

const fs = require("fs-extra");
const { execSync } = require('child_process');
const path = require("path");

const logger = require('./utils/logger.js');
const logHandler = require("./utils/Log.js"); 

process.env.BLUEBIRD_W_FORGOTTEN_RETURN = 0;

const dirConfig = path.normalize(`${__dirname}/config.json`);
const dirConfigCommands = path.normalize(`${__dirname}/configCommands.json`);
const dirAccount = path.normalize(`${__dirname}/account.txt`);

const config = require(dirConfig);
let configCommands = {};
try {
        if (fs.existsSync(dirConfigCommands)) {
                configCommands = require(dirConfigCommands);
        }
} catch (e) {
        configCommands = {};
}
configCommands.envGlobal = configCommands.envGlobal || {};
configCommands.envCommands = configCommands.envCommands || {};
configCommands.envEvents = configCommands.envEvents || {};
configCommands.commandUnload = configCommands.commandUnload || [];
configCommands.commandEventUnload = configCommands.commandEventUnload || [];
configCommands.commandBanned = configCommands.commandBanned || {};
// Map alternate field names used by original Goat-Bot-V2
if (!config.adminBot) config.adminBot = config.adminID || [];
if (!config.optionsFca) config.optionsFca = config.fcaOption || {};

global.GoatBot = {
        startTime: Date.now() - process.uptime() * 1000,
        commands: new Map(),
        eventCommands: new Map(),
        commandFilesPath: [],
        eventCommandsFilesPath: [],
        aliases: new Map(),
        onFirstChat: [],
        onChat: [],
        onEvent: [],
        onReply: new Map(),
        onReaction: new Map(),
        onAnyEvent: [],
        config,
        configCommands,
        envCommands: {},
        envEvents: {},
        envGlobal: {},
        reLoginBot: function () { },
        Listening: null,
        oldListening: [],
        callbackListenTime: {},
        storage5Message: [],
        fcaApi: null,
        botID: null
};

global.db = {
        allThreadData: [],
        allUserData: [],
        allDashBoardData: [],
        allGlobalData: [],
        threadModel: null,
        userModel: null,
        dashboardModel: null,
        globalModel: null,
        threadsData: null,
        usersData: null,
        dashBoardData: null,
        globalData: null,
        receivedTheFirstMessage: {}
};

global.client = {
        dirConfig,
        dirConfigCommands,
        dirAccount,
        countDown: {},
        cache: {},
        database: {
                creatingThreadData: [],
                creatingUserData: [],
                creatingDashBoardData: [],
                creatingGlobalData: []
        },
        commandBanned: configCommands.commandBanned || {}
};

const { colors } = logger;

function getText(objectLanguage, key, ...args) {
    try {
        const languageData = require(`./languages/bn.json`);
        let text = (languageData[objectLanguage] && languageData[objectLanguage][key]) || key;
        for (let i = 0; i < args.length; i++) {
            text = text.replace(new RegExp(`%${i + 1}`, 'g'), args[i]);
        }
        return text;
    } catch (e) {
        return key;
    }
}

function getPrefix(threadID) {
    try {
        const threadData = global.db.allThreadData.find(t => t.threadID == threadID);
        return (threadData && threadData.data && threadData.data.prefix) || global.GoatBot.config.prefix || '/';
    } catch (e) {
        return global.GoatBot.config.prefix || '/';
    }
}

function createOraDots(text) {
    let spinner;
    try {
        const ora = require('ora');
        spinner = ora({ text, spinner: 'dots', isEnabled: process.stdout.isTTY });
    } catch (e) {
        spinner = null;
    }
    return {
        spinner,
        text,
        _start: function() {
            try {
                if (this.spinner) this.spinner.start();
                else process.stdout.write((this.text || '') + '\n');
            } catch (e) {}
        },
        _stop: function() {
            try {
                if (this.spinner) this.spinner.stop();
            } catch (e) {}
        }
    };
}

function jsonStringifyColor(obj, replacer, space) {
    try {
        return JSON.stringify(obj, replacer, space);
    } catch (e) {
        return String(obj);
    }
}

function convertTime(ms, showFull = false) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function randomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function logColor(color, text) {
    console.log(text);
}

function getTime(format) {
    try {
        const moment = require('moment-timezone');
        const tz = (global.GoatBot && global.GoatBot.config && global.GoatBot.config.timeZone) || 'Asia/Dhaka';
        return moment().tz(tz).format(format || 'DD/MM/YYYY HH:mm:ss');
    } catch (e) {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        return `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
}

function removeHomeDir(filePath) {
    try {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        return filePath ? filePath.replace(homeDir, '~') : filePath;
    } catch (e) {
        return filePath;
    }
}

function createMessageHelper(api, event) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const isGroup = !!event.isGroup;

    async function _typeAndWait(targetThread, ms) {
        let end = null;
        try {
            if (typeof api.sendTypingIndicator === "function") {
                end = api.sendTypingIndicator(true, targetThread, () => {});
            }
        } catch (_) {}
        await new Promise(r => setTimeout(r, typeof ms === "number" ? ms : 2000));
        if (typeof end === "function") {
            try { end(() => {}); } catch (_) {}
        }
    }

    const helper = {
        reply: async function (msg, callback) {
            try {
                const isStr = typeof msg === 'string';
                const msgObj = isStr ? { body: msg, mentions: [] } : { ...msg };
                const fast = msgObj._fast === true;
                if (!isStr) delete msgObj._fast;
                if (!fast) await _typeAndWait(threadID, 2000);
                const info = await api.sendMessage(msgObj, threadID, messageID);
                if (typeof callback === 'function') callback(null, info);
                return info;
            } catch (e) {
                if (typeof callback === 'function') callback(e);
                throw e;
            }
        },
        send: async function (msg, tid, callback) {
            const targetThread = tid || threadID;
            try {
                const isStr = typeof msg === 'string';
                const msgObj = isStr ? { body: msg, mentions: [] } : { ...msg };
                const fast = msgObj._fast === true;
                if (!isStr) delete msgObj._fast;
                if (!fast) await _typeAndWait(targetThread, 2000);
                const info = await api.sendMessage(msgObj, targetThread);
                if (typeof callback === 'function') callback(null, info);
                return info;
            } catch (e) {
                if (typeof callback === 'function') callback(e);
                throw e;
            }
        },
        unsend: async function (msgID, callback) {
            try {
                const info = await api.unsendMessage(msgID);
                if (typeof callback === 'function') callback(null, info);
                return info;
            } catch (e) {
                if (typeof callback === 'function') callback(e);
                throw e;
            }
        },
        reaction: async function (emoji, msgID, callback) {
            try {
                const info = await api.setMessageReaction(emoji, msgID || messageID);
                if (typeof callback === 'function') callback(null, info);
                return info;
            } catch (e) {
                if (typeof callback === 'function') callback(e);
                throw e;
            }
        },
        addUserToGroup: async function (userID, tid, callback) {
            try {
                const info = await api.addUserToGroup(userID, tid || threadID);
                if (typeof callback === 'function') callback(null, info);
                return info;
            } catch (e) {
                if (typeof callback === 'function') callback(e);
                throw e;
            }
        },
        removeUserFromGroup: async function (userID, tid, callback) {
            try {
                const info = await api.removeUserFromGroup(userID, tid || threadID);
                if (typeof callback === 'function') callback(null, info);
                return info;
            } catch (e) {
                if (typeof callback === 'function') callback(e);
                throw e;
            }
        },
        SyntaxError: null
    };
    return helper;
}

const loading = {
    info: function(tag, message) {
        try {
            process.stdout.write(`\r\x1b[K`);
            console.log(`${colors.cyan(`[ ${tag} ]`)} ${message}`);
        } catch (e) {
            console.log(`[ ${tag} ] ${message}`);
        }
    },
    warn: function(tag, message) {
        try {
            process.stdout.write(`\r\x1b[K`);
            console.log(`${colors.yellow(`[ ${tag} ]`)} ${message}`);
        } catch (e) {
            console.log(`[ ${tag} ] ${message}`);
        }
    },
    err: function(tag, message) {
        try {
            process.stdout.write(`\r\x1b[K`);
            console.log(`${colors.red(`[ ${tag} ]`)} ${message}`);
        } catch (e) {
            console.log(`[ ${tag} ] ${message}`);
        }
    }
};

global.getText = getText;

const utilsModule = {
    log: logger,
    logger: logger,
    loading,
    colors,
    getText,
    getPrefix,
    createOraDots,
    jsonStringifyColor,
    convertTime,
    randomString,
    logColor,
    removeHomeDir,
    message: createMessageHelper,
    commandHandle: require("./utils/commandHandle.js"),
    handler: require("./utils/handler.js"),
    isNumber: (value) => typeof value === "number" && !isNaN(value),
    getTime
};

global.utils = utilsModule;
global.log = logger;

global.temp = {
    contentScripts: {
        cmds: {},
        events: {}
    },
    createThreadDataError: [],
    createUserDataError: []
};

(async () => {
        require(`./utils/login.js`);
})();
if (!process.env.BOT_NO_HTTP) {
  const express = require('express');
  const app = express();
  const port = process.env.PORT || 5000;

  app.get('/', (req, res) => {
    res.send('Bot is Alive!');
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
  });
}
