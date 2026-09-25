import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ioc from 'socket.io-client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SERVER_PATH = path.join(__dirname, '..', 'server.js')

const LISTENING_REGEX = /> Server listening on port: (\d+) \(grace (\d+)ms\)/

function startServer(graceMs) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [SERVER_PATH], {
            env: {
                ...process.env,
                PORT: '0',
                RECONNECTION_GRACE_MS: String(graceMs)
            },
            stdio: ['ignore', 'pipe', 'pipe']
        })

        let stderr = ''
        let stdout = ''

        const onChunk = (stream, side) => (chunk) => {
            const text = chunk.toString()
            if (side === 'out') {
                stdout += text
                process.stdout.write(`[server] ${text}`)
            } else {
                stderr += text
                process.stderr.write(`[server-err] ${text}`)
            }
            const match = stdout.match(LISTENING_REGEX)
            if (match) {
                child.stdout.off('data', onChunk(child.stdout, 'out'))
                child.stderr.off('data', onChunk(child.stderr, 'err'))
                resolve({
                    child,
                    port: Number(match[1]),
                    graceMs: Number(match[2])
                })
            }
        }

        child.stdout.on('data', onChunk(child.stdout, 'out'))
        child.stderr.on('data', onChunk(child.stderr, 'err'))

        child.on('error', (err) => {
            reject(err)
        })

        child.on('exit', (code) => {
            if (!child.stdout.listenerCount('data')) {
                reject(new Error(`Server exited (code=${code}) before listening. stderr=${stderr}`))
            }
        })

        setTimeout(() => {
            reject(new Error(`Timed out waiting for server to listen. stderr=${stderr}`))
        }, 10000)
    })
}

function stopServer(child) {
    return new Promise((resolve) => {
        if (!child || child.killed) {
            resolve()
            return
        }
        child.once('exit', () => resolve())
        child.kill('SIGTERM')
        setTimeout(() => {
            if (!child.killed) {
                child.kill('SIGKILL')
            }
        }, 2000)
    })
}

function waitForEvent(socket, event, predicate = () => true, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, handler)
            reject(new Error(`Timed out waiting for '${event}'`))
        }, timeoutMs)

        const handler = (payload) => {
            if (predicate(payload)) {
                clearTimeout(timer)
                socket.off(event, handler)
                resolve(payload)
            }
        }
        socket.on(event, handler)
    })
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function connectClient(port, query = {}) {
    return ioc(`http://localhost:${port}`, {
        transports: ['websocket'],
        query,
        forceNew: true,
        reconnection: false
    })
}

let server = null
let observerSocket = null
let removePlayerEvents = []
let addPlayerEvents = []
let restorePlayerEvents = []

function setupObserver(port) {
    const sock = connectClient(port)
    removePlayerEvents = []
    addPlayerEvents = []
    restorePlayerEvents = []
    sock.on('remove-player', (cmd) => removePlayerEvents.push(cmd))
    sock.on('add-player', (cmd) => addPlayerEvents.push(cmd))
    sock.on('restore-player', (cmd) => restorePlayerEvents.push(cmd))
    return new Promise((resolve) => sock.on('setup', () => resolve(sock)))
}

test('disconnect only → after grace expires, remove-player fires and player is gone', async (t) => {
    const graceMs = 600
    server = await startServer(graceMs)
    t.after(async () => {
        await stopServer(server.child)
        server = null
    })

    observerSocket = await setupObserver(server.port)

    const client = connectClient(server.port)
    const setupPayload = await waitForEvent(client, 'setup')
    const playerId = client.id

    await wait(100)
    assert.equal(observerSocket.connected, true)
    assert.equal(removePlayerEvents.length, 0)

    client.disconnect()

    await wait(graceMs - 200)
    assert.equal(removePlayerEvents.length, 0, 'no remove-player should fire during grace window')

    await wait(700)
    assert.equal(removePlayerEvents.length, 1, 'remove-player should fire after grace expires')
    assert.equal(removePlayerEvents[0].playerId, playerId)

    observerSocket.disconnect()
})

test('reconnect within window → state restored, no remove-player ever emitted', async (t) => {
    const graceMs = 800
    server = await startServer(graceMs)
    t.after(async () => {
        await stopServer(server.child)
        server = null
    })

    observerSocket = await setupObserver(server.port)

    const clientA = connectClient(server.port)
    const setupA = await waitForEvent(clientA, 'setup')
    const playerId = setupA.players[clientA.id] ? clientA.id : clientA.id
    const sessionId = setupA.sessionId
    assert.ok(sessionId, 'server should send sessionId on setup')

    clientA.disconnect()
    await wait(200)

    const restorePromise = waitForEvent(observerSocket, 'restore-player', (cmd) => cmd.sessionId === sessionId)
    const clientB = connectClient(server.port, { sessionId })
    const setupB = await waitForEvent(clientB, 'setup')
    assert.equal(setupB.sessionId, sessionId, 'reconnect must reuse the same sessionId')

    const restoreEvent = await restorePromise
    assert.equal(restoreEvent.playerId, playerId)
    assert.equal(restoreEvent.sessionId, sessionId)
    assert.ok('x' in restoreEvent && 'y' in restoreEvent && 'score' in restoreEvent)

    await wait(graceMs * 2)
    assert.equal(removePlayerEvents.length, 0, 'no remove-player should fire for a reconnected player')

    clientB.disconnect()
    observerSocket.disconnect()
})

test('reconnect with unknown sessionId → treated as fresh connect', async (t) => {
    const graceMs = 1000
    server = await startServer(graceMs)
    t.after(async () => {
        await stopServer(server.child)
        server = null
    })

    observerSocket = await setupObserver(server.port)

    const fakeSessionId = 'definitely-not-real'
    const client = connectClient(server.port, { sessionId: fakeSessionId })
    const setupPayload = await waitForEvent(client, 'setup')
    assert.notEqual(setupPayload.sessionId, fakeSessionId, 'server should issue a NEW sessionId for unknown tokens')
    assert.ok(setupPayload.sessionId && setupPayload.sessionId.length > 0, 'new sessionId must be present')

    await wait(200)
    const addEvent = addPlayerEvents.find((cmd) => cmd.playerId === client.id)
    assert.ok(addEvent, 'add-player must fire for the freshly accepted player')

    client.disconnect()
    observerSocket.disconnect()
})
