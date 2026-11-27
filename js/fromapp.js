/* When a client opens a guide from the MPF app, the back link returns to the app instead of the website. */
(function(){
  var K='mpfFromApp',on=false;
  try{
    if(/[?&]app=1/.test(location.search)||/\/portal(\/|$)/.test(document.referrer||''))sessionStorage.setItem(K,'1');
    on=sessionStorage.getItem(K)==='1';
  }catch(e){on=/[?&]app=1/.test(location.search)}
  if(!on)return;
  function fix(){
    var top=document.querySelector('.top .wrap');if(!top)return;
    var a=top.querySelector('a:not(.cta)');
    if(a){a.textContent='← Back to your app';a.href='/portal/#guides'}
    var c=top.querySelector('a.cta');if(c&&!/portal|hypertrophy/.test(c.getAttribute('href')||''))c.style.display='none';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fix);else fix();
})();
