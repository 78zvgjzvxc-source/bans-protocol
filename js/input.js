"use strict";
/* ----------------------------------------------------------------------------
   input.js — keyboard + mouse (2D top-down). Mouse aims, click shoots,
   Q cycles owned weapons, B/V toggle the rules/graphs panels.
   ---------------------------------------------------------------------------- */
const keys={};
const mouse={x:W/2,y:H/2,down:false};

addEventListener('keydown',e=>{
  const k=e.key.toLowerCase(); keys[k]=true;
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
  if(G.tutorial){ G.tutorial=false; G.meta.tutorialSeen=true; saveMeta(); return; }   // any key deploys
  if(G.showSettings){ if(k==='escape'){ G.showSettings=false; saveMeta(); } return; }
  if(k==='c' && G.state==='play'){ G.showAnalytics=!G.showAnalytics; if(G.showAnalytics){ G._surface=null; computeSurface(); } return; }
  if(G.showAnalytics){ if(k==='escape') G.showAnalytics=false; return; }
  if(k==='r') reload();
  if(k==='q') cycleWeapon();
  if(k==='1') switchWeapon('rifle');
  if(k==='2') switchWeapon('shotgun');
  if(k==='3') switchWeapon('bazooka');
  if(k==='b'&&G.state==='play') G.showRules=!G.showRules;
  if(k==='v'&&G.state==='play') G.showGraphs=!G.showGraphs;
  if(k==='m'){ const m=window.Sound?Sound.toggleMute():false;
    if(G.state==='play') floater(G.player.x,G.player.y-30,m?'SOUND OFF':'SOUND ON','#9bdcff'); }
  if(k==='n' && window.Sound){ Sound.nextTrack();
    if(G.state==='play'){ const t=Sound.nowPlaying(); if(t) floater(G.player.x,G.player.y-30,'♪ '+t,'#c9a0ff'); } }
  if(k==='shift' && G.state==='play') dash();
  if(k==='f' && G.state==='play') melee();
  if(k==='e' && G.state==='play') deployMine();
  if(k==='t' && G.state==='play') deployTurret();
  if(G.state==='perk' && (k==='1'||k==='2'||k==='3')) choosePerk(+k-1);   // pick a perk by number
  if(k==='g' && (G.state==='play'||G.state==='paused')){
    G.settings.god=!G.settings.god;
    floater(G.player.x,G.player.y-30,G.settings.god?'GOD MODE ON':'GOD MODE OFF','#ffd36b');
  }
  if(k==='escape' && G.state==='play') G.state='paused';
  else if(k==='escape' && G.state==='paused') G.state='play';
  else if(k==='escape' && G.state==='shop') G.state='setup';
});
addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });

function cpos(e){ const r=cv.getBoundingClientRect();
  return { x:(e.clientX-r.left)*(cv.width/r.width), y:(e.clientY-r.top)*(cv.height/r.height) }; }

cv.addEventListener('mousemove',e=>{ const p=cpos(e); mouse.x=p.x; mouse.y=p.y;
  dragSlider(p); if(setDragKey) setSlideVal(p); });
cv.addEventListener('mousedown',e=>{ const p=cpos(e); mouse.x=p.x; mouse.y=p.y;
  if(G.showAnalytics){ handleAnalytics(p); return; }          // analytics overlay owns the click
  if(e.button===2){ if(G.state==='play') melee(); return; }   // right-click = melee, not shoot
  mouse.down=true; handleDown(p); });
cv.addEventListener('contextmenu',e=>e.preventDefault());       // allow right-click melee without the menu
addEventListener('mouseup',()=>{ mouse.down=false; activeSlider=null;
  if(setDragKey){ setDragKey=null; saveMeta(); } });

/* ---------------- GAMEPAD ---------------- */
function gamepadState(){
  const gps=navigator.getGamepads?navigator.getGamepads():[];
  for(const gp of gps){ if(!gp||!gp.connected) continue;
    const dz=v=>Math.abs(v)<0.18?0:v, B=i=>gp.buttons[i]&&gp.buttons[i].pressed;
    return { active:true, mx:dz(gp.axes[0]||0), my:dz(gp.axes[1]||0), ax:dz(gp.axes[2]||0), ay:dz(gp.axes[3]||0),
      shoot:B(7)||B(0), dash:B(1)||B(6), melee:B(2) };
  }
  return {active:false};
}

/* ---------------- TOUCH (virtual dual-stick: left = move, right = aim/fire) --- */
let touchMove=null, touchAim=null;
function touchXY(t){ const r=cv.getBoundingClientRect();
  return { x:(t.clientX-r.left)*(cv.width/r.width), y:(t.clientY-r.top)*(cv.height/r.height) }; }
cv.addEventListener('touchstart',e=>{ e.preventDefault();
  for(const t of e.changedTouches){ const p=touchXY(t);
    if(G.state!=='play'){ mouse.x=p.x;mouse.y=p.y;handleDown(p); continue; }
    if(p.x<W/2 && !touchMove) touchMove={id:t.identifier,sx:p.x,sy:p.y,x:p.x,y:p.y};
    else if(!touchAim){ touchAim={id:t.identifier}; mouse.x=p.x;mouse.y=p.y;mouse.down=true; } }
},{passive:false});
cv.addEventListener('touchmove',e=>{ e.preventDefault();
  for(const t of e.changedTouches){ const p=touchXY(t);
    if(touchMove&&t.identifier===touchMove.id){touchMove.x=p.x;touchMove.y=p.y;}
    if(touchAim&&t.identifier===touchAim.id){mouse.x=p.x;mouse.y=p.y;} }
},{passive:false});
cv.addEventListener('touchend',e=>{
  for(const t of e.changedTouches){
    if(touchMove&&t.identifier===touchMove.id)touchMove=null;
    if(touchAim&&t.identifier===touchAim.id){touchAim=null;mouse.down=false;} }
});
