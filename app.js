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
 */

// Immediately-invoked function expression (IIFE) to encapsulate code and avoid global scope pollution
;(function(){

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
  }
  
  SonicPlayerController.prototype = {
    /**
     * Initializes the application by:
     * 1. Setting up the 3D scene
     * 2. Starting the render loop
     * 3. Binding event handlers for user interactions
     */
    init: function() {
      var scope = this; // Preserve 'this' context for use in event handlers
      
      // Initialize the Three.js scene with sphere, camera, lights, etc.
      scope.view.initThreeDimentionalScene();
      
      // Start the continuous rendering/animation loop
      scope.view.render();
      
      // Event handler for "Add Bezier" button - calculates 3D coordinates from geographic input
      $('#add-bezier').on('click', function(event){
        console.log($(this).parent());
        var formElm = $(this).parent(); // Get the parent form element
        
        // Extract latitude and longitude values from the form inputs
        var latA = formElm.find('#latitudeA').val(); // Starting point latitude
        var lonA = formElm.find('#longitudeA').val(); // Starting point longitude
        var latB = formElm.find('#latitudeB').val(); // Ending point latitude
        var lonB = formElm.find('#longitudeB').val(); // Ending point longitude
        
        // Calculate 3D spatial coordinates from geographic coordinates
        // This converts lat/lon to x/y/z positions on the sphere's surface
        scope.model.calcSpatialCoordinate(latA, lonA, latB, lonB);
      });
      
      // Event handler for "Start" button - draws the Bezier curve on the sphere
      $('#start').on('click', function(){
        // Retrieve the calculated 3D coordinates from the model
        var coordinatesData = scope.model.spaceCoordinatesDataBox;
        console.log(coordinatesData );
        
        // Add the Bezier curve visualization to the 3D scene
        scope.view.addBezierCurve(coordinatesData);
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
    this.scene = null;        // Three.js scene container for all 3D objects
    this.camera = null;       // Camera that defines the viewing perspective
    this.renderer = null;     // WebGL renderer that draws the scene
    this.isAnimating = false; // Flag to track if animation loop is running
  }
  
  SonicPlayerView.prototype = {
    /**
     * Initializes the Three.js 3D scene with:
     * - Scene container
     * - Perspective camera
     * - WebGL renderer
     * - Transparent sphere (representing Earth/globe)
     * - Lighting for shadows
     * - Window resize handler
     */
    initThreeDimentionalScene: function(){
      // Create a 3D scene container that will hold all objects
      this.scene = new THREE.Scene();

      // Create a perspective camera with:
      // - 45° field of view
      // - Aspect ratio matching window dimensions
      // - Near clipping plane: 0.1 units
      // - Far clipping plane: 1000 units
      this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

      // Create a WebGL renderer for hardware-accelerated 3D graphics
      this.renderer = new THREE.WebGLRenderer();
      this.renderer.setClearColor(0x000000, 1.0); // Black background
      this.renderer.setSize(window.innerWidth, window.innerHeight); // Full window size
      this.renderer.shadowMap.enabled = true; // Enable shadow rendering

      // Create the main sphere geometry (radius: 20, segments: 20x20 for smoothness)
      var sphereGeometry = new THREE.SphereGeometry(20, 20, 20);
      
      // Create a semi-transparent blue material for the sphere
      var material = new THREE.MeshLambertMaterial({color: 0x1E60EE, transparent: true});
      material.opacity = 0.6; // 60% opacity to see through the sphere
      
      // Combine geometry and material into a mesh (3D object)
      var sphere = new THREE.Mesh(sphereGeometry, material);
      this.scene.add(sphere); // Add sphere to the scene

      // Position the camera 100 units away from the origin, looking at the center
      this.camera.position.x = 0;
      this.camera.position.y = 0;
      this.camera.position.z = 100;
      this.camera.lookAt(this.scene.position); // Point camera at scene center (0,0,0)

      // Add a white spotlight to illuminate the scene and create shadows
      var spotLight = new THREE.SpotLight(0xffffff);
      spotLight.position.set(500, 500, 1000); // Position light far from scene
      spotLight.shadow.camera.near = 20;      // Near plane for shadow calculations
      spotLight.shadow.camera.far = 100;      // Far plane for shadow calculations
      spotLight.castShadow = true;            // Enable shadow casting

      this.scene.add(spotLight);

      // Append the renderer's canvas element to the page so it's visible
      document.body.appendChild(this.renderer.domElement);

      // Handle window resize events to maintain proper aspect ratio and full-screen rendering
      var scope = this;
      window.addEventListener('resize', function() {
        scope.camera.aspect = window.innerWidth / window.innerHeight; // Update aspect ratio
        scope.camera.updateProjectionMatrix(); // Recalculate camera projection
        scope.renderer.setSize(window.innerWidth, window.innerHeight); // Resize renderer
      });
    },
    /**
     * Main render loop that continuously animates the scene.
     * Rotates the camera around the sphere in a circular orbit,
     * creating a 360° viewing effect.
     */
    render: function() {
      // Mark that animation has started (prevents multiple animation loops)
      if (!this.isAnimating) {
        this.isAnimating = true;
      }
      
      // Rotation speed in radians per frame (small value for smooth rotation)
      var rotSpeed = 0.01;
      
      // Rotate camera around the Y-axis (vertical axis) using rotation matrix math:
      // This creates a circular orbit around the scene center
      // x' = x*cos(θ) + z*sin(θ)
      // z' = z*cos(θ) - x*sin(θ)
      this.camera.position.x = this.camera.position.x * Math.cos(rotSpeed) + this.camera.position.z * Math.sin(rotSpeed);
      this.camera.position.z = this.camera.position.z * Math.cos(rotSpeed) - this.camera.position.x * Math.sin(rotSpeed);
      
      // Always point camera at the center of the scene
      this.camera.lookAt(this.scene.position);
      
      // Schedule the next frame render (creates continuous animation loop)
      requestAnimationFrame(this.render.bind(this));
      
      // Render the scene from the camera's perspective
      this.renderer.render(this.scene, this.camera);
    },
    
    /**
     * Placeholder function for future Bezier curve animation functionality.
     * Currently not implemented.
     */
    startBezierAnimation: function(){

    },
    
    /**
     * Draws a Bezier curve on the sphere connecting two geographic points.
     * The curve uses three control points (v0, v1, v2) to create a smooth arc
     * that curves outward from the sphere's surface.
     * 
     * @param {Object} coordinatesData - Object containing 3D coordinates for the curve:
     *   - v0x, v0y, v0z: Starting point (first geographic coordinate on sphere)
     *   - v1x, v1y, v1z: Control point (determines curve shape, positioned outside sphere)
     *   - v2x, v2y, v2z: Ending point (second geographic coordinate on sphere)
     */
    addBezierCurve: function(coordinatesData){
      // Number of line segments to approximate the smooth Bezier curve
      // Higher values = smoother curve but more geometry
      var SUBDIVISIONS = 20;
      
      // Create a geometry to hold the curve's vertex data
      var geometry = new THREE.BufferGeometry();
      var points = [];
      
      // Create a quadratic Bezier curve with three control points:
      // v0: Start point (on sphere surface)
      // v1: Control point (outside sphere, creates the arc)
      // v2: End point (on sphere surface)
      var quadraticCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(coordinatesData.v0x, coordinatesData.v0y, coordinatesData.v0z),
        new THREE.Vector3(coordinatesData.v1x, coordinatesData.v1y, coordinatesData.v1z),
        new THREE.Vector3(coordinatesData.v2x, coordinatesData.v2y, coordinatesData.v2z)
      );
      
      // Sample points along the Bezier curve at regular intervals
      // This creates a series of points that approximate the smooth curve
      for (var i = 0; i <= SUBDIVISIONS; i++) {
        // Get point at position t (0.0 to 1.0) along the curve
        points.push(quadraticCurve.getPoint(i / SUBDIVISIONS));
      }
      
      // Convert the array of points into geometry vertices
      geometry.setFromPoints(points);
      
      // Create a red line material for the curve
      var material = new THREE.LineBasicMaterial( { color: 0xEE4950, linewidth: 5} );
      
      // Create a line object from the geometry and material
      var line = new THREE.Line(geometry, material);
      
      // Add the curve to the scene so it's visible
      this.scene.add(line);
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
     */
    this.spaceCoordinatesDataBox = {
      v0x : 0, v0y : 0, v0z : 0, // Starting point coordinates
      v1x : 0, v1y : 0, v1z : 0, // Control point coordinates
      v2x : 0, v2y : 0, v2z : 0  // Ending point coordinates
    };
    
    /**
     * Retrieves geographic coordinates from form inputs.
     * Note: This function is defined but not currently used in the codebase.
     * 
     * @returns {Array} Array containing [latitudeA, longitudeA, latitudeB, longitudeB]
     */
    this.getGeoPoints = function(){
      var latitudeA = $('#latitudeA').val();
      var longitudeA = $('#longitudeA').val();
      var latitudeB = $('#latitudeB').val();
      var longitudeB = $('#longitudeB').val();
      var coordinateArr = [latitudeA,longitudeA, latitudeB,longitudeB];
      return coordinateArr;
    };
  }
  SonicPlayerModel.prototype = {
    /**
     * Converts geographic coordinates (latitude/longitude) to 3D Cartesian coordinates
     * on a sphere, and calculates a control point for a Bezier curve that creates
     * an arc connecting the two points.
     * 
     * The algorithm:
     * 1. Converts lat/lon to 3D points on sphere surface (v0 and v2)
     * 2. Finds midpoint between v0 and v2
     * 3. Calculates a control point (v1) positioned outside the sphere to create
     *    a curved arc that bulges outward from the sphere's surface
     * 
     * @param {number} latitudeA - Starting point latitude in degrees (-90 to 90)
     * @param {number} longitudeA - Starting point longitude in degrees (-180 to 180)
     * @param {number} latitudeB - Ending point latitude in degrees (-90 to 90)
     * @param {number} longitudeB - Ending point longitude in degrees (-180 to 180)
     */
    calcSpatialCoordinate: function(latitudeA, longitudeA, latitudeB, longitudeB) {
      // Sphere radius (must match the sphere geometry radius in the view)
      var radius = 20;
      console.log(this);

      // Convert starting point (A) from geographic to 3D Cartesian coordinates
      // Using spherical coordinate conversion:
      // - Latitude determines Y position (vertical)
      // - Longitude determines X and Z positions (horizontal plane)
      // Formula: y = sin(lat) * r, x = cos(lon) * cos(lat) * r, z = sin(lon) * cos(lat) * r
      var v0y = Math.sin(latitudeA/180 * Math.PI) * radius; // Convert degrees to radians, then calculate Y
      var anotherRadius = Math.cos(latitudeA/180 * Math.PI) * radius; // Radius at this latitude (smaller near poles)
      var v0x = Math.cos(longitudeA/180 * Math.PI) * anotherRadius; // X coordinate based on longitude
      var v0z = Math.sin(longitudeA/180 * Math.PI) * anotherRadius; // Z coordinate based on longitude

      // Convert ending point (B) from geographic to 3D Cartesian coordinates
      // Same conversion process as point A
      var v2y = Math.sin(latitudeB/180 * Math.PI) * radius;
      anotherRadius = Math.cos(latitudeB/180 * Math.PI) * radius;
      var v2x = Math.cos(longitudeB/180 * Math.PI) * anotherRadius;
      var v2z = Math.sin(longitudeB/180 * Math.PI) * anotherRadius;

      // Calculate the midpoint between the two points on the sphere
      // This will be used as a base for the control point calculation
      var midPointX = (v0x + v2x)/2;
      var midPointY = (v0y + v2y)/2;
      var midPointZ = (v0z + v2z)/2;

      // Calculate the 3D Euclidean distance between the two points
      // Formula: √[(x₂-x₁)² + (y₂-y₁)² + (z₂-z₁)²]
      var distance = Math.sqrt(Math.pow(v2x - v0x, 2) + Math.pow(v2y - v0y, 2) + Math.pow(v2z - v0z, 2));

      // Calculate a multiplier value that determines how far the control point
      // extends beyond the sphere surface. This creates the arc effect.
      // The formula scales the midpoint vector outward based on the distance
      // between the two points, ensuring the curve bulges appropriately.
      // Formula: distance² / (midPointX² + midPointY² + midPointZ²)
      var multipleVal = Math.pow(distance, 2)/((Math.pow(midPointX, 2)) + (Math.pow(midPointY, 2)) + (Math.pow(midPointZ, 2)));
      
      // Apply the multiplier to the midpoint to get the control point (v1)
      // This extends the midpoint vector outward, positioning it outside the sphere
      // to create a curved Bezier arc that connects v0 to v2
      var v1x = midPointX + multipleVal*midPointX;
      var v1y = midPointY + multipleVal*midPointY;
      var v1z = midPointZ + multipleVal*midPointZ;

      // Store all calculated coordinates in the data box for use by the view
      // These will be used to draw the Bezier curve
      this.spaceCoordinatesDataBox.v0x = v0x;
      this.spaceCoordinatesDataBox.v0y = v0y;
      this.spaceCoordinatesDataBox.v0z = v0z;
      this.spaceCoordinatesDataBox.v1x = v1x;
      this.spaceCoordinatesDataBox.v1y = v1y;
      this.spaceCoordinatesDataBox.v1z = v1z;
      this.spaceCoordinatesDataBox.v2x = v2x;
      this.spaceCoordinatesDataBox.v2y = v2y;
      this.spaceCoordinatesDataBox.v2z = v2z;

      console.log(this.spaceCoordinatesDataBox);
    }
  }
  
})();

