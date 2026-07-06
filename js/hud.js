"use strict";
/* ----------------------------------------------------------------------------
   hud.js — HUD & fuzzy-logic visualisation: vitals bars, threat gauge,
   four membership-function graphs, active-rules panel, buttons, crosshair.
   ---------------------------------------------------------------------------- */
function bar(x,y,w,h,frac,col,label,val){
  ctx.fillStyle='rgba(0,0,0,0.5)';roundRect(x,y,w,h,h/2);ctx.fill();
  if(frac>0.02){
    const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,shade(col,-0.2));g.addColorStop(1,col);
    ctx.fillStyle=g;roundRect(x,y,Math.max(h,w*frac),h,h/2);ctx.fill();
  }
  ctx.fillStyle=UI.text;ctx.font='bold 11px Consolas';ctx.textAlign='left';ctx.fillText(label,x+8,y+h/2+4);
  ctx.textAlign='right';ctx.fillText(val,x+w-8,y+h/2+4);
}

function threatGauge(cx,cy,rad){
  const th=G.fuzzy.threat;
  const cols=[UI.player,UI.warn,UI.bad];
  for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(cx,cy,rad,Math.PI*(1+i/3),Math.PI*(1+(i+1)/3));
    ctx.lineWidth=14;ctx.strokeStyle=cols[i];ctx.globalAlpha=0.3;ctx.stroke();}
  ctx.globalAlpha=1;
  const liveCol=th>66?UI.bad:th>33?UI.warn:UI.player;
  ctx.beginPath();ctx.arc(cx,cy,rad,Math.PI,Math.PI+Math.PI*(th/100));
  ctx.lineWidth=14;ctx.strokeStyle=liveCol;
  ctx.shadowBlur=14;ctx.shadowColor=liveCol;ctx.stroke();ctx.shadowBlur=0;
  const a=Math.PI+Math.PI*(th/100);
  ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,cy);
  ctx.lineTo(cx+Math.cos(a)*(rad-4),cy+Math.sin(a)*(rad-4));ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx,cy,5,0,7);ctx.fill();
  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 22px Consolas';ctx.fillText(Math.round(th),cx,cy+38);
  const lbl=th>66?'OVERWHELMING':th>33?'TACTICAL':'PASSIVE';
  ctx.fillStyle=liveCol;ctx.font='bold 12px Consolas';ctx.fillText(lbl,cx,cy+56);
  ctx.fillStyle=UI.accent;ctx.font='bold 11px Consolas';ctx.fillText('THREAT / AGGRESSION',cx,cy-rad-12);
}

/* Membership-function graph (filled curves + grid + live readouts) */
function mfGraph(x,y,w,h,title,sets,value,colors){
  panel(x,y,w,h,title);
  const gx=x+14, gy=y+32, gw=w-28, gh=h-62;
  ctx.strokeStyle='rgba(120,160,200,0.12)';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const yy=gy+gh*i/4;ctx.beginPath();ctx.moveTo(gx,yy);ctx.lineTo(gx+gw,yy);ctx.stroke();}
  for(let i=0;i<=4;i++){const xx=gx+gw*i/4;ctx.beginPath();ctx.moveTo(xx,gy);ctx.lineTo(xx,gy+gh);ctx.stroke();}
  ctx.strokeStyle='rgba(150,190,230,0.5)';ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx,gy+gh);ctx.lineTo(gx+gw,gy+gh);ctx.stroke();
  const terms=Object.keys(sets);
  terms.forEach((term,ci)=>{
    ctx.beginPath();ctx.moveTo(gx,gy+gh);
    for(let i=0;i<=gw;i++){const xv=i/gw*100,mu=sets[term](xv);ctx.lineTo(gx+i,gy+gh-mu*gh);}
    ctx.lineTo(gx+gw,gy+gh);ctx.closePath();
    ctx.globalAlpha=0.13;ctx.fillStyle=colors[ci];ctx.fill();ctx.globalAlpha=1;
    ctx.beginPath();
    for(let i=0;i<=gw;i++){const xv=i/gw*100,mu=sets[term](xv);const px=gx+i,py=gy+gh-mu*gh;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}
    ctx.strokeStyle=colors[ci];ctx.lineWidth=2.5;ctx.stroke();
  });
  const vx=gx+(value/100)*gw;
  ctx.strokeStyle='#fff';ctx.setLineDash([4,3]);ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(vx,gy-2);ctx.lineTo(vx,gy+gh);ctx.stroke();ctx.setLineDash([]);
  let best=-1,bestTerm='';
  terms.forEach((term,ci)=>{ const mu=sets[term](value);
    if(mu>0.01){ const py=gy+gh-mu*gh;
      ctx.fillStyle=colors[ci];ctx.beginPath();ctx.arc(vx,py,4,0,7);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(vx,py,4,0,7);ctx.stroke(); }
    if(mu>best){best=mu;bestTerm=term;} });
  ctx.textAlign='right';ctx.fillStyle='#fff';ctx.font='bold 13px Consolas';
  ctx.fillText(Math.round(value),x+w-14,y+19);
  const lw=gw/terms.length;
  terms.forEach((term,ci)=>{ const lx=gx+ci*lw;
    ctx.fillStyle=colors[ci];ctx.fillRect(lx,gy+gh+9,9,9);
    ctx.fillStyle= term===bestTerm?'#fff':UI.dim;ctx.font=(term===bestTerm?'bold ':'')+'10px Consolas';
    ctx.textAlign='left';ctx.fillText(term,lx+13,gy+gh+17); });
}

