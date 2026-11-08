/* ============================================================
   ArabDraw — Client Script (Part 1)
   ============================================================ */

// الاتصال بالسيرفر
const socket = io();

// حالة اللعبة العامة
const state = { 
    myId: null, 
    myAvatar: 'avatar-3.png', 
    hostId: null, 
    isDrawer: false, 
    gameState: 'waiting', 
    canDraw: false, 
    lastX: 0, 
    lastY: 0, 
    drawing: false, 
    color: '#000000', 
    size: 5, 
    currentRoomId: null 
};

// ربط عناصر الصفحة بالمتغيرات
const el = {
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    username: document.getElementById('username'),
    avatarImg: document.getElementById('selected-avatar-img'),
    players: document.getElementById('players-list'),
    canvas: document.getElementById('paint-canvas'),
    ctx: null,
    chat: document.getElementById('chat-messages'),
    input: document.getElementById('guess-input'),
    timer: document.getElementById('timer'),
    wordBox: document.getElementById('word-box'),
    toast: document.getElementById('toast'),
    colorsPalette: document.getElementById('colors-palette')
};

// قائمة الألوان المتاحة للرسم
const PALETTE = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#A52A2A', '#808080',
    '#FFC0CB', '#8B4513', '#008000', '#000080'
];

// دالة بناء لوحة الألوان في الواجهة
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

// دالة الإشعارات العائمة (Toast)
function showToast(msg) {
    if (el.toast) {
        el.toast.textContent = msg;
        el.toast.classList.add('show');
        setTimeout(() => el.toast.classList.remove('show'), 3000);
    } else {
        alert(msg);
    }
}

// نوافذ الأفاتار
function openAvatarModal() { 
    document.getElementById('avatar-modal').classList.add('active'); 
}
function closeAvatarModal() { 
    document.getElementById('avatar-modal').classList.remove('active'); 
}
function selectAvatar(p) { 
    state.myAvatar = p; 
    el.avatarImg.src = p; 
    closeAvatarModal(); 
}

// نوافذ المعلومات
function openInfoModal() { 
    document.getElementById('info-modal').classList.add('active'); 
}
function closeInfoModal() { 
    document.getElementById('info-modal').classList.remove('active'); 
}
function switchInfoTab(t) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(t === 'rules' ? 'tab-rules' : 'tab-about').classList.add('active');
    event.target.classList.add('active');
}

// نوافذ الغرف
function openRoomsModal() { 
    document.getElementById('rooms-modal').classList.add('active'); 
    socket.emit('get_rooms'); 
}
function closeRoomsModal() { 
    document.getElementById('rooms-modal').classList.remove('active'); 
}

// عرض الغرف في الواجهة
function renderRooms(rooms) {
    const container = document.getElementById('servers-list-container'); 
    if (!container) return;
    container.innerHTML = '';
    rooms.forEach(r => {
        const div = document.createElement('div'); 
        div.className = 'server-card'; 
        div.onclick = () => joinRoom(r.id);
        div.innerHTML = `
            <div class="server-info-left">
                <img src="${r.icon}" class="server-icon-img">
                <div>
                    <span class="server-name-text">${r.name}</span>
                    <span class="server-type-sub">${r.type}</span>
                </div>
            </div>
            <div class="server-stats-right">👤 ${r.players}/${r.max}</div>
        `;
        container.appendChild(div);
    });
}

// الانضمام إلى غرفة معينة
function joinRoom(id) {
    const u = el.username.value.trim();
    if (!u) return showToast('الرجاء كتابة الاسم أولاً!');
    socket.emit('join_game', { 
        username: u, 
        avatar: state.myAvatar, 
        roomId: id 
    });
    closeRoomsModal();
}

// اللعب السريع (دخول الغرفة العامة)
function playQuick() { 
    joinRoom(1); 
}

// إنشاء غرفة (مؤقتاً)
function createNewRoom() { 
    showToast('قريباً: إنشاء غرف مخصصة'); 
}

