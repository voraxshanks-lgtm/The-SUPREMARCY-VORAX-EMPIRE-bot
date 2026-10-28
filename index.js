
const express = require("express");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_DIR = path.join(__dirname, "auth");

app.use(express.json({ limit: "10kb" }));

let sock = null;
let connected = false;
let starting = false;
let reconnecting = false;
let registered = false;
let groupCount = 0;
let lastError = null;
let pairBusy = false;
let lastPairTime = 0;
let lastConnectTime = null;

const processedMessages = new Set();
const commandCooldown = new Map();

function getStatus() {
  return {
    name: "THE SUPREMARCY VORAX EMPIRE",
    connected,
    devicesConnected: connected ? 1 : 0,
    groups: groupCount,
    registered,
    lastConnectTime,
    lastError
  };
}

async function createSock() {
  if (starting || connected) return;
  starting = true;

  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });

    const { state, saveCreds } =
      await useMultiFileAuthState(AUTH_DIR);

    registered = state.creds.registered === true;

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      browser: ["VORAX EMPIRE", "Chrome", "1.0.0"],
      markOnlineOnConnect: false,
      syncFullHistory: false
    });

    sock.ev.on("creds.update", async () => {
      await saveCreds();
      registered = state.creds.registered === true;
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        connected = true;
        starting = false;
        reconnecting = false;
        registered = true;
        lastConnectTime = new Date().toISOString();
        lastError = null;

        try {
          const groups = await sock.groupFetchAllParticipating();
          groupCount = Object.keys(groups).length;
        } catch (error) {
          console.error("Erreur de lecture des groupes.");
        }

        console.log("👑 VORAX EMPIRE connecté !");
      }

      if (connection === "close") {
        connected = false;
        starting = false;

        const code =
          lastDisconnect?.error?.output?.statusCode;

        sock = null;

        if (code === DisconnectReason.loggedOut) {
          lastError =
            "Session déconnectée. Supprime l'ancienne session uniquement si nécessaire, puis relie WhatsApp.";
          registered = false;
          console.log(lastError);
          return;
        }

        if (!reconnecting) {
          reconnecting = true;

          setTimeout(() => {
            reconnecting = false;
            createSock().catch(console.error);
          }, 5000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify" || !connected) return;

      for (const msg of messages) {
        try {
          await handleMessage(msg);
        } catch (error) {
          console.error("Erreur commande :", error.message);
        }
      }
    });
  } catch (error) {
    starting = false;
    lastError = error.message;
    console.error("Erreur de démarrage :", error.message);
  }
}

async function handleMessage(msg) {
  if (!msg.message || msg.key.fromMe) return;

  const jid = msg.key.remoteJid;

  if (!jid || jid === "status@broadcast") return;

  const id = msg.key.id;

  if (!id || processedMessages.has(id)) return;

  processedMessages.add(id);

  if (processedMessages.size > 2000) {
    processedMessages.clear();
  }

  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    "";

  if (!text.trim().startsWith("!")) return;

  const sender = msg.key.participant || jid;
  const now = Date.now();
  const last = commandCooldown.get(sender) || 0;

  if (now - last < 1200) return;

  commandCooldown.set(sender, now);

  const cmd = text.trim().split(/\s+/)[0].toLowerCase();

  const commands = {
    "!help":
      "👑 *VORAX EMPIRE — COMMANDES*\n\n" +
      "!help — Afficher les commandes\n" +
      "!bot — État du bot\n" +
      "!rangs — Les rangs du clan\n" +
      "!exploits — Les exploits des membres\n" +
      "!duel — Règles du duel amical\n" +
      "!empire — Message officiel",

    "!bot":
      "👑 *THE SUPREMARCY VORAX EMPIRE*\n\n" +
      "Statut : EN LIGNE 🟢\n" +
      `Groupes connus : ${groupCount}\n` +
      "Version : 1.0.0\n" +
      "Utilise !help pour les commandes.",

    "!rangs":
      "👑 *RANGS VORAX*\n\n" +
      "1. Supreme Leader\n" +
      "2. Conseil impérial\n" +
      "3. Officiers\n" +
      "4. Membres\n" +
      "5. Candidats\n\n" +
      "Les rangs sont attribués par le clan.",

    "!exploits":
      "🏆 *VORAX MUSEUM*\n\n" +
      "Les exploits des membres méritants peuvent être " +
      "présentés dans le musée après vérification.",

    "!duel":
      "⚔️ *DUEL AMICAL VORAX*\n\n" +
      "Deux membres volontaires peuvent organiser un duel " +
      "en respectant les règles convenues ensemble.",

    "!empire":
      "♛ THE SUPREMARCY VORAX EMPIRE ♛\n\n" +
      "Discipline. Loyauté. Excellence.\n" +
      "L'union fait la force."
  };

  if (commands[cmd]) {
    await sock.sendMessage(jid, {
      text: commands[cmd]
    });
  }
}