const btnRules ={x:16, y:H-44, w:150, h:30, label:'RULES [B]',   get on(){return G.showRules;}};
const btnGraphs={x:174,y:H-44, w:150, h:30, label:'GRAPHS [V]',  get on(){return G.showGraphs;}};

/* weapon slots (1/2/3) — bottom-left above the toggle buttons */
const weaponPills=[
  {key:'rifle',  x:16,  y:H-80, w:104, h:28},
  {key:'shotgun',x:128, y:H-80, w:104, h:28},
  {key:'bazooka',x:240, y:H-80, w:104, h:28},
];
function drawWeaponPills(){
  weaponPills.forEach((b,i)=>{
    const owned=G.meta.weapons[b.key].owned, eq=G.weapon===b.key;
    ctx.fillStyle=eq?'rgba(60,160,255,0.35)':owned?'rgba(20,30,40,0.7)':'rgba(12,16,22,0.7)';
    roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();
    ctx.strokeStyle=eq?UI.accent:'rgba(120,150,180,0.3)';ctx.lineWidth=1.5;
    roundRect(b.x,b.y,b.w,b.h,8);ctx.stroke();
    ctx.fillStyle=eq?UI.text:owned?'#9ab':'#556';ctx.font='bold 11px Consolas';ctx.textAlign='center';
    ctx.fillText(owned?`${i+1} ${WEAPONS[b.key].name}`:`${i+1} 🔒`,b.x+b.w/2,b.y+18);
  });
}

/* active power-ups — bottom-right, label + remaining-time bar */
function drawPowerPills(){
  let x=W-16;
  for(const k in G.power){
    if(G.power[k]<=0) continue;
    const def=POWERUPS[k], pw=130; x-=pw+8;
    ctx.fillStyle='rgba(10,16,26,0.85)';roundRect(x,H-44,pw,30,8);ctx.fill();
    ctx.strokeStyle=def.col;ctx.lineWidth=1.5;roundRect(x,H-44,pw,30,8);ctx.stroke();
    ctx.fillStyle=def.col;ctx.font='bold 10px Consolas';ctx.textAlign='left';
    ctx.fillText(def.label,x+10,H-31);
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(x+10,H-25,pw-20,5);
    ctx.fillStyle=def.col;ctx.fillRect(x+10,H-25,(pw-20)*Math.min(1,G.power[k]/powDur(def)),5);
  }
}
function drawButton(b){
  const hov=mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
  ctx.fillStyle=b.on?(hov?'rgba(95,208,255,0.4)':'rgba(60,160,255,0.3)')
                    :(hov?'rgba(40,60,80,0.8)':'rgba(20,30,40,0.7)');
  roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();
  ctx.strokeStyle=b.on?UI.accent:'rgba(120,150,180,0.4)';ctx.lineWidth=1.5;roundRect(b.x,b.y,b.w,b.h,8);ctx.stroke();
  ctx.fillStyle=b.on?UI.text:'#89a';ctx.font='bold 11px Consolas';ctx.textAlign='center';
  ctx.fillText((b.on?'● ':'○ ')+b.label,b.x+b.w/2,b.y+b.h/2+4);
}

