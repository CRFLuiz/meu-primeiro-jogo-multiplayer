# Refactor Suggestions — meu-primeiro-jogo-multiplayer

> Generated analysis; not implemented. Each item lists priority, file path, and a short snippet excerpt grounding it.

## Methodology

Sweep of all 9 subprojects under `playground/*`. Priority: **alto** = correctness risk or unfixable UX/feature gap, **médio** = clear duplication or maintainability hazard across the subproject, **baixo** = naming/cleanup within a single subproject. Suggestions scoped within each subproject to preserve the playground's per-iteration isolation; cross-folder consolidation is *not* proposed (each iteration is a frozen lesson snapshot).

Notes on what was verified while writing this report:

- File hashes via `md5sum` (multiple files in `playground/*/public/` are byte-identical across iteration subprojects).
- The full body of `chess/public/sw.js` and `pwa-pod/public/sw.js` (identical 23 lines, `caches.keys()` swap block in `activate` keeps `'v2'` alive).
- The full body of `playground/pwa-pod/server.js` (scaffolding equal to `1st-release/server.js` modulo a single stale comment).
- The `addFruit` math in `implementacao-snake/src/server.js` was re-derived and double-checked empirically with a 200 000-iteration Node sample (see Section 8) — the brief's predicted range was off; the corrected range is reported below.
- `playground/pwa-pod/package.json` declares `"esm": "^3.2.25"` as a dep, so `npm install` was run and `npm start` was attempted. The actual failure mode (or absence thereof) is captured verbatim in the **Pontuação-e-skin / pwa-pod** section below.

A small number of **brief assertions that turned out to be inaccurate against the current code are noted as such and the report follows what the files actually contain.** Specifically:

- `playground/pwa-pod/public/manifest.webmanifest` **does** exist (byte-identical to `playground/chess/public/manifest.webmanifest`, hash `820cb7ad12047a0f80d4355b35e3c764`). The original brief claimed it did not. The PWA install feature therefore does *link* a manifest; the install problem is more limited than the brief stated.
- `playground/pwa-pod/server.js` is *not* md5-identical to `playground/1st-release/server.js` — it has one extra line (`//node -r esm server.js`), so its hash is `a9505ed541be3fbc94daff2d1f695768` rather than `6c0a233f2e737ec87cde48740e8af137`. Same scaffolding otherwise.
- `npm start` inside `playground/pwa-pod/` **does start the server** today. See the evidence note in Section 5.
- `playground/implementacao-snake/src/server.js` `addFruit` produces values in the range **1..28** (or 29 in the unreachable case `Math.random() === 0`), not "between 29 and 58" as the brief stated. The bug is real — fruits never randomize across the full 0..29 grid — but the symptom is different.

These divergences are noted so the report's evidence holds up against what's on disk today.

## Cross-cutting observations

### Duplication is structural — the playground's pedagogical design

The near-identical `server.js` files across `1st-release`, `implementacao-teleporte`, `implementacao-pontuacao`, and `player-collision-novos-pots` (md5sum `6c0a233f2e737ec87cde48740e8af137` for all four) are *intentional lesson snapshots* — each subproject is meant to be cloned and modified in isolation, as the README's "como enviar o seu experimento" instructions state. Likewise the bit-for-bit duplicate `pontuacao-e-skin/public/{game,render-screen}.js` and `pwa-pod/public/{game,render-screen}.js` (hashes `acbbfa16b960a081cda890574db53505` and `176a51d3c86e17a26c0041b1bf13cda8`) match the README's stated lineage ("esta versão é uma cópia de **skin para jogadores e frutas**"). Treating either as "refactor target" would defeat the pedagogical model.

### Utility duplication

- `playground/implementacao-teleporte/public/utils.js`
- `playground/implementacao-pontuacao/public/utils.js`
- `playground/pontuacao-e-skin/public/utils.js`
- `playground/pwa-pod/public/utils.js`
- `playground/player-collision-novos-pots/public/utils.js`

