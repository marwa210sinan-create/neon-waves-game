// Neon Waves — Touch, Mouse, Keyboard Controls (Swipe Control)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

// Fit canvas to window
function fit(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', fit);
fit();

// HUD Elements
const scoreBox = document.getElementById('scoreBox');
const bestBox = document.getElementById('bestBox');
const statusBox = document.getElementById('statusBox');
const centerTip = document.getElementById('centerTip');

let best = Number(localStorage.getItem('nw_best')||0);
bestBox.textContent = `الأفضل: ${best}`;

// Audio
let AC = null;
function ensureAC(){ if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); }
function playTone(freq=440, dur=0.08, type='sine', gain=0.06){
    if(!AC) return;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
}

// Background music & score sound
const BG_MUSIC = new Audio("OhLaLa.m4a");
BG_MUSIC.loop = true;
BG_MUSIC.volume = 0.6;

const SCORE_SOUND = new Audio("score.wav");
SCORE_SOUND.volume = 0.9;

// Game State
const state = {
    player: { xRatio: 0.38, y: window.innerHeight*0.5, r: 16 },
    vy: 0,
    maxVy: 1000,
    accel: 3000,
    worldSpeed: 400,
    obstacles: [],
    gapMin: 0.9,
    gapMax: 1.5,
    running: false,
    touchDir: 0,
    score: 0
};

let startTime = performance.now();

// 🟢 Swipe Touch Control
let touchStartY = null;

function handleTouchStart(e){
    touchStartY = e.touches[0].clientY;
    state.running = true;
    centerTip.style.display = 'none';
    ensureAC();
}

