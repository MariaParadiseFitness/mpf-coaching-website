/* MPF weight trend chart. MPFChart(el, weights[{date:'YYYY-MM-DD',kg}], opts) */
(function(){
  function day(s){return Date.parse(s+'T00:00:00Z')}
  function fmt(t){return new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})}
  function avg7(pts){
    return pts.map(function(p){
      var from=p.t-6*864e5,win=pts.filter(function(q){return q.t>=from&&q.t<=p.t});
      return {t:p.t,v:win.reduce(function(a,q){return a+q.kg},0)/win.length};
    });
  }
  function sign(n){return (n>0?'+':n<0?'−':'')+Math.abs(n).toFixed(1)}
  window.MPFChart=function(el,weights,opts){
    opts=opts||{};
    var all=(weights||[]).map(function(w){return {t:day(w.date),kg:+w.kg}}).filter(function(p){return !isNaN(p.t)&&p.kg>0}).sort(function(a,b){return a.t-b.t});
    var range=opts.range||'12';
    function draw(){
      if(all.length<2){el.innerHTML='<div class="wc-empty">'+(opts.empty||'Your graph appears once you have logged a few morning weigh-ins in your Daily Tracker.')+'</div>';return}
      var last=all[all.length-1].t,from=range==='all'?all[0].t:last-(+range*7-1)*864e5;
      var pts=all.filter(function(p){return p.t>=from});if(pts.length<2)pts=all.slice(-2);
      var tr=avg7(all).filter(function(p){return p.t>=pts[0].t});
      var W=640,H=260,L=44,R=12,T=14,B=30;
      var ys=pts.map(function(p){return p.kg}).concat(tr.map(function(p){return p.v}));
      var lo=Math.min.apply(0,ys),hi=Math.max.apply(0,ys),pad=Math.max(.4,(hi-lo)*.12);lo-=pad;hi+=pad;
      var t0=pts[0].t,t1=Math.max(last,t0+864e5);
      function X(t){return L+(t-t0)/(t1-t0)*(W-L-R)}
      function Y(v){return T+(hi-v)/(hi-lo)*(H-T-B)}
      var g='';
      for(var i=0;i<=4;i++){var v=lo+(hi-lo)*i/4,y=Y(v);g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="rgba(201,166,75,.12)"/><text x="'+(L-8)+'" y="'+(y+4)+'" text-anchor="end" font-size="11" fill="#8f8466">'+v.toFixed(1)+'</text>'}
      var n=Math.min(5,pts.length);for(var j=0;j<n;j++){var tt=t0+(t1-t0)*j/(n-1||1);g+='<text x="'+X(tt)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="#8f8466">'+fmt(tt)+'</text>'}
      var dots=pts.map(function(p){return '<circle cx="'+X(p.t).toFixed(1)+'" cy="'+Y(p.kg).toFixed(1)+'" r="3" fill="#6b5f43"><title>'+fmt(p.t)+': '+p.kg.toFixed(1)+' kg</title></circle>'}).join('');
      var line=tr.map(function(p,k){return (k?'L':'M')+X(p.t).toFixed(1)+' '+Y(p.v).toFixed(1)}).join(' ');
      var endT=tr[tr.length-1];
      var svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Weight trend chart" style="width:100%;height:auto;display:block"><defs><linearGradient id="wcg" x1="0" x2="1"><stop offset="0" stop-color="#9C7A2C"/><stop offset=".5" stop-color="#C9A64B"/><stop offset="1" stop-color="#E8D79A"/></linearGradient></defs>'+g+dots+'<path d="'+line+'" fill="none" stroke="url(#wcg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+X(endT.t)+'" cy="'+Y(endT.v)+'" r="5" fill="#E4CF8A" stroke="#0e0e0e" stroke-width="2"/></svg>';
      var trAll=avg7(all),now=trAll[trAll.length-1].v,start=all[0].kg;
      var wkAgo=trAll.filter(function(p){return p.t<=last-7*864e5}).pop();
      var wk=wkAgo?now-wkAgo.v:null;
      var stats='<div class="wc-stats"><div><small>Trend now</small><b>'+now.toFixed(1)+' kg</b></div><div><small>Since start</small><b>'+sign(now-start)+' kg</b></div><div><small>Last 7 days</small><b>'+(wk===null?'–':sign(wk)+' kg')+'</b></div></div>';
      var btns='<div class="wc-range">'+[['4','4 weeks'],['12','12 weeks'],['all','All']].map(function(b){return '<button type="button" data-r="'+b[0]+'"'+(b[0]===range?' class="on"':'')+'>'+b[1]+'</button>'}).join('')+'</div>';
      el.innerHTML=stats+btns+svg+'<div class="wc-key"><span class="k1"></span>7-day average (your real trend) <span class="k2"></span>Daily weigh-ins</div>';
      [].forEach.call(el.querySelectorAll('.wc-range button'),function(b){b.onclick=function(){range=b.getAttribute('data-r');draw()}});
    }
    draw();
  };
  window.MPFDemoWeights=function(start,weeks){
    var out=[],t=Date.now()-weeks*7*864e5,kg=start;
    for(var i=0;i<weeks*7;i++){kg-=0.055+Math.sin(i/9)*0.02;var noise=(Math.sin(i*2.3)+Math.cos(i*1.7))*0.35+(i%7===1?0.5:0);out.push({date:new Date(t+i*864e5).toISOString().slice(0,10),kg:+(kg+noise).toFixed(1)})}
    return out;
  };
})();
