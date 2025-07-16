import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Cricket Game - Three.js Implementation
class CricketGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Cricket field dimensions (in meters)
        this.FIELD_RADIUS = 70; // Typical cricket field radius
        this.PITCH_LENGTH = 20.12; // 22 yards in meters
        this.PITCH_WIDTH = 3.05; // 10 feet in meters
        
        // Character system
        this.character = null;
        this.characterAnimations = new Map();
        this.animationMixer = null;
        this.currentAction = null;
        this.clock = new THREE.Clock();
        this.cricketBat = null;
        
        // Cricket ball system
        this.cricketBall = null;
        this.ballPhysics = {
            velocity: new THREE.Vector3(0, 0, 0),
            gravity: -9.81,
            bounceCoefficient: 0.5, // Better bounce for visible cricket ball movement
            friction: 0.92, // Slight friction adjustment
            isMoving: false
        };
        
        // Ball trail system
        this.ballTrail = {
            points: [],
            maxPoints: 50, // Maximum trail points
            mesh: null,
            material: null,
            geometry: null,
            enabled: true
        };
        
        // Batting system
        this.batSwing = {
            isSwinging: false,
            swingDirection: new THREE.Vector3(0, 0, 0),
            swingPower: 0,
            swingStartTime: 0,
            swingDuration: 300, // milliseconds
            batSpeed: 0,
            shotType: 'straight', // Track current shot type
            timing: 'perfect' // Track timing quality
        };
        this.batCollisionSphere = null;
        
        // Expanded shot system
        // Note: In this coordinate system:
        // - Batsman is at (0, 0, 9) facing negative Z (toward bowler at (0, 0, -9))
        // - Positive X = Off-side (right side for right-handed batsman)  
        // - Negative X = Leg-side (left side for right-handed batsman)
        // - Negative Z = Toward bowler/straight shots
        // - Positive Z = Behind batsman/behind wicket shots
        this.shotTypes = {
            // Straight shots
            defensive: { power: 0.3, direction: [0, 0, -1], height: 0.1, description: 'Defensive Block' },
            straightDrive: { power: 1.5, direction: [0, 0, -1], height: 0.2, description: 'Straight Drive' },
            loftedStraight: { power: 2.5, direction: [0, 0, -1], height: 0.6, description: 'Lofted Straight' },
            
            // Off-side shots (right side for right-handed batsman) - Positive X
            cutShot: { power: 1.8, direction: [1, 0, -0.3], height: 0.15, description: 'Cut Shot' },
            squareCut: { power: 2.0, direction: [1, 0, 0.2], height: 0.2, description: 'Square Cut' },
            upperCut: { power: 2.2, direction: [0.8, 0, 0.4], height: 0.5, description: 'Upper Cut' },
            coverDrive: { power: 1.8, direction: [0.8, 0, -0.6], height: 0.25, description: 'Cover Drive' },
            
            // Leg-side shots (left side for right-handed batsman) - Negative X
            pullShot: { power: 2.2, direction: [-1, 0, -0.3], height: 0.3, description: 'Pull Shot' },
            hookShot: { power: 2.4, direction: [-0.9, 0, 0.3], height: 0.4, description: 'Hook Shot' },
            legGlance: { power: 1.2, direction: [-0.6, 0, 0.8], height: 0.1, description: 'Leg Glance' },
            onDrive: { power: 1.6, direction: [-0.7, 0, -0.7], height: 0.2, description: 'On Drive' },
            
            // Behind wicket shots - Positive Z
            lateCut: { power: 1.4, direction: [0.6, 0, 0.8], height: 0.1, description: 'Late Cut' },
            reverseSwep: { power: 1.8, direction: [0.8, 0, 0.6], height: 0.3, description: 'Reverse Sweep' },
            
            // Aggressive shots
            slog: { power: 3.0, direction: [-0.7, 0, -0.7], height: 0.8, description: 'Slog' },
            helicopter: { power: 3.2, direction: [0, 0, -1], height: 0.9, description: 'Helicopter Shot' },
            
            // Power variations
            lightTap: { power: 0.4, direction: [0, 0, -1], height: 0.05, description: 'Light Tap' },
            mediumHit: { power: 1.5, direction: [0, 0, -1], height: 0.2, description: 'Medium Hit' },
            powerShot: { power: 3.0, direction: [0, 0, -1], height: 0.6, description: 'Power Shot' }
        };
        
        // Cricket team characters
        this.bowler = null;
        this.keeper = null;
        this.fielders = [];
        this.cricketCharacters = [];
        
        // Fielding system
        this.fieldingSystem = {
            ballIsHit: false,
            nearestFielder: null,
            chasingFielder: null,
            ballLastPosition: new THREE.Vector3(),
            fielderStates: new Map(), // Track fielder states: 'idle', 'chasing', 'throwing', 'returning'
            fielderOriginalPositions: new Map(), // Store original fielding positions
            // Fielding zones for better assignment
            fieldingZones: {
                'straight': ['Mid Off', 'Mid On', 'First Slip'],
                'offSide': ['Cover', 'Point', 'Gully', 'Third Man'],
                'legSide': ['Square Leg', 'Fine Leg', 'Mid On'],
                'behind': ['First Slip', 'Third Man', 'Fine Leg']
            }
        };
        
        // Animation system
        this.availableAnimations = [
            'standingidle.fbx',
            'runningcharacter.fbx', 
            'hitting.fbx',
            'regularcatch.fbx',
            'divingcatch.fbx',
            'Throw.fbx',
            'runningslide.fbx',
            'standingarguing.fbx',
            'leftturn.fbx'
        ];
        
        this.init();
    }

    init() {
        console.log('🎯 Initializing Cricket Game...');
        
        // Filter out common FBX loader warnings that don't affect functionality
        const originalWarn = console.warn;
        console.warn = function(...args) {
            const message = args.join(' ');
            if (message.includes('ShininessExponent map is not supported') ||
                message.includes('Vertex has more than 4 skinning weights') ||
                message.includes('Polygons with more than four sides')) {
                return; // Skip these warnings
            }
            originalWarn.apply(console, args);
        };
        
        try {
            console.log('Creating scene...');
            this.createScene();
            
            console.log('Creating camera...');
            this.createCamera();
            
            console.log('Creating renderer...');
            this.createRenderer();
            
            console.log('Creating lighting...');
            this.createLighting();
            
            console.log('Creating field...');
            this.createField();
            
            console.log('Creating pitch...');
            this.createPitch();
            
            console.log('Creating boundary...');
            this.createBoundary();
            
            console.log('Creating controls...');
            this.createControls();
            
            console.log('Loading character...');
            this.loadCharacter();
            
            console.log('Loading cricket team...');
            this.loadCricketTeam();
            
            console.log('Loading cricket ball...');
            this.loadCricketBall();
            
            console.log('Creating bat collision system...');
            this.createBatCollisionSphere();
            
            console.log('Creating ball trail system...');
            this.createBallTrail();
            
            console.log('Adding event listeners...');
            this.addEventListeners();
            
            console.log('Starting animation loop...');
            this.animate();
            
            console.log('✅ Cricket Game initialization complete!');
        } catch (error) {
            console.error('❌ Error during game initialization:', error);
            throw error;
        }
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011); // Deep space blue-black
        this.scene.fog = new THREE.Fog(0x000011, 200, 500); // Subtle space fog
        
        // Add starfield
        this.createStarfield();
    }

    createStarfield() {
        // Create a starfield with thousands of stars
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 3000;
        
        // Create arrays for star positions and colors
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        
        // Generate random star positions on a large sphere
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            
            // Create stars in a spherical distribution around the field
            const radius = 400 + Math.random() * 200; // Distance from center
            const theta = Math.random() * Math.PI * 2; // Horizontal angle
            const phi = Math.random() * Math.PI; // Vertical angle
            
            // Convert spherical coordinates to cartesian
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);     // x
            positions[i3 + 1] = radius * Math.cos(phi);                   // y
            positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta); // z
            
            // Add some color variation to stars (white to slight blue/yellow tints)
            const colorVariation = 0.8 + Math.random() * 0.2; // 0.8 to 1.0
            const blueShift = Math.random() * 0.1; // Slight blue tint for some stars
            const yellowShift = Math.random() * 0.1; // Slight yellow tint for others
            
            colors[i3] = Math.min(1.0, colorVariation + yellowShift);     // Red
            colors[i3 + 1] = Math.min(1.0, colorVariation + yellowShift * 0.8); // Green  
            colors[i3 + 2] = Math.min(1.0, colorVariation + blueShift);   // Blue
        }
        
        // Set the position and color attributes
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Create star material with size variation
        const starMaterial = new THREE.PointsMaterial({
            size: 2,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending // Makes stars glow nicely
        });
        
        // Create the star field
        const stars = new THREE.Points(starGeometry, starMaterial);
        stars.name = 'starfield';
        this.scene.add(stars);
        
        // Add some brighter accent stars
        this.createBrightStars();
        
        // Add a subtle nebula effect
        this.createNebula();
    }

    createBrightStars() {
        // Add some larger, brighter stars for visual interest
        const brightStarCount = 50;
        const brightStarGeometry = new THREE.BufferGeometry();
        const brightPositions = new Float32Array(brightStarCount * 3);
        const brightColors = new Float32Array(brightStarCount * 3);
        
        for (let i = 0; i < brightStarCount; i++) {
            const i3 = i * 3;
            
            // Place bright stars further away
            const radius = 500 + Math.random() * 100;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            brightPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            brightPositions[i3 + 1] = radius * Math.cos(phi);
            brightPositions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
            
            // Bright white with slight color variations
            const intensity = 0.9 + Math.random() * 0.1;
            brightColors[i3] = intensity;
            brightColors[i3 + 1] = intensity;
            brightColors[i3 + 2] = intensity;
        }
        
        brightStarGeometry.setAttribute('position', new THREE.BufferAttribute(brightPositions, 3));
        brightStarGeometry.setAttribute('color', new THREE.BufferAttribute(brightColors, 3));
        
        const brightStarMaterial = new THREE.PointsMaterial({
            size: 4,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        
        const brightStars = new THREE.Points(brightStarGeometry, brightStarMaterial);
        brightStars.name = 'brightStars';
        this.scene.add(brightStars);
    }

    createNebula() {
        // Add a subtle nebula background for extra atmosphere
        const nebulaGeometry = new THREE.SphereGeometry(600, 32, 32);
        const nebulaMaterial = new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.BackSide, // Render on the inside
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                varying vec3 vPosition;
                void main() {
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                varying vec3 vPosition;
                
                void main() {
                    // Create subtle nebula effect with very low opacity
                    vec3 pos = vPosition * 0.01;
                    float noise = sin(pos.x + time * 0.1) * sin(pos.y + time * 0.15) * sin(pos.z + time * 0.12);
                    noise = (noise + 1.0) * 0.5; // Normalize to 0-1
                    
                    // Very subtle purple/blue nebula
                    vec3 nebulaColor = vec3(0.1, 0.05, 0.2) + vec3(0.05, 0.02, 0.1) * noise;
                    gl_FragColor = vec4(nebulaColor, 0.02 + noise * 0.01);
                }
            `
        });
        
        const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
        nebula.name = 'nebula';
        this.scene.add(nebula);
        
        // Store reference for animation
        this.nebulaMaterial = nebulaMaterial;
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75, // Field of view
            window.innerWidth / window.innerHeight, // Aspect ratio
            0.1, // Near plane
            1000 // Far plane
        );
        
        // Position camera for good overview of the field
        this.camera.position.set(0, 40, 60);
        this.camera.lookAt(0, 0, 0);
    }

    createRenderer() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            throw new Error('Canvas element #gameCanvas not found!');
        }
        
        console.log('Canvas dimensions:', canvas.clientWidth, 'x', canvas.clientHeight);
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        console.log('Renderer created successfully');
        console.log('Renderer size:', this.renderer.getSize(new THREE.Vector2()));
    }

    createLighting() {
        // Ambient light for overall illumination (brighter to ensure character visibility)
        const ambientLight = new THREE.AmbientLight(0x6a7fab, 0.6);
        this.scene.add(ambientLight);

        // Main stadium lights (bright white floods)
        const stadiumLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
        stadiumLight1.position.set(50, 80, 50);
        stadiumLight1.castShadow = true;
        
        // Configure shadow properties
        stadiumLight1.shadow.mapSize.width = 2048;
        stadiumLight1.shadow.mapSize.height = 2048;
        stadiumLight1.shadow.camera.near = 0.5;
        stadiumLight1.shadow.camera.far = 200;
        stadiumLight1.shadow.camera.left = -100;
        stadiumLight1.shadow.camera.right = 100;
        stadiumLight1.shadow.camera.top = 100;
        stadiumLight1.shadow.camera.bottom = -100;

        this.scene.add(stadiumLight1);

        // Secondary stadium light from opposite angle
        const stadiumLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
        stadiumLight2.position.set(-40, 70, -40);
        stadiumLight2.castShadow = true;
        stadiumLight2.shadow.mapSize.width = 1024;
        stadiumLight2.shadow.mapSize.height = 1024;
        stadiumLight2.shadow.camera.near = 0.5;
        stadiumLight2.shadow.camera.far = 200;
        stadiumLight2.shadow.camera.left = -80;
        stadiumLight2.shadow.camera.right = 80;
        stadiumLight2.shadow.camera.top = 80;
        stadiumLight2.shadow.camera.bottom = -80;
        
        this.scene.add(stadiumLight2);

        // Subtle starlight from above (cooler temperature)
        const starLight = new THREE.DirectionalLight(0x6a7fab, 0.2);
        starLight.position.set(0, 100, 0);
        this.scene.add(starLight);

        // Add some colored accent lighting for atmosphere
        const accentLight1 = new THREE.PointLight(0x4a9eff, 0.3, 100);
        accentLight1.position.set(30, 20, 30);
        this.scene.add(accentLight1);

        const accentLight2 = new THREE.PointLight(0xff7a4a, 0.2, 100);
        accentLight2.position.set(-30, 20, -30);
        this.scene.add(accentLight2);

        // Add specific character spotlight for visibility
        const characterSpotlight = new THREE.SpotLight(0xffffff, 1.0, 50, Math.PI / 6, 0.1);
        characterSpotlight.position.set(0, 25, 9); // Above the batsman position
        characterSpotlight.target.position.set(0, 0, 9); // Point at batsman
        this.scene.add(characterSpotlight);
        this.scene.add(characterSpotlight.target);
        
        console.log('✅ Enhanced lighting created with character spotlight');
    }

    createField() {
        // Create the main oval cricket field
        const fieldGeometry = new THREE.CircleGeometry(this.FIELD_RADIUS, 64);
        const fieldMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2d5016, // Dark green grass
            side: THREE.DoubleSide 
        });
        
        const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
        field.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        field.receiveShadow = true;
        field.name = 'cricketField';
        
        this.scene.add(field);

        // Add some texture variation to the field
        this.addFieldPattern();
    }

    addFieldPattern() {
        // Create circular mowing patterns typical of cricket fields
        for (let i = 1; i <= 5; i++) {
            const ringGeometry = new THREE.RingGeometry(
                i * (this.FIELD_RADIUS / 6), 
                i * (this.FIELD_RADIUS / 6) + 1, 
                64
            );
            const ringMaterial = new THREE.MeshLambertMaterial({ 
                color: i % 2 === 0 ? 0x3d6026 : 0x2d5016,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide 
            });
            
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.01; // Slightly above field to avoid z-fighting
            ring.name = `fieldPattern${i}`;
            
            this.scene.add(ring);
        }
    }

    createPitch() {
        // Create the cricket pitch (22 yards x 10 feet)
        const pitchGeometry = new THREE.BoxGeometry(
            this.PITCH_WIDTH, 
            0.1, 
            this.PITCH_LENGTH
        );
        
        const pitchMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xDEB887 // Sandy brown color for the pitch
        });
        
        const pitch = new THREE.Mesh(pitchGeometry, pitchMaterial);
        pitch.position.set(0, 0.05, 0); // Slightly raised above field
        pitch.receiveShadow = true;
        pitch.castShadow = true;
        pitch.name = 'cricketPitch';
        
        this.scene.add(pitch);

        // Add pitch markings
        this.addPitchMarkings();

        // Add stumps at both ends
        this.addStumps();
    }

    addPitchMarkings() {
        // Bowling crease lines
        const creaseGeometry = new THREE.BoxGeometry(this.PITCH_WIDTH + 0.5, 0.02, 0.1);
        const creaseMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

        // Bowling creases at both ends
        const crease1 = new THREE.Mesh(creaseGeometry, creaseMaterial);
        crease1.position.set(0, 0.11, this.PITCH_LENGTH / 2);
        crease1.name = 'bowlingCrease1';
        
        const crease2 = new THREE.Mesh(creaseGeometry, creaseMaterial);
        crease2.position.set(0, 0.11, -this.PITCH_LENGTH / 2);
        crease2.name = 'bowlingCrease2';

        this.scene.add(crease1);
        this.scene.add(crease2);

        // Popping creases (smaller lines in front of stumps)
        const poppingCreaseGeometry = new THREE.BoxGeometry(this.PITCH_WIDTH, 0.02, 0.05);
        
        const poppingCrease1 = new THREE.Mesh(poppingCreaseGeometry, creaseMaterial);
        poppingCrease1.position.set(0, 0.11, this.PITCH_LENGTH / 2 - 1.22); // 4 feet in front
        poppingCrease1.name = 'poppingCrease1';
        
        const poppingCrease2 = new THREE.Mesh(poppingCreaseGeometry, creaseMaterial);
        poppingCrease2.position.set(0, 0.11, -this.PITCH_LENGTH / 2 + 1.22);
        poppingCrease2.name = 'poppingCrease2';

        this.scene.add(poppingCrease1);
        this.scene.add(poppingCrease2);
    }

    addStumps() {
        // Create wicket stumps at both ends
        const stumpGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.71); // Standard stump height
        const stumpMaterial = new THREE.MeshLambertMaterial({ color: 0xDEBDDB });

        // Create stumps for both ends
        for (let end = 0; end < 2; end++) {
            const zPosition = end === 0 ? this.PITCH_LENGTH / 2 : -this.PITCH_LENGTH / 2;
            
            for (let i = 0; i < 3; i++) {
                const stump = new THREE.Mesh(stumpGeometry, stumpMaterial);
                stump.position.set((i - 1) * 0.1, 0.355, zPosition); // Space stumps 10cm apart
                stump.castShadow = true;
                stump.name = `stump_${end}_${i}`;
                
                this.scene.add(stump);
            }

            // Add bails on top of stumps
            const bailGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.11);
            const bailMaterial = new THREE.MeshLambertMaterial({ color: 0xDEBDDB });
            
            for (let i = 0; i < 2; i++) {
                const bail = new THREE.Mesh(bailGeometry, bailMaterial);
                bail.position.set((i - 0.5) * 0.1, 0.72, zPosition);
                bail.rotation.z = Math.PI / 2;
                bail.castShadow = true;
                bail.name = `bail_${end}_${i}`;
                
                this.scene.add(bail);
            }
        }
    }

    createBoundary() {
        // Create boundary rope/marker
        const boundaryGeometry = new THREE.TorusGeometry(this.FIELD_RADIUS - 2, 0.1, 8, 64);
        const boundaryMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.8 
        });
        
        const boundary = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
        boundary.rotation.x = -Math.PI / 2;
        boundary.position.y = 0.1;
        boundary.name = 'boundary';
        
        this.scene.add(boundary);
    }

    createControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.enableZoom = true;
        this.controls.enableRotate = true;
        this.controls.enablePan = true;
        
        // Set some reasonable limits
        this.controls.maxDistance = 150;
        this.controls.minDistance = 10;
        this.controls.maxPolarAngle = Math.PI / 2.1; // Prevent going below ground
    }

    loadCharacter() {
        console.log('🎯 Loading cricket character with animation...');
        
        const loader = new FBXLoader();
        loader.load('idling.fbx', (fbxObject) => {
            // Scale and setup shadows
            fbxObject.scale.setScalar(1);
            fbxObject.traverse(c => {
                c.castShadow = true;
            });
    
            // Setup animation mixer and play the embedded animation
            this.animationMixer = new THREE.AnimationMixer(fbxObject);
            
            // Check if animations exist in the loaded file
            if (fbxObject.animations && fbxObject.animations.length > 0) {
                const idle = this.animationMixer.clipAction(fbxObject.animations[0]);
                idle.play();
                console.log('✅ Idling animation loaded successfully!');
            } else {
                console.warn('⚠️ No animations found in the FBX file');
            }
    
            console.log('✅ Character with animation loaded successfully!');
            this.scene.add(fbxObject);
            this.setupRealCharacter(fbxObject);
            
            // Load additional animations for batsman
            this.loadMainCharacterAnimation('hitting.fbx');
        }, 
        // Progress callback
        (progress) => {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        // Error callback
        (error) => {
            console.error('❌ Error loading character:', error);
        });
    }




        // // Check if FBXLoader is available
        // if (typeof THREE.FBXLoader === 'undefined') {
        //     console.error('❌ FBXLoader not loaded!');
        //     this.createSimpleCharacter();
        //     return;
        // }
        
        // const loader = new THREE.FBXLoader();
        
        // // Load the real FBX file
        // console.log('🔄 Attempting to load FBX character from character.fbx...');
        
        // loader.load('character.fbx', (characterFbx) => {
        //     console.log('✅ Real FBX Character model loaded successfully!');
        //     console.log('FBX has', characterFbx.animations?.length || 0, 'animations');
        //     console.log('FBX children:', characterFbx.children.length);
        //     console.log('🎯 Using actual FBX model from file!');
            
        //     this.setupRealCharacter(characterFbx);
            
        //     // Load additional running animation
        //     this.loadCharacterAnimation();
        // }, (progress) => {
        //     const percent = Math.round((progress.loaded / progress.total) * 100);
        //     if (percent % 25 === 0) { // Log every 25%
        //         console.log(`Loading FBX: ${percent}%`);
        //     }
        // }, (error) => {
        //     console.log('❌ FBX loading failed, using fallback character');
        //     console.log('Error details:', error);
        //     this.createSimpleCharacter();
        // });
    //}

    setupRealCharacter(characterModel) {
        this.character = characterModel;
        console.log('🎯 Setting up real FBX character...');
        
        // Calculate the bounding box to determine appropriate scaling
        const bbox = new THREE.Box3().setFromObject(characterModel);
        const size = bbox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        console.log('Character dimensions:', size);
        console.log('Max dimension:', maxDimension);
        
        // Scale the character appropriately for the cricket field
        let scaleValue = 1;
        if (maxDimension > 100) {
            scaleValue = 3 / maxDimension; // Very large model
            console.log('Large character detected, scaling to:', scaleValue);
        } else if (maxDimension > 10) {
            scaleValue = 2 / maxDimension; // Medium model
            console.log('Medium character detected, scaling to:', scaleValue);
        } else if (maxDimension < 1) {
            scaleValue = 2; // Very small model
            console.log('Small character detected, scaling to:', scaleValue);
        } else {
            scaleValue = 2 / maxDimension; // Normal scaling
            console.log('Normal character detected, scaling to:', scaleValue);
        }
        
        this.character.scale.setScalar(scaleValue);
        
        // Position the character on the cricket pitch (batsman position)
        this.character.position.set(0, 0, 9); // Batsman's end
        
        // Make character face towards the bowler (straight ahead, same height)
        const targetDirection = new THREE.Vector3(10, 0, 10);
        this.character.lookAt(targetDirection);
        
        // Enable shadows and improve materials
        this.character.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Improve material properties for better lighting
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(material => 
                            this.enhanceCharacterMaterial(material)
                        );
                    } else {
                        child.material = this.enhanceCharacterMaterial(child.material);
                    }
                }
                
                // Debug: Log mesh info to help identify invisible parts
                console.log('Character mesh:', child.name, 'Material color:', 
                    child.material?.color?.getHex().toString(16));
            }
        });
        
        // Create animation mixer for real FBX animations
        this.animationMixer = new THREE.AnimationMixer(this.character);
        
        // Set up built-in animations from the FBX file
        if (characterModel.animations && characterModel.animations.length > 0) {
            console.log('Found', characterModel.animations.length, 'built-in FBX animations');
            characterModel.animations.forEach((clip, index) => {
                const action = this.animationMixer.clipAction(clip);
                this.characterAnimations.set(`fbx_${index}`, action);
                console.log(`Added FBX animation ${index}: ${clip.name || 'unnamed'} (${clip.duration.toFixed(2)}s)`);
            });
            
            // Start with the first animation
            if (this.characterAnimations.size > 0) {
                this.playAnimation('fbx_0');
            }
        } else {
            console.log('No built-in animations found in FBX file');
        }
        
        // Add character to scene
        this.scene.add(this.character);
        
        console.log(`✅ Real FBX character ready! Animations: ${this.characterAnimations.size}, Position: (${this.character.position.x}, ${this.character.position.y}, ${this.character.position.z})`);
        console.log('Scale:', this.character.scale.x);
    }

    enhanceCharacterMaterial(material) {
        if (!material) return;
        
        // Clone material to avoid affecting other objects
        material = material.clone();
        material.needsUpdate = true;
        
        // Enhance material properties for better visibility
        if (material.color) {
            const currentColor = material.color.getHex();
            
            // If material is too dark (less than 0x555555), brighten it significantly
            if (currentColor < 0x555555) {
                material.color.setHex(0xaaaaaa); // Medium gray
                console.log(`Enhanced dark material from ${currentColor.toString(16)} to aaaaaa`);
            }
            // If material is black or very dark, make it a skin tone or clothing color
            else if (currentColor < 0x111111) {
                // Randomly assign either skin tone or clothing color
                const colors = [0xfdbcb4, 0x4a90e2, 0x2d5016, 0x8B4513]; // skin, blue, green, brown
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                material.color.setHex(randomColor);
                console.log(`Enhanced very dark material to ${randomColor.toString(16)}`);
            }
        }
        
        // Ensure material has proper lighting response
        if (material.type === 'MeshStandardMaterial' || material.type === 'MeshPhongMaterial') {
            material.roughness = material.roughness || 0.5;
            material.metalness = material.metalness || 0.1;
        }
        
        // Make sure material is visible and responds to light
        material.transparent = false;
        material.opacity = 1.0;
        material.visible = true;
        
        return material;
    }

    createSimpleCharacter() {
        console.log('🎮 Creating fallback simple character...');
        
        // Create a simple fallback character using basic geometry
        const character = new THREE.Group();
        character.name = 'Fallback Cricket Character';
        
        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4a90e2 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.0;
        character.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xfdbcb4 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.9;
        character.add(head);
        
        // Simple arms and legs
        const limbGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6);
        const limbMaterial = new THREE.MeshLambertMaterial({ color: 0xfdbcb4 });
        
        // Arms
        const leftArm = new THREE.Mesh(limbGeometry, limbMaterial);
        leftArm.position.set(-0.4, 1.2, 0);
        character.add(leftArm);
        
        const rightArm = new THREE.Mesh(limbGeometry, limbMaterial);
        rightArm.position.set(0.4, 1.2, 0);
        character.add(rightArm);
        
        // Legs
        const leftLeg = new THREE.Mesh(limbGeometry, limbMaterial);
        leftLeg.position.set(-0.15, 0.4, 0);
        character.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(limbGeometry, limbMaterial);
        rightLeg.position.set(0.15, 0.4, 0);
        character.add(rightLeg);
        
        this.setupCharacter(character);
    }

    setupCharacter(characterModel) {
        this.character = characterModel;
        
        let characterType;
        if (characterModel.userData?.isSimpleCharacter) {
            characterType = 'Simple';
        } else if (characterModel.userData?.isEnhancedCharacter) {
            characterType = 'Enhanced';
        } else if (this.isPlaceholderCharacter(characterModel)) {
            characterType = 'Placeholder';
        } else {
            characterType = 'Real FBX';
        }
        console.log(`Setting up ${characterType} character with ${characterModel.children.length} children`);
        
        // Scale the character to appropriate size
        if (characterModel.userData && characterModel.userData.isSimpleCharacter) {
            this.character.scale.setScalar(3); // Make simple character bigger for visibility
        } else if (characterModel.userData && characterModel.userData.isEnhancedCharacter) {
            this.character.scale.setScalar(2); // Enhanced character is already well-proportioned
        } else if (this.isPlaceholderCharacter(characterModel)) {
            this.character.scale.setScalar(3); // Placeholder characters need to be scaled up like simple characters
        } else {
            // Real FBX models - try to detect appropriate scale
            const bbox = new THREE.Box3().setFromObject(characterModel);
            const size = bbox.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);
            
            if (maxDimension > 100) {
                this.character.scale.setScalar(0.03); // Very large FBX model
                console.log('Large FBX detected, using 0.03 scale');
            } else if (maxDimension > 10) {
                this.character.scale.setScalar(0.3); // Medium FBX model
                console.log('Medium FBX detected, using 0.3 scale');
            } else {
                this.character.scale.setScalar(3); // Small FBX model
                console.log('Small FBX detected, using 3.0 scale');
            }
        }
        
        // Position the character on the cricket pitch (batsman position)
        this.character.position.set(0, 0, 9); // Batsman's end
        
        // Make character face towards the bowler (straight ahead, same height)
        const targetDirection = new THREE.Vector3(0, 0, -10);
        this.character.lookAt(targetDirection);
        
        // Enable shadows
        this.character.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Enhance material properties for better lighting
                if (child.material) {
                    child.material.needsUpdate = true;
                }
            }
        });
        
        // Create animation mixer
        this.animationMixer = new THREE.AnimationMixer(this.character);
        
        // If the character has built-in animations, set them up
        if (characterModel.animations && characterModel.animations.length > 0) {
            console.log('Found', characterModel.animations.length, 'built-in animations');
            characterModel.animations.forEach((clip, index) => {
                const action = this.animationMixer.clipAction(clip);
                this.characterAnimations.set(`anim_${index}`, action);
                console.log(`Added animation ${index}: ${clip.name || 'unnamed'}`);
            });
            
            // Start with the first animation
            if (this.characterAnimations.size > 0) {
                this.playAnimation('anim_0');
            }
        }
        
        // Add character to scene
        this.scene.add(this.character);
        
        console.log(`✅ ${characterType} character ready! Animations: ${this.characterAnimations.size}, Position: (${this.character.position.x}, ${this.character.position.y}, ${this.character.position.z})`);
    }

    playHittingAnimation() {
        console.log('🏏 Playing hitting animation...');
        
        // Check if main character animation system is available
        if (!this.character || !this.characterAnimations || !this.animationMixer) {
            console.log('⚠️ Main character animation system not available');
            return false;
        }
        
        // Debug: Show all available animations
        console.log('Main character animations available:');
        this.characterAnimations.forEach((action, name) => {
            console.log(`  - ${name}`);
        });
        
        // Look for hitting animation in main character system
        let hittingAction = null;
        if (this.characterAnimations.has('hitting')) {
            hittingAction = this.characterAnimations.get('hitting');
        } else {
            // Try alternative names
            const altNames = ['extra_0', 'hitting', 'swing', 'bat'];
            for (let name of altNames) {
                if (this.characterAnimations.has(name)) {
                    hittingAction = this.characterAnimations.get(name);
                    console.log(`Using ${name} as hitting animation`);
                    break;
                }
            }
        }
        
        if (!hittingAction) {
            console.log('⚠️ No hitting animation found in main character');
            return false;
        }
        
        // Stop current animation
        if (this.currentAction) {
            this.currentAction.stop();
        }
        
        // Make character face the bowler during hitting
        const bowlerPosition = new THREE.Vector3(0, 0, -10); // Bowler is at negative Z
        this.character.lookAt(bowlerPosition);
        console.log('🎯 Character facing bowler for hitting');
        
        // Activate bat swing system for collision detection
        this.batSwing.isSwinging = true;
        this.batSwing.swingStartTime = Date.now();
        this.batSwing.swingDuration = 1500; // Match animation duration
        this.batSwing.swingDirection.set(0, 0, -1); // Hit toward bowler
        this.batSwing.swingPower = 1.2; // Medium-high power
        this.batSwing.batSpeed = 18; // Good bat speed for collision
        console.log('⚡ Bat swing system activated for hitting animation');
        
        // Play hitting animation
        hittingAction.reset();
        hittingAction.setLoop(THREE.LoopOnce); // Play once, don't repeat
        hittingAction.clampWhenFinished = true; // Stay at the last frame
        hittingAction.play();
        
        this.currentAction = hittingAction;
        
        console.log('✅ Hitting animation started');
        
        // Return to idle animation after hitting animation completes
        setTimeout(() => {
            this.playIdleAnimation();
        }, 1500); // Adjust timing based on hitting animation duration
        
        return true;
    }
    
    playIdleAnimation() {
        console.log('🏏 Returning to idle animation...');
        
        // Check if main character animation system is available
        if (!this.character || !this.characterAnimations || !this.animationMixer) {
            console.log('⚠️ Main character animation system not available');
            return false;
        }
        
        // Debug: Log all available animations
        console.log('Main character animations available:');
        this.characterAnimations.forEach((action, name) => {
            console.log(`  - ${name}`);
        });
        
        // Try different idle animation names
        const idleAnimNames = ['fbx_0', 'standingidle', 'idling', 'idle'];
        let idleAction = null;
        let animName = '';
        
        for (let name of idleAnimNames) {
            if (this.characterAnimations.has(name)) {
                idleAction = this.characterAnimations.get(name);
                animName = name;
                break;
            }
        }
        
        // If no standard idle found, use the first available animation
        if (!idleAction && this.characterAnimations.size > 0) {
            const firstAnimName = Array.from(this.characterAnimations.keys())[0];
            idleAction = this.characterAnimations.get(firstAnimName);
            animName = firstAnimName;
            console.log(`Using first available animation: ${animName}`);
        }
        
        if (!idleAction) {
            console.log('⚠️ No animations found at all');
            return false;
        }
        
        // Stop current animation
        if (this.currentAction) {
            this.currentAction.stop();
        }
        
        // Return character to original idle facing direction
        const idleDirection = new THREE.Vector3(10, 0, 10); // Original idle direction
        this.character.lookAt(idleDirection);
        console.log('🎯 Character returned to idle facing direction');
        
        // Play idle animation
        idleAction.reset();
        idleAction.setLoop(THREE.LoopRepeat); // Loop continuously
        idleAction.play();
        
        this.currentAction = idleAction;
        
        console.log(`✅ Playing ${animName} animation`);
        return true;
    }

    loadMainCharacterAnimation(animationFile) {
        console.log(`🏏 Loading ${animationFile} for main character...`);
        
        if (!this.character || !this.animationMixer) {
            console.log('⚠️ Main character not ready for animation loading');
            return;
        }
        
        const loader = new FBXLoader();
        
        loader.load(animationFile, (animFbx) => {
            if (animFbx.animations && animFbx.animations.length > 0) {
                const clip = animFbx.animations[0];
                const action = this.animationMixer.clipAction(clip);
                
                // Extract animation name from file
                const animName = animationFile.replace('.fbx', '');
                this.characterAnimations.set(animName, action);
                
                console.log(`✅ ${animName} animation loaded for main character`);
                console.log(`Main character now has ${this.characterAnimations.size} animations:`);
                this.characterAnimations.forEach((action, name) => {
                    console.log(`  - ${name}`);
                });
            } else {
                console.log(`⚠️ No animations found in ${animationFile}`);
            }
        }, undefined, (error) => {
            console.log(`❌ Could not load ${animationFile} for main character:`, error);
        });
    }

    loadCricketBall() {
        console.log('🏏 Loading cricket ball...');
        
        const loader = new GLTFLoader();
        loader.load('cricket_ball.glb', (gltf) => {
            this.cricketBall = gltf.scene;
            
            // Debug ball properties
            console.log('Ball scene loaded:', this.cricketBall);
            console.log('Ball children:', this.cricketBall.children.length);
            
            // Calculate ball bounding box for scaling
            const bbox = new THREE.Box3().setFromObject(this.cricketBall);
            const size = bbox.getSize(new THREE.Vector3());
            console.log('Ball original size:', size);
            
            // Scale the ball to a more visible size (increased for better visibility)
            const targetDiameter = 0.20; // 20cm for better visibility (larger than realistic)
            const currentMaxDimension = Math.max(size.x, size.y, size.z);
            const scaleValue = targetDiameter / currentMaxDimension;
            this.cricketBall.scale.setScalar(scaleValue);
            console.log('Ball scale applied:', scaleValue, '(20cm diameter for visibility)');
            
            // Ensure ball materials are visible
            this.cricketBall.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // Enhance material visibility
                    if (child.material) {
                        child.material.needsUpdate = true;
                    }
                    console.log('Ball mesh found:', child.name, 'Material:', child.material);
                }
            });
            
            // Position ball at bowler's end initially
            this.cricketBall.position.set(0, 3, -8);
            
            // Add ball to scene
            this.scene.add(this.cricketBall);
            
            console.log('✅ Cricket ball loaded successfully!');
        }, (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            if (percent % 25 === 0) {
                console.log(`Loading ball: ${percent}%`);
            }
        }, (error) => {
            console.log('❌ Cricket ball loading failed:', error);
        });
    }

    updateBallPhysics(deltaTime) {
        if (!this.cricketBall || !this.ballPhysics.isMoving) return;
        
        // Apply gravity
        this.ballPhysics.velocity.y += this.ballPhysics.gravity * deltaTime;
        
        // Update position
        this.cricketBall.position.add(
            this.ballPhysics.velocity.clone().multiplyScalar(deltaTime)
        );
        
        // Ground collision (y = 0 is ground level)
        if (this.cricketBall.position.y <= 0.035) { // Ball radius offset
            this.cricketBall.position.y = 0.035;
            
            // Bounce
            this.ballPhysics.velocity.y *= -this.ballPhysics.bounceCoefficient;
            
            // Apply friction to horizontal movement
            this.ballPhysics.velocity.x *= this.ballPhysics.friction;
            this.ballPhysics.velocity.z *= this.ballPhysics.friction;
            
            // Stop if moving very slowly
            if (this.ballPhysics.velocity.length() < 0.1) {
                this.ballPhysics.velocity.set(0, 0, 0);
                this.ballPhysics.isMoving = false;
                console.log('Ball stopped');
            }
        }
        
        // Keep ball within field boundaries
        const maxDistance = this.FIELD_RADIUS - 2;
        const ballDistance = Math.sqrt(
            this.cricketBall.position.x ** 2 + this.cricketBall.position.z ** 2
        );
        
        if (ballDistance > maxDistance) {
            // Simple boundary collision - reverse horizontal velocity
            this.ballPhysics.velocity.x *= -0.5;
            this.ballPhysics.velocity.z *= -0.5;
        }
    }

    bowlBall(direction, speed = 15) {
        if (!this.cricketBall) return;
        
        // Clear previous trail
        this.clearBallTrail();
        
        // Set trail color for bowling (blue)
        this.setBallTrailColor(0x4444ff);
        
        // Play bowling animation on bowler
        if (this.bowler) {
            this.loadCharacterAnimation(this.bowler, 'Throw.fbx', 'bowler');
            this.playCricketPlayerAnimation(this.bowler, 'Throw');
            console.log('🎳 Bowler playing throw animation');
        }
        
        // Reset ball position to bowler (higher release point)
        this.cricketBall.position.set(1, 3, -9);
        // Set velocity based on direction and speed (add upward component for proper cricket delivery)
        this.ballPhysics.velocity.set(
            direction.x * speed,
            Math.max(direction.y * speed, 2), // Minimum upward velocity for proper arc
            direction.z * speed
        );
        
        this.ballPhysics.isMoving = true;
        console.log('Ball bowled with velocity:', this.ballPhysics.velocity);
    }

    createBatCollisionSphere() {
        // Create a visible collision sphere around the bat area for debugging
        const sphereGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.3, // Semi-transparent green sphere for debugging
            wireframe: true 
        });
        
        this.batCollisionSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.scene.add(this.batCollisionSphere);
        
        // Position near batsman's bat area
        this.updateBatCollisionPosition();
        
        console.log('✅ Bat collision sphere created (green wireframe)');
    }

    createBallTrail() {
        // Create trail geometry and material
        this.ballTrail.geometry = new THREE.BufferGeometry();
        
        // Create material with gradient effect
        this.ballTrail.material = new THREE.LineBasicMaterial({
            color: 0xff4444, // Red trail
            transparent: true,
            opacity: 0.8,
            linewidth: 3 // Note: linewidth may not work on all systems
        });
        
        // Initialize empty geometry
        const positions = new Float32Array(this.ballTrail.maxPoints * 3);
        this.ballTrail.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Create line mesh
        this.ballTrail.mesh = new THREE.Line(this.ballTrail.geometry, this.ballTrail.material);
        this.scene.add(this.ballTrail.mesh);
        
        console.log('✅ Ball trail system created');
    }

    updateBallTrail() {
        if (!this.ballTrail.enabled || !this.cricketBall) return;
        
        // Add current ball position to trail
        const ballPos = this.cricketBall.position.clone();
        this.ballTrail.points.push(ballPos);
        
        // Remove old points if trail is too long
        if (this.ballTrail.points.length > this.ballTrail.maxPoints) {
            this.ballTrail.points.shift();
        }
        
        // Update trail geometry
        if (this.ballTrail.points.length > 1) {
            const positions = new Float32Array(this.ballTrail.points.length * 3);
            
            for (let i = 0; i < this.ballTrail.points.length; i++) {
                const point = this.ballTrail.points[i];
                positions[i * 3] = point.x;
                positions[i * 3 + 1] = point.y;
                positions[i * 3 + 2] = point.z;
            }
            
            this.ballTrail.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            this.ballTrail.geometry.attributes.position.needsUpdate = true;
            
            // Update draw range
            this.ballTrail.geometry.setDrawRange(0, this.ballTrail.points.length);
        }
    }

    clearBallTrail() {
        this.ballTrail.points = [];
        if (this.ballTrail.geometry) {
            const positions = new Float32Array(this.ballTrail.maxPoints * 3);
            this.ballTrail.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            this.ballTrail.geometry.setDrawRange(0, 0);
        }
    }

    setBallTrailColor(color) {
        if (this.ballTrail.material) {
            this.ballTrail.material.color.setHex(color);
        }
    }

    setTrailColorForShot(shot) {
        let color = 0xff4444; // Default red
        
        // Set colors based on shot power and type
        if (shot.power <= 0.5) {
            color = 0x44ff44; // Green for defensive shots
        } else if (shot.power <= 1.0) {
            color = 0xffff44; // Yellow for medium shots  
        } else if (shot.power <= 2.0) {
            color = 0xff8844; // Orange for aggressive shots
        } else {
            color = 0xff4444; // Red for power shots
        }
        
        // Special colors for specific shot types
        if (shot.description.includes('Lofted') || shot.description.includes('Helicopter') || shot.description.includes('Slog')) {
            color = 0xff44ff; // Magenta for big shots
        } else if (shot.description.includes('Cut') || shot.description.includes('Glance')) {
            color = 0x44ffff; // Cyan for placement shots
        }
        
        this.setBallTrailColor(color);
        console.log(`🎨 Trail color set to: #${color.toString(16)} for ${shot.description}`);
    }

    updateBatCollisionPosition() {
        if (!this.batCollisionSphere || !this.character) return;
        
        // Position collision sphere in front of batsman (bat area)
        this.batCollisionSphere.position.copy(this.character.position);
        this.batCollisionSphere.position.y += 1.0; // Bat height
        this.batCollisionSphere.position.z -= 0.5; // Slightly in front
    }

    checkBallBatCollision() {
        if (!this.cricketBall || !this.batCollisionSphere || !this.ballPhysics.isMoving) return false;
        
        const ballPosition = this.cricketBall.position;
        const batPosition = this.batCollisionSphere.position;
        
        const distance = ballPosition.distanceTo(batPosition);
        // Make collision more generous during hitting animation
        const collisionRadius = this.batSwing.isSwinging ? 1.5 : 0.35;
        
        return distance < collisionRadius;
    }

    playShot(shotType) {
        if (this.batSwing.isSwinging) return false; // Already swinging
        
        const shot = this.shotTypes[shotType];
        if (!shot) {
            console.log(`❌ Unknown shot type: ${shotType}`);
            return false;
        }
        
        console.log(`🏏 Playing ${shot.description} (Power: ${shot.power}, Direction: ${shot.direction})`);
        
        this.batSwing.isSwinging = true;
        this.batSwing.shotType = shotType;
        this.batSwing.swingDirection.set(shot.direction[0], shot.direction[1], shot.direction[2]).normalize();
        this.batSwing.swingPower = shot.power;
        this.batSwing.swingStartTime = Date.now();
        this.batSwing.batSpeed = shot.power * 15; // Convert power to bat speed
        
        // Play hitting animation (same animation for all shots)
        this.playHittingAnimation();
        
        return true;
    }

    swingBat(direction, power = 1.0) {
        // Legacy method for backward compatibility
        if (this.batSwing.isSwinging) return;
        
        this.batSwing.isSwinging = true;
        this.batSwing.swingDirection.copy(direction).normalize();
        this.batSwing.swingPower = Math.min(Math.max(power, 0.1), 2.0);
        this.batSwing.swingStartTime = Date.now();
        this.batSwing.batSpeed = power * 15;
        this.batSwing.shotType = 'custom';
        
        this.playHittingAnimation();
        console.log('🏏 Custom bat swing:', direction, 'Power:', power);
    }

    updateBatSwing() {
        if (!this.batSwing.isSwinging) return;
        
        const currentTime = Date.now();
        const elapsed = currentTime - this.batSwing.swingStartTime;
        
        if (elapsed >= this.batSwing.swingDuration) {
            // Swing finished
            this.batSwing.isSwinging = false;
            this.batSwing.batSpeed = 0;
            return;
        }
        
        // Calculate swing progress (0 to 1)
        const progress = elapsed / this.batSwing.swingDuration;
        
        // Bat speed peaks in the middle of the swing
        const speedMultiplier = Math.sin(progress * Math.PI);
        this.batSwing.batSpeed = this.batSwing.swingPower * 15 * speedMultiplier;
        
        // Update bat collision position during swing
        this.updateBatCollisionPosition();
    }

    hitBall() {
        if (!this.cricketBall || !this.ballPhysics.isMoving || !this.batSwing.isSwinging) return;
        
        // Get shot information
        const shotType = this.batSwing.shotType;
        const shot = this.shotTypes[shotType] || { 
            power: this.batSwing.swingPower, 
            direction: [this.batSwing.swingDirection.x, this.batSwing.swingDirection.y, this.batSwing.swingDirection.z],
            height: 0.2 
        };
        
        console.log(`🏏 Executing ${shot.description}...`);
        console.log(`Shot data: Power=${shot.power}, Direction=[${shot.direction}], Height=${shot.height}`);
        
        // Set trail color based on shot type
        this.setTrailColorForShot(shot);
        
        // Use shot-specific direction instead of bat swing direction
        const hitDirection = new THREE.Vector3(shot.direction[0], shot.direction[1], shot.direction[2]).normalize();
        
        // Calculate hit power with improved scaling
        const basePower = shot.power * 8; // Increased base power multiplier for more visible differences
        const powerMultiplier = this.calculateTimingMultiplier();
        const finalPower = basePower * powerMultiplier;
        
        // Apply velocity in shot direction
        this.ballPhysics.velocity.copy(hitDirection.multiplyScalar(finalPower));
        
        // Add upward component based on shot type (increased scaling)
        const heightVelocity = shot.height * 15; // Increased height scaling for more visible arc
        this.ballPhysics.velocity.y += heightVelocity;
        
        // Add minimal variation to preserve shot accuracy
        this.addMinimalShotVariation();
        
        console.log(`✅ ${shot.description} executed!`);
        console.log(`Final ball velocity: X=${this.ballPhysics.velocity.x.toFixed(1)}, Y=${this.ballPhysics.velocity.y.toFixed(1)}, Z=${this.ballPhysics.velocity.z.toFixed(1)}`);
        console.log(`Power: ${finalPower.toFixed(1)}, Height: ${heightVelocity.toFixed(1)}, Timing: ${this.batSwing.timing}`);
        
        // Trigger fielding system
        this.onBallHit();
        
        // End the swing after hitting
        this.batSwing.isSwinging = false;
        
        return true;
    }

    addMinimalShotVariation() {
        // Reduced variation to preserve shot direction accuracy
        const variation = 0.05; // Only 5% variation to maintain shot precision
        
        this.ballPhysics.velocity.x += (Math.random() - 0.5) * variation * Math.abs(this.ballPhysics.velocity.x);
        this.ballPhysics.velocity.y += (Math.random() - 0.5) * variation * Math.abs(this.ballPhysics.velocity.y);
        this.ballPhysics.velocity.z += (Math.random() - 0.5) * variation * Math.abs(this.ballPhysics.velocity.z);
    }

    calculateTimingMultiplier() {
        // Simple timing system based on how close ball is to optimal hitting zone
        if (!this.cricketBall) return 1.0;
        
        const ballPos = this.cricketBall.position;
        const batPos = this.character.position;
        const distance = ballPos.distanceTo(batPos);
        
        // Optimal hitting distance is around 1-2 units
        if (distance >= 1.0 && distance <= 2.0) {
            this.batSwing.timing = 'perfect';
            return 1.2; // Perfect timing bonus
        } else if (distance >= 0.5 && distance <= 3.0) {
            this.batSwing.timing = 'good';
            return 1.0; // Good timing
        } else {
            this.batSwing.timing = 'poor';
            return 0.7; // Poor timing penalty
        }
    }

    addShotVariation() {
        // Add slight randomness to make shots more realistic
        const variation = 0.1; // 10% variation
        
        this.ballPhysics.velocity.x += (Math.random() - 0.5) * variation * this.ballPhysics.velocity.x;
        this.ballPhysics.velocity.y += (Math.random() - 0.5) * variation * this.ballPhysics.velocity.y;
        this.ballPhysics.velocity.z += (Math.random() - 0.5) * variation * this.ballPhysics.velocity.z;
    }

    onBallHit() {
        console.log('🎯 Ball has been hit! Activating fielding system...');
        
        this.fieldingSystem.ballIsHit = true;
        this.fieldingSystem.ballLastPosition.copy(this.cricketBall.position);
        
        // Find nearest fielder
        const nearestFielder = this.findNearestFielder();
        if (nearestFielder) {
            this.fieldingSystem.nearestFielder = nearestFielder;
            this.fieldingSystem.chasingFielder = nearestFielder;
            
            console.log(`🏃 Nearest fielder: ${nearestFielder.userData.description} is chasing the ball!`);
            
            // Set fielder to chasing state
            this.fieldingSystem.fielderStates.set(nearestFielder.userData.description, 'chasing');
            
            // Start running animation for the nearest fielder
            this.startFielderChasing(nearestFielder);
        } else {
            console.log('⚠️ No fielders available to chase the ball');
        }
    }

    findNearestFielder() {
        if (!this.cricketBall || this.fielders.length === 0) return null;
        
        // First try intelligent fielder selection based on shot direction
        const smartFielder = this.findFielderByZone();
        if (smartFielder) {
            return smartFielder;
        }
        
        // Fallback to trajectory prediction
        const predictedLanding = this.predictBallLanding();
        
        if (!predictedLanding) {
            // Last resort: use current ball position
            return this.findFielderByCurrentPosition();
        }
        
        console.log(`🎯 Predicted ball landing: (${predictedLanding.x.toFixed(1)}, ${predictedLanding.z.toFixed(1)})`);
        
        let nearestFielder = null;
        let minDistance = Infinity;
        
        this.fielders.forEach(fielder => {
            const distance = fielder.position.distanceTo(predictedLanding);
            console.log(`📏 ${fielder.userData.description}: distance ${distance.toFixed(1)} to landing spot`);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestFielder = fielder;
            }
        });
        
        if (nearestFielder) {
            console.log(`🏃 Best fielder for this shot: ${nearestFielder.userData.description} (${minDistance.toFixed(1)} units from landing)`);
        }
        
        return nearestFielder;
    }

    findFielderByZone() {
        if (!this.ballPhysics.velocity) return null;
        
        const velocity = this.ballPhysics.velocity;
        
        // Determine shot direction based on ball velocity
        let shotZone = 'straight';
        
        if (Math.abs(velocity.x) > Math.abs(velocity.z)) {
            // Ball is going more sideways than forward/backward
            if (velocity.x > 0) {
                shotZone = 'offSide'; // Positive X = off-side
            } else {
                shotZone = 'legSide'; // Negative X = leg-side
            }
        } else if (velocity.z > 0) {
            shotZone = 'behind'; // Positive Z = behind wicket
        }
        
        console.log(`🎯 Shot direction: ${shotZone} (velocity: ${velocity.x.toFixed(1)}, ${velocity.z.toFixed(1)})`);
        
        // Find fielders in the appropriate zone
        const preferredFielders = this.fieldingSystem.fieldingZones[shotZone] || [];
        
        let bestFielder = null;
        let minDistance = Infinity;
        
        // First check fielders in the preferred zone
        this.fielders.forEach(fielder => {
            const isInPreferredZone = preferredFielders.includes(fielder.userData.description);
            
            if (isInPreferredZone) {
                const ballPos = this.cricketBall.position;
                const distance = fielder.position.distanceTo(ballPos);
                
                console.log(`⭐ ${fielder.userData.description} is in ${shotZone} zone (distance: ${distance.toFixed(1)})`);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    bestFielder = fielder;
                }
            }
        });
        
        if (bestFielder) {
            console.log(`🎯 Zone-based selection: ${bestFielder.userData.description} from ${shotZone} zone`);
            return bestFielder;
        }
        
        console.log(`⚠️ No fielders found in ${shotZone} zone, falling back to distance calculation`);
        return null;
    }

    predictBallLanding() {
        if (!this.cricketBall || !this.ballPhysics.isMoving) return null;
        
        // Simple trajectory prediction using physics
        const currentPos = this.cricketBall.position.clone();
        const velocity = this.ballPhysics.velocity.clone();
        const gravity = this.ballPhysics.gravity;
        
        // Calculate time when ball hits ground (y = 0.035 - ball radius)
        const targetHeight = 0.035;
        const a = 0.5 * gravity;
        const b = velocity.y;
        const c = currentPos.y - targetHeight;
        
        // Solve quadratic equation: at² + bt + c = 0
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return null;
        
        const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
        
        // Take the positive time value that's in the future
        const timeToLand = Math.max(t1, t2);
        if (timeToLand <= 0) return null;
        
        // Calculate landing position
        const landingX = currentPos.x + velocity.x * timeToLand;
        const landingZ = currentPos.z + velocity.z * timeToLand;
        
        // Apply friction effect over time (ball slows down)
        const frictionFactor = Math.pow(this.ballPhysics.friction, timeToLand * 10);
        const adjustedX = currentPos.x + velocity.x * timeToLand * frictionFactor;
        const adjustedZ = currentPos.z + velocity.z * timeToLand * frictionFactor;
        
        return new THREE.Vector3(adjustedX, targetHeight, adjustedZ);
    }

    findFielderByCurrentPosition() {
        // Fallback method using current ball position
        const ballPosition = this.cricketBall.position;
        let nearestFielder = null;
        let minDistance = Infinity;
        
        this.fielders.forEach(fielder => {
            const distance = fielder.position.distanceTo(ballPosition);
            if (distance < minDistance) {
                minDistance = distance;
                nearestFielder = fielder;
            }
        });
        
        console.log(`📍 Using current position - Nearest: ${nearestFielder?.userData.description} (${minDistance.toFixed(2)})`);
        return nearestFielder;
    }

    startFielderChasing(fielder) {
        if (!fielder || !fielder.userData) return;
        
        console.log(`🏃 ${fielder.userData.description} is now chasing the ball!`);
        
        // Load running animation if not already loaded
        this.loadCharacterAnimation(fielder, 'runningcharacter.fbx', fielder.userData.description);
        
        // Play running animation
        setTimeout(() => {
            this.playCricketPlayerAnimation(fielder, 'runningcharacter');
        }, 100); // Small delay to ensure animation is loaded
    }

    updateFieldingSystem(deltaTime) {
        if (!this.fieldingSystem.ballIsHit) return;
        
        // Handle different fielder states
        this.fielders.forEach(fielder => {
            if (!fielder.userData || !fielder.userData.description) return;
            
            const fielderState = this.fieldingSystem.fielderStates.get(fielder.userData.description);
            
            if (fielderState === 'chasing') {
                this.updateFielderChasing(fielder, deltaTime);
            } else if (fielderState === 'returning') {
                this.updateFielderReturning(fielder, deltaTime);
            }
        });
    }

    updateFielderChasing(fielder, deltaTime) {
        if (!this.cricketBall) return;
        
        const ballPosition = this.cricketBall.position;
        
        // Calculate direction from fielder to ball
        const direction = ballPosition.clone().sub(fielder.position);
        direction.y = 0; // Keep fielder on ground
        const distance = direction.length();
        
        // If fielder is close enough to the ball, stop and throw
        if (distance < 2.0 && this.ballPhysics.velocity.length() < 0.5) {
            this.fielderReachBall(fielder);
            return;
        }
        
        // Move fielder towards ball if ball is still moving or far away
        if (this.ballPhysics.isMoving || distance > 1.0) {
            direction.normalize();
            const moveSpeed = 8; // Fielder movement speed
            
            // Move fielder towards ball
            fielder.position.add(direction.multiplyScalar(moveSpeed * deltaTime));
            
            // Make fielder face the ball
            const lookAtPosition = ballPosition.clone();
            lookAtPosition.y = fielder.position.y; // Same height for proper facing
            fielder.lookAt(lookAtPosition);
        }
    }

    updateFielderReturning(fielder, deltaTime) {
        const originalPosition = this.fieldingSystem.fielderOriginalPositions.get(fielder.userData.description);
        if (!originalPosition) return;
        
        // Calculate direction from fielder to original position
        const targetPos = new THREE.Vector3(originalPosition.x, originalPosition.y, originalPosition.z);
        const direction = targetPos.clone().sub(fielder.position);
        direction.y = 0; // Keep fielder on ground
        const distance = direction.length();
        
        // If fielder is close enough to original position, stop and return to idle
        if (distance < 1.0) {
            fielder.position.copy(targetPos);
            this.fielderReachedOriginalPosition(fielder);
            return;
        }
        
        // Move fielder towards original position
        direction.normalize();
        const moveSpeed = 6; // Slightly slower return speed
        
        fielder.position.add(direction.multiplyScalar(moveSpeed * deltaTime));
        
        // Make fielder face the direction they're moving
        const lookAtPosition = fielder.position.clone().add(direction);
        lookAtPosition.y = fielder.position.y;
        fielder.lookAt(lookAtPosition);
    }

    fielderReachBall(fielder) {
        console.log(`🤲 ${fielder.userData.description} has reached the ball!`);
        
        // Change state to throwing
        this.fieldingSystem.fielderStates.set(fielder.userData.description, 'throwing');
        
        // Stop ball movement
        this.ballPhysics.isMoving = false;
        this.ballPhysics.velocity.set(0, 0, 0);
        
        // Position ball near fielder
        this.cricketBall.position.copy(fielder.position);
        this.cricketBall.position.y += 1.5; // Hand height
        
        // Load and play throw animation
        this.loadCharacterAnimation(fielder, 'Throw.fbx', fielder.userData.description);
        
        setTimeout(() => {
            this.playCricketPlayerAnimation(fielder, 'Throw');
            console.log(`🚀 ${fielder.userData.description} is throwing the ball!`);
            
            // Start throwing ball back to bowler after animation starts
            setTimeout(() => {
                this.throwBallToBowler(fielder);
                
                // After throwing, start returning to original position
                setTimeout(() => {
                    this.startFielderReturning(fielder);
                }, 1000); // Wait for throw to complete
                
            }, 500); // Half second into throw animation
            
        }, 100);
    }

    startFielderReturning(fielder) {
        console.log(`🔄 ${fielder.userData.description} is returning to original position`);
        
        // Change state to returning
        this.fieldingSystem.fielderStates.set(fielder.userData.description, 'returning');
        
        // Start running animation for return journey
        this.playCricketPlayerAnimation(fielder, 'runningcharacter');
    }

    fielderReachedOriginalPosition(fielder) {
        console.log(`✅ ${fielder.userData.description} has returned to original position`);
        
        // Change state back to idle
        this.fieldingSystem.fielderStates.set(fielder.userData.description, 'idle');
        
        // Play idle animation
        this.playCricketPlayerAnimation(fielder, 'standingidle');
        
        // Make fielder face the batsman again
        fielder.lookAt(0, 0, 5);
        
        // Check if this was the last active fielder
        const activeFielders = Array.from(this.fieldingSystem.fielderStates.values()).filter(state => state !== 'idle');
        if (activeFielders.length === 0) {
            console.log('🏁 All fielders have returned to position - fielding complete!');
            this.fieldingSystem.ballIsHit = false;
            this.fieldingSystem.nearestFielder = null;
            this.fieldingSystem.chasingFielder = null;
        }
    }

    throwBallToBowler(fielder) {
        if (!this.bowler || !this.cricketBall) return;
        
        console.log(`🎯 ${fielder.userData.description} is throwing ball back to bowler!`);
        
        // Set trail color for fielder throws (green)
        this.setBallTrailColor(0x44ff44);
        
        // Calculate positions
        const fielderPos = this.cricketBall.position.clone();
        const bowlerPos = this.bowler.position.clone();
        bowlerPos.y += 1.5; // Chest height for catching
        
        // Calculate direction vector from fielder to bowler
        const throwDirection = bowlerPos.clone().sub(fielderPos);
        const distance = throwDirection.length();
        throwDirection.normalize(); // Convert to unit vector
        
        console.log(`📏 Distance to bowler: ${distance.toFixed(1)} units`);
        console.log(`🧭 Throw direction: X=${throwDirection.x.toFixed(2)}, Y=${throwDirection.y.toFixed(2)}, Z=${throwDirection.z.toFixed(2)}`);
        
        // Calculate precise throwing velocity for accurate delivery
        // Use controlled power based on distance to avoid overshooting
        const maxThrowDistance = 60; // Maximum expected throw distance on cricket field
        const normalizedDistance = Math.min(distance / maxThrowDistance, 1.0); // Normalize to 0-1
        
        // Moderate base speed to prevent overshooting
        const baseThrowSpeed = 12; // Reduced from 18
        const distanceMultiplier = 1 + (normalizedDistance * 0.8); // Scale from 1.0 to 1.8 max
        const throwSpeed = baseThrowSpeed * distanceMultiplier;
        
        console.log(`⚡ Throw speed: ${throwSpeed.toFixed(1)} (distance: ${distance.toFixed(1)}, normalized: ${normalizedDistance.toFixed(2)}, multiplier: ${distanceMultiplier.toFixed(2)})`);
        
        // Calculate required velocity to reach bowler precisely
        // Use projectile motion equation: R = (v² * sin(2θ)) / g
        // For moderate arc (30 degrees), sin(2*30°) = sin(60°) = √3/2 ≈ 0.866
        const gravity = Math.abs(this.ballPhysics.gravity);
        const horizontalDistance = Math.sqrt(
            (bowlerPos.x - fielderPos.x) ** 2 + 
            (bowlerPos.z - fielderPos.z) ** 2
        );
        const verticalDistance = bowlerPos.y - fielderPos.y;
        
        // Calculate required initial speed for projectile to reach target
        // Using 30-degree launch angle for good balance of speed and arc
        const launchAngle = Math.PI / 6; // 30 degrees in radians
        const requiredSpeed = Math.sqrt(
            (gravity * horizontalDistance) / (Math.sin(2 * launchAngle) * Math.cos(launchAngle))
        );
        
        // Use the smaller of calculated speed or distance-based speed to prevent overshooting
        const finalThrowSpeed = Math.min(throwSpeed, requiredSpeed * 1.1); // 10% margin for accuracy
        
        // Set horizontal velocity components with controlled speed
        this.ballPhysics.velocity.x = throwDirection.x * finalThrowSpeed * Math.cos(launchAngle);
        this.ballPhysics.velocity.z = throwDirection.z * finalThrowSpeed * Math.cos(launchAngle);
        
        // Set upward velocity for proper arc
        this.ballPhysics.velocity.y = finalThrowSpeed * Math.sin(launchAngle);
        
        this.ballPhysics.isMoving = true;
        
        console.log(`🚀 Ball thrown with velocity: X=${this.ballPhysics.velocity.x.toFixed(1)}, Y=${this.ballPhysics.velocity.y.toFixed(1)}, Z=${this.ballPhysics.velocity.z.toFixed(1)}`);
        console.log(`📐 Physics calculation: Required speed=${requiredSpeed.toFixed(1)}, Final speed=${finalThrowSpeed.toFixed(1)}, Launch angle=30°`);
        console.log(`📏 Horizontal distance: ${horizontalDistance.toFixed(1)} units`);
        
        // Calculate estimated time to target for timeout
        const horizontalSpeed = Math.sqrt(this.ballPhysics.velocity.x ** 2 + this.ballPhysics.velocity.z ** 2);
        const estimatedTime = horizontalDistance / horizontalSpeed;
        
        // Reset fielding system after throw lands
        setTimeout(() => {
            this.resetFieldingSystem();
        }, Math.max(2500, estimatedTime * 1000 + 1000)); // Dynamic timeout based on throw time
    }

    resetFieldingSystem() {
        console.log('🔄 Resetting fielding system...');
        
        // Reset fielding states
        this.fieldingSystem.ballIsHit = false;
        this.fieldingSystem.nearestFielder = null;
        this.fieldingSystem.chasingFielder = null;
        
        // Return all fielders to their original positions and idle state
        this.fielders.forEach(fielder => {
            if (fielder.userData && fielder.userData.description) {
                // Reset state to idle
                this.fieldingSystem.fielderStates.set(fielder.userData.description, 'idle');
                
                // Move fielder back to original position
                const originalPos = this.fieldingSystem.fielderOriginalPositions.get(fielder.userData.description);
                if (originalPos) {
                    fielder.position.set(originalPos.x, originalPos.y, originalPos.z);
                    fielder.lookAt(0, 0, 5); // Face batsman
                }
                
                // Play idle animation
                this.playCricketPlayerAnimation(fielder, 'standingidle');
            }
        });
        
        console.log('✅ Fielding system reset - all fielders back to original positions and idle');
    }

    // Batting control methods (updated to use new shot system)
    playDefensiveShot() {
        return this.playShot('defensive');
    }

    playDriveShot() {
        return this.playShot('straightDrive');
    }

    playPullShot() {
        return this.playShot('pullShot');
    }

    playCutShot() {
        return this.playShot('cutShot');
    }

    playLoftedShot() {
        return this.playShot('loftedStraight');
    }

    // New shot methods
    playCoverDrive() {
        return this.playShot('coverDrive');
    }

    playOnDrive() {
        return this.playShot('onDrive');
    }

    playSquareCut() {
        return this.playShot('squareCut');
    }

    playUpperCut() {
        return this.playShot('upperCut');
    }

    playHookShot() {
        return this.playShot('hookShot');
    }

    playLegGlance() {
        return this.playShot('legGlance');
    }

    playLateCut() {
        return this.playShot('lateCut');
    }

    playReverseSwep() {
        return this.playShot('reverseSwep');
    }

    playSlog() {
        return this.playShot('slog');
    }

    playHelicopterShot() {
        return this.playShot('helicopter');
    }

    // Power variation methods
    playLightTap() {
        return this.playShot('lightTap');
    }

    playMediumHit() {
        return this.playShot('mediumHit');
    }

    playPowerShot() {
        return this.playShot('powerShot');
    }

    loadCricketTeam() {
        console.log('🏏 Loading cricket team...');
        
        // Define standard cricket fielding positions
        const fieldingPositions = [
            { name: 'slip', x: 3, z: 14.5, description: 'First Slip' },
            { name: 'gully', x: 12, z: 14.5, description: 'Gully' },
            { name: 'point', x: 20, z: 10, description: 'Point' },
            { name: 'cover', x: 20, z: -10, description: 'Cover' },
            { name: 'mid_off', x: 8, z: -22, description: 'Mid Off' },
            { name: 'mid_on', x: -8, z: -22, description: 'Mid On' },
            { name: 'square_leg', x: -15, z: -8, description: 'Square Leg' },
            { name: 'fine_leg', x: -12, z: 12, description: 'Fine Leg' },
            { name: 'third_man', x: 12, z: 35, description: 'Third Man' }
        ];
        
        // Load bowler at bowling end
        this.loadBowler();
        
        // Load wicket keeper behind stumps
        this.loadWicketKeeper();
        
        // Load fielders
        fieldingPositions.forEach((position, index) => {
            this.loadFielder(position, index);
        });
        
        console.log('✅ Cricket team loading initiated');
    }

    loadBowler() {
        const loader = new FBXLoader();
        loader.load('character.fbx', (character) => {
            // Use the same scaling logic as the main character
            this.setupCricketCharacter(character, 1, 0, -9, 0);
            
            // Load idle animation for bowler
            this.loadCharacterAnimation(character, 'standingidle.fbx', 'bowler');
            
            // Load throwing animation for bowler
            this.loadCharacterAnimation(character, 'Throw.fbx', 'bowler');
            
            this.bowler = character;
            this.cricketCharacters.push(character);
            this.scene.add(character);
            
            console.log('✅ Bowler loaded and positioned');
        }, undefined, (error) => {
            console.log('❌ Bowler loading failed:', error);
        });
    }

    loadWicketKeeper() {
        const loader = new FBXLoader();
        loader.load('character.fbx', (character) => {
            // Use the same scaling logic as the main character
            this.setupCricketCharacter(character, 0, 0, 15, Math.PI);
            
            // Load idle animation for keeper
            this.loadCharacterAnimation(character, 'standingidle.fbx', 'keeper');
            
            this.keeper = character;
            this.cricketCharacters.push(character);
            this.scene.add(character);
            
            console.log('✅ Wicket keeper loaded and positioned');
        }, undefined, (error) => {
            console.log('❌ Wicket keeper loading failed:', error);
        });
    }

    loadFielder(position, index) {
        const loader = new FBXLoader();
        loader.load('character.fbx', (character) => {
            // Use the same scaling logic as the main character
            this.setupCricketCharacter(character, position.x, 0, position.z, null);
            
            // Make fielder face the batsman/center of pitch
            character.lookAt(0, 0, 5);
            
            // Store fielder info
            character.userData = {
                fieldingPosition: position.name,
                description: position.description
            };
            
            // Store original position for return after fielding
            this.fieldingSystem.fielderOriginalPositions.set(position.description, {
                x: position.x,
                y: 0,
                z: position.z
            });
            
            // Initialize fielder state
            this.fieldingSystem.fielderStates.set(position.description, 'idle');
            
            // Load idle animation for fielder
            this.loadCharacterAnimation(character, 'standingidle.fbx', position.description);
            
            this.fielders.push(character);
            this.cricketCharacters.push(character);
            this.scene.add(character);
            
            console.log(`✅ ${position.description} loaded and positioned at (${position.x}, ${position.z})`);
        }, undefined, (error) => {
            console.log(`❌ ${position.description} loading failed:`, error);
        });
    }

    setupCricketCharacter(characterModel, x, y, z, rotationY) {
        // Calculate the bounding box to determine appropriate scaling (same as main character)
        const bbox = new THREE.Box3().setFromObject(characterModel);
        const size = bbox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        // Scale the character appropriately for the cricket field (same logic as main character)
        let scaleValue = 1;
        if (maxDimension > 100) {
            scaleValue = 3 / maxDimension; // Very large model
        } else if (maxDimension > 10) {
            scaleValue = 2 / maxDimension; // Medium model
        } else if (maxDimension < 1) {
            scaleValue = 2; // Very small model
        } else {
            scaleValue = 2 / maxDimension; // Normal scaling
        }
        
        characterModel.scale.setScalar(scaleValue);
        
        // Position the character
        characterModel.position.set(x, y, z);
        
        // Set rotation if specified
        if (rotationY !== null) {
            characterModel.rotation.y = rotationY;
        }
        
        // Enable shadows and improve materials (same as main character)
        characterModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Improve material properties for better lighting
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            material.needsUpdate = true;
                            // Enhance material if it's too dark
                            if (material.color && material.color.getHex() < 0x222222) {
                                material.color.setHex(0x888888);
                            }
                        });
                    } else {
                        child.material.needsUpdate = true;
                        // Enhance material if it's too dark
                        if (child.material.color && child.material.color.getHex() < 0x222222) {
                            child.material.color.setHex(0x888888);
                        }
                    }
                }
            }
        });
    }

    isPlaceholderCharacter(characterModel) {
        // Check if this is a placeholder character created by our FBXLoader
        if (characterModel.children.length > 0) {
            const firstChild = characterModel.children[0];
            return firstChild.name === 'character_placeholder';
        }
        return false;
    }

    loadCharacterAnimation(character, animationFile, characterName) {
        console.log(`Loading ${animationFile} for ${characterName}...`);
        
        const loader = new FBXLoader();
        
        loader.load(animationFile, (animFbx) => {
            if (!character.userData.animationMixer) {
                character.userData.animationMixer = new THREE.AnimationMixer(character);
                character.userData.animations = new Map();
                character.userData.currentAction = null;
            }
            
            if (animFbx.animations && animFbx.animations.length > 0) {
                const clip = animFbx.animations[0];
                const action = character.userData.animationMixer.clipAction(clip);
                
                // Extract animation name from file
                const animName = animationFile.replace('.fbx', '');
                character.userData.animations.set(animName, action);
                
                // Play the animation if it's the batsman idle animation
                if (animName === 'idling' && characterName === 'batsman') {
                    action.reset();
                    action.setLoop(THREE.LoopRepeat);
                    action.play();
                    character.userData.currentAction = action;
                    character.userData.currentAnimationName = animName;
                } else if (animName === 'standingidle') {
                    action.reset();
                    action.setLoop(THREE.LoopRepeat);
                    action.play();
                    character.userData.currentAction = action;
                    character.userData.currentAnimationName = animName;
                }
                
                console.log(`✅ ${animName} animation loaded for ${characterName}`);
            }
        }, undefined, (error) => {
            console.log(`❌ Could not load ${animationFile} for ${characterName}:`, error);
        });
    }

    playAnimation(animationName) {
        if (!this.animationMixer || !this.characterAnimations.has(animationName)) {
            console.log('Animation not found:', animationName);
            return;
        }
        
        // Stop current animation
        if (this.currentAction) {
            this.currentAction.stop();
        }
        
        // Play new animation
        this.currentAction = this.characterAnimations.get(animationName);
        this.currentAction.reset();
        this.currentAction.setLoop(THREE.LoopRepeat);
        this.currentAction.play();
        
        console.log('Playing animation:', animationName);
    }

    // Cricket team animation management methods
    playCricketPlayerAnimation(character, animationName) {
        if (!character || !character.userData || !character.userData.animations) {
            console.log('Character or animations not available');
            return false;
        }
        
        if (!character.userData.animations.has(animationName)) {
            console.log(`Animation ${animationName} not loaded for this character`);
            return false;
        }
        
        // Stop current animation
        if (character.userData.currentAction) {
            character.userData.currentAction.stop();
        }
        
        // Play new animation
        const action = character.userData.animations.get(animationName);
        action.reset();
        action.setLoop(THREE.LoopRepeat);
        action.play();
        
        character.userData.currentAction = action;
        character.userData.currentAnimationName = animationName;
        
        console.log(`Playing ${animationName} on ${character.userData.description || 'character'}`);
        return true;
    }

    playBowlerAnimation(animationName) {
        return this.playCricketPlayerAnimation(this.bowler, animationName);
    }

    playKeeperAnimation(animationName) {
        return this.playCricketPlayerAnimation(this.keeper, animationName);
    }

    playFielderAnimation(fieldingPosition, animationName) {
        const fielder = this.fielders.find(f => 
            f.userData && f.userData.fieldingPosition === fieldingPosition
        );
        return this.playCricketPlayerAnimation(fielder, animationName);
    }

    playAllFieldersAnimation(animationName) {
        let successCount = 0;
        this.fielders.forEach(fielder => {
            if (this.playCricketPlayerAnimation(fielder, animationName)) {
                successCount++;
            }
        });
        console.log(`Started ${animationName} on ${successCount} fielders`);
        return successCount;
    }

    loadAllAnimationsForCharacter(character, characterName) {
        // Load all available animations for a character
        this.availableAnimations.forEach(animFile => {
            this.loadCharacterAnimation(character, animFile, characterName);
        });
    }

    // Method to move character (for future use)
    moveCharacter(x, z) {
        if (this.character) {
            this.character.position.x = x;
            this.character.position.z = z;
        }
    }

    // Method to rotate character to face direction
    faceDirection(direction) {
        if (this.character) {
            this.character.lookAt(direction);
        }
    }

    addEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Handle visibility change (pause when tab not active)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Pause game logic here when ready
            } else {
                // Resume game logic here when ready
            }
        });

        // Add keyboard controls for character demonstration
        document.addEventListener('keydown', (event) => {
            if (!this.character) return;
            
            const moveSpeed = 1;
            
            switch(event.code) {
                case 'ArrowUp':
                    this.character.position.z -= moveSpeed;
                    break;
                case 'ArrowDown':
                    this.character.position.z += moveSpeed;
                    break;
                case 'ArrowLeft':
                    this.character.position.x -= moveSpeed;
                    break;
                case 'ArrowRight':
                    this.character.position.x += moveSpeed;
                    break;
                case 'Space':
                    // Toggle between available animations
                    if (this.characterAnimations.size > 0) {
                        const animNames = Array.from(this.characterAnimations.keys());
                        const currentIndex = animNames.findIndex(name => this.currentAction === this.characterAnimations.get(name));
                        const nextIndex = (currentIndex + 1) % animNames.length;
                        this.playAnimation(animNames[nextIndex]);
                    }
                    break;
                case 'Digit1':
                    // Test bowler catching animation
                    this.playBowlerAnimation('regularcatch');
                    break;
                case 'Digit2':
                    // Test keeper diving catch
                    this.playKeeperAnimation('divingcatch');
                    break;
                case 'Digit3':
                    // Test fielders throwing
                    this.playAllFieldersAnimation('Throw');
                    break;
                case 'Digit4':
                    // Reset all to idle
                    this.playBowlerAnimation('standingidle');
                    this.playKeeperAnimation('standingidle');
                    this.playAllFieldersAnimation('standingidle');
                    break;
                case 'Digit5':
                    // Test hitting animation on running character
                    if (this.character) {
                        this.playAnimation('extra_0'); // This might be hitting animation
                    }
                    break;
                case 'Digit6':
                    // Bowl ball towards batsman
                    this.bowlBall(new THREE.Vector3(0, 0, 1), 15);
                    break;
                case 'Digit7':
                    // Bowl ball to the left
                    this.bowlBall(new THREE.Vector3(0.5, 0, 1), 12);
                    break;
                case 'Digit8':
                    // Bowl ball to the right
                    this.bowlBall(new THREE.Vector3(-0.5, 0, 1), 12);
                    break;
                case 'Digit9':
                    // Bowl a bouncer (high ball)
                    this.bowlBall(new THREE.Vector3(0, 0.3, 1), 18);
                    break;
                case 'KeyQ':
                    // Defensive shot
                    this.playDefensiveShot();
                    break;
                case 'KeyW':
                    // Straight drive
                    this.playDriveShot();
                    break;
                case 'KeyE':
                    // Cut shot (off side)
                    this.playCutShot();
                    break;
                case 'KeyR':
                    // Pull shot (leg side)
                    this.playPullShot();
                    break;
                case 'KeyT':
                    // Lofted shot
                    this.playLoftedShot();
                    break;
                case 'KeyH':
                    // Play hitting animation
                    this.playHittingAnimation();
                    break;
                
                // Advanced off-side shots (ASDF row)
                case 'KeyA':
                    // Cover drive
                    this.playCoverDrive();
                    break;
                case 'KeyS':
                    // Square cut
                    this.playSquareCut();
                    break;
                case 'KeyD':
                    // Upper cut
                    this.playUpperCut();
                    break;
                case 'KeyF':
                    // Late cut
                    this.playLateCut();
                    break;
                
                // Advanced leg-side shots (ZXCV row)
                case 'KeyZ':
                    // On drive
                    this.playOnDrive();
                    break;
                case 'KeyX':
                    // Hook shot
                    this.playHookShot();
                    break;
                case 'KeyC':
                    // Leg glance
                    this.playLegGlance();
                    break;
                case 'KeyV':
                    // Reverse sweep
                    this.playReverseSwep();
                    break;
                
                // Power shots (Shift + numbers for aggressive shots)
                case 'ShiftLeft':
                case 'ShiftRight':
                    // Hold shift for power shots
                    break;
                
                // Aggressive shots
                case 'KeyG':
                    // Slog
                    this.playSlog();
                    break;
                case 'KeyB':
                    // Helicopter shot
                    this.playHelicopterShot();
                    break;
                
                // Power variations (Numbers 1-3)
                case 'Minus':
                    // Light tap
                    this.playLightTap();
                    break;
                case 'Equal':
                    // Power shot
                    this.playPowerShot();
                    break;
            }
            
            // Keep character on the field
            if (this.character) {
                this.character.position.x = Math.max(-this.FIELD_RADIUS + 5, Math.min(this.FIELD_RADIUS - 5, this.character.position.x));
                this.character.position.z = Math.max(-this.FIELD_RADIUS + 5, Math.min(this.FIELD_RADIUS - 5, this.character.position.z));
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Get delta time for smooth animations
        const deltaTime = this.clock.getDelta();
        
        // Update controls
        this.controls.update();
        
        // Update character animations
        if (this.animationMixer) {
            this.animationMixer.update(deltaTime);
        }
        
        // Update cricket team animations
        this.cricketCharacters.forEach(character => {
            if (character.userData && character.userData.animationMixer) {
                character.userData.animationMixer.update(deltaTime);
            }
        });
        
        // Update ball physics
        this.updateBallPhysics(deltaTime);
        
        // Update ball trail
        if (this.ballPhysics.isMoving) {
            this.updateBallTrail();
        }
        
        // Update batting system
        this.updateBatSwing();
        
        // Update fielding system
        this.updateFieldingSystem(deltaTime);
        
        // Check for ball-bat collision
        if (this.checkBallBatCollision() && this.batSwing.isSwinging) {
            const hit = this.hitBall();
            if (hit) {
                console.log('💥 Ball hit during animation!');
            }
        }
        
        // Animate nebula effect
        if (this.nebulaMaterial) {
            this.nebulaMaterial.uniforms.time.value += 0.005;
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    // Utility method to get field center
    getFieldCenter() {
        return new THREE.Vector3(0, 0, 0);
    }

    // Method to add objects to the scene (for future use)
    addToScene(object) {
        this.scene.add(object);
    }

    // Method to remove objects from the scene (for future use)
    removeFromScene(object) {
        this.scene.remove(object);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, checking Three.js...');
    
    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded!');
        document.body.innerHTML = '<div style="color: white; text-align: center; padding: 50px;">Error: Three.js failed to load</div>';
        return;
    }
    
    console.log('Three.js loaded successfully');
    console.log('Three.js version:', THREE.REVISION || 'unknown');
    console.log('CapsuleGeometry available:', typeof THREE.CapsuleGeometry !== 'undefined');
    
    console.log('OrbitControls loaded successfully (ES6 module)');
    
    console.log('FBXLoader loaded successfully (ES6 module)');
    
    try {
        const game = new CricketGame();
        
        // Make game instance globally accessible for debugging
        window.cricketGame = game;
        
        // Expose animation controls to console
        window.playBowlerAnimation = (anim) => game.playBowlerAnimation(anim);
        window.playKeeperAnimation = (anim) => game.playKeeperAnimation(anim);
        window.playFielderAnimation = (pos, anim) => game.playFielderAnimation(pos, anim);
        window.playAllFieldersAnimation = (anim) => game.playAllFieldersAnimation(anim);
        window.loadAllAnimations = () => {
            if (game.bowler) game.loadAllAnimationsForCharacter(game.bowler, 'bowler');
            if (game.keeper) game.loadAllAnimationsForCharacter(game.keeper, 'keeper');
            game.fielders.forEach((fielder, i) => {
                game.loadAllAnimationsForCharacter(fielder, `fielder${i}`);
            });
        };
        
        // Expose ball controls to console
        window.bowlBall = (direction, speed) => game.bowlBall(direction, speed);
        window.bowlStraight = () => game.bowlBall(new THREE.Vector3(0, 0, 1), 15);
        window.bowlBouncer = () => game.bowlBall(new THREE.Vector3(0, 0.3, 1), 18);
        
        // Expose batting controls to console
        window.playDefensiveShot = () => game.playDefensiveShot();
        window.playDriveShot = () => game.playDriveShot();
        window.playCutShot = () => game.playCutShot();
        window.playPullShot = () => game.playPullShot();
        window.playLoftedShot = () => game.playLoftedShot();
        window.swingBat = (direction, power) => game.swingBat(direction, power);
        window.playHittingAnimation = () => game.playHittingAnimation();
        window.playIdleAnimation = () => game.playIdleAnimation();
        
        // New shot types
        window.playCoverDrive = () => game.playCoverDrive();
        window.playOnDrive = () => game.playOnDrive();
        window.playSquareCut = () => game.playSquareCut();
        window.playUpperCut = () => game.playUpperCut();
        window.playHookShot = () => game.playHookShot();
        window.playLegGlance = () => game.playLegGlance();
        window.playLateCut = () => game.playLateCut();
        window.playReverseSwep = () => game.playReverseSwep();
        window.playSlog = () => game.playSlog();
        window.playHelicopterShot = () => game.playHelicopterShot();
        window.playLightTap = () => game.playLightTap();
        window.playMediumHit = () => game.playMediumHit();
        window.playPowerShot = () => game.playPowerShot();
        
        // Shot system helpers
        window.playShot = (shotType) => game.playShot(shotType);
        window.listAllShots = () => {
            console.log('🏏 Available Shot Types:');
            Object.keys(game.shotTypes).forEach(shotType => {
                const shot = game.shotTypes[shotType];
                console.log(`  ${shotType}: ${shot.description} (Power: ${shot.power}, Direction: [${shot.direction}], Height: ${shot.height})`);
            });
        };
        
        // Debug helpers
        window.testShotDirection = (shotType) => {
            const shot = game.shotTypes[shotType];
            if (shot) {
                console.log(`🎯 Testing ${shot.description}:`);
                console.log(`  Direction: [${shot.direction}] (X=${shot.direction[0]}, Y=${shot.direction[1]}, Z=${shot.direction[2]})`);
                console.log(`  Power: ${shot.power}`);
                console.log(`  Expected result:`);
                console.log(`    X > 0: Ball goes to off-side (right)`);
                console.log(`    X < 0: Ball goes to leg-side (left)`);
                console.log(`    Z < 0: Ball goes toward bowler`);
                console.log(`    Z > 0: Ball goes behind batsman`);
                return shot;
            } else {
                console.log(`❌ Shot type '${shotType}' not found`);
            }
        };
        
        window.showFieldCoords = () => {
            console.log('🏟️ Cricket Field Coordinates:');
            console.log('  Batsman: (0, 0, 9) - facing negative Z');
            console.log('  Bowler: (0, 0, -9) - straight ahead');
            console.log('  Off-side (right): Positive X');
            console.log('  Leg-side (left): Negative X');
            console.log('  Behind wicket: Positive Z');
            if (game.fielders.length > 0) {
                console.log('Fielder positions:');
                game.fielders.forEach(fielder => {
                    console.log(`  ${fielder.userData.description}: (${fielder.position.x.toFixed(1)}, ${fielder.position.z.toFixed(1)})`);
                });
            }
        };
        
        window.testFielderSelection = (shotType) => {
            console.log(`🧪 Testing fielder selection for ${shotType}:`);
            
            // Get shot data
            const shot = game.shotTypes[shotType];
            if (!shot) {
                console.log(`❌ Shot type '${shotType}' not found`);
                return;
            }
            
            // Simulate ball velocity
            const velocity = new THREE.Vector3(shot.direction[0], shot.direction[1], shot.direction[2]);
            velocity.multiplyScalar(shot.power * 8);
            
            console.log(`Ball velocity: X=${velocity.x.toFixed(1)}, Y=${velocity.y.toFixed(1)}, Z=${velocity.z.toFixed(1)}`);
            
            // Determine zone
            let shotZone = 'straight';
            if (Math.abs(velocity.x) > Math.abs(velocity.z)) {
                shotZone = velocity.x > 0 ? 'offSide' : 'legSide';
            } else if (velocity.z > 0) {
                shotZone = 'behind';
            }
            
            console.log(`Shot zone: ${shotZone}`);
            console.log(`Preferred fielders: ${game.fieldingSystem.fieldingZones[shotZone].join(', ')}`);
            
            // Show which fielders are in this zone
            const zoneFielders = game.fielders.filter(f => 
                game.fieldingSystem.fieldingZones[shotZone].includes(f.userData.description)
            );
            
            if (zoneFielders.length > 0) {
                console.log('Available fielders in zone:');
                zoneFielders.forEach(f => {
                    console.log(`  ${f.userData.description}: (${f.position.x.toFixed(1)}, ${f.position.z.toFixed(1)})`);
                });
            } else {
                console.log('⚠️ No fielders in preferred zone!');
            }
        };
        
        window.testThrowingPower = (fielderName) => {
            console.log(`🧪 Testing throwing power for ${fielderName}:`);
            
            // Find the fielder
            const fielder = game.fielders.find(f => f.userData.description === fielderName);
            if (!fielder) {
                console.log(`❌ Fielder '${fielderName}' not found`);
                return;
            }
            
            if (!game.bowler) {
                console.log(`❌ Bowler not found`);
                return;
            }
            
            // Calculate distance and throwing parameters
            const fielderPos = fielder.position.clone();
            const bowlerPos = game.bowler.position.clone();
            bowlerPos.y += 1.5;
            
            const distance = fielderPos.distanceTo(bowlerPos);
            console.log(`📏 Distance to bowler: ${distance.toFixed(1)} units`);
            
            // Calculate throwing power
            const baseThrowSpeed = 15;
            const distanceMultiplier = Math.max(1.0, distance / 20);
            const throwSpeed = baseThrowSpeed * distanceMultiplier;
            
            console.log(`⚡ Base throw speed: ${baseThrowSpeed}`);
            console.log(`📈 Distance multiplier: ${distanceMultiplier.toFixed(2)}`);
            console.log(`🚀 Final throw speed: ${throwSpeed.toFixed(1)}`);
            
            // Calculate if this is enough to reach the bowler
            const horizontalDistance = Math.sqrt(
                Math.pow(bowlerPos.x - fielderPos.x, 2) + 
                Math.pow(bowlerPos.z - fielderPos.z, 2)
            );
            
            const gravity = Math.abs(game.ballPhysics.gravity);
            const requiredSpeed = Math.sqrt(gravity * horizontalDistance / Math.sin(2 * Math.PI/4)); // 45 degree optimal
            
            console.log(`📊 Required speed to reach bowler: ${requiredSpeed.toFixed(1)}`);
            console.log(`✅ Can reach bowler: ${throwSpeed >= requiredSpeed ? 'YES' : 'NO'}`);
            
            return {
                distance,
                throwSpeed,
                requiredSpeed,
                canReach: throwSpeed >= requiredSpeed
            };
        };
        
        // Ball trail controls
        window.toggleBallTrail = () => {
            game.ballTrail.enabled = !game.ballTrail.enabled;
            console.log(`🎨 Ball trail ${game.ballTrail.enabled ? 'enabled' : 'disabled'}`);
            if (!game.ballTrail.enabled) {
                game.clearBallTrail();
            }
        };
        
        window.clearBallTrail = () => {
            game.clearBallTrail();
            console.log('🧹 Ball trail cleared');
        };
        
        window.setBallTrailColor = (color) => {
            game.setBallTrailColor(color);
            console.log(`🎨 Ball trail color set to: #${color.toString(16)}`);
        };
        
        // Expose fielding system for testing
        window.testFieldingSystem = () => {
            console.log('🧪 Testing fielding system...');
            console.log('Ball is hit:', game.fieldingSystem.ballIsHit);
            console.log('Fielders available:', game.fielders.length);
            
            game.fielders.forEach((fielder, i) => {
                const state = game.fieldingSystem.fielderStates.get(fielder.userData.description);
                const originalPos = game.fieldingSystem.fielderOriginalPositions.get(fielder.userData.description);
                console.log(`  ${i}: ${fielder.userData.description}`);
                console.log(`    Current: (${fielder.position.x.toFixed(1)}, ${fielder.position.z.toFixed(1)}) - State: ${state}`);
                console.log(`    Original: (${originalPos.x.toFixed(1)}, ${originalPos.z.toFixed(1)})`);
            });
            
            if (game.cricketBall) {
                console.log('Ball position:', game.cricketBall.position);
                const nearest = game.findNearestFielder();
                if (nearest) {
                    console.log('Nearest fielder:', nearest.userData.description);
                }
            }
        };
        window.resetFielding = () => game.resetFieldingSystem();
        
        console.log('Cricket 3D Game initialized successfully!');
        console.log('Camera: Mouse to orbit and zoom');
        console.log('Character: WASD/Arrow keys to move, Space to change animation');
        console.log('Cricket Animations:');
        console.log('  1: Bowler regular catch');
        console.log('  2: Keeper diving catch');
        console.log('  3: All fielders throw');
        console.log('  4: Reset all to idle');
        console.log('Ball Physics:');
        console.log('  N: Bowl straight');
        console.log('  M: Bowl to left');
        console.log('  ,: Bowl to right');
        console.log('  .: Bowl bouncer');
        console.log('Basic Batting Controls (QWERT):');
        console.log('  Q: Defensive shot');
        console.log('  W: Straight drive');
        console.log('  E: Cut shot (off side)');
        console.log('  R: Pull shot (leg side)');
        console.log('  T: Lofted shot');
        console.log('Advanced Off-Side Shots (ASDF):');
        console.log('  A: Cover drive');
        console.log('  S: Square cut');
        console.log('  D: Upper cut');
        console.log('  F: Late cut');
        console.log('Advanced Leg-Side Shots (ZXCV):');
        console.log('  Z: On drive');
        console.log('  X: Hook shot');
        console.log('  C: Leg glance');
        console.log('  V: Reverse sweep');
        console.log('Aggressive Shots:');
        console.log('  G: Slog');
        console.log('  B: Helicopter shot');
        console.log('Power Variations:');
        console.log('  -: Light tap');
        console.log('  =: Power shot');
        console.log('Other:');
        console.log('  H: Hitting animation (testing)');
        console.log('Console commands available:');
        console.log('  playBowlerAnimation("animationName")');
        console.log('  playKeeperAnimation("animationName")');
        console.log('  playFielderAnimation("fieldingPosition", "animationName")');
        console.log('  playAllFieldersAnimation("animationName")');
        console.log('  loadAllAnimations() - loads all animation files for all characters');
        console.log('  bowlStraight() - bowl ball straight');
        console.log('  bowlBouncer() - bowl high ball');
        console.log('  bowlBall(direction, speed) - custom bowling');
        console.log('Shot Commands:');
        console.log('  playDefensiveShot() - defensive stroke');
        console.log('  playDriveShot() - straight drive');
        console.log('  playCutShot() - cut to off side');
        console.log('  playPullShot() - pull to leg side');
        console.log('  playLoftedShot() - lofted shot');
        console.log('  playCoverDrive() - cover drive');
        console.log('  playOnDrive() - on drive');
        console.log('  playSquareCut() - square cut');
        console.log('  playUpperCut() - upper cut');
        console.log('  playHookShot() - hook shot');
        console.log('  playLegGlance() - leg glance');
        console.log('  playLateCut() - late cut');
        console.log('  playReverseSwep() - reverse sweep');
        console.log('  playSlog() - slog');
        console.log('  playHelicopterShot() - helicopter shot');
        console.log('  playLightTap() - light tap');
        console.log('  playPowerShot() - power shot');
        console.log('Advanced:');
        console.log('  playShot("shotType") - play any shot by name');
        console.log('  listAllShots() - show all available shots');
        console.log('  swingBat(direction, power) - custom batting');
        console.log('  playHittingAnimation() - play hitting animation');
        console.log('  playIdleAnimation() - return to idle animation');
        console.log('Debugging:');
        console.log('  testShotDirection("shotType") - debug shot direction');
        console.log('  testFielderSelection("shotType") - test fielder assignment');
        console.log('  testThrowingPower("fielderName") - test throw strength');
        console.log('  showFieldCoords() - show field coordinate system');
        console.log('Ball Trail:');
        console.log('  toggleBallTrail() - turn trail on/off');
        console.log('  clearBallTrail() - clear current trail');
        console.log('  setBallTrailColor(0xff0000) - set trail color (hex)');
        console.log('Fielding System:');
        console.log('  testFieldingSystem() - debug fielding system state');
        console.log('  resetFielding() - reset fielding system to idle');
        console.log('NOTE: Fielding automatically activates when ball is hit!');
    } catch (error) {
        console.error('Error initializing game:', error);
        document.body.innerHTML = '<div style="color: white; text-align: center; padding: 50px;">Error: ' + error.message + '</div>';
    }
}); 