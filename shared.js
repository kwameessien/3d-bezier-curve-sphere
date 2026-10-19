/**
 * Shared helpers for every page: route data, curve maths, storage,
 * share links and the SVG "plate" renderer used for static sphere drawings.
 *
 * Exposed as window.BezierSphere (aliased BS inside this file).
 */
;(function(){
  var BS = {};
  var DEG = Math.PI / 180;

  // Sphere radius used by the Three.js scene (scene units)
  BS.RADIUS = 20;

  BS.PRESETS = [
    { id: 'nyc-london',    name: 'NYC → London',    a: [40.71, -74.01],  b: [51.51, -0.13] },
    { id: 'equator',       name: 'Equator 0°→90°',  a: [0, 0],           b: [0, 90] },
    { id: 'sydney-tokyo',  name: 'Sydney → Tokyo',  a: [-33.87, 151.21], b: [35.68, 139.69] },
    { id: 'paris-tokyo',   name: 'Paris → Tokyo',   a: [48.86, 2.35],    b: [35.68, 139.69] },
    { id: 'pole-to-pole',  name: 'Pole to pole',    a: [-90, 0],         b: [90, 0] },
    { id: 'la-nyc',        name: 'LA → NYC',        a: [34.05, -118.24], b: [40.71, -74.01] }
  ];

  BS.DEFAULT_SETTINGS = {
    opacity: 0.6,
    tubeRadius: 0.4,
    curveColor: '#E0464E',
    rotationSpeed: 0.01,
    theme: 'paper',
    graticule: true
  };

  // Canvas palettes for the visualizer and settings preview
  BS.THEMES = {
    paper:     { bg: '#EFECE4', sphere: '#FFFFFF', shade: '#B9B6AE', grid: '#141414', gridOpacity: 0.28 },
    blueprint: { bg: '#1D3B6E', sphere: '#2A4F8F', shade: '#16305C', grid: '#DCE6F5', gridOpacity: 0.4 },
    night:     { bg: '#0F1115', sphere: '#30333A', shade: '#15171B', grid: '#F6F4EE', gridOpacity: 0.22 }
  };

  /////  Geometry  /////

  /**
   * Converts latitude/longitude (degrees) to a unit vector.
   * y is up; longitude 0 lies on +x and east runs towards -z, so the globe
   * reads correctly (east on the right) when viewed from outside.
   */
  BS.toUnit = function(lat, lon) {
    var la = lat * DEG, lo = lon * DEG;
    return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)];
  };

  BS.toLatLon = function(v) {
    var len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [Math.asin(v[1] / len) / DEG, Math.atan2(-v[2], v[0]) / DEG];
  };

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  /**
   * Computes the control point of the quadratic Bézier between two unit vectors.
   *
   * P1 = M̂ · k, where M̂ is the direction of the chord midpoint and θ the angle
   * between the points. k = 1/cos(θ/2) is where the curve would leave the
   * surface tangentially; adding 0.7·sin(θ/2) lifts it clear, more for longer
   * routes. Above 2.2, k is eased towards 3 so near-antipodal arcs stay on
   * screen (they dip just under the surface at their ends — a single quadratic
   * can't leave tangentially from opposite points). Antipodal points have no
   * unique midpoint, so a perpendicular is used.
   *
   * @returns {{dir:number[], k:number, theta:number, apex:number}} in sphere radii
   */
  BS.arc = function(u0, u2) {
    var theta = Math.acos(Math.max(-1, Math.min(1, dot(u0, u2))));
    var half = Math.cos(theta / 2);
    var mid = [(u0[0] + u2[0]) / 2, (u0[1] + u2[1]) / 2, (u0[2] + u2[2]) / 2];
    var dir;
    if (Math.sqrt(dot(mid, mid)) > 1e-6) {
      dir = norm(mid);
    } else if (Math.abs(u0[1]) > 0.999) {
      // Pole to pole: bow the arc out over longitude 0
      dir = [1, 0, 0];
    } else {
      // Other antipodes: bow the arc towards the north pole
      dir = norm(cross(cross(u0, [0, 1, 0]), u0));
    }
    var k = half > 1e-9 ? 1 / half + 0.7 * Math.sin(theta / 2) : Infinity;
    if (k > 2.2) k = 2.2 + 0.8 * Math.tanh((k - 2.2) / 0.8);
    return { dir: dir, k: k, theta: theta, apex: (half + k) / 2 };
  };

  BS.distanceKm = function(a, b) {
    var p1 = a[0] * DEG, p2 = b[0] * DEG, dl = (b[1] - a[1]) * DEG, dp = p2 - p1;
    var h = Math.pow(Math.sin(dp / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin(dl / 2), 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  /////  Formatting  /////

  BS.formatKm = function(km) {
    return String(Math.round(km)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' km';
  };

  BS.formatPoint = function(p) {
    return Math.abs(p[0]).toFixed(2) + '°' + (p[0] >= 0 ? 'N' : 'S') + ' ' +
           Math.abs(p[1]).toFixed(2) + '°' + (p[1] >= 0 ? 'E' : 'W');
  };

  BS.formatRoute = function(a, b) {
    return BS.formatPoint(a) + ' → ' + BS.formatPoint(b);
  };

  BS.escapeHtml = function(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  };

  BS.clampPoint = function(lat, lon) {
    return [Math.max(-90, Math.min(90, lat)), Math.max(-180, Math.min(180, lon))];
  };

  /////  Storage (wrapped: storage can throw in private windows)  /////

  function readJson(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }

  BS.loadSettings = function() {
    var s = readJson('bezierVisualizerSettings', {});
    var out = {};
    for (var k in BS.DEFAULT_SETTINGS) out[k] = s[k] != null ? s[k] : BS.DEFAULT_SETTINGS[k];
    if (!BS.THEMES[out.theme]) out.theme = 'paper';
    return out;
  };

  BS.saveSettings = function(s) { return writeJson('bezierVisualizerSettings', s); };

  BS.getSavedRoutes = function() {
    var list = readJson('bezierSavedRoutes', []);
    return Array.isArray(list) ? list : [];
  };

  BS.setSavedRoutes = function(list) { return writeJson('bezierSavedRoutes', list); };

  /////  Share links  /////

  function fixed(n) { return String(Math.round(n * 100) / 100); }

  /** Relative link that opens the visualizer on a route, e.g. visualizer.html?a=40.71,-74.01&b=51.51,-0.13 */
  BS.routeHref = function(a, b, name) {
    var q = 'a=' + fixed(a[0]) + ',' + fixed(a[1]) + '&b=' + fixed(b[0]) + ',' + fixed(b[1]);
    if (name) q += '&name=' + encodeURIComponent(name);
    return 'visualizer.html?' + q;
  };

  BS.absoluteUrl = function(href) {
    return new URL(href, window.location.href).href;
  };

  /** Parses ?a=lat,lon&b=lat,lon[&name=…]; returns null when absent or invalid. */
  BS.parseRouteQuery = function(search) {
    var params = new URLSearchParams(search);
    function pt(v) {
      if (!v) return null;
      var parts = v.split(',').map(parseFloat);
      if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
      return BS.clampPoint(parts[0], parts[1]);
    }
    var a = pt(params.get('a')), b = pt(params.get('b'));
    if (!a || !b) return null;
    return { a: a, b: b, name: (params.get('name') || '').slice(0, 80) };
  };

  BS.copyText = function(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function(resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  };

  /////  SVG plates  /////

  var plateCount = 0;

  /**
   * Longitude to centre a plate on a route: the arc's apex, turned up to 40° aside
   * for mostly north–south routes, which would otherwise be seen edge-on as a line.
   */
  BS.routeCenter = function(a, b) {
    var arc = BS.arc(BS.toUnit(a[0], a[1]), BS.toUnit(b[0], b[1]));
    var dLat = Math.abs(b[0] - a[0]);
    var dLon = Math.abs(b[1] - a[1]);
    if (dLon > 180) dLon = 360 - dLon;
    return BS.toLatLon(arc.dir)[1] - 40 * dLat / (dLat + dLon + 1e-6);
  };

  /**
   * Draws an orthographic sphere with graticule and Bézier arcs as an SVG string.
   * opts: routes [[a,b],…], size, center (lon at the middle), tilt (deg),
   *       step (graticule spacing, 0 = none), style 'wire'|'dotted'|'shaded',
   *       labels, control, color, width, opacity, theme
   */
  BS.plateSVG = function(opts) {
    var o = opts || {};
    var size = o.size || 300;
    var R = size / 2 - (o.pad != null ? o.pad : size * 0.08);
    var c = size / 2;
    var theme = BS.THEMES[o.theme] || BS.THEMES.paper;
    var ink = o.theme && o.theme !== 'paper' ? theme.grid : '#141414';
    var red = o.color || '#E0464E';
    var arcW = o.width || 2.2;
    var sw = o.stroke || 0.8;
    var routes = o.routes || [];
    var center = o.center != null ? o.center : (routes.length ? BS.routeCenter(routes[0][0], routes[0][1]) : 0);
    var alpha = -(90 + center) * DEG;
    var tilt = (o.tilt != null ? o.tilt : 18) * DEG;
    var id = 'plate' + (++plateCount);
    var mono = "font-family=\"'IBM Plex Mono', ui-monospace, monospace\"";

    function view(v) {
      var x = v[0] * Math.cos(alpha) + v[2] * Math.sin(alpha);
      var z = -v[0] * Math.sin(alpha) + v[2] * Math.cos(alpha);
      var y = v[1];
      return [x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
    }

    function screen(p) { return [c + R * p[0], c - R * p[1]]; }

    // Splits a projected polyline into front-facing and hidden runs
    function split(points) {
      var front = [], back = [], cur = [], side = null;
      points.forEach(function(p) {
        var s = p[2] >= 0;
        if (side !== null && s !== side && cur.length) {
          (side ? front : back).push(cur);
          cur = [cur[cur.length - 1]];
        }
        side = s;
        cur.push(screen(p));
      });
      if (cur.length) (side ? front : back).push(cur);
      function d(run) {
        return 'M' + run.map(function(q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L');
      }
      return {
        front: front.filter(function(r) { return r.length > 1; }).map(d),
        back: back.filter(function(r) { return r.length > 1; }).map(d)
      };
    }

    function path(d, attrs) { return '<path d="' + d + '" fill="none" ' + attrs + '/>'; }

    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + BS.escapeHtml(o.label || 'Sphere with Bézier arc') + '">';

    if (o.style === 'shaded') {
      s += '<defs><radialGradient id="' + id + '" cx="0.38" cy="0.32" r="0.72">' +
           '<stop offset="0" stop-color="' + (o.theme && o.theme !== 'paper' ? theme.sphere : '#FFFFFF') + '"/>' +
           '<stop offset="0.55" stop-color="' + (o.theme && o.theme !== 'paper' ? theme.sphere : '#E7E5E0') + '"/>' +
           '<stop offset="1" stop-color="' + theme.shade + '"/></radialGradient></defs>';
      s += '<circle cx="' + c + '" cy="' + c + '" r="' + R + '" fill="url(#' + id + ')" fill-opacity="' + (o.opacity != null ? o.opacity : 1) + '"/>';
    }

    if (o.style === 'dotted') {
      s += '<circle cx="' + c + '" cy="' + c + '" r="' + R + '" fill="none" stroke="' + ink + '" stroke-width="1.6" stroke-dasharray="1.2 4.2" stroke-linecap="round"/>';
    } else {
      s += '<circle cx="' + c + '" cy="' + c + '" r="' + R + '" fill="none" stroke="' + ink + '" stroke-width="' + (sw * 1.2) + '"/>';
    }

    var step = o.step != null ? o.step : 30;
    if (step > 0) {
      var lines = [], lat, lon, pts;
      for (lon = -180; lon < 180; lon += step) {
        pts = [];
        for (lat = -90; lat <= 90; lat += 4) pts.push(view(BS.toUnit(lat, lon)));
        lines.push(pts);
      }
      for (lat = -90 + step; lat < 90; lat += step) {
        pts = [];
        for (lon = -180; lon <= 180; lon += 4) pts.push(view(BS.toUnit(lat, lon)));
        lines.push(pts);
      }
      lines.forEach(function(line) {
        var parts = split(line);
        parts.front.forEach(function(d) { s += path(d, 'stroke="' + ink + '" stroke-opacity="0.55" stroke-width="' + (sw * 0.6) + '"'); });
        parts.back.forEach(function(d) { s += path(d, 'stroke="' + ink + '" stroke-opacity="0.18" stroke-width="' + (sw * 0.5) + '" stroke-dasharray="2 3"'); });
      });
    }

    var marks = '';
    routes.forEach(function(rt, i) {
      var u0 = BS.toUnit(rt[0][0], rt[0][1]), u2 = BS.toUnit(rt[1][0], rt[1][1]);
      var arc = BS.arc(u0, u2);
      var p1 = [arc.dir[0] * arc.k, arc.dir[1] * arc.k, arc.dir[2] * arc.k];
      var pts = [];
      for (var n = 0; n <= 80; n++) {
        var t = n / 80, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t;
        pts.push(view([a * u0[0] + b * p1[0] + d * u2[0], a * u0[1] + b * p1[1] + d * u2[1], a * u0[2] + b * p1[2] + d * u2[2]]));
      }
      var parts = split(pts);
      parts.back.forEach(function(dd) { s += path(dd, 'stroke="' + red + '" stroke-opacity="0.45" stroke-width="' + (arcW * 0.6) + '" stroke-dasharray="3 3"'); });
      parts.front.forEach(function(dd) { s += path(dd, 'stroke="' + red + '" stroke-width="' + arcW + '" stroke-linecap="round"'); });

      var e0 = screen(pts[0]), e2 = screen(pts[80]);
      var dotR = Math.max(3, size / 90).toFixed(1);
      var fs = Math.max(10, Math.round(size / 48));
      if (o.control && i === 0) {
        var cp = screen(view(p1));
        s += path('M' + e0[0].toFixed(1) + ' ' + e0[1].toFixed(1) + ' L' + cp[0].toFixed(1) + ' ' + cp[1].toFixed(1) + ' L' + e2[0].toFixed(1) + ' ' + e2[1].toFixed(1), 'stroke="' + ink + '" stroke-width="0.8" stroke-dasharray="4 3"');
        s += '<rect x="' + (cp[0] - 3).toFixed(1) + '" y="' + (cp[1] - 3).toFixed(1) + '" width="6" height="6" fill="' + ink + '"/>';
        marks += '<text x="' + (cp[0] + 8).toFixed(1) + '" y="' + (cp[1] - 4).toFixed(1) + '" ' + mono + ' font-size="' + fs + '" fill="' + ink + '">P₁</text>';
      }
      [e0, e2].forEach(function(e, j) {
        s += '<circle cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="' + dotR + '" fill="#F6F4EE" stroke="#141414" stroke-width="1.2"/>';
        if (i === 0 && (o.labels || o.control)) {
          var txt = o.control ? (j ? 'P₂' : 'P₀') : (j ? 'end' : 'start');
          marks += '<text x="' + (e[0] + (j ? 9 : -9)).toFixed(1) + '" y="' + (e[1] + fs / 3).toFixed(1) + '" text-anchor="' + (j ? 'start' : 'end') + '" ' + mono + ' font-size="' + fs + '" fill="' + ink + '">' + txt + '</text>';
        }
      });
    });

    return s + marks + '</svg>';
  };

  /** Plot for the Method page: apex height of the arc against angular distance. */
  BS.apexPlotSVG = function() {
    var w = 560, h = 300, L = 56, T = 20, W = 480, H = 230, ymin = 1, ymax = 1.8;
    var mono = "font-family=\"'IBM Plex Mono', ui-monospace, monospace\"";
    function Y(v) { return T + H - (v - ymin) / (ymax - ymin) * H; }
    function X(deg) { return L + W * deg / 180; }
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Plot of arc apex height against angular distance">';
    s += '<rect x="' + L + '" y="' + T + '" width="' + W + '" height="' + H + '" fill="none" stroke="#141414"/>';
    var i;
    for (i = 1; i < 6; i++) s += '<path d="M' + X(i * 30) + ' ' + T + ' V' + (T + H) + '" stroke="#141414" stroke-opacity="0.5" stroke-width="0.6" stroke-dasharray="6 4"/>';
    [1.2, 1.4, 1.6].forEach(function(v) { s += '<path d="M' + L + ' ' + Y(v) + ' H' + (L + W) + '" stroke="#141414" stroke-opacity="0.5" stroke-width="0.6" stroke-dasharray="6 4"/>'; });
    var pts = [];
    for (i = 0; i <= 180; i += 2) {
      var arc = BS.arc(BS.toUnit(0, 0), BS.toUnit(0, i));
      pts.push(X(i).toFixed(1) + ' ' + Y(arc.apex).toFixed(1));
    }
    s += '<path d="M' + pts.join(' L') + '" fill="none" stroke="#141414" stroke-width="2"/>';
    s += '<path d="M' + L + ' ' + (Y(1) - 1) + ' H' + (L + W) + '" stroke="#E0464E" stroke-width="1.6"/>';
    for (i = 0; i <= 6; i++) s += '<text x="' + X(i * 30) + '" y="' + (T + H + 18) + '" text-anchor="middle" ' + mono + ' font-size="11" fill="#141414">' + (i * 30) + '</text>';
    [1, 1.2, 1.4, 1.6, 1.8].forEach(function(v) { s += '<text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" ' + mono + ' font-size="11" fill="#141414">' + v.toFixed(1) + '</text>'; });
    s += '<text x="' + (L + W / 2) + '" y="' + (h - 6) + '" text-anchor="middle" ' + mono + ' font-size="11" fill="#55524B">angular distance θ (deg.)</text>';
    s += '<text x="' + (L + 8) + '" y="' + (T + 16) + '" ' + mono + ' font-size="11" fill="#55524B">apex height (× r)</text>';
    s += '<text x="' + (L + W - 8) + '" y="' + (Y(1) - 8) + '" text-anchor="end" ' + mono + ' font-size="11" fill="#E0464E">sphere surface</text>';
    return s + '</svg>';
  };

  function parsePoint(v) {
    if (!v) return null;
    var p = v.split(',').map(parseFloat);
    return p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]) ? p : null;
  }

  /**
   * Renders every element with data-plate="wire|dotted|shaded" (and data-a / data-b
   * as "lat,lon"; optional data-a2/data-b2, data-size, data-step, data-tilt,
   * data-center, data-labels, data-control, data-width) or data-plot="apex".
   */
  BS.renderPlates = function(root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-plate]'), function(el) {
      var d = el.dataset, routes = [];
      var a = parsePoint(d.a), b = parsePoint(d.b), a2 = parsePoint(d.a2), b2 = parsePoint(d.b2);
      if (a && b) routes.push([a, b]);
      if (a2 && b2) routes.push([a2, b2]);
      el.innerHTML = BS.plateSVG({
        routes: routes,
        style: d.plate,
        size: d.size ? +d.size : 300,
        step: d.step != null ? +d.step : (d.plate === 'dotted' ? 0 : 30),
        tilt: d.tilt != null ? +d.tilt : undefined,
        center: d.center != null ? +d.center : undefined,
        labels: d.labels != null,
        control: d.control != null,
        width: d.width ? +d.width : undefined,
        stroke: d.stroke ? +d.stroke : undefined,
        label: el.getAttribute('aria-label') || d.title
      });
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-plot="apex"]'), function(el) {
      el.innerHTML = BS.apexPlotSVG();
    });
  };

  /////  Page chrome  /////

  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('main-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function() {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    initNav();
    BS.renderPlates();
  });

  window.BezierSphere = BS;
})();
