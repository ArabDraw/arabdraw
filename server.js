const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname));

const MAX_PLAYERS = 15, MIN_PLAYERS = 2, DRAW_TIME = 80, CHOOSE_TIME = 15, ROUNDS = 3, HINT_INTERVAL = 20;

const WORDS = {
    general: ['شمس','قمر','جبل','بحر','شجرة','كتاب','سيارة','طائرة','ساعة','مفتاح','باب','كرسي','طاولة','سرير','مصباح','مرآة','حقيبة','حذاء','قبعة','نظارة','سيف','درع','تاج','خاتم','قلب','عين','مطر','ثلج','برق','سحابة','ريح','نار','دخان','صحراء','واحة','نخلة','خيمة','دلة','قدر','سجادة','بخور','فانوس','هاتف','حاسوب','تلفاز','كاميرا','سكين','ملعقة','كوب','صحن','خبز','قهوة','شاي','طبيب','مهندس','معلم','شرطي','طيار','نجار','خباز','مزارع','صياد','رسام','فرح','حزن','غضب','خوف','حب','أمل','حلم','فكرة','ذكرى','وعد','سعادة','بيت','نافذة','مسجد','مدرسة','مستشفى','برج','جسر','نهر','بحيرة','جزيرة','قفل','صندوق','سلة','زهرة','ورقة','قلم','دفتر','مقص','مشط','فرشاة','معجون','صابون','منشفة','خريطة'],
    animals: ['أسد','نمر','فيل','زرافة','وحيد القرن','فرس النهر','تمساح','ثعبان','ضفدع','سلحفاة','ذئب','ثعلب','دب','باندا','كنغر','غوريلا','قرد','حصان','حمار','بقرة','خروف','ماعز','جمل','دجاجة','ديك','بطة','إوزة','حمامة','غراب','نسر','صقر','بومة','ببغاء','طاووس','نعامة','بطريق','نورس','كلب','قطة','فأر','أرنب','سنجاب','قنفذ','خفاش','دلفين','حوت','قرش','أخطبوط','سمكة','نجم البحر','سلطعون','عقرب','عنكبوت','فراشة','نحلة','نملة','جرادة','ديناصور','غزال','ضبع'],
    flags: ['السعودية','مصر','الإمارات','الكويت','قطر','البحرين','عمان','الأردن','لبنان','سوريا','العراق','فلسطين','اليمن','السودان','ليبيا','تونس','الجزائر','المغرب','موريتانيا','الصومال','جيبوتي','جزر القمر','تركيا','إيران','باكستان','الهند','الصين','اليابان','كوريا الجنوبية','إندونيسيا','ماليزيا','فرنسا','إيطاليا','ألمانيا','إسبانيا','البرتغال','بريطانيا','روسيا','أمريكا','كندا','البرازيل','الأرجنتين','المكسيك','أستراليا','نيوزيلندا']
};

const ROOMS_DEF = [
    { id: 1, name: 'عام', type: 'رسم منوع', icon: 'room-general.png', cat: 'general' },
    { id: 2, name: 'حيوانات', type: 'رسم الحيوانات', icon: 'room-animals.png', cat: 'animals' },
    { id: 3, name: 'أعلام', type: 'رسم الأعلام', icon: 'room-media.png', cat: 'flags' }
];
const rooms = new Map();

function createRoom(id, name, type, icon, cat) {
    return { id, name, type, icon, cat, players: new Map(), hostId: null, state: 'waiting', round: 0, maxRounds: ROUNDS, drawerId: null, currentWord: null, currentHint: '', timer: null, guessedPlayers: new Set(), hintsRevealed: 0, roundOrder: [], roundIndex: -1, usedWords: [] };
}
ROOMS_DEF.forEach(r => rooms.set(r.id, createRoom(r.id, r.name, r.type, r.icon, r.cat)));

const getRoomsInfo = () => Array.from(rooms.values()).map(r => ({ id: r.id, name: r.name, type: r.type, icon: r.icon, players: r.players.size, max: MAX_PLAYERS }));
const updateRoomsList = () => io.emit('rooms_list', getRoomsInfo());
const systemMsg = (room, text, type = 'system') => io.to('room_' + room.id).emit('chat_message', { type, message: text, username: 'النظام' });

