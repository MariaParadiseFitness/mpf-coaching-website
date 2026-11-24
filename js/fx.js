/* MPF site motion: scroll reveals, count-ups, button shimmer, hover lift, hero zoom, results ticker.
   Everything is off for people who ask their phone for reduced motion. */
(function(){
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css=''+
  '.fx .fx-r{opacity:0;transform:translateY(26px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.2,1)}'+
  '.fx .fx-r.fx-in{opacity:1;transform:none}'+
  '.btn:not(.ghost){position:relative;overflow:hidden}'+
  '.btn:not(.ghost):after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);animation:fxShine 4.5s ease-in-out infinite;pointer-events:none}'+
  '@keyframes fxShine{0%,70%{left:-60%}100%{left:130%}}'+
  '.card,.guide,.tier,.lk,.g-lockrow a,.appf-g,.step,.pr-tab,.ag-steps div{transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}'+
  '.card:hover,.guide:hover,.tier:hover,.lk:hover,.g-lockrow a:hover,.appf-g:hover,.pr-tab:hover,.ag-steps div:hover{transform:translateY(-5px);box-shadow:0 14px 34px rgba(201,166,75,.22);border-color:#C9A64B}'+
  '.hero-img{animation:fxZoom 1.8s cubic-bezier(.2,.7,.2,1) both}@keyframes fxZoom{from{transform:scale(1.08);opacity:.4}to{transform:scale(1);opacity:1}}'+
  '.fx-tick{background:#0c0b0a;border-top:1px solid rgba(201,166,75,.3);border-bottom:1px solid rgba(201,166,75,.3);overflow:hidden;white-space:nowrap;padding:14px 0;position:relative;z-index:3}'+
  '.fx-tick .fx-tr{display:inline-flex;gap:46px;padding-left:46px;animation:fxTick 38s linear infinite}'+
  '.fx-tick span{color:#E8C872;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:13px}.fx-tick span:before{content:"★";color:#C9A64B;margin-right:12px}'+
  '@keyframes fxTick{to{transform:translateX(-50%)}}'+
  '@media(prefers-reduced-motion:reduce){.btn:not(.ghost):after,.hero-img,.fx-tick .fx-tr{animation:none}.fx .fx-r{opacity:1;transform:none}}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  function ready(f){if(document.readyState!=='loading')f();else document.addEventListener('DOMContentLoaded',f)}
  ready(function(){
    // results ticker under the homepage hero, using the real results already on the page
    var hero=document.getElementById('top'),res=[].map.call(document.querySelectorAll('.res'),function(x){return x.textContent.trim()}).filter(Boolean);
    if(hero&&res.length){var items=res.concat(['Stronger than ever','No starting over']);var row=items.map(function(t){return '<span>'+t.replace(/</g,'&lt;')+'</span>'}).join('');
      var tk=document.createElement('div');tk.className='fx-tick';tk.setAttribute('aria-hidden','true');tk.innerHTML='<div class="fx-tr">'+row+row+'</div>';hero.parentNode.insertBefore(tk,hero.nextSibling)}
    if(reduce||!('IntersectionObserver' in window))return;
    document.documentElement.classList.add('fx');
    var sel='main h2, section h2, section .eyebrow, .card, .guide, .tier, .step, .lk, .g-lockrow a, .appf-g, .as-list li, .ag-row>div, .pr-tab, .ag-steps div, .need-c, .quiz-band, .res';
    var els=[].slice.call(document.querySelectorAll(sel)).filter(function(e){return !e.closest('.hero,#top,.tb,.topbar,nav,.pz')});
    els.forEach(function(e,i){e.classList.add('fx-r');e.style.transitionDelay=((i%4)*70)+'ms'});
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(!en.isIntersecting)return;var e=en.target;e.classList.add('fx-in');io.unobserve(e);if(e.classList.contains('res'))count(e)})},{rootMargin:'0px 0px -8% 0px',threshold:.08});
    els.forEach(function(e){io.observe(e)});
    function count(e){var t=e.textContent,m=t.match(/(\d+(?:\.\d+)?)/);if(!m)return;var end=parseFloat(m[1]),dp=(m[1].split('.')[1]||'').length,t0=null,pre=t.slice(0,m.index),post=t.slice(m.index+m[1].length);
      function step(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/1200),v=end*(1-Math.pow(1-p,3));e.textContent=pre+v.toFixed(dp)+post;if(p<1)requestAnimationFrame(step);else e.textContent=t}
      requestAnimationFrame(step)}
  });
})();
