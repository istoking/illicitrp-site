/* IRP Changelog (data-driven)
   - Renders changelog cards from /changelog/data.json
   - Builds filter chips from discovered categories
   - Click chip OR click a category pill on a card to filter
   - Persists selection in the URL hash (e.g. #core)
*/

(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function slugify(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
  }

  function parseDate(d) {
    var p = String(d || '').split('-');
    if (p.length !== 3) return null;
    var y = Number(p[0]), m = Number(p[1]) - 1, day = Number(p[2]);
    if (!isFinite(y) || !isFinite(m) || !isFinite(day)) return null;
    return new Date(y, m, day);
  }

  function daysBetween(a, b) {
    var ms = 24 * 60 * 60 * 1000;
    return Math.floor((a.getTime() - b.getTime()) / ms);
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var listEl = qs('#clList');
    var filtersEl = qs('#clFilters');
    var metaEl = qs('#clMeta');
    if (!listEl || !filtersEl) return;

    var today = new Date();

    function renderMeta(count, activeLabel) {
      if (!metaEl) return;
      var updated = new Date().toISOString().slice(0, 10);
      metaEl.innerHTML = [
        '<span class="doc-pill">Showing: ' + count + '</span>',
        '<span class="doc-pill">Filter: ' + esc(activeLabel) + '</span>',
        '<span class="doc-pill">Updated: ' + esc(updated) + '</span>'
      ].join(' ');
    }

    fetch('/changelog/data.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (items) {
        items = (items || []).slice().sort(function (a, b) {
          return String(b.date || '').localeCompare(String(a.date || ''));
        });

        // Build cards first (so filters can also be built from rendered content if needed)
        listEl.innerHTML = items.map(function (it) {
          var typeLabel = (it && it.type) ? String(it.type) : 'Other';
          var cat = slugify(typeLabel) || 'other';
          var d = parseDate(it.date);
          var isNew = d ? (daysBetween(today, d) <= 14) : false;
          var lis = (it.details || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
          return [
            '<div class="doc-card" data-cat="' + esc(cat) + '" data-cat-label="' + esc(typeLabel) + '" style="display:block">',
              '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">',
                '<div class="doc-pill is-clickable" role="button" tabindex="0" data-filter="' + esc(cat) + '">' + esc(typeLabel) + '</div>',
                (isNew ? '<div class="badge-new">New</div>' : ''),
              '</div>',
              '<strong style="margin-top:10px; display:block">' + esc(it.title) + '</strong>',
              '<span style="opacity:.85; font-size:13px; display:block; margin-top:6px">Date: ' + esc(it.date) + '</span>',
              '<ul style="margin-top:10px">' + lis + '</ul>',
            '</div>'
          ].join('');
        }).join('');

        var cards = qsa('.doc-card', listEl);
        if (!cards.length) return;

        // Extract categories from cards
        var cats = [];
        var map = Object.create(null); // slug -> label
        cards.forEach(function (card) {
          var slug = card.getAttribute('data-cat') || 'other';
          var label = card.getAttribute('data-cat-label') || 'Other';
          if (!map[slug]) {
            map[slug] = label;
            cats.push({ slug: slug, label: label });
          }
        });

        cats.sort(function (a, b) { return a.label.localeCompare(b.label); });

        function makeChip(label, value) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pill changelog-chip';
          btn.textContent = label;
          btn.dataset.value = value;
          btn.addEventListener('click', function () { setFilter(value); });
          return btn;
        }

        function setActiveChip(value) {
          qsa('.changelog-chip', filtersEl).forEach(function (b) {
            b.classList.toggle('is-active', b.dataset.value === value);
          });
        }

        function setFilter(value) {
          var v = value || 'all';
          setActiveChip(v);

          var shown = 0;
          cards.forEach(function (card) {
            var show = v === 'all' || card.getAttribute('data-cat') === v;
            card.style.display = show ? 'block' : 'none';
            if (show) shown++;
          });

          renderMeta(shown, v === 'all' ? 'All' : (map[v] || v));

          // Keep URL hash in sync
          if (v === 'all') {
            if (location.hash) history.replaceState(null, '', location.pathname + location.search);
          } else {
            if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
          }
        }

        // Render chips
        filtersEl.innerHTML = '';
        filtersEl.appendChild(makeChip('All', 'all'));
        cats.forEach(function (c) { filtersEl.appendChild(makeChip(c.label, c.slug)); });

        // Make per-card category pills filterable
        qsa('.doc-pill.is-clickable', listEl).forEach(function (pill) {
          var v = pill.getAttribute('data-filter');
          if (!v) return;
          pill.addEventListener('click', function () { setFilter(v); });
          pill.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFilter(v);
            }
          });
        });

        // Initial filter from hash
        var initial = (location.hash || '').replace('#', '').trim();
        if (initial && map[initial]) setFilter(initial);
        else setFilter('all');
      })
      .catch(function () {
        // Fail silently (static site) but leave an empty state
        if (metaEl) metaEl.innerHTML = '<span class="doc-pill">Changelog unavailable</span>';
      });
  });
})();
