"use strict";
/* ----------------------------------------------------------------------------
   fuzzy.js — FUZZY LOGIC ENGINE  (v4 — 6-input / 3-output / 729-rule MIMO)
   Triangular/trapezoidal MFs, Mamdani inference (AND=min, OR=max), and a
   choice of defuzzifiers (centroid / bisector / mean-of-maxima) plus a
   parallel Takagi–Sugeno path. Pure module — no game references.

   Inputs (0–100):  Health · Ammo · Noise · Pressure · Exposure · Skill
   Outputs (0–100): Threat · Supply · Composition
   The complete rule grid is 3⁶ = 729, generated from one scoring policy (so it
   scales without hand-authoring — the whole point of the policy approach).
   Skill is CENTRED (Average = neutral), so an average player sees the same
   difficulty the original 243-rule 5-input build produced.
   ---------------------------------------------------------------------------- */
const Fuzzy = (()=>{
  const tri  = (x,a,b,c)=> Math.max(0, Math.min((x-a)/(b-a||1e-9), (c-x)/(c-b||1e-9)));
  const trapL= (x,a,b)=> x<=a?1: x>=b?0: (b-x)/(b-a);
  const trapR= (x,a,b)=> x<=a?0: x>=b?1: (x-a)/(b-a);

  // input variables — three overlapping linguistic terms each
  const health   = { Low:x=>trapL(x,15,40), Medium:x=>tri(x,25,50,75), High:x=>trapR(x,60,85) };
  const ammo     = { Depleted:x=>trapL(x,10,35), Adequate:x=>tri(x,25,55,80), Surplus:x=>trapR(x,65,90) };
  const noise    = { Quiet:x=>trapL(x,15,40), Moderate:x=>tri(x,30,55,80), Loud:x=>trapR(x,65,90) };
  const pressure = { Safe:x=>trapL(x,20,45), Engaged:x=>tri(x,35,60,85), Swarmed:x=>trapR(x,70,90) };
  const exposure = { Hidden:x=>trapL(x,15,40), Suspicious:x=>tri(x,30,55,80), Spotted:x=>trapR(x,65,90) };
  const skill    = { Novice:x=>trapL(x,25,50), Average:x=>tri(x,35,55,80), Expert:x=>trapR(x,65,90) };

  // output 1: Threat / Aggression
  const threatSets = { Passive:x=>tri(x,0,18,40), Tactical:x=>tri(x,30,50,70), Overwhelming:x=>trapR(x,60,90) };
  // output 2: Supply / Director Aid (drop generosity)
  const supplySets = { Scarce:x=>tri(x,0,18,40), Balanced:x=>tri(x,30,50,70), Generous:x=>trapR(x,60,90) };
  // output 3: Composition (what KIND of horde spawns — swarm of grunts vs heavy elites)
  const compoSets  = { Swarm:x=>tri(x,0,18,40), Mixed:x=>tri(x,30,50,70), Heavy:x=>trapR(x,60,90) };

  const levels = {
    health:{Low:0,Medium:1,High:2}, ammo:{Depleted:0,Adequate:1,Surplus:2},
    noise:{Quiet:0,Moderate:1,Loud:2}, pressure:{Safe:0,Engaged:1,Swarmed:2},
    exposure:{Hidden:0,Suspicious:1,Spotted:2}, skill:{Novice:0,Average:1,Expert:2},
  };

  /* RULE GENERATION — complete 3⁶ = 729 grid from three scoring policies.
       threat  = 0.55(h+a) + 0.8n − 0.6p + 1.7e + 0.6(skill−1)   (skill centred)
       supply  = (2−h) + (2−a) + 0.6p                            (help the desperate)
       compo   = 0.5(h+a) + 0.7n + 0.8e + 0.5·skill              (heavier when strong/seen/loud/skilled)  */
  const rules=[];
  for(const h in levels.health) for(const a in levels.ammo) for(const n in levels.noise)
  for(const p in levels.pressure) for(const e in levels.exposure) for(const sk in levels.skill){
    const H=levels.health[h],A=levels.ammo[a],N=levels.noise[n],P=levels.pressure[p],E=levels.exposure[e],S=levels.skill[sk];
    let score=Math.round((0.55*(H+A)+0.8*N-0.6*P+1.7*E+0.6*(S-1))*100)/100;
    const then = score<=2.3?'Passive': score<=4.6?'Tactical':'Overwhelming';
    const w = Math.max(0.6, Math.min(1, 0.6+0.4*Math.min(Math.abs(score-2.3),Math.abs(score-4.6))));
    let sScore=Math.round(((2-H)+(2-A)+0.6*P)*100)/100;
    const thenSupply = sScore<=1.6?'Scarce': sScore<=3.0?'Balanced':'Generous';
    let cScore=Math.round((0.5*(H+A)+0.7*N+0.8*E+0.5*S)*100)/100;
    const thenCompo = cScore<=2.0?'Swarm': cScore<=3.8?'Mixed':'Heavy';
    rules.push({ if:[['health',h],['ammo',a],['noise',n],['pressure',p],['exposure',e],['skill',sk]],
      then, thenSupply, thenCompo, w:Math.round(w*100)/100, score, sScore, cScore,
      note:`${h[0]}${a[0]}${n[0]}${p[0]}${e[0]}${sk[0]} → ${then}/${thenSupply}/${thenCompo}` });
  }
  const ruleStats = rules.reduce((m,r)=>{m[r.then]=(m[r.then]||0)+1;return m;},{}); ruleStats.total=rules.length;

  const sets = {health,ammo,noise,pressure,exposure,skill};
  // Sugeno singletons (≈ centroids of the Mamdani output sets)
  const K = { Passive:19,Tactical:50,Overwhelming:84, Scarce:19,Balanced:50,Generous:84, Swarm:19,Mixed:50,Heavy:84 };

  function fuzzify(inputs){ const out={};
    for(const v in sets){ out[v]={}; for(const t in sets[v]) out[v][t]=sets[v][t](inputs[v]); } return out; }

  // ---- defuzzifiers ----
  function centroid(agg,os){ let num=0,den=0;
    for(let x=0;x<=100;x+=2){ let mu=0; for(const s in os) mu=Math.max(mu,Math.min(agg[s],os[s](x))); num+=x*mu; den+=mu; }
    return den>0?num/den:0; }
  function bisector(agg,os){ let tot=0; const mu=[];
    for(let x=0;x<=100;x+=2){ let m=0; for(const s in os) m=Math.max(m,Math.min(agg[s],os[s](x))); mu.push(m); tot+=m; }
    let acc=0; for(let i=0;i<mu.length;i++){ acc+=mu[i]; if(acc>=tot/2) return i*2; } return 50; }
  function mom(agg,os){ let mx=0;
    for(let x=0;x<=100;x+=2){ let m=0; for(const s in os) m=Math.max(m,Math.min(agg[s],os[s](x))); if(m>mx)mx=m; }
    if(mx<=0)return 0; let sum=0,n=0;
    for(let x=0;x<=100;x+=2){ let m=0; for(const s in os) m=Math.max(m,Math.min(agg[s],os[s](x))); if(m>=mx-1e-6){sum+=x;n++;} }
    return n?sum/n:0; }
  function defuzzMethods(agg,os){ return { centroid:centroid(agg,os), bisector:bisector(agg,os), mom:mom(agg,os) }; }

  // rule-firing heatmap (only accumulated when the game asks to track)
  const fireCount=new Array(rules.length).fill(0); let inferCount=0;
  let MODE='mamdani';

  function infer(inputs, o){
    const track = o&&o.track;
    const inp={health:inputs.health,ammo:inputs.ammo,noise:inputs.noise,pressure:inputs.pressure,
               exposure:inputs.exposure, skill:inputs.skill==null?55:inputs.skill};
    const f=fuzzify(inp);
    const agg={Passive:0,Tactical:0,Overwhelming:0}, aggS={Scarce:0,Balanced:0,Generous:0}, aggC={Swarm:0,Mixed:0,Heavy:0};
    const fired=[]; let ds=0,nt=0,ns=0,nc=0;
    for(let i=0;i<rules.length;i++){ const r=rules[i];
      let s=1; for(const [v,t] of r.if) s=Math.min(s,f[v][t]); s*=r.w;
      if(s>0.001){ fired.push({rule:r,strength:s}); ds+=s; nt+=s*K[r.then]; ns+=s*K[r.thenSupply]; nc+=s*K[r.thenCompo]; }
      if(s>agg[r.then])agg[r.then]=s; if(s>aggS[r.thenSupply])aggS[r.thenSupply]=s; if(s>aggC[r.thenCompo])aggC[r.thenCompo]=s;
      if(track && s>0.05) fireCount[i]++;
    }
    if(track) inferCount++;
    fired.sort((a,b)=>b.strength-a.strength);
    const tM=centroid(agg,threatSets), sM=centroid(aggS,supplySets), cM=centroid(aggC,compoSets);
    const tS=ds>0?nt/ds:0, sS=ds>0?ns/ds:0, cS=ds>0?nc/ds:0, sug=MODE==='sugeno';
    return { fuzzified:f, aggregate:agg, supplyAgg:aggS, compoAgg:aggC,
      threatMamdani:tM, threatSugeno:tS, threat:sug?tS:tM,
      supplyMamdani:sM, supplySugeno:sS, supply:sug?sS:sM,
      compoMamdani:cM, compoSugeno:cS, compo:sug?cS:cM, fired };
  }

  // lean threat-only sampler for the control surface (no tracking / no fired list)
  function threatAt(inputs){ const f=fuzzify({health:inputs.health,ammo:inputs.ammo,noise:inputs.noise,
      pressure:inputs.pressure,exposure:inputs.exposure,skill:inputs.skill==null?55:inputs.skill});
    const agg={Passive:0,Tactical:0,Overwhelming:0};
    for(const r of rules){ let s=1; for(const [v,t] of r.if) s=Math.min(s,f[v][t]); s*=r.w; if(s>agg[r.then])agg[r.then]=s; }
    return centroid(agg,threatSets); }

  // one-line plain-English explanation of the current decision
  function explain(res){
    if(!res.fired||!res.fired.length) return 'No rule is firing — the field is empty.';
    const top=res.fired[0].rule;
    const push=top.if.filter(x=>['Spotted','Loud','Swarmed','High','Surplus','Expert'].includes(x[1])).map(x=>x[1]);
    const calm=top.if.filter(x=>['Hidden','Quiet','Low','Depleted','Novice'].includes(x[1])).map(x=>x[1]);
    const band=res.threat>66?'OVERWHELMING':res.threat>33?'TACTICAL':'PASSIVE';
    const reason = push.length? ('you are '+push.join(' + ')) : calm.length? ('you are '+calm.join(' + ')) : 'a balanced state';
    return `${reason} → the director goes ${band} (${Math.round(res.threat)}).`;
  }

  return { health,ammo,noise,pressure,exposure,skill, threatSets,supplySets,compoSets,
    rules,ruleStats,levels,fuzzify,infer,threatAt, centroid,bisector,mom,defuzzMethods, explain, K,
    fireCount, getMode:()=>MODE, setMode:m=>{MODE=m;}, resetStats(){ fireCount.fill(0); inferCount=0; }, stats:()=>({inferCount}) };
})();

