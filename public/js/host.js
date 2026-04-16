// Host dashboard & Player logic

const socket = io();

// ─── State ───
const roomCode = sessionStorage.getItem('roomCode');
const hostName = sessionStorage.getItem('hostName');
let currentPhase = 'waiting';
let selectedGuessId = null;
let amIReady = false;
let cachedFinalScores = null;

// Redirect if no host info
if (!hostName) {
  window.location.href = '/';
}

// ─── Host DOM Elements ───
const displayRoomCode = document.getElementById('display-room-code');
const playerList = document.getElementById('player-list');
const playerCountBadge = document.getElementById('player-count-badge');
const startRoundBtn = document.getElementById('start-round-btn');
const startRoundText = document.getElementById('start-round-text');
const scoreboardSection = document.getElementById('scoreboard-section');
const scoreboardBody = document.getElementById('scoreboard-body');
const actionButtons = document.getElementById('action-buttons');
const nextRoundBtn = document.getElementById('next-round-btn');
const nextRoundText = document.getElementById('next-round-text');
const endGameBtn = document.getElementById('end-game-btn');
const gameOverOverlay = document.getElementById('game-over-overlay');
const winnerName = document.getElementById('winner-name');
const finalScoreboardBody = document.getElementById('final-scoreboard-body');
const newGameBtn = document.getElementById('new-game-btn');

// ─── Player DOM Elements ───
const waitingSection = document.getElementById('waiting-section');
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
const hostStatus = document.getElementById('host-status');
const resultsOverlay = document.getElementById('results-overlay');
const resultEmoji = document.getElementById('result-emoji');
const resultVerdict = document.getElementById('result-verdict');
const roundResultsList = document.getElementById('round-results-list');
const resultScoresSection = document.getElementById('result-scores-section');
const closeResultsBtn = document.getElementById('close-results-btn');

// ─── Role Config ───
const ROLE_CONFIG = {
  badsha: { emoji: '👑', name: 'Badsha', color: '#D4AF37', points: 1000 },
  wazeer: { emoji: '🎖️', name: 'Wazeer', color: '#3498db', points: 500 },
  sipahi: { emoji: '⚔️', name: 'Sipahi', color: '#00A86B', points: 300 },
  chor: { emoji: '🥷', name: 'Chor', color: '#8e44ad', points: 0 }
};

// ─── Initialize ───
if (roomCode) displayRoomCode.textContent = roomCode;

// Create room as host
socket.emit('create-room', { 
  hostName, 
  totalRounds: parseInt(sessionStorage.getItem('totalRounds')) || 5 
});

// ─── Functions ───

function renderPlayerList(players) {
  const count = players.length;
  playerCountBadge.textContent = `${count}/4`;

  let html = '';
  for (let i = 0; i < 4; i++) {
    if (i < count) {
      const p = players[i];
      const initial = p.name.charAt(0).toUpperCase();
      const readyCheck = p.isReady ? '<span style="color:var(--green-light); font-size: 0.8rem; margin-left: auto;">Ready</span>' : '';
      html += `
        <li class="player-item">
          <div class="player-avatar">${initial}</div>
          <span class="player-name">${escapeHtml(p.name)}</span>
          ${readyCheck}
          <span class="player-score" style="margin-left: auto;">${p.totalScore !== undefined ? p.totalScore : 0}</span>
        </li>`;
    } else {
      html += `
        <li class="player-item player-slot-empty">
          <div class="player-avatar">?</div>
          <span class="player-name">Waiting for player...</span>
        </li>`;
    }
  }
  playerList.innerHTML = html;

  // Handle start button for the very first round
  if (currentPhase === 'waiting' || currentPhase === 'ready') {
    if (count === 4) {
      startRoundBtn.disabled = false;
      startRoundText.textContent = "Start Round";
    } else {
      startRoundBtn.disabled = true;
      startRoundText.textContent = "Wait for players...";
    }
  }
}

