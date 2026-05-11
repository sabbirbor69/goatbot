const SABBIR = "Ariful Islam Sabbir";

module.exports.config = {
  name: "help",
  version: "9.0.0",
  hasPermssion: 0,
  credits: SABBIR,
  description: "Help Menu With Loading Animation",
  usePrefix: true,
  category: "Info",
  usages: "help [page | command]",
  cooldowns: 5
};

const SABBIR_PER_PAGE = 10;

function buildPage(
  cmdList,
  page,
  totalPages,
  prefix
) {

  const start =
    (page - 1) *
    SABBIR_PER_PAGE;

  const slice =
    cmdList.slice(
      start,
      start +
      SABBIR_PER_PAGE
    );

  const lines = [];

  lines.push(
"╔══════════════════╗"
  );

  lines.push(
" ✨ SABBiR CHAT BOT ✨"
  );

  lines.push(
"╚══════════════════╝"
  );

  lines.push("");

  lines.push(
`👑 Owner: ${SABBIR}`
  );

  lines.push(
`📄 Page ${page}/${totalPages} • 📦 Total ${cmdList.length}`
  );

  lines.push(
"──────────────────"
  );

  for (
    let i = 0;
    i < slice.length;
    i++
  ) {

    lines.push(
`${start + i + 1}. ${slice[i]}`
    );
  }

  lines.push(
"──────────────────"
  );

  if (
    page > 1 ||
    page < totalPages
  ) {

    const nav = [];

    if (page > 1)
      nav.push("⬅ prev");

    if (
      page < totalPages
    )
      nav.push("next ➡");

    lines.push(
`📌 Reply: ${nav.join(" | ")}`
    );

    lines.push(
"🔢 Or Reply Page Number"
    );
  }

  lines.push(
`💡 ${prefix}help <command>`
  );

  return lines.join("\n");
}

function getCmdList() {

  const commands =
    global.GoatBot.commands;

  const cmdList = [];

  for (const [, cmd] of commands) {

    const c =
      cmd &&
      cmd.config;

    if (
      !c ||
      !c.name ||
      c.hidden
    )
      continue;

    cmdList.push(c.name);
  }

  cmdList.sort();

  return cmdList;
}

function sendOnce(
  api,
  threadID,
  body,
  replyToMessageID
) {

  return new Promise(
    (resolve, reject) => {

      const cb =
        (err, info) =>
          err
            ? reject(err)
            : resolve(info);

      if (
        replyToMessageID
      ) {

        api.sendMessage(
          { body },
          threadID,
          cb,
          replyToMessageID
        );

      } else {

        api.sendMessage(
          { body },
          threadID,
          cb
        );
      }
    }
  );
}

function registerReplyNav(
  messageID,
  payload
) {

  global.GoatBot.onReply.set(
    messageID,
    {
      commandName: "help",
      messageID,
      ...payload
    }
  );
}

async function showLoading(
  api,
  threadID
) {

  const frames = [

`╔════════════════╗
║ 📖 HELP MENU loading ║
╚════════════════╝

▒▒▒▒▒▒▒▒▒▒ 0%

⏳ Loading Commands...`,

`╔════════════════╗
║ 📖 HELP MENU loading ║
╚════════════════╝

██▒▒▒▒▒▒▒▒ 25%

📦 Fetching Commands...`,

`╔════════════════╗
║ 📖 HELP MENU loading ║
╚════════════════╝

█████▒▒▒▒▒ 50%

⚡ Processing Data...`,

`╔════════════════╗
║ 📖 HELP MENU loading ║
╚════════════════╝

███████▒▒▒ 75%

🚀 Building Help Menu...`,

`╔════════════════╗
║ 📖 HELP MENU loading ║
╚════════════════╝

██████████ 100%

✅ Complete...`

  ];

  const msg =
    await api.sendMessage(
      frames[0],
      threadID
    );

  for (
    let i = 1;
    i < frames.length;
    i++
  ) {

    await new Promise(
      resolve =>
        setTimeout(resolve, 400)
    );

    try {

      await api.editMessage(
        msg.messageID,
        frames[i]
      );

    } catch (_) {}
  }

  return msg.messageID;
}

