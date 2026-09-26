import express from 'express'
import http from 'http'
import createGame from './public/game.js'
import socketio from 'socket.io'

const app = express()
const server = http.createServer(app)
const io = socketio(server)

app.use(express.static('public'))

const game = createGame()
game.start()

game.subscribe((command) => {
    console.log(`> Emitting ${command.type}`)
    io.to(command.room).emit(command.type, command)
})

const playerMeta = new Map()

io.on('connection', (socket) => {
    const playerId = socket.id
    const room = socket.handshake.query.room || 'default'
    const playerName = socket.handshake.query.userName || 'Anon'

    socket.join(room)

    console.log(`> Player connected on room '${room}' with id ${playerId} and Name ${playerName}`)

    playerMeta.set(playerId, { room, playerName })

    game.addPlayer({ playerId: playerId, room: room, playerName: playerName })

    socket.emit('setup', game.state)

    socket.on('disconnect', () => {
        socket.leave(room)
        playerMeta.delete(playerId)
        game.removePlayer({ playerId: playerId, room: room })
        console.log(`> Player disconnected: ${playerId}`)
    })

    socket.on('move-player', (command) => {
        command.playerId = playerId
        command.type = 'move-player'
        command.room = room

        game.movePlayer(command)
    })

    socket.on('chat-message', (payload) => {
        if (!payload || typeof payload.message !== 'string') {
            return
        }

        const message = payload.message.trim()

        if (message.length === 0 || message.length > 200) {
            return
        }

        const meta = playerMeta.get(playerId)
        const metaRoom = meta ? meta.room : room
        const metaName = meta ? meta.playerName : playerName

        console.log(`> Emitting chat-message from ${playerId} on room '${metaRoom}'`)

        io.to(metaRoom).emit('chat-message', {
            playerId,
            playerName: metaName,
            message,
            room: metaRoom,
            ts: Date.now()
        })
    })
})

server.listen(3000, () => {
    console.log(`> Server listening on port: 3000`)
})