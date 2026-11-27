/* MPF in-app pop-ups: replaces the browser's white confirm / alert / prompt boxes with on-brand ones. */
(function(){
  var css='.mpfa{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;animation:mpfaF .15s ease}'+
    '.mpfa-c{background:#141210;border:1px solid #c9a64b;border-bottom:0;border-radius:18px 18px 0 0;width:100%;max-width:480px;padding:18px 16px calc(18px + env(safe-area-inset-bottom));box-sizing:border-box;animation:mpfaU .2s ease}'+
    '.mpfa-c p{margin:0 0 14px;color:#f2eee6;font-size:15px;line-height:1.5;white-space:pre-line}'+
    '.mpfa-c input{width:100%;box-sizing:border-box;background:#0e0e0e;color:#fff;border:1px solid rgba(201,166,75,.4);border-radius:10px;padding:11px 12px;font:inherit;font-size:16px;margin:0 0 14px}'+
    '.mpfa-b{display:flex;gap:8px}.mpfa-b button{flex:1;font:inherit;font-weight:700;font-size:14px;border-radius:24px;padding:12px;cursor:pointer}'+
    '.mpfa-no{background:transparent;border:1px solid #2f2b24;color:#cfc8b8}.mpfa-yes{background:linear-gradient(120deg,#9C7A2C 0%,#C9A64B 45%,#E8D79A 100%);border:0;color:#111}.mpfa-yes.red{background:#c0392b;color:#fff}'+
    '.mpft{position:fixed;left:50%;bottom:calc(90px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:3001;background:#141210;border:1px solid #c9a64b;color:#f2eee6;border-radius:24px;padding:10px 16px;font-size:14px;max-width:calc(100vw - 32px);box-shadow:0 8px 24px rgba(0,0,0,.5);animation:mpfaF .2s ease}'+
    '@keyframes mpfaF{from{opacity:0}}@keyframes mpfaU{from{transform:translateY(30px)}}';
  var st=document.createElement('style');st.textContent=css;(document.head||document.documentElement).appendChild(st);
  function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function sheet(html,wire){var m=document.createElement('div');m.className='mpfa';m.innerHTML='<div class="mpfa-c">'+html+'</div>';document.body.appendChild(m);
    var close=function(){m.remove()};m.addEventListener('click',function(e){if(e.target===m)close()});wire(m,close);return m}
  // ask("Delete this?", {yes:'Delete', red:true}, function(){ ...do it... }, function(){ ...cancelled... })
  window.mpfAsk=function(msg,o,yes,no){o=o||{};sheet('<p>'+esc(msg)+'</p><div class="mpfa-b"><button type="button" class="mpfa-no">'+esc(o.no||'Cancel')+'</button><button type="button" class="mpfa-yes'+(o.red?' red':'')+'">'+esc(o.yes||'Yes')+'</button></div>',function(m,close){
    m.querySelector('.mpfa-no').onclick=function(){close();if(no)no()};m.querySelector('.mpfa-yes').onclick=function(){close();if(yes)yes()};m.addEventListener('click',function(e){if(e.target===m&&no)no()})})};
  // ask for a value: mpfInput("Rest in seconds", "90", function(v){...}, {type:'number'})
  window.mpfInput=function(msg,val,done,o){o=o||{};sheet('<p>'+esc(msg)+'</p><input type="'+(o.type||'text')+'" inputmode="'+(o.type==='number'?'numeric':'text')+'" value="'+esc(val)+'"><div class="mpfa-b"><button type="button" class="mpfa-no">Cancel</button><button type="button" class="mpfa-yes">'+esc(o.yes||'Save')+'</button></div>',function(m,close){
    var i=m.querySelector('input');setTimeout(function(){i.focus();i.select()},50);var ok=function(){close();done(i.value)};
    m.querySelector('.mpfa-no').onclick=close;m.querySelector('.mpfa-yes').onclick=ok;i.onkeydown=function(e){if(e.key==='Enter')ok()}})};
  // small message that fades away by itself
  var tt=null;window.mpfToast=function(msg,ms){var old=document.querySelector('.mpft');if(old)old.remove();clearTimeout(tt);var t=document.createElement('div');t.className='mpft';t.textContent=msg;document.body.appendChild(t);tt=setTimeout(function(){t.remove()},ms||3200)};
  // copy text, with a toast instead of a box
  window.mpfCopy=function(text,okMsg){var done=function(){mpfToast(okMsg||'Copied ✓')};try{navigator.clipboard.writeText(text).then(done,function(){fallback()})}catch(e){fallback()}
    function fallback(){var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done()}catch(e){mpfToast('Press and hold to copy: '+text,8000)}ta.remove()}};

  // confetti burst in MPF colours (gold, cream, white, black). mpfConfetti()
  window.mpfConfetti=function(){try{if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    var c=document.createElement('canvas'),x=c.getContext('2d'),W=c.width=innerWidth*devicePixelRatio,H=c.height=innerHeight*devicePixelRatio;
    c.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4000';document.body.appendChild(c);
    var col=['#C9A64B','#E8D79A','#9C7A2C','#FFFFFF','#F5E6B8','#1a1a1a'],P=[],n=160,dpr=devicePixelRatio;
    for(var i=0;i<n;i++){var a=Math.random()*Math.PI*2,v=(6+Math.random()*9)*dpr;P.push({x:W/2+(Math.random()-.5)*W*.3,y:H*.38,vx:Math.cos(a)*v,vy:Math.sin(a)*v-8*dpr,s:(5+Math.random()*7)*dpr,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:col[i%col.length],sh:Math.random()<.5})}
    var t0=performance.now();(function f(t){var dt=Math.min(32,t-t0)/16;t0=t;x.clearRect(0,0,W,H);var alive=0;
      P.forEach(function(p){p.vy+=.35*dpr*dt;p.vx*=.99;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.vr*dt;if(p.y<H+40){alive++;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;if(p.sh)x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);else{x.beginPath();x.arc(0,0,p.s/3,0,7);x.fill()}x.restore()}});
      if(alive)requestAnimationFrame(f);else c.remove()})(t0);setTimeout(function(){c.remove()},6000)}catch(e){}};
})();
