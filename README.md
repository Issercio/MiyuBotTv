# MiyuBot

Bot **Discord** (sécurité + modération, commandes `/`) et **Twitch** (chat `!`).

**Prod :** une seule instance, sur **Fly.io** (`miyubottv`).  
Ne lance **jamais** `npm start` / PM2 sur un PC tant que Fly tourne : les commandes se doublent.

Health : `https://miyubottv.fly.dev/health`

---

## Discord — commandes importantes

Tape `/` dans Discord (plus de `!`).

| Commande | Rôle |
|---|---|
| `/ping` `/help` `/userinfo` | Test et aide |
| `/securitylogs create` | Crée `#🔐・miyubot-logs` + preset ~50 membres |
| `/securitylogs info` / `test` | Vérifie les logs |
| `/setupcheck` | Checklist permissions / rôle |
| `/config parametres:show` | Voir la sécu |
| `/ban` `/kick` `/timeout` `/warn` | Modération |
| `/lockdown` `/unlock` | Lock serveur |
| `/whitelist` `/antinuke` | Anti-nuke |
| `/cases` | Dossiers de sanction |

Autres : `/unban` `/softban` `/untimeout` `/warnings` `/nick` `/purge` `/slowmode` `/syncmembers`

**Logs (salon miyubot-logs) :** join serveur, invitations, messages edit/delete, vocal join / move / leave (et move/déco par un modo).

**Nouveau serveur Discord**
1. Invite avec `bot` + `applications.commands` (idéalement Administrateur, ou au minimum : messages, embeds, kick/ban/timeout, salons/rôles, logs d’audit, gérer le serveur).
2. Intents portail : **Server Members** + **Message Content**.
3. Rôle MiyuBot **au-dessus** des membres à modérer.
4. `/securitylogs create` puis ouvrir **#miyubot-logs** (pas le général).

Preset `/securitylogs create` : anti-raid, anti-spam, anti-nuke, kick des comptes de moins de **30 jours**.

---

## Twitch — commandes importantes

Le bot doit être **modérateur** de la chaîne.

| Commande | Rôle |
|---|---|
| `!ping` `!help` | Test |
| `!uptime` `!title` `!game` | Live (Helix) |
| `!discord` | Invite Kitsunara |
| `!socials` | https://sociallinks.edgeone.dev |
| `!so pseudo` | Shoutout (modos) |
| `!permit` `!timeout` `!ban` | Modo chat |
| `!slow` / `!slowoff` `!clear` | Salon |

Autres modos : `!unban` `!followers` `!emoteonly` `!cmd add/remove/list`

**Auto :** alerte ~30 s avant une **pub Twitch** (si `TWITCH_ADS_TOKEN` est valide).  
Automod viewers : spam, caps, liens (clips/YouTube OK). Les modos sont ignorés.

---

## Secrets Fly (minimum)

```text
DISCORD_TOKEN
TWITCH_ENABLED=true
TWITCH_USERNAME
TWITCH_OAUTH_TOKEN          (chat bot, oauth:…)
TWITCH_CHANNEL
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
TWITCH_ADS_TOKEN            (token du STREAMER, scope channel:read:ads)
TWITCH_DISCORD_LIVE_CHANNEL_ID   (optionnel, annonce live Discord)
TWITCH_DISCORD_INVITE            (optionnel, sinon invite Kitsunara par défaut)
```

Après un changement de code : **Deploy** sur Fly (branche `main`).

---

## Limites à connaître

- SQLite est **réinitialisée à chaque Deploy** Fly (warns, cases, whitelist, config). Le salon `miyubot-logs` est **retrouvé tout seul** par son nom.
- `TWITCH_ADS_TOKEN` **expire** : il faudra le régénérer un jour (ou brancher un refresh token).
- Une instance seulement.

---

## Local (debug uniquement, Fly arrêté)

```bash
npm install
cp .env.example .env
npm start
```

Tests : `npm test`

---

## Prêt à lancer ?

**Discord — oui**, pour un autre serveur, si : rôle en haut, intents OK, `/securitylogs create`, une seule instance Fly.

**Twitch — oui** pour le chat (`!discord`, `!socials`, `!so`, Helix), si le bot est modo et Helix configuré.

**Pubs auto — oui seulement** tant que `TWITCH_ADS_TOKEN` est encore valide et que Fly a bien été déployé avec ce secret.