function getPlayersArray(room) {
    const arr = [];
    room.players.forEach((p, id) => arr.push({ id, name: p.name, avatar: p.avatar, score: p.score, isHost: id === room.hostId, isDrawer: id === room.drawerId, hasGuessed: room.guessedPlayers.has(id) }));
    arr.sort((a, b) => a.isHost ? -1 : b.isHost ? 1 : b.score - a.score);
    return arr;
}
const updatePlayers = (room) => io.to('room_' + room.id).emit('players_update', getPlayersArray(room));
const clearTimer = (room) => { if (room.timer) { clearInterval(room.timer); room.timer = null; } };

function startTimer(room, duration, onTick, onEnd) {
    clearTimer(room);
    let time = duration;
    onTick(time);
    room.timer = setInterval(() => {
        time--; onTick(time);
        if (time <= 0) { clearTimer(room); onEnd(); }
    }, 1000);
}

function buildHint(word, revealCount) {
    const chars = word.split(''), indices = [];
    chars.forEach((c, i) => { if (c !== ' ') indices.push(i); });
    const toReveal = indices.slice(0, revealCount);
    return chars.map((c, i) => (c === ' ' ? ' ' : toReveal.includes(i) ? c : '_')).join(' ');
}
const pickWords = (cat, count, used) => {
    const pool = WORDS[cat] || WORDS.general;
    const avail = pool.filter(w => !used.includes(w));
    return (avail.length >= count ? avail : pool).sort(() => Math.random() - 0.5).slice(0, count);
};

function resetRoom(room) {
    clearTimer(room);
    room.state = 'waiting'; room.round = 0; room.drawerId = null; room.currentWord = null; room.currentHint = '';
    room.usedWords = []; room.roundOrder = []; room.roundIndex = -1; room.guessedPlayers.clear(); room.hintsRevealed = 0;
    room.players.forEach(p => p.score = 0);
    updatePlayers(room);
}

function startGame(room) {
    if (room.players.size < MIN_PLAYERS) return systemMsg(room, `تحتاج ${MIN_PLAYERS} لاعبين على الأقل!`);
    room.players.forEach(p => p.score = 0);
    room.round = 1; room.usedWords = [];
    room.roundOrder = Array.from(room.players.keys()).sort(() => Math.random() - 0.5);
    room.roundIndex = -1;
    systemMsg(room, '🎮 بدأت اللعبة!');
    nextTurn(room);
}

function nextTurn(room) {
    clearTimer(room); room.roundIndex++;
    while (room.roundIndex < room.roundOrder.length && !room.players.has(room.roundOrder[room.roundIndex])) room.roundIndex++;
    if (room.roundIndex >= room.roundOrder.length) {
        room.round++;
        if (room.round > room.maxRounds) return endGame(room);
        room.usedWords = []; room.roundOrder = Array.from(room.players.keys()).sort(() => Math.random() - 0.5); room.roundIndex = 0;
    }
    const drawerId = room.roundOrder[room.roundIndex];
    room.drawerId = drawerId; room.state = 'choosing'; room.guessedPlayers.clear(); room.hintsRevealed = 0; room.currentHint = '';
    const drawer = room.players.get(drawerId);
    const choices = pickWords(room.cat, 3, room.usedWords);
    updatePlayers(room);
    io.to('room_' + room.id).emit('round_start', { drawerId, drawerName: drawer ? drawer.name : '؟', round: room.round, maxRounds: room.maxRounds });
    if (drawer) io.to(drawerId).emit('word_choices', choices);
    startTimer(room, CHOOSE_TIME, t => io.to('room_' + room.id).emit('timer_tick', { seconds: t }), () => { if (room.state === 'choosing' && drawer) startDrawing(room, choices[0]); });
}

function startDrawing(room, word) {
    clearTimer(room);
    room.state = 'drawing'; room.currentWord = word; room.usedWords.push(word);
    room.guessedPlayers.clear(); room.hintsRevealed = 0; room.currentHint = buildHint(word, 0);
    io.to('room_' + room.id).emit('word_selected', { drawerId: room.drawerId, wordLength: word.length, hint: room.currentHint });
    io.to(room.drawerId).emit('drawer_word', { word });
    updatePlayers(room); io.to('room_' + room.id).emit('canvas_clear');
    systemMsg(room, `✏️ ${room.players.get(room.drawerId).name} يرسم الآن`);
    let elapsed = 0;
    startTimer(room, DRAW_TIME, t => {
        io.to('room_' + room.id).emit('timer_tick', { seconds: t });
        elapsed = DRAW_TIME - t;
        const shouldReveal = [HINT_INTERVAL, HINT_INTERVAL*2].filter(x => x <= elapsed).length;
        if (shouldReveal > room.hintsRevealed) { room.hintsRevealed = shouldReveal; room.currentHint = buildHint(word, shouldReveal); io.to('room_' + room.id).emit('hint_update', { hint: room.currentHint }); }
    }, () => endRound(room, 'انتهى الوقت'));
}

