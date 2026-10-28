// FIX RENDER - garde le port ouvert
const http = require('http')
http.createServer((req,res)=>res.end('VORAX BOT EN LIGNE 🔥')).listen(process.env.PORT || 3000)

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const P = require('pino')

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ 
        auth: state, 
        logger: P({ level: 'silent' }), 
        browser: ["Vorax Empire", "Chrome", "1.0"] 
    })
    
    const NUMBER = "2250700000000" // CHANGE ICI TON NUMÉRO SANS +

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(NUMBER)
                console.log(`\n🔥 CODE VORAX: ${code} 🔥\nVa dans WhatsApp > Appareils liés > Lier avec numéro\n`)
            } catch(e){ console.log(e.message) }
        }, 5000)
    }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', ({connection}) => {
        if(connection==='open') console.log('🔥 VORAX BOT EN LIGNE - !help')
        if(connection==='close') console.log('Reconnexion...')
    })

    sock.ev.on('messages.upsert', async ({messages}) => {
        const m = messages[0]
        if(!m.message || m.key.fromMe) return
        const id = m.key.remoteJid
        if(!id.endsWith('@g.us')) return

        const txt = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase().trim()

        if(txt==='!help') await sock.sendMessage(id,{text:'📜 VORAX:\n!rangs\n!exploits subaru\n!duel\n!kickall CONFIRMER'})
        if(txt==='!rangs') await sock.sendMessage(id,{text:'👑 EMPEREUR: SUPREMARCY\n⚔️ PRIME: Subaru, Kaido, Nova'})
        if(txt.startsWith('!exploits')) await sock.sendMessage(id,{text:'⚔️ Subaru VORAX\n✦ Toujours présent\n✦ Défense 4v8\n✦ Bras droit Empire'})
        if(txt==='!duel') await sock.sendMessage(id,{text:'⚔️ DUEL - Subaru VORAX gagne par K.O!'})
    })
}

start()