function renderScoreboard(scores) {
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);
  let html = '';
  sorted.forEach((p, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    html += `
      <tr class="${i === 0 ? 'winner' : ''}">
        <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
        <td>${escapeHtml(p.name)}</td>
        <td>${p.totalScore}</td>
      </tr>`;
  });
  scoreboardBody.innerHTML = html;
  scoreboardSection.classList.remove('hidden');
}

function showRoleCard(role) {
  const config = ROLE_CONFIG[role];
  roleEmoji.textContent = config.emoji;
  roleName.textContent = config.name;
  rolePoints.textContent = `Up to ${config.points} points`;
  roleCardWrapper.className = 'role-card-wrapper role-' + role;
  roleCard.classList.remove('flipped');
  setTimeout(() => {
    roleCard.classList.add('flipped');
  }, 600);
}

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

window.selectGuess = function(playerId) {
  selectedGuessId = playerId;
  submitGuessBtn.disabled = false;
  document.querySelectorAll('.guess-card').forEach(card => card.classList.remove('selected'));
  document.getElementById(`guess-${playerId}`).classList.add('selected');
};

// ─── Socket Events ───

socket.on('room-created', ({ roomCode: code, players }) => {
  displayRoomCode.textContent = code;
  sessionStorage.setItem('roomCode', code);
  renderPlayerList(players);
});

socket.on('player-joined', ({ players, phase, newPlayer }) => {
  currentPhase = phase;
  renderPlayerList(players);
  if (newPlayer !== hostName) showToast(`${newPlayer} joined the game!`, 'success');
  if (players.length === 4) {
    showToast('All players joined! Start the round! 🎴', 'info');
  }
});

socket.on('player-left', ({ players, phase }) => {
  currentPhase = phase;
  renderPlayerList(players);
  showToast('A player left the game', 'error');
});

socket.on('player-ready-update', ({ readyCount, allReady }) => {
  // Update button text
  nextRoundText.textContent = allReady ? "Next Round" : `Wait for Ready... (${readyCount}/4)`;
  nextRoundBtn.disabled = !allReady;
  
  // Update player list showing ready tags (wait, we need players array updated, but server only sends count. Let's just trust count for host button).
});

// Since the host is a player, we receive normal round-started
socket.on('round-started', ({ roundNumber, totalRounds, yourRole, badsha, wazeer, hiddenPlayers, isWazeer }) => {
  currentPhase = 'reveal';
  amIReady = false;
  submitGuessBtn.innerHTML = '<span>🎯</span> Submit Guess';

  // Update Host Dashboard side
  startRoundBtn.parentElement.classList.add('hidden'); // Hide the start round section temporarily
  actionButtons.classList.add('hidden');

  // Update Player Panel side
  waitingSection.classList.add('hidden');
  gameSection.classList.remove('hidden');
  roundBadge.textContent = `🎴 Round ${roundNumber} / ${totalRounds}`;
  
  showRoleCard(yourRole);
  showRevealedRoles(badsha, wazeer);
  
  guessSection.classList.add('hidden');
  waitingGuessSection.classList.add('hidden');

  if (isWazeer) {
    setTimeout(() => { showGuessUI(hiddenPlayers); }, 1500);
  } else {
    waitingGuessSection.classList.remove('hidden');
  }

  // Hide scoreboard until result
  scoreboardSection.classList.add('hidden');
});

