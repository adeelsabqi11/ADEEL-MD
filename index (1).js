const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  proto,
  generateWAMessageContent,
  generateWAMessage,
  prepareWAMessageMedia,
  downloadContentFromMessage,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  jidDecode,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys')

const l = console.log
const { getBuffer, getGroupAdmins, isUrl, runtime } = require('./lib/functions')
const { saveMessage } = require('./data')
const fs = require('fs')
const P = require('pino')
const config = require('./config')
const GroupEvents = require('./lib/groupevents');
const qrcode = require('qrcode-terminal')
const util = require('util')
const { sms, downloadMediaMessage, AntiDelete } = require('./lib')
const FileType = require('file-type');
const axios = require('axios')
const os = require('os')
const path = require('path')
const prefix = config.PREFIX

const ownerNumber = ['923089497853']

// 🔧 Memory Optimization Variables
const memoryCache = {
  messages: new Map(),
  maxSize: 500,
  lastCleanup: Date.now()
};

// Memory cleanup function
function cleanupMemoryCache() {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Clean old messages
  for (const [key, value] of memoryCache.messages.entries()) {
    if (value.timestamp < oneHourAgo) {
      memoryCache.messages.delete(key);
    }
  }
  
  // Limit size
  if (memoryCache.messages.size > memoryCache.maxSize) {
    const keys = Array.from(memoryCache.messages.keys());
    const toDelete = keys.slice(0, 100);
    for (const key of toDelete) {
      memoryCache.messages.delete(key);
    }
  }
  
  memoryCache.lastCleanup = now;
  console.log(`🧹 Memory cleaned. Cache size: ${memoryCache.messages.size}`);
}

// Schedule memory cleanup every 5 minutes
setInterval(cleanupMemoryCache, 5 * 60 * 1000);

// Temp directory management
const tempDir = path.join(os.tmpdir(), 'faizan-bot-cache');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

function clearTempFiles() {
  try {
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        // Ignore file errors
      }
    }
  } catch (e) {
    // Ignore directory errors
  }
}

setInterval(clearTempFiles, 10 * 60 * 1000); // Every 10 minutes

//=================== SESSION MANAGEMENT ============================
if (!fs.existsSync(__dirname + '/sessions/creds.json')) {
  if (config.SESSION_ID && config.SESSION_ID.trim() !== "") {
    const sessdata = config.SESSION_ID.replace("FAIZAN-MD~", '');
    try {
      const decodedData = Buffer.from(sessdata, 'base64').toString('utf-8');
      fs.writeFileSync(__dirname + '/sessions/creds.json', decodedData);
      console.log("✅ Session loaded from SESSION_ID");
    } catch (err) {
      console.error("❌ Error decoding session data:", err);
    }
  } else {
    console.log("⚠️ No SESSION_ID found. Using default auth.");
  }
}

const express = require("express");
const app = express();
const port = process.env.PORT || 9090;

//=============================================
// WhatsApp Connection Function
//=============================================

