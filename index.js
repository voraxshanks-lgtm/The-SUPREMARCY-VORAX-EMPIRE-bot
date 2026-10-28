const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const P = require('pino')

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), browser: ["Vorax","Chrome","1.0"] })
    
    const NUMBER = "2250700000000" // CHANGE ICI TON NUMÉRO

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            const code = await sock.requestPairingCode(NUMBER)
            console.log(`\n🔥 CODE VORAX: ${code} 🔥\n`)
        }, 3000)
    }
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', ({connection}) => { if(connection==='open') console.log('🔥 VORAX EN LIGNE') })
    sock.ev.on('messages.upsert', async ({messages}) => {
        const m = messages[0]; if(!m.message) return
        const id = m.key.remoteJid; if(!id.endsWith('@g.us')) return
        const txt = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase().trim()
        if(txt==='!help') await sock.sendMessage(id,{text:'!rangs !exploits subaru !duel !kickall CONFIRMER'})
        if(txt==='!rangs') await sock.sendMessage(id,{text:'👑 SUPREMARCY\n⚔️ Subaru, Kaido, Nova - PRIME'})
        if(txt==='!duel') await sock.sendMessage(id,{text:'⚔️ Subaru VORAX gagne!'})
        if(txt.startsWith('!exploits')) await sock.sendMessage(id,{text:'⚔️ Subaru: Défense 4v8, Toujours présent'})
    })
}
start()
