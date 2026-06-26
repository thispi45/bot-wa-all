global.crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const PHONE_NUMBER = '6283840825527'; // WAJIB GANTI 62xxx
const authPath = path.join(__dirname, 'auth_info');

// Hapus auth kalau corrupt/kosong
if (fs.existsSync(authPath) && (!fs.existsSync(authPath + '/creds.json') || fs.statSync(authPath + '/creds.json').size < 10)) {
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log('[RESET] auth_info dihapus');
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    let pairingRequested = false;

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Chrome', 'Windows', '10.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n[QR] Scan QR ini di WA:');
            qrcode.generate(qr, { small: true });
            console.log('\n');
        }

        if (connection === 'connecting' &&!state.creds.registered &&!pairingRequested) {
            pairingRequested = true;
            await new Promise(r => setTimeout(r, 3000)); // tunggu socket stabil 3 detik
            try {
                const code = await sock.requestPairingCode(PHONE_NUMBER);
                console.log('[PAIRING] KODE PAIRING:', code.match(/.{1,4}/g).join("-"));
                console.log('[PAIRING] Input dalam 20 detik!');
            } catch (err) {
                console.log('[PAIRING] Gagal request pairing 428. Fallback ke QR otomatis...');
                pairingRequested = false; // biar QR ke-trigger
            }
        }

        if (connection === 'open') {
            console.log('[CONNECT] Bot berhasil terhubung ke WhatsApp ✅');
        }

        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            console.log('[DISCONNECT] Code:', code);
            if (code!== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000);
            } else {
                fs.rmSync(authPath, { recursive: true, force: true }); // logout = hapus auth
            }
        }
    });

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
