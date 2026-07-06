"use strict";
/* ----------------------------------------------------------------------------
   screens.js — setup screen (sliders + god toggle + armory/deploy), the
   ARMORY shop (buy / upgrade / equip weapons with banked coins),
   pause/death overlays, and click routing.
   ---------------------------------------------------------------------------- */
let activeSlider=null;
const sliders=[
  {key:'pace',      label:'GAME PACE',     min:0.4,max:1.3,x:W/2-180,y:332,w:360,
     fmt:v=>v<0.65?'Slow':v<0.95?'Normal':'Fast', desc:'Enemy & spawn speed'},
  {key:'density',   label:'HORDE DENSITY', min:0.5,max:2.0,x:W/2-180,y:398,w:360,
     fmt:v=>v<0.9?'Sparse':v<1.4?'Standard':'Packed', desc:'How many spawn per wave'},
  {key:'toughness', label:'SURVIVABILITY', min:0.6,max:2.2,x:W/2-180,y:464,w:360,
     fmt:v=>v<1.0?'Fragile':v<1.6?'Sturdy':'Tank', desc:'How much damage you shrug off'},
];
const godBtn    ={x:W/2-180,y:502,w:360,h:36};
const armoryBtn ={x:W/2-230,y:556,w:220,h:54};
const deployBtn ={x:W/2+10, y:556,w:220,h:54};
const dailyChip ={x:24,y:104,w:260,h:22};
const reportChip={x:24,y:132,w:230,h:24};
const REPORT_URL='report/Progress_Report_1_UPDATED.html';   // bundled inside game/report/ (overridden in the artifact build)
const perkCards =[0,1,2].map(i=>({x:W/2-336+i*228,y:270,w:212,h:236}));

function wrapText(txt,cx,y,maxW,lh){
  const words=txt.split(' '); let line='';
  for(const w of words){ const test=line?line+' '+w:w;
    if(ctx.measureText(test).width>maxW && line){ ctx.fillText(line,cx,y); line=w; y+=lh; } else line=test; }
  if(line) ctx.fillText(line,cx,y);
}

