// Round logic — chit distribution and scoring

const { ROLES, ALL_ROLES, POINTS_CORRECT, POINTS_WRONG } = require('./constants');

class Round {
  constructor(roundNumber, players) {
    this.roundNumber = roundNumber;
    this.players = players; // array of { id, name }
    this.roles = {};        // playerId -> role
    this.guessedId = null;
    this.wasCorrect = null;
    this.scores = {};       // playerId -> points this round
  }

  /**
   * Distribute chits randomly using Fisher-Yates shuffle
   */
  distributeChits() {
    const shuffled = [...ALL_ROLES];
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    this.players.forEach((player, index) => {
      this.roles[player.id] = shuffled[index];
    });

    return this.roles;
  }

  /**
   * Get the player ID who has a specific role
   */
  getPlayerByRole(role) {
    return Object.keys(this.roles).find(id => this.roles[id] === role);
  }

  /**
   * Get role info visible to a specific player
   * - Everyone sees who Badsha and Wazeer are
   * - Each player sees their own role privately
   * - Sipahi and Chor identities are hidden from others
   */
  getRoleInfoForPlayer(playerId) {
    const badshaId = this.getPlayerByRole(ROLES.BADSHA);
    const wazeerId = this.getPlayerByRole(ROLES.WAZEER);
    const badshaPlayer = this.players.find(p => p.id === badshaId);
    const wazeerPlayer = this.players.find(p => p.id === wazeerId);

    // Hidden players are Sipahi and Chor
    const hiddenPlayers = this.players.filter(p =>
      this.roles[p.id] === ROLES.SIPAHI || this.roles[p.id] === ROLES.CHOR
    );

    return {
      yourRole: this.roles[playerId],
      badsha: { id: badshaId, name: badshaPlayer.name },
      wazeer: { id: wazeerId, name: wazeerPlayer.name },
      hiddenPlayers: hiddenPlayers.map(p => ({ id: p.id, name: p.name })),
      isWazeer: this.roles[playerId] === ROLES.WAZEER
    };
  }

  /**
   * Process the Wazeer's guess
   * Returns round results with scores
   */
  processGuess(guessedPlayerId) {
    const chorId = this.getPlayerByRole(ROLES.CHOR);
    this.guessedId = guessedPlayerId;
    this.wasCorrect = guessedPlayerId === chorId;

    const pointsTable = this.wasCorrect ? POINTS_CORRECT : POINTS_WRONG;

    // Calculate scores for each player
    this.players.forEach(player => {
      const role = this.roles[player.id];
      this.scores[player.id] = pointsTable[role];
    });

    return this.getResults();
  }

  /**
   * Get full round results (shown after guess)
   */
  getResults() {
    const guessedPlayer = this.players.find(p => p.id === this.guessedId);

    return {
      roundNumber: this.roundNumber,
      wasCorrect: this.wasCorrect,
      guessedPlayer: guessedPlayer ? { id: guessedPlayer.id, name: guessedPlayer.name } : null,
      roles: this.players.map(player => ({
        id: player.id,
        name: player.name,
        role: this.roles[player.id],
        points: this.scores[player.id] || 0
      })),
      scores: { ...this.scores }
    };
  }
}

module.exports = Round;