function handleTouchMove(e){
    if (touchStartY === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY;

    if (deltaY < -10) {
        state.touchDir = -1;
        statusBox.textContent = 'صعود';
        playTone(880,0.04,'triangle',0.03);
    } else if (deltaY > 10) {
        state.touchDir = 1;
        statusBox.textContent = 'نزول';
        playTone(520,0.04,'triangle',0.03);
    } else {
        state.touchDir = 0;
        statusBox.textContent = 'استقرار';
    }
}

function handleTouchEnd(e){
    state.touchDir = 0;
    statusBox.textContent = 'توقف';
    touchStartY = null;
}

canvas.addEventListener('touchstart', handleTouchStart, {passive:false});
canvas.addEventListener('touchmove', handleTouchMove, {passive:false});
canvas.addEventListener('touchend', handleTouchEnd, {passive:false});

// 🖱️ Mouse Control
canvas.addEventListener('mousedown', e=>{ touchStartY = e.clientY; state.running=true; ensureAC(); centerTip.style.display='none'; });
canvas.addEventListener('mousemove', e=>{
    if(touchStartY === null || !e.buttons) return;
    const deltaY = e.clientY - touchStartY;
    if(deltaY < -10){ state.touchDir=-1; statusBox.textContent='صعود'; }
    else if(deltaY > 10){ state.touchDir=1; statusBox.textContent='نزول'; }
    else { state.touchDir=0; statusBox.textContent='استقرار'; }
});
window.addEventListener('mouseup', ()=>{ state.touchDir=0; statusBox.textContent='توقف'; touchStartY=null; });

// ⌨️ Keyboard Control
window.addEventListener('keydown', e=>{
    if(e.key==='ArrowUp'){ state.touchDir=-1; state.running=true; ensureAC(); playTone(880,0.04,'triangle',0.03); centerTip.style.display='none'; }
    if(e.key==='ArrowDown'){ state.touchDir=1; state.running=true; ensureAC(); playTone(520,0.04,'triangle',0.03); centerTip.style.display='none'; }
    if(e.key===' '){ if(!state.running){ resetGame(); } }
});
window.addEventListener('keyup', e=>{ if(e.key==='ArrowUp' || e.key==='ArrowDown'){ state.touchDir=0; statusBox.textContent='توقف'; } });

// Obstacles
function rand(a,b){ return a + Math.random()*(b-a); }
function spawnObstacle(){
    const y = rand(window.innerHeight*0.18, window.innerHeight*0.82);
    const kind = Math.random()<0.7?'bar':'gate';
    const color = ['#7c5cff','#63faff','#ff4dc1','#9dff3a','#ffd24d'][Math.floor(Math.random()*5)];
    const w=22;
    const h=kind==='gate'?Math.max(120,window.innerHeight*0.6):120;
    state.obstacles.push({x:window.innerWidth+40,y,w,h,kind,color,scored:false});
}

// Drawing helpers
function drawGrid(t){ const W=window.innerWidth,H=window.innerHeight; const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#060616'); g.addColorStop(1,'#03030a'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);}
function glowCircle(cx,cy,r,color){ ctx.save(); ctx.globalCompositeOperation='lighter'; const g=ctx.createRadialGradient(cx,cy,2,cx,cy,r*2.2); g.addColorStop(0,color+'66'); g.addColorStop(1,color+'00'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,r*2.4,0,Math.PI*2); ctx.fill(); ctx.restore(); ctx.fillStyle=color; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();}
function glowRect(x,y,w,h,color){ ctx.save(); ctx.globalCompositeOperation='lighter'; const g=ctx.createRadialGradient(x+w/2,y+h/2,4,x+w/2,y+h/2,Math.max(w,h)); g.addColorStop(0,color+'66'); g.addColorStop(1,color+'00'); ctx.fillStyle=g; ctx.fillRect(x-24,y-24,w+48,h+48); ctx.restore(); ctx.fillStyle=color; roundRect(x,y,w,h,8);}
function roundRect(x,y,w,h,r){ const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath(); ctx.fill();}
function rects(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// Reset Game
function resetGame(){
    state.obstacles.length=0; state.score=0; scoreBox.textContent='النتيجة: 0';
    state.running=false; state.touchDir=0; state.vy=0;
    centerTip.style.display='block';
    startTime = performance.now();
    BG_MUSIC.currentTime=0; BG_MUSIC.play();
}

// Main Loop
let last=performance.now(); let spawnTimer=0;
resetGame();
function loop(now){
    requestAnimationFrame(loop);
    const dt = Math.min(0.033,(now-last)/1000); last=now;
    drawGrid(now*0.001);
    if(!state.running) return;
    const px = window.innerWidth*state.player.xRatio;
    const topLimit=window.innerHeight*0.18; const bottomLimit=window.innerHeight*0.82;
    const targetVy=state.touchDir*state.maxVy*0.7;
    const dv = targetVy - state.vy; state.vy += Math.sign(dv)*Math.min(Math.abs(dv),state.accel*dt); state.player.y += state.vy*dt;
    if(state.player.y<topLimit){ state.player.y=topLimit; state.vy=0; } if(state.player.y>bottomLimit){ state.player.y=bottomLimit; state.vy=0; }

    spawnTimer += dt;
    const elapsedTime=(now-startTime)/1000;
    let difficulty = 1+Math.floor(state.score/10);
    state.worldSpeed=400+Math.min(elapsedTime*10,400)+difficulty*50;
    state.gapMin=Math.max(0.5,0.9-elapsedTime*0.01-difficulty*0.05);
    state.gapMax=Math.max(0.8,1.5-elapsedTime*0.015-difficulty*0.05);
    if(spawnTimer >= rand(state.gapMin,state.gapMax)){ spawnTimer=0; spawnObstacle(); }

    let collided=false;
    for(const ob of state.obstacles){ ob.x-=state.worldSpeed*dt; }
    for(const ob of state.obstacles){
        if(ob.kind==='gate'){
            const gapY=window.innerHeight/2; const gapH=Math.max(80,window.innerHeight*0.12);
            glowRect(ob.x,0,ob.w,gapY-gapH,ob.color); glowRect(ob.x,gapY+gapH,ob.w,window.innerHeight-(gapY+gapH),ob.color);
            const top={x:ob.x,y:0,w:ob.w,h:gapY-gapH}; const bot={x:ob.x,y:gapY+gapH,w:ob.w,h:window.innerHeight-(gapY+gapH)};
            if(rects({x:px-16,y:state.player.y-16,w:32,h:32},top) || rects({x:px-16,y:state.player.y-16,w:32,h:32},bot)) collided=true;
        } else {
            glowRect(ob.x,ob.y-60,ob.w,ob.h,ob.color);
            if(rects({x:px-16,y:state.player.y-16,w:32,h:32},{x:ob.x,y:ob.y-60,w:ob.w,h:ob.h})) collided=true;
        }
        if(!ob.scored && ob.x+ob.w<px){
            ob.scored=true;
            state.score+=1; scoreBox.textContent=`النتيجة: ${state.score}`;
            SCORE_SOUND.currentTime=0; SCORE_SOUND.play();
        }
    }

    state.obstacles = state.obstacles.filter(o=>o.x>-200);
    glowCircle(px,state.player.y,state.player.r,'#7c5cff');

    if(collided){
        state.running=false;
        statusBox.textContent='انتهت اللعبة — المس للشروع من جديد';
        best=Math.max(best,state.score); localStorage.setItem('nw_best',best); bestBox.textContent=`الأفضل: ${best}`;
        state.obstacles.length=0; state.score=0; scoreBox.textContent='النتيجة: 0';
        centerTip.style.display='block';
        BG_MUSIC.pause();
        return;
    }
}

requestAnimationFrame(loop);
