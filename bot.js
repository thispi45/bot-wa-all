global.crypto = require('crypto'); // Fix error crypto di Node 18 Railway
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

// Hapus folder auth_info biar gak corrupt 428
const authPath = path.join(__dirname, 'auth_info');
if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log('[RESET] Folder auth_info dihapus');
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'info' }),
        browser: ['Railway Bot', 'Chrome', '1.0.0'],
        printQRInTerminal: false // kita pakai pairing code
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('[CONNECT] Bot berhasil terhubung ke WhatsApp');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode!== DisconnectReason.loggedOut;
            console.log('[DISCONNECT] Alasan:', lastDisconnect.error?.message);
            if (shouldReconnect) {
                startBot(); // auto reconnect
            }
        }
    });

    // Minta kode pairing kalau belum login
    if (!state.creds.registered) {
        await new Promise(r => setTimeout(r, 8000)); // naikkan jadi 8 detik
        const phoneNumber = '6283840825527'; // <-- JANGAN LUPA GANTI
        
        let retries = 3;
        while (retries > 0) {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log('[PAIRING] KODE PAIRING:', code.match(/.{1,4}/g).join("-"));
                console.log('[PAIRING] Buka WA > Perangkat Tertaut > Tautkan dengan nomor telepon');
                break; // sukses, keluar dari loop
            } catch (err) {
                retries--;
                console.error(`[ERROR] Gagal minta pairing code. Retry ${3 - retries}/3:`, err.message);
                if (retries > 0) await new Promise(r => setTimeout(r, 5000));
                else console.log('[FATAL] Gagal dapat kode setelah 3x retry. Restart bot...');
            }
        }
    }

    // Fitur!all untuk tag semua member grup
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const chatId = msg.key.remoteJid;

        if (text.startsWith('!all') && chatId.endsWith('@g.us')) {
            try {
                const metadata = await sock.groupMetadata(chatId);
                const mentions = metadata.participants.map(p => p.id);
                const pesan = text.replace('!all', '').trim() || 'Perhatian semua!';
                await sock.sendMessage(chatId, {
                    text: `*${pesan}*\n\n` + mentions.map(m => `@${m.split('@')[0]}`).join(' '),
                    mentions
                });
                console.log(`[TAG] Berhasil tag ${mentions.length} member`);
            } catch (err) {
                console.error('[ERROR] Gagal!all:', err.message);
            }
        }
    });
}

startBot();
