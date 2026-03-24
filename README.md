# 3D Bezier Curve Visualizer

A Three.js-based 3D visualization application that draws Bezier curves on a sphere using geographic coordinates (latitude/longitude).

## Features

- **Interactive 3D scene** with a rotating sphere
- **Orbit controls**: drag to rotate the camera, scroll to zoom
- **Draw curves**: enter two lat/lon points and click "Draw curve" (single step)
- **Input validation**: coordinates are clamped to valid ranges with clear error messages
- **Clear curves**: remove all drawn curves
- **Pause/Resume rotation**: freeze or resume automatic camera orbit
- **Preset routes**: one-click examples (NYC → London, Equator, Sydney → Tokyo)
- **Thick tube curves** for better visibility

## Site structure

| File | Purpose |
|------|---------|
| `index.html` | Main 3D visualizer (entry point) |
| `about.html` | About / how it works |
| `settings.html` | Visual settings (saved in `localStorage`) |
| `settings-page.js` | Settings form logic (used only on `settings.html`) |

Navigation in the header links between these pages. No server is required for local use.

## Setup

1. Open `index.html` in a web browser (or use a simple static server if you prefer)
2. No build process required — uses CDN for dependencies

## Dependencies

- jQuery 3.6.0 (via CDN)
- Three.js r128 (via CDN)
- Three.js OrbitControls (via CDN)

## Usage

1. Enter latitude and longitude for **Point A** (lat A, lon A)
2. Enter latitude and longitude for **Point B** (lat B, lon B)
3. Click **Draw curve** to compute 3D coordinates and render the curve on the sphere
4. Use **Presets** to try example routes, or **Clear curves** to remove all curves
5. **Pause rotation** to inspect the scene; drag to orbit the camera when rotation is paused or running

## Architecture

The application follows an MVC pattern:

- **SonicPlayerController**: Handles user interactions and coordinates between view and model
- **SonicPlayerView**: Manages the Three.js scene, camera, OrbitControls, and rendering
- **SonicPlayerModel**: Calculates spatial coordinates from geographic coordinates
