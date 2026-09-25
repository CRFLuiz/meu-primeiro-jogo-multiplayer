import express from 'express'
import http from 'http'
import { randomUUID } from 'node:crypto'
import createGame from './public/game.js'
import socketio from 'socket.io'

const RECONNECTION_GRACE_MS = Number(process.env.RECONNECTION_GRACE_MS) || 30_000
const PORT = process.env.PORT || 3000

const app = express()
const server = http.createServer(app)
const sockets = socketio(server)

app.use(express.static('public'))

const game = createGame()
game.start()

const pendingCleanup = new Map()

game.subscribe((command) => {
    console.log(`> Emitting ${command.type}`)
    sockets.emit(command.type, command)
})

sockets.on('connection', (socket) => {
    const incomingSessionId = socket.handshake.query.sessionId
    const existingEntry = incomingSessionId
        ? findPendingBySessionId(incomingSessionId)
        : null

    if (existingEntry) {
        // Reconnect branch
        const playerId = existingEntry.playerId
        clearTimeout(existingEntry.timer)
        pendingCleanup.delete(playerId)

        if (game.state.players[playerId]) {
            game.state.players[playerId].connected = true
            game.state.players[playerId].disconnectedAt = null
        }

        socket.playerId = playerId

        const snapshot = game.state.players[playerId]
        sockets.emit('restore-player', {
            playerId,
            x: snapshot.x,
            y: snapshot.y,
            score: snapshot.score,
            sessionId: incomingSessionId
        })

        socket.emit('setup', {
            ...game.state,
            sessionId: incomingSessionId,
            graceMs: RECONNECTION_GRACE_MS
        })

        socket.on('move-player', (command) => {
            command.playerId = playerId
            game.movePlayer(command)
        })

        socket.on('disconnect', () => {
            console.log(`> Player disconnected (reconnect branch): ${playerId}`)
            onDisconnect(playerId, incomingSessionId)
        })

        console.log(`> Player reconnected: ${playerId} via session ${incomingSessionId}`)
        return
    }

    // Fresh connect branch
    const sessionId = randomUUID()
    const playerId = socket.id
    console.log(`> Player connected: ${playerId} (session ${sessionId})`)

    game.addPlayer({ playerId, sessionId })

    socket.emit('setup', {
        ...game.state,
        sessionId,
        graceMs: RECONNECTION_GRACE_MS
    })

    socket.on('move-player', (command) => {
        command.playerId = playerId
        command.type = 'move-player'

        game.movePlayer(command)
    })

    socket.on('disconnect', () => {
        console.log(`> Player disconnected (fresh branch): ${playerId}`)
        onDisconnect(playerId, sessionId)
    })
})

function findPendingBySessionId(sessionId) {
    for (const [playerId, entry] of pendingCleanup.entries()) {
        if (entry.sessionId === sessionId) {
            return { playerId, ...entry }
        }
    }
    return null
}

function onDisconnect(playerId, sessionId) {
    const player = game.state.players[playerId]

    if (!player) {
        return
    }

    const snapshot = { ...player }
    const disconnectedAt = Date.now()

    player.connected = false
    player.disconnectedAt = disconnectedAt

    const timer = setTimeout(() => {
        finalizeRemoval(playerId)
    }, RECONNECTION_GRACE_MS)

    pendingCleanup.set(playerId, { timer, sessionId, snapshot, disconnectedAt })
}

function finalizeRemoval(playerId) {
    pendingCleanup.delete(playerId)
    game.removePlayer({ playerId })
}

server.listen(PORT, () => {
    const actualPort = server.address().port
    console.log(`> Server listening on port: ${actualPort} (grace ${RECONNECTION_GRACE_MS}ms)`)
})