// ضبط حجم اللوحة تلقائياً
function resizeCanvas() {
    if (!el.canvas) return;
    const parent = el.canvas.parentElement;
    const size = Math.min(parent.clientWidth * 0.95, parent.clientHeight * 0.95, 700);
    if (size <= 0) return;
    
    const data = el.canvas.width > 0 ? el.canvas.toDataURL() : null;
    el.canvas.width = size; 
    el.canvas.height = size;
    el.canvas.style.width = size + 'px'; 
    el.canvas.style.height = size + 'px';
    
    state.ctx = el.canvas.getContext('2d'); 
    state.ctx.lineCap = 'round'; 
    state.ctx.lineJoin = 'round';
    
    if (data) { 
        const img = new Image(); 
        img.onload = () => state.ctx.drawImage(img, 0, 0, size, size); 
        img.src = data; 
    }
}

// الحصول على إحداثيات اللمس أو الماوس
function getPos(e) {
    const r = el.canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - r.left, y: cy - r.top };
}

// بدء الرسم
function startDraw(e) {
    if (!state.canDraw) return; 
    e.preventDefault();
    state.drawing = true; 
    const p = getPos(e); 
    state.lastX = p.x; 
    state.lastY = p.y;
    socket.emit('draw_start', { x: p.x, y: p.y, color: state.color, size: state.size });
    state.ctx.beginPath(); 
    state.ctx.arc(p.x, p.y, state.size / 2, 0, Math.PI * 2);
    state.ctx.fillStyle = state.color; 
    state.ctx.fill();
}

// استمرار الرسم
function moveDraw(e) {
    if (!state.drawing) return; 
    e.preventDefault();
    const p = getPos(e); 
    socket.emit('draw_move', { x: p.x, y: p.y });
    state.ctx.strokeStyle = state.color; 
    state.ctx.lineWidth = state.size;
    state.ctx.beginPath(); 
    state.ctx.moveTo(state.lastX, state.lastY); 
    state.ctx.lineTo(p.x, p.y); 
    state.ctx.stroke();
    state.lastX = p.x; 
    state.lastY = p.y;
}

// نهاية الرسم
function endDraw() { 
    if (!state.drawing) return; 
    state.drawing = false; 
    socket.emit('draw_end'); 
}

// مسح اللوحة
function clearCanvas() { 
    if (!state.canDraw) return; 
    socket.emit('clear_canvas'); 
    state.ctx.clearRect(0, 0, el.canvas.width, el.canvas.height); 
}

// إرسال رسالة دردشة أو تخمين
function handleChat(e) {
    if (e.key !== 'Enter') return;
    const v = el.input.value.trim(); 
    if (!v) return;
    socket.emit('send_chat', { message: v }); 
    el.input.value = '';
}

// الخروج من اللعبة
function leaveGame() { 
    if (!confirm('هل تريد الخروج؟')) return; 
    socket.disconnect(); 
    location.reload(); 
}

// متغيرات البروفايل
state.viewingPlayerId = null;

// فتح نافذة البروفايل
function openProfileModal(player) {
    state.viewingPlayerId = player.id;
    document.getElementById('profile-avatar').src = player.avatar;
    document.getElementById('profile-name').textContent = player.name;
    const btn = document.getElementById('btn-votekick');
    if (btn) btn.style.display = (player.id === state.myId) ? 'none' : 'block';
    document.getElementById('profile-modal').classList.add('active');
}

// إغلاق نافذة البروفايل
function closeProfileModal() { 
    document.getElementById('profile-modal').classList.remove('active'); 
}

// التصويت لطرد اللاعب
function voteKickPlayer() {
    if (!state.viewingPlayerId) return;
    if (confirm('هل تريد التصويت لطرد هذا اللاعب؟')) {
        socket.emit('vote_kick', { targetId: state.viewingPlayerId });
        closeProfileModal();
    }
}

