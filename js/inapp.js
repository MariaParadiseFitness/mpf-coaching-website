/* Instagram's built-in browser: send visitors to /open.html, which gets them into Safari or Chrome. */
(function(){
  try{
    var ua=navigator.userAgent||'';
    if(!/Instagram/i.test(ua))return;
    if(location.pathname==='/open.html')return;
    if(sessionStorage.getItem('mpf_stay_inapp'))return;
    location.replace('/open.html?to='+encodeURIComponent(location.pathname+location.search+location.hash));
  }catch(e){}
})();