async function connectToWA() {
  console.log("🔗 Connecting to WhatsApp...");
  
  // Clean up previous connection if exists
  if (global.conn && global.conn.ev) {
    try {
      global.conn.ev.removeAllListeners();
      global.conn.ws?.close();
    } catch (e) {
      console.log("Cleanup error:", e.message);
    }
  }
  
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/sessions/')
  const { version } = await fetchLatestBaileysVersion()
  
  const conn = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    browser: Browsers.macOS("Chrome"),
    syncFullHistory: false, // IMPORTANT: Set to false to save memory
    auth: state,
    version,
    // Memory optimization settings
    markOnlineOnConnect: false,
    retryRequestDelayMs: 2000,
    maxMsgRetryCount: 3,
    connectTimeoutMs: 30000,
    keepAliveIntervalMs: 10000,
    generateHighQualityLinkPreview: false,
    defaultQueryTimeoutMs: 30000,
    transactionOpts: {
      maxCommitRetries: 3,
      delayBetweenTriesMs: 1000
    }
  })
  
  // Store connection globally
  global.conn = conn;
  
  // ================= CONNECTION EVENT HANDLER =================
  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('📱 QR Code Received. Scan with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`🔌 Connection closed. Reconnecting: ${shouldReconnect}`);
      
      if (shouldReconnect) {
        // Clean up before reconnecting
        try {
          conn.ev.removeAllListeners();
        } catch (e) {}
        
        // Clear memory cache
        memoryCache.messages.clear();
        clearTempFiles();
        
        setTimeout(() => {
          connectToWA();
        }, 5000);
      } else {
        console.log('❌ Logged out. Delete sessions folder and restart.');
      }
    } 
    else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
      
      // Load plugins
      console.log('📦 Loading plugins...');
      try {
        const pluginDir = "./plugins/";
        if (fs.existsSync(pluginDir)) {
          const pluginFiles = fs.readdirSync(pluginDir).filter(file => file.endsWith('.js'));
          
          // Clear require cache for plugins
          Object.keys(require.cache).forEach(key => {
            if (key.includes('/plugins/')) {
              delete require.cache[key];
            }
          });
          
          let loadedCount = 0;
          for (const plugin of pluginFiles) {
            try {
              require(pluginDir + plugin);
              loadedCount++;
            } catch (e) {
              console.error(`❌ Failed to load ${plugin}:`, e.message);
            }
          }
          console.log(`✅ ${loadedCount}/${pluginFiles.length} plugins loaded`);
        }
      } catch (e) {
        console.error('Plugin loading error:', e.message);
      }
      
      // Send welcome message
      setTimeout(() => {
        try {
          const welcomeMsg = `*Hello there FAIZAN-MD User! 👋*\n\n> Simple, Straight Forward But Loaded With Features 🎊\n\n*Thanks for using FAIZAN-MD 🚩*\n\n> Join WhatsApp Channel:\nhttps://whatsapp.com/channel/0029VbBmz4V5vKAIaWfYPT0C\n\n*Prefix:* ${prefix}\n\n> © Powered by FAIZAN-MD ❤️`;
          
          conn.sendMessage(conn.user.id, {
            image: { url: 'https://files.catbox.moe/ejufwa.jpg' },
            caption: welcomeMsg
          }).catch(e => console.log('Welcome message error:', e.message));
        } catch (e) {
          console.log('Welcome setup error:', e.message);
        }
      }, 2000);
    }
  });
  
  // ================= CREDS UPDATE =================
  conn.ev.on('creds.update', saveCreds);
  
  // ================= ANTI DELETE =================
  conn.ev.on('messages.update', async (updates) => {
    try {
      for (const update of updates) {
        if (update.update.message === null) {
          await AntiDelete(conn, updates);
          break; // Process only one deletion at a time
        }
      }
    } catch (error) {
      console.error('AntiDelete error:', error.message);
    }
  });
  
  // ================= ANTI CALL =================
  conn.ev.on("call", async (calls) => {
    try {
      if (config.ANTI_CALL !== 'true') return;
      
      for (const call of calls) {
        if (call.status === 'offer') {
          await conn.rejectCall(call.id, call.from);
          await conn.sendMessage(call.from, {
            text: config.REJECT_MSG || '*📞 Calls not allowed on this number* 📵'
          });
          break;
        }
      }
    } catch (error) {
      console.error('Anti-call error:', error.message);
    }
  });
  
  // ================= GROUP EVENTS =================
  conn.ev.on("group-participants.update", (update) => {
    try {
      GroupEvents(conn, update);
    } catch (error) {
      console.error('Group event error:', error.message);
    }
  });
  
  // ================= MESSAGE PROCESSING =================
  conn.ev.on('messages.upsert', async (messageData) => {
    try {
      const mek = messageData.messages[0];
      if (!mek || !mek.message) return;
      
      // Store in memory cache (limited)
      const cacheKey = `${mek.key.remoteJid}_${mek.key.id}`;
      if (memoryCache.messages.size < memoryCache.maxSize) {
        memoryCache.messages.set(cacheKey, {
          message: mek,
          timestamp: Date.now()
        });
      }
      
      // Mark as read if enabled
      if (config.READ_MESSAGE === 'true') {
        await conn.readMessages([mek.key]).catch(() => {});
      }
      
      // Handle view once messages
      if (mek.message.viewOnceMessageV2) {
        mek.message = mek.message.ephemeralMessage?.message || mek.message;
      }
      
      // Handle status updates
      if (mek.key.remoteJid === 'status@broadcast') {
        if (config.AUTO_STATUS_SEEN === "true") {
          await conn.readMessages([mek.key]).catch(() => {});
        }
        
        if (config.AUTO_STATUS_REACT === "true") {
          try {
            const emojis = ['❤️', '🔥', '🎉', '👍', '💯'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            await conn.sendMessage(mek.key.remoteJid, {
              react: { text: randomEmoji, key: mek.key }
            }, { statusJidList: [mek.key.participant] });
          } catch (e) {}
        }
        
        if (config.AUTO_STATUS_REPLY === "true" && mek.key.participant) {
          try {
            const text = config.AUTO_STATUS_MSG || "Nice status!";
            await conn.sendMessage(mek.key.participant, {
              text: text,
              react: { text: '💜', key: mek.key }
            }, { quoted: mek });
          } catch (e) {}
        }
      }
      
      // Save to database
      try {
        await saveMessage(mek);
      } catch (dbError) {}
      
      // Process the message
      await processMessage(conn, mek);
      
    } catch (error) {
      console.error('Message processing error:', error.message);
    }
  });
  
  // ================= UTILITY FUNCTIONS =================
  conn.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
    }
    return jid;
  };
  
  conn.downloadMediaMessage = async (message) => {
    try {
      const mime = (message.msg || message).mimetype || '';
      const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
      const stream = await downloadContentFromMessage(message, messageType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      return buffer;
    } catch (error) {
      console.error('Download error:', error.message);
      return null;
    }
  };
  
  conn.sendFile = async (jid, path, fileName, quoted = {}, options = {}) => {
    try {
      let buffer;
      if (Buffer.isBuffer(path)) {
        buffer = path;
      } else if (isUrl(path)) {
        buffer = await getBuffer(path);
      } else if (fs.existsSync(path)) {
        buffer = fs.readFileSync(path);
      } else {
        throw new Error('Invalid file path');
      }
      
      const type = options.asDocument ? 'document' : 
                  /image/.test(options.mimetype) ? 'image' :
                  /video/.test(options.mimetype) ? 'video' :
                  /audio/.test(options.mimetype) ? 'audio' : 'document';
      
      await conn.sendMessage(jid, {
        [type]: buffer,
        fileName: fileName || 'file',
        mimetype: options.mimetype,
        ...options
      }, { quoted });
      
      return true;
    } catch (error) {
      console.error('Send file error:', error.message);
      return false;
    }
  };
}

