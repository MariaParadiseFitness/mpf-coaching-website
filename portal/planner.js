/* MPF planner: clients plan their week (training, cardio, meal prep...) and sync it to Google Calendar. */
(function(){
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var TYPES=[['training','🏋️','Training'],['cardio','🏃','Cardio'],['mealprep','🥗','Meal prep'],['walk','🚶','Walk / steps'],['stretch','🧘','Stretch / mobility'],['sleep','😴','Bedtime'],['checkin','✅','Check-in'],['other','⭐','Other']];
  var TM={};TYPES.forEach(function(t){TM[t[0]]=t});
  var DN=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  var iso=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  var parse=function(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2],12)};
  var dow=function(s){return (parse(s).getDay()+6)%7};
  var add=function(s,n){var d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
  var monday=function(s){return add(s,-dow(s))};
  var today=function(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(e){return iso(new Date())}};
  var fmt=function(s,o){return parse(s).toLocaleDateString('en-GB',o||{day:'numeric',month:'short'})};
  var endT=function(t,m){var p=t.split(':'),x=(+p[0])*60+(+p[1])+m;x=x%1440;return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0')};
  function occurs(x,d){if(x.days&&x.days.length){if(d<x.date)return false;if(x.until&&d>x.until)return false;return x.days.indexOf(dow(d))>-1}return x.date===d}
  function gcalLink(x,d){var s=(d||x.date).replace(/-/g,'')+'T'+x.time.replace(':','')+'00',e=(d||x.date).replace(/-/g,'')+'T'+endT(x.time,x.dur).replace(':','')+'00';
    var u='https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(TM[x.type][1]+' '+x.title)+'&dates='+s+'/'+e+'&ctz=Europe/London'+(x.notes?'&details='+encodeURIComponent(x.notes):'');
    if(x.days&&x.days.length)u+='&recur='+encodeURIComponent('RRULE:FREQ=WEEKLY;BYDAY='+x.days.map(function(n){return ['MO','TU','WE','TH','FR','SA','SU'][n]}).join(',')+(x.until?';UNTIL='+x.until.replace(/-/g,'')+'T235959Z':''));return u}

  function Mount(el,o){
    o=o||{};var demo=!!o.demo,items=[],feed='',wk=monday(today()),edit=null,workouts=o.workouts||[];
    function demoItems(){var m=monday(today());return [{id:'d1',type:'training',title:'Lower body',date:m,time:'07:00',dur:60,days:[0,3],until:'',notes:''},{id:'d2',type:'training',title:'Upper body',date:m,time:'07:00',dur:60,days:[1,4],until:'',notes:''},{id:'d3',type:'cardio',title:'30 min incline walk',date:m,time:'18:30',dur:30,days:[2,5],until:'',notes:''},{id:'d4',type:'mealprep',title:'Batch cook lunches',date:add(m,6),time:'16:00',dur:90,days:[6],until:'',notes:'Chicken, rice, veg x4'},{id:'d5',type:'walk',title:'10k steps',date:m,time:'12:30',dur:45,days:[0,1,2,3,4],until:'',notes:''},{id:'d6',type:'checkin',title:'Weekly check-in',date:add(m,6),time:'09:00',dur:15,days:[6],until:'',notes:''}]}
    function api(b){if(demo)return Promise.resolve({items:b?b.items:(items.length?items:demoItems()),feed:b&&b.feed==='on'?'https://mpfcoaching.co.uk/cal/example.ics':feed});return fetch('/portal/api/schedule',b?{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(b)}:{credentials:'same-origin',cache:'no-store'}).then(function(r){if(!r.ok)throw r.status;return r.json()})}
    function load(){el.innerHTML='<p class="ci-note">Loading your week…</p>';api().then(function(j){items=j.items||[];feed=j.feed||'';draw()}).catch(function(){draw()})}
    function save(extra){var b=Object.assign({items:items},extra||{});return api(b).then(function(j){items=j.items||items;feed=j.feed||'';return j})}
    var view='week',mo=today().slice(0,8)+'01',sel=today(),sess={},MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
    try{if(localStorage.getItem('mpfPlView')==='month')view='month'}catch(e){}
    var addM=function(s,n){var p=s.split('-'),d=new Date(+p[0],+p[1]-1+n,1,12);return iso(d)};
    function dayList(d){return items.filter(function(x){return occurs(x,d)}).sort(function(a,b){return a.time<b.time?-1:1})}
    function sessOn(d){return sess[d]||[]}
    function itemBtn(x){var ty=TM[x.type];return '<button type="button" class="pl-it t-'+x.type+'" data-id="'+esc(x.id)+'"><i>'+ty[1]+'</i><span><b>'+esc(x.title)+'</b><small>'+x.time+' to '+endT(x.time,x.dur)+(x.days&&x.days.length?' · repeats':'')+'</small></span></button>'}
    var LG={};try{LG=JSON.parse(localStorage.getItem('mpfPlLogged')||'{}')}catch(e){}
    function logBtn(x,d){var k=x.id+'|'+d,done=LG[k];return '<button type="button" class="pl-log'+(done?' done':'')+'" data-log="'+esc(x.id)+'" data-ld="'+d+'" data-lm="'+(+x.dur||30)+'">'+(done?'✓ Logged '+done+' mins of cardio':'🏃 Log this cardio')+'</button>'}
    function sessBtn(t){return '<div class="pl-it t-pt"><i>💪</i><span><b>PT session with Maria</b><small>'+(t?esc(t.replace('–',' to ')):'Booked')+' · PureGym Charlton</small></span></div>'}
    function dayBody(d){var l=dayList(d),ss=sessOn(d);return (ss.length||l.length)?ss.map(sessBtn).join('')+l.map(function(x){return itemBtn(x)+(x.type==='cardio'&&d<=today()?logBtn(x,d):'')}).join(''):'<div class="pl-free">Nothing planned</div>'}
    function toggle(){return '<div class="seg pl-vw"><button type="button" data-v="week" class="'+(view==='week'?'on':'')+'">📋 Week</button><button type="button" data-v="month" class="'+(view==='month'?'on':'')+'">🗓️ Month</button></div>'}
    function drawWeek(t){
      var h='<div class="pl-top"><button type="button" class="pl-nav" data-w="-7" aria-label="Previous week">‹</button><div><b>'+(wk===monday(t)?'This week':wk===add(monday(t),7)?'Next week':'Week of '+fmt(wk))+'</b><small>'+fmt(wk)+' to '+fmt(add(wk,6))+'</small></div><button type="button" class="pl-nav" data-w="7" aria-label="Next week">›</button></div>';
      h+='<button type="button" class="pl-add" data-a="new">＋ Add to my plan</button><p class="ci-note" id="plOk" style="margin:-4px 0 10px;color:#e8c872"></p><div id="plForm"></div>';
      for(var i=0;i<7;i++){var d=add(wk,i),list=dayList(d),ss=sessOn(d);
        var sm=(ss.length||list.length)?ss.map(function(){return '💪 PT session'}).concat(list.map(function(x){return TM[x.type][1]+' '+esc(x.title)})).join(' · '):'Nothing planned',op=d===t||(t<wk||t>add(wk,6))&&i===0;h+='<details class="pl-day'+(d===t?' today':'')+(d<t?' past':'')+'"'+(op?' open':'')+'><summary class="pl-dh"><b>'+DN[i]+'</b><span>'+fmt(d)+(d===t?' · Today':'')+'</span><em class="pl-sum">'+sm+'</em></summary>'+dayBody(d)+'</details>'}
      return h}
    function drawMonth(t){
      var p=mo.split('-'),y=+p[0],m=+p[1]-1,last=iso(new Date(y,m+1,0,12)),start=monday(mo),end=add(monday(last),6);
      var h='<div class="pl-top"><button type="button" class="pl-nav" data-m="-1" aria-label="Previous month">‹</button><div><b>'+MN[m]+' '+y+'</b><small>'+(mo===t.slice(0,8)+'01'?'This month':'Tap a day to see it')+'</small></div><button type="button" class="pl-nav" data-m="1" aria-label="Next month">›</button></div>';
      h+='<div class="pl-mg">'+DN.map(function(n){return '<span class="pl-mh">'+n.charAt(0)+'<i>'+n.slice(1)+'</i></span>'}).join('');
      for(var d=start;d<=end;d=add(d,1)){var l=dayList(d),ss=sessOn(d),dots=ss.map(function(){return '<em class="t-pt"></em>'}).concat(l.map(function(x){return '<em class="t-'+x.type+'"></em>'})),n=dots.length;
        h+='<button type="button" class="pl-mc'+(d.slice(0,7)!==mo.slice(0,7)?' out':'')+(d===t?' today':'')+(d===sel?' sel':'')+(d<t?' past':'')+(ss.length?' pt':'')+'" data-day="'+d+'" aria-label="'+fmt(d,{weekday:'long',day:'numeric',month:'long'})+(n?', '+n+' planned':'')+'"><b>'+(+d.slice(8))+'</b><span class="pl-dots">'+dots.slice(0,4).join('')+(n>4?'<small>+'+(n-4)+'</small>':'')+'</span></button>'}
      h+='</div><div class="pl-key">'+(Object.keys(sess).length?'<span><em class="t-pt"></em>PT session</span>':'')+TYPES.filter(function(ty){return items.some(function(x){return x.type===ty[0]})}).map(function(ty){return '<span><em class="t-'+ty[0]+'"></em>'+ty[2]+'</span>'}).join('')+'</div>';
      h+='<div class="pl-day pl-sel'+(sel===t?' today':'')+'"><div class="pl-dh"><b>'+fmt(sel,{weekday:'long'})+'</b><span>'+fmt(sel,{day:'numeric',month:'long'})+(sel===t?' · Today':'')+'</span></div>'+dayBody(sel)+'<button type="button" class="pl-addday" data-a="new">＋ Add to '+fmt(sel,{weekday:'short',day:'numeric',month:'short'})+'</button></div>';
      h+='<p class="ci-note" id="plOk" style="margin:4px 0 10px;color:#e8c872"></p><div id="plForm"></div>';
      return h}
    function draw(){
      var t=today(),h=toggle()+(view==='month'?drawMonth(t):drawWeek(t));
      if(!items.length&&!Object.keys(sess).length)h+='<p class="ci-note">Plan your training, cardio, meal prep and anything else. Then add it all to your Google Calendar below.</p>';
      h+='<div class="pl-cal"><b>📲 Put my plan in Google Calendar</b>'+(feed?'<p>Your plan is ready to sync. Tap the button, then <b>Add</b> in Google Calendar. Anything you change here updates in your calendar automatically (Google can take a few hours to refresh).</p><div class="pl-cb"><a class="btn" href="https://calendar.google.com/calendar/r?cid='+encodeURIComponent(feed.replace(/^https:/,'webcal:'))+'" target="_blank" rel="noopener">Add to Google Calendar</a><button type="button" class="btn g" data-a="copy">Copy link</button></div><details class="pl-more"><summary>Other calendars, or not working?</summary><p>On a computer, open Google Calendar, click <b>+</b> next to "Other calendars", choose <b>From URL</b> and paste your link. On iPhone you can also open the link to add it to Apple Calendar.</p><p class="pl-url">'+esc(feed)+'</p><p>Keep this link to yourself, it shows your plan. <button type="button" class="lb-link" data-a="reset">Make a new link</button> · <button type="button" class="lb-link" data-a="off">Turn off sync</button></p></details>':'<p>Get everything you plan here showing in your own Google Calendar, kept up to date automatically.</p><button type="button" class="btn" data-a="on">Turn on calendar sync</button>')+'<span class="lg-msg" id="plMsg"></span></div>';
      el.innerHTML=h;bind();if(edit)form(edit);
    }
    function bind(){
      [].forEach.call(el.querySelectorAll('[data-w]'),function(b){b.onclick=function(){wk=add(wk,+b.getAttribute('data-w'));edit=null;draw()}});
      [].forEach.call(el.querySelectorAll('[data-m]'),function(b){b.onclick=function(){mo=addM(mo,+b.getAttribute('data-m'));var t=today();sel=mo===t.slice(0,8)+'01'?t:mo;edit=null;draw()}});
      [].forEach.call(el.querySelectorAll('[data-day]'),function(b){b.onclick=function(){sel=b.getAttribute('data-day');if(sel.slice(0,7)!==mo.slice(0,7))mo=sel.slice(0,8)+'01';edit=null;draw();var s=el.querySelector('.pl-sel');if(s&&s.scrollIntoView)s.scrollIntoView({block:'nearest',behavior:'smooth'})}});
      [].forEach.call(el.querySelectorAll('.pl-vw [data-v]'),function(b){b.onclick=function(){var v=b.getAttribute('data-v');if(v===view)return;if(v==='month'){var t=today();sel=(t>=wk&&t<=add(wk,6))?t:wk;mo=sel.slice(0,8)+'01'}else wk=monday(sel);view=v;try{localStorage.setItem('mpfPlView',v)}catch(e){}edit=null;draw()}});
      [].forEach.call(el.querySelectorAll('.pl-it'),function(b){b.onclick=function(){var x=items.filter(function(i){return i.id===b.getAttribute('data-id')})[0];if(x){edit=JSON.parse(JSON.stringify(x));form(edit);$f().scrollIntoView({block:'center',behavior:'smooth'})}}});
      [].forEach.call(el.querySelectorAll('[data-log]'),function(b){b.onclick=function(){if(b.classList.contains('done')||b.disabled)return;var id=b.getAttribute('data-log'),d=b.getAttribute('data-ld'),plan=+b.getAttribute('data-lm')||30;
        var f=document.createElement('div');f.className='pl-logf';f.innerHTML='<span>How many minutes did you do?</span><div class="pl-lrow"><button type="button" data-st="-5" aria-label="5 minutes less">−</button><input type="number" inputmode="numeric" min="1" max="300" value="'+plan+'"><button type="button" data-st="5" aria-label="5 minutes more">+</button><em>mins</em></div><div class="pl-lrow"><button type="button" class="pl-lgo">✓ Log it</button><button type="button" class="pl-lx">Cancel</button></div>';
        b.replaceWith(f);var inp=f.querySelector('input');inp.focus();inp.select();
        [].forEach.call(f.querySelectorAll('[data-st]'),function(x){x.onclick=function(){inp.value=Math.max(1,Math.min(300,(+inp.value||0)+(+x.getAttribute('data-st'))))}});
        f.querySelector('.pl-lx').onclick=function(){draw()};
        f.querySelector('.pl-lgo').onclick=function(){var mins=Math.round(+inp.value);if(!(mins>0&&mins<=300)){inp.focus();return}var go=f.querySelector('.pl-lgo');
          var mark=function(){LG[id+'|'+d]=mins;try{localStorage.setItem('mpfPlLogged',JSON.stringify(LG))}catch(e){}draw();try{window.dispatchEvent(new Event('mpf-workout-saved'))}catch(e){}};
          if(o&&o.demo){mark();return}go.disabled=true;go.textContent='Logging…';
          fetch('/portal/api/log?from='+d+'&to='+d,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){var day=Object.assign({},(j.days&&j.days[d])||{});delete day._at;day.cardio=String((parseFloat(day.cardio)||0)+mins);
            return fetch('/portal/api/log',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({date:d,data:day})})}).then(function(r){if(!r.ok)throw 0;mark()}).catch(function(){go.disabled=false;go.textContent='Not logged. Try again'})}}});
      var a=function(n,f){var b=el.querySelector('[data-a="'+n+'"]');if(b)b.onclick=f};
      a('new',function(){var d=view==='month'?sel:wk===monday(today())?today():wk;edit={id:'',type:'training',title:'',date:d,time:'07:00',dur:60,days:[],until:'',notes:''};form(edit)});
      var msg=function(t){var m=el.querySelector('#plMsg');if(m)m.textContent=t};
      a('on',function(){msg('Setting up…');save({feed:'on'}).then(draw).catch(function(){msg('Not done. Try again.')})});
      a('reset',function(){mpfAsk('Make a new link? The old one stops working, so you\'ll need to add the new one to your calendar again.',{yes:'New link',red:true},function(){save({feed:'reset'}).then(draw)})});
      a('off',function(){mpfAsk('Turn off calendar sync? Your plan stays here but stops showing in your calendar.',{yes:'Turn off',red:true},function(){save({feed:'off'}).then(draw)})});
      a('copy',function(){mpfCopy(feed,'✓ Link copied')});
    }
    function $f(){return el.querySelector('#plForm')}
    function form(x){
      var f=$f();if(!f)return;
      var wo=workouts.length?'<div class="pl-quick">'+workouts.map(function(w){return '<button type="button" data-q="'+esc(w)+'">'+esc(w)+'</button>'}).join('')+'</div>':'';
      f.innerHTML='<div class="pl-form"><div class="pl-types">'+TYPES.map(function(t){return '<button type="button" data-t="'+t[0]+'" class="'+(x.type===t[0]?'on':'')+'">'+t[1]+' '+t[2]+'</button>'}).join('')+'</div>'+
        (x.type==='training'?wo:'')+
        '<label>What<input id="plT" maxlength="80" placeholder="'+(x.type==='mealprep'?'e.g. Batch cook lunches':x.type==='cardio'?'e.g. 30 min incline walk':'e.g. Upper body')+'" value="'+esc(x.title)+'"></label>'+
        '<div class="pl-row"><label>'+(x.days.length?'Starts':'Date')+'<input type="date" id="plD" value="'+esc(x.date)+'"></label><label>Time<input type="time" id="plTm" value="'+esc(x.time)+'"></label><label>Minutes<input id="plDu" inputmode="numeric" value="'+esc(x.dur)+'"></label></div>'+
        '<label>Repeat every week on</label><div class="pl-days">'+DN.map(function(n,i){return '<button type="button" data-d="'+i+'" class="'+(x.days.indexOf(i)>-1?'on':'')+'">'+n+'</button>'}).join('')+'</div>'+
        (x.days.length?'<label>Repeat until (optional)<input type="date" id="plU" value="'+esc(x.until)+'"></label>':'')+
        '<label>Notes (optional)<input id="plN" maxlength="300" value="'+esc(x.notes)+'"></label>'+
        '<div class="pl-fb">'+(x.id?'<button type="button" class="btn g red" data-f="del">Delete</button><a class="btn g" href="'+esc(gcalLink(x))+'" target="_blank" rel="noopener">Add just this to Google</a>':'')+'<button type="button" class="btn g" data-f="x">Cancel</button><button type="button" class="btn" data-f="save">'+(x.id?'Save changes':'Add to plan')+'</button></div><span class="lg-msg" id="plFm"></span></div>';
      var keep=function(){x.title=f.querySelector('#plT').value;x.date=f.querySelector('#plD').value||x.date;x.time=f.querySelector('#plTm').value||x.time;x.dur=parseInt(f.querySelector('#plDu').value,10)||60;var u=f.querySelector('#plU');x.until=u?u.value:'';x.notes=f.querySelector('#plN').value};
      [].forEach.call(f.querySelectorAll('[data-t]'),function(b){b.onclick=function(){keep();x.type=b.getAttribute('data-t');if(!x.title&&x.type!=='training'&&x.type!=='other')x.title=TM[x.type][2];if(x.type==='sleep'&&x.time==='07:00'){x.time='22:30';x.dur=30}form(x)}});
      [].forEach.call(f.querySelectorAll('[data-q]'),function(b){b.onclick=function(){keep();x.title=b.getAttribute('data-q');form(x)}});
      [].forEach.call(f.querySelectorAll('[data-d]'),function(b){b.onclick=function(){keep();var d=+b.getAttribute('data-d'),i=x.days.indexOf(d);if(i>-1)x.days.splice(i,1);else x.days.push(d);x.days.sort();form(x)}});
      f.querySelector('[data-f=x]').onclick=function(){edit=null;f.innerHTML=''};
      var del=f.querySelector('[data-f=del]');if(del)del.onclick=function(){mpfAsk('Delete '+x.title+(x.days.length?' (every week)':'')+'?',{yes:'Delete',red:true},function(){items=items.filter(function(i){return i.id!==x.id});save().then(function(){edit=null;draw()}).catch(function(){f.querySelector('#plFm').textContent='Not deleted. Try again.'})})};
      f.querySelector('[data-f=save]').onclick=function(){keep();var m=f.querySelector('#plFm');if(!x.title.trim()){m.textContent='Add a name first.';f.querySelector('#plT').focus();return}
        if(!x.id)x.id=Math.random().toString(36).slice(2,10);items=items.filter(function(i){return i.id!==x.id}).concat([x]);m.textContent='Saving…';
        save().then(function(){edit=null;var f=x.date;if(x.days.length){for(var i=0;i<7;i++){if(occurs(x,add(x.date,i))){f=add(x.date,i);break}}}if(f<wk||f>add(wk,6))wk=monday(f);if(view==='month'){sel=f;mo=f.slice(0,8)+'01'}draw();var m=el.querySelector('#plOk');if(m)m.textContent='✓ Saved. First one: '+fmt(f,{weekday:'short',day:'numeric',month:'short'})+(x.time?' at '+x.time:'');setTimeout(function(){if(m)m.textContent=''},6000)}).catch(function(){m.textContent='Not saved. Check your signal and try again.'})};
    }
    load();
    var me={setWorkouts:function(w){workouts=w||[];if(edit)form(edit)},
      setSessions:function(j){sess={};if(j){var T=j.times||{};(j.past||[]).concat(j.upcoming||[]).forEach(function(d){sess[d]=T[d]?String(T[d]).split(', '):['']})}draw()}};
    window.MPFPlanner.current=me;
    if(demo)setTimeout(function(){var m=monday(today());me.setSessions({upcoming:[add(m,2),add(m,9)],past:[add(m,-5)],times:{}})},0);
    return me;
  }
  window.MPFPlanner={Mount:Mount};
})();
