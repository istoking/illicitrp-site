(function(){
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }

  // -------- Support Links --------
  function updateSupportLinks(){
    fetch('/status.json', {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(cfg){
      var invite = (cfg && cfg.discord && cfg.discord.invite) ? String(cfg.discord.invite) : 'https://discord.gg/xXru9PEFdg';
      var guildId = (cfg && cfg.discord && cfg.discord.guild_id) ? String(cfg.discord.guild_id) : '';
      var channelId = (cfg && cfg.discord && cfg.discord.support_channel_id) ? String(cfg.discord.support_channel_id) : '';
      var href = (guildId && channelId) ? ('https://discord.com/channels/' + guildId + '/' + channelId) : invite;
      qsa('a[data-support-link]').forEach(function(a){
        a.href = href;
        a.title = 'Opens the IRP Discord support channel. If you are not in the server yet, you may be prompted to join.';
      });
    }).catch(function(){ /* ignore */ });
  }

  // -------- Status Banner --------
  function injectStatusBanner(){
    var body = document.body;
    if(!body) return;

    var banner = document.createElement('div');
    banner.id = 'irpStatusBanner';
    banner.className = 'irp-status';
    banner.innerHTML = [
      '<div class="irp-status-inner">',
        '<div class="left">',
          '<span class="badge" id="irpStatusBadge">Status</span>',
          '<strong id="irpStatusName">Illicit Roleplay</strong>',
          '<span class="sep">•</span>',
          '<span id="irpStatusText">Loading status</span>',
        '</div>',
        '<div class="right">',
          '<span id="irpStatusPlayers" class="players"></span>',
          '<a class="btn mini" href="/changelog/">Changelog</a>',
          '<a class="btn mini primary" href="https://discord.gg/xXru9PEFdg" target="_blank" rel="noopener">Support</a>',
        '</div>',
      '</div>'
    ].join('');

    body.insertBefore(banner, body.firstChild);

    fetch('/status.json', {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(s){
      var badge = qs('#irpStatusBadge');
      var name = qs('#irpStatusName');
      var text = qs('#irpStatusText');
      var players = qs('#irpStatusPlayers');

      if(name) name.textContent = s.server_name || 'Illicit Roleplay';
      var state = (s.status || 'unknown').toLowerCase();
      var msg = s.message || '';
      if(text) text.textContent = msg || 'Status available';

      if(badge){
        badge.textContent = state.toUpperCase();
        badge.classList.remove('online','offline','maintenance','unknown');
        badge.classList.add(state);
      }

      if(players){
        if(typeof s.players === 'number' && typeof s.max_players === 'number'){
          players.textContent = s.players + ' / ' + s.max_players + ' players';
        }else{
          players.textContent = '';
        }
      }
    }).catch(function(){
      var text = qs('#irpStatusText');
      if(text) text.textContent = 'Status unavailable';
      var badge = qs('#irpStatusBadge');
      if(badge){
        badge.textContent = 'UNKNOWN';
        badge.classList.add('unknown');
      }
    });
  }

  
  // -------- Breadcrumbs --------
  function titleCase(str){
    return (str||'').split(' ').filter(Boolean).map(function(w){
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  function enhanceBreadcrumbs(){
    qsa('.breadcrumb').forEach(function(el){
      // Preserve existing class styling but make it clickable based on URL path.
      var path = (window.location.pathname || '/').replace(/\/+$/, '');
      var parts = path.split('/').filter(Boolean);

      var nav = document.createElement('nav');
      nav.className = el.className; // keep same styling
      nav.setAttribute('aria-label', 'Breadcrumb');

      var home = document.createElement('a');
      home.href = '/';
      home.textContent = 'Home';
      nav.appendChild(home);

      var accum = '';
      parts.forEach(function(seg, i){
        nav.appendChild(document.createTextNode(' / '));
        accum += '/' + seg;

        var cleanSeg = seg.replace(/\.html$/i, '');
        var label = titleCase(cleanSeg.replace(/[-_]+/g, ' '));
        if(i === parts.length - 1){
          var span = document.createElement('span');
          span.textContent = label;
          nav.appendChild(span);
        }else{
          var a = document.createElement('a');
                    a.href = seg.toLowerCase().endsWith('.html') ? accum : (accum + '/');
          a.textContent = label;
          nav.appendChild(a);
        }
      });

      el.replaceWith(nav);
    });
  }

// -------- Global Search --------
  function injectSearchButton(){
    // Try to place in header nav if present, otherwise float button
    var nav = qs('nav.nav') || qs('nav');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn mini';
    btn.id = 'irpSearchOpen';
    btn.innerHTML = 'Search <span class="kbd">Ctrl K</span>';

    if(nav){
      nav.appendChild(btn);
    }else{
      btn.classList.add('irp-search-float');
      document.body.appendChild(btn);
    }
  }

  function createSearchModal(){
    var modal = document.createElement('div');
    modal.id = 'irpSearchModal';
    modal.className = 'irp-modal';
    modal.innerHTML = [
      '<div class="irp-modal-backdrop" data-close="1"></div>',
      '<div class="irp-modal-card" role="dialog" aria-modal="true">',
        '<div class="top">',
          '<strong>Search IRP</strong>',
          '<button class="x" type="button" data-close="1">Close</button>',
        '</div>',
        '<div class="docs-search" style="margin-top:10px">',
          '<input id="irpSearchInput" type="search" placeholder="Search docs, SOPs, handbook, downloads" autocomplete="off" />',
          '<span class="kbd">Esc</span>',
        '</div>',
        '<div id="irpSearchMeta" class="meta"></div>',
        '<div id="irpSearchResults" class="docs-results open" style="margin-top:12px"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);
  }

  function openModal(){
    var m = qs('#irpSearchModal');
    if(!m) return;
    m.classList.add('open');
    var input = qs('#irpSearchInput');
    if(input){
      input.focus();
      input.select();
    }
  }
  function closeModal(){
    var m = qs('#irpSearchModal');
    if(!m) return;
    m.classList.remove('open');
  }

  function score(text, q){
    text = (text||'').toLowerCase();
    q = q.toLowerCase();
    if(!q) return 0;
    if(text === q) return 100;
    if(text.indexOf(q) === 0) return 75;
    if(text.indexOf(q) > -1) return 50;
    return 0;
  }

  var searchData = null;

  function ensureSearchLoaded(){
    if(searchData) return Promise.resolve(searchData);
    return fetch('/search_index.json', {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(d){
      searchData = d || [];
      return searchData;
    }).catch(function(){
      searchData = [];
      return searchData;
    });
  }

  function renderResults(items, q){
    var resultsEl = qs('#irpSearchResults');
    var metaEl = qs('#irpSearchMeta');
    if(!resultsEl) return;
    q = (q||'').trim();
    if(!q){
      resultsEl.innerHTML = '';
      if(metaEl) metaEl.textContent = '';
      return;
    }
    var scored = items.map(function(it){
      var s = Math.max(score(it.title, q), score(it.snippet, q), score(it.category, q));
      return {it:it, s:s};
    }).filter(function(x){ return x.s > 0; }).sort(function(a,b){ return b.s - a.s; }).slice(0, 12);

    if(metaEl) metaEl.textContent = scored.length ? ('Results: ' + scored.length) : 'No matches';

    resultsEl.innerHTML = scored.map(function(x){
      var it = x.it;
      var t = (it.title||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var sn = (it.snippet||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var cat = (it.category||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<a class="result" href="'+it.url+'"><strong>'+t+' <span class="doc-pill" style="margin-left:10px">'+cat+'</span></strong><span>'+sn+'</span></a>';
    }).join('');
  }

  function wireSearch(){
    var openBtn = qs('#irpSearchOpen');
    if(openBtn) openBtn.addEventListener('click', function(){ openModal(); });

    var modal = qs('#irpSearchModal');
    if(modal){
      modal.addEventListener('click', function(e){
        var t = e.target;
        if(t && t.getAttribute && t.getAttribute('data-close') === '1') closeModal();
      });
    }

    var input = qs('#irpSearchInput');
    if(input){
      input.addEventListener('input', function(){
        ensureSearchLoaded().then(function(items){
          renderResults(items, input.value);
        });
      });
    }

    document.addEventListener('keydown', function(e){
      if((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')){
        e.preventDefault();
        openModal();
      }
      if(e.key === 'Escape'){
        closeModal();
      }
    });
  }

  // -------- Header Dropdowns (SOPs / Community) --------
  function wireDropdowns(){
    // Uses <details> elements; ensure only one dropdown is open at a time,
    // and close when clicking outside or pressing Esc.
    var dropdownDetails = qsa('.dropdown details');
    if(!dropdownDetails.length) return;

    function closeAll(except){
      dropdownDetails.forEach(function(d){
        if(d !== except) d.removeAttribute('open');
      });
    }

    dropdownDetails.forEach(function(d){
      d.addEventListener('toggle', function(){
        if(d.open){
          closeAll(d);
        }
      });
    });

    document.addEventListener('click', function(e){
      // If click is outside any dropdown, close all.
      var inside = e.target && e.target.closest ? e.target.closest('.dropdown details') : null;
      if(!inside){
        closeAll(null);
      }
    });

    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){
        closeAll(null);
      }
    });
  }


  function init(){
    // Status banner disabled (was /status.json driven)
    injectSearchButton();
    createSearchModal();
    wireSearch();
    enhanceBreadcrumbs();
    wireDropdowns();
    updateSupportLinks();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();

// Auto-add Queue link to Community dropdown (POLICE_QUEUE)
;(function(){
  try{
    const items = document.querySelectorAll('a');
    let has = false;
    items.forEach(a=>{ if((a.getAttribute('href')||'') === '/queue/' || (a.getAttribute('href')||'') === '/queue') has=true; });
    if(has) return;
    const dropdowns = document.querySelectorAll('[data-dropdown="community"], .dropdown[data-name="community"], .nav-dropdown-community');
    const target = dropdowns.length ? dropdowns[0] : null;
    if(!target) return;
    const a = document.createElement('a');
    a.href = '/queue/';
    a.textContent = 'Queue';
    a.className = 'dropdown-item';
    target.appendChild(a);
  }catch{}
})();
