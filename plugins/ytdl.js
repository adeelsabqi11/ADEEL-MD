const axios = require("axios");
const { cmd } = require("../command");

cmd({
  pattern: "play3",
  alias: ["mp3", "song"],
  react: "🎧",
  desc: "YouTube MP3 Downloader",
  category: "download",
  use: ".play3 <song name | yt link>",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) {
      return reply("❌ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃\n\nPlease provide song name or YouTube link.");
    }

    await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

    const api = `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(q)}&quality=128`;
    const { data } = await axios.get(api);

    if (!data?.success || !data?.result?.download_url) {
      return reply("❌ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃\n\nDownload failed.");
    }

    const r = data.result;

    const caption = `
╭───❖ 🎧 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 ❖───
│
│ 🎵 Title: ${r.title}
│ 🎚 Quality: ${r.quality}
│ ⏱ Duration: ${Math.floor(r.duration / 60)}:${r.duration % 60}
│
╰──────────────
⚡ Powered by 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃
`;

    await conn.sendMessage(from, {
      image: { url: r.thumbnail },
      caption
    }, { quoted: mek });

    // 🔥 IMPORTANT PART (DOCUMENT)
    await conn.sendMessage(from, {
      document: { url: r.download_url },
      mimetype: "audio/mpeg",
      fileName: "𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃.mp3"
    }, { quoted: mek });

    await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

  } catch (e) {
    console.error(e);
    reply("❌ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃\n\nError while downloading.");
  }
});
