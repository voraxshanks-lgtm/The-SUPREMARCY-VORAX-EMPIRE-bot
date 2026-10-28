const express = require('express')
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const P = require('pino')

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

let sock
let lastCode = "Pas encore généré"

async function initSock() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), browser: ["Vorax Empire", "Chrome", "1.0"] })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', ({connection}) => {
        if(connection==='open') console.log('🔥 VORAX CONNECTÉ')
    })

    sock.ev.on('messages.upsert', async ({messages}) => {
        const m = messages[0]
        if(!m.message || m.key.fromMe) return
        const id = m.key.remoteJid
        if(!id.endsWith('@g.us')) return
        const txt = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase().trim()
        if(txt==='!help') await sock.sendMessage(id,{text:'📜 VORAX:\n!rangs\n!exploits subaru\n!duel'})
        if(txt==='!rangs') await sock.sendMessage(id,{text:'👑 EMPEREUR: SUPREMARCY'})
        if(txt==='!duel') await sock.sendMessage(id,{text:'⚔️ Subaru VORAX gagne!'})
    })
}
initSock()

// PAGE WEB
app.get('/', (req,res)=>{
    res.send(`
    <html><head><title>VORAX EMPIRE</title>
    <style>body{background:#000;color:#FFD700;text-align:center;font-family:Arial;padding:40px}input{padding:15px;width:250px;font-size:18px;border-radius:10px}button{padding:15px 30px;background:gold;color:black;font-weight:bold;border:none;border-radius:10px;margin-top:15px;font-size:18px} .code{font-size:40px;margin:20px;background:#111;padding:20px;border:2px solid gold}</style>
    </head><body>
    <h1>🔥 VORAX EMPIRE BOT 🔥</h1>
    <h3>Connecte ton WhatsApp</h3>
    <form action="/code" method="POST">
    <input name="number" placeholder="2250700000000 sans +" required><br>
    <button>OBTENIR CODE</button>
    </form>
    <div class="code">${lastCode}</div>
    <p>1. Entre ton numéro<br>2. Copie le code<br>3. WhatsApp > Appareils liés > Lier avec numéro</p>
    </body></html>
    `)
})

app.post('/code', async (req,res)=>{
    try{
        const num = req.body.number.replace(/[^0-9]/g,'')
        if(!sock) return res.send("Bot pas prêt, réessaie 5 sec")
        const code = await sock.requestPairingCode(num)
        lastCode = code
        console.log("CODE POUR "+num+" : "+code)
        res.redirect('/')
    }catch(e){ res.send("Erreur: "+e.message) }
})

app.listen(process.env.PORT || 3000, ()=>console.log("WEB VORAX LANCÉ"))
