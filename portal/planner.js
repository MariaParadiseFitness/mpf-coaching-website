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
    function draw(){
      var t=today(),h='<div class="pl-top"><button type="button" class="pl-nav" data-w="-7" aria-label="Previous week">‹</button><div><b>'+(wk===monday(t)?'This week':wk===add(monday(t),7)?'Next week':'Week of '+fmt(wk))+'</b><small>'+fmt(wk)+' to '+fmt(add(wk,6))+'</small></div><button type="button" class="pl-nav" data-w="7" aria-label="Next week">›</button></div>';
      h+='<button type="button" class="pl-add" data-a="new">＋ Add to my plan</button><p class="ci-note" id="plOk" style="margin:-4px 0 10px;color:#e8c872"></p><div id="plForm"></div>';
      var any=false;
      for(var i=0;i<7;i++){var d=add(wk,i),list=items.filter(function(x){return occurs(x,d)}).sort(function(a,b){return a.time<b.time?-1:1});if(list.length)any=true;
        h+='<div class="pl-day'+(d===t?' today':'')+(d<t?' past':'')+'"><div class="pl-dh"><b>'+DN[i]+'</b><span>'+fmt(d)+(d===t?' · Today':'')+'</span></div>'+(list.length?list.map(function(x){var ty=TM[x.type];return '<button type="button" class="pl-it t-'+x.type+'" data-id="'+esc(x.id)+'"><i>'+ty[1]+'</i><span><b>'+esc(x.title)+'</b><small>'+x.time+' to '+endT(x.time,x.dur)+(x.days&&x.days.length?' · repeats':'')+'</small></span></button>'}).join(''):'<div class="pl-free">Nothing planned</div>')+'</div>'}
      if(!any&&!items.length)h+='<p class="ci-note">Plan your training, cardio, meal prep and anything else. Then add it all to your Google Calendar below.</p>';
      h+='<div class="pl-cal"><b>📲 Put my plan in Google Calendar</b>'+(feed?'<p>Your plan is ready to sync. Tap the button, then <b>Add</b> in Google Calendar. Anything you change here updates in your calendar automatically (Google can take a few hours to refresh).</p><div class="pl-cb"><a class="btn" href="https://calendar.google.com/calendar/r?cid='+encodeURIComponent(feed.replace(/^https:/,'webcal:'))+'" target="_blank" rel="noopener">Add to Google Calendar</a><button type="button" class="btn g" data-a="copy">Copy link</button></div><details class="pl-more"><summary>Other calendars, or not working?</summary><p>On a computer, open Google Calendar, click <b>+</b> next to "Other calendars", choose <b>From URL</b> and paste your link. On iPhone you can also open the link to add it to Apple Calendar.</p><p class="pl-url">'+esc(feed)+'</p><p>Keep this link to yourself, it shows your plan. <button type="button" class="lb-link" data-a="reset">Make a new link</button> · <button type="button" class="lb-link" data-a="off">Turn off sync</button></p></details>':'<p>Get everything you plan here showing in your own Google Calendar, kept up to date automatically.</p><button type="button" class="btn" data-a="on">Turn on calendar sync</button>')+'<span class="lg-msg" id="plMsg"></span></div>';
      el.innerHTML=h;bind();if(edit)form(edit);
    }
    function bind(){
      [].forEach.call(el.querySelectorAll('[data-w]'),function(b){b.onclick=function(){wk=add(wk,+b.getAttribute('data-w'));edit=null;draw()}});
      [].forEach.call(el.querySelectorAll('.pl-it'),function(b){b.onclick=function(){var x=items.filter(function(i){return i.id===b.getAttribute('data-id')})[0];if(x){edit=JSON.parse(JSON.stringify(x));form(edit);$f().scrollIntoView({block:'center',behavior:'smooth'})}}});
      var a=function(n,f){var b=el.querySelector('[data-a="'+n+'"]');if(b)b.onclick=f};
      a('new',function(){var d=wk===monday(today())?today():wk;edit={id:'',type:'training',title:'',date:d,time:'07:00',dur:60,days:[],until:'',notes:''};form(edit)});
      var msg=function(t){var m=el.querySelector('#plMsg');if(m)m.textContent=t};
      a('on',function(){msg('Setting up…');save({feed:'on'}).then(draw).catch(function(){msg('Not done. Try again.')})});
      a('reset',function(){if(!confirm('Make a new link? The old one stops working, so you\'ll need to add the new one to your calendar again.'))return;save({feed:'reset'}).then(draw)});
      a('off',function(){if(!confirm('Turn off calendar sync? Your plan stays here but stops showing in your calendar.'))return;save({feed:'off'}).then(draw)});
      a('copy',function(){try{navigator.clipboard.writeText(feed).then(function(){msg('✓ Link copied')})}catch(e){prompt('Copy your link:',feed)}});
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
      var del=f.querySelector('[data-f=del]');if(del)del.onclick=function(){if(!confirm('Delete '+x.title+(x.days.length?' (every week)':'')+'?'))return;items=items.filter(function(i){return i.id!==x.id});save().then(function(){edit=null;draw()}).catch(function(){f.querySelector('#plFm').textContent='Not deleted. Try again.'})};
      f.querySelector('[data-f=save]').onclick=function(){keep();var m=f.querySelector('#plFm');if(!x.title.trim()){m.textContent='Add a name first.';f.querySelector('#plT').focus();return}
        if(!x.id)x.id=Math.random().toString(36).slice(2,10);items=items.filter(function(i){return i.id!==x.id}).concat([x]);m.textContent='Saving…';
        save().then(function(){edit=null;var f=x.date;if(x.days.length){for(var i=0;i<7;i++){if(occurs(x,add(x.date,i))){f=add(x.date,i);break}}}if(f<wk||f>add(wk,6))wk=monday(f);draw();var m=el.querySelector('#plOk');if(m)m.textContent='✓ Saved. First one: '+fmt(f,{weekday:'short',day:'numeric',month:'short'})+(x.time?' at '+x.time:'');setTimeout(function(){if(m)m.textContent=''},6000)}).catch(function(){m.textContent='Not saved. Check your signal and try again.'})};
    }
    load();
    return {setWorkouts:function(w){workouts=w||[];if(edit)form(edit)}};
  }
  window.MPFPlanner={Mount:Mount};
})();
