global.crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const authPath = path.join(__dirname, 'auth_info');
if (fs.existsSync(authPath + '/creds.json') && fs.statSync(authPath + '/creds.json').size < 10) {
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log('[RESET] creds.json corrupt, dihapus');
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Chrome', 'Windows', '10.0'], // pakai desktop
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') console.log('[CONNECT] Bot berhasil terhubung');
        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            console.log('[DISCONNECT] Code:', code);
            if (code!== DisconnectReason.loggedOut) setTimeout(() => startBot(), 5000);
        }
    });

    if (!state.creds.registered) {
        await new Promise(r => setTimeout(r, 15000));
        const phoneNumber = '6283840825527'; // GANTI 62xxx
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('[PAIRING] KODE PAIRING:', code.match(/.{1,4}/g).join("-"));
    }

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const chatId = msg.key.remoteJid;
        if (text.startsWith('!all') && chatId.endsWith('@g.us')) {
            const metadata = await sock.groupMetadata(chatId);
            const mentions = metadata.participants.map(p => p.id);
            const pesan = text.replace('!all', '').trim() || 'Perhatian semua!';
            await sock.sendMessage(chatId, { text: `*${pesan}*\n\n` + mentions.map(m => `@${m.split('@')[0]}`).join(' '), mentions });
        }
    });
}
startBot();
