const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!from.endsWith('@g.us')) return;

        const groupMetadata = await sock.groupMetadata(from);
        const admins = groupMetadata.participants
          .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
          .map(p => p.id);

        const isAdmin = admins.includes(sender);

        // Command:!all pesan apa saja
        if (text.toLowerCase().startsWith('!all')) {
            if (!isAdmin) {
                return sock.sendMessage(from, { text: '❌ Command ini khusus admin grup.' }, { quoted: msg });
            }

            const members = groupMetadata.participants.map(p => p.id);

            // Ambil pesan setelah "!all "
            const customMsg = text.slice(4).trim();
            const pesan = customMsg
               ? `📢 *Pemberitahuan dari Admin* 📢\n\n${customMsg}\n\n${members.map(jid => `@${jid.split('@')[0]}`).join(' ')}`
                : `📢 *Panggilan untuk semua member* 📢\n\n${members.map(jid => `@${jid.split('@')[0]}`).join(' ')}`;

            await sock.sendMessage(from, {
                text: pesan,
                mentions: members
            }, { quoted: msg });
        }

        if (text.toLowerCase() === '!menu') {
            let menu = `*Menu Bot Grup*\n\n`;
            menu += `!all [pesan] - Tag semua member + pesan custom [Khusus Admin]\n`;
            menu += `Contoh:!all Rapat jam 20.00 malam ini\n`;
            menu += `!menu - Lihat menu ini`;
            await sock.sendMessage(from, { text: menu }, { quoted: msg });
        }
    });

    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('Bot sudah online');
    });
}

startBot();