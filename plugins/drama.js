const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

const izumi = { baseURL: "https://izumiiiiiiii.dpdns.org" };
const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let i = 1; i <= attempts; i++) {
        try { return await getter(); } 
        catch (err) { lastError = err; if(i < attempts) await new Promise(r => setTimeout(r, 1000 * i)); }
    }
    throw lastError;
}

async function getIzumiVideoByUrl(url) {
    const res = await tryRequest(() => axios.get(`${izumi.baseURL}/downloader/youtube?url=${encodeURIComponent(url)}&format=720`, AXIOS_DEFAULTS));
    if(res?.data?.result?.download) return res.data.result;
    throw new Error('Izumi API returned no download link');
}

async function getOkatsuVideoByUrl(url) {
    const res = await tryRequest(() => axios.get(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`, AXIOS_DEFAULTS));
    if(res?.data?.result?.mp4) return { download: res.data.result.mp4, title: res.data.result.title };
    throw new Error('Okatsu API returned no mp4');
}

cmd({
    pattern: "drama",
    alias: ["darama"],
    desc: "Download drama or YouTube video as document",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (sock, message, args, { from, reply }) => {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const query = text.split(' ').slice(1).join(' ').trim();

        const footer = "- _𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝙱𝚢 𝙵𝚊𝚒𝚣𝚊𝚗-𝙼𝙳🫀𝙾𝚏𝚏𝚒𝚌𝚒𝚊𝚕_";

        if(!query) return await sock.sendMessage(from, { text: `⚠️ Please provide a drama name\nExample: .drama drama name\n\n${footer}` }, { quoted: message });

        // Searching message
        await sock.sendMessage(from, { text: `🔍 Searching for: *${query}*...\n\n${footer}` }, { quoted: message });

        let videoUrl = "";
        let videoInfo = {};

        if(query.startsWith("http")) videoUrl = query;
        else {
            const { videos } = await yts(query);
            if(!videos || videos.length === 0) return await sock.sendMessage(from, { text: `❌ No videos found for: *${query}*\n\n${footer}` }, { quoted: message });
            videoInfo = videos[0];
            videoUrl = videoInfo.url;
        }

        const title = videoInfo.title || "YouTube Video";
        const views = videoInfo.views ? videoInfo.views.toLocaleString() : "N/A";
        const author = videoInfo.author?.name || "Unknown";
        const duration = videoInfo.timestamp || "Unknown";
        const thumb = videoInfo.thumbnail;

        await sock.sendMessage(from, {
            image: { url: thumb },
            caption: `🎬 *${title}*\n⏱ Duration: ${duration}\n👁 Views: ${views}\n👤 Channel: ${author}\n📥 Downloading...\n\n${footer}`
        }, { quoted: message });

        let videoData;
        try { videoData = await getIzumiVideoByUrl(videoUrl); }
        catch { videoData = await getOkatsuVideoByUrl(videoUrl); }

        await sock.sendMessage(from, { 
            text: `✅ Video found!\n🎬 Title: ${videoData.title || title}\n📦 Sending as document...\n\n${footer}`
        }, { quoted: message });

        await sock.sendMessage(from, {
            document: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${videoData.title || title}.mp4`
        }, { quoted: message });

    } catch (e) {
        console.log("[DRAMA CMD ERROR]", e?.message || e);
        const footer = "- _𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝙱𝚢 𝙵𝚊𝚒𝚣𝚊𝚗-𝙼𝙳🫀𝙾𝚏𝚏𝚒𝚌𝚒𝚊𝚕_";
        await sock.sendMessage(from, { text: `❌ Download failed!\nError: ${e?.message || 'Unknown error'}\n\n${footer}` }, { quoted: message });
    }
});
