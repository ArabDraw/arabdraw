/* ============================================================
   ArabDraw — Client Script (نسخة نظيفة ومستقرة)
   ============================================================ */
const socket = io();
const state = { 
    myId: null, myAvatar: 'avatar-3.png', hostId: null, isDrawer: false, 
    gameState: 'waiting', canDraw: false, lastX: 0, lastY: 0, 
    drawing: false, color: '#000000', size: 5 
};

const el = {
    lobby: document.getElementById('lobby-screen'), game: document.getElementById('game-screen'),
    username: document.getElementById('username'), avatarImg: document.getElementById('selected-avatar-img'),
    players: document.getElementById('players-list'), canvas: document.getElementById('paint-canvas'),
    ctx: null, chat: document.getElementById('chat-messages'), input: document.getElementById('guess-input'),
    timer: document.getElementById('timer'), wordBox: document.getElementById('word-box'), toast: document.getElementById('toast'),
    colorsPalette: document.getElementById('colors-palette')
};

const PALETTE = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#A52A2A', '#808080'];
function buildPalette() {
    if (!el.colorsPalette) return;
    el.colorsPalette.innerHTML = '';
    PALETTE.forEach(c => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = c;
        swatch.onclick = () => { state.color = c; };
        el.colorsPalette.appendChild(swatch);
    });
}

function showToast(msg) {
    if (el.toast) { el.toast.textContent = msg; el.toast.classList.add('show'); setTimeout(() => el.toast.classList.remove('show'), 3000); }
    else alert(msg);
}

function openAvatarModal() { document.getElementById('avatar-modal').classList.add('active'); }
function closeAvatarModal() { document.getElementById('avatar-modal').classList.remove('active'); }
function selectAvatar(p) { state.myAvatar = p; el.avatarImg.src = p; closeAvatarModal(); }
function openInfoModal() { document.getElementById('info-modal').classList.add('active'); }
function closeInfoModal() { document.getElementById('info-modal').classList.remove('active'); }
function switchInfoTab(t) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(t === 'rules' ? 'tab-rules' : 'tab-about').classList.add('active');
    event.target.classList.add('active');
}

function openRoomsModal() { document.getElementById('rooms-modal').classList.add('active'); socket.emit('get_rooms'); }
function closeRoomsModal() { document.getElementById('rooms-modal').classList.remove('active'); }

function renderRooms(rooms) {
    const container = document.getElementById('servers-list-container'); 
    if (!container) return;
    container.innerHTML = '';
    rooms.forEach(r => {
        const div = document.createElement('div'); div.className = 'server-card'; div.onclick = () => joinRoom(r.id);
        div.innerHTML = `<div class="server-info-left"><img src="${r.icon}" class="server-icon-img"><div><span class="server-name-text">${r.name}</span><span class="server-type-sub">${r.type}</span></div></div><div class="server-stats-right">👤 ${r.players}/${r.max}</div>`;
        container.appendChild(div);
    });
}

function joinRoom(id) {
    const u = el.username.value.trim();
    if (!u) return showToast('الرجاء كتابة الاسم!');
    socket.emit('join_game', { username: u, avatar: state.myAvatar, roomId: id });
    closeRoomsModal();
}
function playQuick() { joinRoom(1); }
function createNewRoom() { showToast('قريباً: إنشاء غرف مخصصة'); }

function resizeCanvas() {
    if (!el.canvas) return;
    const parent = el.canvas.parentElement;
    const size = Math.min(parent.clientWidth * 0.95, parent.clientHeight * 0.95, 600);
    if (size <= 0) return;
    const data = el.canvas.width > 0 ? el.canvas.toDataURL() : null;
    el.canvas.width = size; el.canvas.height = size;
    el.canvas.style.width = size + 'px'; el.canvas.style.height = size + 'px';
    state.ctx = el.canvas.getContext('2d'); state.ctx.lineCap = 'round'; state.ctx.lineJoin = 'round';
    if (data) { const img = new Image(); img.onload = () => state.ctx.drawImage(img, 0, 0, size, size); img.src = data; }
}

