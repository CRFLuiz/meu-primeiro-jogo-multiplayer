export default function renderScreen(screen, game, requestAnimationFrame, currentPlayerId) {
    const context = screen.getContext('2d')
    context.fillStyle = 'white'
    context.clearRect(0, 0, 10, 10)

    for (const playerId in game.state.players) {
        const player = game.state.players[playerId]
        const isBoosted = !!game.state.playerBoosts[playerId]
        context.fillStyle = isBoosted ? '#FF4136' : 'black'
        context.fillRect(player.x, player.y, 1, 1)
    }

    for (const powerUpId in game.state.powerUps) {
        const powerUp = game.state.powerUps[powerUpId]
        context.fillStyle = '#3D9970'
        context.fillRect(powerUp.x, powerUp.y, 1, 1)
    }

    for (const fruitId in game.state.fruits) {
        const fruit = game.state.fruits[fruitId]
        context.fillStyle = 'green'
        context.fillRect(fruit.x, fruit.y, 1, 1)
    }

    const currentPlayer = game.state.players[currentPlayerId]

    if(currentPlayer && !game.state.playerBoosts[currentPlayerId]) {
        context.fillStyle = '#F0DB4F'
        context.fillRect(currentPlayer.x, currentPlayer.y, 1, 1)
    }

    requestAnimationFrame(() => {
        renderScreen(screen, game, requestAnimationFrame, currentPlayerId)
    })
}
