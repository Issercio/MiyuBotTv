# MiyuBot

MiyuBot est un bot de sécurité Discord + Twitch.

**Important :** PM2 sur ton PC ne suffit pas. Si tu éteins l’ordinateur, le bot s’arrête. Pour du 24/7, il doit tourner sur un serveur distant (VPS ou Fly.io / Railway).

## Installation

```bash
npm install
```

Copie `.env.example` vers `.env` puis renseigne les valeurs.

Obligatoire :
- `DISCORD_TOKEN`

Twitch :
- `TWITCH_ENABLED=true`
- `TWITCH_USERNAME`
- `TWITCH_OAUTH_TOKEN` (token chat, format `oauth:...`)
- `TWITCH_CHANNEL`

Helix (recommandé pour un Twitch pro : uptime, titre, jeu, shoutout, annonce live) :
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

Crée une app sur https://dev.twitch.tv/console/apps puis mets le bot en **modérateur** de la chaîne.

Si Twitch est désactivé, Discord continue de fonctionner.

## Lancement local

```bash
npm start
```

Healthcheck : `http://localhost:3000/health`

## 24/7 sans PC allumé

Choisis **une** option. Une seule instance à la fois (pas PC + serveur).

### Option A — VPS (OVH, Hetzner, Contabo)

Sur le serveur Linux :

```bash
sudo apt update
sudo apt install -y git nodejs npm
sudo npm install -g pm2
git clone <ton-repo> MiyuBot
cd MiyuBot
npm install --omit=dev
cp .env.example .env
nano .env
npm run pm2:start
pm2 save
pm2 startup
```

Exécute ensuite la commande affichée par `pm2 startup`.

Le bot survit aux déconnexions SSH et aux redémarrages du VPS. Ton PC peut rester éteint.

### Option B — Fly.io

```bash
npm i -g flyctl
fly auth login
fly launch
fly secrets set DISCORD_TOKEN=... TWITCH_ENABLED=true TWITCH_USERNAME=... TWITCH_OAUTH_TOKEN=... TWITCH_CHANNEL=... TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=...
fly deploy
```

`fly.toml` est déjà configuré pour **ne pas** éteindre la machine (`auto_stop_machines = "off"`).

### Option C — Railway

1. New Project → Deploy from GitHub (ou Docker).
2. Variables : copie celles de `.env.example`.
3. Railway fournit `PORT` automatiquement.

Évite les plans gratuits qui mettent le process en sommeil : le bot Twitch doit rester connecté en IRC.

## Twitch — commandes

Publiques :
- `!ping` `!help` `!uptime` `!title` `!game` `!socials` `!discord`

Modos / broadcaster :
- `!so pseudo`
- `!permit pseudo [secondes]`
- `!timeout pseudo [secondes] [raison]`
- `!ban` `!unban` `!clear`
- `!slow` `!slowoff` `!followers` `!followersoff`
- `!emoteonly` `!emoteonlyoff`
- `!cmd add nom réponse`
- `!cmd remove nom`
- `!cmd list`

Automod (viewers) : spam, répétitions, caps, liens (clips/YouTube autorisés). Les modos sont ignorés.

Annonce live Discord : `TWITCH_DISCORD_LIVE_CHANNEL_ID` + Helix.

Alerte pubs auto (30s avant) : secret Fly `TWITCH_ADS_TOKEN` = token **du streamer** avec le scope `channel:read:ads`. En live, MiyuBot envoie : `Votre attention : dans 30s une pub automatique va se lancer. Merci pour votre soutien !`

## Discord — vérif production

```text
!setupcheck
!config show
!securitylogs test
!cases recent 10
```

## Sécurité

- Ne commit jamais `.env`.
- Régénère un token exposé.
- Une seule instance du bot.
- Place le rôle Discord du bot au-dessus des membres à modérer.
