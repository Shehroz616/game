// Game Manager — room creation, player management, game lifecycle

const { PHASES } = require('./constants');
const Round = require('./Round');

class GameManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> room object
  }

  /**
   * Generate a unique 4-character room code
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0,O,1,I)
    let code;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Create a new game room
   */
  createRoom(hostSocketId, hostName, totalRounds) {
    const roomCode = this.generateRoomCode();
    const room = {
      roomCode,
      hostSocketId,
      hostName,
      totalRounds: Math.max(1, Math.min(20, totalRounds || 5)),
      currentRound: 0,
      phase: PHASES.WAITING,
      players: [{
        id: hostSocketId,
        name: hostName,
        totalScore: 0,
        connected: true,
        isReady: false
      }],
      currentRoundObj: null,
      roundHistory: [],
      readyCount: 0
    };
    this.rooms.set(roomCode, room);
    return room;
  }

  /**
   * Get a room by code
   */
  getRoom(roomCode) {
    return this.rooms.get(roomCode?.toUpperCase()) || null;
  }

  /**
   * Get room by any member's socket ID (host or player)
   */
  getRoomBySocketId(socketId) {
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId) return room;
      if (room.players.some(p => p.id === socketId)) return room;
    }
    return null;
  }

  /**
   * Add a player to a room
   */
  joinRoom(roomCode, socketId, playerName) {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found! Check the code and try again.' };
    if (room.phase !== PHASES.WAITING && room.phase !== PHASES.READY) {
      return { error: 'Game already in progress! Cannot join now.' };
    }
    if (room.players.length >= 4) {
      return { error: 'Room is full! Maximum 4 players.' };
    }
    if (room.players.some(p => p.id === socketId)) {
      return { error: 'You are already in this room!' };
    }
    if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      return { error: 'A player with this name already exists in the room!' };
    }

    const player = {
      id: socketId,
      name: playerName,
      totalScore: 0,
      connected: true,
      isReady: false
    };

    room.players.push(player);

    // Auto-update phase when 4 players join
    if (room.players.length === 4) {
      room.phase = PHASES.READY;
    }

    return { success: true, room };
  }

  /**
   * Remove a player from a room
   */
  removePlayer(socketId) {
    const room = this.getRoomBySocketId(socketId);
    if (!room) return null;

    // If host disconnects, mark room for cleanup
    if (room.hostSocketId === socketId) {
      return { room, wasHost: true };
    }

    // Remove player
    room.players = room.players.filter(p => p.id !== socketId);

    // Downgrade phase if not enough players
    if (room.players.length < 4 && room.phase === PHASES.READY) {
      room.phase = PHASES.WAITING;
    }

    return { room, wasHost: false };
  }

  /**
   * Start a new round
   */
  startRound(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found!' };
    if (room.players.length !== 4) return { error: 'Need exactly 4 players to start!' };
    if (room.currentRound >= room.totalRounds) return { error: 'All rounds completed!' };

    room.currentRound++;
    room.phase = PHASES.REVEAL;
    room.readyCount = 0;
    room.players.forEach(p => p.isReady = false);

    // Create a new round and distribute chits
    const round = new Round(
      room.currentRound,
      room.players.map(p => ({ id: p.id, name: p.name }))
    );
    round.distributeChits();
    room.currentRoundObj = round;

    return { success: true, room, round };
  }

  /**
   * Mark player as ready for next round
   */
  setPlayerReady(roomCode, socketId) {
    const room = this.getRoom(roomCode);
    if (!room) return null;
    const player = room.players.find(p => p.id === socketId);
    if (player && !player.isReady) {
      player.isReady = true;
      room.readyCount++;
    }
    return { room, allReady: room.readyCount === 4 };
  }

  /**
   * Process Wazeer's guess
   */
  handleGuess(roomCode, wazeerId, guessedPlayerId) {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found!' };
    if (!room.currentRoundObj) return { error: 'No active round!' };
    if (room.phase !== PHASES.REVEAL && room.phase !== PHASES.GUESSING) {
      return { error: 'Not in guessing phase!' };
    }

    const round = room.currentRoundObj;

    // Verify the guesser is actually the Wazeer
    const actualWazeerId = round.getPlayerByRole('wazeer');
    if (wazeerId !== actualWazeerId) {
      return { error: 'Only the Wazeer can make a guess!' };
    }

    // Process the guess
    const results = round.processGuess(guessedPlayerId);

    // Update total scores
    room.players.forEach(player => {
      player.totalScore += results.scores[player.id] || 0;
    });

    // Save round history
    room.roundHistory.push(results);

    // Update phase
    if (room.currentRound >= room.totalRounds) {
      room.phase = PHASES.FINISHED;
    } else {
      room.phase = PHASES.RESULTS;
    }

    return {
      success: true,
      results,
      totalScores: room.players.map(p => ({
        id: p.id,
        name: p.name,
        totalScore: p.totalScore
      })),
      isGameOver: room.phase === PHASES.FINISHED,
      room
    };
  }

  /**
   * Get current scoreboard
   */
  getScoreboard(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    return room.players
      .map(p => ({ id: p.id, name: p.name, totalScore: p.totalScore }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * End game early
   */
  endGame(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found!' };
    room.phase = PHASES.FINISHED;
    return {
      success: true,
      finalScores: this.getScoreboard(roomCode),
      roundHistory: room.roundHistory
    };
  }

  /**
   * Delete a room
   */
  deleteRoom(roomCode) {
    this.rooms.delete(roomCode);
  }
}

module.exports = GameManager;
