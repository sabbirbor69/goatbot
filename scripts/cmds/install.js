module.exports.config = {
    name: "install", 
    version: "12.0.0", 
    role: 2, 
    credits: "Ariful Islam Sabbir",
    description: "Fake Animation সহ টেক্সট/ফাইল/রিপ্লাই দিয়ে ইনস্টল করুন", 
    usePrefix: true, 
    category: "Admin", 
    cooldowns: 1
};

const fs = require("fs-extra"), path = require("path"), axios = require("axios");
const TTL = 300000, CACHE = path.join(process.cwd(), "tmp", "install_cache");

global.GoatBot = global.GoatBot || { tempInstalls: new Map() };

const clean = (n) => {
    const e = global.GoatBot.tempInstalls.get(n);
    if (!e) return;
    clearTimeout(e.h);
    global.GoatBot.tempInstalls.delete(n);
    global.GoatBot.commands.delete(n);
    try { 
        if (fs.existsSync(e.p)) fs.removeSync(e.p); 
        delete require.cache[require.resolve(e.p)]; 
    } catch(e) {}
};

module.exports.onStart = async ({ api, event: e, args: a }) => {
    const { threadID: tid, messageID: mid, messageReply: r } = e;
    let s = "", n = (a[0] || "").toLowerCase().replace(".js", "");

    try {
        // ১. কোড সংগ্রহ (টেক্সট, ফাইল অথবা রিপ্লাই)
        if (r) {
            const f = (e.attachments[0] || r.attachments[0]);
            if (f && f.type === "file") {
                // এখানে axios অ্যাড করা হয়েছে যাতে 'get' এরর না আসে
                s = (await axios.get(f.url, { responseType: "text" })).data;
            } else {
                s = r.body || (r.args ? r.args.join(" ") : "");
            }
        } else if (a.length > 1) {
            s = e.body.slice(e.body.indexOf(a[1]));
        }

        if (!s || s.length < 10 || !n) {
            return api.sendMessage("⚠️ দয়া করে কমান্ডের নাম দিন অথবা কোডে রিপ্লাই দিন!", tid, mid);
        }

        // ২. অ্যানিমেশন শুরু
        const m = await api.sendMessage("⏳ 𝗜𝗻𝘀𝘁𝗮𝗹𝗹𝗶𝗻𝗴... [ 𝟭𝟬% ]", tid);
        await new Promise(res => setTimeout(res, 600));
        await api.editMessage("⏳ 𝗜𝗻𝘀𝘁𝗮𝗹𝗹𝗶𝗻𝗴... [ 𝟲𝟬% ]", m.messageID).catch(() => {});
        await new Promise(res => setTimeout(res, 600));
        await api.editMessage("⏳ 𝗜𝗻𝘀𝘁𝗮𝗹𝗹𝗶𝗻𝗴... [ 𝟭𝟬𝟬% ]", m.messageID).catch(() => {});

        // ৩. ফাইল সেভ ও লোড
        fs.ensureDirSync(CACHE); 
        clean(n);
        const p = path.join(CACHE, `${n}.js`);
        fs.writeFileSync(p, s, "utf8");

        delete require.cache[require.resolve(p)];
        const mod = require(p);
        if (!mod.config || !mod.onStart) throw new Error("Invalid Format! config বা onStart নেই।");

        mod.location = p;
        global.GoatBot.commands.set(n, mod);
        global.GoatBot.tempInstalls.set(n, { p, h: setTimeout(() => clean(n), TTL) });

        // ৪. সাকসেস মেসেজ
        const ok = `╭─────────────╮\n   📥 𝗜𝗡𝗦𝗧𝗔𝗟𝗟 𝗗𝗢𝗡𝗘 📥\n╰─────────────╯\n━━━━━━━━━━━━━━━\n🚀 𝗡𝗮𝗺𝗲: ${n.toUpperCase()}\n⏳ 𝗘𝘅𝗽𝗶𝗿𝗲: 5 Minute\n━━━━━━━━━━━━━━━`;
        await api.editMessage(ok, m.messageID);

    } catch (err) {
        api.sendMessage(`❌ এরর: ${err.message}`, tid, mid);
    }
};