function endRound(room, reason) {
    clearTimer(room);
    if (room.state !== 'drawing') return;
    room.state = 'roundEnd';
    setTimeout(() => {
        io.to('room_' + room.id).emit('round_end', { word: room.currentWord, scores: getPlayersArray(room), reason });
        setTimeout(() => { if (room.players.size > 0) nextTurn(room); }, 3000);
    }, 1000);
}

function endGame(room) {
    clearTimer(room); room.state = 'gameEnd';
    io.to('room_' + room.id).emit('game_end', { scores: getPlayersArray(room) });
    setTimeout(() => { if (room.players.size > 0) resetRoom(room); }, 8000);
}

function checkGuess(room, socketId, text) {
    if (room.state !== 'drawing' || !room.currentWord || socketId === room.drawerId || room.guessedPlayers.has(socketId)) return false;
    const player = room.players.get(socketId); if (!player) return false;
    const norm = text.trim().toLowerCase().replace(/\s+/g, ' ');
    if (norm === room.currentWord.toLowerCase()) {
        const order = room.guessedPlayers.size + 1;
        let pts = order === 1 ? 30 : order === 2 ? 20 : 10;
        player.score += pts; room.guessedPlayers.add(socketId);
        const drawer = room.players.get(room.drawerId); if (drawer) drawer.score += 50;
        io.to('room_' + room.id).emit('correct_guess', { name: player.name, points: pts });
        updatePlayers(room);
        if (room.guessedPlayers.size >= room.players.size - 1) endRound(room, 'خمّن الجميع');
        return true;
    }
    return false;
}

io.on('connection', (socket) => {
    socket.on('get_rooms', () => socket.emit('rooms_list', getRoomsInfo()));
    socket.on('join_game', (data) => {
        const room = rooms.get(parseInt(data.roomId));
        if (!room) return socket.emit('join_error', { message: 'الغرفة غير موجودة' });
        if (room.players.size >= MAX_PLAYERS) return socket.emit('join_error', { message: 'الغرفة ممتلئة' });
        leaveRoom(socket);
        const player = { id: socket.id, name: (data.username || 'لاعب').substring(0, 12), avatar: data.avatar || 'avatar-3.png', score: 0 };
        room.players.set(socket.id, player); socket.join('room_' + room.id); socket.data.roomId = room.id;
        if (!room.hostId) room.hostId = socket.id;
        socket.emit('join_success', { roomId: room.id, myId: socket.id, hostId: room.hostId, roomName: room.name, state: room.state });
        updatePlayers(room); updateRoomsList();
        systemMsg(room, `👋 ${player.name} انضم`, 'join');
    });
    socket.on('start_game', () => { const room = rooms.get(socket.data.roomId); if (room && socket.id === room.hostId && room.state === 'waiting') startGame(room); });
    socket.on('choose_word', (data) => { const room = rooms.get(socket.data.roomId); if (room && socket.id === room.drawerId && room.state === 'choosing') startDrawing(room, data.word); });
    socket.on('draw_start', (d) => { const room = rooms.get(socket.data.roomId); if (room && room.state === 'drawing' && socket.id === room.drawerId) socket.to('room_' + room.id).emit('draw_data', { type: 'start', ...d }); });
    socket.on('draw_move', (d) => { const room = rooms.get(socket.data.roomId); if (room && room.state === 'drawing' && socket.id === room.drawerId) socket.to('room_' + room.id).emit('draw_data', { type: 'move', ...d }); });
    socket.on('draw_end', () => { const room = rooms.get(socket.data.roomId); if (room && room.state === 'drawing' && socket.id === room.drawerId) socket.to('room_' + room.id).emit('draw_data', { type: 'end' }); });
    socket.on('clear_canvas', () => { const room = rooms.get(socket.data.roomId); if (room && socket.id === room.drawerId) io.to('room_' + room.id).emit('canvas_clear'); });
    socket.on('send_chat', (data) => {
        const room = rooms.get(socket.data.roomId); if (!room) return;
        const player = room.players.get(socket.id); if (!player) return;
        const msg = (data.message || '').trim().substring(0, 150); if (!msg) return;
        if (socket.id === room.drawerId || room.guessedPlayers.has(socket.id) || room.state !== 'drawing') io.to('room_' + room.id).emit('chat_message', { type: 'chat', username: player.name, message: msg });
        else if (!checkGuess(room, socket.id, msg)) io.to('room_' + room.id).emit('chat_message', { type: 'chat', username: player.name, message: msg });
    });
    socket.on('leave_game', () => leaveRoom(socket));
    socket.on('disconnect', () => leaveRoom(socket));
});