module.exports.onStart =
async function ({
  api,
  event,
  message,
  args
}) {

  const prefix =
    (
      global.GoatBot &&
      global.GoatBot.config &&
      global.GoatBot.config.prefix
    ) || "/";

  const cmdList =
    getCmdList();

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        cmdList.length /
        SABBIR_PER_PAGE
      )
    );

  const loadingID =
    await showLoading(
      api,
      event.threadID
    );

  if (args[0]) {

    const pageNum =
      parseInt(args[0]);

    if (!isNaN(pageNum)) {

      const page =
        Math.max(
          1,
          Math.min(
            pageNum,
            totalPages
          )
        );

      const body =
        buildPage(
          cmdList,
          page,
          totalPages,
          prefix
        );

      try {

        await api.editMessage(
          loadingID,
          body
        );

      } catch (_) {

        await api.sendMessage(
          body,
          event.threadID
        );
      }

      registerReplyNav(
        loadingID,
        {
          author: String(
            event.senderID
          ),
          currentPage:
            page,
          cmdList,
          totalPages,
          prefix
        }
      );

      return;
    }

    const cmdName =
      args[0].toLowerCase();

    const cmd =
      global.GoatBot.commands.get(
        cmdName
      );

    if (!cmd) {

      return message.reply(
`❌ "${cmdName}" নামে কোনো command পাওয়া যায়নি।`
      );
    }

    const c =
      cmd.config;

    const detail = [

"╔══════════════════╗",
"    COMMAND INFO",
"╚══════════════════╝",

`📌 Name: ${c.name}`,

`📝 Description: ${
  c.description ||
  c.shortDescription ||
  "No Description"
}`,

`🔧 Usage: ${
  prefix +
  (c.usages ||
   c.name)
}`,

`📂 Category: ${
  c.category ||
  "General"
}`,

`⏱ Cooldown: ${
  c.cooldowns ||
  c.countDown ||
  0
}s`,

`👑 Credits: ${
  c.credits ||
  SABBIR
}`

    ].join("\n");

    try {

      await api.editMessage(
        loadingID,
        detail
      );

    } catch (_) {

      await api.sendMessage(
        detail,
        event.threadID
      );
    }

    return;
  }

  const body =
    buildPage(
      cmdList,
      1,
      totalPages,
      prefix
    );

  try {

    await api.editMessage(
      loadingID,
      body
    );

  } catch (_) {

    await api.sendMessage(
      body,
      event.threadID
    );
  }

  registerReplyNav(
    loadingID,
    {
      author: String(
        event.senderID
      ),
      currentPage: 1,
      cmdList,
      totalPages,
      prefix
    }
  );
};

module.exports.onReply =
async function ({
  api,
  event,
  Reply
}) {

  const userID =
    String(
      event.senderID ||
      event.userID ||
      ""
    );

  if (
    Reply.author &&
    userID !==
    String(
      Reply.author
    )
  )
    return;

  const raw =
    (
      event.body ||
      ""
    )
      .trim()
      .toLowerCase();

  if (!raw)
    return;

  const {
    currentPage,
    cmdList,
    totalPages,
    prefix
  } = Reply;

  let nextPage =
    currentPage;

  if (

    raw === "next" ||
    raw === "n"

  ) {

    nextPage =
      currentPage + 1;

    if (
      nextPage >
      totalPages
    )
      nextPage = 1;

  } else if (

    raw === "prev" ||
    raw === "p"

  ) {

    nextPage =
      currentPage - 1;

    if (
      nextPage < 1
    )
      nextPage =
        totalPages;

  } else {

    const num =
      parseInt(raw);

    if (
      !isNaN(num) &&
      num >= 1 &&
      num <= totalPages
    ) {

      nextPage = num;

    } else {

      return;
    }
  }

  const loadingID =
    await showLoading(
      api,
      event.threadID
    );

  const body =
    buildPage(
      cmdList,
      nextPage,
      totalPages,
      prefix
    );

  try {

    await api.editMessage(
      loadingID,
      body
    );

  } catch (_) {

    await api.sendMessage(
      body,
      event.threadID
    );
  }

  registerReplyNav(
    loadingID,
    {
      author:
        Reply.author,
      currentPage:
        nextPage,
      cmdList,
      totalPages,
      prefix
    }
  );

  try {

    if (
      typeof api.unsendMessage ===
        "function" &&
      event.messageID
    ) {

      await api
        .unsendMessage(
          event.messageID
        )
        .catch(
          () => {}
        );
    }

  } catch (_) {}
};