/* ----------------------------------------------------------------------------
   MicroFuzzy — per-enemy 27-rule controller (distance · own-health · allies →
   Flee / Hold / Swarm). Fuzzy logic at the micro scale.
   ---------------------------------------------------------------------------- */
const MicroFuzzy = (()=>{
  const tri  = (x,a,b,c)=> Math.max(0, Math.min((x-a)/(b-a||1e-9), (c-x)/(c-b||1e-9)));
  const trapL= (x,a,b)=> x<=a?1: x>=b?0: (b-x)/(b-a);
  const trapR= (x,a,b)=> x<=a?0: x>=b?1: (x-a)/(b-a);
  const dist   = { Close:x=>trapL(x,25,55), Mid:x=>tri(x,30,55,80), Far:x=>trapR(x,60,90) };
  const health = { Low:x=>trapL(x,20,45),   Med:x=>tri(x,30,55,80), High:x=>trapR(x,65,90) };
  const allies = { Few:x=>trapL(x,20,45),   Some:x=>tri(x,30,55,80), Many:x=>trapR(x,60,90) };
  const out    = { Flee:x=>tri(x,0,18,40),  Hold:x=>tri(x,30,50,70), Swarm:x=>trapR(x,60,90) };
  const sets={dist,health,allies};
  const dl={Close:2,Mid:1,Far:0}, hl={Low:0,Med:1,High:2}, al={Few:0,Some:1,Many:2};
  const rules=[];
  for(const d in dist) for(const h in health) for(const a in allies){
    const s = hl[h] + al[a] + 0.4*dl[d];
    const then = s<=1.5 ? 'Flee' : s<=3.0 ? 'Hold' : 'Swarm';
    rules.push({ if:[['dist',d],['health',h],['allies',a]], then });
  }
  function infer(inp){
    const f={}; for(const v in sets){ f[v]={}; for(const t in sets[v]) f[v][t]=sets[v][t](inp[v]); }
    const agg={Flee:0,Hold:0,Swarm:0};
    for(const r of rules){ let s=1; for(const[v,t] of r.if) s=Math.min(s,f[v][t]); agg[r.then]=Math.max(agg[r.then],s); }
    let num=0,den=0;
    for(let x=0;x<=100;x+=4){ let mu=0; for(const o in out) mu=Math.max(mu,Math.min(agg[o],out[o](x))); num+=x*mu; den+=mu; }
    return den>0?num/den:50;
  }
  return { infer, rules, sets, out };
})();

