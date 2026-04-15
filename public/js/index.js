// Landing page logic — Create & Join game
// No socket needed here — just validate and redirect

// ─── DOM Elements ───
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const hostNameInput = document.getElementById('host-name');
const totalRoundsInput = document.getElementById('total-rounds');
const createBtn = document.getElementById('create-btn');

const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code');
const joinBtn = document.getElementById('join-btn');

// ─── Tab Switching ───
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
  });
});

// ─── Create Game ───
createBtn.addEventListener('click', () => {
  const hostName = hostNameInput.value.trim();
  const totalRounds = parseInt(totalRoundsInput.value) || 5;

  if (!hostName) {
    showToast('Please enter your name!', 'error');
    hostNameInput.focus();
    return;
  }

  if (totalRounds < 1 || totalRounds > 20) {
    showToast('Rounds must be between 1 and 20!', 'error');
    totalRoundsInput.focus();
    return;
  }

  // Store in sessionStorage and redirect to host page
  // Room creation happens on host.html with the live socket
  sessionStorage.setItem('hostName', hostName);
  sessionStorage.setItem('totalRounds', totalRounds.toString());
  sessionStorage.setItem('isHost', 'true');
  window.location.href = '/host';
});

// ─── Join Game ───
joinBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim();
  const roomCode = roomCodeInput.value.trim().toUpperCase();

  if (!playerName) {
    showToast('Please enter your name!', 'error');
    playerNameInput.focus();
    return;
  }

  if (!roomCode || roomCode.length !== 4) {
    showToast('Please enter a valid 4-character room code!', 'error');
    roomCodeInput.focus();
    return;
  }

  // Store in sessionStorage and redirect to player page
  // Room joining happens on player.html with the live socket
  sessionStorage.setItem('playerName', playerName);
  sessionStorage.setItem('roomCode', roomCode);
  sessionStorage.setItem('isHost', 'false');
  window.location.href = '/play';
});

// ─── Enter key support ───
hostNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') createBtn.click();
});

totalRoundsInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') createBtn.click();
});

playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (roomCodeInput.value.trim().length < 4) {
      roomCodeInput.focus();
    } else {
      joinBtn.click();
    }
  }
});

roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

// Auto uppercase room code
roomCodeInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

// ─── Toast Notification ───
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
