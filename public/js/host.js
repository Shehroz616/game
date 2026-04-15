// Host dashboard logic

const socket = io();

// ─── State ───
const roomCode = sessionStorage.getItem('roomCode');
const hostName = sessionStorage.getItem('hostName');
let currentPhase = 'waiting';

// Redirect if no host info
if (!hostName) {
  window.location.href = '/';
}

// ─── DOM Elements ───
const displayRoomCode = document.getElementById('display-room-code');
const playerList = document.getElementById('player-list');
const playerCountBadge = document.getElementById('player-count-badge');
const startRoundBtn = document.getElementById('start-round-btn');
const roundSection = document.getElementById('round-section');
const roundBadge = document.getElementById('round-badge');
const revealedRoles = document.getElementById('revealed-roles');
const hiddenPlayersDisplay = document.getElementById('hidden-players-display');
const hostStatus = document.getElementById('host-status');
const scoreboardSection = document.getElementById('scoreboard-section');
const scoreboardBody = document.getElementById('scoreboard-body');
const actionButtons = document.getElementById('action-buttons');
const nextRoundBtn = document.getElementById('next-round-btn');
const endGameBtn = document.getElementById('end-game-btn');
const gameOverOverlay = document.getElementById('game-over-overlay');
const winnerName = document.getElementById('winner-name');
const finalScoreboardBody = document.getElementById('final-scoreboard-body');
const newGameBtn = document.getElementById('new-game-btn');

// ─── Initialize ───
if (roomCode) displayRoomCode.textContent = roomCode;

// Create room as host
socket.emit('create-room', { 
  hostName, 
  totalRounds: parseInt(sessionStorage.getItem('totalRounds')) || 5 
});

// ─── Role Emoji Map ───
const ROLE_EMOJI = {
  badsha: '👑',
  wazeer: '🎖️',
  sipahi: '⚔️',
  chor: '🥷'
};

const ROLE_DISPLAY = {
  badsha: 'Badsha',
  wazeer: 'Wazeer',
  sipahi: 'Sipahi',
  chor: 'Chor'
};

// ─── Render Player List ───
function renderPlayerList(players) {
  const count = players.length;
  playerCountBadge.textContent = `${count}/4`;

  let html = '';
  for (let i = 0; i < 4; i++) {
    if (i < count) {
      const p = players[i];
      const initial = p.name.charAt(0).toUpperCase();
      html += `
        <li class="player-item">
          <div class="player-avatar">${initial}</div>
          <span class="player-name">${escapeHtml(p.name)}</span>
          <span class="player-score">${p.totalScore !== undefined ? p.totalScore : 0}</span>
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

  // Enable start button when 4 players & in waiting/ready/results phase
  startRoundBtn.disabled = count < 4 || (currentPhase !== 'waiting' && currentPhase !== 'ready' && currentPhase !== 'results');
}

// ─── Render Scoreboard ───
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

// ─── Socket Events ───

socket.on('room-created', ({ roomCode: code }) => {
  displayRoomCode.textContent = code;
  sessionStorage.setItem('roomCode', code);
});

socket.on('player-joined', ({ players, phase, newPlayer }) => {
  currentPhase = phase;
  renderPlayerList(players);
  showToast(`${newPlayer} joined the game!`, 'success');

  if (players.length === 4) {
    startRoundBtn.disabled = false;
    showToast('All players joined! Start the round! 🎴', 'info');
  }
});

socket.on('player-left', ({ players, phase }) => {
  currentPhase = phase;
  renderPlayerList(players);
  showToast('A player left the game', 'error');
});

socket.on('host-round-started', ({ roundNumber, totalRounds, badsha, wazeer, hiddenPlayers }) => {
  currentPhase = 'reveal';

  // Show round section
  roundSection.classList.remove('hidden');
  roundBadge.textContent = `🎴 Round ${roundNumber} / ${totalRounds}`;

  // Show revealed roles
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

  // Show hidden players
  hiddenPlayersDisplay.innerHTML = hiddenPlayers.map(p => `
    <div class="revealed-role">
      <div class="emoji">❓</div>
      <div class="role-label">Hidden</div>
      <div class="player-name-reveal">${escapeHtml(p.name)}</div>
    </div>`).join('');

  // Show waiting status
  hostStatus.innerHTML = '<span class="waiting-dots">Waiting for Wazeer to guess</span>';
  hostStatus.className = 'status-message status-waiting';

  // Hide action buttons & start btn during play
  actionButtons.classList.add('hidden');
  startRoundBtn.disabled = true;
});

socket.on('round-result', ({ results, totalScores, isGameOver }) => {
  currentPhase = isGameOver ? 'finished' : 'results';

  // Update host status
  if (results.wasCorrect) {
    hostStatus.innerHTML = '✅ Wazeer guessed correctly! Chor was caught!';
    hostStatus.className = 'status-message status-waiting';
  } else {
    hostStatus.innerHTML = '❌ Wazeer guessed wrong! Chor escaped!';
    hostStatus.className = 'status-message status-error';
  }

  // Update revealed roles to show all
  const allRolesHtml = results.roles.map(r => `
    <div class="revealed-role">
      <div class="emoji">${ROLE_EMOJI[r.role]}</div>
      <div class="role-label">${ROLE_DISPLAY[r.role]}</div>
      <div class="player-name-reveal">${escapeHtml(r.name)}</div>
      <div style="color: var(--gold-primary); font-weight: 700; margin-top: 4px;">+${r.points}</div>
    </div>`).join('');

  hiddenPlayersDisplay.innerHTML = '';
  revealedRoles.innerHTML = allRolesHtml;

  // Update scoreboard
  renderScoreboard(totalScores);

  // Update player list with scores
  renderPlayerList(totalScores.map(s => ({ name: s.name, totalScore: s.totalScore })));

  // Show action buttons if not game over
  if (!isGameOver) {
    actionButtons.classList.remove('hidden');
    startRoundBtn.disabled = false;
  }
});

socket.on('game-over', ({ finalScores, roundHistory }) => {
  currentPhase = 'finished';

  // Fill game over overlay
  const winner = finalScores[0];
  winnerName.textContent = `🎉 ${winner.name} wins with ${winner.totalScore} points!`;

  let html = '';
  finalScores.forEach((p, i) => {
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
});

// ─── Button Handlers ───

startRoundBtn.addEventListener('click', () => {
  const code = sessionStorage.getItem('roomCode');
  socket.emit('start-round', { roomCode: code });
  startRoundBtn.disabled = true;
});

nextRoundBtn.addEventListener('click', () => {
  const code = sessionStorage.getItem('roomCode');
  socket.emit('start-round', { roomCode: code });
  actionButtons.classList.add('hidden');
});

endGameBtn.addEventListener('click', () => {
  const code = sessionStorage.getItem('roomCode');
  socket.emit('end-game', { roomCode: code });
});

newGameBtn.addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = '/';
});

// ─── Error handling ───
socket.on('error-msg', ({ message }) => {
  showToast(message, 'error');
  startRoundBtn.disabled = false;
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
