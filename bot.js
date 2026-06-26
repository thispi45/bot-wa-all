const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const PHONE = '6283840825527'; // Ganti nomormu

async function startBot() {
    try {
        if (!fs.existsSync('auth_info')) fs.mkdirSync('auth_info');
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: ['Chrome (Linux)', '', ''],
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
        });

        sock.ev.on('creds.update', saveCreds);

        if (!state.creds.registered) {
            await new Promise(r => setTimeout(r, 10000));
            try {
                const code = await sock.requestPairingCode(PHONE);
                console.log('\nPAIRING CODE:', code.match(/.{1,4}/g).join("-"));
            } catch (e) {
                console.log('GAGAL REQUEST KODE:', e.message);
            }
        }

        sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
            if (connection === 'open') console.log('✅ Bot terhubung');
            if (connection === 'close') {
                const code = lastDisconnect.error?.output?.statusCode;
                if (code === DisconnectReason.loggedOut) process.exit(1);
                else setTimeout(startBot, 5000);
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
                await sock.sendMessage(chatId, {
                    text: `*${text.replace(/!all/i, '').trim() || 'Tag' }*\n\n${mentions.map(m => `@${m.split('@')[0]}`).join(' ')}`,
                    mentions
                });
            }
        });
    } catch (err) {
        console.error('FATAL:', err);
        process.exit(1);
    }
}
startBot();
