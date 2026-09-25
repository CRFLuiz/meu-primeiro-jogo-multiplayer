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

io.on('connection', (socket) => {
    const playerId = socket.id
    const room = socket.handshake.query.room || 'default'
    const playerName = socket.handshake.query.userName || 'Anon'

    socket.join(room)

    console.log(`> Player connected on room '${room}' with id ${playerId} and Name ${playerName}`)

    game.addPlayer({ playerId: playerId, room: room, playerName: playerName })

    socket.emit('setup', game.state)

    socket.on('disconnect', () => {
        socket.leave(room)
        game.removePlayer({ playerId: playerId, room: room })
        console.log(`> Player disconnected: ${playerId}`)
    })

    socket.on('move-player', (command) => {
        command.playerId = playerId
        command.type = 'move-player'
        command.room = room

        game.movePlayer(command)
    })
})

server.listen(3000, () => {
    console.log(`> Server listening on port: 3000`)
})