(function(){
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }

  var isDocs = location.pathname.indexOf('/docs') === 0;
  if(!isDocs) return;

  var container = qs('main.container');
  if(!container) return;

  // Wrap existing content into docs shell
  var content = document.createElement('div');
  content.className = 'docs-content';
  while(container.firstChild){
    content.appendChild(container.firstChild);
  }

  var shell = document.createElement('div');
  shell.className = 'docs-shell';

  var sidebar = document.createElement('aside');
  sidebar.className = 'docs-sidebar';
  sidebar.innerHTML = [
    '<div class="title"><strong>IRP Docs</strong><span class="doc-pill">Free and hosted</span></div>',
    '<div class="docs-tools">',
      '<div class="docs-search">',
        '<input id="docsSearch" type="search" placeholder="Search documentation" autocomplete="off" />',
        '<span class="kbd">Ctrl K</span>',
      '</div>',
    '</div>',
    '<div id="docsNav"></div>',
    '<div id="docsResults" class="docs-results"></div>'
  ].join('');

  shell.appendChild(sidebar);
  shell.appendChild(content);
  container.appendChild(shell);

  var navEl = qs('#docsNav', sidebar);
  var resultsEl = qs('#docsResults', sidebar);
  var inputEl = qs('#docsSearch', sidebar);

  function setActive(){
    var path = location.pathname;
    qsa('a.navitem', sidebar).forEach(function(a){
      var href = a.getAttribute('href');
      if(href === path || (href === '/docs/' && (path === '/docs' || path === '/docs/'))){
        a.classList.add('active');
      }else{
        a.classList.remove('active');
      }
    });
  }

  function renderNav(nav){
    navEl.innerHTML = '';
    nav.forEach(function(group){
      var wrap = document.createElement('div');
      wrap.className = 'navgroup';
      wrap.innerHTML = '<div class="label">'+group.group+'</div>';
      group.items.forEach(function(item){
        var a = document.createElement('a');
        a.className = 'navitem';
        a.href = item.url;
        a.innerHTML = '<span>'+item.title+'</span><em>Open</em>';
        a.setAttribute('data-desc', item.desc || '');
        wrap.appendChild(a);
      });
      navEl.appendChild(wrap);
    });
    setActive();
  }

  function openResults(open){
    if(open){ resultsEl.classList.add('open'); }
    else{ resultsEl.classList.remove('open'); resultsEl.innerHTML=''; }
  }

  function scoreMatch(text, query){
    text = (text||'').toLowerCase();
    query = query.toLowerCase();
    if(!query) return 0;
    if(text === query) return 100;
    if(text.indexOf(query) === 0) return 75;
    if(text.indexOf(query) > -1) return 50;
    return 0;
  }

  function renderResults(items, query){
    var q = (query||'').trim();
    if(!q){ openResults(false); return; }
    var scored = items.map(function(it){
      var s = Math.max(scoreMatch(it.title, q), scoreMatch(it.snippet, q));
      return {it:it, s:s};
    }).filter(function(x){ return x.s > 0; }).sort(function(a,b){ return b.s - a.s; }).slice(0, 10);

    resultsEl.innerHTML = scored.map(function(x){
      var t = x.it.title.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var sn = x.it.snippet.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<a class="result" href="'+x.it.url+'"><strong>'+t+'</strong><span>'+sn+'</span></a>';
    }).join('');

    openResults(true);
  }

  Promise.all([
    fetch('/docs/_nav.json', {cache:'no-store'}).then(function(r){ return r.json(); }),
    fetch('/docs/_search.json', {cache:'no-store'}).then(function(r){ return r.json(); })
  ]).then(function(res){
    var nav = res[0];
    var search = res[1];
    renderNav(nav);

    inputEl.addEventListener('input', function(){
      renderResults(search, inputEl.value);
    });

    document.addEventListener('keydown', function(e){
      if((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')){
        e.preventDefault();
        inputEl.focus();
      }
      if(e.key === 'Escape'){
        openResults(false);
        inputEl.blur();
      }
    });
  }).catch(function(){
    // If fetch fails, still keep content readable
  });

})();