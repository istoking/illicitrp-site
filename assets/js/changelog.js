(function(){
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function esc(s){ return (s||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function parseDate(d){ 
    var p = (d||'').split('-'); 
    if(p.length!==3) return null;
    return new Date(Number(p[0]), Number(p[1])-1, Number(p[2]));
  }

  var now = new Date(2026, 1, 13);

  function daysBetween(a,b){
    var ms = 24*60*60*1000;
    return Math.floor((a.getTime()-b.getTime())/ms);
  }

  function init(){
    var listEl = qs('#clList');
    var filtersEl = qs('#clFilters');
    var metaEl = qs('#clMeta');
    if(!listEl || !filtersEl) return;

    fetch('/changelog/data.json', {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(items){
      items = (items||[]).slice().sort(function(a,b){
        return (b.date||'').localeCompare(a.date||'');
      });

      var types = ['All'].concat(Array.from(new Set(items.map(function(i){ return i.type; }))).sort());
      var active = 'All';

      function renderFilters(){
        filtersEl.innerHTML = types.map(function(t){
          return '<button class="tabbtn '+(t===active?'active':'')+'" data-t="'+esc(t)+'">'+esc(t)+'</button>';
        }).join('');
        filtersEl.querySelectorAll('button').forEach(function(btn){
          btn.addEventListener('click', function(){
            active = btn.getAttribute('data-t') || 'All';
            renderFilters();
            renderList();
          });
        });
      }

      function renderMeta(count){
        if(!metaEl) return;
        metaEl.innerHTML = [
          '<span class="doc-pill">Showing: '+count+'</span>',
          '<span class="doc-pill">Filter: '+esc(active)+'</span>',
          '<span class="doc-pill">Updated: '+(new Date()).toISOString().slice(0,10)+'</span>'
        ].join(' ');
      }

      function renderList(){
        var filtered = items.filter(function(it){
          return active==='All' || it.type===active;
        });

        renderMeta(filtered.length);

        listEl.innerHTML = filtered.map(function(it){
          var d = parseDate(it.date);
          var isNew = d ? (daysBetween(now, d) <= 14) : false;
          var lis = (it.details||[]).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('');
          return [
            '<div class="doc-card" style="display:block">',
              '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">',
                '<div class="doc-pill">'+esc(it.type)+'</div>',
                (isNew?'<div class="badge-new">New</div>':''),
              '</div>',
              '<strong style="margin-top:10px; display:block">'+esc(it.title)+'</strong>',
              '<span style="opacity:.85; font-size:13px; display:block; margin-top:6px">Date: '+esc(it.date)+'</span>',
              '<ul style="margin-top:10px">'+lis+'</ul>',
            '</div>'
          ].join('');
        }).join('');
      }

      renderFilters();
      renderList();
    }).catch(function(){});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();