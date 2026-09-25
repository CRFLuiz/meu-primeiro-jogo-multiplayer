# Reconexão Automática

## O que é

Este é um dos experimentos do playground do repositório
[`CRFLuiz/meu-primeiro-jogo-multiplayer`](https://github.com/CRFLuiz/meu-primeiro-jogo-multiplayer).
Ele parte do esqueleto do `1st-release/` e adiciona uma **janela de graça** para
reconexão: quando um jogador cai do servidor Socket.io, o slot e o estado
(posição, pontuação, `sessionId`) ficam reservados por um curto período
(padrão **30s**). Se o cliente reconectar dentro dessa janela usando o mesmo
`sessionId` (persistido em `localStorage`), ele retoma o mesmo slot em vez de
ser tratado como um jogador novo. Se o tempo expirar, o slot é liberado e o
jogador é removido normalmente.

## Como rodar

```bash
cd playground/reconexao-automatica
npm install
npm start
```

Por padrão o servidor sobe em `http://localhost:3000`. Para mudar a porta:

```bash
PORT=4000 npm start
```

Para usar uma janela de graça diferente (em milissegundos):

```bash
RECONNECTION_GRACE_MS=60000 npm start
```

## Contrato

- **Janela de graça padrão:** 30 segundos (`RECONNECTION_GRACE_MS=30000`).
- **Identificador de sessão:** opaco, gerado no servidor via
  `crypto.randomUUID()` no primeiro `setup`, devolvido ao cliente no mesmo
  payload e persistido no `localStorage` do navegador (`sessionId`). Ele é
  reenviado no `handshake.query.sessionId` de qualquer nova conexão.
- **Persistência da reserva:** o `pendingCleanup` mora apenas na memória do
  processo do servidor. Se o servidor for reiniciado durante a janela, a
  reserva é perdida e o cliente volta como um jogador novo.
- **Reuso do mesmo `sessionId` em abas/dispositivos diferentes:** não é
  suportado — uma segunda conexão chegando com o mesmo `sessionId` durante
  a janela é tratada como um novo jogador.
- **Sem autenticação:** o `sessionId` é opaco e não confiável; ele só serve
  para casar a nova conexão com o slot reservado na janela de graça.

## Teste manual

1. Abra duas abas em `http://localhost:3000` (use uma janela anônima para
   garantir que cada aba começa sem `sessionId`).
2. Na aba A, mova o jogador com as setas do teclado. Confirme que ele aparece
   na aba B como um quadrado amarelo (o "current player") ou preto
   (qualquer outro).
3. Feche a aba A. Observe que a aba B continua mostrando a posição do
   jogador — ele não desaparece imediatamente.
4. Dentro de 30s, reabra `http://localhost:3000` na aba A (no mesmo
   navegador, ou copiando o `sessionId` do `localStorage` para outro). O
   jogador reaparece na mesma posição e o evento `restore-player` é emitido
   para todos os clientes.
5. Aguarde 30s antes de reabrir. O slot é liberado, o jogador some da aba B
   e uma nova entrada é criada quando você reabre.

Para usar uma janela menor nos testes, suba o servidor com
`RECONNECTION_GRACE_MS=2000 npm start`.

## Teste automatizado

O arquivo `test/reconnection.test.js` usa `node:test` + `node:assert/strict`
+ `socket.io-client` para validar os três cenários principais:

- **Disco sem reconexão** — depois da janela, `remove-player` é emitido e o
  jogador some do estado.
- **Reconexão dentro da janela** — o `restore-player` é broadcast com o
  `playerId`, `x`, `y`, `score` e `sessionId` preservados; `remove-player`
  nunca é emitido para esse jogador.
- **`sessionId` desconhecido** — o servidor trata a conexão como fresh e
  devolve um novo `sessionId` no `setup`.

O servidor é iniciado como subprocesso do Node em porta efêmera
(`PORT=0`) com `RECONNECTION_GRACE_MS` configurável por cenário, e
encerrado no `after` de cada teste. Para rodar:

```bash
npm install
npm test
```