All five are byte-identical (md5 `101fea3b1220dba5872b858c47cca6e3`), each containing a single export:

```js
/* Mod que retorna positivo para números negativos */
export const mod = (x, y) => ((y % x) + x) % x
```

Each playground folder is meant to stand alone, so the duplication is consistent with the pedagogical model — flag here, do not propose a shared file.

**Priority: baixo.**

### serviceWorker swap, dead cache

`playground/chess/public/sw.js` and `playground/pwa-pod/public/sw.js` are byte-identical (md5 `f20d9fc6253356a0d4e7b0efd63a58e9`, 23 lines / 538 bytes each). The `install` handler does not precache any asset; the `activate` handler does however delete any cache key not in `['v2']`:

```js
self.addEventListener('activate', (event) => {
  var cacheKeeplist = ['v2'];

  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (cacheKeeplist.indexOf(key) === -1) {
          return caches.delete(key);
        }
      }));
    })
  );
});
```

So the service worker registers but never precaches anything — the `'v2'` keep-list is defending a cache it never creates in the first place.

**Priority: médio** (dead code + incomplete PWA).

## Per-subproject items

### 1st-proof-of-concept

- **[ALTO] render-loop duplication between `game.html` and `game-admin.html`.** The `function renderGame()` body is byte-equivalent across both files (canvases, fills, fruit loop, current-player highlight, recursive `requestAnimationFrame`). Two HTML files maintain the same render loop and event handlers — classic copy-paste. Either one canonical render function is shared via `<script src=...>` extracted into a static asset, or both inline copies are kept and any future change must be applied twice.
- **[MÉDIO] `multipleOf100Remainder` accidental global.** Inside the `fruit-remove` handler in both HTML files, the assignment is bare: `multipleOf100Remainder = score % 100`. There is no `var`/`let`/`const`, so the identifier becomes a property of `window`. The two downstream `if` checks (`multipleOf100Remainder !== 0`, `multipleOf100Remainder === 0`) then read the global. Re-declared inside the same function once would not shadow this accidentally because of the missing `let`.
- **[BAIXO] admin route guarded by a 64-char hex in URL (acknowledged POC).** `playground/1st-proof-of-concept/server.js`:
  ```js
  // Coisas que só uma POC vai conhecer
  webApp.get('/a31ecc0596d72f84…', function(req, res){ … })
  ```
  Security-through-obscurity route. Comment already acknowledges this; out-of-scope for refactor-by-design.

### 1st-release

- **[MÉDIO] `acceptedMoves` rebuilds closure on every keypress in `public/game.js`.** Lines defining the move map are nested inside `function movePlayer(command)`, so a fresh object literal with four new functions is allocated on every keypress:
  ```js
  function movePlayer(command) {
      notifyAll(command)

      const acceptedMoves = {
          ArrowUp(player)    { if (player.y - 1 >= 0) player.y = player.y - 1 },
          ArrowRight(player) { if (player.x + 1 < state.screen.width) player.x = player.x + 1 },
          ArrowDown(player)  { if (player.y + 1 < state.screen.height) player.y = player.y + 1 },
          ArrowLeft(player)  { if (player.x - 1 >= 0) player.x = player.x - 1 }
      }
      // …
  }
  ```
  The map is constant per game — it should live at module scope.
- **[BAIXO] `addFruit`'s `command ? :` ternary obscures dual behavior.** The same function is invoked both for random spawn (interval-driven) and for a server-rebroadcast, and the conditional branches on `command` to pick between random and fixed positions. Splitting into `addRandomFruit()` + `addFixedFruit(command)` reads more clearly.

### implementacao-teleporte / implementacao-pontuacao