socket.on('round-result', ({ results, totalScores, isGameOver }) => {
  currentPhase = isGameOver ? 'finished' : 'results';

  guessSection.classList.add('hidden');
  waitingGuessSection.classList.add('hidden');
  if (isGameOver) {
    closeResultsBtn.innerHTML = 'View Final Results 🏆';
  } else {
    closeResultsBtn.innerHTML = 'Continue (Ready for Next Round)';
  }

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

  const roleTagClass = {
    badsha: 'role-tag-badsha',
    wazeer: 'role-tag-wazeer',
    sipahi: 'role-tag-sipahi',
    chor: 'role-tag-chor'
  };

  roundResultsList.innerHTML = results.roles.map(r => {
    const config = ROLE_CONFIG[r.role];
    const isMe = r.name === hostName;
    return `
      <div class="round-result-item" ${isMe ? 'style="border: 1px solid var(--gold-glow);"' : ''}>
        <span>${config.emoji} ${escapeHtml(r.name)} ${isMe ? '(You)' : ''}</span>
        <span class="role-tag ${roleTagClass[r.role]}">${config.name}</span>
        <span class="points-badge">+${r.points}</span>
      </div>`;
  }).join('');

  const sorted = [...totalScores].sort((a, b) => b.totalScore - a.totalScore);
  resultScoresSection.innerHTML = `
    <div class="section-title" style="justify-content: center; margin-top: 8px;">
      <span class="icon">🏆</span> Standings
    </div>
    ${sorted.map((p, i) => {
      const isMe = p.name === hostName;
      return `<div class="round-result-item" ${isMe ? 'style="border: 1px solid var(--gold-glow);"' : ''}>
        <span>${i + 1}. ${escapeHtml(p.name)} ${isMe ? '⭐' : ''}</span>
        <span class="points-badge">${p.totalScore}</span>
      </div>`;
    }).join('')}`;

  resultsOverlay.classList.remove('hidden');
  renderScoreboard(totalScores);
  renderPlayerList(totalScores.map(s => ({ name: s.name, totalScore: s.totalScore, isReady: false })));

  if (!isGameOver) {
    actionButtons.classList.remove('hidden');
    nextRoundBtn.disabled = true;
    nextRoundText.textContent = "Wait for Ready... (0/4)";
  }
});

socket.on('game-over', ({ finalScores }) => {
  cachedFinalScores = finalScores;
});

// ─── Button Handlers ───

startRoundBtn.addEventListener('click', () => {
  socket.emit('start-round', { roomCode: sessionStorage.getItem('roomCode') });
  startRoundBtn.disabled = true;
});

nextRoundBtn.addEventListener('click', () => {
  socket.emit('start-round', { roomCode: sessionStorage.getItem('roomCode') });
  actionButtons.classList.add('hidden');
});

endGameBtn.addEventListener('click', () => {
  socket.emit('end-game', { roomCode: sessionStorage.getItem('roomCode') });
});

newGameBtn.addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = '/';
});

submitGuessBtn.addEventListener('click', () => {
  if (!selectedGuessId) return;
  submitGuessBtn.disabled = true;
  submitGuessBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:0;border-width:2px;"></div> Submitting...';
  socket.emit('wazeer-guess', { roomCode: sessionStorage.getItem('roomCode'), guessedPlayerId: selectedGuessId });
});

closeResultsBtn.addEventListener('click', () => {
  if (cachedFinalScores) {
    showGameOverScreen();
    return;
  }

  if (amIReady) return;
  amIReady = true;
  closeResultsBtn.textContent = 'Waiting for others...';
  socket.emit('player-ready', { roomCode: sessionStorage.getItem('roomCode') });
  
  resultsOverlay.classList.add('hidden');
  guessSection.classList.add('hidden');
  waitingGuessSection.classList.add('hidden');
  roleCard.classList.remove('flipped');
  gameSection.classList.add('hidden');
  waitingSection.classList.remove('hidden');
  waitingSection.querySelector('.status-waiting span').textContent = 'Waiting for you to start next round...';
});

function showGameOverScreen() {
  currentPhase = 'finished';
  resultsOverlay.classList.add('hidden');

  const winner = cachedFinalScores[0];
  winnerName.textContent = `🎉 ${winner.name} wins with ${winner.totalScore} points!`;

  let html = '';
  cachedFinalScores.forEach((p, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    html += `
      <tr class="${i === 0 ? 'winner' : ''}">
        <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
        <td>${escapeHtml(p.name)}</td>
        <td>${p.totalScore}</td>
      </tr>`;
  });
  finalScoreboardBody.innerHTML = html;

  gameOverOverlay.classList.remove('hidden');
  spawnConfetti();
}

// ─── Error handling ───
socket.on('error-msg', ({ message }) => {
  showToast(message, 'error');
  if (submitGuessBtn) {
    submitGuessBtn.disabled = false;
    submitGuessBtn.innerHTML = '<span>🎯</span> Submit Guess';
  }
});

// ─── Utility ───
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
