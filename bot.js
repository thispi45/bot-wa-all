const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

async function startBot() {
    if (!fs.existsSync('auth_info')) fs.mkdirSync('auth_info');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'warn' }),
        browser: ['Ubuntu', 'Chrome', '20.0'],
        emitOwnEvents: false,
        syncFullHistory: false,
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('\n==== SCAN QR INI ====');
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
            console.log('=====================\n');
        }
        if (connection === 'open') console.log('✅ Bot terhubung v6.7.17');
        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            console.log('❌ Disconnect:', code);
            if (code!== DisconnectReason.loggedOut) setTimeout(startBot, 3000);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const chatId = msg.key.remoteJid;

        if (text.toLowerCase().startsWith('!all') && chatId.endsWith('@g.us')) {
            console.log('[DEBUG] Deteksi!all');
            try {
                const groups = await sock.groupFetchAllParticipating();
                const metadata = groups[chatId];
                if (!metadata) throw new Error('Data grup tidak ditemukan');

                const mentions = metadata.participants.map(p => p.id).slice(0, 200);
                const pesan = text.replace(/!all/i, '').trim() || 'Perhatian semua!';
                const textKirim = `*${pesan}*\n\n${mentions.map(m => `@${m.split('@')[0]}`).join(' ')}`;

                await sock.sendMessage(chatId, { text: textKirim, mentions });
                console.log('[DEBUG] Berhasil kirim tag + notif');

            } catch (err) {
                console.log('[ERROR!all]', err.message);
                await sock.sendMessage(chatId, { text: `Gagal tag: ${err.message}` });
            }
        }
    });
}

startBot();