function getPos(e) { const r = el.canvas.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY; return { x: cx - r.left, y: cy - r.top }; }
function startDraw(e) { if (!state.canDraw) return; e.preventDefault(); state.drawing = true; const p = getPos(e); state.lastX = p.x; state.lastY = p.y; socket.emit('draw_start', { x: p.x, y: p.y, color: state.color, size: state.size }); state.ctx.beginPath(); state.ctx.arc(p.x, p.y, state.size / 2, 0, Math.PI * 2); state.ctx.fillStyle = state.color; state.ctx.fill(); }
function moveDraw(e) { if (!state.drawing) return; e.preventDefault(); const p = getPos(e); socket.emit('draw_move', { x: p.x, y: p.y }); state.ctx.strokeStyle = state.color; state.ctx.lineWidth = state.size; state.ctx.beginPath(); state.ctx.moveTo(state.lastX, state.lastY); state.ctx.lineTo(p.x, p.y); state.ctx.stroke(); state.lastX = p.x; state.lastY = p.y; }
function endDraw() { if (!state.drawing) return; state.drawing = false; socket.emit('draw_end'); }
function clearCanvas() { if (!state.canDraw) return; socket.emit('clear_canvas'); state.ctx.clearRect(0, 0, el.canvas.width, el.canvas.height); }
function handleChat(e) { if (e.key !== 'Enter') return; const v = el.input.value.trim(); if (!v) return; socket.emit('send_chat', { message: v }); el.input.value = ''; }
function leaveGame() { if (!confirm('هل تريد الخروج؟')) return; socket.disconnect(); location.reload(); }

function openProfileModal(p) { document.getElementById('profile-avatar').src = p.avatar; document.getElementById('profile-name').textContent = p.name; document.getElementById('profile-modal').classList.add('active'); }
function closeProfileModal() { document.getElementById('profile-modal').classList.remove('active'); }
function openReportModal() { document.getElementById('report-modal').classList.add('active'); }
function closeReportModal() { document.getElementById('report-modal').classList.remove('active'); }
function submitReport() { closeReportModal(); showToast('تم الإبلاغ'); }
function voteKickPlayer() { showToast('قريباً'); }

function addChat(d) {
    const div = document.createElement('div'); div.className = 'chat-msg ' + (d.type || 'chat');
    if (d.type === 'chat') div.innerHTML = `<strong>${d.username}:</strong> ${d.message}`; else div.textContent = d.message;
    el.chat.appendChild(div); el.chat.scrollTop = el.chat.scrollHeight;
}

