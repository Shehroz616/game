// Server entry point — Express + Socket.io

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameManager = require('./game/GameManager');
const { PHASES } = require('./game/constants');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const gameManager = new GameManager();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`⚡ Player connected: ${socket.id}`);

  // ─── HOST: Create a new game room ───
  socket.on('create-room', ({ hostName, totalRounds }) => {
    try {
      const room = gameManager.createRoom(socket.id, hostName, totalRounds);
      socket.join(room.roomCode);
      socket.emit('room-created', {
        roomCode: room.roomCode,
        totalRounds: room.totalRounds,
        hostName: room.hostName
      });
      console.log(`🏠 Room ${room.roomCode} created by ${hostName}`);
    } catch (err) {
      socket.emit('error-msg', { message: 'Failed to create room.' });
    }
  });

  // ─── PLAYER: Join an existing room ───
  socket.on('join-room', ({ roomCode, playerName }) => {
    const result = gameManager.joinRoom(roomCode, socket.id, playerName);

    if (result.error) {
      socket.emit('error-msg', { message: result.error });
      return;
    }

    const room = result.room;
    socket.join(room.roomCode);

    // Notify player they joined successfully
    socket.emit('joined-room', {
      roomCode: room.roomCode,
      playerName,
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      totalRounds: room.totalRounds,
      hostName: room.hostName
    });

    // Notify everyone in the room about updated player list
    io.to(room.roomCode).emit('player-joined', {
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      phase: room.phase,
      newPlayer: playerName
    });

    console.log(`👤 ${playerName} joined room ${room.roomCode} (${room.players.length}/4)`);
  });

  // ─── HOST: Start a new round ───
  socket.on('start-round', ({ roomCode }) => {
    const result = gameManager.startRound(roomCode);

    if (result.error) {
      socket.emit('error-msg', { message: result.error });
      return;
    }

    const { room, round } = result;

    // Send role info to each player individually
    room.players.forEach(player => {
      const roleInfo = round.getRoleInfoForPlayer(player.id);
      io.to(player.id).emit('round-started', {
        roundNumber: room.currentRound,
        totalRounds: room.totalRounds,
        ...roleInfo
      });
    });

    // Send role info to host (host sees Badsha & Wazeer like everyone else)
    const badshaId = round.getPlayerByRole('badsha');
    const wazeerId = round.getPlayerByRole('wazeer');
    const badshaPlayer = room.players.find(p => p.id === badshaId);
    const wazeerPlayer = room.players.find(p => p.id === wazeerId);
    const hiddenPlayers = room.players.filter(p =>
      round.roles[p.id] === 'sipahi' || round.roles[p.id] === 'chor'
    );

    io.to(room.hostSocketId).emit('host-round-started', {
      roundNumber: room.currentRound,
      totalRounds: room.totalRounds,
      badsha: { id: badshaId, name: badshaPlayer.name },
      wazeer: { id: wazeerId, name: wazeerPlayer.name },
      hiddenPlayers: hiddenPlayers.map(p => ({ id: p.id, name: p.name }))
    });

    console.log(`🎴 Round ${room.currentRound} started in room ${room.roomCode}`);
  });

  // ─── WAZEER: Submit guess ───
  socket.on('wazeer-guess', ({ roomCode, guessedPlayerId }) => {
    const result = gameManager.handleGuess(roomCode, socket.id, guessedPlayerId);

    if (result.error) {
      socket.emit('error-msg', { message: result.error });
      return;
    }

    // Send results to all players and host
    io.to(roomCode).emit('round-result', {
      results: result.results,
      totalScores: result.totalScores,
      isGameOver: result.isGameOver
    });

    console.log(`🎯 Wazeer guessed ${result.results.wasCorrect ? 'CORRECTLY' : 'WRONG'} in room ${roomCode}`);

    if (result.isGameOver) {
      io.to(roomCode).emit('game-over', {
        finalScores: result.totalScores.sort((a, b) => b.totalScore - a.totalScore),
        roundHistory: result.room.roundHistory
      });
      console.log(`🏁 Game over in room ${roomCode}`);
    }
  });

  // ─── HOST: End game early ───
  socket.on('end-game', ({ roomCode }) => {
    const result = gameManager.endGame(roomCode);
    if (result.error) {
      socket.emit('error-msg', { message: result.error });
      return;
    }

    io.to(roomCode).emit('game-over', {
      finalScores: result.finalScores,
      roundHistory: result.roundHistory
    });
    console.log(`🛑 Game ended early in room ${roomCode}`);
  });

  // ─── Disconnect handling ───
  socket.on('disconnect', () => {
    const result = gameManager.removePlayer(socket.id);
    if (result) {
      const { room, wasHost } = result;
      if (wasHost) {
        io.to(room.roomCode).emit('host-disconnected', {
          message: 'Host has left the game. Game over!'
        });
        gameManager.deleteRoom(room.roomCode);
        console.log(`💔 Host left, room ${room.roomCode} destroyed`);
      } else {
        io.to(room.roomCode).emit('player-left', {
          players: room.players.map(p => ({ id: p.id, name: p.name })),
          phase: room.phase
        });
        console.log(`👋 Player left room ${room.roomCode} (${room.players.length}/4)`);
      }
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 ══════════════════════════════════════════════`);
  console.log(`   Badsha Sipahi Wazeer Chor`);
  console.log(`   Server running at http://localhost:${PORT}`);
  console.log(`🎮 ══════════════════════════════════════════════\n`);
});