- **[BAIXO] `server.js` duplicates `1st-release` verbatim (acknowledged lesson).** Both `implementacao-teleporte/server.js` and `implementacao-pontuacao/server.js` are md5-identical to `1st-release/server.js`. This is the "lesson snapshot" pattern — call out, do not consolidate.
- **[MÉDIO] divergence risk in `game.js`.** `implementacao-pontuacao/public/game.js` adds `score: 0` on `addPlayer` and an `auto-increment on collision` line, but `addFruit` is a verbatim copy of `1st-release/public/game.js`. As each iteration layers one feature on top, `addFruit` will drift across forks — flag the divergence surface; per the brief, propose awareness rather than consolidation. Adjacent `pontuacao-e-skin/public/game.js` is functionally the same code with `pixelsPerFields: 5` added to `state.screen`.

### pontuacao-e-skin / pwa-pod

- **[ALTO] `pwa-pod` runtime is correct today, but `package.json` + comment trail leak dependency confusion.** The state at HEAD:
  - `playground/pwa-pod/package.json` declares `"esm": "^3.2.25"` as a runtime dependency *and* `"type": "module"` at the top level. Native ESM is enabled; the `esm` shim is dead weight.
  - `playground/pwa-pod/server.js` line 5 reads `//node -r esm server.js`, instructing the reader to preload the shim. With `"type": "module"` in place, Node would error on `-r esm` rather than silently fix anything.
  - `playground/pwa-pod/package.json` `"name"` is `"pontuacao-e-skin"` (a literal copy from the parent fork). The `"start"` script is `"nodemon server.js"`.
  - `playground/pwa-pod/public/manifest.webmanifest` does exist and is byte-identical to `playground/chess/public/manifest.webmanifest` (md5 `820cb7ad12047a0f80d4355b35e3c764`). The brief's claim that it is missing is outdated. `playground/pwa-pod/public/index.html` references it correctly at line 75: `<link rel="manifest" href="manifest.webmanifest">`.
  - `playground/pwa-pod/public/index.html` `<script src="/socket.io/socket.io.js">` is loaded via the server, but `playground/pwa-pod/public/sw.js` (identical to chess's `sw.js`) does not precache that file, so install behavior is at best a no-op and at worst confusing.

  **Empirical `npm start` evidence captured during this analysis** (Node v13.3.0, npm 6.13.1, freshly `npm install`-ed at HEAD):
  ```
  > nodemon server.js
  [nodemon] 2.0.2
  [nodemon] starting `node server.js`
  (node:680) ExperimentalWarning: The ESM module loader is experimental.
  > Server listening on port: 3000
  > Emitting add-fruit
  > Emitting add-fruit
  …
  ```
  The server **starts and serves**; the only symptom is an `ExperimentalWarning`. So the runtime breakage prediction in the brief was over-stated. The cleanliness problems (unused `esm` dep, stale `//node -r esm server.js` comment, carry-over `name: "pontuacao-e-skin"`, and dead-cache service worker) **do** still need cleanup; the priority remains high but the framing is now "dependency hygiene + dead-code" rather than "server doesn't start." Files unchanged in this report; the evidence above is what the next implementer should re-verify against their own Node version.
- **[BAIXO] identical byte-copies of `game.js` and `render-screen.js` (acknowledged lesson).** `pontuacao-e-skin/public/game.js` md5-identical to `pwa-pod/public/game.js` (`acbbfa16b960a081cda890574db53505`); same hash match for `render-screen.js` (`176a51d3c86e17a26c0041b1bf13cda8`). The PWA experiment is built on top of the skin fork by design — see Cross-cutting note.

### player-collision-novos-pots

- **[ALTO] `getPlayersAround()` uses broken distance math.** `playground/player-collision-novos-pots/public/game.js`:
  ```js
  function getPlayersAround(coords){
      let { config:{maxCollisionDistance}, players } = state
      let playersAround = []
      for (const playerId in players) {
          const player = players[playerId]
          const {x,y} = player
          const distance = Math.sqrt((coords.x - x) * (coords.y-y));
          if(distance <= maxCollisionDistance)
              playersAround.push(playerId)
      }
      return playersAround
  }
  ```
  The expression `(coords.x - x) * (coords.y - y)` *multiplies* the two differences instead of *summing their squares*. For points where either difference is zero (same x or same y), the distance comes out as 0; for points off both axes, the result is essentially meaningless noise rather than Euclidean distance. Should be `Math.sqrt(((coords.x - x) ** 2) + ((coords.y - y) ** 2))`. The result is "sounds play for the wrong set of nearby players, and the radius is effectively the constant `maxCollisionDistance` whenever the bug-underflow is non-trivial."
- **[MÉDIO] re-entrancy: `checkForPlayerCollision` → `explodeFruits` → `addFruit` mutating state during iteration.** The collision handler iterates `Object.keys(state.players)` and inside the loop calls `explodeFruits`, which calls `addFruit`, which calls `notifyAll` (synchronously iterating `observers`) while the engine is still mid-iteration over `state.players`. A subscribed observer that deletes a player from `state.players` during the notifier pass will throw; even without delete, the new fruit is dispatched before the collision that "caused" it has finished its bookkeeping (e.g. the `play-audio` event for `'playerCollision'` reaches sockets before the `'add-fruit'` does, but ordering depends on the engine implementation).
- **[MÉDIO] `addFruit()` semantics bundling.** Same function is called by the random spawn `setInterval(addFruit, frequency)` (with `command === undefined` to mean randomize) and by `explodeFruits` (with a `command` carrying `fruitId`, `fruitX`, `fruitY`, `quantity`). The single function uses `command ? command.fruitX : Math.random() …` ternaries and *also* derives `fruitId` from the coords rather than from `command.fruitId`, so the same call site writes two different `fruitId` shapes (the second one in `notifyAll`): `fruitId: command ? command.fruitId : …` vs `fruitId: ``${fruitX}-${fruitY}```. The dual ID contract will silently break a client that holds the first shape and is told the second — see that the `removeFruit` handler in this file deletes `state.fruits[fruitId]` keyed on the `${x}-${y}` string, while the original 1st-release deletion is by `Math.floor(Math.random()*10000000)` numeric ID.
- **[BAIXO] `package.json` carries the parent fork's `name` and is missing a `description`.** `playground/player-collision-novos-pots/package.json` reads `"name": "pontuacao-e-skin"` (literal copy from the upstream fork) and has an empty `"description": ""`. No code impact (no tests), deck-cleanliness only.

### chess

- **[ALTO] 8 near-identical move handlers in `public/game.js movePlayer`.** The 8 entries (`ArrowUp/Right/Down/Left`, `a/s/z/x`) each compute `moveX = player.x ± 0/1`, `moveY = player.y ± 0/1`, run a bounds check, then call the same two predicates and apply the new coordinates. Roughly 9 lines × 8 copies = ~72 lines that a single `const delta = acceptedKeys[keyPressed]; applyDelta(player, delta, command.playerId)` could collapse.
- **[MÉDIO] `checkForProtectedSquare` is misnamed.** It checks whether `(moveX, moveY)` is adjacent to a "protected" fruit, but the logic is "no enemy pawn at x±1, y+1" — semantically this is *attacked-by-enemy-pawn*, not *protected*. The name inverts the polarity: a "protected" square conventionally means one that an enemy cannot move into safely; here the predicate returns `false` for a square that *is* attacked. Rename to `isSquareAttacked` or similar.
- **[MÉDIO] `sw.js` keeps `'v2'` alive but never precaches anything.** See Cross-cutting note above. Both this subproject and `pwa-pod` ship the same 23-line file with an empty `install` listener, so the service worker does nothing useful.
- **[BAIXO] `checkForOccupiedSquare` from `addPlayer`/`addFruit` is not reused by `movePlayer`.** `addPlayer` and `addFruit` use `do { … } while (checkForOccupiedSquare(…))` to avoid initial overlap, but `movePlayer` never calls it. Two players (or a player and a fruit) can land on the same square; the collision logic later only catches player+player, not player+landing-on-fruit-during-move.

### pwa-pod (asymmetric vs. chess) — same manifest link is present here too

For completeness of the brief's "verify `chess/public/index.html` line ~120 manifest link" note: `playground/chess/public/index.html` line 75 also carries `<link rel="manifest" href="manifest.webmanifest">`, and `playground/chess/public/manifest.webmanifest` exists (md5 `820cb7ad12047a0f80d4355b35e3c764`, byte-identical to pwa-pod's). So the manifest is wired correctly in both subprojects; the only PWA gap is the empty service-worker precache (cross-cutting note above).