/* ----------------------------------------------------------------------------
   WeaponAdvisor — a tiny fuzzy recommender: given the nearest-enemy distance and
   how crowded you are, it suggests the best weapon (a fuzzy decision-support demo).
   ---------------------------------------------------------------------------- */
const WeaponAdvisor = (()=>{
  const tri  = (x,a,b,c)=> Math.max(0, Math.min((x-a)/(b-a||1e-9), (c-x)/(c-b||1e-9)));
  const trapL= (x,a,b)=> x<=a?1: x>=b?0: (b-x)/(b-a);
  const trapR= (x,a,b)=> x<=a?0: x>=b?1: (x-a)/(b-a);
  function infer(distPx, crowdN){
    const close=trapL(distPx,140,320), far=trapR(distPx,430,780), mid=tri(distPx,220,420,660);
    const pack=trapR(crowdN,5,11), lone=trapL(crowdN,1,4);
    const score={ shotgun:Math.min(close,Math.max(pack,0.35)),
                  bazooka:Math.min(Math.max(mid,far),pack),
                  rifle:Math.max(0.4,Math.min(Math.max(mid,far),lone)) };
    let best='rifle',bv=0; for(const k in score) if(score[k]>bv){bv=score[k];best=k;}
    return { weapon:best, conf:bv };
  }
  return { infer };
})();
