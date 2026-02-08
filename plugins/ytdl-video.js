const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');

cmd({
  pattern: "video2",
  alias: ["mp4", "ytmp4"],
  react: "🎥",
  desc: "YouTube MP4 Downloader",
  category: "download",
  use: ".video2 <song name | yt link>",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) {
      return reply("❌ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃\n\nProvide video name or YouTube link.");
    }

    await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

    let videoUrl, video;

    if (q.includes("youtu")) {
      videoUrl = q;
      const id = q.split(/v=|\/|be\//).pop().substring(0, 11);
      video = await yts({ videoId: id });
    } else {
      const search = await yts(q);
      if (!search.videos.length) {
        return reply("❌ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃\n\nNo results found.");
      }
      video = search.videos[0];
      videoUrl = video.url;
    }

    // 🎯 WORKING API
    const api = `https://api.giftedtech.co.ke/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(videoUrl)}&quality=360`;
    const { data } = await axios.get(api);

    if (!data?.success || !data?.result?.download_url) {
      return reply("❌ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃\n\nVideo download failed.");
    }

    const r = data.result;

    const caption = `
🎬 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃

📌 Title: ${r.title}
🎞 Quality: ${r.quality}
⏱ Duration: ${Math.floor(r.duration / 60)}:${r.duration % 60}

⚡ Powered by 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃
`;

    // ✅ SEND AS DOCUMENT (IMPORTANT)
    await conn.sendMessage(from, {
      document: { url: r.download_url },
      mimetype: "video/mp4",
      fileName: `${r.title}.mp4`,
      caption
    }, { quoted: mek });

    await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

  } catch (e) {
    console.error(e);
    reply("❌ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃\n\nUnexpected error.");
  }
});
