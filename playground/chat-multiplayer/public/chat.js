function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

const MAX_ENTRIES = 100

export default function createChat(socket) {
    const chatLog = document.getElementById('chat-log')
    const chatForm = document.getElementById('chat-form')
    const chatInput = document.getElementById('chat-input')

    if (!chatLog || !chatForm || !chatInput) {
        console.log('Receiving chat -> skipped (chat DOM not found)')
        return
    }

    socket.on('chat-message', (msg) => {
        if (!msg || typeof msg.message !== 'string' || typeof msg.playerName !== 'string') {
            return
        }

        console.log(`Receiving chat-message -> ${msg.playerId}`)

        const li = document.createElement('li')
        const nameEl = document.createElement('b')
        nameEl.textContent = msg.playerName
        const text = document.createTextNode(`: ${msg.message}`)
        li.appendChild(nameEl)
        li.appendChild(text)
        chatLog.appendChild(li)

        while (chatLog.childElementCount > MAX_ENTRIES) {
            chatLog.removeChild(chatLog.firstChild)
        }

        chatLog.scrollTop = chatLog.scrollHeight
    })

    chatForm.addEventListener('submit', (event) => {
        event.preventDefault()

        const message = chatInput.value.trim()

        if (message.length === 0) {
            return
        }

        socket.emit('chat-message', { message })

        chatInput.value = ''
    })
}
