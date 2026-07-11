# Le temps réel, expliqué avec le code de Gamerio

Ce document explique les notions essentielles du "temps réel" web (WebSockets, Socket.IO,
architecture client/serveur événementielle) en s'appuyant à chaque fois sur du code réel de
ce dépôt. L'idée n'est pas de survoler la théorie, mais de te donner assez de vocabulaire et
de repères pour relire `server/src/games/quiestlintru/socketHandlers.ts` et comprendre
*pourquoi* c'est écrit comme ça.

Fichiers clés à garder ouverts en parallèle :
- `server/src/index.ts` — démarrage du serveur
- `server/src/rooms/RoomManager.ts` — gestion générique des salons/joueurs
- `server/src/games/quiestlintru/socketHandlers.ts` — la logique du jeu, côté serveur
- `client/src/context/SocketContext.tsx` — la connexion, côté client
- `client/src/context/IntruRoomContext.tsx` — l'état du jeu, côté client

---

## 1. Pourquoi pas juste du HTTP classique ?

Une requête HTTP classique (celle que fait ton navigateur pour charger une page, ou un
`fetch()`) suit toujours le même schéma : **le client demande, le serveur répond, la
connexion se ferme**. Le serveur ne peut jamais prendre l'initiative de parler à un client —
il ne peut que répondre à une question posée.

Or dans Gamerio, quand un joueur clique sur "voter", **tous les autres joueurs** doivent voir
la mise à jour immédiatement, sans avoir rien demandé eux-mêmes. Avec du HTTP classique, la
seule solution serait le *polling* : chaque client redemande "il y a du nouveau ?" toutes les
secondes. Ça marche, mais c'est lent, gaspilleur, et le délai perçu est mauvais pour un jeu.

Le **temps réel** au sens web veut dire : garder une connexion **ouverte et bidirectionnelle**
entre le client et le serveur, pour que n'importe lequel des deux puisse envoyer un message à
l'autre à tout moment, sans attendre une question préalable.

## 2. WebSocket : le protocole sous-jacent

Un **WebSocket** est une connexion TCP unique qui reste ouverte entre le navigateur et le
serveur. Elle démarre comme une requête HTTP normale (un "handshake"), puis bascule
("upgrade") vers ce mode bidirectionnel permanent. Une fois établie :

- le serveur peut envoyer un message au client à tout moment (pas de nouvelle requête à faire) ;
- le client peut envoyer un message au serveur à tout moment ;
- la connexion reste vivante tant que personne ne la ferme (fermeture d'onglet, perte
  réseau, `disconnect` explicite...).

C'est la brique de base. Tu ne la vois jamais directement dans ce projet parce qu'on utilise
une librairie par-dessus — mais c'est elle qui rend tout le reste possible.

## 3. Socket.IO : pourquoi une librairie par-dessus WebSocket ?

Le projet utilise `socket.io` (serveur, dans `server/package.json`) et `socket.io-client`
(client, dans `client/package.json`) plutôt que l'API `WebSocket` native du navigateur.
Socket.IO ajoute plusieurs choses au-dessus du protocole brut :

- **Reconnexion automatique** si la connexion tombe (retente en arrière-plan).
- **Fallback** vers du "long polling" HTTP si le WebSocket est bloqué par un proxy/firewall
  d'entreprise — transparent pour le code applicatif.
- **Événements nommés** au lieu de devoir parser toi-même des chaînes de caractères brutes :
  `socket.emit('room:create', ...)` plutôt que `socket.send('{"type":"room:create",...}')`.
- **Acknowledgements (ack)** : un `emit` peut recevoir une réponse, comme un `fetch` classique.
  On y revient en détail plus bas — c'est un des patterns les plus utilisés dans ce code.
- **Rooms** : un mécanisme de groupement de connexions pour diffuser un message à un
  sous-ensemble de clients (voir section 5).

En clair : WebSocket est le protocole, Socket.IO est le confort au-dessus.

## 4. Anatomie du serveur (`server/src/index.ts`)

```ts
const app = express()                                  // (A)
const httpServer = createServer(app)                    // (B)
const io = new Server(httpServer, { cors: {...} })       // (C)

io.on('connection', (socket) => {                        // (D)
  registerIntruHandlers(io, socket, roomManager)
})
```