// نوافذ الإبلاغ
function openReportModal() { 
    document.getElementById('report-modal').classList.add('active'); 
}
function closeReportModal() { 
    document.getElementById('report-modal').classList.remove('active'); 
}
function submitReport() {
    socket.emit('report_player', { targetId: state.viewingPlayerId || state.myId });
    closeReportModal(); 
    showToast('تم إرسال البلاغ للإدارة');
}

// ===== ربط أحداث السيرفر =====

// عند الاتصال
socket.on('connect', () => {
    state.myId = socket.id;
});

// استقبال قائمة الغرف
socket.on('rooms_list', rooms => {
    renderRooms(rooms);
});

// عند نجاح الانضمام للغرفة
socket.on('join_success', d => {
    state.myId = d.myId; 
    state.hostId = d.hostId; 
    state.currentRoomId = d.roomId;
    
    el.lobby.classList.remove('active'); 
    el.game.classList.add('active');
    
    setTimeout(resizeCanvas, 100); 
    el.chat.innerHTML = '';
    addChat({ type: 'system', message: `مرحباً بك في غرفة "${d.roomName}"` });
});

// عند فشل الانضمام
socket.on('join_error', d => {
    showToast(d.message);
});

// تحديث قائمة اللاعبين
socket.on('players_update', players => {
    el.players.innerHTML = '<h3>اللاعبون</h3>';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-item' + (p.id === state.myId ? ' me' : '') + (p.isDrawer ? ' drawer' : '');
        div.onclick = () => openProfileModal(p);
        div.innerHTML = `
            <img src="${p.avatar}" class="player-avatar">
            <div class="player-info">
                <span class="player-name">${p.name} ${p.isHost?'👑':''} ${p.hasGuessed?'✓':''}</span>
                <span class="player-score">${p.score} نقطة</span>
            </div>
        `;
        el.players.appendChild(div);
    });
    
    // إضافة زر بدء اللعبة إذا كنت المضيف
    if (state.myId === state.hostId && state.gameState === 'waiting') {
        const btn = document.createElement('button'); 
        btn.className = 'start-game-btn'; 
        btn.textContent = '▶ ابدأ اللعبة';
        btn.onclick = () => socket.emit('start_game'); 
        el.players.appendChild(btn);
    }
});

// تغيير المضيف
socket.on('host_changed', d => { 
    state.hostId = d.newHostId; 
    if (d.newHostId === state.myId) showToast('👑 أنت الآن المضيف!'); 
});

// بداية جولة جديدة
socket.on('round_start', d => {
    state.gameState = 'choosing'; 
    state.canDraw = false; 
    el.canvas.classList.add('readonly');
    el.wordBox.textContent = 'اختيار الكلمة...';
    addChat({ type: 'system', message: `✏️ ${d.drawerName} سيرسم الآن (جولة ${d.round}/${d.maxRounds})` });
});

// استقبال خيارات الكلمة (للراسم فقط)
socket.on('word_choices', choices => {
    let m = document.getElementById('word-choice-modal');
    if (!m) {
        m = document.createElement('div'); 
        m.id = 'word-choice-modal'; 
        m.className = 'modal-overlay active';
        m.innerHTML = `<div class="modal-content"><h2 class="modal-title">اختر كلمة للرسم</h2><div id="word-choices-list" class="word-choices"></div></div>`;
        document.body.appendChild(m);
    }
    const list = m.querySelector('#word-choices-list'); 
    list.innerHTML = '';
    choices.forEach(w => {
        const b = document.createElement('button'); 
        b.className = 'word-choice-btn'; 
        b.textContent = w;
        b.onclick = () => { 
            socket.emit('choose_word', { word: w }); 
            m.classList.remove('active'); 
        };
        list.appendChild(b);
    });
    m.classList.add('active');
});

// استقبال الكلمة (للراسم فقط)
socket.on('drawer_word', d => { 
    state.canDraw = true; 
    el.wordBox.textContent = d.word; 
    setTimeout(resizeCanvas, 100); 
});

