/* MPF education gate: asks for name + email once, then unlocks every guide, tool and recipe.
   To switch it on, paste your Google Form details below (action = the form's formResponse URL,
   name/email/guide = the entry.XXXX ids from a pre-filled link). Leave action empty to keep it off. */
var MPF_GATE={action:"https://docs.google.com/forms/d/e/1FAIpQLSdA15cYhMQJkAxDUQuvMN7dfcx65YS_MyNwJl6x_bq7SjiDEw/formResponse",name:"entry.1506624811",email:"entry.901543487",guide:""};
(function(){
  var KEY='mpfGuide';
  function unlocked(){try{return localStorage.getItem(KEY)==='1'}catch(e){return false}}
  var forced=/[?&]gate=1/.test(location.search);
  // Clients coming from the MPF app never see the email box
  var fromApp=false;try{fromApp=sessionStorage.getItem('mpfFromApp')==='1'}catch(e){}
  if(!forced&&(fromApp||/[?&]app=1/.test(location.search)||/\/portal(\/|$)/.test(document.referrer||''))){try{localStorage.setItem(KEY,'1')}catch(e){}return}
  if((!MPF_GATE.action&&!forced)||unlocked())return;
  var label=document.body.getAttribute('data-gate')||document.title.split('|')[0].trim();
  var css='.mg{position:fixed;inset:0;z-index:9999;background:rgba(10,10,10,.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Montserrat,system-ui,sans-serif}'+
  '.mg-b{background:#111;color:#f3ecdc;border:1px solid rgba(201,166,75,.6);border-radius:18px;padding:30px 24px 24px;width:100%;max-width:440px;text-align:center;box-shadow:0 0 0 1px rgba(232,206,130,.15),0 0 40px rgba(201,166,75,.25)}'+
  '.mg-b img{width:96px;margin:0 auto 14px;display:block}'+
  '.mg-k{font-size:11px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:#E4CF8A;margin-bottom:8px}'+
  '.mg-b h3{font-family:"Playfair Display",Georgia,serif;font-weight:900;font-size:28px;line-height:1.1;color:#fff;margin:0 0 8px}'+
  '.mg-b h3 em{font-style:italic;font-weight:400;color:#C9A64B}'+
  '.mg-b p{font-size:14px;line-height:1.55;color:#cfc4aa;margin:0 0 16px}'+
  '.mg-l{text-align:left;font-size:13px;color:#e8dcc0;margin:0 0 16px;padding:0;list-style:none}'+
  '.mg-l li{padding:4px 0 4px 22px;position:relative}.mg-l li:before{content:"✓";position:absolute;left:0;color:#C9A64B;font-weight:700}'+
  '.mg-b input[type=text],.mg-b input[type=email]{display:block;width:100%;box-sizing:border-box;padding:14px;border-radius:10px;border:1px solid rgba(201,166,75,.45);background:#1d1c19;color:#fff;font-size:16px;font-family:inherit;margin:0 0 10px}'+
  '.mg-ok{display:flex;gap:10px;text-align:left;font-size:12px;color:#cfc4aa;margin:4px 0 12px;align-items:flex-start;line-height:1.45}.mg-ok input{accent-color:#C9A64B;margin-top:2px}.mg-ok a{color:#E4CF8A}'+
  '.mg-e{color:#e88a6b;font-size:13px;min-height:18px;margin-bottom:6px}'+
  '.mg-btn{width:100%;border:0;border-radius:40px;padding:16px;font-family:inherit;font-weight:700;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#111;background:linear-gradient(120deg,#9C7A2C 0%,#C9A64B 45%,#E8D79A 100%);cursor:pointer;box-shadow:0 0 24px rgba(201,166,75,.35)}'+
  '.mg-code{margin:6px auto 12px;display:inline-block;font-family:"Playfair Display",Georgia,serif;font-weight:900;font-size:34px;letter-spacing:.12em;color:#111;background:linear-gradient(120deg,#9C7A2C 0%,#C9A64B 45%,#E8D79A 100%);padding:8px 26px;border-radius:12px;box-shadow:0 0 26px rgba(201,166,75,.45)}'+
  '.mg-ghost{display:block;width:100%;margin-top:10px;border:1.5px solid rgba(201,166,75,.6);background:none;color:#E4CF8A;border-radius:40px;padding:14px;font-family:inherit;font-weight:700;font-size:12px;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;text-decoration:none;box-sizing:border-box}'+
  '.mg-back{display:block;margin-top:14px;color:#a89a78;font-size:12px;text-decoration:none}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var d=document.createElement('div');d.className='mg';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');
  d.innerHTML='<form class="mg-b" novalidate><img src="img/logo.png" alt="MPF Coaching"><div class="mg-k">Free education hub</div>'+
  '<h3>Unlock everything free, <em>plus get 10% off.</em></h3><p>Pop in your name and email for instant access to all of my free education, <b style="color:#fff">plus 10% off your first month of coaching</b>.</p>'+
  '<ul class="mg-l"><li><b style="color:#E4CF8A">10% off your first month of coaching</b> (use within 14 days)</li><li>The No-Nonsense Hypertrophy Guide</li><li>The Flexible Dieting Guide + macro calculator</li><li>The High-Protein Recipe Book (36 recipes)</li></ul>'+
  '<input type="text" id="mgN" placeholder="First name" autocomplete="given-name"><input type="email" id="mgM" placeholder="Email address" autocomplete="email">'+
  '<label class="mg-ok"><input type="checkbox" id="mgO"> I\'m happy to get emails from MPF Coaching. I can unsubscribe any time. <a href="privacy.html">Privacy</a></label>'+
  '<div class="mg-e" id="mgE"></div><button class="mg-btn" type="submit">Unlock free access</button><a class="mg-back" href="index.html">← Back to the website</a></form>';
  document.body.appendChild(d);document.documentElement.style.overflow='hidden';
  d.querySelector('form').addEventListener('submit',function(e){
    e.preventDefault();var n=document.getElementById('mgN').value.trim(),m=document.getElementById('mgM').value.trim(),err=document.getElementById('mgE');
    if(!n){err.textContent='Add your first name.';return}
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)){err.textContent='That email doesn\'t look quite right.';return}
    if(!document.getElementById('mgO').checked){err.textContent='Tick the box so I can give you access.';return}
    var done=function(){try{localStorage.setItem(KEY,'1')}catch(x){}
      var exp=new Date(Date.now()+14*864e5).toLocaleDateString('en-GB',{day:'numeric',month:'long'});
      var safe=n.replace(/[<>&"]/g,'');
      d.querySelector('form').outerHTML='<div class="mg-b"><img src="img/logo.png" alt="MPF Coaching"><div class="mg-k">You\'re in</div><h3>Welcome, <em>'+safe+'.</em></h3><p>Everything is unlocked. Here\'s your code for <b style="color:#fff">10% off your first month of coaching</b>:</p><div class="mg-code">MPF10</div><p style="font-size:13px">Use by <b style="color:#E4CF8A">'+exp+'</b>. Just mention it on your free call. Screenshot this so you don\'t lose it.</p><button class="mg-btn" type="button" id="mgGo">Start exploring</button><a class="mg-ghost" href="book.html#online">Book your free call</a></div>';
      document.getElementById('mgGo').onclick=function(){d.remove();document.documentElement.style.overflow=''};};
    if(!MPF_GATE.action){done();return}
    var fd=new FormData();fd.append(MPF_GATE.name,n);fd.append(MPF_GATE.email,m);if(MPF_GATE.guide)fd.append(MPF_GATE.guide,label);
    fetch(MPF_GATE.action,{method:'POST',mode:'no-cors',body:fd}).catch(function(){}).finally(done);
  });
})();
