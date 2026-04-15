// Game constants and configuration

const ROLES = {
  BADSHA: 'badsha',
  WAZEER: 'wazeer',
  SIPAHI: 'sipahi',
  CHOR: 'chor'
};

const ROLE_LABELS = {
  [ROLES.BADSHA]: 'Badsha 👑',
  [ROLES.WAZEER]: 'Wazeer 🎖️',
  [ROLES.SIPAHI]: 'Sipahi ⚔️',
  [ROLES.CHOR]: 'Chor 🥷'
};

// Points when Wazeer guesses CORRECTLY
const POINTS_CORRECT = {
  [ROLES.BADSHA]: 1000,
  [ROLES.WAZEER]: 500,
  [ROLES.SIPAHI]: 300,
  [ROLES.CHOR]: 0
};

// Points when Wazeer guesses WRONG
const POINTS_WRONG = {
  [ROLES.BADSHA]: 1000,
  [ROLES.WAZEER]: 0,
  [ROLES.SIPAHI]: 300,
  [ROLES.CHOR]: 500
};

const PHASES = {
  WAITING: 'waiting',       // Waiting for players to join
  READY: 'ready',           // 4 players joined, host can start
  DEALING: 'dealing',       // Chits being distributed
  REVEAL: 'reveal',         // Badsha & Wazeer revealed
  GUESSING: 'guessing',     // Wazeer is guessing
  RESULTS: 'results',       // Round results shown
  FINISHED: 'finished'      // All rounds complete
};

const ALL_ROLES = [ROLES.BADSHA, ROLES.WAZEER, ROLES.SIPAHI, ROLES.CHOR];

module.exports = {
  ROLES,
  ROLE_LABELS,
  POINTS_CORRECT,
  POINTS_WRONG,
  PHASES,
  ALL_ROLES
};