socket.on('connect', () => state.myId = socket.id);
socket.on('rooms_list', r => renderRooms(r));
socket.on('join_success', d => { state.myId = d.myId; state.hostId = d.hostId; el.lobby.classList.remove('active'); el.game.classList.add('active'); setTimeout(resizeCanvas, 100); el.chat.innerHTML = ''; addChat({ type: 'system', message: `مرحباً بك في ${d.roomName}` }); });
socket.on('join_error', d => showToast(d.message));
socket.on('players_update', players => {
    el.players.innerHTML = '<h3>اللاعبون</h3>';
    players.forEach(p => {
        const div = document.createElement('div'); div.className = 'player-item' + (p.id === state.myId ? ' me' : '') + (p.isDrawer ? ' drawer' : '');
        div.onclick = () => openProfileModal(p);
        div.innerHTML = `<img src="${p.avatar}" class="player-avatar"><div class="player-info"><span class="player-name">${p.name} ${p.isHost?'👑':''}</span><span class="player-score">${p.score} نقطة</span></div>`;
        el.players.appendChild(div);
    });
    if (state.myId === state.hostId && state.gameState === 'waiting') {
        const btn = document.createElement('button'); btn.className = 'start-game-btn'; btn.textContent = '▶ ابدأ اللعبة';
        btn.onclick = () => socket.emit('start_game'); el.players.appendChild(btn);
    }
});
socket.on('host_changed', d => { state.hostId = d.newHostId; });
socket.on('round_start', d => { state.gameState = 'choosing'; state.canDraw = false; el.canvas.classList.add('readonly'); el.wordBox.textContent = 'اختيار الكلمة...'; });
socket.on('word_choices', choices => {
    let m = document.getElementById('word-choice-modal');
    if (!m) { m = document.createElement('div'); m.id = 'word-choice-modal'; m.className = 'modal-overlay active'; m.innerHTML = `<div class="modal-content"><h2 class="modal-title">اختر كلمة للرسم</h2><div id="word-choices-list" class="word-choices"></div></div>`; document.body.appendChild(m); }
    const list = m.querySelector('#word-choices-list'); list.innerHTML = '';
    choices.forEach(w => { const b = document.createElement('button'); b.className = 'word-choice-btn'; b.textContent = w; b.onclick = () => { socket.emit('choose_word', { word: w }); m.classList.remove('active'); }; list.appendChild(b); });
    m.classList.add('active');
});
socket.on('drawer_word', d => { state.canDraw = true; el.wordBox.textContent = d.word; setTimeout(resizeCanvas, 100); });
socket.on('word_selected', d => { state.gameState = 'drawing'; if (state.myId !== d.drawerId) el.wordBox.textContent = d.hint; });
socket.on('hint_update', d => { if (!state.isDrawer) el.wordBox.textContent = d.hint; });
socket.on('timer_tick', d => { el.timer.textContent = d.seconds; });
socket.on('draw_data', d => {
    if (!state.ctx) return;
    if (d.type === 'start') { state.ctx.beginPath(); state.ctx.arc(d.x, d.y, d.size / 2, 0, Math.PI * 2); state.ctx.fillStyle = d.color; state.ctx.fill(); state._lx = d.x; state._ly = d.y; }
    else if (d.type === 'move') { state.ctx.strokeStyle = d.color; state.ctx.lineWidth = d.size; state.ctx.beginPath(); state.ctx.moveTo(state._lx, state._ly); state.ctx.lineTo(d.x, d.y); state.ctx.stroke(); state._lx = d.x; state._ly = d.y; }
});
socket.on('canvas_clear', () => { if (state.ctx) state.ctx.clearRect(0, 0, el.canvas.width, el.canvas.height); });
socket.on('chat_message', d => addChat(d));
socket.on('correct_guess', d => addChat({ type: 'correct', message: `🎉 ${d.name} خمّن الكلمة! +${d.points}` }));
socket.on('round_end', d => {
    state.canDraw = false; el.canvas.classList.add('readonly');
    const ov = document.createElement('div'); ov.className = 'modal-overlay active';
    ov.innerHTML = `<div class="modal-content"><h2 class="modal-title">انتهت الجولة</h2><p>الكلمة: <strong>${d.word}</strong></p><div class="scores-list">${d.scores.map((p,i)=>`<div class="score-row"><span>${i+1}. ${p.name}</span><span>${p.score}</span></div>`).join('')}</div></div>`;
    document.body.appendChild(ov); setTimeout(() => ov.remove(), 5000);
});
socket.on('game_end', d => {
    const ov = document.createElement('div'); ov.className = 'modal-overlay active';
    ov.innerHTML = `<div class="modal-content"><h2 class="modal-title">🏆 الفائز</h2><p>${d.scores[0]?.name}</p><div class="scores-list">${d.scores.map((p,i)=>`<div class="score-row"><span>${i+1}. ${p.name}</span><span>${p.score}</span></div>`).join('')}</div><button class="ok-btn" onclick="location.reload()">حسناً</button></div>`;
    document.body.appendChild(ov);
});
socket.on('kicked', () => { showToast('تم طردك!'); setTimeout(() => location.reload(), 2000); });
socket.on('toast', d => showToast(d.message));

window.addEventListener('load', () => {
    state.ctx = el.canvas.getContext('2d');
    buildPalette();
    el.canvas.addEventListener('mousedown', startDraw); el.canvas.addEventListener('mousemove', moveDraw); el.canvas.addEventListener('mouseup', endDraw); el.canvas.addEventListener('mouseleave', endDraw);
    el.canvas.addEventListener('touchstart', startDraw, { passive: false }); el.canvas.addEventListener('touchmove', moveDraw, { passive: false }); el.canvas.addEventListener('touchend', endDraw);
    document.getElementById('brush-size').addEventListener('input', e => state.size = parseInt(e.target.value));
    window.addEventListener('resize', resizeCanvas);
});