// Tableau de bord
app.get("/", (req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VORAX EMPIRE BOT</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#080808;color:#eee;
font-family:Arial,sans-serif;padding:22px}
main{max-width:650px;margin:auto}
h1{color:#d8b45a;letter-spacing:2px}
.card{background:#151515;border:1px solid #493d20;
border-radius:14px;padding:20px;margin:16px 0}
.label{color:#aaa;font-size:14px}
.value{font-size:24px;font-weight:bold;margin-top:9px}
.gold{color:#d8b45a}
input,button{width:100%;padding:13px;margin-top:10px;
border-radius:8px;border:1px solid #66552a}
input{background:#090909;color:white}
button{background:#c5a24c;color:#090909;
font-weight:bold;cursor:pointer}
small{color:#aaa;line-height:1.6}
</style>
</head>
<body>
<main>
<h1>♛ VORAX EMPIRE</h1>
<p>WhatsApp Bot Control Center</p>

<div class="card">
<div class="label">État du bot</div>
<div class="value" id="status">Chargement...</div>
</div>

<div class="card">
<div class="label">Sessions de bot connectées</div>
<div class="value gold" id="devices">—</div>
<small>Nombre de sessions de bot actives sur ce serveur,
pas le nombre total d'appareils liés à WhatsApp.</small>
</div>

<div class="card">
<div class="label">Groupes connus</div>
<div class="value" id="groups">—</div>
</div>

<div class="card">
<div class="label">Connexion WhatsApp</div>
<input id="phone" type="tel"
placeholder="Numéro international, chiffres uniquement">
<button onclick="pair()">Obtenir le code de liaison</button>
<p id="result"></p>
<small>Garde ton code de liaison secret. Ne le partage
avec personne.</small>
</div>

<div class="card">
<div class="label">Commandes du bot</div>
<p>!help · !bot · !rangs · !exploits · !duel · !empire</p>
</div>
</main>

<script>
async function refresh(){
  try{
    const r = await fetch('/api/status');
    const d = await r.json();

    document.getElementById('status').textContent =
      d.connected ? 'EN LIGNE 🟢' : 'HORS LIGNE 🔴';

    document.getElementById('devices').textContent =
      d.devicesConnected;

    document.getElementById('groups').textContent =
      d.groups;
  }catch(e){
    document.getElementById('status').textContent =
      'Serveur indisponible';
  }
}

async function pair(){
  const result = document.getElementById('result');
  const phone = document.getElementById('phone').value;

  result.textContent = 'Demande en cours...';

  try{
    const r = await fetch('/api/pair',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({phone})
    });

    const d = await r.json();

    result.textContent = d.code
      ? 'Code de liaison : ' + d.code
      : (d.error || 'Échec de la demande.');
  }catch(e){
    result.textContent = 'Erreur de connexion au serveur.';
  }
}

refresh();
setInterval(refresh,5000);
</script>
</body>
</html>`);
});

app.get("/api/status", (req, res) => {
  res.json(getStatus());
});

// Liaison sans mode administrateur
app.post("/api/pair", async (req, res) => {
  if (pairBusy) {
    return res.status(429).json({
      error: "Une demande de liaison est déjà en cours."
    });
  }

  if (Date.now() - lastPairTime < 60000) {
    return res.status(429).json({
      error: "Attends une minute avant une nouvelle demande."
    });
  }

  const phone = String(req.body.phone || "").replace(/\D/g, "");

  if (!/^\d{8,15}$/.test(phone)) {
    return res.status(400).json({
      error: "Numéro international invalide."
    });
  }

  if (registered || connected) {
    return res.status(409).json({
      error: "Une session est déjà enregistrée ou connectée."
    });
  }

  if (!sock || starting) {
    return res.status(503).json({
      error: "Le bot démarre. Attends quelques secondes et réessaie."
    });
  }

  pairBusy = true;
  lastPairTime = Date.now();

  try {
    const code = await sock.requestPairingCode(phone);
    res.json({ code });
  } catch (error) {
    console.error("Erreur de liaison :", error.message);
    res.status(500).json({
      error: "Impossible de générer le code. Consulte les journaux Render."
    });
  } finally {
    pairBusy = false;
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("👑 VORAX EMPIRE lancé sur le port " + PORT);
  createSock();
});
