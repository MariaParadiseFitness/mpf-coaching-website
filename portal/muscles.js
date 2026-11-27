/* MPF muscles worked: works out the main and supporting muscles for an exercise (from its movement
   pattern in swaps.js plus a few name rules) and draws a small front/back body with them in red. */
(function(){
  var NM={chest:'Chest',fdelt:'Front shoulders',sdelt:'Side shoulders',rdelt:'Rear shoulders',bi:'Biceps',tri:'Triceps',fore:'Forearms',abs:'Abs',obl:'Obliques',
    quad:'Quads',add:'Inner thighs',abd:'Outer glutes',glute:'Glutes',ham:'Hamstrings',calf:'Calves',trap:'Traps',ub:'Upper back',lat:'Lats',lb:'Lower back'};
  // pattern -> [main muscles, supporting muscles]
  var BY={calfs:[['calf'],[]],calf:[['calf'],[]],lunge:[['quad','glute'],['ham','add']],uhinge:[['ham','glute'],['lb','add']],thrust:[['glute'],['ham','quad']],
    kneeflex:[['ham'],['calf']],kneeext:[['quad'],[]],abd:[['abd'],['glute']],add:[['add'],[]],tkick:[['tri'],[]],gkick:[['glute'],['ham']],
    hinge:[['ham','glute','lb'],['ub','trap','fore']],squat:[['quad','glute'],['add','ham','lb']],rear:[['rdelt'],['ub','trap']],straight:[['lat'],['tri','rdelt']],
    vpull:[['lat'],['bi','ub','rdelt','fore']],hpull:[['ub','lat'],['rdelt','bi','trap']],lat:[['sdelt'],['trap']],front:[['fdelt'],['chest']],fly:[['chest'],['fdelt']],
    vpush:[['fdelt','sdelt'],['tri','trap']],dip:[['chest','tri'],['fdelt']],incline:[['chest','fdelt'],['tri']],decline:[['chest'],['tri']],hpush:[['chest'],['fdelt','tri']],
    ohtri:[['tri'],[]],lytri:[['tri'],[]],pushdown:[['tri'],[]],curl:[['bi'],['fore']],shrug:[['trap'],['fore']],corerot:[['obl'],['abs']],coreext:[['abs'],['obl','lb']],coreflex:[['abs'],['obl']]};
  // name rules checked before the pattern (first match wins)
  var RULE=[[/hammer curl|reverse curl|zottman/,[['bi','fore'],[]]],[/wrist curl|forearm/,[['fore'],[]]],[/upright row/,[['sdelt','trap'],['fdelt']]],[/farmer|suitcase|carry\b/,[['fore','trap'],['abs','obl']]],
    [/back extension|hyperextension|good ?morning|superman/,[['lb','glute'],['ham']]],[/sumo/,[['glute','add','quad'],['ham','lb']]],[/front squat|goblet|hack squat|sissy|leg press/,[['quad'],['glute','add']]],
    [/(single|one|1)[- ]?leg(ged)?.*(rdl|romanian|deadlift)/,[['ham','glute'],['lb','add']]],[/romanian|\brdl\b|stiff[- ]?leg/,[['ham','glute'],['lb','fore']]],[/(^|\s)deadlift|trap bar|rack pull/,[['ham','glute','lb'],['quad','trap','ub','fore']]],[/face pull/,[['rdelt','ub'],['trap']]],[/pull[- ]?up|chin[- ]?up/,[['lat'],['bi','ub','fore']]],
    [/close[- ]?grip (bench|press)|diamond push/,[['tri','chest'],['fdelt']]],[/push[- ]?up|press[- ]?up/,[['chest'],['fdelt','tri','abs']]],[/plank|dead ?bug|rollout|ab wheel/,[['abs'],['obl','lb']]]];
  function of(name){var n=String(name||'').toLowerCase().replace(/\(.*?\)/g,' ').replace(/\s+/g,' ').trim();if(!n||/cardio|treadmill|bike|cycle|stair|elliptical|cross ?trainer|rowing machine|rower|\brun\b|walk(ing)?$|stretch|foam roll|mobility/.test(n))return null;
    for(var i=0;i<RULE.length;i++)if(RULE[i][0].test(n))return {main:RULE[i][1][0],also:RULE[i][1][1]};
    var p=window.MPFSWAP&&window.MPFSWAP.of(name);return p&&BY[p.key]?{main:BY[p.key][0],also:BY[p.key][1]}:null}
  // body shapes: [muscle, view, svg]
  var E=function(x,y,rx,ry){return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'"/>'},R=function(x,y,w,h,r){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'"/>'};
  var F=47,B=153,S=[
    ['trap',F,'<path d="M40 31 L47 28 L54 31 L52 35 L42 35Z"/>'],['fdelt',F,E(31,41,6,6)+E(63,41,6,6)],['sdelt',F,E(25,39,3.5,5)+E(69,39,3.5,5)],['chest',F,E(40,49,8.5,6.5)+E(54,49,8.5,6.5)],
    ['bi',F,E(25,59,4.5,9)+E(69,59,4.5,9)],['fore',F,E(21,80,4,11)+E(73,80,4,11)],['abs',F,R(41.5,57,11,30,4)],['obl',F,E(35,72,3.5,11)+E(59,72,3.5,11)],
    ['quad',F,E(39.5,116,7,19)+E(54.5,116,7,19)],['add',F,E(45,104,2.5,9)+E(49,104,2.5,9)],['calf',F,E(39.5,158,4.5,13)+E(54.5,158,4.5,13)],
    ['trap',B,'<path d="M141 31 L153 27 L165 31 L160 46 L153 50 L146 46Z"/>'],['rdelt',B,E(137,41,6,6)+E(169,41,6,6)],['sdelt',B,E(131,39,3.5,5)+E(175,39,3.5,5)],['ub',B,R(146,46,14,13,4)],
    ['lat',B,E(142,64,6.5,13)+E(164,64,6.5,13)],['lb',B,R(147.5,74,11,14,4)],['tri',B,E(131,59,4.5,9)+E(175,59,4.5,9)],['fore',B,E(127,80,4,11)+E(179,80,4,11)],
    ['abd',B,E(140,93,4,6)+E(166,93,4,6)],['glute',B,E(146,97,7.5,8)+E(160,97,7.5,8)],['ham',B,E(145.5,122,6.5,16)+E(160.5,122,6.5,16)],['calf',B,E(145.5,156,5.5,13)+E(160.5,156,5.5,13)]];
  function body(m){var col=function(k){return m.main.indexOf(k)>-1?'#e0362c':m.also.indexOf(k)>-1?'#8e2b25':'#2c2a27'};
    var base=function(cx){return '<g fill="#1c1b19"><circle cx="'+cx+'" cy="15" r="9"/>'+R(cx-4,22,8,7,2)+R(cx-17,30,34,58,12)+R(cx-30,34,10,56,5)+R(cx+20,34,10,56,5)+R(cx-15,86,30,22,8)+R(cx-15,100,13,72,6)+R(cx+2,100,13,72,6)+'</g>'};
    return '<svg class="mus-svg" viewBox="0 0 200 182" role="img" aria-label="Muscles worked">'+base(F)+base(B)+S.map(function(s){return '<g fill="'+col(s[0])+'">'+s[2]+'</g>'}).join('')+
      '<text x="'+F+'" y="180" text-anchor="middle">Front</text><text x="'+B+'" y="180" text-anchor="middle">Back</text></svg>'}
  function html(name){var m=of(name);if(!m)return '';var nm=function(a){return a.map(function(k){return NM[k]}).join(', ')};
    return '<div class="lb-mus">'+body(m)+'<div class="lb-mus-t"><b>💪 Muscles worked</b><span><i class="mus-dot"></i>Main: '+nm(m.main)+'</span>'+(m.also.length?'<span><i class="mus-dot al"></i>Also: '+nm(m.also)+'</span>':'')+'</div></div>'}
  var st=document.createElement('style');st.textContent='.lb-mus{display:flex;align-items:center;gap:12px;background:#121110;border:1px solid rgba(201,166,75,.2);border-radius:14px;padding:10px 12px;margin:10px 0}'+
    '.mus-svg{width:165px;flex:none;height:auto}.mus-svg text{fill:#8d8371;font-size:9px;font-family:inherit;letter-spacing:.08em;text-transform:uppercase}'+
    '.lb-mus-t{display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.35;color:#e9e4da}.lb-mus-t b{color:#e8c872;font-size:13px}.mus-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#e0362c;margin-right:6px;vertical-align:-1px}.mus-dot.al{background:#8e2b25}'+
    '@media(max-width:360px){.mus-svg{width:120px}}';(document.head||document.documentElement).appendChild(st);
  window.MPFMuscles={of:of,html:html,names:NM};
})();
