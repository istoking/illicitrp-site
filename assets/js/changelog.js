/* IRP Changelog (worker-driven)
   - Fetches worker base from /status.json then loads:
       GET {workerBase}/changelog
       GET {workerBase}/changelog/archive?month=YYYY-MM
   - Renders latest entries (limited by worker CHANGELOG_LIMIT)
   - Supports filtering by primary type + tags
   - Shows an archive section (KV-backed) when enabled
*/

(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return (s || '').toString()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function slugify(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
  }

  function toTitle(s) {
    s = String(s || '').replace(/[-_]+/g, ' ').trim();
    if (!s) return '';
    return s.split(/\s+/g).map(function (w) {
      return w ? (w.charAt(0).toUpperCase() + w.slice(1)) : '';
    }).join(' ');
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

  function renderEntryCard(it, opts) {
    opts = opts || {};
    var typeLabel = (it && it.type) ? String(it.type) : 'Other';
    var cat = slugify(typeLabel) || 'other';

    var tags = (it && Array.isArray(it.tags)) ? it.tags.slice() : [];
    tags = tags.map(function (t) { return slugify(t); }).filter(Boolean);
    tags = tags.filter(function (t) { return t !== cat; });

    var d = parseDate(it.date);
    var today = new Date();
    var isNew = d ? (daysBetween(today, d) <= 14) : false;
    var lis = (it.details || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');

    var tagPills = tags.map(function (t) {
      return '<span class="doc-pill is-clickable" role="button" tabindex="0" data-filter="' + esc(t) + '">' + esc(toTitle(t)) + '</span>';
    }).join(' ');

    return [
      '<div class="doc-card changelog-card" data-cat="' + esc(cat) + '" data-tags="' + esc(tags.join(',')) + '" style="display:block">',
        '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">',
          '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">',
            '<span class="doc-pill is-clickable" role="button" tabindex="0" data-filter="' + esc(cat) + '">' + esc(typeLabel) + '</span>',
            (tagPills ? '<span style="display:flex; gap:8px; flex-wrap:wrap">' + tagPills + '</span>' : ''),
          '</div>',
          (isNew && !opts.compact ? '<div class="badge-new">New</div>' : ''),
        '</div>',
        '<strong style="margin-top:10px; display:block">' + esc(it.title || '') + '</strong>',
        '<span style="opacity:.85; font-size:13px; display:block; margin-top:6px">Date: ' + esc(it.date || '') + '</span>',
        (lis ? '<ul style="margin-top:10px">' + lis + '</ul>' : ''),
      '</div>'
    ].join('');
  }

  ready(function () {
    var listEl = qs('#clList');
    var filtersEl = qs('#clFilters');
    var metaEl = qs('#clMeta');

    var archiveWrap = qs('#clArchiveWrap');
    var archiveRecentEl = qs('#clArchiveRecent');
    var archiveMonthSel = qs('#clArchiveMonth');
    var archiveLoadBtn = qs('#clArchiveLoad');
    var archiveListEl = qs('#clArchiveList');

    if (!listEl || !filtersEl) return;

    var workerBase = '';
    var lastUpdated = null;

    function setMeta(text) {
      if (!metaEl) return;
      metaEl.innerHTML = '<span class="doc-pill">' + esc(text) + '</span>';
    }

    function buildFilters(items) {
      var cats = { all: 'All' };

      items.forEach(function (it) {
        var typeLabel = (it && it.type) ? String(it.type) : 'Other';
        var cat = slugify(typeLabel) || 'other';
        cats[cat] = typeLabel;

        if (it && Array.isArray(it.tags)) {
          it.tags.forEach(function (tg) {
            var s = slugify(tg);
            if (!s) return;
            if (!cats[s]) cats[s] = toTitle(s);
          });
        }
      });

      var keys = Object.keys(cats).filter(function (k) { return k !== 'all'; }).sort();
      filtersEl.innerHTML = ['<button class="doc-pill" data-filter="all" type="button">All</button>']
        .concat(keys.map(function (k) {
          return '<button class="doc-pill" data-filter="' + esc(k) + '" type="button">' + esc(cats[k]) + '</button>';
        })).join('');
    }

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

      var shown = cards.filter(function (c) { return c.style.display !== 'none'; }).length;
      var updated = lastUpdated ? String(lastUpdated).slice(0, 10) : new Date().toISOString().slice(0, 10);
      if (metaEl) {
        metaEl.innerHTML = [
          '<span class="doc-pill">Showing: ' + esc(String(shown)) + '</span>',
          '<span class="doc-pill">Filter: ' + esc(key === 'all' ? 'All' : toTitle(key)) + '</span>',
          '<span class="doc-pill">Updated: ' + esc(updated) + '</span>'
        ].join(' ');
      }

      if (key === 'all') history.replaceState(null, '', location.pathname + location.search);
      else location.hash = '#' + key;
    }

    function bindInlineFilterClicks(root) {
      qsa('[data-filter]', root).forEach(function (el) {
        if (el.__irpBound) return;
        el.__irpBound = true;
        el.addEventListener('click', function () {
          var k = el.getAttribute('data-filter');
          if (k) applyFilter(k);
        });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            var k = el.getAttribute('data-filter');
            if (k) applyFilter(k);
          }
        });
      });
    }

    function renderArchive(archive) {
      if (!archiveWrap || !archive) return;

      if (!archive.enabled) {
        archiveWrap.style.display = 'none';
        return;
      }

      archiveWrap.style.display = '';
      // Recently archived
      if (archiveRecentEl) {
        var recent = Array.isArray(archive.recentlyArchived) ? archive.recentlyArchived : [];
        archiveRecentEl.innerHTML = recent.length
          ? recent.slice(0, 5).map(function (it) { return renderEntryCard(it, { compact: true }); }).join('')
          : '<div class="doc-sub">No archived entries yet.</div>';
        bindInlineFilterClicks(archiveRecentEl);
      }

      // Month dropdown
      if (archiveMonthSel) {
        var months = Array.isArray(archive.index) ? archive.index : [];
        archiveMonthSel.innerHTML = months.map(function (m) {
          var label = m.month + (m.count ? (' (' + m.count + ')') : '');
          return '<option value="' + esc(m.month) + '">' + esc(label) + '</option>';
        }).join('');

        // If no months yet, hide controls nicely
        if (!months.length) {
          archiveMonthSel.innerHTML = '<option value="">No archive months yet</option>';
          if (archiveLoadBtn) archiveLoadBtn.disabled = true;
        } else {
          if (archiveLoadBtn) archiveLoadBtn.disabled = false;
        }
      }
    }

    function loadArchiveMonth(month) {
      if (!month) return;
      if (!archiveListEl) return;

      archiveListEl.innerHTML = '<div class="doc-sub">Loading…</div>';

      fetch(workerBase.replace(/\/+$/, '') + '/changelog/archive?month=' + encodeURIComponent(month), { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (payload) {
          if (!payload || !payload.ok) throw new Error((payload && payload.error) || 'Archive fetch failed');
          var items = Array.isArray(payload.entries) ? payload.entries : [];
          items.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
          archiveListEl.innerHTML = items.length
            ? items.map(function (it) { return renderEntryCard(it); }).join('')
            : '<div class="doc-sub">No entries for this month.</div>';
          bindInlineFilterClicks(archiveListEl);
        })
        .catch(function (e) {
          archiveListEl.innerHTML = '<div class="doc-sub">Archive unavailable: ' + esc(String(e && e.message || e)) + '</div>';
        });
    }

    function boot() {
      setMeta('Loading changelog…');

      fetch('/status.json', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (status) {
          var base = status && status.worker && status.worker.base ? String(status.worker.base) : '';
          if (!base) throw new Error('Missing worker base in /status.json');
          workerBase = base.replace(/\/+$/, '');
          return fetch(workerBase + '/changelog', { cache: 'no-store' });
        })
        .then(function (r) { return r.json(); })
        .then(function (payload) {
          if (!payload || !payload.ok) throw new Error((payload && payload.error) || 'Worker changelog error');

          lastUpdated = payload.updatedAt || null;

          var items = (payload && payload.entries) ? payload.entries : [];
          items = (items || []).slice().sort(function (a, b) {
            return String(b.date || '').localeCompare(String(a.date || ''));
          });

          listEl.innerHTML = items.map(function (it) { return renderEntryCard(it); }).join('');
          bindInlineFilterClicks(listEl);

          buildFilters(items);

          filtersEl.addEventListener('click', function (e) {
            var t = e.target;
            if (!t) return;
            var key = t.getAttribute && t.getAttribute('data-filter');
            if (!key) return;
            applyFilter(key);
          });

          var active = (location.hash || '').replace('#', '').trim();
          if (!active) active = 'all';
          applyFilter(active);

          // Archive
          renderArchive(payload.archive || { enabled: false });

          if (archiveLoadBtn && archiveMonthSel) {
            archiveLoadBtn.addEventListener('click', function () {
              loadArchiveMonth(archiveMonthSel.value);
            });
            // auto-load first month for convenience
            if (archiveMonthSel.value) loadArchiveMonth(archiveMonthSel.value);
          }
        })
        .catch(function (e) {
          setMeta('Changelog unavailable: ' + String(e && e.message || e));
          listEl.innerHTML = '<div class="doc-card"><div class="doc-title">Changelog unavailable</div><div class="doc-sub" style="margin-top:6px">' + esc(String(e && e.message || e)) + '</div></div>';
          if (archiveWrap) archiveWrap.style.display = 'none';
        });
    }

    boot();
  });
})();
