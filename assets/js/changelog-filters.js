/* IRP Changelog Filters
   - Builds filter chips from categories already present on the page
   - Click chip to filter
   - Click the category pill on a card to filter to that category
   - Persists selection via URL hash (e.g. #core)
*/

(function () {
  function slugify(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var grid = document.querySelector('.doc-cardgrid');
    var host = document.getElementById('changelogFilters');
    if (!grid || !host) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.doc-card'));
    if (!cards.length) return;

    // Extract categories
    var cats = [];
    var map = Object.create(null);

    cards.forEach(function (card) {
      var pill = card.querySelector('.doc-pill');
      var label = pill ? pill.textContent.trim() : '';
      var slug = slugify(label || '');
      if (!slug) slug = 'other';
      card.dataset.cat = slug;
      card.dataset.catLabel = label || 'Other';

      if (!map[slug]) {
        map[slug] = label || 'Other';
        cats.push({ slug: slug, label: map[slug] });
      }

      // Make the pill clickable
      if (pill) {
        pill.classList.add('is-clickable');
        pill.setAttribute('role', 'button');
        pill.setAttribute('tabindex', '0');
        pill.addEventListener('click', function () {
          setFilter(slug);
        });
        pill.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFilter(slug);
          }
        });
      }
    });

    // Sort chips by label (stable and predictable)
    cats.sort(function (a, b) {
      return a.label.localeCompare(b.label);
    });

    function makeChip(label, value) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pill changelog-chip';
      btn.textContent = label;
      btn.dataset.value = value;
      btn.addEventListener('click', function () {
        setFilter(value);
      });
      return btn;
    }

    // Render chips
    host.innerHTML = '';
    host.appendChild(makeChip('All', 'all'));
    cats.forEach(function (c) {
      host.appendChild(makeChip(c.label, c.slug));
    });

    function setActiveChip(value) {
      host.querySelectorAll('.changelog-chip').forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.value === value);
      });
    }

    function setFilter(value) {
      var v = value || 'all';
      setActiveChip(v);
      cards.forEach(function (card) {
        var show = v === 'all' || card.dataset.cat === v;
        card.style.display = show ? 'block' : 'none';
      });

      // Update URL hash (but keep it clean for "All")
      if (v === 'all') {
        if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      } else {
        if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
      }
    }

    // Initial filter from hash
    var initial = (location.hash || '').replace('#', '').trim();
    if (initial && map[initial]) setFilter(initial);
    else setFilter('all');
  });
})();
