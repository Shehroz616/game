// Player game view logic

const socket = io();

// ─── State ───
const roomCode = sessionStorage.getItem('roomCode');
const playerName = sessionStorage.getItem('playerName');
let selectedGuessId = null;
let amIReady = false;
let cachedFinalScores = null;

// Redirect if no room info
if (!roomCode || !playerName) {
  window.location.href = '/';
}

// ─── DOM Elements ───
const displayPlayerName = document.getElementById('display-player-name');
const displayRoomCode = document.getElementById('display-room-code');
const waitingSection = document.getElementById('waiting-section');
const playerListWaiting = document.getElementById('player-list-waiting');
const gameSection = document.getElementById('game-section');
const roundBadge = document.getElementById('round-badge');
const roleCard = document.getElementById('role-card');
const roleCardWrapper = document.getElementById('role-card-wrapper');
const roleCardFront = document.getElementById('role-card-front');
const roleEmoji = document.getElementById('role-emoji');
const roleName = document.getElementById('role-name');
const rolePoints = document.getElementById('role-points');
const revealedRoles = document.getElementById('revealed-roles');
const guessSection = document.getElementById('guess-section');
const guessOptions = document.getElementById('guess-options');
const submitGuessBtn = document.getElementById('submit-guess-btn');
const waitingGuessSection = document.getElementById('waiting-guess-section');
const scoreboardSection = document.getElementById('scoreboard-section');
const scoreboardBody = document.getElementById('scoreboard-body');
const resultsOverlay = document.getElementById('results-overlay');
const resultEmoji = document.getElementById('result-emoji');
const resultVerdict = document.getElementById('result-verdict');
const roundResultsList = document.getElementById('round-results-list');
const resultScoresSection = document.getElementById('result-scores-section');
const closeResultsBtn = document.getElementById('close-results-btn');
const gameOverOverlay = document.getElementById('game-over-overlay');
const winnerNameEl = document.getElementById('winner-name');
const finalScoreboardBody = document.getElementById('final-scoreboard-body');
const backHomeBtn = document.getElementById('back-home-btn');
const hostDcOverlay = document.getElementById('host-dc-overlay');

// ─── Role Config ───
const ROLE_CONFIG = {
  badsha: { emoji: '👑', name: 'Badsha', color: '#D4AF37', points: 1000 },
  wazeer: { emoji: '🎖️', name: 'Wazeer', color: '#3498db', points: 500 },
  sipahi: { emoji: '⚔️', name: 'Sipahi', color: '#00A86B', points: 300 },
  chor: { emoji: '🥷', name: 'Chor', color: '#8e44ad', points: 0 }
};

// ─── Initialize ───
displayPlayerName.textContent = playerName;
displayRoomCode.textContent = roomCode;

// Rejoin room
socket.emit('join-room', { roomCode, playerName });

// ─── Render Waiting Player List ───
function renderWaitingPlayers(players) {
  let html = '';
  players.forEach(p => {
    const initial = p.name.charAt(0).toUpperCase();
    const isMe = p.name === playerName;
    html += `
      <li class="player-item" ${isMe ? 'style="border-color: var(--gold-primary);"' : ''}>
        <div class="player-avatar">${initial}</div>
        <span class="player-name">${escapeHtml(p.name)} ${isMe ? '(You)' : ''}</span>
      </li>`;
  });
  playerListWaiting.innerHTML = html;
}

// ─── Show Role Card with Flip Animation ───
function showRoleCard(role) {
  const config = ROLE_CONFIG[role];
  roleEmoji.textContent = config.emoji;
  roleName.textContent = config.name;
  rolePoints.textContent = `Up to ${config.points} points`;

  // Set role-specific class
  roleCardWrapper.className = 'role-card-wrapper role-' + role;

  // Reset and trigger flip
  roleCard.classList.remove('flipped');
  setTimeout(() => {
    roleCard.classList.add('flipped');
  }, 600);
}

// ─── Show Revealed Roles ───
function showRevealedRoles(badsha, wazeer) {
  revealedRoles.innerHTML = `
    <div class="revealed-role">
      <div class="emoji">👑</div>
      <div class="role-label">Badsha</div>
      <div class="player-name-reveal">${escapeHtml(badsha.name)}</div>
    </div>
    <div class="revealed-role">
      <div class="emoji">🎖️</div>
      <div class="role-label">Wazeer</div>
      <div class="player-name-reveal">${escapeHtml(wazeer.name)}</div>
    </div>`;
}

