/* MPF Breathe: guided breathing, a craving pause, gratitude and mindful minutes. MPFBreathe.Mount(el,{today,demo}) */
(function(){
  var P={
    calm:{t:'Calm down',s:'Box breathing for stress and busy days',i:'square-rounded',steps:[['Breathe in',4,'in'],['Hold',4,'hold'],['Breathe out',4,'out'],['Hold',4,'hold']]},
    sleep:{t:'Wind down for sleep',s:'4-7-8 breathing for bedtime',i:'moon-stars',steps:[['Breathe in',4,'in'],['Hold',7,'hold'],['Breathe out slowly',8,'out']]},
    reset:{t:'Quick reset',s:'30 seconds when you feel overwhelmed',i:'bolt',fixed:30,steps:[['Breathe in',2,'in'],['One more sip in',1,'in2'],['Long breath out',6,'out']]},
    focus:{t:'Pre-lift focus',s:'Get in the zone before you train',i:'barbell',steps:[['Breathe in',3,'in'],['Breathe out hard',2,'out'],['Breathe in',3,'in'],['Breathe out hard',2,'out']]},
    craving:{t:'Craving pause',s:'90 seconds before you decide',i:'cookie',fixed:90,steps:[['Breathe in',4,'in'],['Breathe out',6,'out']],
      tips:['Notice the craving. Where do you feel it? It\'s just a feeling, it will pass.','Are you actually hungry, or tired, bored or stressed?','Have a big glass of water.','If you still want it after this, have it, log it and enjoy it. No guilt.','Cravings rise like a wave and fall again. Ride it out.']}
  };
  var KEY='mpf_breathe_v1';
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}}
  function save(o){try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function fmt(d){return new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
  function addDays(d,n){var t=new Date(d+'T12:00:00');t.setDate(t.getDate()+n);return t.toISOString().slice(0,10)}

  function Mount(el,o){
    o=o||{};var today=o.today||new Date().toISOString().slice(0,10),st=load();st.mins=st.mins||{};st.grat=st.grat||{};
    function streak(){var n=0,d=today;if(!st.mins[d])d=addDays(d,-1);while(st.mins[d]){n++;d=addDays(d,-1)}return n}
    function week(){var t=0;for(var i=0;i<7;i++)t+=st.mins[addDays(today,-i)]||0;return Math.round(t)}
    function logMins(m){st.mins[today]=(st.mins[today]||0)+m;save(st);
      if(o.demo)return;fetch('/portal/api/log?from='+today+'&to='+today,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){var day=Object.assign({},(j.days&&j.days[today])||{});delete day._at;day.mindful=String(Math.round(((parseFloat(day.mindful)||0)+m)*10)/10);return fetch('/portal/api/log',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({date:today,data:day})})}).catch(function(){})}
    function home(){
      var g=st.grat[today]||['','',''];
      el.innerHTML='<div class="br-stats"><div><b>'+streak()+'</b><small>day streak</small></div><div><b>'+week()+'</b><small>mindful mins this week</small></div></div>'+
        '<div class="br-list">'+Object.keys(P).map(function(k){var p=P[k];return '<button type="button" class="br-card" data-p="'+k+'"><i class="ti ti-'+p.i+'" aria-hidden="true"></i><span><b>'+esc(p.t)+'</b><small>'+esc(p.s)+'</small></span><span class="br-go">›</span></button>'}).join('')+'</div>'+
        '<div class="br-grat"><h3>Three good things <em>today.</em></h3><p class="br-sub">Small wins count. Only you can see these, they stay on your phone.</p>'+[0,1,2].map(function(i){return '<input type="text" maxlength="120" data-g="'+i+'" value="'+esc(g[i]||'')+'" placeholder="'+['e.g. I hit my protein','e.g. a walk in the sun','e.g. I didn\'t skip the gym'][i]+'">'}).join('')+'<button type="button" class="btn" id="brG">Save</button><span class="br-ok" id="brGok"></span></div>'+
        '<a href="#" class="br-guide" data-guide="stress"><i class="ti ti-brain" aria-hidden="true"></i> Stress, sleep and fat loss: my guide →</a>'+
        '<p class="br-note">Breathing exercises are for relaxation, not medical treatment. If you feel dizzy, stop and breathe normally. If you\'re struggling with your mental health, please speak to your GP, or call Samaritans free on 116 123, any time.</p>';
      [].forEach.call(el.querySelectorAll('.br-card'),function(b){b.onclick=function(){pick(b.getAttribute('data-p'))}});
      el.querySelector('#brG').onclick=function(){st.grat[today]=[].map.call(el.querySelectorAll('[data-g]'),function(i){return i.value.trim()});save(st);var g=el.querySelector('#brGok');g.textContent='Saved ✓';if(st.grat[today].filter(Boolean).length&&!st.mins[today]){st.mins[today]=0.5;save(st)}setTimeout(function(){g.textContent=''},2000)};
    }
    function pick(k){var p=P[k];if(p.fixed)return run(k,p.fixed);
      el.innerHTML='<button type="button" class="br-back"><i class="ti ti-arrow-left" aria-hidden="true"></i> Back</button><h3 class="br-h">'+esc(p.t)+'</h3><p class="br-sub">'+esc(p.s)+'. How long?</p><div class="br-len">'+[1,3,5].map(function(m){return '<button type="button" data-m="'+m+'">'+m+' min</button>'}).join('')+'</div>';
      el.querySelector('.br-back').onclick=home;[].forEach.call(el.querySelectorAll('[data-m]'),function(b){b.onclick=function(){run(k,+b.getAttribute('data-m')*60)}})}
    function run(k,secs){var p=P[k],stop=false,t0=Date.now(),chime=true,ac=null;
      el.innerHTML='<div class="br-run"><button type="button" class="br-back"><i class="ti ti-arrow-left" aria-hidden="true"></i> Stop</button><div class="br-stage"><div class="br-ring"></div><div class="br-core"><b id="brW">Get ready</b><span id="brN"></span></div></div><div class="br-left" id="brL"></div>'+(p.tips?'<p class="br-tip" id="brT">'+esc(p.tips[0])+'</p>':'')+'<button type="button" class="br-snd" id="brS"><i class="ti ti-volume" aria-hidden="true"></i> Sound on</button></div>';
      var ring=el.querySelector('.br-ring'),W=el.querySelector('#brW'),N=el.querySelector('#brN'),L=el.querySelector('#brL'),T=el.querySelector('#brT');
      el.querySelector('#brS').onclick=function(){chime=!chime;this.innerHTML='<i class="ti ti-volume'+(chime?'':'-off')+'" aria-hidden="true"></i> Sound '+(chime?'on':'off')};
      function ding(f){if(!chime)return;try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();var os=ac.createOscillator(),g=ac.createGain();os.frequency.value=f;os.type='sine';g.gain.setValueAtTime(0.0001,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.08,ac.currentTime+0.05);g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+1.2);os.connect(g);g.connect(ac.destination);os.start();os.stop(ac.currentTime+1.3)}catch(e){}}
      function finish(done){stop=true;var used=Math.min(secs,(Date.now()-t0)/1000);if(used>=20)logMins(Math.round(used/6)/10);
        el.innerHTML='<div class="br-done"><i class="ti ti-circle-check" aria-hidden="true"></i><h3>'+(done?'Nice one.':'Good effort.')+'</h3><p>'+(used>=20?'That\'s '+(Math.round(used/6)/10)+' mindful minutes logged. '+(streak()>1?'You\'re on a '+streak()+' day streak.':''):'Even a few breaths helps.')+'</p>'+(k==='craving'?'<p class="br-sub">Still want it? That\'s fine. Have it, log it, enjoy it, move on.</p>':'')+'<button type="button" class="btn" id="brH">Done</button></div>';
        el.querySelector('#brH').onclick=home}
      el.querySelector('.br-back').onclick=function(){finish(false)};
      var i=0,tip=0;
      function step(){if(stop)return;var el2=(Date.now()-t0)/1000;if(el2>=secs)return finish(true);
        var s=p.steps[i%p.steps.length],dur=s[1];i++;W.textContent=s[0];ring.style.transitionDuration=dur+'s';
        ring.className='br-ring '+(s[2]==='in'?'grow':s[2]==='in2'?'grow2':s[2]==='out'?'shrink':ring.className.replace('br-ring','').trim());
        if(s[2]==='in')ding(528);else if(s[2]==='out')ding(396);
        var left=dur;N.textContent=left;var iv=setInterval(function(){if(stop){clearInterval(iv);return}left--;if(left>0)N.textContent=left;else clearInterval(iv)},1000);
        var rem=Math.max(0,Math.ceil(secs-el2));L.textContent=Math.floor(rem/60)+':'+String(rem%60).padStart(2,'0')+' left';
        if(T&&i%p.steps.length===0){tip=(tip+1)%p.tips.length;T.textContent=p.tips[tip]}
        setTimeout(step,dur*1000)}
      setTimeout(step,1500)}
    home();
  }
  window.MPFBreathe={Mount:Mount};
  // stress guide, added to the shared guides
  var add=function(){if(!window.MPFGuides||!MPFGuides.add)return setTimeout(add,300);MPFGuides.add('stress',{i:'brain',t:'Stress, sleep and fat loss',s:'Why your head affects your results',b:[
    ['Why I added this','You can have the perfect plan and still feel stuck if your head is all over the place. Stress, rubbish sleep and constantly being "on" make everything harder: hunger, cravings, motivation, recovery. So looking after your mind is part of your results, not a nice extra.'],
    ['What stress does to your body','When you\'re stressed for a long time, your body is in fight or flight mode. You hold more water (hello scale jumps), you crave quick energy like sugar and carbs, you sleep worse and you recover slower from training. It\'s not you being weak. It\'s biology.'],
    ['Sleep is your secret weapon','One bad night can make you eat a few hundred calories more the next day without even noticing. Aim for 7 to 9 hours. Same bedtime most nights, phone away 30 minutes before bed, and try the Wind down breathing when your head won\'t switch off.'],
    ['Why breathing works','Slow breathing, especially long breaths out, tells your nervous system you\'re safe. Your heart rate drops and you calm down. It takes a couple of minutes and you can do it anywhere: in the car, at your desk, in the gym toilets before a big lift.'],
    ['Stress eating','If you reach for food when you\'re stressed, bored or upset, try the Craving pause first. It\'s not about never having the snack. It\'s about choosing it rather than it choosing you.'],
    ['Little and often','Two minutes a day beats a 30 minute session once a month. Pick a time that fits: first thing, after training, or in bed. Keep your streak going and watch how much calmer you feel in a few weeks.']]})};add();
})();
