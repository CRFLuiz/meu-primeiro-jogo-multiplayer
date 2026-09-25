import express from 'express'
import http from 'http'
import createGame from './public/game.js'
import socketio from 'socket.io'

const MATCH_DURATION_MS = 60 * 1000
let matchStarted = false

const app = express()
const server = http.createServer(app)
const sockets = socketio(server)

app.use(express.static('public'))

const game = createGame()
game.start()

game.subscribe((command) => {
    console.log(`> Emitting ${command.type}`)
    sockets.emit(command.type, command)
})

function fireGameOver() {
    let winnerPlayerId = null
    let highestScore = -Infinity

    for (const playerId in game.state.players) {
        const player = game.state.players[playerId]
        if (player.score > highestScore) {
            highestScore = player.score
            winnerPlayerId = playerId
        }
    }

    const scores = Object.fromEntries(
        Object.entries(game.state.players).map(([id, p]) => [id, p.score])
    )

    game.setState({
        isGameOver: true,
        endTime: Date.now()
    })

    sockets.emit('game-over', { winnerPlayerId, scores })
}

sockets.on('connection', (socket) => {
    const playerId = socket.id
    console.log(`> Player connected: ${playerId}`)

    if (!matchStarted) {
        matchStarted = true
        setTimeout(fireGameOver, MATCH_DURATION_MS)
    }

    game.addPlayer({ playerId: playerId })

    socket.emit('setup', game.state)

    socket.on('disconnect', () => {
        game.removePlayer({ playerId: playerId })
        console.log(`> Player disconnected: ${playerId}`)
    })

    socket.on('move-player', (command) => {
        command.playerId = playerId
        command.type = 'move-player'
        
        game.movePlayer(command)
    })
})

server.listen(3000, () => {
    console.log(`> Server listening on port: 3000`)
})