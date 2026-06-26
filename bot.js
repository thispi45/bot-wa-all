const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

const PHONE_NUMBER = '6283840825527'; // Nomor kamu

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'info' }), // ganti ke info biar keliatan log
        browser: ['Chrome', 'Windows', '10.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            console.log('\nSTEP 1: Scan QR ini 1x -> Logout -> Lanjut Step 2');
            console.log(qrUrl + '\n');
        }

        if (connection === 'connecting' &&!state.creds.registered) {
            await new Promise(r => setTimeout(r, 5000));
            try {
                const code = await sock.requestPairingCode(PHONE_NUMBER);
                console.log('STEP 2: KODE PAIRING:', code.match(/.{1,4}/g).join("-"));
            } catch (e) {
                console.log('Gagal minta kode. Scan QR dulu');
            }
        }

        if (connection === 'open') {
            console.log('✅ Bot berhasil terhubung ke WhatsApp\n');
        }

        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            console.log('❌ Disconnect Code:', code);
            if (code !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000);
            } else {
                fs.rmSync('auth_info', { recursive: true, force: true });
                console.log('🔄 Auth dihapus. Redeploy untuk kode baru');
            }
        }
    });

    // Fitur !all + debug
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation 
                  || msg.message.extendedTextMessage?.text 
                  || msg.message.imageMessage?.caption 
                  || '';
        const chatId = msg.key.remoteJid;

        console.log(`[PESAN] ${text} | [CHAT] ${chatId}`);

        if (text.toLowerCase().startsWith('!all') && chatId.endsWith('@g.us')) {
            console.log('[DEBUG] Deteksi perintah !all');
            try {
                const metadata = await sock.groupMetadata(chatId);
                const mentions = metadata.participants.map(p => p.id);
                const pesan = text.replace(/!all/i, '').trim() || 'Perhatian semua!';

                await sock.sendMessage(chatId, {
                    text: `*${pesan}*\n\n` + mentions.map(m => `@${m.split('@')[0]}`).join(' '),
                    mentions
                });
                console.log('[DEBUG] Berhasil kirim tag all');
            } catch (err) {
                console.log('[ERROR !all]', err);
            }
        }
    });
}
startBot();