### implementacao-snake

- **[ALTO] `addFruit` math produces values in `[1,28]` (not the intended `[0,29]`).** `playground/implementacao-snake/src/server.js`:
  ```js
  function addFruit() {
      if (game.fruits.length < 7) {
          game.fruits.push({
              x: Math.floor(Math.random() * (1 - 29)) + 29,
              y: Math.floor(Math.random() * (1 - 29)) + 29
          });
          …
      }
  }
  ```
  `(1 - 29) = -28`. `Math.random() ∈ [0, 1)` yields `Math.random() * -28 ∈ (-28, 0]`. `Math.floor` of a value in that range is `-28`, `-27`, … `-1`, or `0`. Adding `29` gives `1..28` (or `29`, only when `Math.random() === 0`, which never happens). Empirically verified by a 200 000-iteration sample: values `1..28`, never `0` and never `29` (the `Math.random() === 0` branch is statistically unreachable, and `Math.random()` is in fact `[0,1)` exclusive on the upper end — so the maximum is unreachable). Consequence: the snake-grid cell `0` (and the cell `29`) never hosts a fruit, regardless of intent.
  Same pattern (`(1 - 29)` instead of `state.screen.width` or the bound the author meant) is reused for the spawned player's initial `body[0]` coordinates. The wrap-around in `newMovement` confirms the intended grid is 30 cells (`x === -1 → x += 30`, `x === 30 → x -= 30`), so the math is just broken in the `addFruit` body. Fix should be `Math.floor(Math.random() * 30)` or `Math.floor(Math.random() * (state.screen.width))` once a screen constant exists.