/* PERK PICK — shown after each boss (state 'perk'), world dimmed behind */
function drawPerks(){
  drawWorld();
  ctx.fillStyle='rgba(4,8,14,0.78)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.fillStyle='#7CFF9B';ctx.font='800 40px '+UI.display;
  ctx.shadowBlur=18;ctx.shadowColor='#7CFF9B';ctx.fillText('SECTOR CLEARED',W/2,150);ctx.shadowBlur=0;
  ctx.fillStyle='#9cf';ctx.font='16px Consolas';ctx.fillText('choose an upgrade  ·  click a card or press 1 / 2 / 3',W/2,188);
  const ch=G.perkChoices||[];
  perkCards.forEach((c,i)=>{ const p=ch[i]; if(!p) return;
    const hov=inRect(mouse,c);
    ctx.fillStyle=hov?'rgba(124,255,155,0.16)':'rgba(14,24,20,0.92)';roundRect(c.x,c.y,c.w,c.h,12);ctx.fill();
    ctx.strokeStyle=hov?'#7CFF9B':'rgba(124,255,155,0.4)';ctx.lineWidth=2;roundRect(c.x,c.y,c.w,c.h,12);ctx.stroke();
    ctx.fillStyle='#7CFF9B';ctx.font='bold 12px Consolas';ctx.textAlign='center';ctx.fillText('[ '+(i+1)+' ]',c.x+c.w/2,c.y+34);
    ctx.fillStyle=UI.text;ctx.font='bold 17px '+UI.display;ctx.fillText(p.name,c.x+c.w/2,c.y+100);
    ctx.fillStyle='#9cf';ctx.font='13px Consolas';wrapText(p.desc,c.x+c.w/2,c.y+140,c.w-28,18);
  });
}
function drawDailyToggle(){
  const b=dailyChip, hov=inRect(mouse,b);
  ctx.fillStyle=G.daily?'#7CFF9B':(hov?'#456':'#334');ctx.strokeStyle=G.daily?'#7CFF9B':'#567';ctx.lineWidth=1.5;
  roundRect(b.x,b.y+3,16,16,3);ctx.fill();roundRect(b.x,b.y+3,16,16,3);ctx.stroke();
  if(G.daily){ ctx.strokeStyle='#04140a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x+3,b.y+11);ctx.lineTo(b.x+7,b.y+15);ctx.lineTo(b.x+13,b.y+6);ctx.stroke(); }
  ctx.textAlign='left';ctx.fillStyle=G.daily?'#7CFF9B':UI.dim;ctx.font='bold 12px Consolas';
  ctx.fillText('DAILY SEED — same maze for everyone today',b.x+24,b.y+15);
}

function sliderKnobX(s){ return s.x + ((G.settings[s.key]-s.min)/(s.max-s.min))*s.w; }
function drawSlider(s){
  const kx=sliderKnobX(s), ky=s.y;
  ctx.fillStyle='#9cf';ctx.font='bold 14px Consolas';ctx.textAlign='left';ctx.fillText(s.label,s.x,ky-14);
  ctx.fillStyle='#678';ctx.font='11px Consolas';ctx.textAlign='left';ctx.fillText(s.desc,s.x,ky+24);
  ctx.strokeStyle='rgba(120,150,180,0.4)';ctx.lineWidth=6;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(s.x,ky);ctx.lineTo(s.x+s.w,ky);ctx.stroke();
  ctx.strokeStyle='#3aa0ff';ctx.beginPath();ctx.moveTo(s.x,ky);ctx.lineTo(kx,ky);ctx.stroke();
  ctx.fillStyle='#dff';ctx.shadowBlur=12;ctx.shadowColor=UI.accent;
  ctx.beginPath();ctx.arc(kx,ky,11,0,7);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='#0a2030';ctx.beginPath();ctx.arc(kx,ky,4,0,7);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 13px Consolas';ctx.textAlign='right';
  ctx.fillText(s.fmt(G.settings[s.key]),s.x+s.w,ky-14);
}
function dragSlider(p){
  if(!activeSlider)return;
  const s=activeSlider;
  let f=(p.x-s.x)/s.w; f=Math.max(0,Math.min(1,f));
  G.settings[s.key]=s.min+f*(s.max-s.min);
}
function drawGodToggle(){
  const b=godBtn, on=G.settings.god;
  const hov=mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
  ctx.fillStyle=hov?'rgba(95,208,255,0.12)':'rgba(0,0,0,0.18)';
  roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();
  ctx.fillStyle='#9cf';ctx.font='bold 14px Consolas';ctx.textAlign='left';
  ctx.fillText('GOD MODE',b.x+12,b.y+23);
  ctx.fillStyle='#678';ctx.font='11px Consolas';
  ctx.fillText('demo testing · key G',b.x+110,b.y+23);
  const px=b.x+b.w-54, py=b.y+8, pw=42, ph=20;
  ctx.fillStyle=on?'rgba(255,182,72,0.45)':'rgba(60,80,100,0.6)';
  roundRect(px,py,pw,ph,10);ctx.fill();
  ctx.strokeStyle=on?UI.warn:'rgba(120,150,180,0.4)';ctx.lineWidth=1.5;
  roundRect(px,py,pw,ph,10);ctx.stroke();
  ctx.fillStyle=on?UI.warn:'#9ab';
  ctx.beginPath();ctx.arc(on?px+pw-10:px+10,py+ph/2,7,0,7);ctx.fill();
}
function coinChip(x,y){
  roundRect(x,y,150,30,15);
  ctx.fillStyle='rgba(255,211,107,0.12)';ctx.fill();
  ctx.strokeStyle=UI.ammo;ctx.lineWidth=1.5;roundRect(x,y,150,30,15);ctx.stroke();
  ctx.fillStyle=UI.ammo;ctx.font='bold 14px Consolas';ctx.textAlign='center';
  ctx.fillText('¢ '+G.meta.coins,x+75,y+20);
}
function bigBtn(b,label,hovFill){
  const hov=mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
  ctx.fillStyle=hov?(hovFill||'rgba(95,208,255,0.4)'):'rgba(60,160,255,0.22)';
  roundRect(b.x,b.y,b.w,b.h,12);ctx.fill();
  ctx.strokeStyle=UI.accent;ctx.lineWidth=2;roundRect(b.x,b.y,b.w,b.h,12);ctx.stroke();
  ctx.fillStyle=UI.text;ctx.font='bold 22px Consolas';ctx.textAlign='center';
  ctx.fillText(label,b.x+b.w/2,b.y+b.h/2+8);
}

function drawSetup(){
  drawGrid();
  const t=G.t*0.02;
  drawCharacter(W/2,200,t,{scale:2.4,body:UI.player,accent:'#0a2a4a',walk:t*6,player:true});
  for(let i=0;i<5;i++){const a=t*1.3+i*1.25,rad=150+Math.sin(t+i)*15;
    drawCharacter(W/2+Math.cos(a)*rad,200+Math.sin(a)*rad*0.45,a+Math.PI,
      {scale:1.1,body:`hsl(${i*40},70%,55%)`,accent:'#200',walk:t*8,enemy:true,hue:i*40});}
  ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='900 54px '+UI.display;
  ctx.shadowBlur=26;ctx.shadowColor='#0af';ctx.fillText("BAN's PROTOCOL",W/2,78);ctx.shadowBlur=0;
  ctx.fillStyle='#9cf';ctx.font='16px Consolas';
  ctx.fillText('ADAPTIVE HORDE SURVIVAL · 729-rule Mamdani director · 6 inputs → 3 outputs',W/2,106);
  coinChip(W-182,20);
  ctx.fillStyle=inRect(mouse,settingsGear)?UI.accent:'#9cf';ctx.font='22px Consolas';ctx.textAlign='center';
  ctx.fillText('⚙',settingsGear.x+15,settingsGear.y+23);
  // persistent records (top-left)
  ctx.textAlign='left';ctx.fillStyle=UI.dim;ctx.font='11px Consolas';ctx.fillText('RECORDS',24,28);
  ctx.fillStyle=UI.accent;ctx.font='bold 13px Consolas';
  ctx.fillText('Best Wave '+G.meta.bestWave+'   ·   Best Score '+G.meta.bestScore,24,46);
  // now-playing (BGM) — only shown when a soundtrack is bundled (hidden in the hosted no-music build)
  if(!window.Sound || !Sound.hasBGM || Sound.hasBGM()){
    const np = (window.Sound && Sound.nowPlaying) ? Sound.nowPlaying() : null;
    ctx.fillStyle=UI.dim;ctx.font='11px Consolas';ctx.fillText('MUSIC',24,72);
    ctx.fillStyle='#c9a0ff';ctx.font='bold 12px Consolas';
    ctx.fillText(np ? '♪ Molchat Doma — '+np+'   (N: next)' : '♪ click anywhere to start the soundtrack',24,90);
  }
  drawDailyToggle();
  // VIEW REPORT button
  { const b=reportChip, hov=inRect(mouse,b);
    ctx.fillStyle=hov?'rgba(95,208,255,0.25)':'rgba(20,30,42,0.7)';roundRect(b.x,b.y,b.w,b.h,6);ctx.fill();
    ctx.strokeStyle=hov?UI.accent:'rgba(120,150,180,0.4)';ctx.lineWidth=1.5;roundRect(b.x,b.y,b.w,b.h,6);ctx.stroke();
    ctx.fillStyle=UI.text;ctx.font='bold 12px Consolas';ctx.textAlign='left';ctx.fillText('📄 VIEW ISP568 REPORT',b.x+10,b.y+16); }
  panel(W/2-220,288,440,338,'MISSION SETUP — set your difficulty');
  sliders.forEach(drawSlider);
  drawGodToggle();
  bigBtn(armoryBtn,'⚒ ARMORY','rgba(255,211,107,0.35)');
  bigBtn(deployBtn,'▶ DEPLOY');
  ctx.fillStyle='#567';ctx.font='12px Consolas';ctx.textAlign='center';
  ctx.fillText('WASD move · aim/shoot · Shift dash · F/RMB melee · Q or 1/2/3 weapons · R reload · G god · M mute · N track · Esc pause',W/2,652);
}

/* ----------------------------------------------------------------------------
   ARMORY — buy / upgrade / equip weapons with banked coins
   ---------------------------------------------------------------------------- */
const shopCards=['rifle','shotgun','bazooka'].map((key,i)=>({key,x:W/2-575+i*390,y:126,w:370,h:348}));
function cardBtn(c){ return {x:c.x+35,y:c.y+294,w:300,h:42}; }
const upgChips=Object.keys(PLAYER_UPS).map((key,i)=>({key,x:W/2-571+i*288,y:518,w:274,h:58}));
function chipBtn(u){ return {x:u.x+u.w-96,y:u.y+11,w:86,h:36}; }
const shopBackBtn={x:W/2-100,y:612,w:200,h:46};

function drawWeaponIcon(x,y,key){
  ctx.save();ctx.translate(x,y);
  if(key==='rifle'){
    ctx.fillStyle='#39424d';ctx.fillRect(-44,-4,88,8);
    ctx.fillStyle='#222a33';ctx.fillRect(-14,4,9,14);ctx.fillRect(-44,-9,22,7);
  }else if(key==='shotgun'){
    ctx.fillStyle='#39424d';ctx.fillRect(-44,-8,80,7);ctx.fillRect(-44,1,80,7);
    ctx.fillStyle='#5a3b22';ctx.fillRect(-44,-8,24,16);ctx.fillRect(-6,8,9,12);
  }else{
    ctx.fillStyle='#39424d';ctx.fillRect(-50,-10,100,20);
    ctx.fillStyle='#ff7b4d';ctx.fillRect(38,-10,12,20);
    ctx.fillStyle='#222a33';ctx.fillRect(-14,10,10,12);ctx.fillRect(-50,-14,18,8);
  }
  ctx.restore();
}
function drawShop(){
  drawGrid();
  ctx.textAlign='center';ctx.fillStyle=UI.ammo;ctx.font='800 44px '+UI.display;
  ctx.shadowBlur=20;ctx.shadowColor='#fa0';ctx.fillText('ARMORY',W/2,72);ctx.shadowBlur=0;
  ctx.fillStyle='#9cf';ctx.font='14px Consolas';
  ctx.fillText('coins persist between runs — earned per kill, banked on death',W/2,100);
  coinChip(W-182,20);

  for(const c of shopCards){
    const w=WEAPONS[c.key], mw=G.meta.weapons[c.key], st=wstats(c.key);
    const equipped=G.meta.equipped===c.key;
    panel(c.x,c.y,c.w,c.h,'');
    if(equipped){ ctx.strokeStyle=UI.accent;ctx.lineWidth=2.5;roundRect(c.x,c.y,c.w,c.h,10);ctx.stroke(); }
    // header
    ctx.fillStyle=mw.owned?UI.text:'#789';ctx.font='bold 22px Consolas';ctx.textAlign='left';
    ctx.fillText(w.name,c.x+24,c.y+38);
    if(equipped){ ctx.fillStyle=UI.accent;ctx.font='bold 11px Consolas';ctx.textAlign='right';
      ctx.fillText('● EQUIPPED',c.x+c.w-24,c.y+38); }
    else if(mw.owned){ ctx.fillStyle='#678';ctx.font='11px Consolas';ctx.textAlign='right';
      ctx.fillText('click card to equip',c.x+c.w-24,c.y+38); }
    drawWeaponIcon(c.x+c.w/2,c.y+76,c.key);
    ctx.fillStyle='#9cf';ctx.font='12px Consolas';ctx.textAlign='center';
    ctx.fillText(w.blurb,c.x+c.w/2,c.y+116);
    // level stars
    ctx.font='15px Consolas';ctx.fillStyle=UI.ammo;
    ctx.fillText('★'.repeat(mw.lvl)+'☆'.repeat(5-mw.lvl)+`   LV ${mw.lvl}/5`,c.x+c.w/2,c.y+142);
    // stats
    ctx.textAlign='left';ctx.font='13px Consolas';
    const sx=c.x+50, sy=c.y+172, lh=22;
    const stats=[
      ['DAMAGE', st.dmg+(w.pellets>1?` ×${w.pellets} pellets`:'')+(mw.lvl<5?`  (next: ${Math.round(w.dmg*(1+0.25*mw.lvl))})`:'')],
      ['MAGAZINE', w.mag+' rounds'],
      ['FIRE RATE', (60/w.cd).toFixed(1)+' /s'],
      ['SPECIAL', w.explosive?`AoE blast ${w.blast}px`:(w.pellets>1?'wide spread':'long range · accurate')],
      ['NOISE', '+'+w.noise+' per shot'],
    ];
    stats.forEach(([k,v],i)=>{
      ctx.fillStyle='#678';ctx.fillText(k,sx,sy+i*lh);
      ctx.fillStyle=UI.text;ctx.fillText(String(v),sx+105,sy+i*lh);
    });
    // action button
    const b=cardBtn(c);
    let label,cost=0,can=true;
    if(!mw.owned){ cost=w.cost; label=`BUY — ${cost}¢`; can=G.meta.coins>=cost; }
    else if(mw.lvl<5){ cost=w.upCost[mw.lvl-1]; label=`UPGRADE — ${cost}¢`; can=G.meta.coins>=cost; }
    else { label='MAX LEVEL'; can=false; }
    const hov=can&&mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
    ctx.fillStyle=can?(hov?'rgba(255,211,107,0.4)':'rgba(255,211,107,0.18)'):'rgba(40,50,60,0.5)';
    roundRect(b.x,b.y,b.w,b.h,10);ctx.fill();
    ctx.strokeStyle=can?UI.ammo:'rgba(120,150,180,0.3)';ctx.lineWidth=1.5;
    roundRect(b.x,b.y,b.w,b.h,10);ctx.stroke();
    ctx.fillStyle=can?UI.ammo:'#667';ctx.font='bold 16px Consolas';ctx.textAlign='center';
    ctx.fillText(label,b.x+b.w/2,b.y+27);
  }

  // operative upgrades — permanent player stats bought with coins
  panel(W/2-585,488,1170,102,'OPERATIVE UPGRADES — permanent, apply every run');
  for(const u of upgChips){
    const def=PLAYER_UPS[u.key], lvl=G.meta.player[u.key];
    ctx.fillStyle='rgba(0,0,0,0.18)';roundRect(u.x,u.y,u.w,u.h,8);ctx.fill();
    ctx.fillStyle=UI.text;ctx.font='bold 13px Consolas';ctx.textAlign='left';
    ctx.fillText(def.name,u.x+12,u.y+22);
    ctx.fillStyle=UI.ammo;ctx.font='12px Consolas';
    ctx.fillText('★'.repeat(lvl)+'☆'.repeat(5-lvl),u.x+12,u.y+42);
    ctx.fillStyle='#678';ctx.font='10px Consolas';
    ctx.fillText(def.desc,u.x+70,u.y+42);
    const b=chipBtn(u);
    let label,can=false;
    if(lvl<5){ const cost=def.cost[lvl-1]; label=cost+'¢'; can=G.meta.coins>=cost; }
    else label='MAX';
    const hov=can&&mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
    ctx.fillStyle=can?(hov?'rgba(124,255,155,0.35)':'rgba(124,255,155,0.15)'):'rgba(40,50,60,0.5)';
    roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();
    ctx.strokeStyle=can?UI.good:'rgba(120,150,180,0.3)';ctx.lineWidth=1.5;
    roundRect(b.x,b.y,b.w,b.h,8);ctx.stroke();
    ctx.fillStyle=can?UI.good:'#667';ctx.font='bold 13px Consolas';ctx.textAlign='center';
    ctx.fillText(label,b.x+b.w/2,b.y+24);
  }
  bigBtn(shopBackBtn,'← BACK');
}
function tryUpgradePlayer(key){
  const def=PLAYER_UPS[key], lvl=G.meta.player[key];
  if(lvl<5 && G.meta.coins>=def.cost[lvl-1]){
    G.meta.coins-=def.cost[lvl-1]; G.meta.player[key]++; saveMeta();
  }
}
function tryBuy(key){
  const mw=G.meta.weapons[key], w=WEAPONS[key];
  if(!mw.owned){
    if(G.meta.coins>=w.cost){ G.meta.coins-=w.cost; mw.owned=true; G.meta.equipped=key; saveMeta(); }
    return;
  }
  if(mw.lvl<5){
    const c=w.upCost[mw.lvl-1];
    if(G.meta.coins>=c){ G.meta.coins-=c; mw.lvl++; saveMeta(); }
  }
}

/* pause / death overlays */
const redeployBtn={x:W/2-120,y:400,w:240,h:54};
function drawDead(){
  drawWorld();
  ctx.fillStyle='rgba(10,0,5,0.72)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.fillStyle=UI.bad;ctx.font='900 60px '+UI.display;
  ctx.shadowBlur=24;ctx.shadowColor='#f00';ctx.fillText('OVERRUN',W/2,240);ctx.shadowBlur=0;
  ctx.fillStyle=UI.text;ctx.font='20px Consolas';
  ctx.fillText(`Score ${G.score}   ·   Kills ${G.kills}   ·   Wave ${G.wave}`,W/2,290);
  ctx.fillStyle=UI.ammo;ctx.font='bold 18px Consolas';
  ctx.fillText(`COINS BANKED  +${G.runCoins}¢   (total ${G.meta.coins}¢)`,W/2,330);
  ctx.fillStyle=UI.accent;ctx.font='bold 16px Consolas';
  ctx.fillText(`BEST   Wave ${G.meta.bestWave}   ·   Score ${G.meta.bestScore}`,W/2,362);
  if(G.newRecord){ ctx.fillStyle=UI.good;ctx.font='900 24px '+UI.display;
    ctx.shadowBlur=18;ctx.shadowColor=UI.good;ctx.fillText('★ NEW RECORD ★',W/2,178);ctx.shadowBlur=0; }
  bigBtn(redeployBtn,'▶ REDEPLOY');
  ctx.fillStyle='#567';ctx.font='12px Consolas';ctx.fillText('returns to mission setup — spend your coins in the ARMORY',W/2,480);
}
function menuBtn(b,label,col){
  const hov=inRect(mouse,b);
  ctx.fillStyle=hov?(col||'rgba(95,208,255,0.3)'):'rgba(20,30,42,0.88)';roundRect(b.x,b.y,b.w,b.h,10);ctx.fill();
  ctx.strokeStyle=hov?UI.accent:'rgba(120,150,180,0.4)';ctx.lineWidth=1.5;roundRect(b.x,b.y,b.w,b.h,10);ctx.stroke();
  ctx.fillStyle=UI.text;ctx.font='bold 16px Consolas';ctx.textAlign='center';ctx.fillText(label,b.x+b.w/2,b.y+b.h/2+5);
}
const pauseBtns={ resume:{x:W/2-110,y:352,w:220,h:44}, settings:{x:W/2-110,y:406,w:220,h:44},
  restart:{x:W/2-110,y:460,w:220,h:44}, quit:{x:W/2-110,y:514,w:220,h:44} };
function drawPause(){
  drawWorld();drawHUD();
  ctx.fillStyle='rgba(0,10,20,0.74)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='800 50px '+UI.display;
  ctx.shadowBlur=18;ctx.shadowColor='#0af';ctx.fillText('PAUSED',W/2,175);ctx.shadowBlur=0;
  ctx.fillStyle=UI.text;ctx.font='16px Consolas';
  ctx.fillText(`Sector ${G.sector}  ·  Wave ${G.wave}  ·  Kills ${G.kills}  ·  Score ${G.score}`,W/2,228);
  ctx.fillStyle=UI.ammo;ctx.font='14px Consolas';
  ctx.fillText(`Coins ${G.meta.coins}¢    ·    Best combo ×${G.comboBest}    ·    Perks ${G.perks.length}`,W/2,256);
  menuBtn(pauseBtns.resume,'▶ RESUME'); menuBtn(pauseBtns.settings,'⚙ SETTINGS');
  menuBtn(pauseBtns.restart,'↻ RESTART RUN'); menuBtn(pauseBtns.quit,'✕ QUIT TO MENU','rgba(255,90,110,0.3)');
}

/* first-run tutorial overlay (dismissed on any input, flag saved to meta) */
function drawTutorial(){
  ctx.fillStyle='rgba(2,6,12,0.82)';ctx.fillRect(0,0,W,H);
  panel(W/2-320,116,640,432,'');
  ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='800 34px '+UI.display;
  ctx.shadowBlur=16;ctx.shadowColor='#0af';ctx.fillText("BAN's PROTOCOL",W/2,172);ctx.shadowBlur=0;
  ctx.fillStyle='#9cf';ctx.font='14px Consolas';
  ctx.fillText('survive the fuzzy-controlled horde · hide in fog · read the threat gauge',W/2,200);
  const lines=[['WASD','move'],['Mouse','aim + hold to shoot'],['Shift','dash — dodge with i-frames'],
    ['F / RMB','melee + silent stealth takedown on unaware foes'],['E / T','deploy mine / turret'],
    ['Q / 1 2 3','switch weapons'],['R','reload'],['Esc','pause + settings']];
  ctx.font='14px Consolas';let y=244;
  for(const kv of lines){ ctx.textAlign='right';ctx.fillStyle=UI.accent;ctx.fillText(kv[0],W/2-16,y);
    ctx.textAlign='left';ctx.fillStyle=UI.text;ctx.fillText(kv[1],W/2+6,y); y+=32; }
  ctx.textAlign='center';ctx.fillStyle=UI.good;ctx.font='bold 16px Consolas';
  ctx.fillText('click or press any key to DEPLOY',W/2,522);
}

/* SETTINGS overlay — volume sliders + toggles, openable from setup & pause */
const setSliders=[{key:'master',label:'MASTER VOLUME',y:236},{key:'music',label:'MUSIC VOLUME',y:296},{key:'sfx',label:'SFX VOLUME',y:356}];
const setToggles=[{key:'shake',label:'SCREEN SHAKE',y:410},{key:'motion',label:'AMBIENT MOTION (dust / weather)',y:452}];
const setClose={x:W/2-90,y:502,w:180,h:44};
let setDragKey=null;
function drawSettings(){
  ctx.fillStyle='rgba(2,6,12,0.84)';ctx.fillRect(0,0,W,H);
  const px=W/2-230,pw=460; panel(px,150,pw,420,'');
  ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='800 32px '+UI.display;ctx.fillText('SETTINGS',W/2,202);
  const o=G.meta.opts, x0=px+40, w=pw-80;
  for(const s of setSliders){ const y=s.y;
    ctx.textAlign='left';ctx.fillStyle='#9cf';ctx.font='bold 13px Consolas';ctx.fillText(s.label,x0,y-12);
    ctx.textAlign='right';ctx.fillStyle=UI.text;ctx.fillText(Math.round(o[s.key]*100)+'%',x0+w,y-12);
    ctx.strokeStyle='rgba(120,150,180,0.4)';ctx.lineWidth=6;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+w,y);ctx.stroke();
    ctx.strokeStyle=UI.accent;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+w*o[s.key],y);ctx.stroke();
    ctx.fillStyle='#dff';ctx.beginPath();ctx.arc(x0+w*o[s.key],y,9,0,7);ctx.fill(); }
  for(const t of setToggles){ const y=t.y,on=o[t.key];
    ctx.textAlign='left';ctx.fillStyle='#9cf';ctx.font='bold 13px Consolas';ctx.fillText(t.label,x0,y+4);
    const tx=px+pw-96,tw=52,th=22;
    ctx.fillStyle=on?'rgba(95,208,255,0.5)':'rgba(60,80,100,0.6)';roundRect(tx,y-8,tw,th,11);ctx.fill();
    ctx.strokeStyle=on?UI.accent:'rgba(120,150,180,0.4)';ctx.lineWidth=1.5;roundRect(tx,y-8,tw,th,11);ctx.stroke();
    ctx.fillStyle=on?UI.accent:'#9ab';ctx.beginPath();ctx.arc(on?tx+tw-11:tx+11,y+3,8,0,7);ctx.fill(); }
  menuBtn(setClose,'CLOSE');
}
function setSlideVal(p){ if(!setDragKey)return; const px=W/2-230,pw=460,x0=px+40,w=pw-80;
  let f=Math.max(0,Math.min(1,(p.x-x0)/w)); G.meta.opts[setDragKey]=f;
  if(window.Sound){ if(setDragKey==='master')Sound.setMaster(f); else if(setDragKey==='music')Sound.setMusic(f); else Sound.setSfx(f); } }
