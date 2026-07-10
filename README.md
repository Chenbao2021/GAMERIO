# Gamerio

Des petits jeux à plusieurs, en temps réel, pour explorer des techniques au fil du temps.

## Jeux

- **Qui est l'intru ?** — 3 à 8 joueurs, chacun sur son téléphone. Tout le monde reçoit le même mot secret sauf un joueur (l'intrus) qui reçoit un mot différent mais proche. Les indices se donnent à voix haute, le vote se fait dans l'app.

## Stack

- `client/` — React 19 + TypeScript + Vite + MUI
- `server/` — Express 5 + Socket.IO (pas de base de données, les parties vivent en mémoire)

## Développement local

```bash
# Terminal 1 — serveur temps réel
cd server
npm install
npm run dev        # http://localhost:3001

# Terminal 2 — client
cd client
npm install
npm run dev         # http://localhost:5173 (ou le prochain port libre)
```

Pour jouer à plusieurs en local, ouvre plusieurs onglets/fenêtres, ou plusieurs téléphones sur le même réseau Wi-Fi en pointant `client/.env` (`VITE_SOCKET_URL`) vers l'IP locale de ta machine plutôt que `localhost`.

## Déploiement

- **Client** → Firebase Hosting.
- **Serveur** → Render, via `server/Dockerfile`.
  - Variables d'env côté serveur : `PORT`, `ALLOWED_ORIGIN` (URL du client déployé).
  - Variable d'env côté client : `VITE_SOCKET_URL` (URL du serveur déployé).
  - Le plan gratuit de Render met le service en veille après une période d'inactivité : le premier appel après une veille peut prendre 30 à 50 secondes (cold start).

## Limites connues (v1)

- Pas de comptes : les pseudos sont locaux à la session, pas de persistance entre les parties.
- Pas de reconnexion : rafraîchir la page pendant une partie fait perdre sa place.
- Les parties vivent en mémoire sur le serveur — un redémarrage du serveur efface les parties en cours.