// استقبال التلميح (للجميع)
socket.on('word_selected', d => {
    state.gameState = 'drawing';
    if (state.myId !== d.drawerId) {
        el.wordBox.textContent = d.hint;
    }
});

// تحديث التلميح تدريجياً
socket.on('hint_update', d => { 
    if (!state.isDrawer) {
        el.wordBox.textContent = d.hint; 
    }
});

// تحديث المؤقت
socket.on('timer_tick', d => { 
    el.timer.textContent = d.seconds; 
    el.timer.classList.toggle('urgent', d.seconds <= 10); 
});

// استقبال بيانات الرسم من الآخرين
socket.on('draw_data', d => {
    if (!state.ctx) return;
    if (d.type === 'start') {
        state.ctx.beginPath(); 
        state.ctx.arc(d.x, d.y, d.size / 2, 0, Math.PI * 2);
        state.ctx.fillStyle = d.color; 
        state.ctx.fill();
        state._lx = d.x; 
        state._ly = d.y;
    } else if (d.type === 'move') {
        state.ctx.strokeStyle = d.color || state.color; 
        state.ctx.lineWidth = d.size || state.size;
        state.ctx.beginPath(); 
        state.ctx.moveTo(state._lx, state._ly); 
        state.ctx.lineTo(d.x, d.y); 
        state.ctx.stroke();
        state._lx = d.x; 
        state._ly = d.y;
    }
});

// مسح اللوحة
socket.on('canvas_clear', () => { 
    if (state.ctx) state.ctx.clearRect(0, 0, el.canvas.width, el.canvas.height); 
});

// دالة إضافة رسالة للدردشة
function addChat(d) {
    const div = document.createElement('div'); 
    div.className = 'chat-msg ' + (d.type || 'chat');
    if (d.type === 'chat') {
        div.innerHTML = `<strong>${d.username}:</strong> ${d.message}`;
    } else {
        div.textContent = d.message;
    }
    el.chat.appendChild(div); 
    el.chat.scrollTop = el.chat.scrollHeight;
}

// استقبال رسائل الدردشة
socket.on('chat_message', d => addChat(d));

// حدث التخمين الصحيح
socket.on('correct_guess', d => {
    addChat({ 
        type: 'correct', 
        message: d.word ? `🎉 ${d.name} خمّن الكلمة (${d.word})! +${d.points}` : `✅ ${d.name} خمّن الكلمة! +${d.points}` 
    });
});

// حدث التخمين القريب
socket.on('close_guess', () => {
    addChat({ type: 'close', message: '🔥 قريب جداً!' });
});

// دالة عرض الملصق
function showSticker(img, title, subtitle) {
    const overlay = document.getElementById('overlay-sticker');
    if (!overlay) return;
    document.getElementById('sticker-img').src = img;
    document.getElementById('sticker-title').textContent = title;
    document.getElementById('sticker-subtitle').textContent = subtitle;
    overlay.style.display = 'flex';
    setTimeout(() => overlay.style.display = 'none', 5000);
}

// استقبال الملصق من السيرفر
socket.on('show_sticker', d => { 
    showSticker(d.img, d.title, d.subtitle); 
});

// نهاية الجولة (عرض النتائج)
socket.on('round_end', d => {
    state.canDraw = false; 
    el.canvas.classList.add('readonly');
    
    const oldOv = document.getElementById('round-end-modal');
    if (oldOv) oldOv.remove();

    const ov = document.createElement('div'); 
    ov.id = 'round-end-modal';
    ov.className = 'modal-overlay active';
    
    ov.innerHTML = `
        <div class="modal-content">
            <h2 class="modal-title" style="text-align:center;">انتهت الجولة</h2>
            <p style="font-size:1.2rem; margin:10px 0; text-align:center;">
                الكلمة كانت: <strong style="color:#15803d; font-size:1.5rem">${d.word}</strong>
            </p>
            <div class="scores-list">
                ${d.scores.map((p,i)=>`
                    <div class="score-row">
                        <span>${i+1}. ${p.name}</span>
                        <span>${p.score} نقطة</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(ov); 
    setTimeout(() => ov.remove(), 6000);
});