function handleSettings(p){
  const px=W/2-230,pw=460,x0=px+40,w=pw-80,o=G.meta.opts;
  for(const s of setSliders) if(Math.abs(p.y-s.y)<16 && p.x>=x0-12 && p.x<=x0+w+12){ setDragKey=s.key; setSlideVal(p); return; }
  for(const t of setToggles) if(Math.abs(p.y-t.y)<16 && p.x>=px+pw-100){ o[t.key]=!o[t.key]; saveMeta(); if(window.Sound)Sound.ui(); return; }
  if(inRect(p,setClose)){ G.showSettings=false; saveMeta(); if(window.Sound)Sound.ui(); }
}

/* click routing */
function inRect(p,b){return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;}
const settingsGear={x:W-44,y:58,w:30,h:30};
function handleDown(p){
  if(G.tutorial){ G.tutorial=false; G.meta.tutorialSeen=true; saveMeta(); return; }   // dismiss tutorial
  if(G.showSettings){ handleSettings(p); return; }
  if(G.state==='perk'){
    for(let i=0;i<perkCards.length;i++) if(inRect(p,perkCards[i])){ choosePerk(i); return; }
    return;
  }
  if(G.state==='paused'){
    if(inRect(p,pauseBtns.resume)){ G.state='play'; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,pauseBtns.settings)){ G.showSettings=true; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,pauseBtns.restart)){ if(window.Sound)Sound.ui(); reset(); G.state='play'; return; }
    if(inRect(p,pauseBtns.quit)){ G.state='setup'; if(window.Sound)Sound.ui(); return; }
    return;
  }
  if(G.state==='setup'){
    if(inRect(p,settingsGear)){ G.showSettings=true; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,reportChip)){ try{ window.open(REPORT_URL,'_blank'); }catch(e){} if(window.Sound)Sound.ui(); return; }
    if(inRect(p,dailyChip)){ G.daily=!G.daily; if(window.Sound)Sound.ui(); return; }
    for(const s of sliders){ const kx=sliderKnobX(s);
      if(Math.hypot(p.x-kx,p.y-s.y)<22 || (p.x>=s.x&&p.x<=s.x+s.w&&Math.abs(p.y-s.y)<16)){
        activeSlider=s; dragSlider(p); return; } }
    if(inRect(p,godBtn)){ G.settings.god=!G.settings.god; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,armoryBtn)){ G.state='shop'; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,deployBtn)){ if(window.Sound)Sound.ui(); reset(); G.state='play'; }
    return;
  }
  if(G.state==='shop'){
    for(const c of shopCards){
      if(inRect(p,cardBtn(c))){ tryBuy(c.key); if(window.Sound)Sound.ui(); return; }
      if(inRect(p,c)){ if(G.meta.weapons[c.key].owned){ G.meta.equipped=c.key; saveMeta(); if(window.Sound)Sound.ui(); } return; }
    }
    for(const u of upgChips){ if(inRect(p,chipBtn(u))){ tryUpgradePlayer(u.key); if(window.Sound)Sound.ui(); return; } }
    if(inRect(p,shopBackBtn)){ G.state='setup'; if(window.Sound)Sound.ui(); }
    return;
  }
  if(G.state==='dead'){ if(inRect(p,redeployBtn)){ G.state='setup'; if(window.Sound)Sound.ui(); } return; }
  if(G.state==='play'){
    if(inRect(p,btnRules)){ G.showRules=!G.showRules; return; }
    if(inRect(p,btnGraphs)){ G.showGraphs=!G.showGraphs; return; }
    for(const b of weaponPills){ if(inRect(p,b)){ switchWeapon(b.key); return; } }
  }
}
