/**
 * 3D Sphere Visualization Application
 *
 * This application creates an interactive 3D visualization of a sphere using Three.js.
 * Users can input two geographic coordinates (latitude/longitude pairs) and the application
 * will draw a Bezier curve connecting these points on the surface of the sphere.
 *
 * Architecture: MVC (Model-View-Controller) pattern
 * - Model: Handles data and coordinate calculations
 * - View: Manages Three.js scene, rendering, and visual elements
 * - Controller: Coordinates user interactions and connects View and Model
 *
 * Shared maths, presets and storage live in shared.js (window.BezierSphere).
 */

// Immediately-invoked function expression (IIFE) to encapsulate code and avoid global scope pollution
;(function(){
  var BS = window.BezierSphere;

  // Wait for DOM to be ready before initializing the application
  $(function(){
    // Instantiate the three main components of the MVC architecture
    var sonicPlayerView = new SonicPlayerView();        // Handles 3D rendering and visualization
    var sonicPlayerModel = new SonicPlayerModel();     // Manages data and coordinate calculations
    var sonicPlayerController= new SonicPlayerController( sonicPlayerView , sonicPlayerModel);

    // Initialize the application - sets up the scene, starts rendering, and binds event handlers
    sonicPlayerController.init();
  });

  ///////////////////
  /////  CONTROLLER  ///////////////////
  /**
   * SonicPlayerController - Coordinates user interactions and manages communication
   * between the View and Model components.
   *
   * @param {SonicPlayerView} aSonicPlayerView - The view instance for rendering
   * @param {SonicPlayerModel} aSonicPlayerModel - The model instance for data management
   */
  function SonicPlayerController ( aSonicPlayerView, aSonicPlayerModel ) {
    this.view = aSonicPlayerView;   // Reference to the view component
    this.model = aSonicPlayerModel; // Reference to the model component
    this.current = null;            // Last drawn route { a, b, name }
  }

  SonicPlayerController.prototype = {
    /**
     * Initializes the application by:
     * 1. Setting up the 3D scene
     * 2. Starting the render loop
     * 3. Binding event handlers for user interactions
     * 4. Drawing the route from the URL (or the first preset)
     */
    init: function() {
      var scope = this; // Preserve 'this' context for use in event handlers
      var settings = BS.loadSettings();

      // Initialize the Three.js scene with sphere, camera, lights, OrbitControls, etc.
      scope.view.initThreeDimensionalScene(document.getElementById('canvas'), settings);
      $('#stage').attr('data-theme', settings.theme);

      // Start the continuous rendering/animation loop
      scope.view.render();

      scope.renderPresets();
      scope.renderSavedRoutesList();
      scope.bindEvents();

      // A shared link (?a=lat,lon&b=lat,lon) wins over the default route
      var fromUrl = BS.parseRouteQuery(window.location.search);
      var first = fromUrl || { a: BS.PRESETS[0].a, b: BS.PRESETS[0].b, name: BS.PRESETS[0].name };
      scope.setInputs(first.a, first.b);
      scope.drawRoute(first.a, first.b, first.name, { focus: true, updateUrl: !!fromUrl });
    },

    showMessage: function(text, isError) {
      $('#message').text(text).toggleClass('error', !!isError);
    },

    showToast: function(text) {
      var $t = $('#toast');
      $t.text(text).addClass('is-visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(function() { $t.removeClass('is-visible'); }, 2200);
    },

    setInputs: function(a, b) {
      $('#latitudeA').val(a[0]); $('#longitudeA').val(a[1]);
      $('#latitudeB').val(b[0]); $('#longitudeB').val(b[1]);
    },

    // Parse and validate lat/lon; returns { valid, a: [lat, lon], b: [lat, lon] } with clamped numbers
    getValidatedCoordinates: function() {
      var ids = ['latitudeA', 'longitudeA', 'latitudeB', 'longitudeB'];
      var vals = ids.map(function(id) { return parseFloat($('#' + id).val()); });
      var valid = true;
      ids.forEach(function(id, i) {
        var bad = isNaN(vals[i]);
        $('#' + id).attr('aria-invalid', bad);
        if (bad) valid = false;
      });
      if (!valid) return { valid: false };
      return { valid: true, a: BS.clampPoint(vals[0], vals[1]), b: BS.clampPoint(vals[2], vals[3]) };
    },

    drawFromInputs: function() {
      var coords = this.getValidatedCoordinates();
      if (!coords.valid) {
        this.showMessage('Please enter valid numbers for all coordinates.', true);
        return;
      }
      this.setInputs(coords.a, coords.b);
      this.drawRoute(coords.a, coords.b, this.matchPresetName(coords.a, coords.b), { updateUrl: true });
    },

    matchPresetName: function(a, b) {
      var match = BS.PRESETS.filter(function(p) {
        return p.a[0] === a[0] && p.a[1] === a[1] && p.b[0] === b[0] && p.b[1] === b[1];
      })[0];
      return match ? match.name : '';
    },

    /**
     * Computes and draws one route, then refreshes the caption, readout and share URL.
     * options: focus (turn the camera to face it), updateUrl (write ?a&b to the address bar)
     */
    drawRoute: function(a, b, name, options) {
      var opts = options || {};
      if (BS.distanceKm(a, b) < 1) {
        this.showMessage('Points A and B are the same — move one of them to draw a curve.', true);
        return;
      }
      this.showMessage('');
      this.model.calcSpatialCoordinate(a[0], a[1], b[0], b[1]);
      this.view.addBezierCurve(this.model.spaceCoordinatesDataBox);
      if (opts.focus) this.view.focusOn(this.model.spaceCoordinatesDataBox);

      this.current = { a: a, b: b, name: name || '' };
      $('#route-title').text(name || 'Custom route');
      $('#route-coords').text(BS.formatRoute(a, b));
      var km = BS.formatKm(BS.distanceKm(a, b));
      $('#readout-distance, #panel-distance').text(km);
      $('#readout-lift').text(this.model.spaceCoordinatesDataBox.lift.toFixed(2) + ' r');
      $('#readout-curves').text(this.view.curveMeshes.length);
      $('#preset-list .list-row').each(function() {
        $(this).attr('aria-current', $(this).data('name') === name ? 'true' : 'false');
      });

      if (opts.updateUrl && window.history && history.replaceState) {
        history.replaceState(null, '', BS.routeHref(a, b, name));
      }
    },

    renderPresets: function() {
      var html = BS.PRESETS.map(function(p, i) {
        return '<li><button type="button" class="list-row" data-index="' + i + '" data-name="' + BS.escapeHtml(p.name) + '">' +
          '<span>' + BS.escapeHtml(p.name) + '</span><span class="coords">' + BS.formatKm(BS.distanceKm(p.a, p.b)) + '</span></button></li>';
      }).join('');
      $('#preset-list').html(html);
    },

    renderSavedRoutesList: function() {
      var list = BS.getSavedRoutes();
      var html = list.length === 0
        ? '<li class="empty">No saved routes yet.</li>'
        : list.map(function(r) {
            return '<li class="saved-item" data-id="' + BS.escapeHtml(r.id) + '">' +
              '<button type="button" class="list-row saved-route-load"><span>' + BS.escapeHtml(r.name || 'Unnamed') + '</span>' +
              '<span class="coords">' + BS.formatKm(BS.distanceKm([r.latA, r.lonA], [r.latB, r.lonB])) + '</span></button>' +
              '<button type="button" class="saved-delete" aria-label="Delete ' + BS.escapeHtml(r.name || 'route') + '">Delete</button></li>';
          }).join('');
      $('#saved-routes-list').html(html);
    },

    setPanelVisible: function(visible) {
      $('#controls-panel').prop('hidden', !visible);
      $('#toggle-controls').attr('aria-expanded', visible).text(visible ? 'Hide panel · H' : 'Show panel · H');
      $('#show-panel').prop('hidden', visible);
      try { localStorage.setItem('bezierControlsVisible', visible ? '1' : '0'); } catch (_) {}
      this.view.resize();
    },

    bindEvents: function() {
      var scope = this;

      $('#bezier-form').on('submit', function(e) {
        e.preventDefault();
        scope.drawFromInputs();
      });

      $('#clear-curves').on('click', function() {
        scope.view.clearCurves();
        $('#readout-curves').text('0');
        scope.showMessage('');
      });

      $('#pause-rotation').on('click', function() {
        scope.view.rotationPaused = !scope.view.rotationPaused;
        $(this).attr('aria-pressed', scope.view.rotationPaused)
          .text(scope.view.rotationPaused ? '▶ Resume' : '❚❚ Pause');
      });

      $('#reset-view').on('click', function() {
        scope.view.focusOn(scope.model.spaceCoordinatesDataBox);
      });

      $('#export-png').on('click', function() {
        var c = scope.current;
        scope.view.exportPNG({
          title: c ? (c.name || 'Custom route') : 'Bézier Sphere',
          coords: c ? BS.formatRoute(c.a, c.b) : '',
          distance: c ? BS.formatKm(BS.distanceKm(c.a, c.b)) : ''
        });
      });

      $('#share-link').on('click', function() {
        var c = scope.current;
        if (!c) return;
        var url = BS.absoluteUrl(BS.routeHref(c.a, c.b, c.name));
        BS.copyText(url).then(function() {
          scope.showToast('Link copied to clipboard');
        }, function() {
          window.prompt('Copy this link:', url);
        });
      });

      // Preset buttons: fill inputs and draw curve
      $('#preset-list').on('click', '.list-row', function() {
        var p = BS.PRESETS[$(this).data('index')];
        scope.setInputs(p.a, p.b);
        scope.drawRoute(p.a, p.b, p.name, { focus: true, updateUrl: true });
      });

      // Saved routes (localStorage key: bezierSavedRoutes)
      $('#save-route-form').on('submit', function(e) {
        e.preventDefault();
        var coords = scope.getValidatedCoordinates();
        if (!coords.valid) {
          scope.showMessage('Enter valid coordinates first, then save.', true);
          return;
        }
        var list = BS.getSavedRoutes();
        var name = $.trim($('#saved-route-name').val()) || 'Route ' + (list.length + 1);
        list.push({
          id: Date.now(),
          name: name,
          latA: coords.a[0], lonA: coords.a[1],
          latB: coords.b[0], lonB: coords.b[1]
        });
        if (!BS.setSavedRoutes(list)) {
          scope.showMessage('Could not save — browser storage is unavailable.', true);
          return;
        }
        scope.renderSavedRoutesList();
        $('#saved-route-name').val('');
        scope.showMessage('Route saved.');
      });
      $('#saved-routes-list').on('click', '.saved-route-load', function() {
        var id = String($(this).closest('.saved-item').data('id'));
        var r = BS.getSavedRoutes().filter(function(x) { return String(x.id) === id; })[0];
        if (!r) return;
        var a = [r.latA, r.lonA], b = [r.latB, r.lonB];
        scope.setInputs(a, b);
        scope.drawRoute(a, b, r.name, { focus: true, updateUrl: true });
      });
      $('#saved-routes-list').on('click', '.saved-delete', function() {
        var id = String($(this).closest('.saved-item').data('id'));
        BS.setSavedRoutes(BS.getSavedRoutes().filter(function(x) { return String(x.id) !== id; }));
        scope.renderSavedRoutesList();
        scope.showMessage('');
      });

      // Panel visibility (button, "Show panel" chip and the H key)
      var visible = true;
      try { visible = localStorage.getItem('bezierControlsVisible') !== '0'; } catch (_) {}
      if (window.matchMedia('(max-width: 860px)').matches) visible = true;
      scope.setPanelVisible(visible);
      $('#toggle-controls, #show-panel').on('click', function() {
        scope.setPanelVisible($('#controls-panel').prop('hidden'));
      });

      $(document).on('keydown', function(e) {
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          scope.setPanelVisible($('#controls-panel').prop('hidden'));
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          scope.drawFromInputs();
        }
      });
    }
  }

  /////////////
  /////  VIEW  /////////////
  /**
   * SonicPlayerView - Manages all Three.js rendering and visualization.
   * Handles scene setup, camera control, animation, and drawing Bezier curves.
   */
  function SonicPlayerView() {
    this.scene = null;           // Three.js scene container for all 3D objects
    this.camera = null;          // Camera that defines the viewing perspective
    this.renderer = null;        // WebGL renderer that draws the scene
    this.controls = null;        // OrbitControls for drag/zoom
    this.container = null;       // Element the canvas fills
    this.sphereMaterial = null;  // Reference to sphere material for opacity/theme
    this.graticule = null;       // Latitude/longitude line set
    this.isAnimating = false;    // Flag to track if animation loop is running
    this.curveMeshes = [];       // One group (tube + end markers) per curve, for clear/dispose
    this.animations = [];        // Curves currently being drawn on
    this.rotationPaused = false; // When true, auto-rotation is paused
    this.rotationSpeed = 0.01;   // Camera orbit speed (configurable)
    this.tubeRadius = 0.4;       // Curve thickness (configurable)
    this.curveColor = 0xE0464E;  // Curve color hex (configurable)
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  SonicPlayerView.prototype = {
    /**
     * Initializes the Three.js 3D scene with:
     * - Scene container and themed background
     * - Perspective camera with a light that travels with it
     * - WebGL renderer sized to the container
     * - Translucent sphere plus a latitude/longitude graticule
     * - OrbitControls and resize handling
     *
     * @param {HTMLElement} container - Element the canvas should fill
     * @param {Object} settings - Saved settings (see BezierSphere.DEFAULT_SETTINGS)
     */
    initThreeDimensionalScene: function(container, settings){
      this.container = container;
      this.scene = new THREE.Scene();

      var size = this.containerSize();
      this.camera = new THREE.PerspectiveCamera(45, size.w / size.h, 0.1, 1000);
      this.camera.position.set(0, 0, this.fitDistance());
      this.camera.lookAt(this.scene.position);

      // preserveDrawingBuffer lets "Export PNG" read the canvas back
      this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(size.w, size.h);
      container.appendChild(this.renderer.domElement);

      // Create the main sphere geometry (radius: 20) with a matte, translucent material
      this.sphereMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
      var sphere = new THREE.Mesh(new THREE.SphereGeometry(BS.RADIUS, 64, 48), this.sphereMaterial);
      sphere.renderOrder = 0;
      this.scene.add(sphere);

      this.graticule = this.buildGraticule(15);
      this.scene.add(this.graticule);

      // Soft ambient fill plus a key light attached to the camera, so shading stays consistent while orbiting
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      var keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
      keyLight.position.set(-40, 50, 60);
      this.camera.add(keyLight);
      this.scene.add(this.camera);

      // OrbitControls: drag to rotate, scroll to zoom
      if (typeof THREE.OrbitControls !== 'undefined') {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enablePan = false;
        this.controls.minDistance = 30;
        this.controls.maxDistance = 240;
      }

      this.applySettings(settings);

      var scope = this;
      window.addEventListener('resize', function() { scope.resize(); });
      if (window.ResizeObserver) new ResizeObserver(function() { scope.resize(); }).observe(container);
    },

    containerSize: function() {
      return { w: Math.max(this.container.clientWidth, 1), h: Math.max(this.container.clientHeight, 1) };
    },

    resize: function() {
      if (!this.renderer) return;
      var size = this.containerSize();
      this.camera.aspect = size.w / size.h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(size.w, size.h);
      this.camera.position.setLength(this.fitDistance());
    },

    /** Camera distance at which the globe fills ~70% of the stage's shorter side. */
    fitDistance: function() {
      var halfFov = this.camera.fov / 2 * Math.PI / 180;
      return BS.RADIUS / (0.7 * Math.tan(halfFov) * Math.min(1, this.camera.aspect));
    },

    /** Latitude/longitude lines just above the sphere surface, every `step` degrees. */
    buildGraticule: function(step) {
      var r = BS.RADIUS * 1.002, positions = [], lat, lon;
      function push(la, lo) {
        var u = BS.toUnit(la, lo);
        positions.push(u[0] * r, u[1] * r, u[2] * r);
      }
      for (lon = -180; lon < 180; lon += step) {
        for (lat = -90; lat < 90; lat += 3) { push(lat, lon); push(lat + 3, lon); }
      }
      for (lat = -90 + step; lat < 90; lat += step) {
        for (lon = -180; lon < 180; lon += 3) { push(lat, lon); push(lat, lon + 3); }
      }
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      var material = new THREE.LineBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.28 });
      return new THREE.LineSegments(geometry, material);
    },

    /**
     * Turns the camera towards a route's arc, keeping the current zoom. Long arcs
     * are viewed at an angle to their plane so their height reads in profile.
     */
    focusOn: function(data) {
      var dist = this.camera.position.length() || this.fitDistance();
      var start = new THREE.Vector3(data.v0x, data.v0y, data.v0z);
      var end = new THREE.Vector3(data.v2x, data.v2y, data.v2z);
      var dir = new THREE.Vector3(data.v1x, data.v1y, data.v1z).normalize();
      var normal = new THREE.Vector3().crossVectors(dir, start).normalize();
      var halfAngle = start.angleTo(end) / 2;
      var view = dir.clone().addScaledVector(normal, 0.9 * Math.sin(halfAngle));
      view.y += 0.25; // look slightly from above, like the plates
      this.camera.position.copy(view.normalize().multiplyScalar(dist));
      this.camera.lookAt(this.scene.position);
      if (this.controls) this.controls.update();
    },

    /**
     * Main render loop that continuously animates the scene.
     * Rotates the camera around the sphere in a circular orbit and advances
     * any curves that are still being drawn on.
     */
    render: function() {
      // Mark that animation has started (prevents multiple animation loops)
      if (!this.isAnimating) {
        this.isAnimating = true;
      }

      // Auto-rotate camera when not paused
      if (!this.rotationPaused) {
        var rotSpeed = this.rotationSpeed;
        var x = this.camera.position.x, z = this.camera.position.z;
        this.camera.position.x = x * Math.cos(rotSpeed) + z * Math.sin(rotSpeed);
        this.camera.position.z = z * Math.cos(rotSpeed) - x * Math.sin(rotSpeed);
        this.camera.lookAt(this.scene.position);
      }

      if (this.controls) {
        this.controls.update();
      }

      this.stepAnimations(performance.now());

      // Schedule the next frame render (creates continuous animation loop)
      requestAnimationFrame(this.render.bind(this));

      // Render the scene from the camera's perspective
      this.renderer.render(this.scene, this.camera);
    },

    /**
     * Removes all Bezier curves from the scene and disposes their geometry and material.
     */
    clearCurves: function() {
      for (var i = 0; i < this.curveMeshes.length; i++) {
        var group = this.curveMeshes[i];
        this.scene.remove(group);
        group.traverse(function(obj) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
      }
      this.curveMeshes = [];
      this.animations = [];
    },

    /**
     * Draws a curve on progressively: the tube's index range grows from the start
     * point while a small "pen" sphere travels along the leading edge.
     * Skipped (curve shown complete) when the user prefers reduced motion.
     */
    startBezierAnimation: function(group, curve){
      var tube = group.userData.tube;
      var total = tube.geometry.index.count;
      if (this.reducedMotion) return;
      tube.geometry.setDrawRange(0, 0);
      var pen = new THREE.Mesh(new THREE.SphereGeometry(this.tubeRadius * 1.9, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x141414 }));
      pen.position.copy(curve.getPoint(0));
      group.add(pen);
      group.userData.end.visible = false;
      this.animations.push({ group: group, curve: curve, pen: pen, total: total, step: group.userData.ringIndices, start: performance.now(), duration: 1100 });
    },

    stepAnimations: function(now) {
      var keep = [];
      for (var i = 0; i < this.animations.length; i++) {
        var a = this.animations[i];
        var t = Math.min(1, (now - a.start) / a.duration);
        var eased = 1 - Math.pow(1 - t, 3);
        var count = Math.floor(eased * a.total / a.step) * a.step;
        a.group.userData.tube.geometry.setDrawRange(0, count);
        a.pen.position.copy(a.curve.getPoint(eased));
        if (t < 1) {
          keep.push(a);
        } else {
          a.group.userData.tube.geometry.setDrawRange(0, a.total);
          a.group.remove(a.pen);
          a.pen.geometry.dispose();
          a.pen.material.dispose();
          a.group.userData.end.visible = true;
        }
      }
      this.animations = keep;
    },

    /**
     * Draws a Bezier curve on the sphere connecting two geographic points.
     * The curve uses three control points (v0, v1, v2) to create a smooth arc
     * that curves outward from the sphere's surface, with markers at both ends.
     *
     * @param {Object} coordinatesData - Object containing 3D coordinates for the curve:
     *   - v0x, v0y, v0z: Starting point (first geographic coordinate on sphere)
     *   - v1x, v1y, v1z: Control point (determines curve shape, positioned outside sphere)
     *   - v2x, v2y, v2z: Ending point (second geographic coordinate on sphere)
     */
    addBezierCurve: function(coordinatesData){
      // Create a quadratic Bezier curve with three control points
      var start = new THREE.Vector3(coordinatesData.v0x, coordinatesData.v0y, coordinatesData.v0z);
      var end = new THREE.Vector3(coordinatesData.v2x, coordinatesData.v2y, coordinatesData.v2z);
      var quadraticCurve = new THREE.QuadraticBezierCurve3(
        start,
        new THREE.Vector3(coordinatesData.v1x, coordinatesData.v1y, coordinatesData.v1z),
        end
      );

      // Use TubeGeometry for a visible thick curve (configurable radius and color)
      var tubularSegments = 96;
      var radialSegments = 10;
      var geometry = new THREE.TubeGeometry(quadraticCurve, tubularSegments, this.tubeRadius, radialSegments, false);
      var material = new THREE.MeshLambertMaterial({ color: this.curveColor });
      var tube = new THREE.Mesh(geometry, material);

      var group = new THREE.Group();
      group.add(tube);
      group.userData.tube = tube;
      group.userData.ringIndices = radialSegments * 6;

      // Paper-coloured dots mark the start and end points
      var markerGeometry = new THREE.SphereGeometry(this.tubeRadius * 1.6, 16, 12);
      var markerMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, emissive: 0x333333 });
      [start, end].forEach(function(p, i) {
        var m = new THREE.Mesh(i ? markerGeometry.clone() : markerGeometry, markerMaterial.clone());
        m.position.copy(p);
        group.add(m);
        if (i) group.userData.end = m;
      });

      this.scene.add(group);
      this.curveMeshes.push(group);
      this.startBezierAnimation(group, quadraticCurve);
    },

    /**
     * Applies settings (opacity, curve thickness/color, rotation speed, theme, graticule).
     * @param {Object} settings - see BezierSphere.DEFAULT_SETTINGS
     */
    applySettings: function(settings) {
      if (settings.opacity != null && this.sphereMaterial) {
        this.sphereMaterial.opacity = settings.opacity;
      }
      if (settings.tubeRadius != null) this.tubeRadius = settings.tubeRadius;
      if (settings.curveColor != null) {
        this.curveColor = typeof settings.curveColor === 'string'
          ? parseInt(settings.curveColor.replace(/^#/, ''), 16) : settings.curveColor;
      }
      if (settings.rotationSpeed != null) this.rotationSpeed = settings.rotationSpeed;
      var theme = BS.THEMES[settings.theme] || BS.THEMES.paper;
      this.themeColors = theme;
      this.renderer.setClearColor(new THREE.Color(theme.bg), 1);
      this.sphereMaterial.color.set(theme.sphere);
      this.graticule.material.color.set(theme.grid);
      this.graticule.material.opacity = theme.gridOpacity;
      if (settings.graticule != null) this.graticule.visible = !!settings.graticule;
    },

    /**
     * Saves the current frame as a PNG "plate": the canvas on a paper mount with
     * a figure caption, coordinates and distance underneath.
     * @param {Object} meta - { title, coords, distance }
     */
    exportPNG: function(meta) {
      this.renderer.render(this.scene, this.camera);
      var src = this.renderer.domElement;
      var scale = src.width / this.containerSize().w;
      var pad = Math.round(32 * scale), band = Math.round(96 * scale);
      var out = document.createElement('canvas');
      out.width = src.width + pad * 2;
      out.height = src.height + pad * 2 + band;
      var ctx = out.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(src, pad, pad);
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = Math.max(1, scale);
      ctx.strokeRect(pad + 0.5, pad + 0.5, src.width - 1, src.height - 1);

      var baseY = pad + src.height + Math.round(44 * scale);
      ctx.fillStyle = '#141414';
      ctx.textBaseline = 'alphabetic';
      ctx.font = 'italic ' + Math.round(26 * scale) + 'px "EB Garamond", Georgia, serif';
      ctx.fillText('Fig. — ' + meta.title, pad, baseY);
      ctx.font = Math.round(13 * scale) + 'px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#55524B';
      ctx.fillText(meta.coords, pad, baseY + Math.round(26 * scale));
      ctx.textAlign = 'right';
      ctx.fillStyle = '#141414';
      ctx.font = Math.round(20 * scale) + 'px "IBM Plex Mono", monospace';
      ctx.fillText(meta.distance, out.width - pad, baseY);
      ctx.font = Math.round(11 * scale) + 'px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#85857F';
      ctx.fillText('BÉZIER SPHERE', out.width - pad, baseY + Math.round(26 * scale));

      var slug = (meta.title || 'route').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'route';
      out.toBlob(function(blob) {
        if (!blob) return;
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'bezier-sphere-' + slug + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
      }, 'image/png');
    }
  }

  /////////////
  /////  MODEL  ////////////
  /**
   * SonicPlayerModel - Manages application data and performs coordinate transformations.
   * Converts geographic coordinates (latitude/longitude) to 3D spatial coordinates
   * and calculates Bezier curve control points.
   */
  function SonicPlayerModel(){
    /**
     * Storage for the three control points of the Bezier curve in 3D space:
     * - v0: Starting point (first geographic coordinate converted to 3D)
     * - v1: Control point (calculated to create an arc above the sphere)
     * - v2: Ending point (second geographic coordinate converted to 3D)
     * - lift: distance of the control point from the centre, in sphere radii
     */
    this.spaceCoordinatesDataBox = {
      v0x : 0, v0y : 0, v0z : 0, // Starting point coordinates
      v1x : 0, v1y : 0, v1z : 1, // Control point coordinates
      v2x : 0, v2y : 0, v2z : 0, // Ending point coordinates
      lift : 1
    };
  }
  SonicPlayerModel.prototype = {
    /**
     * Converts geographic coordinates (latitude/longitude) to 3D Cartesian coordinates
     * on a sphere, and calculates a control point for a Bezier curve that creates
     * an arc connecting the two points.
     *
     * The algorithm:
     * 1. Converts lat/lon to 3D points on the sphere surface (v0 and v2):
     *    x = r·cos(lat)·cos(lon), y = r·sin(lat), z = −r·cos(lat)·sin(lon)
     * 2. Takes the direction of the midpoint between them (or a perpendicular
     *    for antipodal points, where the midpoint is the centre)
     * 3. Pushes the control point (v1) out along that direction by a factor k
     *    that grows with the angle between the points — see BezierSphere.arc
     *
     * @param {number} latitudeA - Starting point latitude in degrees (-90 to 90)
     * @param {number} longitudeA - Starting point longitude in degrees (-180 to 180)
     * @param {number} latitudeB - Ending point latitude in degrees (-90 to 90)
     * @param {number} longitudeB - Ending point longitude in degrees (-180 to 180)
     */
    calcSpatialCoordinate: function(latitudeA, longitudeA, latitudeB, longitudeB) {
      var radius = BS.RADIUS;
      var u0 = BS.toUnit(latitudeA, longitudeA);
      var u2 = BS.toUnit(latitudeB, longitudeB);
      var arc = BS.arc(u0, u2);

      var box = this.spaceCoordinatesDataBox;
      box.v0x = u0[0] * radius; box.v0y = u0[1] * radius; box.v0z = u0[2] * radius;
      box.v1x = arc.dir[0] * arc.k * radius; box.v1y = arc.dir[1] * arc.k * radius; box.v1z = arc.dir[2] * arc.k * radius;
      box.v2x = u2[0] * radius; box.v2y = u2[1] * radius; box.v2z = u2[2] * radius;
      box.lift = arc.k;
    }
  }

})();
