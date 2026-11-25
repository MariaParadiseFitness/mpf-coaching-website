/* Weekly summary card (check-in page) and personal best wall (progress page) */
(function(){
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function num(v){var n=parseFloat(String(v==null?'':v).replace(/,/g,''));return isFinite(n)?n:null}
  function kcal(d){var c=num(d.cals);if(c!==null)return c;if(d.carbs||d.protein||d.fat)return 4*(num(d.carbs)||0)+4*(num(d.protein)||0)+9*(num(d.fat)||0);return null}
  function hrs(v){if(!v)return null;var m=String(v).match(/^(\d{1,2})[:.h ]?(\d{0,2})/);if(!m)return num(v);var h=+m[1],mm=m[2]?+m[2]:0;return String(v).indexOf('.')>-1&&!/:/.test(v)?num(v):h+mm/60}
  function nice(d){try{return new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}catch(e){return d}}
  var DAY=864e5,T=function(d){return Date.parse(d+'T00:00:00Z')},F=function(t){return new Date(t).toISOString().slice(0,10)};
  function avg(a){return a.length?a.reduce(function(x,y){return x+y},0)/a.length:null}
  function fm(n,dp){return n==null?'–':(dp?(+n).toFixed(dp):Math.round(n).toLocaleString('en-GB'))}

  function Week(el,o){
    o=o||{};
    function draw(){
      var days=(o.getDays&&o.getDays())||{},t=o.getTargets&&o.getTargets()||{},sessions=o.getSessions&&o.getSessions()||[],today=o.today;
      var D=function(i){return F(T(today)-i*DAY)},cur=[],prev=[];for(var i=0;i<7;i++){cur.push(D(i));prev.push(D(i+7))}
      var pick=function(list,f){return list.map(function(d){return days[d]?f(days[d]):null}).filter(function(v){return v!=null})};
      var logged=cur.filter(function(d){var x=days[d];return x&&Object.keys(x).some(function(k){return k[0]!=='_'&&x[k]!==''})}).length;
      if(!logged&&!sessions.length){el.hidden=true;return}
      var w=avg(pick(cur,function(d){return num(d.weight)})),wp=avg(pick(prev,function(d){return num(d.weight)}));
      var st=avg(pick(cur,function(d){return num(d.steps)})),ca=avg(pick(cur,kcal)),sl=avg(pick(cur,function(d){return hrs(d.sleep)}));
      var tp=num(t.protein),ts=num(t.steps),tc=num(t.cals);
      var pDays=tp?pick(cur,function(d){var p=num(d.protein);return p==null?null:p>=tp*0.95?1:0}):[],pHit=pDays.filter(Boolean).length;
      var wk=sessions.filter(function(s){return s.date>=cur[6]&&s.date<=cur[0]}).length,trained=pick(cur,function(d){return d.trained==='Yes'?1:null}).length,tr=Math.max(wk,trained);
      var ch=w!=null&&wp!=null?+(w-wp).toFixed(1):null;
      var tile=function(lbl,val,sub,good){return '<div class="wk-t'+(good?' good':'')+'"><small>'+lbl+'</small><b>'+val+'</b>'+(sub?'<span>'+sub+'</span>':'')+'</div>'};
      var h='<div class="wk-h"><b>📊 Your week</b><span>'+nice(cur[6])+' to '+nice(cur[0])+'</span></div><div class="wk-g">'+
        tile('Days logged',logged+' / 7','',logged>=6)+
        tile('Avg weight',w!=null?fm(w,1)+' kg':'–',ch!=null?(ch>0?'+':'')+ch+' kg vs last week':'')+
        tile('Workouts',String(tr),'',tr>=3)+
        tile('Avg steps',fm(st),ts?'target '+fm(ts):'',ts&&st!=null&&st>=ts*0.95)+
        tile('Avg calories',fm(ca),tc?'target '+fm(tc):'',tc&&ca!=null&&Math.abs(ca-tc)<=tc*0.07)+
        (tp?tile('Protein hit',pHit+' / 7 days','target '+fm(tp)+'g',pHit>=5):'')+
        (function(){var ct=window.MPFLog&&MPFLog.cardioT?MPFLog.cardioT(t.cardio):null;if(!ct)return '';var done=pick(cur,function(d){var c=num(d.cardio);return c&&c>=ct.mins*0.95?1:null}).length;return ct.perWeek?tile('Cardio',done+' / '+ct.perWeek+' sessions',ct.mins+' mins each',done>=ct.perWeek):tile('Cardio',done+' / 7 days',ct.mins+' mins a day',done>=6)})()+
        (function(){var ad=pick(cur,function(d){return d.alcohol==='Yes'?1:d.alcohol==='No'?0:null});if(!ad.length)return '';var dd=ad.filter(Boolean).length,dr=pick(cur,function(d){return d.alcohol==='Yes'?(num(d.drinks)||0):null}).reduce(function(a,b){return a+b},0);return tile('Alcohol',dd?dr+' drink'+(dr===1?'':'s'):'None',dd?'on '+dd+' day'+(dd===1?'':'s'):'alcohol-free week',!dd)})()+
        (function(){var mm=pick(cur,function(d){return num(d.mindful)}).reduce(function(a,b){return a+b},0);return mm?tile('Mindful',Math.round(mm)+' mins','breathing and calm',mm>=10):''})()+
        tile('Avg sleep',sl!=null?Math.floor(sl)+'h '+String(Math.round((sl%1)*60)).padStart(2,'0')+'m':'–','',sl!=null&&sl>=7)+
        '</div>';
      var wins=[];if(logged>=6)wins.push('logged nearly every day');if(tp&&pHit>=5)wins.push('hit your protein '+pHit+' days');if(tr>=3)wins.push('trained '+tr+' times');if(ts&&st!=null&&st>=ts*0.95)wins.push('smashed your steps');
      var fix=[];if(logged<5)fix.push('log every day, even the bad ones');if(tp&&pDays.length&&pHit<4)fix.push('get your protein in first at each meal');if(ts&&st!=null&&st<ts*0.8)fix.push('add a 15 minute walk to get your steps up');
      h+='<p class="wk-n">'+(wins.length?'🔥 This week you '+wins.join(', ')+'. ':'')+(fix.length?'Next week: '+fix[0]+'.':wins.length?'Keep it going!':'Keep logging and this card fills in.')+'</p>';
      el.hidden=false;el.innerHTML=h;
    }
    draw();return {refresh:draw};
  }

  function PBs(el,o){
    o=o||{};var all=false;
    function e1(s){var kg=num(s.kg),r=num(s.reps);return kg&&r?kg*(1+Math.min(r,30)/30):0}
    function draw(){
      var sessions=(o.getSessions&&o.getSessions())||[],B={};
      sessions.slice().sort(function(a,b){return a.date<b.date?-1:1}).forEach(function(s){(s.exercises||[]).forEach(function(e){var k=String(e.name||'').trim().toLowerCase();if(!k)return;(e.sets||[]).forEach(function(x){var v=e1(x);if(!v)return;var b=B[k];if(!b||v>b.v+0.01){B[k]={name:e.name,v:v,kg:x.kg,reps:x.reps,date:s.date,first:b?b.first:{kg:x.kg,reps:x.reps,v:v},n:(b?b.n:0)+1}}})})});
      var L=Object.keys(B).map(function(k){return B[k]}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:b.v-a.v});
      if(!L.length){el.innerHTML='<p class="ci-note">Log your workouts in the Training tab and your personal bests show up here. 🏆</p>';return}
      var show=all?L:L.slice(0,12);
      el.innerHTML='<div class="pb-g">'+show.map(function(p){var up=p.first&&p.first.v&&p.v>p.first.v?Math.round((p.v/p.first.v-1)*100):0;return '<div class="pb-c"><small>'+esc(p.name)+'</small><b>'+esc(p.kg)+'kg × '+esc(p.reps)+'</b><span>'+nice(p.date)+(up?' · <em>+'+up+'% stronger</em>':'')+'</span></div>'}).join('')+'</div>'+(L.length>12?'<button type="button" class="btn g" id="pbMore" style="margin-top:10px">'+(all?'Show fewer':'Show all '+L.length)+'</button>':'');
      var m=el.querySelector('#pbMore');if(m)m.onclick=function(){all=!all;draw()};
    }
    draw();return {refresh:draw};
  }
  window.MPFWeek={Week:Week,PBs:PBs};
})();
