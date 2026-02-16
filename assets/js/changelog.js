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
    var lastUpdated = null;

    function renderMeta(count, activeLabel) {
      if (!metaEl) return;
      var updated = (lastUpdated ? String(lastUpdated).slice(0, 10) : new Date().toISOString().slice(0, 10));
      metaEl.innerHTML = [
        '<span class="doc-pill">Showing: ' + count + '</span>',
        '<span class="doc-pill">Filter: ' + esc(activeLabel) + '</span>',
        '<span class="doc-pill">Updated: ' + esc(updated) + '</span>'
      ].join(' ');
    }

    fetch('/status.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (status) {
        var base = status && status.worker && status.worker.base ? String(status.worker.base) : '';
        if (!base) throw new Error('Missing worker base in /status.json');
        return fetch(base.replace(/\/+$/,'') + '/changelog', { cache: 'no-store' });
      })
      .then(function (r) { return r.json(); })
      .then(function (payload) {
        var items = (payload && payload.entries) ? payload.entries : (payload || []);
        var updatedAt = (payload && payload.updatedAt) ? payload.updatedAt : null;
        lastUpdated = updatedAt || null;

        items = (items || []).slice().sort(function (a, b) {
          return String(b.date || '').localeCompare(String(a.date || ''));
        });

        // Build cards
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

        // Build filters (type + tags discovered)
        var categories = {};
        items.forEach(function (it) {
          var t = (it && it.type) ? String(it.type) : 'Other';
          categories[slugify(t) || 'other'] = t;

          if (it && Array.isArray(it.tags)) {
            it.tags.forEach(function (tg) {
              var s = slugify(tg) || '';
              if (!s) return;
              categories[s] = toLabel(s);
            });
          }
        });

        var cats = Object.keys(categories).sort();
        if (!cats.length) cats = ['all'];

        var active = (location.hash || '').replace('#', '');
        if (!active) active = 'all';

        filtersEl.innerHTML = [
          '<button class="doc-pill" data-filter="all" type="button">All</button>'
        ].concat(cats.map(function (k) {
          if (k === 'all') return '';
          return '<button class="doc-pill" data-filter="' + esc(k) + '" type="button">' + esc(categories[k]) + '</button>';
        }).filter(Boolean)).join('');

        function applyFilter(key) {
          key = key || 'all';
          var cards = qsa('.changelog-card', listEl);
          cards.forEach(function (c) {
            var cat = c.getAttribute('data-cat') || '';
            var tags = (c.getAttribute('data-tags') || '').split(',').filter(Boolean);
            var show = (key === 'all') || (cat === key) || (tags.indexOf(key) !== -1);
            c.style.display = show ? '' : 'none';
          });

          qsa('.doc-pill', filtersEl).forEach(function (b) {
            var k = b.getAttribute('data-filter');
            if (k === key) b.classList.add('active');
            else b.classList.remove('active');
          });

          if (metaEl) metaEl.innerHTML = '<span class="doc-pill">' + esc(cards.filter(function(c){ return c.style.display !== 'none'; }).length) + ' shown</span>';
          location.hash = key === 'all' ? '' : '#' + key;
        }

        filtersEl.addEventListener('click', function (e) {
          var t = e.target && e.target.getAttribute ? e.target.getAttribute('data-filter') : null;
          if (!t) return;
          applyFilter(t);
        });

        listEl.addEventListener('click', function (e) {
          var t = e.target && e.target.getAttribute ? e.target.getAttribute('data-filter') : null;
          if (!t) return;
          applyFilter(t);
        });

        applyFilter(active);

        // ---- Archive UI ----
        renderArchiveUI(base, archiveInfo);

      } catch (e) {
        if (metaEl) metaEl.innerHTML = '<span class="doc-pill">Changelog unavailable</span>';
      }

      function toLabel(slug) {
        return String(slug || '')
          .split('-')
          .map(function (w) { return w ? (w[0].toUpperCase() + w.slice(1)) : ''; })
          .join(' ');
      }

      async function renderArchiveUI(base, archiveInfo) {
        var wrap = qs('#clArchiveWrap');
        var recentEl = qs('#clArchiveRecent');
        var monthSel = qs('#clArchiveMonth');
        var loadBtn = qs('#clArchiveLoad');
        var list = qs('#clArchiveList');

        if (!wrap || !recentEl || !monthSel || !loadBtn || !list) return;
        if (!archiveInfo || !archiveInfo.enabled || !base) return;

        wrap.style.display = '';

        // Recently archived
        var recent = Array.isArray(archiveInfo.recentlyArchived) ? archiveInfo.recentlyArchived : [];
        recentEl.innerHTML = recent.length ? recent.map(renderMiniCard).join('') : '<div class="doc-sub">Nothing archived yet.</div>';

        // Month index
        var idx = Array.isArray(archiveInfo.index) ? archiveInfo.index : [];
        if (!idx.length) {
          try {
            var ir = await fetch(base.replace(/\/+$/, '') + '/changelog/archive/index', { cache: 'no-store' });
            if (ir.ok) {
              var ij = await ir.json();
              if (ij && ij.ok && Array.isArray(ij.months)) idx = ij.months;
            }
          } catch (_) {}
        }

        monthSel.innerHTML = idx.map(function (m) {
          return '<option value="' + esc(m.month) + '">' + esc(m.month) + ' (' + esc(String(m.count || 0)) + ')</option>';
        }).join('');

        async function loadMonth() {
          var month = monthSel.value;
          if (!month) return;

          list.innerHTML = '<div class="doc-sub">Loading…</div>';

          try {
            var r = await fetch(base.replace(/\/+$/, '') + '/changelog/archive?month=' + encodeURIComponent(month), { cache: 'no-store' });
            if (!r.ok) throw new Error('bad');
            var j = await r.json();
            var entries = j && j.ok && Array.isArray(j.entries) ? j.entries : [];
            list.innerHTML = entries.length ? entries.map(renderMiniCard).join('') : '<div class="doc-sub">No entries for this month.</div>';
          } catch (_) {
            list.innerHTML = '<div class="doc-sub">Archive unavailable.</div>';
          }
        }

        loadBtn.addEventListener('click', loadMonth);
        if (monthSel.options.length) loadMonth();

        function renderMiniCard(it) {
          var typeLabel = (it && it.type) ? String(it.type) : 'Other';
          var cat = slugify(typeLabel) || 'other';
          var dateStr = (it && it.date) ? String(it.date) : '';
          var timeStr = (it && it.time) ? String(it.time) : '';
          var stamp = dateStr ? ('Date: ' + esc(dateStr) + (timeStr ? (' • ' + esc(timeStr)) : '')) : '';

          return (
            '<article class="doc-card changelog-card" data-cat="' + esc(cat) + '" data-tags="' + esc((it.tags || []).join(',')) + '">' +
              '<div class="doc-row">' +
                '<div class="doc-title">' + esc(it.title || '') + '</div>' +
                '<span class="doc-pill">Archived</span>' +
              '</div>' +
              (stamp ? '<div class="doc-sub" style="margin-top:6px">' + stamp + '</div>' : '') +
              ((it && Array.isArray(it.details) && it.details.length) ? ('<ul class="doc-list" style="margin-top:10px">' +
                it.details.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') +
              '</ul>') : '') +
            '</article>'
          );
        }
      }
    })();});
})();