// ================= MESSAGE PROCESSOR =================
async function processMessage(conn, mek) {
  try {
    const m = sms(conn, mek);
    const type = getContentType(mek.message);
    const from = mek.key.remoteJid;
    
    // Extract message text
    let body = '';
    if (type === 'conversation') {
      body = mek.message.conversation;
    } else if (type === 'extendedTextMessage') {
      body = mek.message.extendedTextMessage.text;
    } else if (type === 'imageMessage' && mek.message.imageMessage?.caption) {
      body = mek.message.imageMessage.caption;
    } else if (type === 'videoMessage' && mek.message.videoMessage?.caption) {
      body = mek.message.videoMessage.caption;
    }
    
    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
    const args = body.trim().split(/ +/).slice(1);
    const isGroup = from.endsWith('@g.us');
    const sender = mek.key.fromMe ? conn.user.id : (mek.key.participant || mek.key.remoteJid);
    const senderNumber = sender.split('@')[0];
    const isOwner = ownerNumber.includes(senderNumber) || mek.key.fromMe;
    
    // Check worktype restrictions
    if (!isOwner) {
      if (config.MODE === "private") return;
      if (isGroup && config.MODE === "inbox") return;
      if (!isGroup && config.MODE === "groups") return;
    }
    
    // Auto react for owner
    if (senderNumber.includes("923035512967") && !m.message?.reactionMessage) {
      const reactions = ["👑", "❤️", "🔥", "🎯"];
      const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
      m.react(randomReaction).catch(() => {});
    }
    
    // Auto react for all messages
    if (config.AUTO_REACT === 'true' && !m.message?.reactionMessage) {
      const reactions = ['❤️', '👍', '🔥', '🎉'];
      const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
      m.react(randomReaction).catch(() => {});
    }
    
    // Process command
    if (isCmd && command) {
      try {
        const events = require('./command');
        const cmd = events.commands.find(cmd => cmd.pattern === command) || 
                    events.commands.find(cmd => cmd.alias && cmd.alias.includes(command));
        
        if (cmd) {
          if (cmd.react) {
            conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } }).catch(() => {});
          }
          
          // Prepare context
          const context = {
            from, body, isCmd, command, args,
            q: args.join(' '), text: args.join(' '),
            isGroup, sender, senderNumber,
            pushname: mek.pushName || 'User',
            isMe: mek.key.fromMe,
            isOwner,
            reply: (text) => {
              conn.sendMessage(from, { text }, { quoted: mek }).catch(() => {});
            }
          };
          
          await cmd.function(conn, mek, m, context);
        }
      } catch (error) {
        console.error(`Command error [${command}]:`, error.message);
      }
    }
  } catch (error) {
    console.error('Process message error:', error.message);
  }
}

// ================= EXPRESS SERVER =================
app.get("/", (req, res) => {
  const memory = process.memoryUsage();
  const status = {
    status: "FAIZAN-MD⁸⁷³ RUNNING ✅",
    memory: {
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`
    },
    cache: {
      messages: memoryCache.messages.size,
      maxSize: memoryCache.maxSize
    },
    uptime: runtime(process.uptime())
  };
  
  if (req.query.json) {
    res.json(status);
  } else {
    res.send(`
      <h1>${status.status}</h1>
      <p>Memory Usage: ${status.memory.heapUsed}/${status.memory.heapTotal}</p>
      <p>Message Cache: ${status.cache.messages}/${status.cache.maxSize}</p>
      <p>Uptime: ${status.uptime}</p>
      <p><a href="/?json=true">View JSON</a></p>
    `);
  }
});

app.listen(port, () => {
  console.log(`🌐 Server running on port ${port}`);
  console.log(`📊 Memory status: http://localhost:${port}/`);
  
  // Start WhatsApp connection
  setTimeout(() => {
    connectToWA();
  }, 3000);
});

// ================= ERROR HANDLERS =================
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason?.message || reason);
});

// Clean exit
process.on('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  if (global.conn) {
    try {
      global.conn.ev?.removeAllListeners();
      global.conn.ws?.close();
    } catch (e) {}
  }
  memoryCache.messages.clear();
  process.exit(0);
});

// Export for testing
module.exports = { connectToWA };