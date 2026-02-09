const fs = require('fs');
const os = require('os');
const { cmd } = require('../command');

// Safely get version from package.json
let version = "1.0.0";
try {
    const pkg = JSON.parse(fs.readFileSync('./package.json'));
    version = pkg.version || "1.0.0";
} catch (err) {
    console.warn("⚠️ Could not read version:", err.message);
}

cmd({
    pattern: "ping",
    alias: "speed",
    desc: "Check bot response time and system status",
    category: "main",
    react: "⚡",
    filename: __filename
}, 
async (conn, mek, m, { from, reply }) => {
    try {
        const start = Date.now();
        await new Promise(r => setTimeout(r, 100));
        const ping = Date.now() - start;

        const totalRAM = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeRAM = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const usedRAM = (totalRAM - freeRAM).toFixed(2);
        const uptime = (os.uptime() / 60).toFixed(0);
        const cpu = os.cpus()?.[0]?.model || "Unknown";

        let groupCount = 0;
        let userCount = 0;
        const chats = conn.chats || conn.store?.chats || {};

        if (typeof chats === 'object') {
            for (const id of Object.keys(chats)) {
                if (id.endsWith('@g.us')) groupCount++;
                else if (id.endsWith('@s.whatsapp.net')) userCount++;
            }
        }

        const msg = `╭━━〔 *𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 Sʏsᴛᴇᴍ Rᴇᴘᴏʀᴛ* 〕━━┈⊷
┃ ⚡ *Speed:* \`${ping}ms\`
┃ 🧠 *Uptime:* \`${uptime} mins\`
┃ 💾 *RAM:* \`${usedRAM}/${totalRAM} GB\`
┃ 🔥 *CPU:* \`${cpu}\`
┃ 👤 *Users:* \`${userCount}\`
┃ 👥 *Groups:* \`${groupCount}\`
┃ 📦 *Version:* \`v${version}\`
╰━━━⊷ *© 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 2026*`;

        await conn.sendMessage(from, {
            text: msg,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363404256215058@newsletter',
                    newsletterName: '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 STATUS',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek });

    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});

// 🔥 Lightweight Ping
cmd({
    pattern: "ping2",
    desc: "Quick ping check",
    category: "main",
    react: "🚀",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const start = Date.now();
        const temp = await conn.sendMessage(from, { text: "⚡ *Checking speed...*" });
        const ping = Date.now() - start;

        const msg = `╭────❍ *𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃*
│
├ ✦ Speed: *${ping}ms*
├ ✦ Status: ✅ Online
├ ✦ Version: *v${version}*
│
╰────❍ *Powered by 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃*`;

        await conn.sendMessage(from, { text: msg }, { quoted: temp });
    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});