// ─── Show Wazeer Guess UI ───
function showGuessUI(hiddenPlayers) {
  selectedGuessId = null;
  submitGuessBtn.disabled = true;

  guessOptions.innerHTML = hiddenPlayers.map(p => `
    <div class="guess-card" id="guess-${p.id}" data-player-id="${p.id}" onclick="selectGuess('${p.id}')">
      <div class="mystery-icon">🎭</div>
      <div class="guess-name">${escapeHtml(p.name)}</div>
    </div>`).join('');

  guessSection.classList.remove('hidden');
  waitingGuessSection.classList.add('hidden');
}

// ─── Select Guess ───
window.selectGuess = function(playerId) {
  selectedGuessId = playerId;
  submitGuessBtn.disabled = false;

  // Update visual selection
  document.querySelectorAll('.guess-card').forEach(card => {
    card.classList.remove('selected');
  });
  document.getElementById(`guess-${playerId}`).classList.add('selected');
};

// ─── Submit Guess ───
submitGuessBtn.addEventListener('click', () => {
  if (!selectedGuessId) return;

  submitGuessBtn.disabled = true;
  submitGuessBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:0;border-width:2px;"></div> Submitting...';

  socket.emit('wazeer-guess', {
    roomCode: roomCode,
    guessedPlayerId: selectedGuessId
  });
});

// ─── Render Scoreboard ───
function renderScoreboard(scores) {
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);
  let html = '';
  sorted.forEach((p, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    const isMe = p.name === playerName;
    html += `
      <tr class="${i === 0 ? 'winner' : ''}" ${isMe ? 'style="background: rgba(212,175,55,0.08);"' : ''}>
        <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
        <td>${escapeHtml(p.name)} ${isMe ? '⭐' : ''}</td>
        <td>${p.totalScore}</td>
      </tr>`;
  });
  scoreboardBody.innerHTML = html;
  scoreboardSection.classList.remove('hidden');
}

// ─── Socket Events ───

socket.on('joined-room', ({ players }) => {
  renderWaitingPlayers(players);
});

socket.on('player-joined', ({ players, newPlayer }) => {
  renderWaitingPlayers(players);
  if (newPlayer !== playerName) {
    showToast(`${newPlayer} joined!`, 'success');
  }
});

socket.on('player-left', ({ players }) => {
  renderWaitingPlayers(players);
  showToast('A player left the game', 'error');
});

socket.on('round-started', ({ roundNumber, totalRounds, yourRole, badsha, wazeer, hiddenPlayers, isWazeer }) => {
  amIReady = false;
  submitGuessBtn.innerHTML = '<span>🎯</span> Submit Guess';
  // Switch to game view
  waitingSection.classList.add('hidden');
  gameSection.classList.remove('hidden');

  // Update round badge
  roundBadge.textContent = `🎴 Round ${roundNumber} / ${totalRounds}`;

  // Show role card
  showRoleCard(yourRole);

  // Show revealed roles
  showRevealedRoles(badsha, wazeer);

  // Show appropriate UI based on role
  guessSection.classList.add('hidden');
  waitingGuessSection.classList.add('hidden');

  if (isWazeer) {
    // Wazeer sees the guess UI
    setTimeout(() => {
      showGuessUI(hiddenPlayers);
    }, 1500); // Delay to let card flip animation finish
  } else {
    // Everyone else waits
    waitingGuessSection.classList.remove('hidden');
  }

  // Hide scoreboard during play
  scoreboardSection.classList.add('hidden');
});

