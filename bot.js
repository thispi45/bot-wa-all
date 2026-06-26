global.crypto = require('crypto'); // <-- INI KUNCI NYA, taruh paling atas
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

const fs = require('fs');
if (fs.existsSync('./auth_info')) fs.rmSync('./auth_info', { recursive: true, force: true });
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'info' }),
        browser: ['Railway Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('Bot siap & terhubung ke WhatsApp');
        }
        if (connection === 'close') {
            startBot();
        }
    });

    if (!state.creds.registered) {
        await new Promise(r => setTimeout(r, 3000));
        const phoneNumber = '6283840825527'; // GANTI DENGAN NOMOR KAMU +62
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('KODE PAIRING:', code.match(/.{1,4}/g).join("-"));
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