/* minimap: prerendered walls/fog + live dots (player cyan, enemies red) */
function drawMinimap(){
  panel(16,160,300,202,'TACTICAL MAP');
  const mx=30,my=190,sx=MM_W/WORLD_W,sy=MM_H/WORLD_H;
  ctx.drawImage(mmCanvas,mx,my);
  // viewport rectangle
  ctx.strokeStyle='rgba(95,208,255,0.5)';ctx.lineWidth=1;
  ctx.strokeRect(mx+G.cam.x*sx,my+G.cam.y*sy,W*sx,H*sy);
  // enemies as dots (elites tinted, boss = pinging magenta marker)
  for(const e of G.enemies){
    if(e.boss){
      const bx=mx+e.x*sx, by=my+e.y*sy, pulse=2+Math.abs(Math.sin(G.t*0.15))*2;
      if(G.bossPing>0){ ctx.strokeStyle=`rgba(255,90,220,${G.bossPing/110})`;ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(bx,by,(110-G.bossPing)*0.4,0,7);ctx.stroke(); }   // expanding ping
      ctx.fillStyle='#ff5ad2';ctx.shadowBlur=8;ctx.shadowColor='#ff5ad2';
      ctx.beginPath();ctx.arc(bx,by,3.5+pulse*0.5,0,7);ctx.fill();ctx.shadowBlur=0;
    } else {
      ctx.fillStyle=e.elite?e.eliteCol:'#ff3b5c';
      ctx.beginPath();ctx.arc(mx+e.x*sx,my+e.y*sy,e.elite?2.8:2.2,0,7);ctx.fill();
    }
  }
  // player: pulsing cyan dot + facing line
  const px=mx+G.player.x*sx, py=my+G.player.y*sy;
  ctx.strokeStyle='#5fd0ff';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(px,py);
  ctx.lineTo(px+Math.cos(G.player.angle)*11,py+Math.sin(G.player.angle)*11);ctx.stroke();
  ctx.fillStyle='#5fd0ff';ctx.shadowBlur=6;ctx.shadowColor='#5fd0ff';
  ctx.beginPath();ctx.arc(px,py,3+Math.sin(G.t*0.15),0,7);ctx.fill();
  ctx.shadowBlur=0;
  // extraction beacon marker
  if(G.extract && !G.extract.done){ ctx.strokeStyle='#7CFF9B';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(mx+G.extract.x*sx,my+G.extract.y*sy,3+Math.abs(Math.sin(G.t*0.1))*2,0,7);ctx.stroke(); }
  // sector + modifier label
  ctx.textAlign='left';ctx.font='bold 10px Consolas';ctx.fillStyle=UI.dim;
  ctx.fillText('SECTOR '+G.sector,30,354);
  if(G.sectorMod && G.sectorMod.id!=='none'){ ctx.fillStyle=G.sectorMod.col;ctx.fillText('◈ '+G.sectorMod.name,112,354); }
}

/* deployable cooldown chips (mine [E] · turret [T]) next to the weapon pills */
function drawDeployables(){
  const y=H-80, items=[['E','MINE',G.mineCd,45,true],['T','TURR',G.turretCd,180,G.run.turret]];
  let x=356;
  for(const it of items){ const w=64, cd=it[2], max=it[3], on=it[4];
    ctx.fillStyle=on?'rgba(20,30,40,0.7)':'rgba(12,16,22,0.6)';roundRect(x,y,w,28,8);ctx.fill();
    if(on&&cd>0){ ctx.fillStyle='rgba(0,0,0,0.5)';roundRect(x,y,w*Math.min(1,cd/max),28,8);ctx.fill(); }
    ctx.strokeStyle=on?'rgba(120,150,180,0.4)':'rgba(80,90,100,0.3)';ctx.lineWidth=1.5;roundRect(x,y,w,28,8);ctx.stroke();
    ctx.fillStyle=on?UI.text:'#556';ctx.font='bold 10px Consolas';ctx.textAlign='center';
    ctx.fillText(it[0]+' '+it[1],x+w/2,y+18); x+=w+6; }
}
/* achievement toasts — slide up from the bottom-centre */
function drawAchToasts(){
  let y=H-150;
  for(const a of G.achToasts){ const sl=Math.max(0,Math.min(1,(200-a.life)/15)*Math.min(1,a.life/22));
    const w=300,x=W/2-w/2; ctx.save();ctx.globalAlpha=sl;
    ctx.fillStyle='rgba(16,26,18,0.92)';roundRect(x,y,w,42,8);ctx.fill();
    ctx.strokeStyle='#7CFF9B';ctx.lineWidth=1.5;roundRect(x,y,w,42,8);ctx.stroke();
    ctx.fillStyle='#7CFF9B';ctx.font='bold 12px Consolas';ctx.textAlign='left';ctx.fillText('★ '+a.name,x+14,y+18);
    ctx.fillStyle=UI.dim;ctx.font='10px Consolas';ctx.fillText(a.desc,x+14,y+33);
    ctx.restore(); y-=48; }
}

