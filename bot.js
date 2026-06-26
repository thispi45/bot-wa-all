global.crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const authPath = path.join(__dirname, 'auth_info');

// Hanya hapus kalau file creds.json ukurannya 0 byte / corrupt
if (fs.existsSync(authPath + '/creds.json') && fs.statSync(authPath + '/creds.json').size < 10) {
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log('[RESET] creds.json corrupt, dihapus');
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // silent biar log gak spam
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        mobile: true, // <-- KUNCI UTAMA DI RAILWAY
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        syncFullHistory: false,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('[CONNECT] Bot berhasil terhubung ke WhatsApp');
        }

        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            console.log('[DISCONNECT] Code:', code, 'Reason:', lastDisconnect.error?.message);
            if (code!== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000); // tunggu 5 detik baru reconnect
            }
        }
    });

    if (!state.creds.registered) {
        await new Promise(r => setTimeout(r, 15000)); // delay 15 detik
        const phoneNumber = '6283840825527'; // <-- GANTI NOMOR KAMU 62xxx

        try {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log('[PAIRING] KODE PAIRING:', code.match(/.{1,4}/g).join("-"));
        } catch (err) {
            console.error('[ERROR] Gagal minta pairing:', err.message);
            setTimeout(() => process.exit(1), 3000); // exit biar Railway auto restart
        }
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
