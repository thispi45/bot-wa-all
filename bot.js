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
        printQRInTerminal: true, // biar muncul di log
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('\n==== SCAN QR INI DENGAN WA KAMU ====');
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
            console.log('==== WAJIB LOGOUT DULU DI WA ====\n');
        }

        if (connection === 'open') console.log('✅ Bot terhubung');
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
            const groups = await sock.groupFetchAllParticipating();
            const mentions = groups[chatId]?.participants.map(p => p.id).slice(0, 200) || [];
            const pesan = text.replace(/!all/i, '').trim() || 'Tag semua';
            await sock.sendMessage(chatId, { text: `*${pesan}*\n\n${mentions.map(m => `@${m.split('@')[0]}`).join(' ')}`, mentions });
        }
    });
}
startBot();