/* killstreak / combo meter — centre-top, escalates in size & colour */
function drawComboMeter(){
  if(G.combo<2) return;
  const cx=W/2, cy=232, col = G.combo>=20?'#ff4d6d':G.combo>=10?'#ffb648':'#5fd0ff';
  const sz = 20+Math.min(18,G.combo);
  ctx.save();ctx.textAlign='center';
  ctx.fillStyle=col;ctx.shadowBlur=14;ctx.shadowColor=col;ctx.font='900 '+sz+'px '+UI.display;
  ctx.fillText('×'+G.combo,cx,cy);ctx.shadowBlur=0;
  ctx.fillStyle=UI.dim;ctx.font='bold 10px Consolas';ctx.fillText('COMBO',cx,cy+14);
  const bw=120, f=Math.max(0,G.comboTimer/150);              // shrinking timer bar
  ctx.fillStyle='rgba(0,0,0,0.5)';roundRect(cx-bw/2,cy+20,bw,5,2.5);ctx.fill();
  ctx.fillStyle=col;roundRect(cx-bw/2,cy+20,bw*f,5,2.5);ctx.fill();
  ctx.restore();
}
/* damage-direction indicator — red arc at the screen edge toward the last hit */
function drawDamageIndicator(){
  if(G.hitDirT<=0) return;
  const a=G.hitDirT/32;
  ctx.save();ctx.translate(W/2,H/2);ctx.rotate(G.hitDir);
  const g=ctx.createRadialGradient(0,0,H*0.32,0,0,H*0.5);
  g.addColorStop(0,'rgba(255,40,60,0)');g.addColorStop(1,`rgba(255,40,60,${a*0.5})`);
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,H*0.5,-0.5,0.5);ctx.lineTo(0,0);ctx.closePath();ctx.fill();
  ctx.restore();
}

/* centred, fading "WAVE N" / "BOSS WAVE N" announcement */
function drawWaveBanner(){
  const b=G.waveBanner; if(!b) return;
  const tIn=Math.min(1,(b.max-b.life)/18), tOut=Math.min(1,b.life/30);
  const a=Math.max(0,Math.min(tIn,tOut));
  const cx=W/2, cy=198-(1-tIn)*18, bw=b.boss?640:470, bh=72;
  ctx.save(); ctx.textAlign='center';
  const g=ctx.createLinearGradient(cx-bw/2,0,cx+bw/2,0);
  g.addColorStop(0,'rgba(8,12,20,0)');g.addColorStop(0.5,`rgba(8,12,20,${0.82*a})`);g.addColorStop(1,'rgba(8,12,20,0)');
  ctx.fillStyle=g; ctx.fillRect(cx-bw/2,cy-bh/2,bw,bh);
  ctx.globalAlpha=a*0.9; ctx.strokeStyle=b.col; ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx-bw/2,cy-bh/2);ctx.lineTo(cx+bw/2,cy-bh/2);
  ctx.moveTo(cx-bw/2,cy+bh/2);ctx.lineTo(cx+bw/2,cy+bh/2);ctx.stroke();
  ctx.globalAlpha=a;
  ctx.fillStyle=b.col; ctx.shadowBlur=18; ctx.shadowColor=b.col;
  ctx.font=(b.boss?'900 40px ':'800 34px ')+UI.display;
  ctx.fillText(b.text,cx,cy+2); ctx.shadowBlur=0;
  ctx.fillStyle=UI.text; ctx.font='bold 14px Consolas';
  ctx.fillText(b.sub,cx,cy+27);
  ctx.restore();
}
/* persistent boss health bar (bottom-centre) while a Juggernaut is alive */
function drawBossBar(){
  const boss=G.enemies.find(e=>e.boss); if(!boss) return;
  const bw=460, bh=20, x=W/2-bw/2, y=H-98;
  ctx.fillStyle='rgba(8,12,20,0.85)'; roundRect(x-10,y-26,bw+20,bh+34,8); ctx.fill();
  ctx.strokeStyle='rgba(255,90,200,0.5)'; ctx.lineWidth=1.5; roundRect(x-10,y-26,bw+20,bh+34,8); ctx.stroke();
  ctx.fillStyle='#ff6bff'; ctx.font='bold 13px '+UI.display; ctx.textAlign='center';
  ctx.fillText('JUGGERNAUT',W/2,y-10);
  ctx.fillStyle='rgba(0,0,0,0.5)'; roundRect(x,y,bw,bh,bh/2); ctx.fill();
  const f=Math.max(0,boss.hp/boss.maxhp);
  if(f>0.02){ const g=ctx.createLinearGradient(x,0,x+bw,0);
    g.addColorStop(0,'#ff2d6d'); g.addColorStop(1,'#ff8bd0');
    ctx.fillStyle=g; roundRect(x,y,bw*f,bh,bh/2); ctx.fill(); }
}

