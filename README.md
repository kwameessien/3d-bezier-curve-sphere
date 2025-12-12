# 3D Bezier Curve Visualizer

A Three.js-based 3D visualization application that draws Bezier curves on a sphere using geographic coordinates (latitude/longitude).

## Features

- Interactive 3D scene with a rotating sphere
- Convert geographic coordinates (lat/lon) to 3D spatial coordinates
- Draw Bezier curves between two geographic points on the sphere
- Real-time camera rotation

## Setup

1. Open `index.html` in a web browser
2. No build process required - uses CDN for dependencies

## Dependencies

- jQuery 3.6.0 (via CDN)
- Three.js r128 (via CDN)

## Usage

1. Enter latitude and longitude for Point A
2. Enter latitude and longitude for Point B
3. Click "Calculate Coordinates" to compute the 3D spatial coordinates
4. Click "Draw Bezier Curve" to render the curve on the sphere

## Architecture

The application follows an MVC pattern:

- **SonicPlayerController**: Handles user interactions and coordinates between view and model
- **SonicPlayerView**: Manages the Three.js scene, camera, and rendering
- **SonicPlayerModel**: Calculates spatial coordinates from geographic coordinates

