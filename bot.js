const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

const PHONE_NUMBER = '6283840825527'; // Nomor kamu

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Chrome', 'Windows', '10.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Step 1: Kasih link QR dulu buat unlock
        if (qr) {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            console.log('\n====================================');
            console.log('STEP 1: Buka link ini di HP & scan 1x');
            console.log(qrUrl);
            console.log('Scan -> Logout lagi dari WA -> Lanjut Step 2');
            console.log('====================================\n');
        }

        // Step 2: Minta kode pairing setelah 5 detik
        if (connection === 'connecting' &&!state.creds.registered) {
            await new Promise(r => setTimeout(r, 5000));
            try {
                const code = await sock.requestPairingCode(PHONE_NUMBER);
                console.log('====================================');
                console.log('STEP 2: WA > Setelan > Perangkat Tertaut');
                console.log('KODE PAIRING:', code.match(/.{1,4}/g).join("-"));
                console.log('Input dalam 20 detik!');
                console.log('====================================\n');
            } catch (e) {
                console.log('Gagal minta kode. Scan QR di atas dulu');
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

    // Fitur !all
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
