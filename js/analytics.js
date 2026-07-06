"use strict";
/* ----------------------------------------------------------------------------
   analytics.js — Phase 3 "fuzzy analytics" teaching/report overlay (toggle: C).
   Freezes the game and shows, from the live 729-rule engine:
     • a CONTROL SURFACE   — Threat as a function of Exposure × Noise
     • a RULE-FIRING HEATMAP — which of the 729 rules fire most this run
     • a DEFUZZIFICATION comparison — centroid / bisector / mean-of-maxima / Sugeno
     • a plain-English EXPLANATION + the 3 crisp outputs
     • buttons: Mamdani↔Sugeno · Export CSV (the data logger) · Reset stats
   ---------------------------------------------------------------------------- */
const anaBtns = {
  mode: {x:W/2-330,y:H-56,w:150,h:38}, csv:  {x:W/2-168,y:H-56,w:150,h:38},
  reset:{x:W/2-6,  y:H-56,w:150,h:38}, close:{x:W/2+156,y:H-56,w:150,h:38},
};
function _thColor(t){ t=Math.max(0,Math.min(1,(t||0)/100));
  const c = t<0.5 ? [95+(255-95)*(t/0.5), 170+(175-170)*(t/0.5), 255+(80-255)*(t/0.5)]
                  : [255, 175+(70-175)*((t-0.5)/0.5), 80+(95-80)*((t-0.5)/0.5)];
  return `rgb(${c[0]|0},${c[1]|0},${c[2]|0})`; }

