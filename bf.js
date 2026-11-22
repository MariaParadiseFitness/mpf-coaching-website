/* Black Friday pop-up: shows once per visit until the end of Cyber Monday (30 Nov 2026, UK time) */
(function(){
  var END=Date.parse('2026-12-01T00:00:00Z');if(Date.now()>=END)return;
  try{if(sessionStorage.getItem('mpf-bf'))return}catch(e){}
  var css='#bfPop{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);opacity:0;transition:opacity .3s}#bfPop.on{opacity:1}'+
  '#bfPop .bx{position:relative;max-width:420px;width:100%;background:radial-gradient(120% 90% at 50% 0%,#2a2414,#0d0c0a 70%);border:1.5px solid #c9a64b;border-radius:22px;padding:34px 28px 28px;text-align:center;color:#fff;font-family:inherit;box-shadow:0 30px 80px rgba(0,0,0,.6);transform:translateY(14px);transition:transform .3s}#bfPop.on .bx{transform:none}'+
  '#bfPop .tg{display:inline-block;background:linear-gradient(135deg,#e8c872,#b8902f);color:#111;font-weight:700;font-size:12px;letter-spacing:.32em;padding:8px 14px;border-radius:5px}'+
  '#bfPop h3{font-family:"Playfair Display",Georgia,serif;font-size:40px;line-height:1.05;margin:18px 0 8px;color:#fff}#bfPop .pr{font-family:"Playfair Display",Georgia,serif;font-size:34px;color:#e2c46f}#bfPop .pr s{color:#8d8169;font-size:26px;margin-right:10px}'+
  '#bfPop p{color:#dcd2b9;font-size:15px;line-height:1.5;margin:12px 0 0}#bfPop .ch{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:16px 0 22px}#bfPop .ch span{border:1px solid #c9a64b;border-radius:30px;padding:7px 12px;font-size:12.5px;color:#f3e7c4}'+
  '#bfPop .go{display:block;background:linear-gradient(135deg,#e8c872,#b8902f);color:#111;text-decoration:none;font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:13px;padding:16px;border-radius:40px}#bfPop .no{background:none;border:0;color:#9a8d72;font-size:13px;margin-top:12px;cursor:pointer;text-decoration:underline}'+
  '#bfPop .cd{display:flex;align-items:center;justify-content:center;gap:10px;margin:18px auto 0;border:1.5px dashed #c9a64b;border-radius:12px;padding:10px 12px;background:rgba(201,166,75,.08)}#bfPop .cd small{color:#9a8d72;font-size:12px;letter-spacing:.08em;text-transform:uppercase}#bfPop .cd b{color:#e2c46f;font-size:20px;letter-spacing:.12em}#bfPop .cp{background:#c9a64b;color:#111;border:0;border-radius:20px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer}'+
  '#bfPop .x{position:absolute;top:10px;right:12px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#fff;font-size:20px;cursor:pointer}';
  function show(){
    var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
    var d=document.createElement('div');d.id='bfPop';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Black Friday offer');
    d.innerHTML='<div class="bx"><button class="x" type="button" aria-label="Close">×</button><span class="tg">BLACK FRIDAY</span><h3>No set-up fee.</h3><div class="pr"><s>£75</s>£0</div>'+
      '<p>On every online coaching plan: monthly, 3 months or 6 months. Your programme, meal plan, weekly check-ins with me and the MPF client app.</p>'+
      '<div class="cd"><small>Use code</small><b>BLACKFRIDAY</b><button type="button" class="cp">Copy</button></div>'+
      '<div class="ch"><span>⏳ Ends Cyber Monday, 30 Nov</span><span>🔒 Limited spaces</span></div>'+
      '<a class="go" href="book.html#online">Book my free call</a><button class="no" type="button">No thanks</button></div>';
    document.body.appendChild(d);requestAnimationFrame(function(){d.classList.add('on')});
    function close(){try{sessionStorage.setItem('mpf-bf','1')}catch(e){}d.classList.remove('on');setTimeout(function(){d.remove()},300)}
    d.querySelector('.x').onclick=close;var cp=d.querySelector('.cp');cp.onclick=function(){var ok=function(){cp.textContent='Copied ✓'};try{navigator.clipboard.writeText('BLACKFRIDAY').then(ok,function(){cp.textContent='BLACKFRIDAY'})}catch(e){cp.textContent='BLACKFRIDAY'}};d.querySelector('.no').onclick=close;d.querySelector('.go').addEventListener('click',function(){try{sessionStorage.setItem('mpf-bf','1')}catch(e){}});
    d.addEventListener('click',function(e){if(e.target===d)close()});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.getElementById('bfPop'))close()});
  }
  if(document.readyState==='complete')setTimeout(show,1500);else window.addEventListener('load',function(){setTimeout(show,1500)});
})();
