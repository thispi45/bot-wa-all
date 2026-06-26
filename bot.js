const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

const PHONE_NUMBER = '6283840825527'; // Ganti nomor kamu

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'info' }),
        browser: ['Chrome', 'Windows', '10.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            console.log('\nSTEP 1: Scan QR ini 1x -> Logout -> Lanjut Step 2');
            console.log(qrUrl + '\n');
        }

        if (connection === 'connecting' && !state.creds.registered) {
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
                console.log('🔄 Reconnect 5 detik lagi...');
                setTimeout(() => startBot(), 5000);
            } else {
                fs.rmSync('auth_info', { recursive: true, force: true });
                console.log('🔄 Auth dihapus. Redeploy untuk kode baru');
            }
        }
    });

    // Fitur !all - versi anti timeout 408
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation
                  || msg.message.extendedTextMessage?.text
                  || msg.message.imageMessage?.caption
                  || '';
        const chatId = msg.key.remoteJid;

        console.log(`[PESAN] ${text} | ${chatId}`);

        if (text.toLowerCase().startsWith('!all') && chatId.endsWith('@g.us')) {
            console.log('[DEBUG] Deteksi perintah !all');
            try {
                // Pakai cache grup biar gak timeout
                const groups = await sock.groupFetchAllParticipating();
                const metadata = groups[chatId];

                if (!metadata) throw new Error('Data grup tidak ditemukan');

                const mentions = metadata.participants.map(p => p.id);
                const pesan = text.replace(/!all/i, '').trim() || 'Perhatian semua!';

                await sock.sendMessage(chatId, {
                    text: `*${pesan}*\n\n` + mentions.map(m => `@${m.split('@')[0]}`).join(' '),
                    mentions
                });
                console.log('[DEBUG] Berhasil kirim tag all');

            } catch (err) {
                console.log('[ERROR !all]', err.message);
                await sock.sendMessage(chatId, { 
                    text: `Gagal tag semua: ${err.message}. Coba lagi.` 
                });
            }
        }
    });
}

startBot();
