import createGame from './game.js'
import createKeyboardListener from './keyboard-listener.js'
import renderScreen from './render-screen.js'

const stored = localStorage.getItem('sessionId')
const socket = io({ query: stored ? { sessionId: stored } : {} })
const statusEl = document.getElementById('connection-status')
let graceMs = 30000
let currentPlayerId = null

const keyboardListener = createKeyboardListener(document)
const game = createGame()

keyboardListener.subscribe((command) => socket.emit('move-player', command))

socket.on('setup', (state) => {
    graceMs = state.graceMs ?? graceMs
    if (state.sessionId) {
        localStorage.setItem('sessionId', state.sessionId)
    }
    game.setState(state)

    currentPlayerId = socket.id
    const screen = document.getElementById('screen')
    renderScreen(screen, game, requestAnimationFrame, currentPlayerId)

    keyboardListener.registerPlayerId(currentPlayerId)
    socket.emit('ready')
})

socket.on('add-player', (command) => game.addPlayer(command))
socket.on('remove-player', (command) => game.removePlayer(command))
socket.on('move-player', (command) => {
    if (currentPlayerId && currentPlayerId === command.playerId) {
        return
    }
    game.movePlayer(command)
})
socket.on('add-fruit', (command) => game.addFruit(command))
socket.on('remove-fruit', (command) => game.removeFruit(command))
socket.on('restore-player', (command) => game.restorePlayer(command))

socket.on('disconnect', () => {
    statusEl.hidden = false
    statusEl.textContent = 'Reconectando…'
    const intervalId = setInterval(() => {
        if (socket.connected) {
            clearInterval(intervalId)
            return
        }
        statusEl.textContent = 'Reconectando… (verifique sua conexão)'
    }, 1000)
    socket.on('connect', () => clearInterval(intervalId))
})

socket.on('connect', () => {
    statusEl.hidden = true
})
