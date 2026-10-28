const express = require('express');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const PORT = process.env.PORT || 3000;

let sock, stateStatus = 'Démarrage...', connectedSince = null, currentPairCode = null, codeExpire = 0, groupTotal = 0;
const authPath = path.join(__dirname, 'auth_info');

// CONFIG VORAX
let MODE = 'public'; // public ou private
let antiSpamEnabled = true;
let antiLinkEnabled = false;
const spamMap = new Map();
const muted = new Map();

async function startVorax() {
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), browser: ['Vorax Empire', 'Chrome', '20.0.0'] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') { stateStatus = 'Connecté'; connectedSince = Date.now(); currentPairCode = null; try{ const g = await sock.groupFetchAllParticipating(); groupTotal = Object.keys(g).length; }catch{} }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      stateStatus = 'Déconnecté'; connectedSince = null;
      if (shouldReconnect) setTimeout(startVorax, 3000);
      else { try{ fs.rmSync(authPath,{recursive:true,force:true}); }catch{} setTimeout(startVorax,2000); }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;
    const jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) return;
    const sender = m.key.participant || m.participant || jid;
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    const lower = text.toLowerCase();

    // Check admin
    let isGroupAdmin = false;
    try { const meta = await sock.groupMetadata(jid); const p = meta.participants.find(x=>x.id===sender); isGroupAdmin = p?.admin==='admin' || p?.admin==='superadmin'; } catch {}

    // --- COMMANDES ADMIN VORAX ---
    if (lower === '!mode private' && isGroupAdmin) { MODE='private'; return sock.sendMessage(jid,{text:'🔒 MODE PRIVÉ activé\nSeuls les admins peuvent utiliser le bot.'}); }
    if (lower === '!mode public' && isGroupAdmin) { MODE='public'; return sock.sendMessage(jid,{text:'🔓 MODE PUBLIC activé\nTout le monde peut utiliser le bot.'}); }
    if (lower === '!antispam on' && isGroupAdmin) { antiSpamEnabled=true; return sock.sendMessage(jid,{text:'✅ Anti-spam ON'}); }
    if (lower === '!antispam off' && isGroupAdmin) { antiSpamEnabled=false; return sock.sendMessage(jid,{text:'❌ Anti-spam OFF'}); }
    if (lower === '!antilink on' && isGroupAdmin) { antiLinkEnabled=true; return sock.sendMessage(jid,{text:'✅ Anti-lien ON'}); }
    if (lower === '!antilink off' && isGroupAdmin) { antiLinkEnabled=false; return sock.sendMessage(jid,{text:'❌ Anti-lien OFF'}); }

    // MODE PRIVE: bloque non-admins
    if (MODE === 'private' && !isGroupAdmin) return;

    // ANTI-SPAM
    if (antiSpamEnabled) {
      if (muted.has(sender) && Date.now() < muted.get(sender)) { try{ await sock.sendMessage(jid,{delete:m.key}); }catch{} return; }
      if (muted.has(sender)) muted.delete(sender);
      if (antiLinkEnabled && /(https?:\/\/|www\.|chat\.whatsapp)/i.test(text) && !isGroupAdmin) { try{ await sock.sendMessage(jid,{delete:m.key}); }catch{} return sock.sendMessage(jid,{text:`🚫 Lien interdit @${sender.split('@')[0]}`,mentions:[sender]}); }
      const now=Date.now(); if(!spamMap.has(sender)) spamMap.set(sender,[]); const times=spamMap.get(sender).filter(t=>now-t<10000); times.push(now); spamMap.set(sender,times);
      if(times.length>=5){ muted.set(sender,now+5*60*1000); spamMap.delete(sender); return sock.sendMessage(jid,{text:`🤫 @${sender.split('@')[0]} mute 5min pour spam`,mentions:[sender]}); }
    }

    // COMMANDES PUBLIC
    if (lower === '!help' || lower === '!menu') {
      await sock.sendMessage(jid,{text:`👑 *VORAX EMPIRE* 👑\nMode: ${MODE.toUpperCase()}\n\n*Public:*\n!help - Menu\n!rangs - Rangs\n!ping - Bot?\n\n*Admin seulement:*\n!mode private/public\n!antispam on/off\n!antilink on/off`});
    }
    if (lower === '!rangs') await sock.sendMessage(jid,{text:`🏆 RANKS VORAX\n👑 EMPEREUR: SUPREMARCY\n👑 Sous-Empereur: Subaru\n⚔️ Chevalier: Aizen`});
    if (lower === '!ping') await sock.sendMessage(jid,{text:`⚡ VORAX EN LIGNE | Mode ${MODE} | ${groupTotal} groupes`});
  });
}
startVorax();

app.get('/api/status', (req,res)=>{ res.json({status:stateStatus,connected:stateStatus==='Connecté',uptime:connectedSince?Math.floor((Date.now()-connectedSince)/1000):0,groups:groupTotal,mode:MODE}); });
app.get('/', (req,res)=>{
  const codeVisible = currentPairCode && Date.now() < codeExpire ? currentPairCode : null;
  res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>VORAX</title><style>body{background:#000;color:#fff;font-family:sans-serif;display:flex;justify-content:center;padding:20px} .box{max-width:500px;width:100%;background:#111;border:1px solid gold;border-radius:20px;padding:25px;text-align:center} h1{color:gold} input{width:100%;padding:15px;border-radius:10px;border:1px solid #333;background:#222;color:#fff;margin-top:10px} button{width:100%;padding:15px;margin-top:10px;background:gold;color:#000;font-weight:900;border:none;border-radius:10px} .code{margin-top:20px;border:2px dashed gold;padding:15px;border-radius:12px;font-size:32px;color:gold;letter-spacing:4px} #status{margin:15px 0;padding:10px;background:#222;border-radius:10px}</style></head><body><div class="box"><h1>👑 VORAX EMPIRE</h1><div id="status">Chargement...</div><form method="POST" action="/pair"><input name="number" placeholder="2250700000000" required><button>OBTENIR CODE</button></form>${codeVisible?`<div class="code">${codeVisible}</div><p style="color:#0f0">Valide 60s</p>`:`<p style="color:#888">Entre numéro sans +</p>`}<p style="margin-top:20px"><a href="/reset" style="color:#666;font-size:12px">Reset</a></p></div><script>async function refresh(){const r=await fetch('/api/status');const d=await r.json();document.getElementById('status').innerHTML=d.status+' | Mode:'+d.mode+' | '+d.groups+' groupes';}refresh();setInterval(refresh,3000);</script></body></html>`);
});
app.post('/pair', async (req,res)=>{
  try{ let num=req.body.number.replace(/\D/g,''); if(!sock) throw new Error('Bot non prêt'); const code=await sock.requestPairingCode(num); currentPairCode=code; codeExpire=Date.now()+60000; res.redirect('/'); }catch(e){ res.send(`<h2>Erreur: ${e.message}</h2><a href="/">Retour</a>`); }
});
app.get('/reset', (req,res)=>{ try{ fs.rmSync(authPath,{recursive:true,force:true}); }catch{} res.redirect('/'); });
app.listen(PORT, ()=>console.log('VORAX FINAL LIVE'));
