/* MPF "My cycle": period calendar, predicted period and ovulation, phase tips, symptom taps, patterns and guides. Women only. */
(function(){
  var DAY=864e5;
  function iso(d){var x=new Date(d);return x.getUTCFullYear()+'-'+String(x.getUTCMonth()+1).padStart(2,'0')+'-'+String(x.getUTCDate()).padStart(2,'0')}
  function T(s){return Date.parse(s+'T00:00:00Z')}
  function add(s,n){return iso(T(s)+n*DAY)}
  function diff(a,b){return Math.round((T(a)-T(b))/DAY)}
  function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function nice(s,o){return new Date(T(s)).toLocaleDateString('en-GB',Object.assign({day:'numeric',month:'short',timeZone:'UTC'},o||{}))}
  var MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var SYM=[['cravings','Cravings'],['bloated','Bloated'],['cramps','Cramps'],['headache','Headache'],['lowmood','Low mood'],['emotional','Emotional'],['irritable','Irritable'],['tired','Tired'],['spotting','Spotting'],['sore','Sore boobs'],['acne','Spots'],['energy','Full of energy']];
  var FLOW=[['light','Light'],['medium','Medium'],['heavy','Heavy']];

  var TIPS={
    period:{n:'Period',t:'Train how you feel. Lots of women feel strong from day 2 or 3. Rubbish day? Keep the weights, drop a set and leave a couple more reps in the tank.',f:'Keep your protein up and get some iron in (red meat, eggs, spinach, lentils). A bit of dark chocolate fits, enjoy it.',m:'Tired, crampy or a bit flat? Totally normal. Be kind to yourself, it lifts in a few days.',s:'Cramps? A walk, a hot water bottle and some stretching help. Water weight starts dropping off now.'},
    follicular:{n:'Follicular phase',t:'Energy\'s high, push for a PB! Recovery is usually at its best now, so add weight where you can.',f:'Appetite is often lower this week, so it\'s the easiest time to hit your calories. Be bang on plan.',m:'Mood and motivation are usually up. Make the most of it.',s:'The scale usually looks its kindest this week.'},
    ovulation:{n:'Ovulation',t:'Strength often peaks now, so go for it. Warm up properly and keep your form tight.',f:'Normal hunger. Stick to your plan and keep your protein high.',m:'You might feel more confident and social. Lovely.',s:'Some women get a twinge or a bit of bloating for a day. Totally normal.'},
    luteal:{n:'Luteal phase',t:'Strength may dip and everything can feel harder. Keep your weights and focus on form. No pressure to set PBs this week.',f:'Hunger is higher this week. That\'s normal. Add 100 to 200 calories of carbs and don\'t feel guilty about it. Keep your protein high.',m:'Your mood might change: more emotional, irritable or low. It\'s hormones, not you. Sleep, steps and a bit of patience with yourself help.',s:'Water weight creeps up before your period, sometimes 1 to 2kg. It\'s not fat. Your trend line knows.'}
  };


  var G={
    hormones:{i:'mood-crazy-happy',t:'Your hormones are talking (know yourself)',b:[
      ['Let\'s be honest','Ever cried at an advert, rage-cleaned the whole kitchen and eaten half the snack cupboard, all before 8pm? Welcome to being a woman with hormones. 😂 We can be so irrational sometimes, and it\'s not because we\'re crazy. It\'s because our hormones are talking, loudly, and it\'s hard to make sense of it in the moment.'],
      ['Why knowing your cycle is a superpower','When you know where you are in your cycle, you can go "ahh, that\'s why I feel like this" instead of "what is wrong with me". It doesn\'t make the feelings go away, but it takes the panic and the guilt out of it. That\'s why tracking it here is so useful.'],
      ['My mum\'s best advice','My mum always said: never make a big decision when you\'re on your period or just before it. Honestly, best advice ever. Don\'t quit the job, dump the boyfriend, cut your own fringe or decide your diet "isn\'t working" that week. Write it down, wait a week, then see if you still feel the same.'],
      ['What it looks like in real life','Week before your period: more emotional, more irritable, hungrier, puffier, and everything feels harder. After your period: energy\'s back, mood\'s up, you feel like you can take on the world. Same woman, different hormones.'],
      ['Use it to your advantage','Plan your big sessions and PB attempts for your strong weeks. Plan cosy, easier days and a bit more food for the tough week. Tell the people around you what you need. And be a bit kinder to yourself when your hormones are running the show.'],
      ['The bottom line','You\'re not irrational. You\'re hormonal, and that\'s a completely different thing. Know yourself, plan for it, and you\'ll make so much better decisions. 🖤']]},
    training:{i:'barbell',t:'Training around your cycle',b:[
      ['The short version','Your cycle changes how you feel in the gym, but it doesn\'t stop you making progress. You don\'t need a brand new programme every week. Adjust the effort, don\'t abandon the plan.'],
      ['Your period (days 1 to 5ish)','Train how you feel. Lots of women feel bloody strong from day 2 or 3. If day 1 is grim, go lighter, drop a set or swap to a walk and a stretch. Moving usually helps cramps way more than lying on the sofa feeling sorry for yourself (been there).'],
      ['After your period (follicular)','This is your power week. Energy\'s high, push for a PB! Recovery is at its best, so add weight and make the most of it.'],
      ['Ovulation (mid-cycle)','Strength often peaks around now, so go for it. Warm up properly and keep your form tight.'],
      ['The week before your period (luteal)','Everything feels heavier and harder. That\'s hormones, not you getting weaker. Keep your weights, focus on form, leave a rep or two more in the tank and don\'t judge yourself on these sessions.'],
      ['The golden rule','Consistency beats perfection. A "meh" session in your luteal week still counts. Log it, move on, smash the next one. 💪']]},
    eating:{i:'apple',t:'Eating around your cycle',b:[
      ['Why you\'re starving before your period','In the week or so before your period, your body burns a bit more energy and your hormones crank up your appetite and cravings. It\'s not a lack of willpower. It\'s biology.'],
      ['What to do about it','Hunger is higher this week. That\'s normal. Add 100 to 200 calories of carbs and don\'t feel guilty about it. Keep your protein high (it keeps you fuller), eat loads of veg, drink your water and plan a treat in, so it doesn\'t turn into a free-for-all.'],
      ['During your period','Iron matters, especially if your periods are heavy. Red meat, eggs, spinach, lentils, beans and fortified cereals all help. Pair plant iron with vitamin C (peppers, berries, citrus).'],
      ['Why the scale freaks out','Before and during your period you can hold 1 to 2kg of extra water. It\'s not fat, and it drops off once your period gets going. This is exactly why we watch your weekly trend line, not one random weigh-in.'],
      ['Check-in tip','If your check-in lands right before your period, tell me. I\'ll know not to panic about the scale, and neither should you.']]},
    cravings:{i:'cookie',t:'Hormonal eating and cravings',b:[
      ['First things first','Cravings before your period are normal. You\'re not broken, and you do NOT need to "start again on Monday".'],
      ['Why they happen','Your hormones mess with your appetite, your mood and the bit of your brain that wants chocolate, crisps and everything beige. Being tired or stressed turns the volume up.'],
      ['What actually helps','Eat regular meals with protein in every one. Don\'t save all your calories for later. Plan a treat that fits your day (yes, chocolate fits). Get your sleep and steps in. If you want something sweet, have a proper portion, sit down, enjoy it, and carry on with your day.'],
      ['If you go over','One higher day doesn\'t undo a week. Log it honestly, drink your water and get back to your next normal meal. No skipping meals, no punishment cardio. Adjust the plan, don\'t abandon the plan.'],
      ['Talk to me','If cravings feel out of control every single month, tell me. We can tweak your calories and macros for that week.']]},
    binge:{i:'heart-handshake',t:'Binge eating: you\'re not broken',b:[
      ['You\'re not alone','So many people feel out of control around food at times, especially after a long stretch of strict dieting. I\'ve seen it, I\'ve coached it, and it\'s nothing to be ashamed of. It can get better.'],
      ['Why it happens','Binges often follow restriction: skipping meals, cutting out foods you love, or "being good" all week. Tiredness, stress and big emotions play a huge part too. Your body and brain push back when they feel deprived.'],
      ['What helps','Eat regularly: three meals and a snack or two, so you never get to starving. Don\'t ban foods. Planned treats take away that "last chance" feeling. Notice what tends to come before a binge (stress, boredom, a crap day) and have a plan for those moments, like a walk, a call with a friend or a bath.'],
      ['After a binge','Be kind to yourself. Don\'t skip your next meal, don\'t do extra cardio to "burn it off" and don\'t start a strict diet the next day. Have your next normal meal at the normal time. That\'s how you break the cycle.'],
      ['When to get support','If binges happen often, feel out of your control, or leave you feeling really low or guilty, please talk to your GP. You can also contact Beat, the UK eating disorder charity, at beateatingdisorders.org.uk or on 0808 801 0677. You deserve proper support, and I\'ll back you all the way. Message me any time.']]}
  };

  window.__MPFCycleG=G;
  function Mount(el,o){
    o=o||{};var today=o.today||iso(Date.now()),days={},sel=null,mo=today.slice(0,8)+'01',edit=null;
    function load(){
      if(o.demo){days=o.demoDays||{};draw();return}
      fetch('/portal/api/log?from='+add(today,-120)+'&to='+today,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){days=(j&&j.days)||{};draw()}).catch(function(){draw()})}
    function isP(d){return days[d]&&days[d].period==='Yes'}
    function stats(){
      var ds=Object.keys(days).filter(isP).sort(),starts=[],lens=[],pl=[];
      ds.forEach(function(d){if(!isP(add(d,-1)))starts.push(d)});
      for(var i=1;i<starts.length;i++){var l=diff(starts[i],starts[i-1]);if(l>=20&&l<=45)lens.push(l)}
      starts.forEach(function(s){var n=0;while(isP(add(s,n))&&n<12)n++;if(n)pl.push(n)});
      var avg=function(a,d){return a.length?Math.round(a.reduce(function(x,y){return x+y},0)/a.length):d};
      var cl=avg(lens.slice(-6),28),plen=Math.min(8,avg(pl.slice(-6),5)),last=starts[starts.length-1]||null;
      if(!last)return {none:true,cl:cl,plen:plen};
      var next=add(last,cl);while(diff(next,today)<0)next=add(next,cl);
      var cd=diff(today,last)+1;while(cd>cl+7&&cl)cd-=cl;
      var ov=add(next,-14),lastOv=add(last,cl-14);
      var lastEnd=last;while(isP(add(lastEnd,1)))lastEnd=add(lastEnd,1);var tNo=days[today]&&days[today].period&&days[today].period!=='Yes';var onP=isP(today)||(!tNo&&lastEnd===add(today,-1)&&cd<=plen);var phase=onP?'period':(diff(today,lastOv)>=-1&&diff(today,lastOv)<=1)?'ovulation':diff(today,lastOv)<-1?'follicular':'luteal';
      return {last:last,next:next,cl:cl,plen:plen,cd:cd,phase:phase,ov:ov,lastOv:lastOv,starts:starts,lens:lens}}
    function marks(st){var m={};if(st.none)return m;
      Object.keys(days).forEach(function(d){if(isP(d))m[d]='p'});
      var base=st.last;for(var k=0;k<4;k++){var ps=add(base,k*st.cl),ov=add(ps,st.cl-14);
        for(var f=-5;f<=1;f++){var x=add(ov,f);if(!m[x])m[x]=f===0?'o':'f'}
        if(k>0)for(var p=0;p<st.plen;p++){var y=add(ps,p);if(diff(y,today)>0&&!m[y])m[y]='pp'}}
      return m}
    function patterns(st){if(st.none)return '';var by={};
      Object.keys(days).forEach(function(d){var s=String((days[d]||{}).sym||'');if(!s)return;var cd=null;for(var i=st.starts.length-1;i>=0;i--){if(diff(d,st.starts[i])>=0){cd=diff(d,st.starts[i])+1;break}}if(!cd||cd>45)return;s.split(',').forEach(function(k){if(!k)return;(by[k]=by[k]||[]).push(cd)})});
      var out=[];SYM.forEach(function(s){var a=(by[s[0]]||[]).sort(function(x,y){return x-y});if(a.length<3)return;var lo=a[Math.floor(a.length*0.2)],hi=a[Math.floor(a.length*0.8)];out.push(s[1].toLowerCase()+(lo===hi?' around day '+lo:' on days '+lo+' to '+hi))});
      return out.length?'<div class="cy-pat"><i class="ti ti-sparkles"></i> Your pattern: you usually get '+out.slice(0,3).join(', ')+'. Plan for it and go easy on yourself those days.</div>':''}
    function cal(st){var m=marks(st),y=+mo.slice(0,4),mn=+mo.slice(5,7)-1,first=new Date(Date.UTC(y,mn,1)),off=(first.getUTCDay()+6)%7,dim=new Date(Date.UTC(y,mn+1,0)).getUTCDate();
      var h='<div class="cy-top"><button type="button" data-cm="-1" aria-label="Previous month">‹</button><b>'+MN[mn]+' '+y+'</b><button type="button" data-cm="1" aria-label="Next month">›</button></div><div class="cy-grid">'+['M','T','W','T','F','S','S'].map(function(d){return '<i>'+d+'</i>'}).join('');
      for(var i=0;i<off;i++)h+='<span></span>';
      for(var d=1;d<=dim;d++){var ds=mo.slice(0,8)+String(d).padStart(2,'0'),k=edit?(edit[ds]?'p':(diff(ds,today)>0?'':'')):(m[ds]||''),cls='cy-d'+(k?' cy-'+k:'')+(ds===today?' cy-today':'')+(ds===sel?' cy-sel':'');h+='<button type="button" class="'+cls+'" data-d="'+ds+'">'+d+'</button>'}
      h+='</div>'+(edit?'<div class="cy-editbar"><p><b>Tap every day you were bleeding.</b> Tap again to remove it. Day 1 of your cycle is the first day you start bleeding properly (not just spotting).</p><div><button type="button" class="btn" data-ed="save">Save my period days</button><button type="button" class="cy-ed-x" data-ed="x">Cancel</button></div></div>':'')+'<div class="cy-key"><span><i class="cy-k-p"></i>Period</span><span><i class="cy-k-pp"></i>Predicted period</span><span><i class="cy-k-o"></i>Ovulation</span><span><i class="cy-k-f"></i>Fertile</span></div>';return h}
    function dayInfo(d){var x=days[d]||{},sy=String(x.sym||'').split(',').filter(Boolean);
      return '<div class="cy-dayinfo"><b>'+nice(d,{weekday:'long'})+'</b> '+(x.period==='Yes'?'· <i class="ti ti-droplet"></i> Period'+(x.flow?' ('+esc(x.flow)+')':''):'')+(sy.length?'<br>'+sy.map(function(k){var f=SYM.filter(function(s){return s[0]===k})[0];return f?f[1]:k}).join(', '):'')+(x.period!=='Yes'&&!sy.length?'<br><small>Nothing logged.</small>':'')+(diff(d,today)<=0?'<div class="cy-edit-day">'+(x.period==='Yes'?'<button type="button" data-pd="'+d+'" data-pv="">Not a period day</button>':'<button type="button" data-pd="'+d+'" data-pv="Yes"><i class="ti ti-droplet"></i> Mark as a period day</button>')+'</div>':'<small class="cy-fut">You can edit days up to today.</small>')+'</div>'}
    function draw(){
      var st=stats(),x=days[today]||{},sy=String(x.sym||'').split(',').filter(Boolean),h='';
      if(st.none){h+='<div class="cy-card cy-hero"><div class="cy-k">Let\'s get started</div><h3>Track your cycle</h3><p>Tap below on the first day of your period, or answer "Period today?" in your daily log. After that I\'ll show your cycle day, your phase, your next period and ovulation, with tips for each week.</p><button type="button" class="btn" data-start="1"><i class="ti ti-droplet"></i> My period started today</button></div>'}
      else{var tp=TIPS[st.phase],dn=diff(st.next,today);
        h+='<div class="cy-card cy-hero"><div class="cy-row"><div class="cy-ring" style="--p:'+Math.min(100,Math.round(st.cd/st.cl*100))+'"><small>Day</small><b>'+st.cd+'</b></div><div><div class="cy-k">Today</div><h3>'+tp.n+'</h3><p class="cy-sub">'+(st.phase==='period'?'Day '+st.cd+' of your period':dn<=0?'Your period is due today':'Period due in about '+dn+' day'+(dn===1?'':'s')+' ('+nice(st.next)+')')+'<br>Next ovulation around '+nice(diff(st.lastOv,today)>=-1?st.lastOv:st.ov)+'</p></div></div>'+
          '<div class="cy-tips"><div><span><i class="ti ti-barbell"></i></span><p><b>Training:</b> '+tp.t+'</p></div><div><span><i class="ti ti-salad"></i></span><p><b>Food:</b> '+tp.f+'</p></div><div><span><i class="ti ti-mood-smile"></i></span><p><b>Mood:</b> '+tp.m+'</p></div><div><span><i class="ti ti-scale"></i></span><p><b>Body:</b> '+tp.s+'</p></div></div>'+
          (st.phase!=='period'?'<button type="button" class="cy-start" data-start="1"><i class="ti ti-droplet"></i> My period started today</button>':'')+'</div>'}
      h+='<div class="cy-card" id="cyCal">'+cal(st)+(edit?'':(sel?dayInfo(sel):'<button type="button" class="cy-hl" data-ed="on"><i class="ti ti-droplet"></i> Highlight my period days</button><p class="cy-hint">Day 1 of your cycle is the first day you start bleeding properly (not just spotting).</p>'))+'</div>';
      h+='<div class="cy-card cy-fix"><button type="button" class="cy-fix-t" data-fix="1"><i class="ti ti-pencil"></i> '+(st.none?'Already on your period or mid-cycle? Tell me your cycle day':'Wrong day? Edit my cycle')+'</button><div class="cy-fix-b" hidden><label>What day of your cycle are you on today?<small>Day 1 is the first day you start bleeding properly (not just spotting). So if your period started yesterday, today is day 2.</small><input type="number" inputmode="numeric" min="1" max="45" id="cyCd" value="'+(st.none?'':st.cd)+'" placeholder="e.g. 3"></label><label>How many days does your period usually last?<input type="number" inputmode="numeric" min="1" max="10" id="cyPl" value="'+((function(){try{return localStorage.getItem('mpf_plen')}catch(e){}})()||st.plen||5)+'"></label><button type="button" class="btn" id="cyFixGo">Update my cycle</button><p class="cy-note">This sets your last period to start on the right day and fills in your period days. You can still tap any day on the calendar to fix it.</p></div></div>';
      h+='<div class="cy-card"><div class="cy-k">How are you today?</div><div class="cy-chips">'+SYM.map(function(s){return '<button type="button" data-s="'+s[0]+'" class="'+(sy.indexOf(s[0])>-1?'on':'')+'">'+s[1]+'</button>'}).join('')+'</div>'+
        (x.period==='Yes'?'<div class="cy-k" style="margin-top:12px">Flow</div><div class="cy-chips">'+FLOW.map(function(f){return '<button type="button" data-f="'+f[0]+'" class="'+(x.flow===f[0]?'on':'')+'">'+f[1]+'</button>'}).join('')+'</div>':'')+
        '<p class="lg-msg" id="cyMsg"></p>'+patterns(st)+(st.none?'':'<p class="cy-note">Average cycle '+st.cl+' days'+(st.lens.length?' (from your last '+Math.min(6,st.lens.length)+')':' (log a few periods and this gets more accurate)')+'. Predictions are estimates, so don\'t rely on them for contraception. Not medical advice: if anything feels off, speak to your GP.</p>')+'</div>';
      h+='<button type="button" class="cy-off" data-off="1">No periods anymore (menopause or another reason)? Turn period tracking off</button>';
      h+='<div class="cy-k" style="margin:4px 2px 8px">Guides for you</div><div class="cy-guides">'+Object.keys(G).map(function(k){return '<button type="button" data-g="'+k+'"><span><i class="ti ti-'+G[k].i+'"></i></span><b>'+G[k].t+'</b><em>›</em></button>'}).join('')+'</div>';
      el.innerHTML=h;bind();if(o.onStats)try{o.onStats(st,st.none?null:TIPS[st.phase],st.none?null:diff(st.next,today))}catch(e){}}
    function save(patch,msg){var m=el.querySelector('#cyMsg');if(o.demo){days[today]=Object.assign({},days[today]||{},patch);draw();return}
      if(m)m.textContent='Saving…';
      fetch('/portal/api/log?from='+today+'&to='+today,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){var d=Object.assign({},(j.days&&j.days[today])||{},patch);delete d._at;Object.keys(d).forEach(function(k){if(d[k]==='')delete d[k]});
        return fetch('/portal/api/log',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({date:today,data:d})}).then(function(r){if(!r.ok)throw 0;days[today]=d;draw();var mm=el.querySelector('#cyMsg');if(mm){mm.textContent=msg||'Saved ✓';mm.className='lg-msg ok'}try{window.dispatchEvent(new Event('mpf-workout-saved'))}catch(e){}})}).catch(function(){var mm=el.querySelector('#cyMsg');if(mm){mm.textContent='Not saved. Try again.';mm.className='lg-msg warn'}})}
    function saveDays(P,msg){var ds=Object.keys(P).sort();if(!ds.length)return;var m=el.querySelector('#cyMsg');
      var apply=function(d,patch){var x=Object.assign({},days[d]||{},patch);delete x._at;Object.keys(x).forEach(function(k){if(x[k]==='')delete x[k]});return x};
      if(o.demo){ds.forEach(function(d){days[d]=apply(d,P[d])});draw();return}
      if(m)m.textContent='Saving…';
      fetch('/portal/api/log?from='+ds[0]+'&to='+ds[ds.length-1],{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){var cur=(j&&j.days)||{};
        return ds.reduce(function(pr,d){return pr.then(function(){var x=Object.assign({},cur[d]||{},P[d]);delete x._at;Object.keys(x).forEach(function(k){if(x[k]==='')delete x[k]});if(!Object.keys(x).length&&!cur[d]){days[d]=x;return}
          return fetch('/portal/api/log',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({date:d,data:x})}).then(function(r){if(!r.ok)throw 0;days[d]=x})})},Promise.resolve())}).then(function(){draw();var mm=el.querySelector('#cyMsg');if(mm){mm.textContent=msg||'Saved ✓';mm.className='lg-msg ok'}try{window.dispatchEvent(new Event('mpf-workout-saved'))}catch(e){}}).catch(function(){draw();var mm=el.querySelector('#cyMsg');if(mm){mm.textContent='Not saved. Try again.';mm.className='lg-msg warn'}})}
    function bind(){
      [].forEach.call(el.querySelectorAll('[data-pd]'),function(b){b.onclick=function(){var d=b.getAttribute('data-pd'),v=b.getAttribute('data-pv'),P={};P[d]=v?{period:'Yes'}:{period:'',flow:''};saveDays(P,v?'Period day added ✓ Predictions updated.':'Period day removed ✓');}});
      var fx=el.querySelector('[data-fix]');if(fx)fx.onclick=function(){var b=el.querySelector('.cy-fix-b');b.hidden=!b.hidden;if(!b.hidden){var i=el.querySelector('#cyCd');i&&i.focus()}};
      var go=el.querySelector('#cyFixGo');if(go)go.onclick=function(){var n=parseInt(el.querySelector('#cyCd').value,10),pl=parseInt(el.querySelector('#cyPl').value,10)||5;if(!(n>=1&&n<=45)){el.querySelector('#cyCd').focus();return}pl=Math.max(1,Math.min(10,pl));try{localStorage.setItem('mpf_plen',pl)}catch(e){}
        var start=add(today,-(n-1)),P={};
        for(var i=-10;i<=n-1;i++){var d=add(start,i);if(diff(d,today)>0)break;var inP=i>=0&&i<pl;if(inP)P[d]={period:'Yes'};else if(isP(d))P[d]={period:'',flow:''}}
        sel=null;mo=start.slice(0,8)+'01';saveDays(P,'Updated ✓ You\'re on day '+n+'. Your predictions have changed.')};
      [].forEach.call(el.querySelectorAll('[data-cm]'),function(b){b.onclick=function(){var y=+mo.slice(0,4),m=+mo.slice(5,7)-1+(+b.getAttribute('data-cm'));var d=new Date(Date.UTC(y,m,1));mo=iso(d);sel=null;el.querySelector('#cyCal').innerHTML=cal(stats());bind()}});
      [].forEach.call(el.querySelectorAll('.cy-d'),function(b){b.onclick=function(){var d=b.getAttribute('data-d');if(edit){if(diff(d,today)>0)return;if(edit[d])delete edit[d];else edit[d]=1;b.classList.toggle('cy-p',!!edit[d]);return}sel=d;el.querySelector('#cyCal').innerHTML=cal(stats())+dayInfo(sel);bind()}});
      [].forEach.call(el.querySelectorAll('[data-ed]'),function(b){b.onclick=function(){var a=b.getAttribute('data-ed');
        if(a==='on'){edit={};Object.keys(days).forEach(function(d){if(isP(d))edit[d]=1});sel=null;draw();var c=el.querySelector('#cyCal');c&&c.scrollIntoView({block:'start',behavior:'smooth'});return}
        if(a==='x'){edit=null;draw();return}
        if(a==='save'){var P={};var all={};Object.keys(days).forEach(function(d){if(isP(d))all[d]=1});Object.keys(edit).forEach(function(d){all[d]=1});Object.keys(all).forEach(function(d){var want=!!edit[d];if(want&&!isP(d))P[d]={period:'Yes'};else if(!want&&isP(d))P[d]={period:'',flow:''}});edit=null;if(!Object.keys(P).length){draw();return}saveDays(P,'Saved ✓ Your period days and predictions have updated.')}}});
      [].forEach.call(el.querySelectorAll('[data-s]'),function(b){b.onclick=function(){var k=b.getAttribute('data-s'),cur=String((days[today]||{}).sym||'').split(',').filter(Boolean),i=cur.indexOf(k);if(i>-1)cur.splice(i,1);else cur.push(k);save({sym:cur.join(',')})}});
      [].forEach.call(el.querySelectorAll('[data-f]'),function(b){b.onclick=function(){save({flow:b.getAttribute('data-f'),period:'Yes'})}});
      [].forEach.call(el.querySelectorAll('[data-start]'),function(b){b.onclick=function(){save({period:'Yes'},'Logged ✓ Day 1. Your predictions have updated.')}});
      [].forEach.call(el.querySelectorAll('[data-off]'),function(b){b.onclick=function(){mpfAsk('Turn off period tracking? The period question and My cycle will be hidden. You can turn it back on in About me.',{yes:'Turn off'},function(){if(window.__setNoPeriod)window.__setNoPeriod(true,true)})}});
      [].forEach.call(el.querySelectorAll('[data-g]'),function(b){b.onclick=function(){guide(b.getAttribute('data-g'))}})}
    function guide(k){var g=G[k],m=document.createElement('div');m.className='cy-modal';
      m.innerHTML='<div class="cy-sheet" role="dialog" aria-modal="true"><button type="button" class="cy-x" aria-label="Close">✕</button><div class="cy-gi"><i class="ti ti-'+g.i+'"></i></div><h3>'+esc(g.t)+'</h3>'+g.b.map(function(s){return '<h4>'+esc(s[0])+'</h4><p>'+esc(s[1])+'</p>'}).join('')+'<p class="cy-sig">Maria x</p><p class="cy-note">This guide is general information, not medical advice. If your periods are very painful, very heavy, irregular, or you\'re worried about anything, please speak to your GP.</p></div>';
      document.body.appendChild(m);document.body.style.overflow='hidden';var close=function(){m.remove();document.body.style.overflow=''};m.onclick=function(e){if(e.target===m||e.target.closest('.cy-x'))close()}}
    window.addEventListener('mpf-workout-saved',function(){if(!o.demo)setTimeout(load,700)});
    load();return {refresh:load}}
  window.MPFCycle={Mount:Mount,guides:G};
})();
/* share the cycle guides with My guides in More (binge eating is for everyone) */
(function reg(){if(!window.MPFGuides||!MPFGuides.add)return setTimeout(reg,300);var S={hormones:'Why we feel irrational, and my mum\'s advice',training:'What to do in each phase',eating:'Hunger, carbs and the scale',cravings:'Why they happen and what helps',binge:'What helps when it happens'};
  try{var GG=window.__MPFCycleG;if(!GG)return;Object.keys(GG).forEach(function(k){var g=GG[k];MPFGuides.add(k,{i:g.i,t:g.t,s:S[k]||'',cyc:k!=='binge',b:g.b})});if(window.__gdDraw)window.__gdDraw()}catch(e){}})();
