const BOOST_DURATION_MS = 6000
const POWER_UP_SPAWN_MS = 8000
const BOOSTED_STEP = 3

export default function createGame() {
    const state = {
        players: {},
        fruits: {},
        powerUps: {},
        playerBoosts: {},
        screen: {
            width: 10,
            height: 10
        }
    }

    const observers = []

    function start() {
        const frequency = 2000

        setInterval(addFruit, frequency)
        setInterval(addPowerUp, POWER_UP_SPAWN_MS)
        setInterval(scanExpiredBoosts, 1000)
    }

    function subscribe(observerFunction) {
        observers.push(observerFunction)
    }

    function notifyAll(command) {
        for (const observerFunction of observers) {
            observerFunction(command)
        }
    }

    function setState(newState) {
        Object.assign(state, newState)
    }

    function addPlayer(command) {
        const playerId = command.playerId
        const playerX = 'playerX' in command ? command.playerX : Math.floor(Math.random() * state.screen.width)
        const playerY = 'playerY' in command ? command.playerY : Math.floor(Math.random() * state.screen.height)

        state.players[playerId] = {
            x: playerX,
            y: playerY
        }

        notifyAll({
            type: 'add-player',
            playerId: playerId,
            playerX: playerX,
            playerY: playerY
        })
    }

    function removePlayer(command) {
        const playerId = command.playerId

        delete state.players[playerId]

        if (state.playerBoosts[playerId]) {
            delete state.playerBoosts[playerId]
            notifyAll({
                type: 'unboost-player',
                playerId: playerId
            })
        }

        notifyAll({
            type: 'remove-player',
            playerId: playerId
        })
    }

    function addFruit(command) {
        const fruitId = command ? command.fruitId : Math.floor(Math.random() * 10000000)
        const fruitX = command ? command.fruitX : Math.floor(Math.random() * state.screen.width)
        const fruitY = command ? command.fruitY : Math.floor(Math.random() * state.screen.height)

        state.fruits[fruitId] = {
            x: fruitX,
            y: fruitY
        }

        notifyAll({
            type: 'add-fruit',
            fruitId: fruitId,
            fruitX: fruitX,
            fruitY: fruitY
        })
    }

    function removeFruit(command) {
        const fruitId = command.fruitId

        delete state.fruits[fruitId]

        notifyAll({
            type: 'remove-fruit',
            fruitId: fruitId,
        })
    }

    function movePlayer(command) {
        notifyAll(command)

        const acceptedMoves = {
            ArrowUp(player) {
                if (player.y - 1 >= 0) {
                    player.y = player.y - 1
                }
            },
            ArrowRight(player) {
                if (player.x + 1 < state.screen.width) {
                    player.x = player.x + 1
                }
            },
            ArrowDown(player) {
                if (player.y + 1 < state.screen.height) {
                    player.y = player.y + 1
                }
            },
            ArrowLeft(player) {
                if (player.x - 1 >= 0) {
                    player.x = player.x - 1
                }
            }
        }

        const keyPressed = command.keyPressed
        const playerId = command.playerId
        const player = state.players[playerId]
        const moveFunction = acceptedMoves[keyPressed]

        if (player && moveFunction) {
            const boosted = state.playerBoosts[playerId] && state.playerBoosts[playerId].expiresAt > Date.now()
            const stepCount = boosted ? BOOSTED_STEP : 1

            for (let i = 0; i < stepCount; i++) {
                const beforeX = player.x
                const beforeY = player.y
                moveFunction(player)
                if (player.x === beforeX && player.y === beforeY) {
                    break
                }
                checkForPowerUpCollision(playerId)
                if (!boosted) {
                    break
                }
            }
            checkForFruitCollision(playerId)
        }

    }

    function checkForFruitCollision(playerId) {
        const player = state.players[playerId]

        for (const fruitId in state.fruits) {
            const fruit = state.fruits[fruitId]
            console.log(`Checking ${playerId} and ${fruitId}`)

            if (player.x === fruit.x && player.y === fruit.y) {
                console.log(`COLLISION between ${playerId} and ${fruitId}`)
                removeFruit({ fruitId: fruitId })
            }
        }
    }

    function generatePowerUpId() {
        return Math.floor(Math.random() * 10000000)
    }

    function isCellOccupied(x, y) {
        for (const playerId in state.players) {
            const player = state.players[playerId]
            if (player.x === x && player.y === y) {
                return true
            }
        }
        for (const fruitId in state.fruits) {
            const fruit = state.fruits[fruitId]
            if (fruit.x === x && fruit.y === y) {
                return true
            }
        }
        return false
    }

    function addPowerUp(command) {
        // If a power-up is already on the map, replace it: notify clients to drop the stale one first.
        for (const existingId in state.powerUps) {
            removePowerUp({ powerUpId: existingId })
        }

        const powerUpId = command && command.powerUpId !== undefined ? command.powerUpId : generatePowerUpId()

        let powerUpX, powerUpY
        let attempts = 0
        do {
            powerUpX = Math.floor(Math.random() * state.screen.width)
            powerUpY = Math.floor(Math.random() * state.screen.height)
            attempts++
        } while (isCellOccupied(powerUpX, powerUpY) && attempts < 50)

        if (isCellOccupied(powerUpX, powerUpY)) {
            // No free cell found; give up this cycle.
            return
        }

        state.powerUps[powerUpId] = {
            x: powerUpX,
            y: powerUpY
        }

        notifyAll({
            type: 'add-power-up',
            powerUpId: powerUpId,
            x: powerUpX,
            y: powerUpY
        })
    }

    function removePowerUp(command) {
        const powerUpId = command.powerUpId

        if (!state.powerUps[powerUpId]) {
            return
        }

        delete state.powerUps[powerUpId]

        notifyAll({
            type: 'remove-power-up',
            powerUpId: powerUpId
        })
    }

    function pickupPowerUp(command) {
        const playerId = command.playerId
        const powerUpId = command.powerUpId

        if (!state.powerUps[powerUpId]) {
            return
        }

        removePowerUp({ powerUpId: powerUpId })

        state.playerBoosts[playerId] = {
            expiresAt: Date.now() + BOOST_DURATION_MS
        }

        notifyAll({
            type: 'boost-player',
            playerId: playerId
        })
    }

    function removeSpeedBoost(command) {
        const playerId = command.playerId
        const speedBoostUntil = state.playerBoosts[playerId] && state.playerBoosts[playerId].expiresAt

        if (speedBoostUntil === undefined) {
            return
        }

        delete state.playerBoosts[playerId]

        notifyAll({
            type: 'unboost-player',
            playerId: playerId
        })
    }

    function scanExpiredBoosts() {
        const now = Date.now()
        for (const playerId in state.playerBoosts) {
            if (state.playerBoosts[playerId].expiresAt <= now) {
                removeSpeedBoost({ playerId: playerId })
            }
        }
    }

    function checkForPowerUpCollision(playerId) {
        const player = state.players[playerId]
        if (!player) {
            return
        }

        for (const powerUpId in state.powerUps) {
            const powerUp = state.powerUps[powerUpId]
            if (player.x === powerUp.x && player.y === powerUp.y) {
                pickupPowerUp({ playerId: playerId, powerUpId: powerUpId })
                return
            }
        }
    }

    return {
        addPlayer,
        removePlayer,
        movePlayer,
        addFruit,
        removeFruit,
        addPowerUp,
        removePowerUp,
        pickupPowerUp,
        removeSpeedBoost,
        state,
        setState,
        subscribe,
        start
    }
}
