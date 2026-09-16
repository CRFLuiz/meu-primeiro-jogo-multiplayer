# playground/chess vs playground/implementacao-teleporte

Quick comparison of the two playground experiments on top of the same socket.io
transport pattern (see `server.js` in each folder).

- **Game feel:** `playground/chess` is an 8x8 board with pawn-like fruit-protection
  rules, king-proximity rules, diagonal keys (`a/s/z/x`), and audio cues for new/eaten/
  illegal moves. `playground/implementacao-teleporte` is a 10x10 grid where none of
  those guardrails exist — any arrow key is valid and there are no audio events.
- **Movement / borders:** `playground/chess` rejects moves that would leave the
  board (`if moveX >= 0 ... if moveX < state.screen.width`, etc.). The teleporte
  variant replaces every boundary check with `mod = (x, y) => ((y % x) + x) % x`
  from `utils.js`, so walking off any edge wraps the player to the opposite side —
  that single helper *is* the teleport-across-borders mechanic.
- **State carried per player:** `playground/chess` stores `{ x, y, score }` (and
  keeps a `playerName` read from the socket handshake). `implementacao-teleporte`
  stores only `{ x, y }` — no score, no name, which is also why its `server.js`
  stopped reading `query.userName`. Fruits are removed on collision but don't
  increment anything; winning appears to be just clearing fruit.

- **Fruit-spawn cadence across variants** (all `setInterval(addFruit, ...)` calls
  in `playground/`): most variants land on a 2000 ms default — `1st-release`,
  `implementacao-teleporte`, `player-collision-novos-pots`, `pontuacao-e-skin`,
  and `pwa-pod`. The slower outliers are `chess` (3000 ms), `implementacao-pontuacao`
  (4000 ms; bigger 25x25 board, slowing the +1 score loop), and `implementacao-snake`
  (6000 ms, inline literal). `player-collision-novos-pots` is also effectively
  faster than its 2000 ms because `explodeFruits` calls `addFruit` again on every
  wall hit and PvP crash.