socket.on('round-result', ({ results, totalScores, isGameOver }) => {
  if (isGameOver) {
    closeResultsBtn.innerHTML = 'View Final Results 🏆';
  } else {
    closeResultsBtn.innerHTML = 'Continue (Ready for Next Round)';
  }
  // Hide guess/waiting sections
  guessSection.classList.add('hidden');
  waitingGuessSection.classList.add('hidden');

  // Show results overlay
  if (results.wasCorrect) {
    resultEmoji.textContent = '🎯';
    resultVerdict.innerHTML = `Wazeer caught the Chor!<br><span style="font-size:1rem;color:rgba(255,255,255,0.7);font-weight:normal;margin-top:8px;display:block;">Wazeer guessed <b>${escapeHtml(results.guessedPlayer.name)}</b> (who was the actual Chor!)</span>`;
    resultVerdict.className = 'result-verdict correct';
    new Audio('/sounds/click-nice.mp3').play().catch(e => console.warn('Audio play blocked:', e));
  } else {
    resultEmoji.textContent = '😈';
    const actualChor = results.roles.find(r => r.role === 'chor');
    resultVerdict.innerHTML = `Chor escaped! Wazeer was wrong!<br><span style="font-size:1rem;color:rgba(255,255,255,0.7);font-weight:normal;margin-top:8px;display:block;">Wazeer guessed <b>${escapeHtml(results.guessedPlayer.name)}</b>, but the actual Chor was <b>${escapeHtml(actualChor.name)}</b>!</span>`;
    resultVerdict.className = 'result-verdict wrong';
    new Audio('/sounds/faaaa.mp3').play().catch(e => console.warn('Audio play blocked:', e));
  }

  // Show all roles with points
  const roleTagClass = {
    badsha: 'role-tag-badsha',
    wazeer: 'role-tag-wazeer',
    sipahi: 'role-tag-sipahi',
    chor: 'role-tag-chor'
  };

  roundResultsList.innerHTML = results.roles.map(r => {
    const config = ROLE_CONFIG[r.role];
    const isMe = r.name === playerName;
    return `
      <div class="round-result-item" ${isMe ? 'style="border: 1px solid var(--gold-glow);"' : ''}>
        <span>${config.emoji} ${escapeHtml(r.name)} ${isMe ? '(You)' : ''}</span>
        <span class="role-tag ${roleTagClass[r.role]}">${config.name}</span>
        <span class="points-badge">+${r.points}</span>
      </div>`;
  }).join('');

  // Show scores in result
  const sorted = [...totalScores].sort((a, b) => b.totalScore - a.totalScore);
  resultScoresSection.innerHTML = `
    <div class="section-title" style="justify-content: center; margin-top: 8px;">
      <span class="icon">🏆</span> Standings
    </div>
    ${sorted.map((p, i) => {
      const isMe = p.name === playerName;
      return `<div class="round-result-item" ${isMe ? 'style="border: 1px solid var(--gold-glow);"' : ''}>
        <span>${i + 1}. ${escapeHtml(p.name)} ${isMe ? '⭐' : ''}</span>
        <span class="points-badge">${p.totalScore}</span>
      </div>`;
    }).join('')}`;

  resultsOverlay.classList.remove('hidden');

  // Update scoreboard behind overlay
  renderScoreboard(totalScores);
});

socket.on('game-over', ({ finalScores }) => {
  cachedFinalScores = finalScores;
});

socket.on('host-disconnected', () => {
  hostDcOverlay.classList.remove('hidden');
});

socket.on('error-msg', ({ message }) => {
  showToast(message, 'error');
  submitGuessBtn.disabled = false;
  submitGuessBtn.innerHTML = '<span>🎯</span> Submit Guess';
});

// ─── Close Results ───
closeResultsBtn.addEventListener('click', () => {
  if (cachedFinalScores) {
    showGameOverScreen();
    return;
  }

  if (amIReady) return;
  amIReady = true;
  closeResultsBtn.textContent = 'Waiting for others...';
  socket.emit('player-ready', { roomCode });

  resultsOverlay.classList.add('hidden');
  guessSection.classList.add('hidden');
  waitingGuessSection.classList.add('hidden');
  roleCard.classList.remove('flipped');
  gameSection.classList.add('hidden');
  waitingSection.classList.remove('hidden');
  waitingSection.querySelector('.status-waiting span').textContent = 'Waiting for Host to start next round...';
});

function showGameOverScreen() {
  currentPhase = 'finished';
  resultsOverlay.classList.add('hidden');

  const winner = cachedFinalScores[0];
  const isWinner = winner.name === playerName;
  winnerNameEl.textContent = isWinner
    ? `🎉 You win with ${winner.totalScore} points!`
    : `🎉 ${winner.name} wins with ${winner.totalScore} points!`;

  let html = '';
  cachedFinalScores.forEach((p, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    const isMe = p.name === playerName;
    html += `
      <tr class="${i === 0 ? 'winner' : ''}" ${isMe ? 'style="background: rgba(212,175,55,0.08);"' : ''}>
        <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
        <td>${escapeHtml(p.name)} ${isMe ? '⭐' : ''}</td>
        <td>${p.totalScore}</td>
      </tr>`;
  });
  finalScoreboardBody.innerHTML = html;

  gameOverOverlay.classList.remove('hidden');
  spawnConfetti();
}

// ─── Back Home ───
backHomeBtn.addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = '/';
});

// ─── Utility Functions ───

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function spawnConfetti() {
  const colors = ['#D4AF37', '#00A86B', '#e74c3c', '#3498db', '#f39c12', '#9b59b6'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
    piece.style.animationDelay = Math.random() * 1.5 + 's';
    piece.style.width = (Math.random() * 8 + 5) + 'px';
    piece.style.height = (Math.random() * 8 + 5) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 5000);
  }
}