function leaveRoom(socket) {
    const room = rooms.get(socket.data.roomId); if (!room) return;
    const player = room.players.get(socket.id);
    room.players.delete(socket.id); room.guessedPlayers.delete(socket.id);
    socket.leave('room_' + room.id); socket.data.roomId = null;
    if (player) systemMsg(room, `👋 ${player.name} خرج`, 'leave');
    if (room.hostId === socket.id) { room.hostId = room.players.keys().next().value || null; }
    if (room.drawerId === socket.id) endRound(room, 'خرج الراسم');
    updatePlayers(room); updateRoomsList();
    if (room.players.size === 0) resetRoom(room);
}
server.listen(PORT, () => console.log(`✅ السيرفر يعمل على http://127.0.0.1:${PORT}`));

// إضافة كلمات جديدة (أكثر من 200 كلمة)
WORDS.general.push(
    'مفتاح', 'قفل', 'صندوق', 'سلة', 'زهرة', 'ورقة', 'قلم', 'دفتر', 'مقص', 'مشط', 'فرشاة', 'معجون', 'صابون', 'منشفة', 'مرآة',
    'ساعة', 'نظارة', 'حقيبة', 'حذاء', 'قبعة', 'وشاح', 'خاتم', 'سوار', 'قلادة', 'حزام', 'محفظة', 'بطارية', 'شاحن', 'سماعة',
    'تلفاز', 'حاسوب', 'لوحة_مفاتيح', 'فأرة', 'طابعة', 'كاميرا', 'ميكروفون', 'راديو', 'مروحة', 'مكيف', 'سخان', 'ثلاجة',
    'غسالة', 'فرن', 'ميكروويف', 'خلاط', 'مقلاة', 'طنجرة', 'إبريق', 'كوب', 'صحن', 'ملعقة', 'شوكة', 'سكين', 'سكرية',
    'خبز', 'كعكة', 'بسكويت', 'شوكولاتة', 'حلوى', 'عسل', 'جبن', 'لبن', 'زبدة', 'بيض', 'لحم', 'دجاج', 'سمك',
    'أرز', 'معكرونة', 'بطاطس', 'طماطم', 'خيار', 'جزر', 'بصل', 'ثوم', 'فلفل', 'باذنجان', 'كوسا', 'ملفوف',
    'تفاح', 'موز', 'برتقال', 'ليمون', 'عنب', 'فراولة', 'كرز', 'خوخ', 'مشمش', 'رمان', 'تين', 'جوافة', 'مانجو', 'أناناس'
);
WORDS.animals.push(
    'قط', 'كلب', 'أرنب', 'هامستر', 'فأر', 'سنجاب', 'قنفذ', 'ثعلب', 'ذئب', 'دب', 'باندا', 'كوالا', 'كنغر',
    'أسد', 'نمر', 'فهد', 'يغور', 'ضبع', 'ثور', 'جاموس', 'غزال', 'ظبي', 'زرافة', 'فيل', 'وحيد_القرن',
    'فرس_النهر', 'كركدن', 'تمساح', 'ثعبان', 'سلحفاة', 'ضفدع', 'سحلية', 'حرباء', 'نسر', 'صقر', 'بومة',
    'غراب', 'حمامة', 'ببغاء', 'طاووس', 'نعامة', 'بطريق', 'نورس', 'دلفين', 'حوت', 'قرش', 'أخطبوط',
    'سلطعون', 'روبيان', 'عقرب', 'عنكبوت', 'فراشة', 'نحلة', 'نملة', 'جرادة', 'دودة', 'حلزون'
);
WORDS.flags.push(
    'الإكوادور', 'فنزويلا', 'بيرو', 'بوليفيا', 'باراغواي', 'أوروغواي', 'تشيلي', 'كولومبيا',
    'النرويج', 'السويد', 'فنلندا', 'الدنمارك', 'هولندا', 'بلجيكا', 'سويسرا', 'النمسا',
    'بولندا', 'التشيك', 'المجر', 'رومانيا', 'بلغاريا', 'اليونان', 'كرواتيا', 'صربيا',
    'أوكرانيا', 'روسيا البيضاء', 'ليتوانيا', 'لاتفيا', 'إستونيا', 'أيرلندا', 'أيسلندا'
);
