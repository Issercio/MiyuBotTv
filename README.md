# MiyuBot

Bot **Discord** (sécurité + modération, commandes `/`) et **Twitch** (chat `!`).

Une seule instance en production. Ne lance pas `npm start` en local tant que le bot tourne déjà (Fly, PC, etc.) : les commandes se doublent.

---

## 1. Copier la config (sans valeurs personnelles)

```bash
npm install
cp .env.example .env
```

Remplis **ton** `.env`. Ne commite jamais `.env`.

---

## 2. Discord

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application → Bot.
2. Copie le token → `DISCORD_TOKEN`.
3. Onglet Bot → intents : **Server Members** + **Message Content**.
4. Invite avec `bot` + `applications.commands` (Administrateur, ou au minimum : messages, embeds, kick/ban/timeout, salons, rôles, logs d’audit, gérer le serveur).
5. Place le rôle du bot **au-dessus** des membres à modérer.
6. Sur le serveur : `/securitylogs create`, puis ouvre le salon **miyubot-logs**.

---

## 3. Twitch

| Variable | Qui | Quoi |
|---|---|---|
| `TWITCH_USERNAME` | compte **bot** | login IRC (minuscules) |
| `TWITCH_OAUTH_TOKEN` | compte **bot** | token chat, forme `oauth:...` (`chat:read` + `chat:edit`) |
| `TWITCH_CHANNEL` | ta **chaîne** | login sans `https://twitch.tv/` |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | app Twitch | Helix (`!uptime`, `!title`, `!game`, `!so`) |
| `TWITCH_ADS_TOKEN` | compte **streamer** | alerte pubs, scope `channel:read:ads` (pas le token IRC du bot) |
| `TWITCH_CLIPS_TOKEN` | compte **streamer** (ou éditeur) | `!clip`, scope `clips:edit`. Peut réutiliser le token pubs si le scope est ajouté |

Le bot doit être **modérateur** de la chaîne.

Optionnel :

| Variable | Rôle |
|---|---|
| `TWITCH_DISCORD_INVITE` | lien envoyé par `!discord` |
| `TWITCH_SOCIALS_URL` | lien envoyé par `!socials` |
| `TWITCH_DISCORD_LIVE_CHANNEL_ID` | salon Discord pour l’annonce live |
| `TWITCH_DISABLED_COMMANDS` | doublons à laisser à un autre bot (ex. WizeBot). Garder `so`, `discord`, `socials` sur MiyuBot |
| `TWITCH_CLIPS_TOKEN` | token streamer/éditeur `clips:edit` pour `!clip` |

En tchat partagé, MiyuBot ignore les commandes et liens venant des autres chaînes. Les réponses (`!discord`, etc.) partent en **visible uniquement sur ta chaîne** (Helix `for_source_only`), comme WizeBot. Ça demande `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` et le scope `user:write:chat` sur le token d’app du bot.

---

## 4. Secrets Fly (à remplir toi-même)

Ne copie pas d’exemple déjà rempli. Dans Fly → Secrets :

```text
DISCORD_TOKEN=
TWITCH_ENABLED=true
TWITCH_USERNAME=
TWITCH_OAUTH_TOKEN=
TWITCH_CHANNEL=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_ADS_TOKEN=
TWITCH_CLIPS_TOKEN=
TWITCH_DISCORD_LIVE_CHANNEL_ID=
TWITCH_DISCORD_INVITE=
TWITCH_SOCIALS_URL=
TWITCH_DISABLED_COMMANDS=
```

`PORT` et `HOST` : laissés à Fly. Après un secret, l’app redémarre.

Health : `https://<ton-app>.fly.dev/health`  
Objectif : `"discord": true` et `"twitch_connected": true`.

---

## Discord — commandes

Tape `/` dans Discord.

| Commande | Rôle |
|---|---|
| `/ping` `/help` `/userinfo` | Test et aide |
| `/securitylogs create` | Salon logs + preset ~50 membres |
| `/securitylogs info` / `test` | Vérifier les logs |
| `/setupcheck` | Permissions / rôle |
| `/config parametres:show` | Voir la sécu |
| `/ban` `/kick` `/timeout` `/warn` | Modération |
| `/lockdown` `/unlock` | Lock serveur |
| `/whitelist` `/antinuke` | Anti-nuke |
| `/cases` | Dossiers de sanction |

Autres : `/unban` `/softban` `/untimeout` `/warnings` `/nick` `/purge` `/slowmode` `/syncmembers`

Logs (salon **miyubot-logs**) : join, invitations, messages edit/delete, vocal join / move / leave.

Preset `/securitylogs create` : anti-raid, anti-spam, anti-nuke, kick des comptes de moins de **30 jours**.

---

## Twitch — commandes

Préfixe `!`.

Tout le monde : `!ping` `!help` `!uptime` `!title` `!game` `!socials` `!discord` `!me` `!lurk` `!clip`

Modos : `!so` / `!shoutout` `!permit` `!timeout` `!ban` `!unban` `!slow` `!slowoff` `!followers` `!followersoff` `!emoteonly` `!emoteonlyoff` `!clear` `!cmd add/remove/list`

Auto : alerte ~30 s avant une pub si `TWITCH_ADS_TOKEN` est valide. Automod viewers : spam, caps, liens (clips/YouTube OK).

---

## Limites

- SQLite est **vidée à chaque Deploy** Fly (warns, cases, whitelist, config). Le salon `miyubot-logs` est retrouvé par son nom.
- `TWITCH_ADS_TOKEN` **expire**.
- `TWITCH_CLIPS_TOKEN` **expire** (scope `clips:edit`).
- Une instance seulement.

Local (Fly arrêté) : `npm start` — tests : `npm test`
