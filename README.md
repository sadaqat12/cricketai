# Cricket 3D - Three.js Game

A realistic 3D cricket game built with Three.js, featuring authentic cricket field dimensions and mechanics.

## 🏏 Current Features

### Field & Environment
- **Authentic Cricket Ground**: 70-meter radius oval field with realistic green grass
- **Official Pitch Dimensions**: 22 yards (20.12m) long × 10 feet (3.05m) wide
- **Proper Markings**: Bowling creases, popping creases positioned according to cricket regulations
- **Wickets**: Three stumps with bails at both ends, positioned at regulation height (71cm)
- **Boundary Rope**: White boundary marker around the field perimeter
- **Atmospheric Lighting**: Multiple light sources with realistic shadows
- **Field Pattern**: Circular mowing patterns typical of professional cricket grounds

### Visual Features
- **Realistic Colors**: Dark green field, sandy brown pitch, white markings
- **Professional Lighting**: Directional sunlight with soft ambient lighting
- **Shadows**: Realistic shadow casting from stumps and other objects
- **Atmospheric Fog**: Distance fog for depth perception
- **Sky**: Beautiful sky blue background

### Controls
- **Mouse Orbit**: Drag to rotate camera around the field
- **Zoom**: Mouse wheel to zoom in/out
- **Pan**: Right-click drag to pan view
- **Smooth Controls**: Damped camera movement for professional feel

## 🚀 How to Run

1. **Simple Setup**: Just open `index.html` in a modern web browser
2. **Local Server** (Recommended): Use a local HTTP server to avoid CORS issues:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   
   # Node.js (if you have http-server)
   npx http-server
   ```
3. **Navigate** to `http://localhost:8000` in your browser

## 🎮 Controls

### Camera Controls
- **Left Mouse**: Orbit camera around the field
- **Mouse Wheel**: Zoom in/out
- **Right Mouse**: Pan view
- **Auto-Focus**: Camera automatically focuses on the center of the pitch

### Player Controls ⚡
- **WASD Keys**: Move cricket player around the field
- **Arrow Keys**: Alternative movement controls
- **Spacebar**: Cycle through different player animations (running, batting, idle)
- **Smart Boundaries**: Player automatically stays within the cricket field

## 📐 Cricket Field Specifications

### Authentic Dimensions
- **Field Radius**: 70 meters (typical professional ground)
- **Pitch Length**: 20.12 meters (22 yards)
- **Pitch Width**: 3.05 meters (10 feet)
- **Stump Height**: 71 cm (regulation height)
- **Stump Spacing**: 10 cm between stumps
- **Popping Crease**: 1.22 meters (4 feet) in front of stumps

### Visual Details
- **Field Grass**: Dark green (#2d5016) with alternating mowing patterns
- **Pitch Surface**: Sandy brown (#DEB887) representing prepared wicket
- **Markings**: White lines for creases and boundaries
- **Stumps & Bails**: Light wooden color (#DEBDDB)

## 🛠 Technical Details

### Built With
- **Three.js r158**: 3D graphics library
- **OrbitControls**: Camera movement controls
- **Vanilla JavaScript**: No additional frameworks
- **Modern CSS**: Responsive design with backdrop blur effects

### Performance Features
- **Optimized Geometry**: Efficient use of polygons for smooth performance
- **Shadow Mapping**: PCF soft shadows for realistic lighting
- **Level of Detail**: Appropriate polygon counts for different objects
- **Responsive Design**: Adapts to different screen sizes

### Browser Compatibility
- **Chrome**: Full support with all features
- **Firefox**: Full support with all features
- **Safari**: Full support with all features
- **Edge**: Full support with all features

## 📁 Repository Setup

### GitHub Repository
- **Repository**: [https://github.com/sadaqat12/cricketai.git](https://github.com/sadaqat12/cricketai.git)
- **Branch**: `main`
- **Files Included**: Core game files, documentation, and configuration
- **Files Excluded**: Large 3D model files (*.fbx, *.glb) are excluded from the repository

### Model Files (Not in Repository)
The following large binary files are excluded via `.gitignore`:
- `*.fbx` - Character animations and models
- `*.glb` - 3D assets like cricket ball and bat
- `*.gltf` - Additional 3D model formats
- `*.obj`, `*.3ds`, `*.blend` - Other 3D formats

**Note**: If you clone this repository, you'll need to add your own 3D model files to the project directory for full functionality.

### Included Files
- `cricket-game.js` - Main game logic and Three.js implementation
- `index.html` - Game entry point
- `style.css` - Game styling and UI
- `three.min.js` - Three.js library
- `OrbitControls.js` - Camera controls
- `fflate.min.js` - Compression library
- Documentation and configuration files

## 📋 Next Development Steps

### Newly Added Features ✨
1. **Animated Cricket Player**: Fully animated character with multiple animations
2. **Interactive Movement**: WASD/Arrow keys to move player around the field
3. **Multiple Animations**: Running, batting, and idle animations
4. **Smart Loading**: FBX file support with simplified fallback character

### Planned Features (Iterative Development)
1. **Ball Physics**: Realistic ball movement and bounce
3. **Batting Mechanics**: Player can control batting shots
4. **Bowling System**: Different bowling styles and speeds
5. **Fielding AI**: Intelligent fielder positioning and movement
6. **Game Logic**: Runs, wickets, overs, match progression
7. **UI/HUD**: Score display, player stats, game controls
8. **Sound Effects**: Ball sounds, crowd noise, commentary
9. **Animations**: Player movements, ball trajectory
10. **Multiplayer**: Online cricket matches

### Code Structure
- **Modular Design**: Easy to extend with new features
- **Clean Architecture**: Separated concerns for field, players, game logic
- **Performance Ready**: Built for smooth 60fps gameplay
- **Debugging Tools**: Console access to game objects for development

## 🎯 Development Philosophy

This project follows cricket authenticity principles:
- **Realistic Dimensions**: All measurements match official cricket specifications
- **Authentic Visuals**: Colors and textures based on real cricket grounds
- **Professional Standards**: Built with the quality expected of modern web games
- **Iterative Approach**: Features added step-by-step for stable development

---

**Ready to start playing cricket in 3D!** 🏏

*Open `index.html` and use your mouse to explore the beautifully crafted cricket ground.* 