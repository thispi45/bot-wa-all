global.crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode'); // ganti dari qrcode-terminal
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const PHONE_NUMBER = '6283840825527'; // GANTI DENGAN NOMOR KAMU, format 62xxx tanpa +
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
            console.log('\n[QR] Scan QR ini di WhatsApp:');
            QRCode.toString(qr, { type: 'terminal', small: false }, (err, url) => {
                if (err) return console.log(err);
                console.log(url); // QR rapat hitam pekat
            });
            console.log('[QR] QR berlaku 20 detik\n');
        }

        if (connection === 'connecting' &&!state.creds.registered &&!pairingRequested) {
            pairingRequested = true;
            await new Promise(r => setTimeout(r, 3000)); // tunggu socket stabil
            try {
                const code = await sock.requestPairingCode(PHONE_NUMBER);
                console.log('[PAIRING] KODE:', code.match(/.{1,4}/g).join("-"));
                console.log('[PAIRING] Input dalam 20 detik!\n');
            } catch (err) {
                console.log('[PAIRING] Gagal 428. Pakai QR di atas ya\n');
            }
        }

        if (connection === 'open') {
            console.log('[CONNECT] Bot berhasil terhubung ke WhatsApp ✅\n');
        }

        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            console.log('[DISCONNECT] Code:', code);
            if (code!== DisconnectReason.loggedOut) {
                console.log('[RECONNECT] Coba lagi dalam 5 detik...');
                setTimeout(() => startBot(), 5000);
            } else {
                fs.rmSync(authPath, { recursive: true, force: true });
                console.log('[LOGOUT] Auth dihapus. Redeploy untuk QR baru');
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