- **[ALTO] inlined Socket.IO client at `src/public/socket.io.js` (~67 KB) duplicates what the server already serves.** The server uses `socket.io@^2.3.0` (same version) and automatically serves `/socket.io/socket.io.js` from the static middleware; `playground/implementacao-snake/src/public/index.html` does not even load the server-served bundle — it loads the vendored copy directly:
  ```html
  <script src="./socket.io.js"></script>
  ```
  68 686 bytes shipped to every client, pinning the protocol to Socket.IO v2.3.0 even when the server version bumps (and creating extra merge-conflict surface when a project at large upgrades).
- **[MÉDIO] shared mutable `game` singleton, no encapsulation.** The `game = { players: [], fruits: [] }` object literal lives at module top and every collaborator (`addFruit`, `newMovement`, the connection handler) mutates it directly. The other subprojects pass through a closure-built `createGame()` factory that exposes a surface (`addPlayer`, `movePlayer`, `subscribe`) instead; this one doesn't. Recognized as a deliberate "different style" demo, but worth flagging because it's the deepest architectural divergence in the playground.
- **[MÉDIO] top-N scoreboard logic in `src/public/snake.js` duplicates the same shape across render-screen.js.** Verified by file inspection: `playground/{1st-release,implementacao-teleporte,implementacao-pontuacao,pontuacao-e-skin,pwa-pod}/public/render-screen.js` each render the same score-table rows in essentially the same body. The snake variant `updateScoreTable` follows the same scheme; consolidating the table is out of scope (lesson isolation), but the duplication is dense enough to surface here. Verified by `grep -c "tr.header td\|current-player"` style markers across the five files.
- **[BAIXO] long `if` chain of single-cell offsets rather than a delta map.** Lines wrapping `case "ArrowUp" / "Down" / "Left" / "Right"` in `newMovement` each duplicate `…body[0].x++; if (=== 30) { -= 30 }` patterns. Other subprojects store `acceptedMoves` as a `{ArrowUp: {dx, dy}, …}` map; this one folds both the dispatch and the wrap into a `switch`. A delta map would not change behavior — only surface area.
