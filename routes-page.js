/**
 * Routes page: renders preset and saved routes as cards with dotted-globe plates,
 * with filtering, sorting by distance, share links and deleting saved routes.
 */
(function() {
  var BS = window.BezierSphere;
  var state = { filter: 'all', byDistance: false };

  function allRoutes() {
    var presets = BS.PRESETS.map(function(p) {
      return { kind: 'preset', id: p.id, name: p.name, a: p.a, b: p.b };
    });
    var saved = BS.getSavedRoutes().map(function(r) {
      return { kind: 'saved', id: String(r.id), name: r.name || 'Unnamed', a: [r.latA, r.lonA], b: [r.latB, r.lonB] };
    });
    return presets.concat(saved).map(function(r, i) {
      r.no = i + 1;
      r.km = BS.distanceKm(r.a, r.b);
      return r;
    });
  }

  function card(r) {
    var href = BS.routeHref(r.a, r.b, r.name);
    var no = (r.no < 10 ? '0' : '') + r.no;
    var tag = r.kind === 'saved' ? '<span class="tag tag--red">Saved</span>' : '<span class="tag tag--stone">Preset</span>';
    var del = r.kind === 'saved'
      ? '<button type="button" class="btn btn--sm btn--danger" data-delete="' + BS.escapeHtml(r.id) + '" aria-label="Delete ' + BS.escapeHtml(r.name) + '">✕</button>'
      : '';
    return '<article class="route-card">' +
      '<div class="route-card-head"><span class="coords">No. ' + no + '</span>' + tag + '</div>' +
      '<a href="' + href + '" class="plate" data-plate="dotted" data-a="' + r.a.join(',') + '" data-b="' + r.b.join(',') + '" data-size="220" data-width="2"' +
        (r.no % 3 === 1 ? ' data-step="45" data-stroke="0.5"' : '') + ' aria-label="Open ' + BS.escapeHtml(r.name) + ' in the visualizer"></a>' +
      '<h2>' + BS.escapeHtml(r.name) + '</h2>' +
      '<div class="route-card-meta"><span class="coords">' + BS.formatPoint(r.a) + '<br>' + BS.formatPoint(r.b) + '</span>' +
        '<span class="km">' + BS.formatKm(r.km) + '</span></div>' +
      '<div class="route-card-actions">' +
        '<a href="' + href + '" class="btn btn--sm">Open</a>' +
        '<button type="button" class="btn btn--sm" data-share="' + href + '" aria-label="Copy link to ' + BS.escapeHtml(r.name) + '">⧉ Link</button>' +
        del +
      '</div></article>';
  }

  function render() {
    var routes = allRoutes();
    var counts = { all: routes.length, preset: 0, saved: 0 };
    routes.forEach(function(r) { counts[r.kind]++; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-count]'), function(el) {
      el.textContent = counts[el.getAttribute('data-count')];
    });

    var shown = routes.filter(function(r) { return state.filter === 'all' || r.kind === state.filter; });
    if (state.byDistance) shown.sort(function(x, y) { return y.km - x.km; });

    var grid = document.getElementById('route-grid');
    if (!shown.length) {
      grid.innerHTML = '<div class="route-empty"><p class="caption">No saved routes yet.</p><p style="margin-top: 16px;"><a href="visualizer.html" class="btn btn--sm btn--primary">Draw and save one →</a></p></div>';
      return;
    }
    grid.innerHTML = shown.map(card).join('');
    BS.renderPlates(grid);
  }

  function announce(text) {
    document.getElementById('route-status').textContent = text;
  }

  document.addEventListener('DOMContentLoaded', function() {
    render();

    document.querySelector('.filters').addEventListener('click', function(e) {
      var chip = e.target.closest('[data-filter]');
      if (chip) {
        state.filter = chip.getAttribute('data-filter');
        Array.prototype.forEach.call(document.querySelectorAll('[data-filter]'), function(el) {
          el.setAttribute('aria-pressed', el === chip);
        });
        render();
      }
      if (e.target.closest('#sort-toggle')) {
        state.byDistance = !state.byDistance;
        var btn = document.getElementById('sort-toggle');
        btn.setAttribute('aria-pressed', state.byDistance);
        btn.textContent = state.byDistance ? 'Sort: distance ↓' : 'Sort: catalogue';
        render();
      }
    });

    document.getElementById('route-grid').addEventListener('click', function(e) {
      var share = e.target.closest('[data-share]');
      if (share) {
        var url = BS.absoluteUrl(share.getAttribute('data-share'));
        BS.copyText(url).then(function() {
          share.textContent = 'Copied ✓';
          announce('Link copied to clipboard');
          setTimeout(function() { share.textContent = '⧉ Link'; }, 1800);
        }, function() {
          window.prompt('Copy this link:', url);
        });
      }
      var del = e.target.closest('[data-delete]');
      if (del) {
        var id = del.getAttribute('data-delete');
        BS.setSavedRoutes(BS.getSavedRoutes().filter(function(r) { return String(r.id) !== id; }));
        announce('Route deleted');
        render();
      }
    });
  });
})();