// نهاية اللعبة (عرض الفائز)
socket.on('game_end', d => {
    const ov = document.createElement('div'); 
    ov.id = 'game-end-modal';
    ov.className = 'modal-overlay active';
    
    ov.innerHTML = `
        <div class="modal-content" style="text-align:center">
            <h2 class="modal-title" style="font-size:1.5rem">🏆 الفائز</h2>
            <p style="font-size:2rem; color:#15803d; font-weight:bold; margin:10px 0">${d.scores[0]?.name || 'لا أحد'}</p>
            <p style="font-size:1.2rem; color:#64748b">${d.scores[0]?.score || 0} نقطة</p>
            <div class="scores-list">
                ${d.scores.map((p,i)=>`
                    <div class="score-row">
                        <span>${i+1}. ${p.name}</span>
                        <span>${p.score} نقطة</span>
                    </div>
                `).join('')}
            </div>
            <button class="ok-btn" onclick="location.reload()">حسناً</button>
        </div>
    `;
    document.body.appendChild(ov);
});

// استقبال حدث الطرد
socket.on('kicked', () => { 
    showToast('تم طردك من الغرفة!'); 
    setTimeout(() => location.reload(), 2000); 
});

// استقبال إشعارات عامة
socket.on('toast', d => showToast(d.message));

// ===== التهيئة عند تحميل الصفحة =====
window.addEventListener('load', () => {
    state.ctx = el.canvas.getContext('2d');
    buildPalette();
    
    // أحداث الرسم بالماوس
    el.canvas.addEventListener('mousedown', startDraw); 
    el.canvas.addEventListener('mousemove', moveDraw); 
    el.canvas.addEventListener('mouseup', endDraw); 
    el.canvas.addEventListener('mouseleave', endDraw);
    
    // أحداث الرسم باللمس
    el.canvas.addEventListener('touchstart', startDraw, { passive: false }); 
    el.canvas.addEventListener('touchmove', moveDraw, { passive: false }); 
    el.canvas.addEventListener('touchend', endDraw);
    
    // تغيير حجم الفرشاة
    document.getElementById('brush-size').addEventListener('input', e => {
        state.size = parseInt(e.target.value);
    });
    
    // إعادة حساب حجم اللوحة عند تغيير حجم الشاشة
    window.addEventListener('resize', resizeCanvas);
});

// ==== نظام الإدارة ====
function openAdminModal() {
    document.getElementById('admin-modal').classList.add('active');
}
function closeAdminModal() {
    document.getElementById('admin-modal').classList.remove('active');
}
function loginAdmin() {
    const pass = document.getElementById('admin-pass').value;
    socket.emit('admin_login', pass);
}

socket.on('admin_success', () => {
    document.getElementById('admin-login-box').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    showToast('✅ تم الدخول كمدير');
});

socket.on('new_report', (report) => {
    const list = document.getElementById('reports-list');
    if (list) {
        list.innerHTML += `<div style="margin-bottom:5px; border-bottom:1px solid #ddd; padding:5px;">📢 ${report.reporter} أبلغ عن ${report.target} (${report.time})</div>`;
    }
});

// ==== حماية المطور عبر رابط سري ====
const ADMIN_SECRET = "ali_king"; // كلمة السر السرية

window.addEventListener('load', () => {
    // التحقق من وجود كلمة السر في الرابط
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === ADMIN_SECRET) {
        // إذا كان الرابط يحتوي على الكلمة السرية، أظهر زر الترس
        const adminBtn = document.createElement('div');
        adminBtn.id = 'admin-icon';
        adminBtn.innerHTML = '⚙️';
        adminBtn.style.cssText = 'position:fixed; top:15px; right:15px; font-size:2rem; z-index:99999; cursor:pointer; background:rgba(0,0,0,0.7); padding:5px; border-radius:50%; box-shadow: 0 0 10px #000;';
        adminBtn.onclick = () => openAdminModal();
        document.body.appendChild(adminBtn);
        showToast('👑 مرحباً بك يا مطور!');
    }
});

