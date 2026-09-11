# MiyuBot

Bot **Discord** (sécurité + modération, commandes `/`) et **Twitch** (chat `!`).

Une seule instance en production. Ne lance pas `npm start` en local tant que le bot tourne déjà (Fly, PC, etc.) : les commandes se doublent.

---

## 1. Copier la config

```bash
npm install
cp .env.example .env
```

Remplis **ton** `.env`. Ne commite jamais `.env`.

---

## 2. Où récupérer les tokens

Ne colle **jamais** tes tokens dans le dépôt, un ticket ou un chat public.

### Discord — `DISCORD_TOKEN`

1. [Portail développeur Discord](https://discord.com/developers/applications) → **New Application**.
2. Onglet **Bot** → **Reset Token** → copie le token.
3. Même onglet : active **Server Members Intent** et **Message Content Intent**.
4. Onglet **OAuth2 → URL Generator** : scopes `bot` + `applications.commands`, permissions Admin (ou messages, embeds, kick/ban/timeout, salons, rôles, logs d’audit, gérer le serveur).
5. Ouvre l’URL générée pour inviter le bot. Place son rôle **au-dessus** des membres à modérer.

Docs : [Applications Discord](https://discord.com/developers/docs/quick-start/getting-started)

### Twitch — appli Helix (`TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`)

1. [Console Twitch](https://dev.twitch.tv/console/apps) (compte qui possède l’appli, souvent le **bot**).
2. Crée ou ouvre l’application. **OAuth Redirect URL** : `https://localhost` (clique **Add**).
3. Copie l’**identifiant client** → `TWITCH_CLIENT_ID`.
4. **New Secret** → `TWITCH_CLIENT_SECRET` (affiché une fois).

L’identifiant client ne se régénère pas. Un nouveau secret **invalide** l’ancien : mets à jour Fly aussi.

Docs : [Twitch Developer Console](https://dev.twitch.tv/console)

### Twitch — chat IRC (`TWITCH_OAUTH_TOKEN`)

Compte **bot**, pas le streamer.

1. [Twitch Token Generator](https://twitchtokengenerator.com) (ou [twitchapps.com/tmi](https://twitchapps.com/tmi/)).
2. Connecte-toi avec le **bot**. Scopes : `chat:read` + `chat:edit` (plus les droits modo si tu veux timeout/ban).
3. Copie l’access token. Dans `.env` / Fly : `oauth:` + le token.

`TWITCH_USERNAME` = login du bot (minuscules).  
`TWITCH_CHANNEL` = login de **ta chaîne**, sans `https://www.twitch.tv/`.

Le bot doit être **modérateur** de la chaîne.

### Twitch — pubs et clips (tokens **streamer**)

Même appli que `TWITCH_CLIENT_ID`. Connecte-toi sur Twitch avec le compte **de la chaîne**.

Ajoute `https://localhost` comme URL de redirection dans la console, puis ouvre (remplace `TON_CLIENT_ID`) :

**Pubs** (`TWITCH_ADS_TOKEN`, scope `channel:read:ads`) :

```text
https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=TON_CLIENT_ID&redirect_uri=https://localhost&scope=channel:read:ads
```

**Clips** (`TWITCH_CLIPS_TOKEN`, scope `clips:edit`) :

```text
https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=TON_CLIENT_ID&redirect_uri=https://localhost&scope=clips:edit
```

**Les deux d’un coup** (un seul token à mettre dans `TWITCH_ADS_TOKEN` **et** `TWITCH_CLIPS_TOKEN`) :

```text
https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=TON_CLIENT_ID&redirect_uri=https://localhost&scope=channel:read:ads+clips:edit
```

Autorise. La page `https://localhost` ne charge pas : c’est normal. Dans la barre d’adresse, copie ce qu’il y a entre `access_token=` et le `&` suivant. **Sans** `oauth:`.

Ces tokens **expirent**. Il faut refaire le lien quand l’alerte pubs ou `!clip` s’arrête.

Docs : [OAuth implicit grant](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#implicit-grant-flow) · [Create Clip](https://dev.twitch.tv/docs/api/reference/#create-clip) · [Get Ad Schedule](https://dev.twitch.tv/docs/api/reference/#get-ad-schedule)

---

## 3. Variables Twitch

| Variable | Qui | Quoi |
|---|---|---|
| `TWITCH_USERNAME` | compte **bot** | login IRC |
| `TWITCH_OAUTH_TOKEN` | compte **bot** | `oauth:...` (`chat:read` + `chat:edit`) |
| `TWITCH_CHANNEL` | ta **chaîne** | login uniquement |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | appli Twitch | Helix (`!uptime`, `!title`, `!game`, `!so`, envoi tchat) |
| `TWITCH_ADS_TOKEN` | **streamer** | alerte pubs, `channel:read:ads` |
| `TWITCH_CLIPS_TOKEN` | **streamer** (ou éditeur) | `!clip`, `clips:edit` |

Optionnel :

| Variable | Rôle |
|---|---|
| `DISCORD_BIO` | texte « À propos » du profil du bot (400 car. max). `off` pour ne pas le modifier |
| `TWITCH_DISCORD_INVITE` | lien envoyé par `!discord` (ton invitation, pas un exemple du dépôt) |
| `TWITCH_SOCIALS_URL` | lien envoyé par `!socials` |
| `TWITCH_DISCORD_LIVE_CHANNEL_ID` | salon Discord pour l’annonce live |
| `TWITCH_DISABLED_COMMANDS` | commandes à laisser à un autre bot (ex. WizeBot). Garder `so`, `discord`, `socials`, `clip` ici si tu les veux |

En tchat partagé, les commandes et liens des **autres** chaînes sont ignorés. Les réponses partent en visible uniquement sur ta chaîne (Helix `for_source_only`). Ça demande `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` et le scope `user:write:chat` autorisé pour le bot.

---

## 4. Secrets Fly

[Tableau de bord Fly](https://fly.io/dashboard) → ton app → **Secrets**. Liste à remplir toi-même (valeurs vides) :

```text
DISCORD_TOKEN=
DISCORD_BIO=
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

`PORT` et `HOST` : laissés à Fly. Après un secret, l’app redémarre. Un secret **ne déploie pas** le nouveau code : il faut `fly deploy`.

Santé : `https://<ton-app>.fly.dev/health`  
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

Après `/securitylogs create`, ouvre le salon de logs (nom du type `miyubot-logs`). Join, invitations, messages edit/delete, vocal join / move / leave.

Preset : anti-raid, anti-spam, anti-nuke, kick des comptes de moins de **30 jours**.

---

## Twitch — commandes

Préfixe `!`. En tchat partagé : les commandes des **autres** chaînes sont ignorées. Les réponses / annonces partent **uniquement sur ta chaîne**.

### Tout le monde

| Commande | Rôle |
|---|---|
| `!ping` | Test : le bot est en ligne |
| `!help` / `!commands` | Liste des commandes |
| `!uptime` | Durée du live |
| `!title` | Titre du stream |
| `!game` | Jeu / catégorie |
| `!socials` | Lien des réseaux (`TWITCH_SOCIALS_URL`) |
| `!discord` | Invitation Discord (`TWITCH_DISCORD_INVITE`) |
| `!me` | Présentation de Miyu |
| `!lurk` | Petit message lurk (ping le viewer) |
| `!clip` | Crée un clip du live (~25 s entre deux) |
| `!donate` / `!donation` / `!kofi` | Annonce Ko-fi (bandeau, visible seulement sur ta chaîne) |

### Modos / streamer

| Commande | Rôle |
|---|---|
| `!so` / `!shoutout` `pseudo` | Shoutout |
| `!permit` `pseudo` `[secondes]` | Autorise un lien (défaut 60 s) |
| `!timeout` `pseudo` `[secondes]` `[raison]` | Timeout |
| `!ban` `pseudo` `[raison]` | Ban |
| `!unban` `pseudo` | Unban |
| `!slow` `[secondes]` | Slow mode (défaut 5 s) |
| `!slowoff` | Coupe le slow |
| `!followers` `[minutes]` | Followers-only |
| `!followersoff` | Coupe followers-only |
| `!emoteonly` / `!emoteonlyoff` | Emote-only |
| `!clear` | Efface le tchat |
| `!cmd add` `nom` `texte` | Ajoute une commande perso |
| `!cmd remove` `nom` | Supprime une commande perso |
| `!cmd list` | Liste les commandes perso |

Les commandes perso (`!cmd`) suivent le même filtre tchat partagé.

`TWITCH_DISABLED_COMMANDS` : laisse des commandes à un autre bot (ex. `ping,help,uptime,title,game`). Ne pas y mettre `so`, `discord`, `socials`, `clip`, `donate` si tu les veux ici.

### Auto (sans commande)

- Alerte **~30 s** avant une pub auto (`TWITCH_ADS_TOKEN`).
- Annonce don Ko-fi **toutes les 45 min** en live (première 45 min après le début du live).
- Automod viewers : spam, caps, liens (clips / YouTube OK). Les streameurs du tchat partagé ne sont pas timeout pour un lien.

---

## Limites

- SQLite est **vidée à chaque Deploy** Fly (warns, cases, whitelist, config). Le salon de logs est retrouvé par son nom.
- `TWITCH_ADS_TOKEN` et `TWITCH_CLIPS_TOKEN` **expirent**.
- Une instance seulement.

Local (prod arrêtée) : `npm start` — tests : `npm test`
