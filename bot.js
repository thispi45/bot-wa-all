const crypto = require('crypto'); // WAJIB PALING ATAS
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

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
        if(connection === 'open') console.log('Bot siap & terhubung ke WhatsApp');
        if(connection === 'close') startBot();
    });

    if (!state.creds.registered) {
        await new Promise(r => setTimeout(r, 3000));
        const phoneNumber = '6283840825527'; // GANTI DENGAN NOMORMU
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('KODE PAIRING:', code.match(/.{1,4}/g).join("-"));
    }
}
startBot();
