"use strict";
/* ----------------------------------------------------------------------------
   main.js — the requestAnimationFrame loop. update() then draw by state.
   ---------------------------------------------------------------------------- */
function frame(){
  if(G.hitstop>0) G.hitstop--;   // freeze-frame on big kills/explosions for punch
  else update();
  if(window.Sound) Sound.tick(G.state, G.fuzzy.threat);   // music, ambient, heartbeat, beat
  BEAT = (window.Sound && Sound.beat) ? Sound.beat() : 0; // music beat → beat-reactive lighting/bloom
  ctx.clearRect(0,0,W,H);
  ctx.save();
  const shakeOn = !(G.meta&&G.meta.opts) || G.meta.opts.shake;
  if(G.state==='play'&&G.shake>0.3&&shakeOn) ctx.translate((Math.random()-0.5)*G.shake,(Math.random()-0.5)*G.shake);
  if(G.state==='setup'){ drawSetup(); applyBloom(0.30+BEAT*0.22); }
  else if(G.state==='shop') drawShop();
  else if(G.state==='play'){ drawWorld(); ctx.restore(); applyBloom(0.5+BEAT*0.28); ctx.save(); drawHUD(); }
  else if(G.state==='perk') drawPerks();
  else if(G.state==='paused') drawPause();
  else if(G.state==='dead') drawDead();
  ctx.restore();
  if(G.state==='play' && G.showAnalytics) drawAnalytics();   // fuzzy analytics overlay [C]
  else if(G.state==='play' && G.tutorial) drawTutorial();    // first-run overlay
  if(G.showSettings) drawSettings();                         // settings on top of any screen
  requestAnimationFrame(frame);
}
frame();