function drawHUD(){
  const p=G.player, w=wstats(G.weapon);
  // hurt vignette (screen-space feedback, under the panels)
  if(G.hurt>0){ const a=(G.hurt/14)*0.35;
    const g=ctx.createRadialGradient(W/2,H/2,250,W/2,H/2,760);
    g.addColorStop(0,'rgba(255,0,40,0)');g.addColorStop(1,`rgba(255,0,40,${a})`);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H); }
  // vitals
  panel(16,16,300,136,'OPERATIVE VITALS');
  bar(28,38,276,18,p.hp/p.maxhp,UI.bad,'HEALTH',G.settings.god?'∞':Math.round(p.hp));
  bar(28,62,276,18,G.reloading>0?G.reloading:G.ammo/G.maxAmmo,UI.ammo,
      G.reloading>0?'RELOADING…':`${w.name} L${w.lvl}`,
      G.settings.god?'∞':(G.reloading>0?'':`${G.ammo}/${G.reserve}`));
  bar(28,86,276,18,G.noise/100,UI.noiseCol,'NOISE',Math.round(G.noise));
  bar(28,110,276,18,G.detect/100,'#ff9b4d','DETECTION',G.detect<15?'HIDDEN':Math.round(G.detect));
  drawMinimap();
  // mission
  panel(W-220,16,204,118,'MISSION');
  ctx.fillStyle=UI.text;ctx.font='bold 12px Consolas';ctx.textAlign='left';
  ctx.fillText('SCORE  '+G.score,W-205,48);ctx.fillText('KILLS  '+G.kills,W-205,66);
  ctx.fillText('WAVE   '+G.wave,W-205,84);
  ctx.fillStyle=UI.accent;ctx.fillText('SECTOR '+G.sector,W-120,84);ctx.fillStyle=UI.text;
  ctx.fillStyle=UI.ammo;ctx.fillText('COINS  '+G.meta.coins+'¢',W-205,102);
  // SUPPLY (2nd fuzzy output) — director generosity, drives drop rate
  const sup=G.fuzzy.supply!=null?G.fuzzy.supply:50;
  bar(W-205,110,174,14,sup/100,UI.good,'SUPPLY',Math.round(sup));
  // threat gauge
  panel(W/2-110,16,220,148,'');
  threatGauge(W/2,124,60);
  // god-mode badge
  if(G.settings.god){
    roundRect(W/2-78,170,156,26,13);
    ctx.fillStyle='rgba(255,182,72,0.18)';ctx.fill();
    ctx.strokeStyle=UI.warn;ctx.lineWidth=1.5;roundRect(W/2-78,170,156,26,13);ctx.stroke();
    ctx.fillStyle=UI.warn;ctx.font='bold 12px Consolas';ctx.textAlign='center';
    ctx.fillText('⚡ GOD MODE (demo)',W/2,187);
  }
  // hidden-in-fog badge
  if(fogAt(p.x,p.y)){
    const hy=G.settings.god?202:170;
    roundRect(W/2-78,hy,156,26,13);
    ctx.fillStyle='rgba(95,208,255,0.15)';ctx.fill();
    ctx.strokeStyle=UI.accent;ctx.lineWidth=1.5;roundRect(W/2-78,hy,156,26,13);ctx.stroke();
    ctx.fillStyle=UI.accent;ctx.font='bold 12px Consolas';ctx.textAlign='center';
    ctx.fillText('◌ HIDDEN — in fog',W/2,hy+17);
  }

  drawButton(btnRules); drawButton(btnGraphs);
  drawWeaponPills(); drawPowerPills();
  if(G.advisor && G.advisor.weapon!==G.weapon && G.advisor.conf>0.55 && G.meta.weapons[G.advisor.weapon] && G.meta.weapons[G.advisor.weapon].owned){
    ctx.fillStyle='#9cf';ctx.font='bold 11px Consolas';ctx.textAlign='left';
    ctx.fillText('⌖ advisor: switch to '+G.advisor.weapon.toUpperCase(),16,H-88); }

  // MF graphs — right-side stack: five fuzzy INPUTS + the SUPPLY OUTPUT
  if(G.showGraphs){
    const gw=300, gh=90, gx=W-gw-16, step=96, y0=140;
    mfGraph(gx,y0+0*step,gw,gh,'HEALTH  (input)',  Fuzzy.health,  G._inputs.health,  [UI.bad,UI.warn,UI.good]);
    mfGraph(gx,y0+1*step,gw,gh,'AMMO  (input)',    Fuzzy.ammo,    G._inputs.ammo,    [UI.bad,UI.ammo,UI.good]);
    mfGraph(gx,y0+2*step,gw,gh,'NOISE  (input)',   Fuzzy.noise,   G._inputs.noise,   [UI.player,UI.warn,UI.bad]);
    mfGraph(gx,y0+3*step,gw,gh,'PRESSURE  (input)',Fuzzy.pressure,G._inputs.pressure,[UI.good,UI.warn,UI.bad]);
    mfGraph(gx,y0+4*step,gw,gh,'EXPOSURE  (input)',Fuzzy.exposure,G._inputs.exposure,[UI.good,UI.warn,UI.bad]);
    mfGraph(gx,y0+5*step,gw,gh,'SUPPLY  (OUTPUT)', Fuzzy.supplySets, sup,            [UI.bad,UI.warn,UI.good]);
  }
  // active rules — left, below the minimap
  if(G.showRules&&G.fuzzy.fired){
    const rh=Math.min(5,G.fuzzy.fired.length);
    panel(16,370,300,66+rh*34,'ACTIVE FUZZY RULES (top of '+(typeof Fuzzy!=='undefined'?Fuzzy.rules.length:729)+')  ·  C: analytics');
    // "why this threat?" explainability line
    ctx.textAlign='left';ctx.font='10px Consolas';ctx.fillStyle=UI.dim;
    if(typeof Fuzzy!=='undefined' && typeof wrapText==='function') wrapText(Fuzzy.explain(G.fuzzy),28,392,276,12);
    let yy=418;
    for(let i=0;i<rh;i++){ const fr=G.fuzzy.fired[i];
      const ante=fr.rule.if.map(([v,t])=>t.slice(0,3)).join('∧');  // 5 terms, abbreviated
      ctx.textAlign='left';ctx.font='10px Consolas';ctx.fillStyle='#9cf';ctx.fillText(`IF ${ante}`,28,yy);
      ctx.fillStyle=fr.rule.then==='Overwhelming'?UI.bad:fr.rule.then==='Tactical'?UI.warn:UI.player;
      ctx.font='11px Consolas';ctx.fillText(`→ ${fr.rule.then}`,28,yy+13);
      ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(186,yy+5,66,8);
      ctx.fillStyle=UI.accent;ctx.fillRect(186,yy+5,66*fr.strength,8);
      ctx.fillStyle='#7af';ctx.font='10px Consolas';ctx.textAlign='right';ctx.fillText((fr.strength*100|0)+'%',290,yy+13);
      yy+=34; }
  }
  drawDeployables();
  drawBossBar();
  drawComboMeter();
  drawDamageIndicator();
  drawAchToasts();
  drawWaveBanner();

  // crosshair — follows the mouse
  ctx.save();ctx.translate(mouse.x,mouse.y);
  ctx.strokeStyle=G.reloading>0?UI.warn:UI.accent;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,10,0,7);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-16,0);ctx.lineTo(-6,0);ctx.moveTo(6,0);ctx.lineTo(16,0);
  ctx.moveTo(0,-16);ctx.lineTo(0,-6);ctx.moveTo(0,6);ctx.lineTo(0,16);ctx.stroke();ctx.restore();
}