- **(A)** Express sert uniquement une route `/health` ici — le HTTP "classique" n'est presque
  pas utilisé dans ce projet, tout passe par Socket.IO.
- **(B)** Socket.IO a besoin d'un serveur HTTP brut pour faire son "upgrade" vers WebSocket ;
  c'est pour ça qu'on ne fait pas juste `app.listen(...)`.
- **(C)** `io` est l'objet global qui représente le serveur Socket.IO. Il connaît tous les
  clients connectés et peut leur parler individuellement ou en groupe.
- **(D)** `'connection'` est l'événement qui se déclenche **une fois par nouveau client** qui
  ouvre une connexion. `socket` représente **cette connexion précise** — c'est l'équivalent
  d'une session pour ce joueur, tant que l'onglet reste ouvert.

Point important : **`socket.id` est généré par Socket.IO et sert d'identifiant de joueur**
dans tout le code (`roomManager.createRoom(socket.id, ...)`). Il n'y a pas de compte
utilisateur, pas de base de données (voir `README.md`, "Limites connues") — l'identité d'un
joueur, c'est littéralement sa connexion réseau active. Si l'onglet se ferme, l'identité
disparaît (d'où la limite "pas de reconnexion").

## 5. Deux notions de "room" à ne pas confondre

Ce projet a **deux concepts différents qui portent le même nom**, et c'est volontairement
déroutant au début :

### 5a. La "room" Socket.IO (mécanisme de diffusion)

C'est une fonctionnalité native de Socket.IO : un socket peut "rejoindre" un groupe nommé
(`socket.join(code)`), et on peut ensuite envoyer un message à tout ce groupe d'un coup :

```ts
socket.join(room.code)
io.to(room.code).emit('room:players', { players: [...] })
```

`io.to(roomCode).emit(...)` = "envoie ce message à tous les sockets qui ont rejoint ce
groupe". C'est purement un mécanisme de **routage de messages**, ça ne stocke aucune donnée
métier. Tu la retrouves partout dans `socketHandlers.ts`.

### 5b. La "Room" applicative (`RoomManager.ts`)

C'est une structure de données **que ce projet a écrite lui-même**, sans rapport direct avec
Socket.IO :

```ts
export interface Room<TGameState> {
  code: string
  hostId: string
  players: Player[]
  status: 'lobby' | 'active'
  gameState: TGameState
}
```

`RoomManager` est un simple registre en mémoire (`Map<string, Room>`) qui sait créer des
salons avec un code à 4 caractères, y ajouter des joueurs, et retrouver/supprimer un joueur.
Elle est **générique** (`RoomManager<TGameState>`) pour pouvoir être réutilisée par de futurs
jeux, sans rapport avec la logique de "Qui est l'intru".

**Le lien entre les deux** : à chaque fois qu'un joueur rejoint une Room applicative
(`roomManager.joinRoom(...)`), le code fait *aussi* `socket.join(roomCode)` pour que ce
joueur reçoive les diffusions Socket.IO de ce salon. Le code du salon (`room.code`, ex.
`"K7P2"`) sert de nom pour les deux systèmes à la fois — mais ce sont deux mécanismes
séparés : l'un route les messages réseau, l'autre stocke l'état du jeu.

## 6. Le pattern événementiel : émettre, écouter, acquitter

Toute la communication se fait par **événements nommés**, dans les deux sens.

### Émettre / écouter (fire-and-forget)

```ts
// Serveur : diffuse à tout le salon
io.to(room.code).emit('game:phase', { phase: 'clues', ... })

// Client : écoute
socket.on('game:phase', (payload) => { ... })
```

Convention de nommage utilisée dans ce projet : `domaine:action`
(`room:create`, `game:start`, `vote:cast`, `duel:guess`...). Ce n'est pas imposé par
Socket.IO, c'est une convention du projet pour s'y retrouver — regarde
`IntruRoomContext.tsx` pour la liste complète des événements écoutés côté client.

### Émettre avec accusé de réception (ack)

Pour les actions qui ont besoin d'une réponse immédiate (créer un salon, voter...), le projet
utilise les **acknowledgements** de Socket.IO — un `emit` qui prend une fonction callback en
dernier argument :

```ts
// Client (IntruRoomContext.tsx)
socket.emit('room:create', { pseudo }, (res: CreateRoomAck) => {
  if (res.error) { /* ... */ }
  else { /* roomCode reçu, on peut naviguer */ }
})

// Serveur (socketHandlers.ts)
socket.on('room:create', (payload, ack) => {
  const room = roomManager.createRoom(socket.id, sanitizePseudo(payload?.pseudo))
  ack({ roomCode: room.code, playerId: socket.id, isHost: true })
})
```

C'est l'équivalent temps réel d'un `fetch` classique avec réponse : le client sait tout de
suite si son action a réussi ou pourquoi elle a échoué (`ack({ error: '...' })`), sans avoir
à écouter un événement séparé. Dans `IntruRoomContext.tsx`, ce pattern est systématiquement
enveloppé dans une `Promise` pour pouvoir faire `await start(...)` côté composant React.

**Règle mentale** : `emit` sans callback = "je préviens, je n'attends pas de réponse
individuelle" (ex. `clue:done`) ; `emit` avec callback = "j'ai besoin de savoir si ça a
marché avant de continuer" (ex. `vote:cast`).

## 7. Le serveur est la seule source de vérité

C'est le principe le plus important à retenir pour tout jeu multijoueur : **le client ne
décide jamais de rien seul, il ne fait que demander au serveur et afficher ce qu'on lui
renvoie.**

Regarde `gs` (le `GameState`) dans `types.ts` — c'est stocké **uniquement côté serveur**,
dans `room.gameState`. Le client ne reçoit que des extraits, au fil des événements
(`game:phase`, `game:reveal`, `game:result`...). Exemple concret : quand un joueur vote,

```ts
socket.on('vote:cast', (payload, ack) => {
  if (room.gameState.votes[socket.id] || room.gameState.passed.includes(socket.id)) {
    ack({ error: 'Vote déjà enregistré.' })   // le serveur refuse un double vote
    return
  }
  room.gameState.votes[socket.id] = payload.targetPlayerId
  ...
})
```

Le serveur revalide **tout** : est-ce le bon joueur (`socket.id`), est-ce la bonne phase de
jeu (`room.gameState.phase !== 'voting'`), a-t-il déjà voté, la cible existe-t-elle... Si le
client mentait ou avait un bug d'affichage, ça n'aurait aucune conséquence sur l'état réel du
jeu. **Ne jamais faire confiance à ce qu'envoie le client** — exactement comme tu ne ferais
jamais confiance à un `<input>` non validé côté serveur dans un formulaire classique.

## 8. Diffusion publique vs message privé

Socket.IO permet de cibler soit un groupe, soit **un seul socket précis** — et ce projet
utilise les deux dans la même fonction, pour une bonne raison :

```ts
// startRound() dans socketHandlers.ts
for (const player of playing) {
  const isIntruder = player.id === intruderId
  io.to(player.id).emit('game:privateWord', {          // ← un seul joueur reçoit CE message
    word: isIntruder ? wordPair.intruder : wordPair.majority,
  })
}

io.to(room.code).emit('game:phase', { phase: 'clues', ... })  // ← tout le salon reçoit CE message
```

`io.to(player.id)` fonctionne parce que **Socket.IO fait automatiquement rejoindre à chaque
socket une room portant son propre `socket.id`** — un détail interne pratique qui permet de
cibler un joueur précis avec la même API `io.to(...).emit(...)` que pour un salon entier.

C'est ce qui permet la mécanique du jeu : chaque joueur reçoit son mot en privé, et
**personne ne peut deviner qui est l'intrus rien qu'en lisant le trafic réseau** de son
propre navigateur, puisqu'il ne reçoit jamais les mots des autres.

## 9. L'état comme une machine à états (phases)

```ts
export type Phase = 'lobby' | 'clues' | 'voting' | 'duel' | 'reveal' | 'guessing' | 'result'
```

Une manche de jeu est modélisée comme une **machine à états finis** : à tout instant,
`room.gameState.phase` vaut une seule de ces valeurs, et chaque handler socket commence par
vérifier qu'on est dans la bonne phase avant d'agir :

```ts
socket.on('clue:done', (payload) => {
  if (!room || room.gameState.phase !== 'clues') return   // refuse si mauvaise phase
  if (room.gameState.turnOrder[room.gameState.currentTurnIndex] !== socket.id) return // refuse si pas son tour
  ...
})
```

C'est un pattern extrêmement courant en temps réel dès qu'il y a plusieurs utilisateurs
concurrents : sans ces gardes-fous, un message en retard ou un double-clic client pourrait
faire avancer l'état deux fois, ou un joueur pourrait agir hors tour. Chaque transition de
phase (`startRound`, `advanceTurn`, `resolveVotes`, `settleAccusation`, `finishRound`...) est
une fonction serveur qui fait passer `gs.phase` d'une valeur à une autre et diffuse le
nouveau `game:phase` à tout le salon.

## 10. Gérer la concurrence : "tout le monde répond, qui est le dernier ?"

Un problème classique du temps réel multijoueur : comment savoir que **tous les joueurs** ont
répondu, sans page de "chargement" bloquante ? Regarde ce pattern répété deux fois dans le
code (votes et duel) :

```ts
function voteResponseCount(gs: GameState): number {
  return Object.keys(gs.votes).length + gs.passed.length
}

// après chaque vote individuel :
io.to(room.code).emit('game:voteUpdate', { votesCastCount: voteResponseCount(gs), totalPlayers: ... })
if (voteResponseCount(gs) === gs.turnOrder.length) {
  resolveVotes(io, room)   // seulement quand TOUT LE MONDE a répondu
}
```

Chaque événement entrant met à jour un petit compteur d'état, diffuse la progression à tous
(pour afficher "3/5 ont voté"), et **seul le dernier arrivé déclenche la suite** (le
dépouillement). C'est robuste face à l'arrivée des messages dans un ordre quelconque : peu
importe qui vote en premier ou en dernier, la logique est la même à chaque appel — c'est le
compteur qui décide, pas "qui a parlé en premier".

## 11. Timers côté serveur : temps réel ≠ juste des messages

```ts
const GUESS_TIMEOUT_MS = 20_000
const guessTimers = new Map<string, ReturnType<typeof setTimeout>>()

guessTimers.set(room.code, setTimeout(() => finishRound(io, room, false), GUESS_TIMEOUT_MS))
```

Le serveur peut aussi agir **de sa propre initiative**, sans qu'aucun client n'envoie de
message : ici, si l'intrus ne devine pas le mot en 20 secondes, le serveur termine la manche
tout seul (`finishRound`). C'est un rappel que le serveur Node.js tourne en continu (contrairement
à une fonction serverless qui ne vit que le temps d'une requête) — il peut planifier des
actions futures, tant que le processus reste en vie.

Remarque au passage : `guessTimers` et `socketRoomMap` sont des `Map` **au niveau module**,
en dehors de `GameState`. Le commentaire dans le code explique pourquoi : ce ne sont pas des
données "diffusables" (on ne les envoie jamais aux clients), donc elles n'ont pas leur place
dans l'état de jeu partagé.

## 12. Côté client : une connexion, un Context React

### Le socket est un singleton (`SocketContext.tsx`)

```ts
let socketSingleton: Socket | null = null
function getSocket(): Socket {
  if (!socketSingleton) socketSingleton = io(import.meta.env.VITE_SOCKET_URL)
  return socketSingleton
}
```

Une seule connexion WebSocket pour toute l'app, créée une fois et réutilisée partout via
`useSocket()`. Le commentaire du code précise pourquoi : en React 19 `StrictMode`, les effets
sont invoqués deux fois exprès (pour détecter les bugs) — sans ce singleton, ça ouvrirait
deux connexions par accident.

### Les écouteurs vivent dans un Context, pas dans les composants d'écran

```ts
useEffect(() => {
  function onPhase(payload) { setState(s => ({ ...s, phase: payload.phase, ... })) }
  socket.on('game:phase', onPhase)
  return () => { socket.off('game:phase', onPhase) }   // nettoyage obligatoire
}, [socket])
```

`IntruRoomProvider` (dans `IntruRoomContext.tsx`) s'abonne une seule fois à tous les
événements du jeu, et traduit chaque message reçu en une mise à jour de state React
(`setState`). Les composants d'écran (`IntruLobby`, `IntruCluePhase`, `IntruVoting`...) ne
parlent jamais directement au socket : ils lisent `state` via `useIntruRoom()` et appellent
des fonctions comme `castVote(...)`. Deux raisons à ce choix :

1. **L'état de la partie doit survivre à la navigation** entre écrans (lobby → jeu), alors
   qu'un state local à un composant serait réinitialisé à chaque changement de route.
2. Le nettoyage (`socket.off(...)` dans le `return` du `useEffect`) évite d'accumuler des
   écouteurs en double si le composant se remonte — un bug classique et sournois en React +
   Socket.IO si on oublie de désabonner.

## 13. Ce que ce projet ne fait pas encore (pistes d'apprentissage)

Le `README.md` liste des limites connues qui sont d'excellents exercices pour approfondir :

- **Pas de reconnexion** : si tu rafraîchis la page, tu perds ton `socket.id` (donc ton
  identité de joueur) et dois recréer une connexion. Un exercice classique consisterait à
  stocker un `playerToken` côté client (`localStorage`) et laisser le joueur "réclamer" sa
  place dans la room après reconnexion, plutôt que d'utiliser `socket.id` comme identité
  permanente.
- **Pas de persistance** : tout vit en mémoire (`Map` dans `RoomManager`) — un redémarrage
  serveur efface tout. Un bon exercice serait de comprendre pourquoi ajouter une base de
  données changerait aussi la façon de penser la "source de vérité" (qui rafraîchit quoi,
  quand).
- **Scalabilité horizontale** : ce serveur ne fonctionne que sur **une seule instance**, car
  l'état (`Map` en mémoire) n'est pas partagé entre plusieurs processus. Si un jour il fallait
  plusieurs instances derrière un load balancer, il faudrait un "adapter" Socket.IO (ex. Redis)
  pour que `io.to(...).emit(...)` atteigne des clients connectés à une *autre* instance.
  Aucun besoin ici (petit jeu, faible trafic), mais c'est la prochaine notion à connaître une
  fois celle-ci acquise.

## 14. Glossaire rapide

| Terme | Sens dans ce projet |
|---|---|
| **WebSocket** | Protocole réseau bas niveau : une connexion TCP ouverte en permanence, bidirectionnelle. |
| **Socket.IO** | Librairie au-dessus de WebSocket : reconnexion auto, fallback HTTP, événements nommés, rooms, acks. |
| **`socket`** | Une connexion précise = un joueur connecté, côté serveur comme côté client. |
| **`socket.id`** | Identifiant unique généré par Socket.IO pour une connexion ; sert d'identité joueur ici (pas de comptes). |
| **Room (Socket.IO)** | Groupe de sockets pour diffuser un message (`io.to(code).emit`). Mécanisme de routage réseau. |
| **Room (applicative)** | La structure `Room<GameState>` de `RoomManager.ts` : salon de jeu, joueurs, état. Structure de données métier. |
| **`emit`** | Envoyer un événement nommé, avec des données, vers un ou plusieurs sockets. |
| **`on` / `off`** | S'abonner / se désabonner d'un événement nommé. |
| **Ack (acknowledgement)** | Callback passé à `emit`, appelé par l'autre bout pour répondre — l'équivalent temps réel d'une réponse HTTP. |
| **État autoritaire (authoritative state)** | Le serveur est la seule source de vérité ; le client ne fait que demander et afficher. |
| **Broadcast** | Diffuser un message à tout un groupe (`io.to(room.code).emit`), par opposition à un message ciblé à un seul socket. |

---

### Comment continuer à apprendre à partir d'ici

1. Relis `socketHandlers.ts` du début à la fin en suivant le déroulé d'une manche
   (`room:create` → `game:start` → `clue:done` en boucle → `vote:cast`/`vote:pass` →
   `game:reveal` → `intruder:guess` → `game:result`) — c'est le meilleur moyen de voir le
   cycle complet.
2. Ajoute un `console.log` dans `io.on('connection', ...)` et dans `handleLeave` pour voir en
   direct, dans le terminal du serveur, les connexions/déconnexions pendant que tu testes
   avec deux onglets ouverts en local (`npm run dev` des deux côtés, voir `README.md`).
3. Essaie d'ajouter un petit événement toi-même (ex. un `chat:message` diffusé à tout le
   salon) pour pratiquer le pattern `emit`/`on`/nettoyage de bout en bout.
