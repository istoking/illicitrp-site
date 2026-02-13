(function(){
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function esc(s){ return (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function init(){
    var el = qs('#annList');
    if(!el) return;
    fetch('/announcements/data.json', {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(items){
      el.innerHTML = (items||[]).map(function(it){
        return [
          '<div class="doc-card" style="display:block">',
            '<div class="doc-pill">',esc(it.type),'</div>',
            '<strong style="margin-top:10px; display:block">',esc(it.title),'</strong>',
            '<span style="opacity:.85; font-size:13px; display:block; margin-top:6px">Date: ',esc(it.date),'</span>',
            '<span style="display:block; margin-top:10px">',esc(it.body),'</span>',
          '</div>'
        ].join('');
      }).join('');
    }).catch(function(){});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();