// ==== لوحة الإدارة (نسخة احترافية) ====
function openAdminModal() {
    document.getElementById('admin-modal').classList.add('active');
}
function closeAdminModal() {
    document.getElementById('admin-modal').classList.remove('active');
}
function loginAdmin() {
    const pass = document.getElementById('admin-pass').value;
    socket.emit('admin_login', pass);
}

socket.on('admin_success', () => {
    document.getElementById('admin-login-box').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    showToast('✅ تم الدخول كمدير');
});

socket.on('new_report', (report) => {
    const list = document.getElementById('reports-list');
    if (list) {
        const div = document.createElement('div');
        div.style.cssText = 'margin-bottom:5px; border-bottom:1px solid #ddd; padding:5px; display:flex; justify-content:space-between; align-items:center;';
        div.innerHTML = `
            <span>📢 ${report.reporterName} أبلغ عن <b>${report.targetName}</b> (${report.roomName})</span>
            <button onclick="adminKick('${report.targetId}', '${report.targetName}')" style="background:#ef4444; color:#fff; border:none; border-radius:5px; padding:3px 8px; cursor:pointer; font-size:0.8rem;">طرد</button>
        `;
        list.appendChild(div);
    }
});

function adminKick(targetId, targetName) {
    if (confirm(`هل تريد طرد ${targetName}؟`)) {
        socket.emit('admin_kick', { targetId, targetName });
    }
}

socket.on('admin_kicked_success', () => {
    showToast('✅ تم طرد اللاعب بنجاح');
});

// ==== لوحة الإدارة (نسخة آمنة) ====
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'ali_king') {
        const adminBtn = document.createElement('div');
        adminBtn.id = 'admin-icon';
        adminBtn.innerHTML = '⚙️';
        adminBtn.style.cssText = 'position:fixed; top:15px; right:15px; font-size:2rem; z-index:99999; cursor:pointer; background:rgba(0,0,0,0.7); padding:5px; border-radius:50%; box-shadow: 0 0 10px #000;';
        adminBtn.onclick = () => openAdminModal();
        document.body.appendChild(adminBtn);
    }
});

function openAdminModal() { document.getElementById('admin-modal').classList.add('active'); }
function closeAdminModal() { document.getElementById('admin-modal').classList.remove('active'); }
function loginAdmin() { socket.emit('admin_login', document.getElementById('admin-pass').value); }

socket.on('admin_success', () => {
    document.getElementById('admin-login-box').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    showToast('✅ تم الدخول كمدير');
});

socket.on('new_report', (report) => {
    const list = document.getElementById('reports-list');
    if (list) {
        const div = document.createElement('div');
        div.style.cssText = 'margin-bottom:5px; border-bottom:1px solid #ddd; padding:5px; display:flex; justify-content:space-between; align-items:center;';
        div.innerHTML = `<span>📢 ${report.reporterName} أبلغ عن <b>${report.targetName}</b></span><button onclick="adminKick('${report.targetId}', '${report.targetName}')" style="background:#ef4444; color:#fff; border:none; border-radius:5px; padding:3px 8px; cursor:pointer; font-size:0.8rem;">طرد</button>`;
        list.appendChild(div);
    }
});

function adminKick(targetId, targetName) {
    if (confirm(`هل تريد طرد ${targetName}؟`)) socket.emit('admin_kick', { targetId, targetName });
}
git add .
git commit -m "إصلاح نظام الإدارة"
git push origin main
git log --oneline
git reset --hard HEAD~1
cat << 'EOF' > admin.js
const socket = io();
const ADMIN_PASSWORD = "ali123";
const reports = [];
const admins = new Set();
