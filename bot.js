const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const PHONE = '6283840825527'; // Nomor kamu

async function startBot() {
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
        console.log('Menunggu 10 detik sebelum request kode...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        try {
            const code = await sock.requestPairingCode(PHONE);
            console.log('\n====================================');
            console.log('PAIRING CODE:', code.match(/.{1,4}/g).join("-"));
            console.log('Buka WA > Perangkat Tertaut > Tautkan');
            console.log('====================================\n');
        } catch (e) {
            console.log('Gagal request kode:', e.message);
        }
    }

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'open') console.log('✅ Bot terhubung');
        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            console.log('❌ Disconnect:', code);
            if (code === 405) {
                console.log('IP/Nomor Keban. Stop deploy 30 menit');
                process.exit(1);
            } else if (code!== DisconnectReason.loggedOut) { // <-- ini yg aku fix
                setTimeout(startBot, 5000);
            }
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
}
startBot();            const code = lastDisconnect.error?.output?.statusCode;
            console.log('❌ Disconnect:', code);
            if (code === 405) {
                console.log('IP/Num Keban. Stop deploy 30 menit');
                process.exit(1);
            } else if (code!== DisconnectReason.loggedOut) {
                setTimeout(startBot, 5000);
            }
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
}
startBot();    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const chatId = msg.key.remoteJid;

        if (text.toLowerCase().startsWith('!all') && chatId.endsWith('@g.us')) {
            try {
                const groups = await sock.groupFetchAllParticipating();
                const mentions = groups[chatId]?.participants.map(p => p.id).slice(0, 200) || [];
                const pesan = text.replace(/!all/i, '').trim() || 'Perhatian semua!';
                await sock.sendMessage(chatId, { 
                    text: `*${pesan}*\n\n${mentions.map(m => `@${m.split('@')[0]}`).join(' ')}`, 
                    mentions 
                });
                console.log('[DEBUG] Tag berhasil');
            } catch (err) {
                console.log('[ERROR!all]', err.message);
            }
        }
    });
}

startBot();