function computeSurface(){
  const N=20, b=G._inputs||{health:60,ammo:60,noise:40,pressure:20,exposure:40,skill:G.skill};
  const grid=[];
  for(let j=0;j<N;j++){ const row=[];
    for(let i=0;i<N;i++) row.push(Fuzzy.threatAt({health:b.health,ammo:b.ammo,pressure:b.pressure,
      skill:b.skill!=null?b.skill:G.skill, exposure:i/(N-1)*100, noise:j/(N-1)*100}));
    grid.push(row); }
  G._surface={N,grid};
}
function exportCSV(){
  const head='t,health,ammo,noise,pressure,exposure,skill,threat,supply,compo\n';
  const body=G.csvLog.map(r=>r.join(',')).join('\n');
  try{ const url=URL.createObjectURL(new Blob([head+body],{type:'text/csv'}));
    const a=document.createElement('a'); a.href=url; a.download='bans-protocol-fuzzy-log.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }catch(e){}
  floater(G.player.x,G.player.y-30,'CSV EXPORTED ('+G.csvLog.length+' rows)','#7CFF9B');
}

function drawAnalytics(){   // drawn as an overlay after the normal world+HUD
  ctx.fillStyle='rgba(2,6,12,0.88)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='800 30px '+UI.display;
  ctx.shadowBlur=14;ctx.shadowColor='#0af';ctx.fillText('FUZZY ANALYTICS',W/2,50);ctx.shadowBlur=0;
  ctx.fillStyle='#9cf';ctx.font='13px Consolas';
  ctx.fillText('6 inputs → 3 outputs · '+Fuzzy.rules.length+'-rule Mamdani · defuzz mode: '+Fuzzy.getMode().toUpperCase(),W/2,72);

  // control surface
  if(!G._surface) computeSurface();
  const sx=44,sy=110,sw=320,sh=320; panel(sx-12,sy-32,sw+24,sh+58,'CONTROL SURFACE  ·  Threat( Exposure × Noise )');
  const N=G._surface.N, cw=sw/N, ch=sh/N;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){ ctx.fillStyle=_thColor(G._surface.grid[j][i]);
    ctx.fillRect(sx+i*cw, sy+sh-(j+1)*ch, cw+0.6, ch+0.6); }
  ctx.strokeStyle='rgba(150,190,230,0.5)';ctx.lineWidth=1;ctx.strokeRect(sx,sy,sw,sh);
  ctx.fillStyle=UI.dim;ctx.font='10px Consolas';ctx.textAlign='center';ctx.fillText('Exposure →',sx+sw/2,sy+sh+18);
  ctx.save();ctx.translate(sx-18,sy+sh/2);ctx.rotate(-Math.PI/2);ctx.fillText('Noise →',0,0);ctx.restore();
  const cur=G._inputs; if(cur&&cur.exposure!=null){ ctx.strokeStyle='#fff';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(sx+(cur.exposure/100)*sw, sy+sh-(cur.noise/100)*sh, 5,0,7);ctx.stroke(); }

  // rule-firing heatmap (729 → 27×27)
  const hx=410,hy=110,cols=27,cell=11; panel(hx-12,hy-32,cols*cell+24,cols*cell+58,'RULE-FIRING HEATMAP');
  let mxf=1; for(const v of Fuzzy.fireCount) if(v>mxf)mxf=v;
  for(let i=0;i<Fuzzy.fireCount.length;i++){ const c=i%cols, r=(i/cols)|0, f=Fuzzy.fireCount[i]/mxf;
    ctx.fillStyle=f<=0?'rgba(40,50,64,0.45)':`rgba(${120+135*f|0},${200-120*f|0},${255-180*f|0},${0.25+0.72*f})`;
    ctx.fillRect(hx+c*cell, hy+r*cell, cell-1, cell-1); }
  ctx.fillStyle=UI.dim;ctx.font='10px Consolas';ctx.textAlign='left';ctx.fillText('brighter = fired more this run · each cell = 1 rule',hx,hy+cols*cell+18);

  // defuzzification comparison + readouts
  const dx=744; panel(dx-12,78,W-dx-32,224,'DEFUZZIFICATION  ·  Threat');
  const dm=Fuzzy.defuzzMethods(G.fuzzy.aggregate||{},Fuzzy.threatSets);
  const rows=[['Centroid',dm.centroid,'#5fd0ff'],['Bisector',dm.bisector,'#7CFF9B'],
              ['Mean-of-Max',dm.mom,'#ffb648'],['Sugeno WA',G.fuzzy.threatSugeno||0,'#ff6bd0']];
  let yy=112; for(const m of rows){ ctx.textAlign='left';ctx.fillStyle=UI.text;ctx.font='12px Consolas';ctx.fillText(m[0],dx,yy+4);
    ctx.fillStyle='rgba(0,0,0,0.4)';roundRect(dx+108,yy-8,W-dx-168,12,6);ctx.fill();
    ctx.fillStyle=m[2];roundRect(dx+108,yy-8,(W-dx-168)*Math.min(1,(m[1]||0)/100),12,6);ctx.fill();
    ctx.fillStyle=UI.text;ctx.textAlign='right';ctx.fillText(Math.round(m[1]||0),W-44,yy+4); yy+=30; }
  yy+=8; ctx.textAlign='left';ctx.font='bold 13px Consolas';ctx.fillStyle=UI.accent;
  ctx.fillText('Threat '+Math.round(G.fuzzy.threat)+'    Supply '+Math.round(G.fuzzy.supply)+'    Compo '+Math.round(G.fuzzy.compo),dx,yy+4);
  yy+=22; ctx.fillStyle='#9cf';ctx.font='11px Consolas';ctx.textAlign='left';ctx.fillText('Skill '+Math.round(G.skill),dx,yy+4);
  yy+=18; ctx.fillStyle=UI.dim;ctx.font='11px Consolas';ctx.textAlign='left'; wrapText(Fuzzy.explain(G.fuzzy),dx,yy+4,W-dx-44,14);

  menuBtn(anaBtns.mode, Fuzzy.getMode()==='mamdani'?'→ SUGENO':'→ MAMDANI');
  menuBtn(anaBtns.csv,  '⤓ EXPORT CSV');
  menuBtn(anaBtns.reset,'↻ RESET STATS');
  menuBtn(anaBtns.close,'CLOSE  [C]');
}
function handleAnalytics(p){
  if(inRect(p,anaBtns.mode)){ Fuzzy.setMode(Fuzzy.getMode()==='mamdani'?'sugeno':'mamdani'); if(window.Sound)Sound.ui(); return; }
  if(inRect(p,anaBtns.csv)){ exportCSV(); if(window.Sound)Sound.ui(); return; }
  if(inRect(p,anaBtns.reset)){ Fuzzy.resetStats(); if(window.Sound)Sound.ui(); return; }
  if(inRect(p,anaBtns.close)){ G.showAnalytics=false; if(window.Sound)Sound.ui(); return; }
}
