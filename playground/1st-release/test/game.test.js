import { test } from 'node:test'
import assert from 'node:assert/strict'
import createGame from '../public/game.js'

test('addPlayer adds the player to state.players', () => {
    const game = createGame()

    game.addPlayer({ playerId: 'p1', playerX: 2, playerY: 3 })

    assert.deepEqual(game.state.players['p1'], { x: 2, y: 3 })
})

test('removePlayer deletes the player from state.players', () => {
    const game = createGame()

    game.addPlayer({ playerId: 'p2', playerX: 0, playerY: 0 })
    game.removePlayer({ playerId: 'p2' })

    assert.equal(('p2' in game.state.players), false)
})

test('movePlayer ArrowRight from inside the board moves +1 on x', () => {
    const game = createGame()

    game.addPlayer({ playerId: 'p', playerX: 4, playerY: 4 })
    game.movePlayer({ type: 'move-player', playerId: 'p', keyPressed: 'ArrowRight' })

    assert.deepEqual(game.state.players['p'], { x: 5, y: 4 })
})

test('movePlayer ArrowUp from (x,0) does NOT exit the top border', () => {
    const game = createGame()

    game.addPlayer({ playerId: 'p', playerX: 3, playerY: 0 })
    game.movePlayer({ type: 'move-player', playerId: 'p', keyPressed: 'ArrowUp' })

    assert.deepEqual(game.state.players['p'], { x: 3, y: 0 })
})

test('movePlayer ArrowLeft from (0,y) does NOT exit the left border', () => {
    const game = createGame()

    game.addPlayer({ playerId: 'p', playerX: 0, playerY: 5 })
    game.movePlayer({ type: 'move-player', playerId: 'p', keyPressed: 'ArrowLeft' })

    assert.deepEqual(game.state.players['p'], { x: 0, y: 5 })
})

test('movePlayer ArrowDown from (x,9) does NOT exit the bottom border', () => {
    const game = createGame()

    game.addPlayer({ playerId: 'p', playerX: 5, playerY: 9 })
    game.movePlayer({ type: 'move-player', playerId: 'p', keyPressed: 'ArrowDown' })

    assert.deepEqual(game.state.players['p'], { x: 5, y: 9 })
})

test('movePlayer ArrowRight from (9,y) does NOT exit the right border', () => {
    const game = createGame()

    game.addPlayer({ playerId: 'p', playerX: 9, playerY: 5 })
    game.movePlayer({ type: 'move-player', playerId: 'p', keyPressed: 'ArrowRight' })

    assert.deepEqual(game.state.players['p'], { x: 9, y: 5 })
})

test('movePlayer ArrowDown from inside the board moves +1 on y', () => {
    const game = createGame()

    game.addPlayer({ playerId: 'p', playerX: 4, playerY: 4 })
    game.movePlayer({ type: 'move-player', playerId: 'p', keyPressed: 'ArrowDown' })

    assert.deepEqual(game.state.players['p'], { x: 4, y: 5 })
})

test('walking onto a fruit removes the fruit from state.fruits', () => {
    const game = createGame()

    game.addPlayer({ playerId: 'p', playerX: 1, playerY: 1 })
    game.addFruit({ fruitId: 'f1', fruitX: 1, fruitY: 2 })
    game.movePlayer({ type: 'move-player', playerId: 'p', keyPressed: 'ArrowDown' })

    assert.equal(('f1' in game.state.fruits), false)
})

test('movePlayer with an unknown keyPressed does not change the player position', () => {
    const game = createGame()
    const unknownKeys = ['w', 'Space', 'Enter', '']

    game.addPlayer({ playerId: 'p', playerX: 3, playerY: 3 })

    for (const keyPressed of unknownKeys) {
        game.movePlayer({ type: 'move-player', playerId: 'p', keyPressed })
        assert.deepEqual(game.state.players['p'], { x: 3, y: 3 })
    }
})
