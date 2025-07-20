import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
// Cricket Game - Three.js Implementation
// ✅ HYBRID FIELDING SYSTEM v2.0:
// - Debounced selection (120ms) for stable ball trajectory
// - Pass A: Aerial catch detection with role-based priority
// - Pass B: Ground chase with ETA-based selection 
// - Periodic re-evaluation (250ms) with handover logic
// - Dynamic position tracking and abort-catch detection
// - Debug overlay available (press 'F' in-game)

class CricketGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Game state
        this.isInitialized = false;
        this.isPaused = false;
        this.animationId = null;
        
        // ✅ NEW: Loading system
        this.loadingState = {
            isLoading: true,
            totalSteps: 8, // scene, camera, renderer, lighting, field, character, team, ball
            completedSteps: 0,
            currentStep: '',
            ballLoadingProgress: 0,
            characterLoadingProgress: 0,
            teamLoadingProgress: 0
        };
        
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
            straightDrive: { power: 1.7, direction: [0, 0, -1], height: 0.5, description: 'Straight Drive' },
            loftedStraight: { power: 2.5, direction: [0, 0, -1], height: 0.6, description: 'Lofted Straight' },
            
            // Off-side shots (right side for right-handed batsman) - Positive X
            cutShot: { power: 1.8, direction: [1, 0, -0.3], height: 0.15, description: 'Cut Shot' },
            squareCut: { power: 2.0, direction: [1, 0, 0.2], height: 0.2, description: 'Square Cut' },
            upperCut: { power: 2.2, direction: [0.8, 0, 0.4], height: 0.5, description: 'Upper Cut' },
            coverDrive: { power: 1.8, direction: [0.8, 0, -0.6], height: 0.25, description: 'Cover Drive' },
            
            // Leg-side shots (left side for right-handed batsman) - Negative X
            pullShot: { power: 2.2, direction: [-1, 0, -0.3], height: 0.3, description: 'Pull Shot' },
            hookShot: { power: 2.4, direction: [-0.9, 0, 0.3], height: 0.4, description: 'Hook Shot' },
            legGlance: { power: 1.5, direction: [-0.6, 0, 0.8], height: 0.1, description: 'Leg Glance' },
            onDrive: { power: 1.6, direction: [-0.7, 0, -0.7], height: 0.2, description: 'On Drive' },
            
            // Behind wicket shots - Positive Z
            lateCut: { power: 1.4, direction: [0.6, 0, 0.8], height: 0.1, description: 'Late Cut' },
            reverseSwep: { power: 1.8, direction: [0.8, 0, 0.6], height: 0.3, description: 'Reverse Sweep' },
            
            // Aggressive shots
            slog: { power: 2.5, direction: [-0.7, 0, -0.7], height: 0.8, description: 'Slog' },
            helicopter: { power: 2.5, direction: [0, 0, -1], height: 0.9, description: 'Helicopter Shot' },
            
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
        
        // Bowler receiving system
        this.bowlerReceivingSystem = {
            isReceivingThrow: false,
            catchZone: null, // Will be created when bowler loads
            catchZoneRadius: 2.5, // Units around bowler for automatic catch
            originalPosition: null // Store bowler's original position
        };
        
        // Fielding system with hybrid approach
        this.fieldingSystem = {
            ballIsHit: false,
            nearestFielder: null,
            chasingFielder: null,
            ballLastPosition: new THREE.Vector3(),
            fielderStates: new Map(), // Track fielder states: 'idle', 'chasing', 'throwing', 'returning', 'catching'
            fielderOriginalPositions: new Map(), // Store original fielding positions
            
            // Hybrid fielding constants
            DEBOUNCE_MS: 120,
            RE_EVAL_INTERVAL_MS: 250,
            HANDOVER_MARGIN_SEC: 0.7,
            HANDOVER_COOLDOWN_MS: 500,
            MAX_CATCH_INTERCEPT_DIST: 25,
            DEFAULT_TOP_SPEED: 8.0,
            MIN_AERIAL_HEIGHT: 1.5,
            KEEPER_BOWLER_PRIORITY_RADIUS: 15,
            
            // Current task tracking
            currentTask: null, // { fielder, mode: 'catch'|'ground', lastEval, startTime }
            nextSelectionTime: 0,
            
            // Fielding zones for better assignment (legacy support)
            fieldingZones: {
                'straight': ['Mid Off', 'Mid On'],
                'offSide': ['Cover', 'Point', 'Gully', 'Third Man'],
                'legSide': ['Square Leg', 'Fine Leg', 'Mid On'],
                'behind': ['First Slip', 'Fine Leg']
            },
            
            // Dynamic sector mapping (12 sectors around the field)
            sectorMap: new Map(), // sector index -> [fielders]
            TOTAL_SECTORS: 12,
            
            // Catching system
            catchingSystem: {
                catchRadius: 5.0, // 5-meter radius for catch detection
                divingCatchRadius: 3.0, // If ball is between 3-5 meters, use diving catch
                regularCatchRadius: 2.0, // If ball is within 2 meters, use regular catch
                catchInProgress: false,
                catchingFielder: null,
                catchResult: null, // 'success', 'dropped', null
                predictiveRange: 8.0, // 8-meter radius for predictive fielder movement
                anticipationTime: 2.0 // How far ahead (seconds) fielders predict
            }
        };
        
        // Running between wickets system
        this.runningSystem = {
            isRunning: false,
            runState: 'idle', // 'idle', 'running', 'turning', 'waiting'
            currentEnd: 'batsman', // 'batsman' or 'bowler'
            targetEnd: 'bowler',
            runSpeed: 8.0, // meters per second
            wicketPositions: {
                batsman: { x: 0, y: 0, z: 9 }, // Batsman's end (positive Z)
                bowler: { x: 0, y: 0, z: -9 } // Bowler's end (negative Z)
            },
            runProgress: 0, // 0 to 1 completion of current run
            runsCompleted: 0,
            turningAtEnd: false,
            waitingForNextRun: false
        };

        // Cricket scoring system
        this.cricketScore = {
            runs: 0,
            wickets: 0,
            overs: 0,
            balls: 0,
            ballsThisBall: 0,
            lastBoundaryType: null, // 'four' or 'six'
            ballHasBounced: false,
            boundaryAwarded: false,
            ballHasBeenHit: false // ✅ Track if ball has been hit (for bounce detection)
        };

        // Target chase system
        this.targetSystem = {
            isActive: false,
            targetRuns: 0,
            maxOvers: 2.0, // 2 overs = 12 balls
            maxBalls: 12,
            runsNeeded: 0,
            ballsRemaining: 12,
            oversRemaining: 2.0,
            requiredRunRate: 0.0,
            gameStatus: 'playing', // 'playing', 'won', 'lost'
            gameOverReason: null // 'target_achieved', 'overs_completed', 'all_out'
        };

        // Multiplayer system
        this.multiplayerSystem = {
            isActive: false,
            currentInnings: 1,
            maxOvers: 3.0, // 3 overs per innings
            maxBalls: 18, // 18 balls per innings
            player1: null,
            player2: null,
            battingPlayer: null,
            bowlingPlayer: null,
            firstInningsScore: 0,
            firstInningsWickets: 0,
            gameStatus: 'playing', // 'playing', 'innings_break', 'match_over'
            matchWinner: null
        };

        // Ball state management
        this.ballState = {
            isActive: false,
            isComplete: false,
            runsThisBall: 0,
            ballType: 'normal', // 'normal', 'boundary', 'missed'
            completionReason: null // 'boundary', 'fielded', 'missed'
        };

        // 3D Scoreboards system
        this.scoreboards = {
            batsman: null, // Scoreboard at batsman's end
            bowler: null,  // Scoreboard at bowler's end
            font: null,    // Loaded font for text rendering
            panels: {
                batsman: null, // Background panel for batsman scoreboard
                bowler: null   // Background panel for bowler scoreboard
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
        
        // ✅ NEW: Batting Team and Scorecard System
        this.battingTeam = {
            teamName: 'England',
            matchDetails: 'Cricket 3D - Practice Match',
            currentBatsman: 0, // Index of current batsman (0-10)
            currentPartner: 1,  // Index of non-striker (0-10)
            extras: {
                byes: 0,
                legByes: 0,
                wides: 0,
                noBalls: 0,
                penalties: 0
            },
            players: [
                // Opening batsmen
                { name: 'A Cook', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 1 },
                { name: 'S Robson', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 2 },
                
                // Top order
                { name: 'G Ballance', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 3 },
                { name: 'I Bell', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 4 },
                { name: 'J Root', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 5 },
                
                // Middle order
                { name: 'Moeen Ali', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 6 },
                { name: 'J Buttler', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 7 },
                
                // Lower order
                { name: 'C Woakes', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 8 },
                { name: 'C Jordan', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 9 },
                { name: 'S Broad', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 10 },
                { name: 'J Anderson', runs: 0, ballsFaced: 0, dismissal: null, isOut: false, position: 11 }
            ]
        };

        // Scorecard UI system
        this.scorecardUI = {
            isVisible: false,
            container: null,
            button: null
        };
        
        // ✅ NEW: Bowled Detection System
        this.bowledDetection = {
            stumpsAtBatsmanEnd: [], // Will store references to batsman's stumps
            stumpCollisionRadius: 0.45, // More generous collision radius around stumps (45cm)
            enabled: true
        };

        // ✅ NEW: Fielder positioning system
        this.fielderPositioning = {
            isActive: false, // Whether we're in fielding mode
            selectedFielder: null, // Currently selected fielder for moving
            isDragging: false, // Whether we're currently dragging a fielder
            dragStartPosition: new THREE.Vector3(),
            defaultPositions: new Map(), // Store original positions
            customPositions: new Map(), // Store custom positions
            mousePosition: new THREE.Vector2(),
            raycaster: new THREE.Raycaster(),
            camera: null, // Reference to camera for ray casting
            
            // Visual indicators
            selectionIndicator: null, // Highlight ring around selected fielder
            positionIndicators: [], // Array of position indicator objects
            
            // Validation settings
            boundaryBuffer: 5, // Minimum distance from boundary (meters)
            minDistanceFromBatsman: 10, // Minimum distance from batsman (meters)
            minDistanceBetweenFielders: 3 // Minimum distance between fielders (meters)
        };

        // ✅ NEW: AI Bowler System
        this.aiBowler = {
            isEnabled: true, // Can be disabled for multiplayer when human takes over
            isActive: false, // Whether AI is currently managing bowling
            bowlingStrategy: 'balanced', // 'aggressive', 'defensive', 'balanced', 'random'
            
            // Timing system
            autoBowlTimer: null,
            countdownTimer: null,
            autoBowlDelay: 3000, // 3 seconds after ball completion
            countdownActive: false,
            countdownElement: null,
            
            // Bowling variations (from existing digit key controls)
            bowlingVariations: {
                straight: { 
                    direction: new THREE.Vector3(-0.01, 0, 1), 
                    speed: 17, 
                    name: 'Straight Delivery',
                    description: 'Good length on the stumps',
                    difficulty: 'medium'
                },
                leftSide: { 
                    direction: new THREE.Vector3(0.02, 0, 1), 
                    speed: 17, 
                    name: 'Outside Off Stump',
                    description: 'Tempting the batsman to drive',
                    difficulty: 'easy'
                },
                rightSide: { 
                    direction: new THREE.Vector3(-0.05, 0, 1), 
                    speed: 17, 
                    name: 'Leg Stump Line',
                    description: 'Targeting the pads',
                    difficulty: 'easy'
                },
                yorker: { 
                    direction: new THREE.Vector3(-0.05, 0, 1.25), 
                    speed: 20, 
                    name: 'Yorker',
                    description: 'Full and fast at the stumps',
                    difficulty: 'hard'
                },
                bouncer: { 
                    direction: new THREE.Vector3(-0.05, -0.5, 1.5), 
                    speed: 25, 
                    name: 'Bouncer',
                    description: 'Short and aggressive',
                    difficulty: 'hard'
                }
            },
            
            // AI Strategy patterns
            strategies: {
                aggressive: {
                    name: 'Aggressive Attack',
                    description: 'Frequent yorkers and bouncers',
                    weights: { straight: 20, leftSide: 10, rightSide: 10, yorker: 35, bouncer: 25 }
                },
                defensive: {
                    name: 'Defensive Line',
                    description: 'Tight lines outside off stump',
                    weights: { straight: 40, leftSide: 35, rightSide: 20, yorker: 5, bouncer: 0 }
                },
                balanced: {
                    name: 'Balanced Attack',
                    description: 'Mix of all deliveries',
                    weights: { straight: 30, leftSide: 20, rightSide: 20, yorker: 15, bouncer: 15 }
                },
                random: {
                    name: 'Unpredictable',
                    description: 'Completely random deliveries',
                    weights: { straight: 20, leftSide: 20, rightSide: 20, yorker: 20, bouncer: 20 }
                }
            },
            
            // Game state awareness
            gameStateFactors: {
                ballsInOver: 0,
                runsThisOver: 0,
                recentBoundaries: [],
                batsmanAggression: 'medium', // 'low', 'medium', 'high'
                pressureSituation: false
            },
            
            // Statistics tracking
            stats: {
                ballsBowled: 0,
                wicketsTaken: 0,
                runsGiven: 0,
                boundariesConceded: 0,
                variationCount: {}
            }
        };

        // ✅ NEW: Multiplayer Bowling Interface
        this.multiplayerBowling = {
            isHumanControlled: false, // Switch to true for multiplayer mode
            humanPlayerId: null, // ID of human player controlling bowling
            controlTransitionPending: false,
            humanInputTimeout: 10000, // 10 seconds for human to input bowling choice
            humanInputTimer: null,
            humanInputElement: null
        };
    }

    // ✅ NEW: Loading system methods
    updateLoadingProgress(step, progress = null) {
        this.loadingState.currentStep = step;
        
        if (progress !== null) {
            // Update specific loading progress
            if (step.includes('ball')) {
                this.loadingState.ballLoadingProgress = progress;
            } else if (step.includes('character')) {
                this.loadingState.characterLoadingProgress = progress;
            } else if (step.includes('team')) {
                this.loadingState.teamLoadingProgress = progress;
            }
        }
        
        // Update loading screen
        this.updateLoadingScreen();
    }

    completeLoadingStep(step) {
        this.loadingState.completedSteps++;
        this.loadingState.currentStep = `✅ ${step} complete`;
        console.log(`✅ Loading step completed: ${step} (${this.loadingState.completedSteps}/${this.loadingState.totalSteps})`);
        
        // Update loading screen
        this.updateLoadingScreen();
        
        // Check if all loading is complete
        if (this.loadingState.completedSteps >= this.loadingState.totalSteps) {
            setTimeout(() => {
                this.completeLoading();
            }, 500);
        }
    }

    updateLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const loadingText = document.querySelector('.loading-text');
        const progressBar = document.querySelector('.loading-progress');
        
        if (!loadingScreen || !loadingText) return;
        
        // Show loading screen if not visible
        if (loadingScreen.style.display === 'none') {
            loadingScreen.style.display = 'flex';
        }
        
        // Update text
        loadingText.textContent = this.loadingState.currentStep;
        
        // Update progress bar if it exists, or create one
        if (!progressBar) {
            this.createProgressBar();
        } else {
            const overallProgress = (this.loadingState.completedSteps / this.loadingState.totalSteps) * 100;
            progressBar.style.width = `${overallProgress}%`;
        }
    }

    createProgressBar() {
        const loadingContent = document.querySelector('.loading-content');
        if (!loadingContent) return;
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'loading-progress-container';
        progressContainer.style.cssText = `
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            margin: 20px 0;
            overflow: hidden;
        `;
        
        const progressBar = document.createElement('div');
        progressBar.className = 'loading-progress';
        progressBar.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, #4ecdc4, #44a08d);
            border-radius: 2px;
            width: 0%;
            transition: width 0.3s ease;
        `;
        
        progressContainer.appendChild(progressBar);
        loadingContent.appendChild(progressContainer);
    }

    completeLoading() {
        this.loadingState.isLoading = false;
        this.loadingState.currentStep = '🎮 Game Ready!';
        this.updateLoadingScreen();
        this.isInitialized = true;
        
        // Hide loading screen after brief delay
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
            console.log('🎉 All loading complete - Game ready to play!');
            
            // ✅ NEW: Handle pending target chase if needed
            if (window.pendingTargetChase && window.startTargetChase) {
                setTimeout(() => {
                    window.startTargetChase();
                    window.pendingTargetChase = false;
                    console.log('🎯 Target chase mode activated after loading');
                }, 500);
            } else if (window.pendingMultiplayer && window.menuSystem) {
                // Handle multiplayer mode initialization
                setTimeout(() => {
                    this.initializeMultiplayer();
                    window.pendingMultiplayer = false;
                    console.log('🏏 Multiplayer mode activated after loading');
                }, 500);
            } else {
                // Show bowling controls for free play mode
                setTimeout(() => {
                    if (window.menuSystem && window.menuSystem.showBowlingControls) {
                        window.menuSystem.showBowlingControls();
                        console.log('🎳 Free Play mode - AI Bowler toggle available');
                        console.log('💡 Toggle AI Bowler in bottom-right corner or use console commands');
                    }
                    
                    // ✅ NEW: Initialize AI Bowler for the first ball in Free Play mode
                    setTimeout(() => {
                        console.log('🤖 Initializing AI Bowler for first ball...');
                        this.initializeAIBowler();
                    }, 2000); // Give time for UI to settle
                }, 500);
            }
        }, 1000);
    }

    init() {
        console.log('🎯 Initializing Cricket Game...');
        
        // Show loading screen immediately
        this.updateLoadingProgress('🎯 Initializing Cricket Game...');
        
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
            // Step 1: Create scene
            this.updateLoadingProgress('🌌 Creating cosmic cricket field...');
            this.createScene();
            this.completeLoadingStep('Scene');
            
            // Step 2: Create camera  
            this.updateLoadingProgress('📷 Setting up camera angles...');
            this.createCamera();
            this.completeLoadingStep('Camera');
            
            // Step 3: Create renderer
            this.updateLoadingProgress('🎨 Initializing graphics renderer...');
            this.createRenderer();
            this.completeLoadingStep('Renderer');
            
            // Step 4: Create lighting
            this.updateLoadingProgress('💡 Setting up stadium lighting...');
            this.createLighting();
            this.createField();
            this.createPitch();
            this.createBoundary();
            this.completeLoadingStep('Field & Lighting');
            
            // Step 5: Create controls
            this.updateLoadingProgress('🎮 Setting up camera controls...');
            this.createControls();
            this.createBatCollisionSphere();
            this.createBallTrail();
            this.createScoreboards();
            this.createScorecardUI();
            
            // ✅ NEW: Create fielding debug overlay
            this.createFieldingDebugOverlay();
            
            this.addEventListeners();
            this.completeLoadingStep('Game Systems');
            
            // Step 6: Load main character (async)
            this.updateLoadingProgress('🏏 Loading main batsman...');
            this.loadCharacter();
            
            // Step 7: Load cricket team (async)
            this.updateLoadingProgress('👥 Loading cricket team...');
            this.loadCricketTeam();
            
            // Step 8: Load cricket ball (async)
            this.updateLoadingProgress('🏏 Loading cricket ball...');
            this.loadCricketBall();
            
            // Start animation loop immediately (will work with whatever is loaded)
            this.animate();
            
        } catch (error) {
            console.error('❌ Error during game initialization:', error);
            this.updateLoadingProgress('❌ Loading failed - Please refresh');
            throw error;
        }
    }

    // New methods for menu integration
    start() {
        console.log('🎮 Starting game...');
        
        // Check if we need to initialize or just resume
        if (!this.isInitialized || !this.scene || !this.renderer) {
            console.log('🔄 Initializing game...');
            this.init();
        } else {
            console.log('▶️ Resuming existing game...');
            // Just resume the existing game
            this.isPaused = false;
            this.clock.start();
            
            // Restart animation loop if needed
            if (!this.animationId) {
                this.animate();
            }
        }
        
        // ✅ NEW: Restore game UI elements when starting
        this.restoreGameUI();
    }
    
    // ✅ NEW: Restore all dynamic game UI elements
    restoreGameUI() {
        // Show scorecard button
        if (this.scorecardUI && this.scorecardUI.button) {
            this.scorecardUI.button.style.display = 'block';
        }
        
        console.log('🎮 Game UI restored');
    }

    pause() {
        this.isPaused = true;
        this.clock.stop();
        console.log('🎮 Game paused');
    }

    resume() {
        this.isPaused = false;
        this.clock.start();
        console.log('🎮 Game resumed');
    }

    stop() {
        console.log('🛑 Stopping game...');
        
        // Pause the game but don't mark as uninitialized yet
        this.isPaused = true;
        this.clock.stop();
        
        // Cancel animation frame IMMEDIATELY
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Clear the renderer properly but keep it ready
        if (this.renderer) {
            // Set a black clear color to avoid blue screen
            this.renderer.setClearColor(0x000000, 1);
            this.renderer.clear();
            // Render one black frame to ensure canvas is cleared
            this.renderer.render(this.scene, this.camera);
        }
        
        // Clear all timers
        this.clearAIBowlerTimers();
        
        // Reset all game systems
        this.resetFieldingSystem();
        this.resetCatchingSystem();
        this.resetRunningSystem();
        this.resetBallTracking();
        
        // Reset game modes
        this.targetSystem.isActive = false;
        this.multiplayerSystem.isActive = false;
        
        // Clear any pending flags
        window.pendingTargetChase = false;
        window.pendingMultiplayer = false;
        
        // Reset scores
        this.cricketScore.runs = 0;
        this.cricketScore.wickets = 0;
        this.cricketScore.overs = 0;
        this.cricketScore.balls = 0;
        
        // Reset ball state
        this.ballState.isActive = false;
        this.ballState.isComplete = false;
        this.ballPhysics.isMoving = false;
        
        // Remove any game screens
        if (this.gameOverScreen) {
            this.gameOverScreen.remove();
            this.gameOverScreen = null;
        }
        if (this.inningsBreakScreen) {
            this.inningsBreakScreen.remove();
            this.inningsBreakScreen = null;
        }
        if (this.multiplayerResultScreen) {
            this.multiplayerResultScreen.remove();
            this.multiplayerResultScreen = null;
        }
        
        // Remove any notifications
        this.removeBowlingCountdown();
        const notifications = document.querySelectorAll('[id*="notification"], [id*="countdown"], [id*="multiplayerInfo"]');
        notifications.forEach(notification => notification.remove());
        
        // Remove target display
        const targetDisplay = document.getElementById('targetDisplay');
        if (targetDisplay) {
            targetDisplay.remove();
        }
        
        // Remove any lingering UI elements
        const gameUIElements = document.querySelectorAll('.game-over-screen, .target-notification, .ball-summary');
        gameUIElements.forEach(element => element.remove());
        
        // Reset AI bowler
        this.aiBowler.isEnabled = true; // Reset to default
        this.aiBowler.isActive = false;
        
        // Hide bowling controls
        if (window.menuSystem && window.menuSystem.hideBowlingControls) {
            window.menuSystem.hideBowlingControls();
        }
        
        // ✅ NEW: Clean up dynamic UI elements when stopping game
        this.cleanupGameUI();
        
        // Clear the scene (optional - keeps models loaded for faster restart)
        // this.clearScene();
        
        // Keep the game initialized for faster restart
        // Only the game state is reset, not the scene/renderer
        
        console.log('🎮 Game stopped and cleaned up');
    }
    
    // ✅ NEW: Clean up all dynamic game UI elements
    cleanupGameUI() {
        // Hide scorecard button
        if (this.scorecardUI && this.scorecardUI.button) {
            this.scorecardUI.button.style.display = 'none';
        }
        
        // Hide scorecard container if visible
        if (this.scorecardUI && this.scorecardUI.container) {
            this.scorecardUI.container.style.display = 'none';
            this.scorecardUI.isVisible = false;
        }
        
        // Hide bowling controls
        if (window.menuSystem && window.menuSystem.hideBowlingControls) {
            window.menuSystem.hideBowlingControls();
        }
        
        // Clear any AI bowler timers
        if (this.aiBowler) {
            this.clearAIBowlerTimers();
        }
        
        // Remove any lingering notifications
        this.removeAllNotifications();
        
        console.log('🧹 Game UI cleaned up');
    }
    
    // ✅ NEW: Remove all notifications
    removeAllNotifications() {
        // Remove any notifications that might be lingering
        const notifications = document.querySelectorAll('[style*="position: fixed"]');
        notifications.forEach(notification => {
            // Only remove our game notifications (not menu elements)
            if (notification.innerHTML && (
                notification.innerHTML.includes('WICKET') ||
                notification.innerHTML.includes('BOWLED') ||
                notification.innerHTML.includes('RUN OUT') ||
                notification.innerHTML.includes('AI Bowler') ||
                notification.innerHTML.includes('Manual Bowling') ||
                notification.innerHTML.includes('countdown')
            )) {
                notification.remove();
            }
        });
    }

    // Settings integration
    setGraphicsQuality(quality) {
        if (!this.renderer) return;
        
        switch (quality) {
            case 'low':
                this.renderer.shadowMap.enabled = false;
                this.renderer.setPixelRatio(1);
                break;
            case 'medium':
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFShadowMap;
                this.renderer.setPixelRatio(window.devicePixelRatio * 0.75);
                break;
            case 'high':
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                this.renderer.setPixelRatio(window.devicePixelRatio);
                break;
            case 'ultra':
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                this.renderer.setPixelRatio(window.devicePixelRatio * 1.5);
                break;
        }
        console.log(`🎮 Graphics quality set to: ${quality}`);
    }

    setShadowsEnabled(enabled) {
        if (!this.renderer) return;
        
        this.renderer.shadowMap.enabled = enabled;
        console.log(`🎮 Shadows ${enabled ? 'enabled' : 'disabled'}`);
    }

    setBallTrailEnabled(enabled) {
        this.ballTrail.enabled = enabled;
        if (!enabled) {
            this.clearBallTrail();
        }
        console.log(`🎮 Ball trail ${enabled ? 'enabled' : 'disabled'}`);
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
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        // Set black background to prevent blue screen
        this.renderer.setClearColor(0x000000, 1);
        
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
                
                // ✅ NEW: Store batsman's stumps for bowled detection
                if (end === 0) { // Batsman's end
                    this.bowledDetection.stumpsAtBatsmanEnd.push(stump);
                }
                
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
            } else {
                console.warn('⚠️ No animations found in the FBX file');
            }
    
            console.log('✅ Character with animation loaded successfully!');
            this.scene.add(fbxObject);
            this.setupRealCharacter(fbxObject);
            
            // Load additional animations for batsman
            this.loadMainCharacterAnimation('hitting.fbx');
            this.loadMainCharacterAnimation('standingidle.fbx');
            
            // ✅ NEW: Mark character loading as complete
            this.completeLoadingStep('Main Character');
        }, 
        // Progress callback
        (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            // ✅ NEW: Update loading screen with character progress
            this.updateLoadingProgress(`🏏 Loading main batsman... ${percent}%`, percent);
        },
        // Error callback
        (error) => {
            console.error('❌ Error loading character:', error);
            this.updateLoadingProgress('❌ Character loading failed');
        });
    }

    setupRealCharacter(characterModel) {
        this.character = characterModel;
        console.log('🎯 Setting up real FBX character...');
        
        // Set up userData structure for animations (same as cricket team characters)
        this.character.userData = {
            description: 'batsman',
            animationMixer: null,
            animations: new Map(),
            currentAction: null,
            currentAnimationName: null
        };
        
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
        
        // Add to cricketCharacters array so animations get updated
        this.cricketCharacters.push(this.character);
        
        console.log(`✅ Character ready with ${this.characterAnimations.size} animations`);
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
        
        // Set up userData structure for animations (same as cricket team characters)
        this.character.userData = {
            description: 'batsman',
            animationMixer: null,
            animations: new Map(),
            currentAction: null,
            currentAnimationName: null,
            ...characterModel.userData // preserve existing userData
        };
        
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
        
        // Add to cricketCharacters array so animations get updated
        this.cricketCharacters.push(this.character);
        
        console.log(`✅ ${characterType} character ready`);
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
                    // console.log('Ball mesh found:', child.name, 'Material:', child.material);
                }
            });
            
            // Position ball at bowler's end initially
            this.cricketBall.position.set(0, 3, -8);
            
            // Add ball to scene
            this.scene.add(this.cricketBall);
            
            console.log('✅ Cricket ball loaded successfully!');
            
            // ✅ NEW: Mark cricket ball loading as complete
            this.completeLoadingStep('Cricket Ball');
        }, (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            // ✅ NEW: Update loading screen with ball progress
            this.updateLoadingProgress(`🏏 Loading cricket ball... ${percent}%`, percent);
        }, (error) => {
            console.log('❌ Cricket ball loading failed:', error);
            this.updateLoadingProgress('❌ Cricket ball loading failed');
        });
    }

    updateBallPhysics(deltaTime) {
        if (!this.cricketBall || !this.ballPhysics.isMoving) return;
        
        // ✅ NEW: Check for bowled FIRST (highest priority wicket)
        this.checkBowledDetection();
        
        // ✅ NEW: Check for wicket keeper catch on missed balls
        this.checkWicketKeeperCatch();
        
        // ✅ NEW: Check for catches FIRST while ball is in flight
        this.checkForActiveCatches();
        
        // Check for immediate pickup opportunities (balls on ground near fielders)
        this.checkForImmediatePickup();
        
        // Update predictive fielding for any remaining fielders
        this.updatePredictiveFielding();
        
        // Apply gravity
        this.ballPhysics.velocity.y += this.ballPhysics.gravity * deltaTime;
        
        // Update position
        this.cricketBall.position.add(
            this.ballPhysics.velocity.clone().multiplyScalar(deltaTime)
        );
        
        // Ground collision (y = 0 is ground level)
        if (this.cricketBall.position.y <= 0.035) { // Ball radius offset
            this.cricketBall.position.y = 0.035;
            
            // ✅ FIXED: Check if ball was falling BEFORE reversing velocity
            const wasFalling = this.ballPhysics.velocity.y <= 0;
            
            // Bounce
            this.ballPhysics.velocity.y *= -this.ballPhysics.bounceCoefficient;
            
            // Only register bounce if ball naturally fell to ground
            if (wasFalling) {
                this.checkBallBounce();
                console.log('🏐 Ball naturally hit ground and bounced (will be FOUR if reaches boundary)');
            } else {
                console.log('⚡ Ball constrained to ground level but wasn\'t falling (lofted shot start)');
            }
            
            // Apply friction to horizontal movement
            this.ballPhysics.velocity.x *= this.ballPhysics.friction;
            this.ballPhysics.velocity.z *= this.ballPhysics.friction;
            
            // Stop if moving very slowly
            if (this.ballPhysics.velocity.length() < 0.1) {
                this.ballPhysics.velocity.set(0, 0, 0);
                this.ballPhysics.isMoving = false;
                console.log('Ball stopped');
                
                // If ball stopped and wasn't fielded, complete with current runs
                if (this.ballState.isActive && !this.ballState.isComplete && 
                    !this.runningSystem.isRunning && !this.runningSystem.waitingForNextRun &&
                    !this.fieldingSystem.chasingFielder && !this.cricketScore.boundaryAwarded) {
                    
                    this.ballState.ballType = 'normal';
                    this.ballState.completionReason = 'stopped';
                    
                    setTimeout(() => {
                        this.completeBall();
                    }, 1000);
                }
            }
        }
        
        // Keep ball within field boundaries and handle scoring
        const maxDistance = this.FIELD_RADIUS - 2;
        const ballDistance = Math.sqrt(
            this.cricketBall.position.x ** 2 + this.cricketBall.position.z ** 2
        );
        
        if (ballDistance > maxDistance) {
            // Check if ball has crossed boundary for scoring
            this.handleBoundaryScoring();
            
            // ✅ FIXED: Stop ball physics immediately after boundary crossed
            // Prevents ball from bouncing back and hitting ground (which would change 6 to 4)
            if (this.cricketScore.boundaryAwarded) {
                this.ballPhysics.isMoving = false;
                this.ballPhysics.velocity.set(0, 0, 0);
                console.log('🛑 Ball physics stopped - boundary scored, preventing false ground contact');
                return; // Exit physics update
            }
            
            // Only apply boundary collision if no boundary was awarded (ball stayed in play)
            this.ballPhysics.velocity.x *= -0.5;
            this.ballPhysics.velocity.z *= -0.5;
        }
    }

    bowlBall(direction, speed) {
        if (!this.cricketBall) return;

        // Activate the ball state to signal that a new play has begun.
        this.startNewBall();
        
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
            direction.y * speed, // Minimum upward velocity for proper arc
            direction.z * speed
        );
        
        this.ballPhysics.isMoving = true;
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

    createScoreboards() {
        // Load font for 3D text
        const fontLoader = new FontLoader();
        
        // Use a fallback approach if the external font fails
        fontLoader.load(
            'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
            (font) => {
                this.scoreboards.font = font;
                this.buildScoreboards();
                console.log('✅ 3D scoreboards created with loaded font');
            },
            undefined,
            (error) => {
                console.warn('⚠️ Could not load external font, creating basic scoreboards');
                this.createBasicScoreboards();
            }
        );
    }

    buildScoreboards() {
        // Create scoreboards at both ends of the field
        this.createScoreboard('batsman', new THREE.Vector3(0, 25, 75)); // Above batsman's end
        this.createScoreboard('bowler', new THREE.Vector3(0, 25, -75));  // Above bowler's end
        
        console.log('✅ Both 3D scoreboards positioned');
    }

    createScoreboard(type, position) {
        // Create background panel
        const panelGeometry = new THREE.PlaneGeometry(12, 6);
        const panelMaterial = new THREE.MeshLambertMaterial({
            color: 0x1a1a2e,
            transparent: true,
            opacity: 0.9
        });
        
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.copy(position);
        
        // Face the center of the field
        if (type === 'batsman') {
            panel.rotation.x = -0.3; // Tilt down slightly
        } else {
            panel.rotation.x = -0.3;
            panel.rotation.y = Math.PI; // Face opposite direction
        }
        
        // Add glowing border
        const borderGeometry = new THREE.EdgesGeometry(panelGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({ 
            color: 0x7490ff,
            linewidth: 2
        });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        panel.add(border);
        
        this.scene.add(panel);
        this.scoreboards.panels[type] = panel;
        
        // Create initial score text
        this.updateScoreboardText(type, panel);
    }

    updateScoreboardText(type, panel) {
        // Remove existing text
        const existingText = panel.children.find(child => child.userData.isScoreText);
        if (existingText) {
            panel.remove(existingText);
            if (existingText.geometry) existingText.geometry.dispose();
            if (existingText.material) existingText.material.dispose();
        }
        
        // Create score text
        const scoreText = `${this.cricketScore.runs}/${this.cricketScore.wickets}\n${this.cricketScore.overs.toFixed(1)} Overs`;
        
        if (this.scoreboards.font) {
            // Use 3D text with loaded font
            const textGeometry = new TextGeometry(scoreText, {
                font: this.scoreboards.font,
                size: 0.8,
                height: 0.1,
                curveSegments: 12,
                bevelEnabled: true,
                bevelThickness: 0.02,
                bevelSize: 0.02,
                bevelOffset: 0,
                bevelSegments: 5
            });
            
            textGeometry.computeBoundingBox();
            const centerOffsetX = -0.5 * (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x);
            const centerOffsetY = -0.5 * (textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y);
            
            const textMaterial = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                emissive: 0x444444
            });
            
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.x = centerOffsetX;
            textMesh.position.y = centerOffsetY;
            textMesh.position.z = 0.1;
            textMesh.userData.isScoreText = true;
            
            panel.add(textMesh);
        } else {
            // Fallback to simple text display
            this.createSimpleScoreText(panel, scoreText);
        }
    }

    createSimpleScoreText(panel, scoreText) {
        // Create a simple plane with text texture as fallback
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 256;
        
        // Clear canvas
        context.fillStyle = 'transparent';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw text
        context.fillStyle = 'white';
        context.font = 'bold 48px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        const lines = scoreText.split('\n');
        lines.forEach((line, index) => {
            context.fillText(line, canvas.width/2, (canvas.height/2) + (index - 0.5) * 60);
        });
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        });
        
        const geometry = new THREE.PlaneGeometry(8, 4);
        const textMesh = new THREE.Mesh(geometry, material);
        textMesh.position.z = 0.1;
        textMesh.userData.isScoreText = true;
        
        panel.add(textMesh);
    }

    createBasicScoreboards() {
        // Create basic scoreboards without external font dependency
        this.scoreboards.font = null; // No font loaded
        this.buildScoreboards();
    }

    // ✅ NEW: Scorecard UI System
    createScorecardUI() {
        // Create scorecard button
        this.createScorecardButton();
        
        // Create scorecard container (initially hidden)
        this.createScorecardContainer();
        
        console.log('✅ Scorecard UI created');
    }

    createScorecardButton() {
        // Create scorecard toggle button
        const button = document.createElement('button');
        button.innerHTML = '📊 SCORECARD';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(10, 10, 26, 0.9);
            color: white;
            border: 2px solid rgba(116, 144, 255, 0.4);
            border-radius: 20px;
            padding: 15px 25px;
            font-family: 'Rajdhani', Arial, sans-serif;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            z-index: 9999;
            transition: all 0.3s ease;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            letter-spacing: 0.5px;
            text-transform: uppercase;
            backdrop-filter: blur(10px);
            overflow: hidden;
            display: block;
            visibility: visible;
        `;
        
        // Simplified - no shimmer for scorecard button to avoid positioning conflicts
        
        // Hover effects
        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(116, 144, 255, 0.2)';
            button.style.borderColor = 'rgba(116, 144, 255, 0.8)';
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 6px 25px rgba(116, 144, 255, 0.4)';
            button.style.color = '#7490ff';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.background = 'rgba(10, 10, 26, 0.9)';
            button.style.borderColor = 'rgba(116, 144, 255, 0.4)';
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
            button.style.color = 'white';
        });
        
        // Toggle scorecard visibility
        button.addEventListener('click', () => {
            this.toggleScorecard();
        });
        
        document.body.appendChild(button);
        this.scorecardUI.button = button;
        
        console.log('✅ Scorecard button created and added to page');
        console.log('Button position:', button.style.position);
        console.log('Button display:', button.style.display);
        console.log('Button z-index:', button.style.zIndex);
    }

    createScorecardContainer() {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(10, 10, 26, 0.95);
            color: white;
            border: 3px solid rgba(116, 144, 255, 0.6);
            border-radius: 20px;
            padding: 30px;
            font-family: 'Rajdhani', Arial, sans-serif;
            z-index: 2000;
            max-width: 90%;
            max-height: 90%;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(116, 144, 255, 0.3);
            backdrop-filter: blur(15px);
            display: none;
        `;
        
        document.body.appendChild(container);
        this.scorecardUI.container = container;
        
        // Update scorecard content initially
        this.updateScorecardDisplay();
    }

    toggleScorecard() {
        this.scorecardUI.isVisible = !this.scorecardUI.isVisible;
        
        if (this.scorecardUI.isVisible) {
            this.updateScorecardDisplay(); // Refresh data
            this.scorecardUI.container.style.display = 'block';
            this.scorecardUI.button.innerHTML = '✖ CLOSE';
        } else {
            this.scorecardUI.container.style.display = 'none';
            this.scorecardUI.button.innerHTML = '📊 SCORECARD';
        }
    }

    updateScorecardDisplay() {
        if (!this.scorecardUI.container) return;
        
        const team = this.battingTeam;
        const score = this.cricketScore;
        
        // Calculate extras total
        const extrasTotal = team.extras.byes + team.extras.legByes + 
                           team.extras.wides + team.extras.noBalls + team.extras.penalties;
        
        // Generate scorecard HTML
        const html = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #7490ff; font-size: 24px; font-family: 'Orbitron', Arial, sans-serif;">${team.teamName}</h2>
                <p style="margin: 5px 0; color: #ccc;">${team.matchDetails}</p>
                <h3 style="margin: 10px 0; color: #fff;">1st Innings</h3>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: rgba(116, 144, 255, 0.1); border-radius: 8px;">
                <div style="color: #7490ff; font-weight: bold;">
                    RUNS: ${score.runs}
                </div>
                <div style="color: #7490ff; font-weight: bold;">
                    BALLS: ${score.balls}
                </div>
                <div style="color: #7490ff; font-weight: bold;">
                    TOTAL: ${score.runs}/${score.wickets}
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background: rgba(116, 144, 255, 0.2);">
                        <th style="text-align: left; padding: 8px; border-bottom: 2px solid #7490ff;">Batsman</th>
                        <th style="text-align: center; padding: 8px; border-bottom: 2px solid #7490ff;">How Out</th>
                        <th style="text-align: center; padding: 8px; border-bottom: 2px solid #7490ff;">Runs</th>
                        <th style="text-align: center; padding: 8px; border-bottom: 2px solid #7490ff;">Balls</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.generatePlayerRows()}
                </tbody>
            </table>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <div>
                    <strong style="color: #7490ff;">EXTRAS</strong>
                    <div style="margin-left: 20px; color: #ccc;">
                        ${extrasTotal > 0 ? `
                            ${team.extras.byes > 0 ? `b: ${team.extras.byes}<br>` : ''}
                            ${team.extras.legByes > 0 ? `lb: ${team.extras.legByes}<br>` : ''}
                            ${team.extras.wides > 0 ? `w: ${team.extras.wides}<br>` : ''}
                            ${team.extras.noBalls > 0 ? `nb: ${team.extras.noBalls}<br>` : ''}
                            ${team.extras.penalties > 0 ? `pen: ${team.extras.penalties}<br>` : ''}
                        ` : 'None'}
                    </div>
                </div>
                <div style="text-align: right;">
                    <strong style="color: #7490ff;">${extrasTotal}</strong>
                </div>
            </div>
            
            <div style="text-align: center; padding: 15px; background: rgba(116, 144, 255, 0.1); border: 2px solid rgba(116, 144, 255, 0.3); border-radius: 8px; font-size: 18px; font-weight: bold;">
                <span style="color: #7490ff;">TOTAL</span>
                <span style="color: white; margin-left: 20px;">${score.runs}/${score.wickets} (${score.overs.toFixed(1)} overs)</span>
            </div>
            
            <div style="text-align: center; margin-top: 15px;">
                <div style="font-size: 14px; color: #ccc;">
                    Current Batsmen: 
                    <span style="color: #7490ff;">${team.players[team.currentBatsman].name}</span>
                    ${!team.players[team.currentPartner].isOut ? 
                        ` & <span style="color: #7490ff;">${team.players[team.currentPartner].name}</span>` : 
                        ' & Next Batsman'
                    }
                </div>
            </div>
        `;
        
        this.scorecardUI.container.innerHTML = html;
    }

    generatePlayerRows() {
        const team = this.battingTeam;
        let rows = '';
        
        team.players.forEach((player, index) => {
            // Determine row styling
            let rowStyle = 'border-bottom: 1px solid rgba(78, 205, 196, 0.3);';
            let nameStyle = '';
            
            // Highlight current batsmen
            if (index === team.currentBatsman) {
                rowStyle += 'background: rgba(255, 215, 0, 0.1);'; // Gold for striker
                nameStyle = 'color: #ffd700; font-weight: bold;';
            } else if (index === team.currentPartner && !player.isOut) {
                rowStyle += 'background: rgba(255, 215, 0, 0.05);'; // Light gold for non-striker
                nameStyle = 'color: #ffd700;';
            }
            
            // Format dismissal text
            let dismissalText = 'not out';
            if (player.isOut && player.dismissal) {
                dismissalText = player.dismissal;
            }
            
            // Format runs display
            const runsDisplay = player.ballsFaced > 0 || player.runs > 0 ? player.runs : '-';
            const ballsDisplay = player.ballsFaced > 0 ? player.ballsFaced : '-';
            
            rows += `
                <tr style="${rowStyle}">
                    <td style="padding: 8px; ${nameStyle}">${player.name}</td>
                    <td style="padding: 8px; text-align: center; font-style: italic; color: ${player.isOut ? '#ff9999' : '#99ff99'};">
                        ${dismissalText}
                    </td>
                    <td style="padding: 8px; text-align: center; font-weight: bold;">${runsDisplay}</td>
                    <td style="padding: 8px; text-align: center;">${ballsDisplay}</td>
                </tr>
            `;
        });
        
        return rows;
    }

    // ✅ NEW: Player tracking methods
    updateCurrentBatsmanStats(runsScored) {
        const currentBatsman = this.battingTeam.players[this.battingTeam.currentBatsman];
        currentBatsman.runs += runsScored;
        currentBatsman.ballsFaced++;
        
        console.log(`📊 ${currentBatsman.name}: ${currentBatsman.runs} runs (${currentBatsman.ballsFaced} balls)`);
    }

    recordDismissal(dismissalType, playerIndex = null) {
        const playerToOut = playerIndex !== null ? playerIndex : this.battingTeam.currentBatsman;
        const player = this.battingTeam.players[playerToOut];
        
        console.log(`🏏 WICKET! ${player.name} ${dismissalType}`);
        console.log(`   Before dismissal: Striker=${this.battingTeam.players[this.battingTeam.currentBatsman].name}, Non-striker=${this.battingTeam.players[this.battingTeam.currentPartner].name}`);
        
        player.isOut = true;
        player.dismissal = dismissalType;
        
        // Always promote next batsman when someone gets out (regardless of which batsman)
        this.promoteNextBatsman();
        
        // Update scorecard if visible
        if (this.scorecardUI.isVisible) {
            this.updateScorecardDisplay();
        }
        
        console.log(`   After promotion: Striker=${this.battingTeam.players[this.battingTeam.currentBatsman].name}, Non-striker=${this.battingTeam.players[this.battingTeam.currentPartner].name}`);
    }

    promoteNextBatsman() {
        console.log('🔄 Promoting next batsman...');
        console.log(`   Current situation: ${this.battingTeam.players[this.battingTeam.currentBatsman].name} (OUT), ${this.battingTeam.players[this.battingTeam.currentPartner].name} (${this.battingTeam.players[this.battingTeam.currentPartner].isOut ? 'OUT' : 'NOT OUT'})`);
        
        // Find next available batsman who isn't already playing
        let nextBatsman = null;
        let nextBatsmanIndex = -1;
        
        for (let i = 0; i < this.battingTeam.players.length; i++) {
            const player = this.battingTeam.players[i];
            // Find a player who is not out and not currently batting
            if (!player.isOut && i !== this.battingTeam.currentBatsman && i !== this.battingTeam.currentPartner) {
                nextBatsman = player;
                nextBatsmanIndex = i;
                break;
            }
        }
        
        if (nextBatsman) {
            // If partner is still not out, partner becomes striker, new batsman becomes non-striker
            if (!this.battingTeam.players[this.battingTeam.currentPartner].isOut) {
                console.log(`   📍 Partner ${this.battingTeam.players[this.battingTeam.currentPartner].name} becomes striker`);
                console.log(`   📍 New batsman ${nextBatsman.name} becomes non-striker`);
                
                this.battingTeam.currentBatsman = this.battingTeam.currentPartner;
                this.battingTeam.currentPartner = nextBatsmanIndex;
            } else {
                // Both batsmen were out, new batsman becomes striker, find another partner
                console.log(`   📍 Both batsmen out, ${nextBatsman.name} becomes striker`);
                this.battingTeam.currentBatsman = nextBatsmanIndex;
                
                // Find another partner
                for (let i = 0; i < this.battingTeam.players.length; i++) {
                    const player = this.battingTeam.players[i];
                    if (!player.isOut && i !== nextBatsmanIndex) {
                        this.battingTeam.currentPartner = i;
                        console.log(`   📍 ${player.name} becomes non-striker`);
                        break;
                    }
                }
            }
            
            const currentStriker = this.battingTeam.players[this.battingTeam.currentBatsman];
            const currentNonStriker = this.battingTeam.players[this.battingTeam.currentPartner];
            
            console.log(`✅ New batting pair: ${currentStriker.name} (striker) & ${currentNonStriker.name} (non-striker)`);
        } else {
            console.log('⚠️ No more batsmen available - innings should end');
        }
    }

    swapBatsmen() {
        // Swap striker and non-striker (happens on odd runs or end of over)
        const beforeSwap = this.battingTeam.players[this.battingTeam.currentBatsman].name;
        
        const temp = this.battingTeam.currentBatsman;
        this.battingTeam.currentBatsman = this.battingTeam.currentPartner;
        this.battingTeam.currentPartner = temp;
        
        const afterSwap = this.battingTeam.players[this.battingTeam.currentBatsman].name;
        console.log(`🔄 Batsmen swapped: ${beforeSwap} → ${afterSwap} (now on strike)`);
    }

    update3DScoreboards() {
        // Update both scoreboards with current score
        if (this.scoreboards.panels.batsman) {
            this.updateScoreboardText('batsman', this.scoreboards.panels.batsman);
        }
        if (this.scoreboards.panels.bowler) {
            this.updateScoreboardText('bowler', this.scoreboards.panels.bowler);
        }
        
        console.log('📊 3D scoreboards updated');
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

    setTrailColorForTiming(timing) {
        // ✅ NEW: Set trail color based on shot timing quality for visual feedback
        let color = 0xff4444; // Default red
        
        switch (timing) {
            case 'perfect':
                color = 0x00ff00; // Bright green for perfect timing
                break;
            case 'good':
                color = 0x44ff44; // Light green for good timing
                break;
            case 'okay':
                color = 0xffff44; // Yellow for okay timing
                break;
            case 'poor':
                color = 0xff4444; // Red for poor timing
                break;
            default:
                color = 0xffffff; // White for unknown
        }
        
        this.setBallTrailColor(color);
        console.log(`🎨 Trail color set to: #${color.toString(16)} for ${timing.toUpperCase()} timing`);
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

    // ✅ NEW: Check if wicket keeper can catch unhit balls
    checkWicketKeeperCatch() {
        // Only check if ball hasn't been hit by batsman and keeper exists
        if (!this.keeper || 
            !this.cricketBall || 
            !this.ballPhysics.isMoving ||
            this.cricketScore.ballHasBeenHit) {
            return;
        }

        const ballPos = this.cricketBall.position;
        const keeperPos = this.keeper.position;
        const ballHeight = ballPos.y;
        
        // Check if ball is at reasonable height for keeper (0.5m to 3m)
        if (ballHeight < 0.5 || ballHeight > 3.0) {
            return;
        }
        
        // Check if ball has passed batsman's end (z > 10) - keeper behind stumps
        if (ballPos.z < 10) {
            return;
        }
        
        // Calculate distance between ball and keeper
        const distance = ballPos.distanceTo(keeperPos);
        
        // Keeper has a good reach - 3 meter radius for catching missed balls
        const keeperCatchRadius = 3.0;
        
        if (distance <= keeperCatchRadius) {
            console.log(`🧤 Wicket Keeper caught the ball! Distance: ${distance.toFixed(1)}m`);
            this.executeWicketKeeperCatch();
        }
    }

    executeWicketKeeperCatch() {
        console.log(`🧤 Wicket Keeper collected the ball cleanly - Dot ball!`);
        
        // Stop ball movement immediately
        this.ballPhysics.isMoving = false;
        this.ballPhysics.velocity.set(0, 0, 0);
        
        // Position ball in keeper's hands
        if (this.keeper) {
            this.cricketBall.position.copy(this.keeper.position);
            this.cricketBall.position.y += 1.5; // Hand height
        }
        
        // Clear ball trail for clean visual
        this.clearBallTrail();
        
        // Stop any running (though unlikely for missed balls)
        this.runningSystem.isRunning = false;
        this.runningSystem.runState = 'idle';
        
        // Complete the ball as dot ball (0 runs)
        if (this.ballState.isActive && !this.ballState.isComplete) {
            this.ballState.ballType = 'fielded';
            this.ballState.completionReason = 'keeper_catch';
            this.ballState.runsThisBall = 0; // Dot ball - no runs
            
            // Complete the ball immediately
            setTimeout(() => {
                this.completeBall();
            }, 800);
        }
        
        console.log(`📊 Dot ball - Keeper catch. Score remains: ${this.cricketScore.runs}/${this.cricketScore.wickets}`);
    }

    // ✅ NEW: Check if ball hits the stumps for a bowled dismissal
    checkBowledDetection() {
        // Only check if bowled detection is enabled and ball hasn't been hit by batsman
        if (!this.bowledDetection.enabled || 
            !this.cricketBall || 
            !this.ballPhysics.isMoving ||
            this.cricketScore.ballHasBeenHit) {
            return;
        }

        // ✅ DEBUG: Check if stumps are properly stored
        if (!this.bowledDetection.stumpsAtBatsmanEnd || this.bowledDetection.stumpsAtBatsmanEnd.length === 0) {
            console.log('⚠️ No stumps found for bowled detection');
            return;
        }

        // Check if ball is reasonably close to stump height and batsman's end
        const ballPos = this.cricketBall.position;
        const ballHeight = ballPos.y;
        const ballZ = ballPos.z;
        
        // ✅ FIXED: Ball should be approaching batsman's end (z > 8.5, not < 8.0)
        // Batsman's end is at z = +10.06 (PITCH_LENGTH/2), so ball should be getting close
        if (ballHeight < 0.05 || ballHeight > 1.5 || ballZ < 8.5) {
            return;
        }
        
        // ✅ DEBUG: Log ball position when near stumps for debugging
        if (ballZ > 9.0) {
            console.log(`🔍 Ball near stumps: pos(${ballPos.x.toFixed(2)}, ${ballPos.y.toFixed(2)}, ${ballPos.z.toFixed(2)}), hit=${this.cricketScore.ballHasBeenHit}`);
        }
        
        // Check collision with each stump at batsman's end
        for (const stump of this.bowledDetection.stumpsAtBatsmanEnd) {
            const stumpPos = stump.position;
            const distance = ballPos.distanceTo(stumpPos);
            
            // ✅ DEBUG: Log distance when close
            if (distance < 0.5) {
                console.log(`🎯 Close to ${stump.name}: distance=${distance.toFixed(3)}m (threshold=${this.bowledDetection.stumpCollisionRadius})`);
            }
            
            if (distance <= this.bowledDetection.stumpCollisionRadius) {
                console.log(`🎯 BOWLED! Ball hit ${stump.name} at batsman's end!`);
                console.log(`   Ball position: (${ballPos.x.toFixed(2)}, ${ballPos.y.toFixed(2)}, ${ballPos.z.toFixed(2)})`);
                console.log(`   Stump position: (${stumpPos.x.toFixed(2)}, ${stumpPos.y.toFixed(2)}, ${stumpPos.z.toFixed(2)})`);
                console.log(`   Distance: ${distance.toFixed(3)}m`);
                
                this.executeBowledDismissal();
                return;
            }
        }
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
        
        // ✅ CRICKET RULES FIX: Mark that ball has been hit (for boundary scoring logic)
        this.cricketScore.ballHasBeenHit = true;
        
        // ✅ ENHANCED: Get comprehensive timing analysis (moved before trail color)
        const timingResult = this.calculateTimingMultiplier();
        const { power: powerMultiplier, timing, directionalAccuracy, distance } = timingResult;
        
        // ✅ NEW: Set trail color based on timing quality instead of just shot type
        this.setTrailColorForTiming(timing);
        
        // ✅ NEW: Calculate base shot direction with timing-based variation
        let hitDirection = new THREE.Vector3(shot.direction[0], shot.direction[1], shot.direction[2]).normalize();
        
        // ✅ CRICKET REALISM: Apply timing-based directional changes
        if (timing !== 'perfect') {
            const variationStrength = 1.0 - directionalAccuracy;
            
            // ✅ Different types of mistimed shots
            if (timing === 'poor') {
                // Poor timing can cause edges, top edges, or complete mishits
                const mishitType = Math.random();
                
                if (mishitType < 0.3 && distance > 2.5) {
                    // Outside edge - ball goes more toward slips/third man
                    console.log('🚨 Outside edge! Ball heading to slips');
                    hitDirection.x += 0.6; // More toward off-side
                    hitDirection.z += 0.4; // More behind wicket
                    hitDirection.y -= 0.2; // Lower trajectory
                } else if (mishitType < 0.5 && distance < 1.0) {
                    // Inside edge - ball goes toward leg side/keeper
                    console.log('🚨 Inside edge! Ball deflected leg-side');
                    hitDirection.x -= 0.4; // Toward leg side
                    hitDirection.z += 0.3; // Slightly behind
                    hitDirection.y -= 0.3; // Much lower
                } else if (mishitType < 0.7) {
                    // Top edge - high but weak shot
                    console.log('🚨 Top edge! High but weak');
                    hitDirection.y += 0.5; // Much higher
                    hitDirection.x += (Math.random() - 0.5) * 0.8; // Random sideways
                    hitDirection.z += (Math.random() - 0.5) * 0.6;
                } else {
                    // General mishit - significant directional variation
                    console.log('🚨 Mishit! Ball going off-target');
                    hitDirection.x += (Math.random() - 0.5) * variationStrength * 1.2;
                    hitDirection.z += (Math.random() - 0.5) * variationStrength * 1.0;
                    hitDirection.y += (Math.random() - 0.5) * variationStrength * 0.8;
                }
            } else {
                // Good/okay timing: smaller directional variations
                console.log(`📊 ${timing.toUpperCase()} timing - adding ${(variationStrength * 100).toFixed(0)}% directional variation`);
                hitDirection.x += (Math.random() - 0.5) * variationStrength * 0.6;
                hitDirection.z += (Math.random() - 0.5) * variationStrength * 0.4;
                hitDirection.y += (Math.random() - 0.5) * variationStrength * 0.3;
            }
            
            // Re-normalize after variation
            hitDirection.normalize();
        }
        
        // ✅ ENHANCED: Calculate final power with better scaling
        const basePower = shot.power * 10; // Increased base power for more dramatic differences
        const finalPower = basePower * powerMultiplier;
        
        // Apply velocity in calculated direction
        this.ballPhysics.velocity.copy(hitDirection.multiplyScalar(finalPower));
        
        // ✅ ENHANCED: Height calculation affected by timing
        let heightVelocity = shot.height * 20; // Increased from 15 to 20 for better loft
        let startingHeight = 0.5; // Default starting height
        let loftBoost = 1.0; // Default boost multiplier
        
        // ✅ FIXED: Starting height and loft boost depend on BOTH shot type AND timing
        const isLoftedShot = shot.height > 0.4;
        
        if (isLoftedShot) {
            // Lofted shots: Height and boost depend on timing quality
            switch (timing) {
                case 'perfect':
                    startingHeight = 1.2; // Full bat height
                    loftBoost = 1.5; // Full loft boost
                    console.log(`🎯 PERFECT lofted shot: Starting at ${startingHeight}m with full boost`);
                    break;
                case 'good':
                    startingHeight = 1.0; // Good contact height
                    loftBoost = 1.25; // Good boost
                    console.log(`✅ GOOD lofted shot: Starting at ${startingHeight}m with good boost`);
                    break;
                case 'okay':
                    startingHeight = 0.7; // Reduced height
                    loftBoost = .8; // Minimal boost
                    console.log(`⚠️ OKAY lofted shot: Starting at ${startingHeight}m with reduced boost`);
                    break;
                case 'poor':
                    startingHeight = 0.4; // Low contact, likely to hit ground
                    loftBoost = 0.5; // Actually reduces intended loft
                    console.log(`❌ POOR lofted shot: Starting at ${startingHeight}m with reduced trajectory`);
                    break;
            }
            heightVelocity *= loftBoost;
        } else {
            // Ground shots: Always start lower
            startingHeight = 0.5;
            console.log(`🏏 Ground shot: Starting at ${startingHeight}m`);
        }
        
        this.cricketBall.position.y = startingHeight;
        
        // Apply timing-based height variation
        if (timing === 'poor') {
            heightVelocity *= 0.6 + Math.random() * 0.4; // 60%-100% for poor timing
        } else if (timing === 'okay') {
            heightVelocity *= 0.8 + Math.random() * 0.3; // 80%-110% for okay timing
        }
        // Perfect/good timing keeps enhanced height
        
        this.ballPhysics.velocity.y = heightVelocity; // Set directly, don't add to existing
        
        // ✅ ENHANCED: Add realistic physics-based variation instead of just random
        this.addRealisticShotVariation(timing, directionalAccuracy);
        
        // ✅ NEW: Display timing feedback
        const timingEmoji = {
            'perfect': '🎯',
            'good': '✅', 
            'okay': '⚠️',
            'poor': '❌'
        };
        console.log(`${timingEmoji[timing]} ${shot.description} - ${timing.toUpperCase()} timing (${(powerMultiplier * 100).toFixed(0)}% power, ${(directionalAccuracy * 100).toFixed(0)}% accuracy)`);
        
        // Trigger fielding system
        this.onBallHit();
        
        // End the swing after hitting
        this.batSwing.isSwinging = false;
        
        return true;
    }

    addMinimalShotVariation() {
        // ✅ UPDATED: Legacy method - now uses realistic variation
        this.addRealisticShotVariation('good', 0.9);
    }

    addRealisticShotVariation(timing, directionalAccuracy) {
        // ✅ NEW: Physics-based shot variation that reflects real cricket mechanics
        const velocity = this.ballPhysics.velocity;
        const speed = velocity.length();
        
        // Calculate variation based on timing quality and ball speed
        let baseVariation = 0.02; // Minimal base variation for perfect shots
        
        switch (timing) {
            case 'perfect':
                baseVariation = 0.02; // 2% - very precise
                break;
            case 'good':
                baseVariation = 0.08; // 8% - slight variation
                break;
            case 'okay':
                baseVariation = 0.18; // 18% - noticeable variation
                break;
            case 'poor':
                baseVariation = 0.35; // 35% - significant variation
                break;
        }
        
        // ✅ CRICKET PHYSICS: Different variation patterns based on shot quality
        if (timing === 'poor') {
            // Poor timing: more unpredictable, can have sudden direction changes
            const unpredictability = 1.5; // Higher chaos factor
            velocity.x += (Math.random() - 0.5) * baseVariation * speed * unpredictability;
            velocity.y += (Math.random() - 0.5) * baseVariation * speed * unpredictability * 0.8;
            velocity.z += (Math.random() - 0.5) * baseVariation * speed * unpredictability;
            
            // ✅ Poor timing often causes the ball to lose speed faster (mishits)
            const speedLoss = 0.85 + Math.random() * 0.15; // 85%-100% speed retention
            velocity.multiplyScalar(speedLoss);
            
        } else if (timing === 'okay') {
            // Okay timing: moderate variation with slight bias toward edges
            velocity.x += (Math.random() - 0.5) * baseVariation * speed;
            velocity.y += (Math.random() - 0.5) * baseVariation * speed * 0.6;
            velocity.z += (Math.random() - 0.5) * baseVariation * speed * 0.8;
            
        } else {
            // Good/Perfect timing: minimal, controlled variation
            velocity.x += (Math.random() - 0.5) * baseVariation * speed * 0.7;
            velocity.y += (Math.random() - 0.5) * baseVariation * speed * 0.5;
            velocity.z += (Math.random() - 0.5) * baseVariation * speed * 0.6;
        }
        
        // ✅ REALISTIC: Add small amount of spin-based deviation (like real cricket ball)
        const spinEffect = timing === 'perfect' ? 0.01 : 0.03;
        velocity.x += (Math.random() - 0.5) * spinEffect * speed;
        velocity.z += (Math.random() - 0.5) * spinEffect * speed;
        
        console.log(`🌪️ Applied ${timing} shot variation: ${(baseVariation * 100).toFixed(1)}% base variation`);
    }

    calculateTimingMultiplier() {
        // ✅ ENHANCED: Comprehensive timing system affecting power, direction, and placement
        if (!this.cricketBall) return { power: 1.0, timing: 'good', directionalAccuracy: 1.0 };
        
        const ballPos = this.cricketBall.position;
        const batPos = this.character.position;
        const distance = ballPos.distanceTo(batPos);
        
        // ✅ NEW: Also consider ball velocity and swing timing for more realistic timing
        const ballVelocity = this.ballPhysics.velocity.length();
        const swingDuration = Date.now() - this.batSwing.swingStartTime;
        const optimalSwingTime = 200; // milliseconds - optimal swing timing window
        const swingTimingFactor = Math.max(0.3, 1.0 - Math.abs(swingDuration - optimalSwingTime) / 400); // More gradual penalty
        
        let powerMultiplier, timingCategory, directionalAccuracy;
        
        // ✅ DEBUG: Show timing calculation details
        console.log(`🔍 Timing Debug: distance=${distance.toFixed(2)}m, swingDuration=${swingDuration}ms, swingFactor=${swingTimingFactor.toFixed(3)}`);
        
        // ✅ ENHANCED: Balanced cricket timing zones with smoother transitions
        // Primary factor is swing timing, with distance as secondary factor
        if (distance >= 0.8 && distance <= 2.5 && swingTimingFactor > 0.80) {
            // Perfect timing: Excellent swing timing + good ball position
            timingCategory = 'perfect';
            powerMultiplier = 1.4; // Increased perfect timing bonus
            directionalAccuracy = 1.0; // Shot goes exactly where intended
            console.log('🎯 PERFECT timing! Pure middle of the bat');
        } else if (distance >= 0.6 && distance <= 3.0 && swingTimingFactor > 0.60) {
            // Good timing: Good swing timing + decent ball position
            timingCategory = 'good';
            powerMultiplier = 1.1;
            directionalAccuracy = 0.85; // 15% directional variation
            console.log('✅ Good timing - solid contact');
        } else if (distance >= 0.4 && distance <= 3.5 && swingTimingFactor > 0.40) {
            // Okay timing: Moderate swing timing + acceptable ball position
            timingCategory = 'okay';
            powerMultiplier = 0.9;
            directionalAccuracy = 0.65; // 35% directional variation
            console.log('⚠️ Okay timing - not quite middled');
        } else {
            // Poor timing: Bad swing timing OR bad ball position OR both
            timingCategory = 'poor';
            powerMultiplier = 0.6; // Significant power loss
            directionalAccuracy = 0.4; // 60% directional variation (edges, mishits)
            
            // ✅ CRICKET REALISM: Determine type of mishit
            if (swingTimingFactor < 0.40) {
                console.log('❌ POOR timing - swing timing way off!');
            } else if (distance < 0.4) {
                console.log('❌ POOR timing - too close! Cramped shot');
            } else if (distance > 3.5) {
                console.log('❌ POOR timing - reaching! Outside edge likely');
            } else {
                console.log('❌ POOR timing - mistimed shot');
            }
        }
        
        // ✅ NEW: Store detailed timing info for shot variation
        this.batSwing.timing = timingCategory;
        this.batSwing.timingDetails = {
            distance: distance,
            swingDuration: swingDuration,
            swingTimingFactor: swingTimingFactor,
            ballVelocity: ballVelocity
        };
        
        return {
            power: powerMultiplier,
            timing: timingCategory,
            directionalAccuracy: directionalAccuracy,
            distance: distance
        };
    }

    addShotVariation() {
        // ✅ UPDATED: Legacy method - now uses realistic variation system
        this.addRealisticShotVariation('good', 0.8);
    }

    onBallHit() {
        console.log('🎯 Ball has been hit! Activating hybrid fielding system...');
        
        this.fieldingSystem.ballIsHit = true;
        this.fieldingSystem.ballLastPosition.copy(this.cricketBall.position);
        
        // 🚫 SAFETY: Ensure all fielders are idle before selecting new response
        this.fielders.forEach(fielder => {
            const currentState = this.fieldingSystem.fielderStates.get(fielder.userData.description);
            if (currentState === 'chasing' || currentState === 'anticipating') {
                console.log(`🔄 Resetting ${fielder.userData.description} from ${currentState} to idle`);
                this.fieldingSystem.fielderStates.set(fielder.userData.description, 'idle');
                fielder.userData.isRunningForAnticipation = false; // Clear animation flag
            }
        });
        
        // ✅ NEW: Set debounce timer for hybrid selection
        this.fieldingSystem.nextSelectionTime = Date.now() + this.fieldingSystem.DEBOUNCE_MS;
        this.fieldingSystem.currentTask = null; // Clear any previous task
        
        console.log(`🕐 Fielding selection debounce set for ${this.fieldingSystem.DEBOUNCE_MS}ms...`);
        
        // The hybrid selection will trigger after debounce in assignFielderIfNeeded
        this.assignFielderIfNeeded();
    }
    
    assignFielderIfNeeded() {
        const now = Date.now();
        
        // Check debounce timer
        if (now < this.fieldingSystem.nextSelectionTime) {
            return; // Still in debounce period
        }
        
        // Check if we need to re-evaluate
        if (this.fieldingSystem.currentTask && 
            (now - this.fieldingSystem.currentTask.lastEval) < this.fieldingSystem.RE_EVAL_INTERVAL_MS) {
            return; // Too soon for re-evaluation
        }
        
        // Only proceed if ball is still moving and no catch locked in
        if (!this.ballPhysics.isMoving) {
            console.log('🚫 Ball stopped - no fielding needed');
            return;
        }
        
        // ✅ FIX: Check if ball has slowed down significantly - assign nearest fielder to collect it
        const currentBallSpeed = this.ballPhysics.velocity.length();
        if (currentBallSpeed < 1.0) { // Ball nearly stopped
            console.log('🚫 Ball too slow - assigning nearest fielder to collect stationary ball');
            this.assignNearestFielderToStationaryBall();
            return;
        }
        
        // ✅ FIX: Auto-reset if fielding has been going on too long (edge case protection)
        if (this.fieldingSystem.currentTask) {
            const taskDuration = now - this.fieldingSystem.currentTask.startTime;
            if (taskDuration > 15000) { // 15 seconds max
                console.log('⏰ Fielding task timeout - auto-resetting');
                this.resetFieldingSystem();
                return;
            }
        }
        
        console.log('🎯 Running hybrid fielder selection...');
        
        const ballPos = this.cricketBall.position.clone();
        const ballVelocity = this.ballPhysics.velocity.clone();
        
        // Calculate ball characteristics for decision making
        const ballHeight = ballPos.y;
        const ballSpeed = ballVelocity.length();
        const timeToLand = this.calculateTimeToLand();
        
        console.log(`📊 Ball stats: height=${ballHeight.toFixed(1)}m, speed=${ballSpeed.toFixed(1)}m/s, timeToLand=${timeToLand.toFixed(1)}s`);
        
        // PASS A: Try to find aerial catcher
        const aerialCatcher = this.selectAerialCatcher(ballPos, ballVelocity, ballHeight, timeToLand);
        
        if (aerialCatcher) {
            // Assign aerial catch task
            this.assignFieldingTask(aerialCatcher.fielder, 'catch', now);
            return;
        }
        
        // PASS B: Find ground chaser
        const groundChaser = this.selectGroundChaser(ballPos, ballVelocity, timeToLand);
        
        if (groundChaser) {
            // Check for handover if we already have a task
            if (this.fieldingSystem.currentTask) {
                const shouldHandover = this.shouldHandoverTask(groundChaser, now);
                if (shouldHandover) {
                    console.log(`🔄 Handing over from ${this.fieldingSystem.currentTask.fielder.userData.description} to ${groundChaser.fielder.userData.description}`);
                    this.clearCurrentTask();
                }
            }
            
            if (!this.fieldingSystem.currentTask) {
                this.assignFieldingTask(groundChaser.fielder, 'ground', now);
            }
        }
        
        // Update evaluation time regardless
        if (this.fieldingSystem.currentTask) {
            this.fieldingSystem.currentTask.lastEval = now;
        }
    }

    // ✅ NEW: PASS A - Select aerial catcher
    selectAerialCatcher(ballPos, ballVelocity, ballHeight, timeToLand) {
        // Skip if ball too low for aerial catch
        if (ballHeight < this.fieldingSystem.MIN_AERIAL_HEIGHT) {
            console.log(`⬇️ Ball too low (${ballHeight.toFixed(1)}m) for aerial catch - skipping Pass A`);
            return null;
        }
        
        console.log('🎯 Pass A: Looking for aerial catcher...');
        
        const landingPos = this.predictBallLanding();
        if (!landingPos) {
            console.log('❌ Could not predict landing - skipping aerial catch');
            return null;
        }
        
        const candidates = [];
        
        // ✅ FIX: Determine shot direction for aerial catch filtering too
        const shotDirection = this.determineShotDirection(ballVelocity, landingPos);
        
        // Evaluate each idle fielder for aerial catch capability
        this.fielders.forEach(fielder => {
            if (this.fieldingSystem.fielderStates.get(fielder.userData.description) !== 'idle') {
                return;
            }
            
            // ✅ FIX: Apply basic role filtering for aerial catches
            if (!this.isFielderSuitableForAerialCatch(fielder, shotDirection, landingPos)) {
                return;
            }
            
            // Calculate intercept capability
            const intercept = this.calculateInterceptPoint(fielder, timeToLand);
            if (!intercept.canReach) return;
            
            // Check if within reasonable intercept distance
            const interceptDist = fielder.position.distanceTo(intercept.position);
            if (interceptDist > this.fieldingSystem.MAX_CATCH_INTERCEPT_DIST) return;
            
            // Calculate catch probability
            const catchProb = this.calculateCatchProbability(fielder, ballPos, ballVelocity, interceptDist);
            if (catchProb < 0.15) return; // Minimum 15% chance
            
            candidates.push({
                fielder,
                intercept,
                catchProb,
                eta: intercept.timeToReach
            });
        });
        
        if (candidates.length === 0) {
            console.log('❌ No viable aerial catchers found');
            return null;
        }
        
        // Apply role-based filtering
        const landingDistFromStumps = Math.sqrt(landingPos.x * landingPos.x + landingPos.z * landingPos.z);
        
        if (landingDistFromStumps < this.fieldingSystem.KEEPER_BOWLER_PRIORITY_RADIUS) {
            // Prioritize keeper/bowler for close catches
            const priorityCandidates = candidates.filter(c => 
                c.fielder.userData.role === 'keeper' || c.fielder.userData.role === 'bowler'
            );
            
            if (priorityCandidates.length > 0) {
                console.log('👑 Prioritizing keeper/bowler for close aerial catch');
                candidates.length = 0;
                candidates.push(...priorityCandidates);
            }
        }
        
        // Sort by combination of ETA and catch probability
        candidates.sort((a, b) => {
            const scoreA = a.eta - (a.catchProb * 2); // Favor higher probability
            const scoreB = b.eta - (b.catchProb * 2);
            return scoreA - scoreB;
        });
        
        const winner = candidates[0];
        console.log(`✅ Pass A winner: ${winner.fielder.userData.description} (ETA: ${winner.eta.toFixed(1)}s, Prob: ${(winner.catchProb*100).toFixed(1)}%)`);
        
        return winner;
    }

    // ✅ NEW: PASS B - Select ground chaser
    selectGroundChaser(ballPos, ballVelocity, timeToLand) {
        console.log('🏃 Pass B: Looking for ground chaser...');
        
        const landingPos = this.predictBallLanding();
        if (!landingPos) {
            console.log('❌ Could not predict landing for ground chase');
            return null;
        }
        
        // ✅ FIX: Determine shot direction to filter appropriate fielders
        const shotDirection = this.determineShotDirection(ballVelocity, landingPos);
        console.log(`📍 Shot direction: ${shotDirection}`);
        
        const candidates = [];
        
        // Evaluate each idle fielder for ground fielding
        this.fielders.forEach(fielder => {
            if (this.fieldingSystem.fielderStates.get(fielder.userData.description) !== 'idle') {
                return;
            }
            
            // ✅ FIX: Apply role and directional filters
            if (!this.isFielderSuitableForGroundChase(fielder, shotDirection, landingPos)) {
                return;
            }
            
            const distToLanding = fielder.position.distanceTo(landingPos);
            // ✅ FIX: Add defensive check for topSpeed to prevent NaN ETA
            const topSpeed = fielder.userData.topSpeed || this.fieldingSystem.DEFAULT_TOP_SPEED;
            const eta = distToLanding / topSpeed;
            
            // ✅ FIX: Add directional penalty for fielders in wrong sector
            const directionalPenalty = this.calculateDirectionalPenalty(fielder, shotDirection, landingPos);
            const adjustedETA = eta + directionalPenalty;
            
            candidates.push({
                fielder,
                distToLanding,
                eta: adjustedETA,
                rawETA: eta,
                directionalPenalty,
                score: adjustedETA
            });
        });
        
        if (candidates.length === 0) {
            console.log('❌ No suitable fielders for ground chase after filtering');
            return null;
        }
        
        // Sort by adjusted ETA (fastest to reach wins)
        candidates.sort((a, b) => a.eta - b.eta);
        
        const winner = candidates[0];
        console.log(`✅ Pass B winner: ${winner.fielder.userData.description}`);
        console.log(`   Raw ETA: ${winner.rawETA.toFixed(1)}s, Directional penalty: ${winner.directionalPenalty.toFixed(1)}s, Final: ${winner.eta.toFixed(1)}s`);
        
        return winner;
    }

    // ✅ NEW: Determine shot direction based on velocity and landing position
    determineShotDirection(ballVelocity, landingPos) {
        const vx = ballVelocity.x;
        const vz = ballVelocity.z;
        const lx = landingPos.x;
        const lz = landingPos.z;
        
        // Use both velocity and landing position for more accurate direction
        const velocityAngle = Math.atan2(vx, -vz); // Negative vz because we want forward shots to be 0
        const landingAngle = Math.atan2(lx, -lz + 9); // Relative to batsman end (z=9)
        
        // Weight landing position more heavily as it's more reliable
        const combinedAngle = velocityAngle * 0.3 + landingAngle * 0.7;
        
        // Convert to degrees for easier understanding
        let degrees = combinedAngle * 180 / Math.PI;
        if (degrees < 0) degrees += 360;
        
        // Map to cricket field regions (from batsman's perspective)
        if (degrees >= 315 || degrees < 45) return 'straight';
        else if (degrees >= 45 && degrees < 135) return 'offSide';
        else if (degrees >= 135 && degrees < 225) return 'behind'; 
        else return 'legSide';
    }

    // ✅ NEW: Check if fielder is suitable for ground chase based on role and direction
    isFielderSuitableForGroundChase(fielder, shotDirection, landingPos) {
        const role = fielder.userData.role;
        const description = fielder.userData.description.toLowerCase();
        
        // ✅ FIX: Slip fielders should NOT chase unless ball is specifically behind
        if (description.includes('slip')) {
            if (shotDirection !== 'behind') {
                console.log(`🚫 ${fielder.userData.description} excluded: slip fielder for ${shotDirection} shot`);
                return false;
            }
        }
        
        // ✅ FIX: Gully should only chase off-side shots behind the wicket
        if (description.includes('gully')) {
            if (shotDirection !== 'offSide' && shotDirection !== 'behind') {
                console.log(`🚫 ${fielder.userData.description} excluded: gully for ${shotDirection} shot`);
                return false;
            }
        }
        
        // ✅ FIX: Keep keeper close to stumps unless ball is very close
        if (role === 'keeper') {
            const distanceFromStumps = Math.sqrt(landingPos.x * landingPos.x + (landingPos.z - 9) * (landingPos.z - 9));
            if (distanceFromStumps > 10) {
                console.log(`🚫 ${fielder.userData.description} excluded: keeper for distant shot (${distanceFromStumps.toFixed(1)}m)`);
                return false;
            }
        }
        
        // ✅ FIX: Bowler should only chase shots coming back towards them
        if (role === 'bowler') {
            if (shotDirection !== 'straight' && landingPos.z > 0) {
                console.log(`🚫 ${fielder.userData.description} excluded: bowler for ${shotDirection} shot going away`);
                return false;
            }
        }
        
        return true;
    }

    // ✅ NEW: Check if fielder is suitable for aerial catch based on role and direction
    isFielderSuitableForAerialCatch(fielder, shotDirection, landingPos) {
        const role = fielder.userData.role;
        const description = fielder.userData.description.toLowerCase();
        
        // ✅ FIX: Slip fielders should only catch balls behind the wicket
        if (description.includes('slip')) {
            if (shotDirection !== 'behind') {
                console.log(`🚫 ${fielder.userData.description} excluded from aerial catch: slip fielder for ${shotDirection} shot`);
                return false;
            }
        }
        
        // ✅ FIX: Gully should only catch off-side or behind shots
        if (description.includes('gully')) {
            if (shotDirection !== 'offSide' && shotDirection !== 'behind') {
                console.log(`🚫 ${fielder.userData.description} excluded from aerial catch: gully for ${shotDirection} shot`);
                return false;
            }
        }
        
        // For aerial catches, allow more flexibility for other roles since they can run to intercept
        // But still exclude obviously wrong positions
        
        return true;
    }

    // ✅ NEW: Calculate penalty for fielders in wrong direction
    calculateDirectionalPenalty(fielder, shotDirection, landingPos) {
        const fielderPos = fielder.position;
        const landingToFielder = fielderPos.clone().sub(landingPos);
        
        // Calculate angle from landing position to fielder
        const fielderAngle = Math.atan2(landingToFielder.x, landingToFielder.z);
        let fielderDegrees = fielderAngle * 180 / Math.PI;
        if (fielderDegrees < 0) fielderDegrees += 360;
        
        // Get expected angle range for shot direction
        let expectedAngleMin, expectedAngleMax;
        switch (shotDirection) {
            case 'straight': expectedAngleMin = 315; expectedAngleMax = 45; break;
            case 'offSide': expectedAngleMin = 45; expectedAngleMax = 135; break;
            case 'behind': expectedAngleMin = 135; expectedAngleMax = 225; break;
            case 'legSide': expectedAngleMin = 225; expectedAngleMax = 315; break;
            default: return 0;
        }
        
        // Calculate angular distance from expected range
        let angularDistance = 0;
        
        if (expectedAngleMin > expectedAngleMax) { // Crosses 0 degrees (straight shots)
            if (fielderDegrees >= expectedAngleMin || fielderDegrees <= expectedAngleMax) {
                angularDistance = 0; // In range
            } else {
                angularDistance = Math.min(
                    Math.abs(fielderDegrees - expectedAngleMin),
                    Math.abs(fielderDegrees - expectedAngleMax)
                );
            }
        } else {
            if (fielderDegrees >= expectedAngleMin && fielderDegrees <= expectedAngleMax) {
                angularDistance = 0; // In range
            } else {
                angularDistance = Math.min(
                    Math.abs(fielderDegrees - expectedAngleMin),
                    Math.abs(fielderDegrees - expectedAngleMax)
                );
            }
        }
        
        // Convert angular distance to time penalty (max 2 seconds penalty for 90 degrees off)
        const penalty = (angularDistance / 90) * 2.0;
        
        return Math.min(penalty, 2.0); // Cap at 2 seconds
    }

    // ✅ NEW: Assign fielding task
    assignFieldingTask(fielder, mode, timestamp) {
        // ✅ FIX: Add defensive checks
        if (!fielder) {
            console.error('❌ assignFieldingTask: fielder is null/undefined');
            return;
        }
        
        if (!fielder.userData) {
            console.error(`❌ assignFieldingTask: fielder.userData is null/undefined for fielder:`, fielder);
            return;
        }
        
        if (!fielder.userData.description) {
            console.error(`❌ assignFieldingTask: fielder.userData.description is null/undefined for fielder:`, fielder);
            return;
        }
        
        console.log(`📝 Assigning ${mode} task to ${fielder.userData.description}`);
        
        // Clear any existing task
        this.clearCurrentTask();
        
        // Create new task
        this.fieldingSystem.currentTask = {
            fielder,
            mode,
            lastEval: timestamp,
            startTime: timestamp
        };
        
        // Set fielder state and start appropriate action
        if (mode === 'catch') {
            this.fieldingSystem.fielderStates.set(fielder.userData.description, 'anticipating');
            this.fieldingSystem.catchingSystem.catchInProgress = true;
            this.fieldingSystem.catchingSystem.catchingFielder = fielder;
            
            // Start intercept
            const intercept = this.calculateInterceptPoint(fielder, this.fieldingSystem.catchingSystem.anticipationTime);
            this.startDirectIntercept(fielder, intercept.position);
            
        } else if (mode === 'ground') {
            this.fieldingSystem.fielderStates.set(fielder.userData.description, 'chasing');
            this.fieldingSystem.chasingFielder = fielder;
            this.startFielderChasing(fielder);
        }
    }

    // ✅ NEW: Check if we should hand over task to a better fielder
    shouldHandoverTask(newCandidate, currentTime) {
        if (!this.fieldingSystem.currentTask) return false;
        
        const currentFielder = this.fieldingSystem.currentTask.fielder;
        
        // Check handover cooldown
        if (currentTime - this.fieldingSystem.currentTask.startTime < this.fieldingSystem.HANDOVER_COOLDOWN_MS) {
            return false;
        }
        
        // Check if current fielder recently lost a handover
        if (currentTime - currentFielder.userData.lastHandoverTime < this.fieldingSystem.HANDOVER_COOLDOWN_MS) {
            return false;
        }
        
        // Calculate ETA advantage
        const landingPos = this.predictBallLanding();
        if (!landingPos) return false;
        
        const currentETA = currentFielder.position.distanceTo(landingPos) / currentFielder.userData.topSpeed;
        const newETA = newCandidate.eta;
        
        const advantage = currentETA - newETA;
        
        console.log(`🤔 Handover check: current ETA=${currentETA.toFixed(1)}s, new ETA=${newETA.toFixed(1)}s, advantage=${advantage.toFixed(1)}s`);
        
        return advantage > this.fieldingSystem.HANDOVER_MARGIN_SEC;
    }

    // ✅ NEW: Clear current fielding task
    clearCurrentTask() {
        if (!this.fieldingSystem.currentTask) return;
        
        // ✅ FIX: Clear fielder state properly
        const currentFielder = this.fieldingSystem.currentTask.fielder;
        if (currentFielder && currentFielder.userData && currentFielder.userData.description) {
            console.log(`🔄 Clearing task for ${currentFielder.userData.description}`);
            this.fieldingSystem.fielderStates.set(currentFielder.userData.description, 'idle');
            
            // Clear fielder-specific flags
            currentFielder.userData.isRunningForAnticipation = false;
            currentFielder.userData.chaseStartTime = null;
            currentFielder.userData.interceptTarget = null;
            currentFielder.userData.interceptStartTime = null;
            currentFielder.userData.targetPosition = null;
        }
        
        const fielder = this.fieldingSystem.currentTask.fielder;
        
        // Mark handover time
        fielder.userData.lastHandoverTime = Date.now();
        
        // Reset fielder state
        const currentState = this.fieldingSystem.fielderStates.get(fielder.userData.description);
        if (currentState !== 'idle') {
            this.fieldingSystem.fielderStates.set(fielder.userData.description, 'idle');
            console.log(`🔄 Clearing task: ${fielder.userData.description} -> idle`);
        }
        
        // Clear task references
        this.fieldingSystem.currentTask = null;
        this.fieldingSystem.chasingFielder = null;
        
        if (this.fieldingSystem.catchingSystem.catchingFielder === fielder) {
            this.fieldingSystem.catchingSystem.catchInProgress = false;
            this.fieldingSystem.catchingSystem.catchingFielder = null;
        }
    }

    // ✅ NEW: Assign nearest fielder to collect stationary ball
    assignNearestFielderToStationaryBall() {
        if (!this.cricketBall || !this.fielders || this.fielders.length === 0) {
            console.log('❌ Cannot assign fielder - missing ball or fielders');
            this.forceCompleteBall();
            return;
        }

        // Find the nearest idle fielder to the ball
        const ballPos = this.cricketBall.position.clone();
        let nearestFielder = null;
        let shortestDistance = Infinity;

        this.fielders.forEach(fielder => {
            if (!fielder.userData || !fielder.userData.description) return;
            
            const state = this.fieldingSystem.fielderStates.get(fielder.userData.description);
            if (state === 'idle') {
                const distance = fielder.position.distanceTo(ballPos);
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    nearestFielder = fielder;
                }
            }
        });

        if (!nearestFielder) {
            console.log('❌ No idle fielders available - force completing ball');
            this.forceCompleteBall();
            return;
        }

        console.log(`🚶 ${nearestFielder.userData.description} collecting stationary ball (${shortestDistance.toFixed(1)}m away)`);
        
        // Clear any existing task and assign collection task
        this.clearCurrentTask();
        
        // Create collection task
        this.fieldingSystem.currentTask = {
            fielder: nearestFielder,
            mode: 'collect', // New mode for stationary ball collection
            lastEval: Date.now(),
            startTime: Date.now()
        };
        
        // Set fielder state
        this.fieldingSystem.fielderStates.set(nearestFielder.userData.description, 'chasing');
        this.fieldingSystem.chasingFielder = nearestFielder;
        
        // Start the fielder moving to the ball
        this.startFielderChasing(nearestFielder);
        
        // Mark ball as being collected
        this.ballPhysics.isMoving = false; // Ensure ball stays stationary
    }

    // ✅ NEW: Determine shot zone based on ball velocity
    determineShotZone(ballVelocity) {
        const vx = ballVelocity.x;
        const vz = ballVelocity.z;
        
        // Determine primary direction
        if (Math.abs(vx) > Math.abs(vz)) {
            // Ball is going more sideways than forward/backward
            return vx > 0 ? 'offSide' : 'legSide';
        } else if (vz > 0) {
            // Ball is going behind the batsman
            return 'behind';
        } else {
            // Ball is going toward bowler (straight)
            return 'straight';
        }
    }

    // ✅ NEW: Get fielders appropriate for the shot zone
    getFieldersInZone(shotZone) {
        const zoneFielders = this.fieldingSystem.fieldingZones[shotZone] || [];
        return this.fielders.filter(f => 
            zoneFielders.includes(f.userData.description) &&
            this.fieldingSystem.fielderStates.get(f.userData.description) === 'idle'
        );
    }

    // ✅ NEW: Rebuild dynamic fielding metadata based on current positions
    rebuildFieldingMeta() {
        if (!this.fielders || this.fielders.length === 0) return;
        
        console.log('🔄 Rebuilding fielding metadata for dynamic positioning...');
        
        // Clear existing sector mapping
        this.fieldingSystem.sectorMap.clear();
        for (let i = 0; i < this.fieldingSystem.TOTAL_SECTORS; i++) {
            this.fieldingSystem.sectorMap.set(i, []);
        }
        
        const sectorArc = (2 * Math.PI) / this.fieldingSystem.TOTAL_SECTORS;
        const strikerPos = { x: 0, z: 9 }; // Batsman's end
        
        this.fielders.forEach(fielder => {
            if (!fielder.userData || !fielder.userData.description) return;
            
            // Calculate polar angle from striker's end
            const dx = fielder.position.x - strikerPos.x;
            const dz = fielder.position.z - strikerPos.z;
            let angle = Math.atan2(dx, dz); // atan2 gives angle from positive Z axis
            
            // Normalize angle to 0-2π range
            if (angle < 0) angle += 2 * Math.PI;
            
            // Calculate sector index (0-11)
            const sector = Math.floor(angle / sectorArc);
            fielder.userData.sector = sector;
            
            // Add to sector mapping
            const sectorFielders = this.fieldingSystem.sectorMap.get(sector) || [];
            sectorFielders.push(fielder);
            this.fieldingSystem.sectorMap.set(sector, sectorFielders);
            
            console.log(`📍 ${fielder.userData.description}: sector ${sector} (angle: ${(angle * 180 / Math.PI).toFixed(1)}°)`);
        });
        
        console.log('✅ Fielding metadata rebuilt with dynamic sectors');
    }

    // ✅ NEW: Debug overlay for hybrid fielding system
    createFieldingDebugOverlay() {
        if (document.getElementById('fieldingDebug')) {
            return; // Already exists
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'fieldingDebug';
        overlay.style.cssText = `
            position: fixed;
            top: 200px;
            right: 20px;
            width: 300px;
            max-height: 400px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            padding: 10px;
            border: 1px solid #444;
            border-radius: 5px;
            z-index: 200;
            display: none;
        `;
        
        overlay.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 10px;">🎯 HYBRID FIELDING DEBUG</div>
            <div id="debugContent">Press 'F' to toggle</div>
        `;
        
        document.body.appendChild(overlay);
        
        // Add keyboard toggle
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const isVisible = overlay.style.display !== 'none';
                overlay.style.display = isVisible ? 'none' : 'block';
                
                if (!isVisible) {
                    this.updateFieldingDebugOverlay();
                }
            }
        });
        
        console.log('🔧 Fielding debug overlay created - press F to toggle');
        
        // Log successful hybrid implementation
        setTimeout(() => {
            console.log('');
            console.log('🎯 ========== HYBRID FIELDING SYSTEM v2.1 LOADED ==========');
            console.log('✅ Two-pass selection: Aerial catch → Ground chase');
            console.log('✅ Debounced selection (120ms) for stable trajectory');
            console.log('✅ Periodic re-evaluation (250ms) with handover logic');
            console.log('✅ Role-based priorities (keeper/bowler for close catches)');
            console.log('✅ Directional filtering (slip/gully stay in position)');
            console.log('✅ Dynamic position tracking and abort-catch detection');
            console.log('🔧 Debug overlay: Press F in-game for real-time analysis');
            console.log('======================================================');
            console.log('');
        }, 2000);
    }

    // ✅ NEW: Update debug overlay with current fielding state
    updateFieldingDebugOverlay() {
        const overlay = document.getElementById('fieldingDebug');
        const content = document.getElementById('debugContent');
        
        if (!overlay || overlay.style.display === 'none' || !content) return;
        
        const ballPos = this.cricketBall ? this.cricketBall.position : { x: 0, y: 0, z: 0 };
        const ballVel = this.ballPhysics ? this.ballPhysics.velocity : { x: 0, y: 0, z: 0, length: () => 0 };
        const task = this.fieldingSystem.currentTask;
        
        let html = `
            <div style="margin-bottom: 8px;">
                <strong>Ball:</strong> (${ballPos.x.toFixed(1)}, ${ballPos.y.toFixed(1)}, ${ballPos.z.toFixed(1)})<br>
                <strong>Velocity:</strong> ${ballVel.length().toFixed(1)} m/s<br>
                <strong>Ball Hit:</strong> ${this.fieldingSystem.ballIsHit ? 'YES' : 'NO'}
            </div>
        `;
        
        if (task) {
            html += `
                <div style="border-top: 1px solid #444; padding-top: 8px; margin-bottom: 8px;">
                    <strong>Current Task:</strong><br>
                    Fielder: ${task.fielder.userData.description}<br>
                    Mode: ${task.mode}<br>
                    Age: ${((Date.now() - task.startTime) / 1000).toFixed(1)}s<br>
                    Last Eval: ${((Date.now() - task.lastEval) / 1000).toFixed(1)}s ago
                </div>
            `;
        } else {
            html += `
                <div style="border-top: 1px solid #444; padding-top: 8px; margin-bottom: 8px;">
                    <strong>Current Task:</strong> None
                </div>
            `;
        }
        
        // Show fielder candidates if ball is hit
        if (this.fieldingSystem.ballIsHit) {
            const landingPos = this.predictBallLanding();
            
            html += `<div style="border-top: 1px solid #444; padding-top: 8px;">`;
            html += `<strong>Fielder Analysis:</strong><br>`;
            
            if (landingPos) {
                html += `Landing: (${landingPos.x.toFixed(1)}, ${landingPos.z.toFixed(1)})<br>`;
                
                // Show shot direction
                const shotDirection = this.determineShotDirection(ballVel, landingPos);
                html += `Direction: ${shotDirection}<br><br>`;
            }
            
            // Show top 5 fielders by ETA
            const candidates = [];
            this.fielders.forEach(fielder => {
                const state = this.fieldingSystem.fielderStates.get(fielder.userData.description);
                const dist = landingPos ? fielder.position.distanceTo(landingPos) : 
                            fielder.position.distanceTo(ballPos);
                const eta = dist / fielder.userData.topSpeed;
                
                candidates.push({
                    name: fielder.userData.description,
                    state,
                    dist: dist.toFixed(1),
                    eta: eta.toFixed(1),
                    role: fielder.userData.role
                });
            });
            
            candidates.sort((a, b) => parseFloat(a.eta) - parseFloat(b.eta));
            candidates.slice(0, 5).forEach((c, i) => {
                const marker = task && task.fielder.userData.description === c.name ? '→ ' : '   ';
                html += `${marker}${c.name}: ${c.eta}s (${c.state})<br>`;
            });
            
            html += `</div>`;
        }
        
        content.innerHTML = html;
    }

    calculateTimeToLand() {
        if (!this.cricketBall || !this.ballPhysics.isMoving) return 0;
        
        const currentPos = this.cricketBall.position;
        const velocity = this.ballPhysics.velocity;
        const gravity = this.ballPhysics.gravity;
        
        // If ball is already on ground, return 0
        if (currentPos.y <= 0.035) return 0;
        
        // Calculate time when ball hits ground using quadratic formula
        // y = y0 + vy*t + 0.5*g*t^2
        // When y = 0.035: 0.035 = currentPos.y + velocity.y*t + 0.5*gravity*t^2
        
        const a = 0.5 * gravity;
        const b = velocity.y;
        const c = currentPos.y - 0.035;
        
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return 0; // Ball won't hit ground (shouldn't happen)
        
        // Take the positive root (future time)
        const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
        
        // Return the positive time value
        return Math.max(0, Math.max(t1, t2));
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
        
        // Calculate landing position with improved friction modeling
        // Use a more realistic friction decay that considers bounce effects
        let effectiveTimeToLand = timeToLand;
        
        // For high balls, reduce the effective time slightly to account for fielder reaction
        if (currentPos.y > 3.0) {
            effectiveTimeToLand *= 0.9; // Account for fielder positioning time
        }
        
        // Apply gradual friction effect over time
        const frictionFactor = Math.pow(this.ballPhysics.friction, effectiveTimeToLand * 8);
        const adjustedX = currentPos.x + velocity.x * effectiveTimeToLand * frictionFactor;
        const adjustedZ = currentPos.z + velocity.z * effectiveTimeToLand * frictionFactor;
        
        // Add smaller prediction uncertainty since we update dynamically
        const uncertainty = 0.2; // 0.2m uncertainty (reduced from 0.5m)
        const uncertaintyX = (Math.random() - 0.5) * uncertainty;
        const uncertaintyZ = (Math.random() - 0.5) * uncertainty;
        
        return new THREE.Vector3(
            adjustedX + uncertaintyX, 
            targetHeight, 
            adjustedZ + uncertaintyZ
        );
    }

    startDirectIntercept(fielder, targetPosition) {
        if (!fielder || !targetPosition) return;
        
        console.log(`🎯 ${fielder.userData.description} running to intercept ball at landing position!`);
        console.log(`   Target: (${targetPosition.x.toFixed(1)}, ${targetPosition.z.toFixed(1)})`);
        
        // Set fielder state to intercepting
        this.fieldingSystem.fielderStates.set(fielder.userData.description, 'intercepting');
        this.fieldingSystem.catchingSystem.catchInProgress = true;
        this.fieldingSystem.catchingSystem.catchingFielder = fielder;
        
        // Store simple target position
        fielder.userData.interceptTarget = targetPosition.clone();
        fielder.userData.interceptStartTime = Date.now();
        
        // Load running animation
        if (!fielder.userData.animations || !fielder.userData.animations.has('runningcharacter')) {
            this.loadCharacterAnimation(fielder, 'runningcharacter.fbx', fielder.userData.description);
        }
        
        this.waitForAnimationAndPlay(fielder, 'runningcharacter', true);
        
        console.log(`🏃 ${fielder.userData.description} running to landing position for direct intercept!`);
    }

    startFielderChasing(fielder) {
        if (!fielder || !fielder.userData) return;
        
        console.log(`🏃 ${fielder.userData.description} is now chasing the ball!`);
        
        // Reset chase timer for new chase
        fielder.userData.chaseStartTime = Date.now();
        
        // Load running animation if not already loaded
        if (!fielder.userData.animations || !fielder.userData.animations.has('runningcharacter')) {
            this.loadCharacterAnimation(fielder, 'runningcharacter.fbx', fielder.userData.description);
        }
        
        // Use waitForAnimationAndPlay to ensure animation loads before playing
        this.waitForAnimationAndPlay(fielder, 'runningcharacter', true);
    }

    updateFieldingSystem(deltaTime) {
        if (!this.fieldingSystem.ballIsHit) return;
        
        // ✅ NEW: Periodic re-evaluation for hybrid system
        this.assignFielderIfNeeded();
        
        // ✅ NEW: Add abort-catch check for intercepting fielders
        if (this.fieldingSystem.currentTask && this.fieldingSystem.currentTask.mode === 'catch') {
            this.checkAbortCatch();
        }
        
        // Handle different fielder states
        this.fielders.forEach(fielder => {
            if (!fielder.userData || !fielder.userData.description) return;
            
            const fielderState = this.fieldingSystem.fielderStates.get(fielder.userData.description);
            
            if (fielderState === 'intercepting') {
                this.updateFielderIntercepting(fielder, deltaTime);
            } else if (fielderState === 'chasing') {
                this.updateFielderChasing(fielder, deltaTime);
            } else if (fielderState === 'returning') {
                this.updateFielderReturning(fielder, deltaTime);
            } else if (fielderState === 'anticipating') {
                this.updateFielderAnticipating(fielder, deltaTime);
            }
        });
    }

    // ✅ NEW: Check if we should abort aerial catch and switch to ground
    checkAbortCatch() {
        if (!this.fieldingSystem.currentTask || this.fieldingSystem.currentTask.mode !== 'catch') return;
        
        const ballPos = this.cricketBall.position;
        const ballVel = this.ballPhysics.velocity;
        const fielder = this.fieldingSystem.currentTask.fielder;
        
        // Check if ball has become too low or slow for aerial catch
        const ballHeight = ballPos.y;
        const ballSpeed = ballVel.length();
        const verticalSpeed = Math.abs(ballVel.y);
        
        // Abort conditions
        const tooLow = ballHeight < 1.0;
        const tooSlow = ballSpeed < 2.0;
        const notDescending = ballVel.y > -1.0 && ballHeight < 2.0; // Ball not dropping fast enough
        
        if (tooLow || tooSlow || notDescending) {
            const distanceToBall = fielder.position.distanceTo(ballPos);
            if (distanceToBall > 3.0) { // Only abort if not already very close
                console.log(`🚫 Aborting aerial catch: height=${ballHeight.toFixed(1)}m, speed=${ballSpeed.toFixed(1)}m/s, vSpeed=${verticalSpeed.toFixed(1)}m/s`);
                
                // Convert to ground chase
                this.fieldingSystem.currentTask.mode = 'ground';
                this.fieldingSystem.fielderStates.set(fielder.userData.description, 'chasing');
                this.fieldingSystem.catchingSystem.catchInProgress = false;
                this.fieldingSystem.catchingSystem.catchingFielder = null;
                this.fieldingSystem.chasingFielder = fielder;
                
                // Clear intercept data
                fielder.userData.interceptTarget = null;
                fielder.userData.interceptStartTime = null;
                
                console.log(`🔄 ${fielder.userData.description} switched from aerial catch to ground chase`);
            }
        }
    }

    updateFielderIntercepting(fielder, deltaTime) {
        if (!fielder.userData.interceptTarget) return;
        
        const ballPosition = this.cricketBall.position;
        
        // 🎯 DYNAMIC PREDICTION: Update target based on current ball position every frame
        if (this.ballPhysics.isMoving) {
            const updatedPrediction = this.predictBallLanding();
            if (updatedPrediction) {
                // Only update if the new prediction is significantly different
                const currentTarget = fielder.userData.interceptTarget;
                const predictionDiff = currentTarget.distanceTo(updatedPrediction);
                
                if (predictionDiff > 1.0) { // More than 1m difference
                    console.log(`🔄 ${fielder.userData.description} updating target: (${currentTarget.x.toFixed(1)}, ${currentTarget.z.toFixed(1)}) → (${updatedPrediction.x.toFixed(1)}, ${updatedPrediction.z.toFixed(1)})`);
                    fielder.userData.interceptTarget = updatedPrediction;
                }
            }
        }
        
        const targetPosition = fielder.userData.interceptTarget;
        
        // Calculate direction to target position
        const direction = targetPosition.clone().sub(fielder.position);
        direction.y = 0; // Keep fielder on ground
        const distanceToTarget = direction.length();
        
        // Calculate distance to ball
        const distanceToBall = fielder.position.distanceTo(ballPosition);
        
        // 🎯 SMART TRIGGER: Check if fielder should attempt catch/pickup
        const shouldAttemptCatch = (
            distanceToTarget < 1.5 ||   // Very close to target
            distanceToBall < 2.5 ||     // Close to actual ball
            ballPosition.y <= 0.8 ||    // Ball very low
            !this.ballPhysics.isMoving  // Ball stopped
        );
        
        if (shouldAttemptCatch) {
            console.log(`🎯 ${fielder.userData.description} attempting catch/pickup!`);
            console.log(`   Distance to target: ${distanceToTarget.toFixed(1)}m, Distance to ball: ${distanceToBall.toFixed(1)}m`);
            this.executeDirectCatch(fielder);
            return;
        }
        
        // Move fielder towards target position
        if (distanceToTarget > 0.5) {
            direction.normalize();
            const moveSpeed = 10; // Faster speed for more responsive movement
            
            fielder.position.add(direction.multiplyScalar(moveSpeed * deltaTime));
            
            // Make fielder face the direction they're moving
            const lookAtPosition = fielder.position.clone().add(direction);
            lookAtPosition.y = fielder.position.y;
            fielder.lookAt(lookAtPosition);
        }
        
        // Safety timeout (6 seconds instead of 8 for quicker response)
        const interceptDuration = Date.now() - fielder.userData.interceptStartTime;
        if (interceptDuration > 6000) {
            console.log(`⏰ ${fielder.userData.description} timeout - switching to direct ball chase`);
            // Switch to chasing the actual ball instead of predicted position
            this.fieldingSystem.fielderStates.set(fielder.userData.description, 'chasing');
            fielder.userData.interceptTarget = null;
            fielder.userData.interceptStartTime = null;
        }
    }

    executeDirectCatch(fielder) {
        if (!fielder || !this.cricketBall) return;
        
        console.log(`🥎 ${fielder.userData.description} executing direct catch/pickup!`);
        
        // Calculate distance to ball
        const ballPosition = this.cricketBall.position;
        const fielderPosition = fielder.position;
        const distance = ballPosition.distanceTo(fielderPosition);
        
        console.log(`📏 Distance to ball: ${distance.toFixed(1)}m, Ball height: ${ballPosition.y.toFixed(1)}m`);
        
        // If ball is on ground and close, just pick it up immediately
        if (ballPosition.y <= 0.5 && distance <= 2.0) {
            console.log(`⚡ Immediate pickup! Ball is on ground and close`);
            this.attemptImmediatePickup(fielder, distance);
            return;
        }
        
        // Safety check: If ball is too far away, don't attempt catch - just field it
        const maxCatchDistance = this.fieldingSystem.catchingSystem.catchRadius + 2.0; // 7m max
        if (distance > maxCatchDistance) {
            console.log(`❌ Ball too far for catch attempt (${distance.toFixed(1)}m > ${maxCatchDistance}m) - switching to field mode`);
            this.fieldingSystem.fielderStates.set(fielder.userData.description, 'chasing');
            this.updateFielderChasing(fielder, 0.016); // Call once to start chase
            return;
        }
        
        // ✅ NEW: Check catch probability before attempting
        const catchProbability = this.calculateCatchProbability(fielder, ballPosition, this.ballPhysics.velocity, distance);
        console.log(`📊 ${fielder.userData.description} catch probability: ${(catchProbability * 100).toFixed(1)}%`);
        
        if (catchProbability < 0.15) {
            console.log(`❌ Catch probability too low (${(catchProbability * 100).toFixed(1)}% < 15%) - switching to field mode`);
            this.fieldingSystem.fielderStates.set(fielder.userData.description, 'chasing');
            this.updateFielderChasing(fielder, 0.016); // Call once to start chase
            return;
        }
        
        // Otherwise attempt a catch (probability ≥ 20%)
        let catchType = 'regularcatch';
        let catchAnimation = 'regularcatch.fbx';
        
        if (distance > 3.0) {
            catchType = 'divingcatch';
            catchAnimation = 'divingcatch.fbx';
            console.log(`🤸‍♂️ ${fielder.userData.description} going for a diving catch! (${distance.toFixed(1)}m away, ${(catchProbability * 100).toFixed(1)}% chance)`);
        } else {
            console.log(`✋ ${fielder.userData.description} going for a regular catch! (${distance.toFixed(1)}m away, ${(catchProbability * 100).toFixed(1)}% chance)`);
        }
        
        // Set fielder state to catching
        this.fieldingSystem.fielderStates.set(fielder.userData.description, 'catching');
        
        // Load and play catch animation
        this.loadCharacterAnimation(fielder, catchAnimation, fielder.userData.description);
        
        setTimeout(() => {
            this.playCricketPlayerAnimation(fielder, catchType);
            
            // Resolve catch based on distance and difficulty
            setTimeout(() => {
                this.resolveCatch(fielder, distance, catchType);
            }, 800);
            
        }, 100);
        
        // Clear interception data
        fielder.userData.interceptTarget = null;
        fielder.userData.interceptStartTime = null;
    }

    updateFielderChasing(fielder, deltaTime) {
        if (!this.cricketBall) return;
        
        const ballPosition = this.cricketBall.position;
        
        // If fielder has a target position (from the prediction), chase that instead of the ball directly
        const targetPosition = fielder.userData.targetPosition || ballPosition;
        
        // Calculate direction from fielder to target
        const direction = targetPosition.clone().sub(fielder.position);
        direction.y = 0; // Keep fielder on ground
        const distanceToTarget = direction.length();
        const distanceToBall = fielder.position.distanceTo(ballPosition);
        
        // If fielder is close enough to the ball, stop and field it
        if (distanceToBall < 2.5 && this.ballPhysics.velocity.length() < 0.5) {
            console.log(`🤲 ${fielder.userData.description} reached ball position for pickup`);
            this.fielderReachBall(fielder);
            return;
        }
        
        // If ball is on ground and fielder is close, pick it up immediately
        if (ballPosition.y <= 0.5 && distanceToBall <= 2.0) {
            console.log(`⚡ ${fielder.userData.description} close to ground ball - immediate pickup`);
            this.attemptImmediatePickup(fielder, distanceToBall);
            return;
        }
        
        // Move fielder towards target position
        if (distanceToTarget > 0.5) {
            direction.normalize();
            const moveSpeed = 10; // Faster speed for more responsive movement
            
            // Move fielder towards target
            fielder.position.add(direction.multiplyScalar(moveSpeed * deltaTime));
            
            // Make fielder face the direction they're moving
            const lookAtPosition = fielder.position.clone().add(direction);
            lookAtPosition.y = fielder.position.y;
            fielder.lookAt(lookAtPosition);
        }
        
        // Safety mechanism: If fielder has been chasing for too long, complete the ball
        if (!fielder.userData.chaseStartTime) {
            fielder.userData.chaseStartTime = Date.now();
        }
        
        const chaseDuration = Date.now() - fielder.userData.chaseStartTime;
        if (chaseDuration > 8000) { // 8 seconds timeout
            console.log(`⏰ ${fielder.userData.description} chase timeout - fielding ball anyway`);
            this.fielderReachBall(fielder);
            fielder.userData.chaseStartTime = null;
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

    updateFielderAnticipating(fielder, deltaTime) {
        if (!this.cricketBall || !this.ballPhysics.isMoving) {
            // Ball stopped or disappeared, return to idle
            this.fieldingSystem.fielderStates.set(fielder.userData.description, 'idle');
            fielder.userData.isRunningForAnticipation = false; // Clear animation flag
            this.playCricketPlayerAnimation(fielder, 'standingidle');
            return;
        }

        // Calculate new intercept point
        const intercept = this.calculateInterceptPoint(fielder, this.fieldingSystem.catchingSystem.anticipationTime);
        
        // Check if ball is now within catch range
        const ballDistance = fielder.position.distanceTo(this.cricketBall.position);
        if (ballDistance <= this.fieldingSystem.catchingSystem.catchRadius) {
            // Switch to normal catch checking
            this.fieldingSystem.fielderStates.set(fielder.userData.description, 'idle');
            return;
        }
        
        // Continue moving toward intercept point
        this.moveFielderToPosition(fielder, intercept.position);
        
        // If fielder reached the anticipated position but ball isn't there, return to idle
        const distanceToTarget = fielder.position.distanceTo(intercept.position);
        if (distanceToTarget < 1.0 && !intercept.canReach) {
            this.fieldingSystem.fielderStates.set(fielder.userData.description, 'idle');
            fielder.userData.isRunningForAnticipation = false; // Clear animation flag
            this.playCricketPlayerAnimation(fielder, 'standingidle');
            console.log(`🤷‍♂️ ${fielder.userData.description} couldn't reach predicted position, returning to idle`);
        }
    }

    fielderReachBall(fielder) {
        // If a boundary has been scored, the ball is dead.
        if (this.cricketScore.boundaryAwarded) {
            console.log('📝 Ball already went for a boundary. Fielder cannot field it.');
            this.ballPhysics.isMoving = false; // Stop the ball's movement
            this.fieldingSystem.ballIsHit = false; // End the fielding sequence
            this.startFielderReturning(fielder); // Send the fielder back to position
            return;
        }
        console.log(`🤲 ${fielder.userData.description} has reached the ball!`);
        
        // Clear chase timer
        if (fielder.userData) {
            fielder.userData.chaseStartTime = null;
        }
        
        // Change state to throwing
        this.fieldingSystem.fielderStates.set(fielder.userData.description, 'throwing');
        
        // Stop ball movement
        this.ballPhysics.isMoving = false;
        this.ballPhysics.velocity.set(0, 0, 0);
        
        // Position ball near fielder
        this.cricketBall.position.copy(fielder.position);
        this.cricketBall.position.y += 1.5; // Hand height
        
        // Ball is now fielded - but DON'T complete yet if batsman is running (potential run-out)
        if (this.ballState.isActive && !this.ballState.isComplete) {
            this.ballState.ballType = 'fielded';
            this.ballState.completionReason = 'fielded';
            
            // Only complete immediately if batsman is NOT running (no run-out possible)
            if (!this.runningSystem.isRunning) {
                console.log('🔚 Batsman not running - completing ball immediately');
                setTimeout(() => {
                    this.completeBall();
                }, 1000);
            } else {
                console.log('🏃‍♂️ Batsman still running - delaying ball completion for potential run-out');
                // Ball completion will happen in bowlerCatchBall() after run-out check
            }
        }
        
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
        this.waitForAnimationAndPlay(fielder, 'runningcharacter', true);
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
        
        // Notify bowler to prepare for incoming throw
        this.prepareBowlerForIncomingThrow();
        
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
        
        
        // Calculate precise throwing velocity for accurate delivery
        // Use controlled power based on distance to avoid overshooting
        const maxThrowDistance = 60; // Maximum expected throw distance on cricket field
        const normalizedDistance = Math.min(distance / maxThrowDistance, 1.0); // Normalize to 0-1
        
        // Moderate base speed to prevent overshooting
        const baseThrowSpeed = 12; // Reduced from 18
        const distanceMultiplier = 1 + (normalizedDistance * 0.8); // Scale from 1.0 to 1.8 max
        const throwSpeed = baseThrowSpeed * distanceMultiplier;
        
        
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
        
        
        // Calculate estimated time to target for timeout
        const horizontalSpeed = Math.sqrt(this.ballPhysics.velocity.x ** 2 + this.ballPhysics.velocity.z ** 2);
        const estimatedTime = horizontalDistance / horizontalSpeed;
        
        // Reset fielding system after throw lands
        setTimeout(() => {
            this.resetFieldingSystem();
        }, Math.max(2500, estimatedTime * 1000 + 1000)); // Dynamic timeout based on throw time
    }

    // Predict where the ball will be after a given time
    predictBallPosition(timeAhead) {
        if (!this.cricketBall || !this.ballPhysics.isMoving) {
            return this.cricketBall ? this.cricketBall.position.clone() : new THREE.Vector3(0, 0, 0);
        }

        const currentPos = this.cricketBall.position.clone();
        const velocity = this.ballPhysics.velocity.clone();
        
        // Apply gravity over time
        const gravityEffect = 0.5 * this.ballPhysics.gravity * timeAhead * timeAhead;
        
        // Calculate predicted position
        const predictedPos = currentPos.clone();
        predictedPos.add(velocity.clone().multiplyScalar(timeAhead));
        predictedPos.y += gravityEffect; // Add gravity effect
        
        // Ensure predicted position doesn't go below ground
        if (predictedPos.y < 0.035) {
            predictedPos.y = 0.035;
        }
        
        return predictedPos;
    }

    // Calculate optimal intercept point for a fielder
    calculateInterceptPoint(fielder, timeAhead = 2.0) {
        const fielderSpeed = 8.0; // meters per second
        const predictedBallPos = this.predictBallPosition(timeAhead);
        const fielderPos = fielder.position.clone();
        
        // Calculate distance fielder can travel in timeAhead
        const maxFielderDistance = fielderSpeed * timeAhead;
        
        // Calculate distance to predicted ball position
        const distanceToBall = fielderPos.distanceTo(predictedBallPos);
        
        // If fielder can reach the predicted position, return it
        if (distanceToBall <= maxFielderDistance) {
            return {
                position: predictedBallPos,
                canReach: true,
                timeToReach: distanceToBall / fielderSpeed
            };
        }
        
        // Otherwise, calculate the closest point fielder can reach
        const direction = predictedBallPos.clone().sub(fielderPos).normalize();
        const interceptPos = fielderPos.clone().add(direction.multiplyScalar(maxFielderDistance));
        
        return {
            position: interceptPos,
            canReach: false,
            timeToReach: timeAhead
        };
    }

    // Update fielder positions based on ball trajectory prediction
    updatePredictiveFielding() {
        // DISABLED: This was causing multiple fielders to run in place
        // The new simplified system only uses one fielder at a time
        return;
        
        // The old predictive system caused issues:
        // - Multiple fielders moving at once 
        // - Fielders running in place
        // - Conflicts with the main chaser
        // Now we rely on immediate pickup and single chaser assignment
    }

    // Move fielder toward a target position
    moveFielderToPosition(fielder, targetPosition) {
        const fielderPos = fielder.position;
        const direction = targetPosition.clone().sub(fielderPos);
        direction.y = 0; // Keep on ground
        
        const distance = direction.length();
        
        if (distance > 0.5) { // Only move if not already close
            direction.normalize();
            const moveSpeed = 7.0; // Predictive movement speed
            
            // Move fielder gradually (this will be called each frame)
            const moveDistance = moveSpeed * 0.016; // Assuming ~60fps
            fielder.position.add(direction.multiplyScalar(moveDistance));
            
            // Make fielder face movement direction
            const lookAtPos = fielder.position.clone().add(direction);
            lookAtPos.y = fielder.position.y;
            fielder.lookAt(lookAtPos);
            
            // 🔧 FIX: Only start running animation once, not every frame
            // Check if fielder is already running the correct animation
            if (!fielder.userData.isRunningForAnticipation) {
                // Load running animation if not already loaded
                if (!fielder.userData.animations || !fielder.userData.animations.has('runningcharacter')) {
                    this.loadCharacterAnimation(fielder, 'runningcharacter.fbx', fielder.userData.description || 'fielder');
                }
                this.waitForAnimationAndPlay(fielder, 'runningcharacter', true);
                fielder.userData.isRunningForAnticipation = true;
                console.log(`🏃 ${fielder.userData.description} started anticipatory movement (animation started once)`);
            }
        } else {
            // Fielder reached target - stop running animation flag
            if (fielder.userData.isRunningForAnticipation) {
                fielder.userData.isRunningForAnticipation = false;
                console.log(`🛑 ${fielder.userData.description} reached anticipation target (animation flag cleared)`);
            }
        }
    }

    checkForImmediatePickup() {
        // HIGH PRIORITY: Check for immediate pickups first - this overrides everything else
        if (this.fieldingSystem.catchingSystem.catchInProgress || 
            !this.fieldingSystem.ballIsHit) {
            return;
        }

        const ballPos = this.cricketBall.position;
        const immediatePickupRadius = 2.0; // Increased to 2 meters for more generous pickup
        
        // Check for immediate pickup regardless of ball height or speed
        // Any fielder very close to the ball should pick it up
        this.fielders.forEach(fielder => {
            // Allow immediate pickup even for chasing fielders - they might be close now
            const fielderState = this.fieldingSystem.fielderStates.get(fielder.userData.description);
            if (fielderState === 'throwing' || fielderState === 'catching') {
                return; // Skip only if they're already handling ball
            }

            const fielderPos = fielder.position;
            const distance = ballPos.distanceTo(fielderPos);
            
            // Check for immediate pickup (any ball very close to any fielder)
            if (distance <= immediatePickupRadius) {
                console.log(`⚡ IMMEDIATE PICKUP! ${fielder.userData.description} is ${distance.toFixed(1)}m from ball - taking over!`);
                console.log(`   Ball height: ${ballPos.y.toFixed(1)}m, Ball speed: ${this.ballPhysics.velocity.length().toFixed(1)}`);
                
                // Clear any existing chaser - this fielder is taking over
                if (this.fieldingSystem.chasingFielder && this.fieldingSystem.chasingFielder !== fielder) {
                    console.log(`   Clearing previous chaser: ${this.fieldingSystem.chasingFielder.userData.description}`);
                    this.fieldingSystem.fielderStates.set(this.fieldingSystem.chasingFielder.userData.description, 'idle');
                }
                
                this.fieldingSystem.chasingFielder = fielder;
                this.attemptImmediatePickup(fielder, distance);
                return;
            }
        });
    }

    attemptCatch(fielder, distance) {
        // ✅ IMPROVED: Check if catch is already in progress
        if (this.fieldingSystem.catchingSystem.catchInProgress) {
            console.log(`⚠️ Catch already in progress by ${this.fieldingSystem.catchingSystem.catchingFielder?.userData?.description || 'unknown'}`);
            return;
        }
        
        // Mark catch in progress
        this.fieldingSystem.catchingSystem.catchInProgress = true;
        this.fieldingSystem.catchingSystem.catchingFielder = fielder;
        this.fieldingSystem.fielderStates.set(fielder.userData.description, 'catching');

        console.log(`🏃‍♂️ ${fielder.userData.description} attempting catch at ${distance.toFixed(1)}m distance!`);

        // Determine catch type based on distance
        const regularRadius = this.fieldingSystem.catchingSystem.regularCatchRadius;
        const divingRadius = this.fieldingSystem.catchingSystem.divingCatchRadius;
        
        let catchType = 'regularcatch';
        let catchAnimation = 'regularcatch.fbx';
        
        if (distance > divingRadius) {
            catchType = 'divingcatch';
            catchAnimation = 'divingcatch.fbx';
            console.log(`🤸‍♂️ ${fielder.userData.description} going for a diving catch!`);
        } else {
            console.log(`✋ ${fielder.userData.description} going for a regular catch!`);
        }

        // Load and play catch animation
        this.loadCharacterAnimation(fielder, catchAnimation, fielder.userData.description);
        
        setTimeout(() => {
            this.playCricketPlayerAnimation(fielder, catchType);
            
            // Determine catch success based on distance and ball speed
            setTimeout(() => {
                this.resolveCatch(fielder, distance, catchType);
            }, 800); // Give time for animation to play
            
        }, 100);
    }

    attemptImmediatePickup(fielder, distance) {
        console.log(`⚡ ${fielder.userData.description} picking up ball immediately! (${distance.toFixed(1)}m away)`);
        
        // Stop ball immediately - fielder picks it up
        this.ballPhysics.isMoving = false;
        this.ballPhysics.velocity.set(0, 0, 0);
        
        // Position ball in fielder's hands
        this.cricketBall.position.copy(fielder.position);
        this.cricketBall.position.y += 1.5;
        
        // Set fielder state to throwing
        this.fieldingSystem.fielderStates.set(fielder.userData.description, 'throwing');
        
        // Clear ball trail for clean visual
        this.clearBallTrail();
        
        // Complete the ball immediately since it's been fielded - but check for running batsman
        if (this.ballState.isActive && !this.ballState.isComplete) {
            this.ballState.ballType = 'fielded';
            this.ballState.completionReason = 'immediate_pickup';
            
            // Only complete immediately if batsman is NOT running (no run-out possible)
            if (!this.runningSystem.isRunning) {
                console.log('🔚 Batsman not running - completing ball immediately after pickup');
                setTimeout(() => {
                    this.completeBall();
                }, 500);
            } else {
                console.log('🏃‍♂️ Batsman still running - delaying ball completion for potential run-out after pickup');
                // Ball completion will happen in bowlerCatchBall() after run-out check
            }
        }
        
        // Start throwing back to bowler after brief delay
        setTimeout(() => {
            this.throwBallToBowler(fielder);
            setTimeout(() => {
                this.startFielderReturning(fielder);
            }, 1000);
        }, 1000);
    }

    resolveCatch(fielder, distance, catchType) {
        const ballSpeed = this.ballPhysics.velocity.length();
        
        // Calculate catch success probability
        let catchProbability = 1.0; // Start with 100% success
        
        // Reduce probability based on distance (ensure it never goes negative)
        const maxDistance = this.fieldingSystem.catchingSystem.catchRadius;
        const distanceFactor = Math.max(0, 1 - (distance / maxDistance));
        catchProbability *= distanceFactor;
        
        // Reduce probability based on ball speed
        const speedFactor = Math.max(0.3, 1 - (ballSpeed / 30)); // Harder to catch fast balls
        catchProbability *= speedFactor;
        
        // Diving catches are harder
        if (catchType === 'divingcatch') {
            catchProbability *= 0.7; // 30% harder for diving catches
        }
        
        // Ensure probability is always between 0 and 1
        catchProbability = Math.max(0, Math.min(1, catchProbability));
        
        // Determine success
        const isSuccessful = Math.random() < catchProbability;
        
        console.log(`📊 Catch probability: ${(catchProbability * 100).toFixed(1)}% (Distance: ${distance.toFixed(1)}m, Speed: ${ballSpeed.toFixed(1)}, Type: ${catchType})`);
        
        if (isSuccessful) {
            this.successfulCatch(fielder, catchType);
        } else {
            this.droppedCatch(fielder, catchType);
        }
    }

    successfulCatch(fielder, catchType) {
        console.log(`🎉 WICKET! ${fielder.userData.description} takes a spectacular ${catchType}!`);
        
        // Stop ball movement
        this.ballPhysics.isMoving = false;
        this.ballPhysics.velocity.set(0, 0, 0);
        
        // Position ball in fielder's hands
        this.cricketBall.position.copy(fielder.position);
        this.cricketBall.position.y += 1.5;
        
        // Set catch result
        this.fieldingSystem.catchingSystem.catchResult = 'success';
        
        // Clear ball trail for clean visual
        this.clearBallTrail();
        
        // ✅ NEW: Handle wicket scoring
        this.cricketScore.wickets += 1;
        console.log(`📊 Wicket taken! Score: ${this.cricketScore.runs}/${this.cricketScore.wickets}`);
        
        // ✅ NEW: Complete the ball immediately with wicket result
        if (this.ballState.isActive && !this.ballState.isComplete) {
            this.ballState.ballType = 'wicket';
            this.ballState.completionReason = 'caught';
            this.ballState.runsThisBall = this.runningSystem.runsCompleted; // Any runs completed before catch
            
            // Force complete the ball immediately (wicket has priority)
            setTimeout(() => {
                this.forceCompleteBall();
            }, 500);
        }
        
        // ✅ NEW: Show wicket notification
        this.showWicketNotification(fielder, catchType);
        
        // Celebrate animation could be added here
        setTimeout(() => {
            console.log(`✨ ${fielder.userData.description} celebrates the catch!`);
            this.resetCatchingSystem();
        }, 2000);
    }

    droppedCatch(fielder, catchType) {
        console.log(`😞 Oh no! ${fielder.userData.description} drops the ${catchType}! The ball continues...`);
        
        // Set catch result
        this.fieldingSystem.catchingSystem.catchResult = 'dropped';
        
        // Ball deflects when dropped (realistic behavior)
        this.ballPhysics.velocity.multiplyScalar(0.6); // Reduce speed by 40%
        
        // Add slight deflection from the drop
        const deflection = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 2,
            (Math.random() - 0.5) * 2
        );
        this.ballPhysics.velocity.add(deflection);
        
        // Reset the fielder who dropped the catch
        this.fieldingSystem.fielderStates.set(fielder.userData.description, 'returning');
        this.playCricketPlayerAnimation(fielder, 'standingidle');
        
        // ✅ NEW: Assign backup fielder for dropped catch
        console.log('🔄 Looking for backup fielder to chase the loose ball...');
        const backupAssigned = this.assignBackupFielder(fielder);
        
        // Reset catching system but keep fielding active if backup found
        this.resetCatchingSystem();
        
        if (backupAssigned) {
            console.log('🏃 Backup fielding activated - ball still in play!');
        } else {
            console.log('⚠️ No backup available - continuing with deflected ball');
        }
    }

    // ✅ NEW: Assign backup fielder when catch is dropped
    assignBackupFielder(droppedCatchFielder) {
        const ballPos = this.cricketBall.position;
        
        // Find closest available fielder (excluding the one who dropped it)
        let closestBackup = null;
        let closestDistance = Infinity;
        
        this.fielders.forEach(fielder => {
            // Skip the fielder who just dropped the catch
            if (fielder === droppedCatchFielder) return;
            
            // Only consider idle fielders
            const state = this.fieldingSystem.fielderStates.get(fielder.userData.description);
            if (state !== 'idle') return;
            
            const distance = fielder.position.distanceTo(ballPos);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestBackup = fielder;
            }
        });
        
        if (closestBackup && closestDistance <= 30) { // Within reasonable backup range
            console.log(`🆘 ${closestBackup.userData.description} backing up the dropped catch (${closestDistance.toFixed(1)}m away)`);
            
            // Set as new chasing fielder
            this.fieldingSystem.chasingFielder = closestBackup;
            this.fieldingSystem.fielderStates.set(closestBackup.userData.description, 'chasing');
            
            // Start chasing immediately
            this.startFielderChasing(closestBackup);
            
            // ✅ NEW: Set a target position slightly ahead of the ball for better interception
            if (this.ballPhysics.isMoving) {
                const ballVelocity = this.ballPhysics.velocity.clone();
                const predictedPos = ballPos.clone().add(ballVelocity.multiplyScalar(1.0)); // 1 second ahead
                closestBackup.userData.targetPosition = predictedPos;
                console.log(`🎯 ${closestBackup.userData.description} targeting predicted position ahead of ball`);
            }
            
            return true;
        } else {
            console.log('⚠️ No suitable backup fielder found within range');
            
            // If no backup available, complete the ball after a delay
            setTimeout(() => {
                if (this.ballState.isActive && !this.ballState.isComplete) {
                    console.log('🔚 No backup fielder available - completing ball');
                    this.completeBall();
                }
            }, 2000);
            
            return false;
        }
    }

    resetCatchingSystem() {
        const catching = this.fieldingSystem.catchingSystem;
        
        // Reset catching fielder state to idle
        if (catching.catchingFielder) {
            this.fieldingSystem.fielderStates.set(catching.catchingFielder.userData.description, 'idle');
            
            // Clear any interception data
            catching.catchingFielder.userData.interceptTarget = null;
            catching.catchingFielder.userData.interceptStartTime = null;
            catching.catchingFielder.userData.interceptTravelTime = null;
            catching.catchingFielder.userData.interceptArrivalTime = null;
            catching.catchingFielder.userData.interceptionData = null;
            
            // Return to original position if catch was successful
            if (catching.catchResult === 'success') {
                this.startFielderReturning(catching.catchingFielder);
            }
        }
        
        // ✅ NEW: Clear hybrid system task if it's a catch task
        if (this.fieldingSystem.currentTask && this.fieldingSystem.currentTask.mode === 'catch') {
            this.fieldingSystem.currentTask = null;
        }
        
        // Reset catching system
        catching.catchInProgress = false;
        catching.catchingFielder = null;
        catching.catchResult = null;
        
        console.log('🔄 Catching system reset');
    }

    resetFieldingSystem() {
        console.log('🔄 Resetting hybrid fielding system...');
        
        // Reset fielding states
        this.fieldingSystem.ballIsHit = false;
        this.fieldingSystem.nearestFielder = null;
        this.fieldingSystem.chasingFielder = null;
        
        // ✅ NEW: Clear hybrid system state
        this.fieldingSystem.currentTask = null;
        this.fieldingSystem.nextSelectionTime = 0;
        
        // Return all fielders to their original positions and idle state
        this.fielders.forEach(fielder => {
            if (fielder.userData && fielder.userData.description) {
                // Reset state to idle
                this.fieldingSystem.fielderStates.set(fielder.userData.description, 'idle');
                
                // Clear all fielding data
                fielder.userData.isRunningForAnticipation = false;
                fielder.userData.chaseStartTime = null;
                fielder.userData.interceptTarget = null;
                fielder.userData.interceptStartTime = null;
                fielder.userData.targetPosition = null;
                fielder.userData.lastHandoverTime = 0; // Clear handover time
                
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
        
        console.log('✅ Hybrid fielding system reset - all fielders back to original positions and idle');
    }

    // Scoring methods
    updateCricketScore() {
        // Update score display using existing menu system
        if (window.menuSystem && window.menuSystem.updateScore) {
            // Update basic score
            window.menuSystem.updateScore(
                this.cricketScore.runs,
                this.cricketScore.wickets,
                this.cricketScore.overs.toFixed(1)
            );
            
            // Update target info if chase is active
            if (this.targetSystem.isActive) {
                this.updateTargetDisplay();
            }
        } else {
            console.warn(`⚠️ Cannot update score display - menu system not available`);
        }
        
        // Update 3D scoreboards
        this.update3DScoreboards();
        
        console.log(`📊 Score updated: ${this.cricketScore.runs}/${this.cricketScore.wickets} in ${this.cricketScore.overs.toFixed(1)} overs`);
    }

    updateTargetDisplay() {
        // Create or update target display in the UI
        let targetDisplay = document.getElementById('targetDisplay');
        
        if (!targetDisplay) {
            // Create target display element
            targetDisplay = document.createElement('div');
            targetDisplay.id = 'targetDisplay';
            targetDisplay.style.cssText = `
                position: fixed;
                top: 120px;
                right: 20px;
                background: rgba(10, 10, 26, 0.95);
                border: 2px solid rgba(116, 144, 255, 0.6);
                border-radius: 15px;
                padding: 15px 25px;
                color: white;
                font-family: 'Orbitron', Arial, sans-serif;
                z-index: 150;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                min-width: 250px;
                text-align: center;
            `;
            
            // Add to in-game UI
            const inGameUI = document.getElementById('inGameUI');
            if (inGameUI) {
                inGameUI.appendChild(targetDisplay);
            } else {
                document.body.appendChild(targetDisplay);
            }
        }
        
        // Update target display content
        this.updateTargetStats();
        
        const runsColor = this.targetSystem.runsNeeded <= 10 ? '#4caf50' : 
                         this.targetSystem.runsNeeded <= 20 ? '#ff9800' : '#f44336';
        const ballsColor = this.targetSystem.ballsRemaining <= 3 ? '#f44336' : 
                          this.targetSystem.ballsRemaining <= 6 ? '#ff9800' : '#4caf50';
        
        targetDisplay.innerHTML = `
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #7490ff;">
                🎯 TARGET CHASE
            </div>
            <div style="font-size: 20px; font-weight: 700; margin-bottom: 5px;">
                Need <span style="color: ${runsColor};">${this.targetSystem.runsNeeded}</span> runs
            </div>
            <div style="font-size: 16px; margin-bottom: 8px;">
                from <span style="color: ${ballsColor};">${this.targetSystem.ballsRemaining}</span> balls
            </div>
            <div style="font-size: 14px; opacity: 0.9; border-top: 1px solid rgba(116, 144, 255, 0.3); padding-top: 8px;">
                Required Rate: <span style="color: #a0c4ff; font-weight: 600;">${this.targetSystem.requiredRunRate.toFixed(2)}</span>
            </div>
        `;
    }

    // Start a new ball
    startNewBall() {
        if (this.ballState.isActive) {
            return;
        }
        
        this.ballState.isActive = true;
        this.ballState.isComplete = false;
        this.ballState.runsThisBall = 0;
        this.ballState.ballType = 'normal';
        this.ballState.completionReason = null;
        
        this.runningSystem.runsCompleted = 0;
        this.runningSystem.isRunning = false;
        this.runningSystem.runState = 'idle';
        this.runningSystem.currentEnd = 'batsman';
        this.runningSystem.targetEnd = 'bowler';
        this.runningSystem.runProgress = 0;
        this.runningSystem.waitingForNextRun = false;
        
        this.bowlerReceivingSystem.isReceivingThrow = false;
        
        this.resetBallTracking();
        
        console.log('🏏 New ball started');
    }

    // Force complete the ball (used when bowler catches - has priority)
    forceCompleteBall() {
        if (!this.ballState.isActive) {
            console.log('⚠️ Force ball completion blocked - ball not active');
            return;
        }
        console.log('🔨 Force completing ball (e.g., bowler catch has priority)');
        this.doCompleteBall();
    }

    // Complete the current ball
    completeBall() {
        if (!this.ballState.isActive || this.ballState.isComplete) {
            if (this.ballState.isComplete) {
                 console.log('⚠️ Ball completion blocked - already completed');
            } else {
                 console.log('⚠️ Ball completion blocked - ball not active');
            }
            return;
        }
        this.doCompleteBall();
    }
    
    // Internal method that actually completes the ball
    doCompleteBall() {
        // The PRIMARY check to prevent multiple completions.
        if (this.ballState.isComplete) {
            console.log('⚠️ Ball completion blocked - already completed.');
            return;
        }

        // SET state immediately to lock this function.
        this.ballState.isComplete = true; 
        this.ballState.isActive = false; // The ball is no longer active.
        
        // ✅ IMPROVED: Handle wickets vs runs properly
        if (this.ballState.ballType === 'wicket') {
            // For wickets, runs were already set by successfulCatch, and wicket count was already incremented
            console.log(`🎯 Completing wicket ball: ${this.ballState.runsThisBall} runs (wicket already counted)`);
            
            // ✅ FIXED: Update dismissed batsman's balls faced BEFORE promoting next batsman
            const dismissedBatsman = this.battingTeam.players[this.battingTeam.currentBatsman];
            dismissedBatsman.ballsFaced++;
            console.log(`📊 ${dismissedBatsman.name}: WICKET (${dismissedBatsman.ballsFaced} balls) - updating BEFORE promotion`);
            
            // ✅ NEW: Record dismissal for scorecard (this will promote next batsman)
            if (this.ballState.completionReason === 'run_out') {
                this.recordDismissal('run out');
            } else if (this.ballState.completionReason === 'caught') {
                this.recordDismissal('caught');
            } else {
                this.recordDismissal('bowled'); // Default for other wickets
            }
        } else {
            // For non-wicket balls, set runs normally
            if (!this.cricketScore.boundaryAwarded) {
                this.ballState.runsThisBall = this.runningSystem.runsCompleted;
            }
            console.log(`🎯 Completing ball: ${this.ballState.runsThisBall} runs (${this.ballState.ballType})`);
            
            // ✅ NEW: Update individual batsman stats for non-wicket balls
            this.updateCurrentBatsmanStats(this.ballState.runsThisBall);
        }
        
        console.log(`🔍 Before adding runs - Current total: ${this.cricketScore.runs}/${this.cricketScore.wickets}`);
        
        // ✅ NEW: Handle batsmen swapping on odd runs (1, 3, 5 runs)
        if (this.ballState.runsThisBall % 2 === 1 && this.ballState.ballType !== 'wicket') {
            console.log(`🏃 Odd runs scored (${this.ballState.runsThisBall}) - batsmen will change ends`);
            this.swapBatsmen();
        }

        // STOP running system to prevent continuous updates
        this.runningSystem.isRunning = false;
        this.runningSystem.runState = 'idle';
        
        // Add runs from this ball to total score
        this.cricketScore.runs += this.ballState.runsThisBall;
        this.cricketScore.balls++;

        // Simplified and corrected overs calculation
        const completedOvers = Math.floor(this.cricketScore.balls / 6);
        const ballsInCurrentOver = this.cricketScore.balls % 6;
        this.cricketScore.overs = completedOvers + (ballsInCurrentOver / 10.0);
        
        // ✅ NEW: Swap batsmen at the end of each over (every 6 balls)
        if (ballsInCurrentOver === 0 && this.cricketScore.balls > 0) {
            console.log(`🏏 Over completed (${completedOvers} overs)! Batsmen changing ends for next over.`);
            this.swapBatsmen();
        }
       
        console.log(`🔍 After adding runs - New total: ${this.cricketScore.runs}/${this.cricketScore.wickets} (added ${this.ballState.runsThisBall} runs)`);
        
        // Update score display
        this.updateCricketScore();
        
        // ✅ NEW: Update scorecard if visible
        if (this.scorecardUI.isVisible) {
            this.updateScorecardDisplay();
        }
        
        // Show ball completion summary (skip for wickets - they already have specific notifications)
        if (this.ballState.ballType !== 'wicket') {
            this.showBallSummary(this.ballState.runsThisBall, this.ballState.ballType);
        }
        
        // Reset players for the next ball
        setTimeout(() => {
            this.resetPlayersForNextBall();
        }, 2000);
        
        console.log(`✅ Ball completed: ${this.ballState.runsThisBall} runs (${this.ballState.ballType})`);
        
        // ✅ NEW: Check target chase conditions after each ball
        if (this.targetSystem.isActive) {
            this.checkTargetChaseConditions();
        }
        
        // Check multiplayer innings end conditions
        if (this.multiplayerSystem.isActive) {
            this.checkMultiplayerInningsEnd();
        }
        
        // ✅ NEW: Initialize AI Bowler for next ball (with 3-second delay)
        setTimeout(() => {
            this.initializeAIBowler();
        }, this.aiBowler.autoBowlDelay);
    }

    // Show ball completion summary
    showBallSummary(runs, ballType) {
        // ✅ IMPROVED: Handle wickets properly
        let summaryText;
        let ballTypeText = '';
        let titleText = 'Ball Complete';
        let borderColor = '#4ecdc4';
        
        if (ballType === 'wicket') {
            titleText = 'WICKET!';
            if (this.ballState.completionReason === 'run_out') {
                summaryText = runs === 0 ? 'RUN OUT!' : 
                             runs === 1 ? 'RUN OUT! (1 run scored)' : 
                             `RUN OUT! (${runs} runs scored)`;
                ballTypeText = ' (Caught short!)';
                borderColor = '#ff6b35'; // Orange border for run-outs
            } else {
                summaryText = runs === 0 ? 'Wicket taken!' : 
                             runs === 1 ? 'Wicket taken (1 run scored)' : 
                             `Wicket taken (${runs} runs scored)`;
                ballTypeText = ' (Caught!)';
                borderColor = '#ff4444'; // Red border for catches
            }
        } else {
            summaryText = runs === 0 ? 'No runs' : 
                         runs === 1 ? '1 run' : 
                         `${runs} runs`;
            
            ballTypeText = ballType === 'boundary' ? ' (Boundary!)' : 
                          ballType === 'fielded' ? ' (Fielded)' : 
                          ballType === 'normal' ? '' : '';
        }
        
        // Create summary notification
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                font-family: Arial, sans-serif;
                text-align: center;
                z-index: 1000;
                font-size: 18px;
                border: 2px solid ${borderColor};
                ${ballType === 'wicket' ? 'animation: pulse 0.5s ease-in-out;' : ''}
            ">
                <h3 style="margin: 0 0 10px 0; ${ballType === 'wicket' ? 'color: #ff4444;' : ''}">${titleText}</h3>
                <p style="margin: 0;">${summaryText}${ballTypeText}</p>
                <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.8;">Total: ${this.cricketScore.runs}/${this.cricketScore.wickets}</p>
            </div>
            <style>
                @keyframes pulse {
                    0% { transform: translateX(-50%) scale(1); }
                    50% { transform: translateX(-50%) scale(1.05); }
                    100% { transform: translateX(-50%) scale(1); }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after longer time for wickets
        const displayTime = ballType === 'wicket' ? 4000 : 3000;
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, displayTime);
    }

    // Reset players to initial positions for next ball
    resetPlayersForNextBall() {
        console.log('🔄 Resetting all players for next ball...');
        
        // Reset batsman to initial position
        if (this.character) {
            this.character.position.set(0, 0, 9);
            this.character.rotation.set(0, 0, 0);
            this.character.lookAt(10, 0, 10); // Face bowler
            
            // ✅ CRITICAL FIX: Stop any running animations in cricket team system first
            // This prevents running animations from continuing when we try to set idle
            if (this.character.userData && this.character.userData.currentAction) {
                console.log('🛑 Stopping current cricket team animation before reset');
                this.character.userData.currentAction.stop();
                this.character.userData.currentAction = null;
                this.character.userData.currentAnimationName = null;
            }
            
            // ✅ FIXED: Always use main character animation system for consistency with hitting animations
            // This ensures the same system used by playHittingAnimation() is used for resets
            if (this.characterAnimations && this.animationMixer) {
                // Try different idle animation names in order of preference
                const idleAnimNames = ['standingidle', 'fbx_0', 'idling', 'idle'];
                let idleSet = false;
                
                for (let animName of idleAnimNames) {
                    if (this.characterAnimations.has(animName)) {
                        console.log(`🔄 Setting batsman to ${animName} animation for next ball`);
                        this.playAnimation(animName);
                        idleSet = true;
                        break;
                    }
                }
                
                if (!idleSet) {
                    console.log('⚠️ No idle animation found in main character system');
                    // Fallback to cricket team system only if main system fails completely
                    if (this.character.userData && this.character.userData.animations && this.character.userData.animations.size > 0) {
                        console.log('🔄 Using cricket team system as emergency fallback');
                        const fallbackAnim = Array.from(this.character.userData.animations.keys())[0];
                        this.playCricketPlayerAnimation(this.character, fallbackAnim);
                    }
                }
            } else {
                console.log('⚠️ Main character animation system not available - using cricket team system');
                // Only use cricket team system if main system is completely unavailable
                if (this.character.userData && this.character.userData.animations) {
                    if (this.character.userData.animations.has('standingidle')) {
                        this.playCricketPlayerAnimation(this.character, 'standingidle');
                    } else if (this.character.userData.animations.has('fbx_0')) {
                        this.playCricketPlayerAnimation(this.character, 'fbx_0');
                    } else if (this.character.userData.animations.has('idling')) {
                        this.playCricketPlayerAnimation(this.character, 'idling');
                    } else {
                        console.log('⚠️ No idle animation available in any system');
                    }
                }
            }
        }
        
        // Reset bowler to original position
        if (this.bowler) {
            this.bowler.position.set(1, 0, -9); // Bowler's end
            this.bowler.rotation.set(0, 0, 0);
            this.bowler.lookAt(0, 0, 10); // Face batsman
            this.playCricketPlayerAnimation(this.bowler, 'standingidle');
            
            // Reset bowler catch zone position
            if (this.bowlerReceivingSystem.catchZone) {
                this.bowlerReceivingSystem.catchZone.position.copy(this.bowler.position);
                this.bowlerReceivingSystem.catchZone.position.y += 1.5;
            }
        }
        
        // Reset ball to initial position
        if (this.cricketBall) {
            this.cricketBall.position.set(0, 0.035, 0);
            this.ballPhysics.velocity.set(0, 0, 0);
            this.ballPhysics.isMoving = false;
        }
        
        // Clear ball trail completely
        this.clearBallTrail();
        
        // Reset fielders to original positions (which now includes custom positions)
        if (this.fielders) {
            this.fielders.forEach(fielder => {
                const originalPos = this.fieldingSystem.fielderOriginalPositions.get(fielder.userData.description);
                if (originalPos) {
                    fielder.position.set(originalPos.x, originalPos.y, originalPos.z);
                    fielder.rotation.set(0, 0, 0);
                    fielder.lookAt(0, 0, 5); // Face batsman
                    
                    console.log(`🔄 Reset ${fielder.userData.description} to position (${originalPos.x.toFixed(1)}, ${originalPos.z.toFixed(1)})`);
                    
                    // Clear all fielding flags
                    fielder.userData.isRunningForAnticipation = false;
                    fielder.userData.chaseStartTime = null;
                    fielder.userData.interceptTarget = null;
                    fielder.userData.interceptStartTime = null;
                    fielder.userData.targetPosition = null;
                    
                    this.playCricketPlayerAnimation(fielder, 'standingidle');
                }
            });
        }
        
        // Reset ball state completely
        this.ballState.isActive = false;
        this.ballState.isComplete = false;
        this.ballState.runsThisBall = 0;
        this.ballState.ballType = 'normal';
        this.ballState.completionReason = null;
        
        // ✅ CRITICAL FIX: Reset bat swing system completely
        // This ensures no lingering swing state interferes with next ball's hitting animation
        this.batSwing.isSwinging = false;
        this.batSwing.swingDirection.set(0, 0, 0);
        this.batSwing.swingPower = 0;
        this.batSwing.swingStartTime = 0;
        this.batSwing.batSpeed = 0;
        this.batSwing.shotType = 'straight';
        this.batSwing.timing = 'perfect';
        console.log('🔄 Bat swing system reset for next ball');
        
        // ✅ CRITICAL FIX: Reset running system completely
        // This ensures no lingering running animations or states interfere with idle animations
        this.runningSystem.isRunning = false;
        this.runningSystem.runState = 'idle';
        this.runningSystem.currentEnd = 'batsman';
        this.runningSystem.targetEnd = 'bowler';
        this.runningSystem.runProgress = 0;
        this.runningSystem.runsCompleted = 0;
        this.runningSystem.turningAtEnd = false;
        this.runningSystem.waitingForNextRun = false;
        console.log('🔄 Running system completely reset for next ball');
        
        // Reset bowler receiving system
        this.bowlerReceivingSystem.isReceivingThrow = false;
        
        console.log('🔄 Players reset for next ball');
    }

    handleBoundaryScoring() {
        if (this.cricketScore.boundaryAwarded) return;

        // ✅ CRICKET RULES: Only award boundary runs if ball was hit by batsman
        if (!this.cricketScore.ballHasBeenHit) {
            console.log('🚫 Ball crossed boundary but was NOT hit by batsman - no runs awarded');
            
            // Stop ball physics and complete as dot ball
            this.ballPhysics.isMoving = false;
            this.ballPhysics.velocity.set(0, 0, 0);
            
            if (this.ballState.isActive && !this.ballState.isComplete) {
                this.ballState.ballType = 'fielded';
                this.ballState.completionReason = 'missed_boundary';
                this.ballState.runsThisBall = 0; // No runs for unhit ball
                
                setTimeout(() => {
                    this.completeBall();
                }, 500);
            }
            return;
        }

        const ballDistance = Math.sqrt(
            this.cricketBall.position.x ** 2 + 
            this.cricketBall.position.z ** 2
        );
        
        const boundaryDistance = this.FIELD_RADIUS - 2;
        
        if (ballDistance > boundaryDistance) {
            let boundaryRuns = 0;
            let boundaryType = '';
            
            // ✅ CRICKET RULES: Proper 4 vs 6 determination
            // SIX: Ball crosses boundary without EVER touching ground during flight
            // FOUR: Ball touches ground anywhere during flight OR reaches boundary on ground
            const ballHeight = this.cricketBall.position.y;
            const isCurrentlyGrounded = ballHeight <= 0.2; // Ball is on/near ground at boundary
            
            if (this.cricketScore.ballHasBounced || isCurrentlyGrounded) {
                boundaryRuns = 4;
                boundaryType = 'FOUR';
                if (this.cricketScore.ballHasBounced && !isCurrentlyGrounded) {
                    console.log(`🏏 FOUR! Ball bounced during flight (now airborne at ${ballHeight.toFixed(2)}m height)`);
                    console.log(`   📝 Bounce flag: ${this.cricketScore.ballHasBounced}, Currently grounded: ${isCurrentlyGrounded}`);
                } else {
                    console.log(`🏏 FOUR! Ball ${isCurrentlyGrounded ? 'reached boundary on ground' : 'bounced earlier'} (height: ${ballHeight.toFixed(2)})`);
                }
            } else {
                boundaryRuns = 6;
                boundaryType = 'SIX';
                console.log(`🚀 SIX! Ball crossed boundary in air without touching ground (height: ${ballHeight.toFixed(2)})`);
                console.log(`   📝 Bounce flag: ${this.cricketScore.ballHasBounced}, Currently grounded: ${isCurrentlyGrounded}`);
            }

            this.cricketScore.boundaryAwarded = true; 
            
            this.ballState.runsThisBall = boundaryRuns;
            this.ballState.ballType = 'boundary';
            this.ballState.completionReason = 'boundary';
            
            console.log(`🎯 ${boundaryType}! ${boundaryRuns} runs scored`);
            
            this.showBoundaryNotification(boundaryType, boundaryRuns);
            
            this.fieldingSystem.ballIsHit = false;
            this.fieldingSystem.chasingFielder = null;
            this.runningSystem.isRunning = false; 
            
            if (this.ballState.isActive && !this.ballState.isComplete) {
                setTimeout(() => {
                    this.completeBall();
                }, 2000);
            }
        }
    }

    checkBallBounce() {
        if (this.cricketBall.position.y <= 0.1 && !this.cricketScore.ballHasBounced) {
            // ✅ CRICKET RULES FIX: Only check bounces AFTER ball has been hit
            // Natural bounces during delivery (on pitch) should NOT affect boundary scoring
            if (!this.cricketScore.ballHasBeenHit) {
                console.log(`🏐 Ball bounced during delivery (natural pitch bounce) - doesn't affect boundary scoring`);
                return;
            }
            
            const ballDistance = Math.sqrt(
                this.cricketBall.position.x ** 2 + 
                this.cricketBall.position.z ** 2
            );
            
            const boundaryDistance = this.FIELD_RADIUS - 2; // ~68m
            
            // ✅ CRICKET RULES: Only bounces INSIDE the field count toward FOUR
            // Bounces outside field boundary don't affect scoring (ball already crossed for SIX)
            if (ballDistance < boundaryDistance) {
                this.cricketScore.ballHasBounced = true;
                console.log(`🏐 Ball bounced AFTER being hit at ${ballDistance.toFixed(1)}m from center - will be FOUR if boundary crossed`);
            } else {
                console.log(`🚀 Ball bounced OUTSIDE field (${ballDistance.toFixed(1)}m) - doesn't affect boundary scoring (SIX potential maintained)`);
            }
        }
    }

    showBoundaryNotification(type, runs) {
        // Create temporary notification element
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #ff6b6b, #4ecdc4);
                color: white;
                padding: 30px;
                border-radius: 15px;
                font-family: Arial, sans-serif;
                text-align: center;
                z-index: 1000;
                font-size: 24px;
                font-weight: bold;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            ">
                <h2 style="margin: 0 0 10px 0;">${type}!</h2>
                <p style="margin: 0;">+${runs} runs</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Target Chase System Methods
    startTargetChase(targetRuns = null, maxOvers = 2.0) {
        // Generate random target if none provided (realistic range for 2 overs)
        if (targetRuns === null) {
            targetRuns = Math.floor(Math.random() * 20) + 15; // 15-34 runs target
        }
        
        this.targetSystem.isActive = true;
        this.targetSystem.targetRuns = targetRuns;
        this.targetSystem.maxOvers = maxOvers;
        this.targetSystem.maxBalls = Math.floor(maxOvers * 6);
        this.targetSystem.runsNeeded = targetRuns;
        this.targetSystem.ballsRemaining = this.targetSystem.maxBalls;
        this.targetSystem.oversRemaining = maxOvers;
        this.targetSystem.requiredRunRate = this.calculateRequiredRunRate();
        this.targetSystem.gameStatus = 'playing';
        this.targetSystem.gameOverReason = null;
        
        // Reset game score for fresh chase
        this.cricketScore.runs = 0;
        this.cricketScore.wickets = 0;
        this.cricketScore.overs = 0;
        this.cricketScore.balls = 0;
        this.cricketScore.ballHasBeenHit = false; // ✅ Reset hit flag for new chase
        
        console.log(`🎯 TARGET CHASE STARTED! Need ${targetRuns} runs in ${maxOvers} overs (${this.targetSystem.maxBalls} balls)`);
        console.log(`📊 Required run rate: ${this.targetSystem.requiredRunRate.toFixed(2)} per over`);
        
        this.showTargetNotification();
        this.updateCricketScore();
        
        // Initialize AI Bowler for target chase mode
        setTimeout(() => {
            console.log('🤖 Initializing AI Bowler for target chase first ball...');
            this.initializeAIBowler();
        }, 2000); // Give time for UI to settle
    }

    checkTargetChaseConditions() {
        if (!this.targetSystem.isActive || this.targetSystem.gameStatus !== 'playing') {
            return;
        }

        // Update chase statistics
        this.updateTargetStats();

        // Check win condition - target achieved
        if (this.cricketScore.runs >= this.targetSystem.targetRuns) {
            this.targetSystem.gameStatus = 'won';
            this.targetSystem.gameOverReason = 'target_achieved';
            console.log(`🏆 TARGET ACHIEVED! Won by ${10 - this.cricketScore.wickets} wickets with ${this.targetSystem.ballsRemaining} balls remaining!`);
            this.showGameOverScreen('won', `Target achieved with ${this.targetSystem.ballsRemaining} balls remaining!`);
            return;
        }

        // Check lose conditions
        
        // 1. All overs completed without reaching target
        if (this.targetSystem.ballsRemaining <= 0) {
            this.targetSystem.gameStatus = 'lost';
            this.targetSystem.gameOverReason = 'overs_completed';
            const shortfall = this.targetSystem.targetRuns - this.cricketScore.runs;
            console.log(`💀 OVERS COMPLETED! Lost by ${shortfall} runs`);
            this.showGameOverScreen('lost', `Failed by ${shortfall} runs`);
            return;
        }

        // 2. All wickets lost (assuming 10 wickets to lose)
        if (this.cricketScore.wickets >= 10) {
            this.targetSystem.gameStatus = 'lost';
            this.targetSystem.gameOverReason = 'all_out';
            const shortfall = this.targetSystem.targetRuns - this.cricketScore.runs;
            console.log(`💀 ALL OUT! Lost by ${shortfall} runs`);
            this.showGameOverScreen('lost', `All out! Failed by ${shortfall} runs`);
            return;
        }

        // 3. Mathematically impossible (need more runs than possible from remaining balls)
        const maxPossibleRuns = this.targetSystem.ballsRemaining * 6; // Assume max 6 runs per ball
        if (this.targetSystem.runsNeeded > maxPossibleRuns) {
            this.targetSystem.gameStatus = 'lost';
            this.targetSystem.gameOverReason = 'impossible';
            console.log(`💀 MATHEMATICALLY IMPOSSIBLE! Need ${this.targetSystem.runsNeeded} but only ${maxPossibleRuns} possible`);
            this.showGameOverScreen('lost', `Target mathematically impossible!`);
            return;
        }

        console.log(`📊 Chase update: Need ${this.targetSystem.runsNeeded} from ${this.targetSystem.ballsRemaining} balls (RRR: ${this.targetSystem.requiredRunRate.toFixed(2)})`);
    }

    updateTargetStats() {
        this.targetSystem.runsNeeded = this.targetSystem.targetRuns - this.cricketScore.runs;
        this.targetSystem.ballsRemaining = this.targetSystem.maxBalls - this.cricketScore.balls;
        this.targetSystem.oversRemaining = this.targetSystem.maxOvers - this.cricketScore.overs;
        this.targetSystem.requiredRunRate = this.calculateRequiredRunRate();
    }

    calculateRequiredRunRate() {
        if (this.targetSystem.oversRemaining <= 0) return 0;
        return (this.targetSystem.runsNeeded / this.targetSystem.oversRemaining);
    }

    showTargetNotification() {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 10%;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, rgba(116, 144, 255, 0.95) 0%, rgba(116, 144, 255, 0.8) 100%);
                color: white;
                padding: 25px;
                border-radius: 15px;
                font-family: 'Orbitron', Arial, sans-serif;
                text-align: center;
                z-index: 1500;
                font-size: 20px;
                border: 3px solid #7490ff;
                box-shadow: 0 0 30px rgba(116, 144, 255, 0.6);
                animation: targetPulse 0.8s ease-in-out;
            ">
                <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 28px;">🎯 TARGET CHASE</h2>
                <p style="margin: 0 0 10px 0; font-size: 24px; font-weight: bold;">Need ${this.targetSystem.targetRuns} runs</p>
                <p style="margin: 0 0 10px 0; font-size: 18px;">in ${this.targetSystem.maxOvers} overs (${this.targetSystem.maxBalls} balls)</p>
                <p style="margin: 0; font-size: 16px; opacity: 0.9;">Required Rate: ${this.targetSystem.requiredRunRate.toFixed(2)} per over</p>
            </div>
            <style>
                @keyframes targetPulse {
                    0% { transform: translateX(-50%) scale(0.8); opacity: 0; }
                    50% { transform: translateX(-50%) scale(1.05); opacity: 1; }
                    100% { transform: translateX(-50%) scale(1); opacity: 1; }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }

    showGameOverScreen(result, message) {
        const isWon = result === 'won';
        const notification = document.createElement('div');
        
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                backdrop-filter: blur(10px);
            ">
                <div style="
                    background: ${isWon ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.95) 0%, rgba(139, 195, 74, 0.9) 100%)' : 'linear-gradient(135deg, rgba(244, 67, 54, 0.95) 0%, rgba(255, 87, 34, 0.9) 100%)'};
                    color: white;
                    padding: 40px;
                    border-radius: 20px;
                    font-family: 'Orbitron', Arial, sans-serif;
                    text-align: center;
                    border: 3px solid ${isWon ? '#4caf50' : '#f44336'};
                    box-shadow: 0 0 50px ${isWon ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)'};
                    animation: gameOverPulse 1s ease-in-out;
                    max-width: 600px;
                    margin: 20px;
                ">
                    <h1 style="margin: 0 0 20px 0; font-size: 42px; font-weight: 900;">
                        ${isWon ? '🏆 VICTORY!' : '💀 GAME OVER'}
                    </h1>
                    <h2 style="margin: 0 0 15px 0; font-size: 24px; opacity: 0.9;">
                        ${message}
                    </h2>
                    <div style="background: rgba(0, 0, 0, 0.3); padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0; font-size: 18px;">Final Score</h3>
                        <p style="margin: 0; font-size: 20px; font-weight: bold;">
                            ${this.cricketScore.runs}/${this.cricketScore.wickets} (${this.cricketScore.overs.toFixed(1)} overs)
                        </p>
                        <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.8;">
                            Target: ${this.targetSystem.targetRuns} runs
                        </p>
                    </div>
                    <button onclick="window.restartTargetChase()" style="
                        background: rgba(116, 144, 255, 0.9);
                        border: 2px solid rgba(116, 144, 255, 1);
                        color: white;
                        padding: 15px 30px;
                        border-radius: 10px;
                        font-size: 18px;
                        font-weight: 600;
                        cursor: pointer;
                        margin-right: 15px;
                        font-family: inherit;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='rgba(116, 144, 255, 1)'" onmouseout="this.style.background='rgba(116, 144, 255, 0.9)'">
                        🔄 Play Again
                    </button>
                    <button onclick="window.quitToMenu()" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 2px solid rgba(255, 255, 255, 0.3);
                        color: white;
                        padding: 15px 30px;
                        border-radius: 10px;
                        font-size: 18px;
                        font-weight: 600;
                        cursor: pointer;
                        font-family: inherit;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">
                        🏠 Main Menu
                    </button>
                </div>
            </div>
            <style>
                @keyframes gameOverPulse {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        // Store reference for potential cleanup
        this.gameOverScreen = notification;
    }

    resetTargetChase() {
        this.targetSystem.isActive = false;
        this.targetSystem.gameStatus = 'playing';
        this.targetSystem.gameOverReason = null;
        
        // Remove game over screen if present
        if (this.gameOverScreen && this.gameOverScreen.parentNode) {
            this.gameOverScreen.parentNode.removeChild(this.gameOverScreen);
            this.gameOverScreen = null;
        }
        
        console.log('🔄 Target chase reset');
    }

    resetBallTracking() {
        this.cricketScore.ballHasBounced = false;
        this.cricketScore.boundaryAwarded = false;
        this.cricketScore.ballHasBeenHit = false; // ✅ Reset hit flag for new ball
    }
    
    resetGame() {
        // Reset scores
        this.cricketScore.runs = 0;
        this.cricketScore.wickets = 0;
        this.cricketScore.overs = 0;
        this.cricketScore.balls = 0;
        
        // Reset ball tracking
        this.resetBallTracking();
        
        // Reset ball state
        this.ballState.isActive = false;
        this.ballState.isComplete = false;
        this.ballState.runsThisBall = 0;
        
        // Reset target system
        this.targetSystem.isActive = false;
        this.targetSystem.gameStatus = 'playing';
        
        // Reset multiplayer system
        this.multiplayerSystem.currentInnings = 1;
        this.multiplayerSystem.firstInningsScore = 0;
        this.multiplayerSystem.firstInningsWickets = 0;
        this.multiplayerSystem.gameStatus = 'playing';
        this.multiplayerSystem.matchWinner = null;
        
        // Clear any AI bowler timers
        this.clearAIBowlerTimers();
        
        // Update displays
        this.updateCricketScore();
        
        console.log('🔄 Game reset complete');
    }

    resetForNewGame() {
        console.log('🔄 Resetting game for new mode...');
        
        // Call the existing reset game method
        this.resetGame();
        
        // Reset game mode flags
        this.gameMode = null;
        
        // Reset batting team if exists
        if (this.battingTeam) {
            // Reset all player stats
            this.battingTeam.players.forEach(player => {
                player.runs = 0;
                player.ballsFaced = 0;
                player.dismissal = null;
                player.isOut = false;
            });
            
            // Reset team position
            this.battingTeam.currentBatsman = 0;
            this.battingTeam.currentPartner = 1;
            
            // Reset extras
            this.battingTeam.extras = {
                byes: 0,
                legByes: 0,
                wides: 0,
                noBalls: 0,
                penalties: 0
            };
        }
        
        // Reset running system
        this.runningSystem.isRunning = false;
        this.runningSystem.runState = 'idle';
        this.runningSystem.currentEnd = 'batsman';
        this.runningSystem.targetEnd = 'bowler';
        this.runningSystem.runProgress = 0;
        this.runningSystem.runsCompleted = 0;
        this.runningSystem.turningAtEnd = false;
        this.runningSystem.waitingForNextRun = false;
        
        // Reset fielding system
        this.fieldingSystem.ballIsHit = false;
        this.fieldingSystem.nearestFielder = null;
        this.fieldingSystem.chasingFielder = null;
        
        // Reset ball physics
        this.ballPhysics.velocity.set(0, 0, 0);
        this.ballPhysics.isMoving = false;
        
        // Position ball at bowler's end
        if (this.cricketBall) {
            this.cricketBall.position.set(0, 1, -11);
        }
        
        // Reset character to batting position
        if (this.character) {
            this.character.position.set(0, 0, 9);
            this.character.rotation.y = Math.PI;
        }
        
        // Clear any UI notifications or screens
        const notifications = document.querySelectorAll('.ball-result, .game-notification');
        notifications.forEach(n => n.remove());
        
        // Remove any game over screens
        if (this.gameOverScreen) {
            this.gameOverScreen.remove();
            this.gameOverScreen = null;
        }
        
        // Remove innings break screen
        if (this.inningsBreakScreen) {
            this.inningsBreakScreen.remove();
            this.inningsBreakScreen = null;
        }
        
        // Remove multiplayer result screen
        if (this.multiplayerResultScreen) {
            this.multiplayerResultScreen.remove();
            this.multiplayerResultScreen = null;
        }
        
        // Reset AI bowler state
        if (this.aiBowler) {
            this.aiBowler.currentDeliveryType = null;
            this.aiBowler.isProcessing = false;
        }
        
        // Hide all UI elements that should not be visible initially
        const bowlingControls = document.getElementById('bowlingControls');
        if (bowlingControls) {
            bowlingControls.style.display = 'none';
        }
        
        console.log('✅ Game reset for new mode complete');
    }

    // Multiplayer System Methods
    initializeMultiplayer() {
        if (!window.menuSystem || !window.menuSystem.gameState.multiplayerData) {
            console.error('❌ Multiplayer data not found!');
            return;
        }

        const multiplayerData = window.menuSystem.gameState.multiplayerData;
        
        // Disable AI Bowler for multiplayer
        this.disableAIBowler();
        
        // Hide AI Bowler toggle button
        const aiBowlerToggle = document.getElementById('aiBowlerToggleBtn');
        if (aiBowlerToggle) {
            aiBowlerToggle.style.display = 'none';
        }
        
        // Show manual bowling help permanently
        const manualBowlingHelp = document.getElementById('manualBowlingHelp');
        if (manualBowlingHelp) {
            manualBowlingHelp.style.display = 'block';
        }
        
        // Set up multiplayer system
        this.multiplayerSystem.isActive = true;
        this.multiplayerSystem.player1 = multiplayerData.player1;
        this.multiplayerSystem.player2 = multiplayerData.player2;
        
        // Determine batting order based on toss
        if (multiplayerData.battingFirst === 'player1') {
            this.multiplayerSystem.battingPlayer = multiplayerData.player1;
            this.multiplayerSystem.bowlingPlayer = multiplayerData.player2;
        } else {
            this.multiplayerSystem.battingPlayer = multiplayerData.player2;
            this.multiplayerSystem.bowlingPlayer = multiplayerData.player1;
        }
        
        // Reset scores
        this.cricketScore.runs = 0;
        this.cricketScore.wickets = 0;
        this.cricketScore.overs = 0;
        this.cricketScore.balls = 0;
        
        console.log(`🏏 MULTIPLAYER MATCH STARTED!`);
        console.log(`🏏 ${this.multiplayerSystem.battingPlayer.name} is batting`);
        console.log(`🎳 ${this.multiplayerSystem.bowlingPlayer.name} is bowling`);
        console.log(`📋 First innings: 3 overs`);
        
        this.showMultiplayerStartNotification();
        this.updateMultiplayerHUD();
        this.updateCricketScore();
    }
    
    showMultiplayerStartNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 40px;
            border-radius: 20px;
            border: 3px solid #7490ff;
            text-align: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 0 50px rgba(116, 144, 255, 0.5);
        `;
        
        notification.innerHTML = `
            <h1 style="margin: 0 0 20px 0; font-size: 36px; color: #FFD700;">
                FIRST INNINGS
            </h1>
            <div style="font-size: 24px; margin: 10px 0;">
                <span style="color: #4ecdc4;">🏏 Batting:</span> ${this.multiplayerSystem.battingPlayer.name}
            </div>
            <div style="font-size: 24px; margin: 10px 0;">
                <span style="color: #ff6b6b;">🎳 Bowling:</span> ${this.multiplayerSystem.bowlingPlayer.name}
            </div>
            <p style="margin: 20px 0 0 0; font-size: 18px; opacity: 0.8;">
                3 overs to set a target!
            </p>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }
    
    updateMultiplayerHUD() {
        // Update the score display to show player names
        const scoreDisplay = document.querySelector('.score-display');
        if (scoreDisplay && this.multiplayerSystem.isActive) {
            // Add player info above score
            let playerInfo = document.getElementById('multiplayerInfo');
            if (!playerInfo) {
                playerInfo = document.createElement('div');
                playerInfo.id = 'multiplayerInfo';
                playerInfo.style.cssText = `
                    background: rgba(0, 0, 0, 0.3);
                    padding: 10px 20px;
                    border-radius: 10px 10px 0 0;
                    border: 2px solid rgba(116, 144, 255, 0.3);
                    border-bottom: none;
                    font-size: 16px;
                    margin-bottom: -2px;
                `;
                scoreDisplay.parentNode.insertBefore(playerInfo, scoreDisplay);
            }
            
            playerInfo.innerHTML = `
                <div style="display: flex; justify-content: space-between; gap: 20px;">
                    <span>🏏 ${this.multiplayerSystem.battingPlayer.name}</span>
                    <span style="color: #FFD700;">Innings ${this.multiplayerSystem.currentInnings}/2</span>
                    <span>🎳 ${this.multiplayerSystem.bowlingPlayer.name}</span>
                </div>
            `;
        }
    }
    
    checkMultiplayerInningsEnd() {
        if (!this.multiplayerSystem.isActive) return;
        
        // Calculate actual decimal overs (not display format)
        const completedOvers = Math.floor(this.cricketScore.balls / 6);
        const ballsInCurrentOver = this.cricketScore.balls % 6;
        const actualOvers = completedOvers + (ballsInCurrentOver / 6);
        
        // Check if first innings is complete
        if (this.multiplayerSystem.currentInnings === 1) {
            if (actualOvers >= this.multiplayerSystem.maxOvers || this.cricketScore.wickets >= 10) {
                this.endFirstInnings();
            }
        } else {
            // Second innings - check for win/loss conditions
            if (this.cricketScore.runs > this.multiplayerSystem.firstInningsScore) {
                // Batting team won
                this.endMultiplayerMatch('batting_won');
            } else if (actualOvers >= this.multiplayerSystem.maxOvers || this.cricketScore.wickets >= 10) {
                // Bowling team won
                this.endMultiplayerMatch('bowling_won');
            }
        }
    }
    
    endFirstInnings() {
        this.multiplayerSystem.firstInningsScore = this.cricketScore.runs;
        this.multiplayerSystem.firstInningsWickets = this.cricketScore.wickets;
        this.multiplayerSystem.gameStatus = 'innings_break';
        
        console.log(`🏏 FIRST INNINGS COMPLETE!`);
        console.log(`📊 ${this.multiplayerSystem.battingPlayer.name} scored ${this.cricketScore.runs}/${this.cricketScore.wickets}`);
        
        this.showInningsBreakScreen();
    }
    
    showInningsBreakScreen() {
        const inningsBreak = document.createElement('div');
        inningsBreak.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        inningsBreak.innerHTML = `
            <div style="
                background: rgba(0, 0, 0, 0.9);
                padding: 50px;
                border-radius: 20px;
                border: 3px solid #7490ff;
                text-align: center;
                max-width: 600px;
                box-shadow: 0 0 50px rgba(116, 144, 255, 0.5);
            ">
                <h1 style="margin: 0 0 30px 0; font-size: 36px; color: #FFD700;">
                    INNINGS BREAK
                </h1>
                <div style="font-size: 28px; margin: 20px 0;">
                    ${this.multiplayerSystem.battingPlayer.name} scored
                </div>
                <div style="font-size: 48px; margin: 20px 0; color: #4ecdc4;">
                    ${this.cricketScore.runs}/${this.cricketScore.wickets}
                </div>
                <div style="font-size: 20px; margin: 10px 0; opacity: 0.8;">
                    in ${this.cricketScore.overs}.${this.cricketScore.balls} overs
                </div>
                <hr style="margin: 30px 0; border: 1px solid rgba(255, 255, 255, 0.2);">
                <div style="font-size: 24px; margin: 20px 0;">
                    ${this.multiplayerSystem.bowlingPlayer.name} needs
                </div>
                <div style="font-size: 36px; margin: 20px 0; color: #ff6b6b;">
                    ${this.cricketScore.runs + 1} runs to win
                </div>
                <button onclick="window.cricketGame.startSecondInnings()" style="
                    background: rgba(116, 144, 255, 0.9);
                    border: 2px solid rgba(116, 144, 255, 1);
                    color: white;
                    padding: 15px 40px;
                    border-radius: 10px;
                    font-size: 20px;
                    cursor: pointer;
                    margin-top: 20px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    Start Second Innings
                </button>
            </div>
        `;
        
        document.body.appendChild(inningsBreak);
        this.inningsBreakScreen = inningsBreak;
    }
    
    startSecondInnings() {
        // Remove innings break screen
        if (this.inningsBreakScreen) {
            this.inningsBreakScreen.remove();
            this.inningsBreakScreen = null;
        }
        
        // Swap batting and bowling players
        const temp = this.multiplayerSystem.battingPlayer;
        this.multiplayerSystem.battingPlayer = this.multiplayerSystem.bowlingPlayer;
        this.multiplayerSystem.bowlingPlayer = temp;
        
        // Reset scores for second innings
        this.cricketScore.runs = 0;
        this.cricketScore.wickets = 0;
        this.cricketScore.overs = 0;
        this.cricketScore.balls = 0;
        
        // Update innings
        this.multiplayerSystem.currentInnings = 2;
        this.multiplayerSystem.gameStatus = 'playing';
        
        // Activate target chase mode for second innings
        this.targetSystem.isActive = true;
        this.targetSystem.targetRuns = this.multiplayerSystem.firstInningsScore + 1;
        this.targetSystem.maxOvers = this.multiplayerSystem.maxOvers;
        this.targetSystem.maxBalls = this.multiplayerSystem.maxBalls;
        this.targetSystem.runsNeeded = this.targetSystem.targetRuns;
        this.targetSystem.ballsRemaining = this.targetSystem.maxBalls;
        this.targetSystem.oversRemaining = this.multiplayerSystem.maxOvers;
        this.targetSystem.requiredRunRate = this.calculateRequiredRunRate();
        this.targetSystem.gameStatus = 'playing';
        
        console.log(`🏏 SECOND INNINGS STARTED!`);
        console.log(`🎯 ${this.multiplayerSystem.battingPlayer.name} needs ${this.targetSystem.targetRuns} runs to win`);
        
        this.showSecondInningsNotification();
        this.updateMultiplayerHUD();
        this.updateCricketScore();
    }
    
    showSecondInningsNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 40px;
            border-radius: 20px;
            border: 3px solid #7490ff;
            text-align: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 0 50px rgba(116, 144, 255, 0.5);
        `;
        
        notification.innerHTML = `
            <h1 style="margin: 0 0 20px 0; font-size: 36px; color: #FFD700;">
                SECOND INNINGS
            </h1>
            <div style="font-size: 28px; margin: 20px 0; color: #ff6b6b;">
                Target: ${this.targetSystem.targetRuns} runs
            </div>
            <div style="font-size: 20px; margin: 10px 0;">
                <span style="color: #4ecdc4;">🏏 Batting:</span> ${this.multiplayerSystem.battingPlayer.name}
            </div>
            <div style="font-size: 20px; margin: 10px 0;">
                <span style="color: #ff6b6b;">🎳 Bowling:</span> ${this.multiplayerSystem.bowlingPlayer.name}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }
    
    endMultiplayerMatch(result) {
        this.multiplayerSystem.gameStatus = 'match_over';
        
        let winner, margin;
        if (result === 'batting_won') {
            winner = this.multiplayerSystem.battingPlayer.name;
            const wicketsLeft = 10 - this.cricketScore.wickets;
            const ballsLeft = this.targetSystem.ballsRemaining;
            margin = `${wicketsLeft} wickets (${ballsLeft} balls remaining)`;
        } else {
            winner = this.multiplayerSystem.bowlingPlayer.name;
            const runsDiff = this.targetSystem.targetRuns - this.cricketScore.runs - 1;
            margin = `${runsDiff} runs`;
        }
        
        this.multiplayerSystem.matchWinner = winner;
        
        console.log(`🏆 MATCH OVER! ${winner} won by ${margin}`);
        
        this.showMultiplayerResultScreen(winner, margin);
    }
    
    showMultiplayerResultScreen(winner, margin) {
        const resultScreen = document.createElement('div');
        resultScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        resultScreen.innerHTML = `
            <div style="
                background: rgba(0, 0, 0, 0.9);
                padding: 50px;
                border-radius: 20px;
                border: 3px solid #FFD700;
                text-align: center;
                max-width: 700px;
                box-shadow: 0 0 50px rgba(255, 215, 0, 0.5);
            ">
                <h1 style="margin: 0 0 30px 0; font-size: 48px; color: #FFD700;">
                    🏆 MATCH OVER! 🏆
                </h1>
                <div style="font-size: 36px; margin: 20px 0; color: #4ecdc4;">
                    ${winner} WINS!
                </div>
                <div style="font-size: 24px; margin: 20px 0; opacity: 0.8;">
                    by ${margin}
                </div>
                <hr style="margin: 30px 0; border: 1px solid rgba(255, 255, 255, 0.2);">
                <div style="display: flex; justify-content: space-around; margin: 30px 0;">
                    <div>
                        <h3 style="color: #7490ff; margin-bottom: 10px;">First Innings</h3>
                        <div style="font-size: 20px;">${this.multiplayerSystem.player1.name}</div>
                        <div style="font-size: 28px; color: #4ecdc4; margin-top: 5px;">
                            ${this.multiplayerSystem.firstInningsScore}/${this.multiplayerSystem.firstInningsWickets}
                        </div>
                    </div>
                    <div>
                        <h3 style="color: #7490ff; margin-bottom: 10px;">Second Innings</h3>
                        <div style="font-size: 20px;">${this.multiplayerSystem.player2.name}</div>
                        <div style="font-size: 28px; color: #ff6b6b; margin-top: 5px;">
                            ${this.cricketScore.runs}/${this.cricketScore.wickets}
                        </div>
                    </div>
                </div>
                <div style="margin-top: 30px;">
                    <button onclick="window.cricketGame.rematchMultiplayer()" style="
                        background: rgba(116, 144, 255, 0.9);
                        border: 2px solid rgba(116, 144, 255, 1);
                        color: white;
                        padding: 15px 30px;
                        border-radius: 10px;
                        font-size: 18px;
                        cursor: pointer;
                        margin: 0 10px;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        Rematch
                    </button>
                    <button onclick="window.location.reload()" style="
                        background: rgba(255, 107, 107, 0.9);
                        border: 2px solid rgba(255, 107, 107, 1);
                        color: white;
                        padding: 15px 30px;
                        border-radius: 10px;
                        font-size: 18px;
                        cursor: pointer;
                        margin: 0 10px;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        Main Menu
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(resultScreen);
        this.multiplayerResultScreen = resultScreen;
    }
    
    rematchMultiplayer() {
        // Remove result screen
        if (this.multiplayerResultScreen) {
            this.multiplayerResultScreen.remove();
            this.multiplayerResultScreen = null;
        }
        
        // Reset multiplayer system but keep player names
        const player1 = this.multiplayerSystem.player1;
        const player2 = this.multiplayerSystem.player2;
        
        // Reset all game state
        this.resetGame();
        
        // Swap who bats first
        if (window.menuSystem.gameState.multiplayerData.battingFirst === 'player1') {
            window.menuSystem.gameState.multiplayerData.battingFirst = 'player2';
        } else {
            window.menuSystem.gameState.multiplayerData.battingFirst = 'player1';
        }
        
        // Reinitialize multiplayer
        setTimeout(() => {
            this.initializeMultiplayer();
        }, 500);
    }

    // ✅ NEW: AI Bowler System Methods
    
    // Initialize AI Bowler after ball completion
    initializeAIBowler() {
        // Check if in multiplayer mode - always manual bowling
        if (this.multiplayerSystem.isActive) {
            console.log('🏏 Multiplayer mode - Manual bowling only');
            console.log(`📋 ${this.multiplayerSystem.bowlingPlayer.name}, use digit keys 6-0 to bowl`);
            return;
        }
        
        if (!this.aiBowler.isEnabled) {
            console.log('🤖 AI Bowler is disabled - Manual bowling mode active');
            console.log('📋 Use digit keys 6-0 to bowl manually');
            return;
        }
        
        // Clear any existing timers
        this.clearAIBowlerTimers();
        
        // Check if multiplayer human should bowl instead
        if (this.multiplayerBowling.isHumanControlled) {
            this.waitForHumanBowlingInput();
            return;
        }
        
        // Start AI bowling sequence
        this.startAIBowlingSequence();
    }
    
    // Start the AI bowling sequence with countdown
    startAIBowlingSequence() {
        console.log('🎳 AI Bowler: Starting bowling sequence...');
        
        // Update game state awareness
        this.updateGameStateAwareness();
        
        // Select bowling variation based on strategy
        const selectedVariation = this.selectBowlingVariation();
        
        // Create countdown display
        this.createBowlingCountdown();
        
        // Start countdown timer
        let countdownValue = 3;
        this.aiBowler.countdownActive = true;
        
        const countdownInterval = setInterval(() => {
            this.updateCountdownDisplay(countdownValue);
            
            if (countdownValue <= 0) {
                clearInterval(countdownInterval);
                this.executeBowlingAction(selectedVariation);
                this.removeBowlingCountdown();
                this.aiBowler.countdownActive = false;
            }
            
            countdownValue--;
        }, 1000); // 1 second intervals
        
        this.aiBowler.countdownTimer = countdownInterval;
    }
    
    // Select bowling variation based on AI strategy
    selectBowlingVariation() {
        const strategy = this.aiBowler.strategies[this.aiBowler.bowlingStrategy];
        const weights = strategy.weights;
        
        // Apply game state modifiers
        const adjustedWeights = this.applyGameStateModifiers(weights);
        
        // Weighted random selection
        const totalWeight = Object.values(adjustedWeights).reduce((sum, weight) => sum + weight, 0);
        let randomValue = Math.random() * totalWeight;
        
        for (const [variation, weight] of Object.entries(adjustedWeights)) {
            randomValue -= weight;
            if (randomValue <= 0) {
                console.log(`🎯 AI selected: ${this.aiBowler.bowlingVariations[variation].name} (${strategy.name} strategy)`);
                return variation;
            }
        }
        
        // Fallback to straight delivery
        return 'straight';
    }
    
    // Apply game state modifiers to bowling weights
    applyGameStateModifiers(baseWeights) {
        const adjustedWeights = { ...baseWeights };
        const factors = this.aiBowler.gameStateFactors;
        
        // If batsman is aggressive, bowl more defensively
        if (factors.batsmanAggression === 'high') {
            adjustedWeights.leftSide *= 1.5; // Bowl wider
            adjustedWeights.yorker *= 1.3; // More yorkers
            adjustedWeights.bouncer *= 0.7; // Fewer bouncers
        }
        
        // If recent boundaries, change strategy
        if (factors.recentBoundaries.length > 1) {
            adjustedWeights.straight *= 0.5; // Avoid straight balls
            adjustedWeights.yorker *= 1.8; // More yorkers
            adjustedWeights.leftSide *= 1.4; // Bowl wider
        }
        
        // Pressure situations (target chase, late overs)
        if (factors.pressureSituation) {
            adjustedWeights.yorker *= 1.5;
            adjustedWeights.bouncer *= 1.3;
            adjustedWeights.straight *= 0.8;
        }
        
        // Vary strategy based on balls in over
        if (factors.ballsInOver >= 4) {
            // Later in over, more aggressive
            adjustedWeights.yorker *= 1.2;
            adjustedWeights.bouncer *= 1.1;
        }
        
        return adjustedWeights;
    }
    
    // Update game state awareness for AI decision making
    updateGameStateAwareness() {
        const factors = this.aiBowler.gameStateFactors;
        
        // Update balls in over
        factors.ballsInOver = this.cricketScore.balls % 6;
        
        // Calculate runs this over
        factors.runsThisOver = this.calculateRunsThisOver();
        
        // Detect batsman aggression based on recent scoring rate
        factors.batsmanAggression = this.detectBatsmanAggression();
        
        // Check for pressure situations
        factors.pressureSituation = this.isPressureSituation();
        
        // Track recent boundaries (last 6 balls)
        this.updateRecentBoundariesTracking();
        
        console.log(`🧠 AI Game Awareness: Over(${factors.ballsInOver}/6), Runs(${factors.runsThisOver}), Aggression(${factors.batsmanAggression}), Pressure(${factors.pressureSituation})`);
    }
    
    // Calculate runs scored this over
    calculateRunsThisOver() {
        // This is a simplified calculation - in a full game you'd track ball-by-ball
        const ballsInOver = this.cricketScore.balls % 6;
        return Math.floor(Math.random() * (ballsInOver * 3)); // Placeholder for now
    }
    
    // Detect batsman's aggression level
    detectBatsmanAggression() {
        const recentBoundaries = this.aiBowler.gameStateFactors.recentBoundaries.length;
        if (recentBoundaries >= 2) return 'high';
        if (recentBoundaries >= 1) return 'medium';
        return 'low';
    }
    
    // Check if current situation requires pressure bowling
    isPressureSituation() {
        // Check target chase scenarios
        if (this.targetSystem.isActive) {
            const runRate = this.targetSystem.requiredRunRate;
            return runRate > 8.0; // High required run rate = pressure
        }
        
        // Check if batsman has scored many runs
        const currentBatsman = this.battingTeam.players[this.battingTeam.currentBatsman];
        return currentBatsman.runs > 25; // Set batsman = pressure
        
        return false;
    }
    
    // Update tracking of recent boundaries
    updateRecentBoundariesTracking() {
        const boundaries = this.aiBowler.gameStateFactors.recentBoundaries;
        
        // Add current ball if it was a boundary
        if (this.ballState.ballType === 'boundary') {
            boundaries.push({
                ball: this.cricketScore.balls,
                runs: this.ballState.runsThisBall,
                type: this.ballState.runsThisBall === 6 ? 'six' : 'four'
            });
        }
        
        // Keep only last 6 balls
        this.aiBowler.gameStateFactors.recentBoundaries = boundaries.filter(
            boundary => this.cricketScore.balls - boundary.ball < 6
        );
    }
    
    // Create the bowling countdown display
    createBowlingCountdown() {
        // Remove existing countdown if any
        this.removeBowlingCountdown();
        
        // Create countdown container
        const countdownDiv = document.createElement('div');
        countdownDiv.id = 'bowlingCountdown';
        countdownDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 20px;
            transform: translateY(-50%);
            z-index: 10000;
            background: rgba(20, 20, 40, 0.95);
            border: 3px solid rgba(116, 144, 255, 0.6);
            border-radius: 20px;
            padding: 30px 50px;
            text-align: center;
            font-family: 'Orbitron', monospace;
            box-shadow: 0 0 40px rgba(116, 144, 255, 0.4);
            backdrop-filter: blur(10px);
            animation: countdownPulse 1s ease-in-out infinite;
            min-width: 250px;
        `;
        
        // Add CSS animation
        if (!document.getElementById('countdownStyles')) {
            const style = document.createElement('style');
            style.id = 'countdownStyles';
            style.textContent = `
                @keyframes countdownPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                @keyframes countdownNumber {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(countdownDiv);
        this.aiBowler.countdownElement = countdownDiv;
    }
    
    // Update countdown display
    updateCountdownDisplay(count) {
        if (!this.aiBowler.countdownElement) return;
        
        if (count > 0) {
            this.aiBowler.countdownElement.innerHTML = `
                <div style="color: #7490ff; font-size: 24px; margin-bottom: 15px;">
                    🎳 AI Bowler Ready
                </div>
                <div style="color: white; font-size: 72px; font-weight: bold; animation: countdownNumber 0.8s ease-out;">
                    ${count}
                </div>
                <div style="color: #ccc; font-size: 16px; margin-top: 15px;">
                    Get ready to face the delivery...
                </div>
            `;
        } else {
            this.aiBowler.countdownElement.innerHTML = `
                <div style="color: #00ff88; font-size: 32px; font-weight: bold;">
                    🚀 BOWLING!
                </div>
            `;
        }
    }
    
    // Remove countdown display
    removeBowlingCountdown() {
        if (this.aiBowler.countdownElement) {
            this.aiBowler.countdownElement.remove();
            this.aiBowler.countdownElement = null;
        }
    }
    
    // Execute the selected bowling action
    executeBowlingAction(variationKey) {
        const variation = this.aiBowler.bowlingVariations[variationKey];
        
        console.log(`🎳 AI Bowling: ${variation.name} - ${variation.description}`);
        
        // Update AI statistics
        this.updateAIBowlerStats(variationKey, variation);
        
        // Execute the bowl
        this.bowlBall(variation.direction.clone(), variation.speed);
        
        // Show bowling notification
        this.showBowlingNotification(variation);
        
        // Mark AI as active for this ball
        this.aiBowler.isActive = true;
    }
    
    // Update AI bowler statistics
    updateAIBowlerStats(variationKey, variation) {
        const stats = this.aiBowler.stats;
        
        stats.ballsBowled++;
        
        // Track variation usage
        if (!stats.variationCount[variationKey]) {
            stats.variationCount[variationKey] = 0;
        }
        stats.variationCount[variationKey]++;
        
        console.log(`📊 AI Stats: ${stats.ballsBowled} balls, ${Object.keys(stats.variationCount).length} variations used`);
    }
    
    // Show bowling delivery notification
    showBowlingNotification(variation) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 20px;
            transform: translateY(-50%);
            z-index: 9999;
            background: rgba(20, 20, 40, 0.95);
            border: 2px solid rgba(116, 144, 255, 0.5);
            border-radius: 15px;
            padding: 20px;
            color: white;
            font-family: 'Rajdhani', sans-serif;
            box-shadow: 0 0 20px rgba(116, 144, 255, 0.3);
            backdrop-filter: blur(10px);
            animation: slideInLeft 0.5s ease-out;
            min-width: 250px;
        `;
        
        notification.innerHTML = `
            <div style="color: #7490ff; font-size: 16px; font-weight: bold;">
                🤖 AI Bowler
            </div>
            <div style="color: white; font-size: 18px; margin: 5px 0;">
                ${variation.name}
            </div>
            <div style="color: #ccc; font-size: 14px;">
                ${variation.description}
            </div>
            <div style="color: ${variation.difficulty === 'hard' ? '#ff6b6b' : variation.difficulty === 'medium' ? '#ffa500' : '#4ecdc4'}; font-size: 12px; margin-top: 5px;">
                Difficulty: ${variation.difficulty.toUpperCase()}
            </div>
        `;
        
        // Add slide animation
        if (!document.getElementById('bowlingNotificationStyles')) {
            const style = document.createElement('style');
            style.id = 'bowlingNotificationStyles';
            style.textContent = `
                @keyframes slideInLeft {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInRight 0.5s ease-out reverse';
                setTimeout(() => notification.remove(), 500);
            }
        }, 4000);
    }
    
    // Clear all AI bowler timers
    clearAIBowlerTimers() {
        if (this.aiBowler.autoBowlTimer) {
            clearTimeout(this.aiBowler.autoBowlTimer);
            this.aiBowler.autoBowlTimer = null;
        }
        
        if (this.aiBowler.countdownTimer) {
            clearInterval(this.aiBowler.countdownTimer);
            this.aiBowler.countdownTimer = null;
        }
        
        this.removeBowlingCountdown();
        this.aiBowler.countdownActive = false;
    }
    
    // ✅ MULTIPLAYER: Wait for human bowling input
    waitForHumanBowlingInput() {
        console.log('👤 Waiting for human player bowling input...');
        
        // Create human input interface
        this.createHumanBowlingInterface();
        
        // Set timeout for human input
        this.multiplayerBowling.humanInputTimer = setTimeout(() => {
            console.log('⏰ Human bowling input timeout - AI taking over');
            this.removeHumanBowlingInterface();
            this.multiplayerBowling.isHumanControlled = false;
            this.startAIBowlingSequence();
        }, this.multiplayerBowling.humanInputTimeout);
    }
    
    // Create human bowling input interface
    createHumanBowlingInterface() {
        const interfaceDiv = document.createElement('div');
        interfaceDiv.id = 'humanBowlingInterface';
        interfaceDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10001;
            background: rgba(20, 20, 40, 0.95);
            border: 3px solid rgba(255, 215, 0, 0.6);
            border-radius: 20px;
            padding: 25px;
            text-align: center;
            font-family: 'Rajdhani', sans-serif;
            box-shadow: 0 0 30px rgba(255, 215, 0, 0.4);
            backdrop-filter: blur(10px);
        `;
        
        interfaceDiv.innerHTML = `
            <div style="color: #ffd700; font-size: 22px; font-weight: bold; margin-bottom: 15px;">
                👤 Your Turn to Bowl!
            </div>
            <div style="color: white; font-size: 16px; margin-bottom: 20px;">
                Choose your delivery (Keys 6-0):
            </div>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button onclick="window.cricketGame.humanBowlSelected('straight')" style="background: rgba(116, 144, 255, 0.8); border: none; color: white; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px;">6 - Straight</button>
                <button onclick="window.cricketGame.humanBowlSelected('leftSide')" style="background: rgba(116, 144, 255, 0.8); border: none; color: white; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px;">7 - Left</button>
                <button onclick="window.cricketGame.humanBowlSelected('rightSide')" style="background: rgba(116, 144, 255, 0.8); border: none; color: white; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px;">8 - Right</button>
                <button onclick="window.cricketGame.humanBowlSelected('yorker')" style="background: rgba(116, 144, 255, 0.8); border: none; color: white; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px;">9 - Yorker</button>
                <button onclick="window.cricketGame.humanBowlSelected('bouncer')" style="background: rgba(116, 144, 255, 0.8); border: none; color: white; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px;">0 - Bouncer</button>
            </div>
            <div style="color: #ccc; font-size: 12px; margin-top: 15px;">
                Timeout in <span id="humanBowlingTimeout">10</span> seconds
            </div>
        `;
        
        document.body.appendChild(interfaceDiv);
        this.multiplayerBowling.humanInputElement = interfaceDiv;
        
        // Start timeout countdown
        let timeLeft = 10;
        const timeoutInterval = setInterval(() => {
            timeLeft--;
            const timeoutSpan = document.getElementById('humanBowlingTimeout');
            if (timeoutSpan) timeoutSpan.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(timeoutInterval);
            }
        }, 1000);
    }
    
    // Remove human bowling interface
    removeHumanBowlingInterface() {
        if (this.multiplayerBowling.humanInputElement) {
            this.multiplayerBowling.humanInputElement.remove();
            this.multiplayerBowling.humanInputElement = null;
        }
        
        if (this.multiplayerBowling.humanInputTimer) {
            clearTimeout(this.multiplayerBowling.humanInputTimer);
            this.multiplayerBowling.humanInputTimer = null;
        }
    }
    
    // Handle human bowling selection
    humanBowlSelected(variationKey) {
        console.log(`👤 Human selected: ${this.aiBowler.bowlingVariations[variationKey].name}`);
        
        // Clear timeout and interface
        this.removeHumanBowlingInterface();
        
        // Execute the bowling action
        this.executeBowlingAction(variationKey);
    }
    
    // ✅ PUBLIC API: Enable/Disable AI Bowler
    enableAIBowler() {
        this.aiBowler.isEnabled = true;
        this.multiplayerBowling.isHumanControlled = false;
        console.log('🤖 AI Bowler enabled');
    }
    
    disableAIBowler() {
        this.aiBowler.isEnabled = false;
        this.clearAIBowlerTimers();
        console.log('🤖 AI Bowler disabled');
    }
    
    // ✅ PUBLIC API: Switch to multiplayer mode
    enableMultiplayerBowling(humanPlayerId = 'human') {
        this.multiplayerBowling.isHumanControlled = true;
        this.multiplayerBowling.humanPlayerId = humanPlayerId;
        this.aiBowler.isEnabled = false; // Disable AI when human takes over
        console.log(`👤 Multiplayer bowling enabled for player: ${humanPlayerId}`);
    }
    
    disableMultiplayerBowling() {
        this.multiplayerBowling.isHumanControlled = false;
        this.multiplayerBowling.humanPlayerId = null;
        this.removeHumanBowlingInterface();
        this.aiBowler.isEnabled = true; // Re-enable AI
        console.log('👤 Multiplayer bowling disabled - AI taking over');
    }
    
    // ✅ PUBLIC API: Change AI bowling strategy
    setAIBowlingStrategy(strategy) {
        if (this.aiBowler.strategies[strategy]) {
            this.aiBowler.bowlingStrategy = strategy;
            console.log(`🧠 AI Bowling strategy changed to: ${this.aiBowler.strategies[strategy].name}`);
            console.log(`📝 ${this.aiBowler.strategies[strategy].description}`);
        } else {
            console.log(`❌ Invalid strategy: ${strategy}. Available: ${Object.keys(this.aiBowler.strategies).join(', ')}`);
        }
    }
    
    // ✅ PUBLIC API: Get AI bowler statistics
    getAIBowlerStats() {
        const stats = this.aiBowler.stats;
        console.log('📊 AI Bowler Statistics:');
        console.log(`  Balls Bowled: ${stats.ballsBowled}`);
        console.log(`  Wickets Taken: ${stats.wicketsTaken}`);
        console.log(`  Runs Given: ${stats.runsGiven}`);
        console.log(`  Boundaries Conceded: ${stats.boundariesConceded}`);
        console.log(`  Bowling Variations Used:`);
        
        Object.entries(stats.variationCount).forEach(([variation, count]) => {
            const percentage = ((count / stats.ballsBowled) * 100).toFixed(1);
            console.log(`    ${this.aiBowler.bowlingVariations[variation].name}: ${count} (${percentage}%)`);
        });
        
        return stats;
    }
    
    // ✅ NEW: Manual bowling method (respects AI toggle)
    manualBowl(variationKey, direction, speed) {
        // Check if AI is enabled
        if (this.aiBowler.isEnabled) {
            console.log('🤖 AI Bowler is enabled - Manual bowling blocked');
            console.log('💡 Disable AI Bowler to use manual controls (toggle button or disableAIBowler())');
            
            // Show temporary notification
            this.showManualBowlingBlockedNotification();
            return;
        }
        
        // Check if a ball is already active
        if (this.ballPhysics.isMoving || this.ballState.isActive) {
            console.log('⚠️ Ball already in play - wait for completion');
            return;
        }
        
        // Get variation info for notification
        const variation = this.aiBowler.bowlingVariations[variationKey];
        if (variation) {
            console.log(`👤 Manual Bowl: ${variation.name} - ${variation.description}`);
        }
        
        // Execute the bowl
        this.bowlBall(direction, speed);
        
        // Show manual bowling notification
        if (variation) {
            this.showManualBowlingNotification(variation);
        }
    }
    
    // Show notification when manual bowling is blocked
    showManualBowlingBlockedNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10000;
            background: rgba(20, 20, 40, 0.95);
            border: 3px solid rgba(255, 107, 107, 0.6);
            border-radius: 20px;
            padding: 30px 40px;
            text-align: center;
            font-family: 'Rajdhani', sans-serif;
            box-shadow: 0 0 40px rgba(255, 107, 107, 0.4);
            backdrop-filter: blur(10px);
        `;
        
        notification.innerHTML = `
            <div style="color: #ff6b6b; font-size: 24px; font-weight: bold; margin-bottom: 15px;">
                🤖 AI Bowler Active
            </div>
            <div style="color: white; font-size: 16px; margin-bottom: 15px;">
                Manual bowling is currently disabled
            </div>
            <div style="color: #ccc; font-size: 14px;">
                Toggle AI Bowler OFF to use manual controls
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translate(-50%, -50%) scale(0.9)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }
    
    // Show manual bowling delivery notification
    showManualBowlingNotification(variation) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 20px;
            transform: translateY(-50%);
            z-index: 9999;
            background: rgba(20, 20, 40, 0.95);
            border: 2px solid rgba(255, 107, 107, 0.5);
            border-radius: 15px;
            padding: 20px;
            color: white;
            font-family: 'Rajdhani', sans-serif;
            box-shadow: 0 0 20px rgba(255, 107, 107, 0.3);
            backdrop-filter: blur(10px);
            animation: slideInLeft 0.5s ease-out;
            min-width: 250px;
        `;
        
        notification.innerHTML = `
            <div style="color: #ff6b6b; font-size: 16px; font-weight: bold;">
                👤 Manual Bowling
            </div>
            <div style="color: white; font-size: 18px; margin: 5px 0;">
                ${variation.name}
            </div>
            <div style="color: #ccc; font-size: 14px;">
                ${variation.description}
            </div>
            <div style="color: ${variation.difficulty === 'hard' ? '#ff6b6b' : variation.difficulty === 'medium' ? '#ffa500' : '#4ecdc4'}; font-size: 12px; margin-top: 5px;">
                Difficulty: ${variation.difficulty.toUpperCase()}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInLeft 0.5s ease-out reverse';
                setTimeout(() => notification.remove(), 500);
            }
        }, 4000);
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

    // Running between wickets system
    startRun() {
        // PREVENT running if a boundary has been awarded.
        if (this.cricketScore.boundaryAwarded) {
            console.log('❌ Cannot run - a boundary has been scored!');
            return false;
        }

        // Only allow running if not already running and not in middle of swing
        if (this.runningSystem.isRunning || this.batSwing.isSwinging) {
            console.log('❌ Cannot start run - already running or swinging');
            return false;
        }
        
        // PREVENT running if a catch attempt is in progress
        if (this.fieldingSystem.catchingSystem.catchInProgress) {
            console.log('❌ Cannot run - catch attempt in progress!');
            return false;
        }

        // If waiting at the other end, run back
        if (this.runningSystem.waitingForNextRun) {
            this.runningSystem.waitingForNextRun = false;
        }

        this.runningSystem.isRunning = true;
        this.runningSystem.runState = 'running';
        this.runningSystem.runProgress = 0;
        
        // Determine target end
        if (this.runningSystem.currentEnd === 'batsman') {
            this.runningSystem.targetEnd = 'bowler';
        } else {
            this.runningSystem.targetEnd = 'batsman';
        }
        
        console.log(`🏃‍♂️ Starting run from ${this.runningSystem.currentEnd} to ${this.runningSystem.targetEnd}`);
        
        // Load running animation if not already loaded
        if (!this.character.userData.animations || !this.character.userData.animations.has('runningcharacter')) {
            this.loadCharacterAnimation(this.character, 'runningcharacter.fbx', 'batsman');
        }
        
        // Use waitForAnimationAndPlay to ensure animation loads before playing
        this.waitForAnimationAndPlay(this.character, 'runningcharacter', true);
        
        return true;
    }

    updateRunningSystem(deltaTime) {
        if (!this.runningSystem.isRunning) return;

        const currentPos = this.runningSystem.wicketPositions[this.runningSystem.currentEnd];
        const targetPos = this.runningSystem.wicketPositions[this.runningSystem.targetEnd];
        
        // Calculate distance to cover
        const totalDistance = Math.sqrt(
            Math.pow(targetPos.x - currentPos.x, 2) + 
            Math.pow(targetPos.z - currentPos.z, 2)
        );
        
        // Update progress based on run speed
        const progressIncrement = (this.runningSystem.runSpeed * deltaTime) / totalDistance;
        this.runningSystem.runProgress += progressIncrement;
        
        // Check if reached the end
        if (this.runningSystem.runProgress >= 1.0) {
            // Stop running immediately to prevent multiple calls
            this.runningSystem.isRunning = false;
            this.runningSystem.runProgress = 1.0; // Clamp to exactly 1
            this.completeRun();
            return;
        }
        
        // Update character position
        const newX = currentPos.x + (targetPos.x - currentPos.x) * this.runningSystem.runProgress;
        const newZ = currentPos.z + (targetPos.z - currentPos.z) * this.runningSystem.runProgress;
        
        this.character.position.set(newX, 0, newZ);
        
        // Make character face the direction they're running
        const direction = new THREE.Vector3(targetPos.x - currentPos.x, 0, targetPos.z - currentPos.z);
        if (direction.length() > 0) {
            direction.normalize();
            const lookAtPos = this.character.position.clone().add(direction);
            this.character.lookAt(lookAtPos);
        }
    }

    completeRun() {
        console.log(`✅ Run completed! Reached ${this.runningSystem.targetEnd} end`);
        
        // Prevent multiple calls to completeRun
        if (this.runningSystem.runState === 'turning') {
            console.log('⚠️ Turn already in progress, skipping');
            return;
        }
        
        // Swap current and target ends
        this.runningSystem.currentEnd = this.runningSystem.targetEnd;
        this.runningSystem.runProgress = 0;
        this.runningSystem.runsCompleted++;
        
        // Don't update score here - wait for ball completion
        console.log(`🏃‍♂️ Run ${this.runningSystem.runsCompleted} completed!`);
        
        // Start turning animation
        this.runningSystem.runState = 'turning';
        this.runningSystem.turningAtEnd = true;
        
        // Load turning animation if not already loaded
        if (!this.character.userData.animations || !this.character.userData.animations.has('leftturn')) {
            this.loadCharacterAnimation(this.character, 'leftturn.fbx', 'batsman');
        }
        if (!this.character.userData.animations || !this.character.userData.animations.has('standingidle')) {
            this.loadCharacterAnimation(this.character, 'standingidle.fbx', 'batsman');
        }
        
        console.log('🔄 Attempting to play turn animation...');
        
        // Store original rotation for turn animation
        const originalRotation = this.character.rotation.y;
        console.log(`🔄 Character rotation before turn: ${originalRotation}`);
        
        // Use waitForAnimationAndPlay to ensure turn animation loads before playing
        this.waitForAnimationAndPlay(this.character, 'leftturn', false, () => {
            // Only proceed if still in turning state
            if (this.runningSystem.runState === 'turning') {
                console.log('🔄 Turn animation completed via callback, transitioning to idle');
                // Complete the turn rotation (180 degrees)
                this.character.rotation.y = originalRotation + Math.PI;
                console.log(`🔄 Character rotation after turn: ${this.character.rotation.y}`);
                this.finishTurn();
            }
        });
        
        // Safety timeout in case callback fails
        setTimeout(() => {
            if (this.runningSystem.runState === 'turning') {
                console.log('⚠️ Turn animation timeout, forcing completion');
                this.character.rotation.y = originalRotation + Math.PI;
                this.finishTurn();
            }
        }, 2000); // 2 second safety timeout
    }

    finishTurn() {
        // Prevent multiple calls to finishTurn
        if (this.runningSystem.runState !== 'turning') {
            console.log('⚠️ finishTurn called but not in turning state, skipping');
            return;
        }
        
        console.log(`🔄 Turn completed at ${this.runningSystem.currentEnd} end`);
        
        this.runningSystem.runState = 'waiting';
        this.runningSystem.turningAtEnd = false;
        this.runningSystem.isRunning = false;
        this.runningSystem.waitingForNextRun = true;
        
        // Just go to idle after turn, don't auto-slide
        this.playCricketPlayerAnimation(this.character, 'standingidle');
        
        console.log(`⏳ Waiting for next run command. Press SPACE to run back, L to slide! (Total runs: ${this.runningSystem.runsCompleted})`);
    }

    // Debug function to check what animations are available
    debugAnimations() {
        console.log('🎬 Animation Debug Info:');
        console.log('Main character animations:');
        if (this.character && this.character.userData.animations) {
            this.character.userData.animations.forEach((action, name) => {
                console.log(`  - ${name}: ${action.isRunning() ? 'RUNNING' : 'STOPPED'}`);
            });
        } else {
            console.log('  No character animations available');
        }
        
        console.log('Cricket team animations:');
        this.cricketCharacters.forEach(char => {
            if (char && char.userData.animations) {
                console.log(`  ${char.userData.description}:`);
                char.userData.animations.forEach((action, name) => {
                    console.log(`    - ${name}: ${action.isRunning() ? 'RUNNING' : 'STOPPED'}`);
                });
            }
        });
    }

    // Separate slide function
    playSlideAnimation() {
        if (!this.character) {
            console.log('❌ No character available for slide animation');
            return false;
        }

        console.log('🏃‍♂️ Playing slide animation...');
        
        // Load both sliding and idle animations
        this.loadCharacterAnimation(this.character, 'runningslide.fbx', 'batsman');
        this.loadCharacterAnimation(this.character, 'standingidle.fbx', 'batsman');
        
        setTimeout(() => {
            // Play slide animation once, then automatically transition to idle
            this.playCricketPlayerAnimationOnce(this.character, 'runningslide', () => {
                console.log('🧍 Slide animation completed, transitioning to idle');
                this.playCricketPlayerAnimation(this.character, 'standingidle');
            });
        }, 200); // Wait for animations to load
        
        return true;
    }

    resetRunningSystem() {
        this.runningSystem.isRunning = false;
        this.runningSystem.runState = 'idle';
        this.runningSystem.currentEnd = 'batsman';
        this.runningSystem.targetEnd = 'bowler';
        this.runningSystem.runProgress = 0;
        this.runningSystem.runsCompleted = 0;
        this.runningSystem.turningAtEnd = false;
        this.runningSystem.waitingForNextRun = false;
        
        // Reset character position to batsman's end
        this.character.position.set(0, 0, 9);
        this.character.lookAt(0, 0, -10); // Face bowler
        
        this.playCricketPlayerAnimation(this.character, 'standingidle');
        
        console.log('🔄 Running system reset - batsman back at starting position');
    }

    // ✅ NEW: Check if batsman is run out
    checkForRunOut() {
        // Run-out occurs when:
        // 1. Batsman is currently running between wickets
        // 2. Ball reaches the bowler/keeper before batsman completes the run
        
        console.log('🔍 DEBUG: checkForRunOut() called');
        console.log(`   Running state: isRunning=${this.runningSystem.isRunning}, runState=${this.runningSystem.runState}`);
        console.log(`   Run progress: ${(this.runningSystem.runProgress * 100).toFixed(1)}%`);
        console.log(`   Current end: ${this.runningSystem.currentEnd}, Target: ${this.runningSystem.targetEnd}`);
        
        if (!this.runningSystem.isRunning) {
            console.log('❌ No run-out - batsman not running');
            return false; // Not running, can't be run out
        }
        
        // Check if batsman is in the middle of a run (not at either end)
        const runProgress = this.runningSystem.runProgress;
        const isInMiddleOfRun = runProgress > 0 && runProgress < 1.0;
        
        console.log(`   Mid-run check: progress=${runProgress.toFixed(3)}, isInMiddle=${isInMiddleOfRun}`);
        
        if (!isInMiddleOfRun) {
            console.log(`🏃‍♂️ Batsman safe - completed run (progress: ${(runProgress * 100).toFixed(1)}%)`);
            return false; // Batsman has completed the run safely
        }
        
        // Batsman is mid-run when ball reached the bowler = RUN OUT!
        console.log(`🏃‍♂️💥 RUN OUT detected! Batsman progress: ${(runProgress * 100).toFixed(1)}%`);
        console.log(`   Current end: ${this.runningSystem.currentEnd}, Target: ${this.runningSystem.targetEnd}`);
        return true;
    }

    // ✅ NEW: Execute run-out wicket
    executeRunOut() {
        console.log(`🏃‍♂️💥 Executing RUN OUT! Batsman caught short of crease!`);
        
        // Stop ball movement immediately
        this.ballPhysics.isMoving = false;
        this.ballPhysics.velocity.set(0, 0, 0);
        
        // Position ball in bowler's hands
        this.cricketBall.position.copy(this.bowler.position);
        this.cricketBall.position.y += 1.5;
        
        // Clear ball trail for clean visual
        this.clearBallTrail();
        
        // Stop the running system immediately - batsman is out
        this.runningSystem.isRunning = false;
        this.runningSystem.runState = 'idle';
        
        // ✅ Handle wicket scoring for run-out
        this.cricketScore.wickets += 1;
        console.log(`📊 RUN OUT! Wicket taken! Score: ${this.cricketScore.runs}/${this.cricketScore.wickets}`);
        
        // ✅ Complete the ball immediately with run-out result
        if (this.ballState.isActive && !this.ballState.isComplete) {
            this.ballState.ballType = 'wicket';
            this.ballState.completionReason = 'run_out';
            this.ballState.runsThisBall = this.runningSystem.runsCompleted; // Partial runs don't count in run-out
            
            // Force complete the ball immediately (run-out has priority)
            setTimeout(() => {
                this.forceCompleteBall();
            }, 500);
        }
        
        // ✅ Show run-out notification
        this.showRunOutNotification();
        
        // Reset bowler receiving state
        this.bowlerReceivingSystem.isReceivingThrow = false;
        
        // Play celebration animation on bowler
        this.playCricketPlayerAnimation(this.bowler, 'standingidle');
        
        // Also show argument animation (batsman disagreeing with decision) if available
        setTimeout(() => {
            if (this.character.userData.animations && this.character.userData.animations.has('standingarguing')) {
                this.playCricketPlayerAnimationOnce(this.character, 'standingarguing', () => {
                    this.playCricketPlayerAnimation(this.character, 'standingidle');
                });
                console.log('😤 Batsman argues with the umpire decision!');
            }
        }, 1000);
        
        console.log(`✅ Run-out completed successfully!`);
    }

    // ✅ NEW: Execute bowled dismissal
    executeBowledDismissal() {
        console.log(`🎯💥 BOWLED! Batsman missed and ball hit the stumps!`);
        
        // Stop ball movement immediately
        this.ballPhysics.isMoving = false;
        this.ballPhysics.velocity.set(0, 0, 0);
        
        // Keep ball at stump position for visual effect
        // (Ball position is already at the stumps from collision detection)
        
        // Clear ball trail for clean visual
        this.clearBallTrail();
        
        // Stop any running or batting actions immediately - batsman is out
        this.runningSystem.isRunning = false;
        this.runningSystem.runState = 'idle';
        this.batSwing.isSwinging = false;
        
        // ✅ Handle wicket scoring for bowled
        this.cricketScore.wickets += 1;
        console.log(`📊 BOWLED! Wicket taken! Score: ${this.cricketScore.runs}/${this.cricketScore.wickets}`);
        
        // ✅ Complete the ball immediately with bowled result
        if (this.ballState.isActive && !this.ballState.isComplete) {
            this.ballState.ballType = 'wicket';
            this.ballState.completionReason = 'bowled';
            this.ballState.runsThisBall = 0; // No runs can be scored when bowled
            
            // Force complete the ball immediately (bowled has highest priority)
            setTimeout(() => {
                this.forceCompleteBall();
            }, 500);
        }
        
        // ✅ Show bowled notification
        this.showBowledNotification();
        
        // Play celebration animation on bowler
        if (this.bowler) {
            this.playCricketPlayerAnimation(this.bowler, 'standingidle');
        }
        
        // Also show argument animation (batsman disagreeing with decision) if available
        setTimeout(() => {
            if (this.character.userData.animations && this.character.userData.animations.has('standingarguing')) {
                this.playCricketPlayerAnimationOnce(this.character, 'standingarguing', () => {
                    this.playCricketPlayerAnimation(this.character, 'standingidle');
                });
                console.log('😤 Batsman argues with the umpire decision!');
            }
        }, 1000);
        
        console.log(`✅ Bowled dismissal completed successfully!`);
    }

    loadCricketTeam() {
        console.log('🏏 Loading cricket team...');
        console.log('🚀 OPTIMIZATION: Loading characters with standingidle.fbx directly for immediate animations');
        
        // ✅ NEW: Track team loading progress
        this.teamLoadingState = {
            totalMembers: 11, // 1 bowler + 1 keeper + 9 fielders
            loadedMembers: 0
        };
        
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
            { name: 'third_man', x: 30, z: 24, description: 'Third Man' }
        ];
        
        // Load bowler at bowling end
        this.loadBowler();
        
        // Load wicket keeper behind stumps
        this.loadWicketKeeper();
        
        // Load fielders
        fieldingPositions.forEach((position, index) => {
            this.loadFielder(position, index);
        });
        
        console.log('✅ Cricket team loading initiated with optimized standingidle.fbx method');
        console.log('⚡ Loading bowler, keeper, and 9 fielders with immediate idle animations...');
    }

    // ✅ NEW: Track team member loading completion
    onTeamMemberLoaded(memberName) {
        this.teamLoadingState.loadedMembers++;
        const progress = Math.round((this.teamLoadingState.loadedMembers / this.teamLoadingState.totalMembers) * 100);
        
        this.updateLoadingProgress(`👥 Loading cricket team... ${this.teamLoadingState.loadedMembers}/${this.teamLoadingState.totalMembers} (${progress}%)`, progress);
        
        console.log(`✅ ${memberName} loaded (${this.teamLoadingState.loadedMembers}/${this.teamLoadingState.totalMembers})`);
        
        // Check if all team members are loaded
        if (this.teamLoadingState.loadedMembers >= this.teamLoadingState.totalMembers) {
            this.completeLoadingStep('Cricket Team');
            
            // ✅ NEW: Initialize fielder positioning after team is loaded
            setTimeout(() => {
                this.initializeFielderPositioning();
                
                // ✅ NEW: Build initial fielding metadata for hybrid system
                this.rebuildFieldingMeta();
            }, 1000); // Small delay to ensure all positions are set
        }
    }

    loadBowler() {
        const loader = new FBXLoader();
        // Load bowler directly with idle animation
        loader.load('standingidle.fbx', (character) => {
            // Use the same scaling logic as the main character
            this.setupCricketCharacter(character, 1, 0, -9, 0);
            
            // Setup bowler info and animation system
            character.userData = {
                description: 'bowler',
                animationMixer: new THREE.AnimationMixer(character),
                animations: new Map()
            };
            
            // Setup and play idle animation immediately
            if (character.animations && character.animations.length > 0) {
                const idleAction = character.userData.animationMixer.clipAction(character.animations[0]);
                character.userData.animations.set('standingidle', idleAction);
                idleAction.play();
                console.log('🎭 Bowler idle animation started immediately');
            }
            
            // Load additional throwing animation for bowler
            this.loadCharacterAnimation(character, 'Throw.fbx', 'bowler');
            
            this.bowler = character;
            this.cricketCharacters.push(character);
            this.scene.add(character);
            
            // Store bowler's original position
            this.bowlerReceivingSystem.originalPosition = character.position.clone();
            
            // Create invisible catch zone around bowler
            this.createBowlerCatchZone();
            
            console.log('✅ Bowler loaded with immediate idle animation and catch zone');
            
            // ✅ NEW: Mark bowler as loaded
            this.onTeamMemberLoaded('Bowler');
        }, undefined, (error) => {
            console.log('⚠️ standingidle.fbx failed for bowler, falling back to character.fbx + animation loading:', error);
            // Fallback to original method
            this.loadBowlerFallback();
        });
    }

    createBowlerCatchZone() {
        if (!this.bowler) return;
        
        // Create invisible sphere geometry for catch zone
        const catchZoneGeometry = new THREE.SphereGeometry(this.bowlerReceivingSystem.catchZoneRadius, 8, 6);
        const catchZoneMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.0, // Completely invisible
            wireframe: false 
        });
        
        this.bowlerReceivingSystem.catchZone = new THREE.Mesh(catchZoneGeometry, catchZoneMaterial);
        this.bowlerReceivingSystem.catchZone.position.copy(this.bowler.position);
        this.bowlerReceivingSystem.catchZone.position.y += 1.5; // Chest height
        
        // Add to scene but make it invisible
        this.scene.add(this.bowlerReceivingSystem.catchZone);
        
    }

    prepareBowlerForIncomingThrow() {
        if (!this.bowler || !this.bowlerReceivingSystem.catchZone) return;
        
        // Set bowler to receiving state
        this.bowlerReceivingSystem.isReceivingThrow = true;
        
        // Load ready animation for bowler if available
        this.loadCharacterAnimation(this.bowler, 'regularcatch.fbx', 'bowler');
        
        // Play ready-to-receive animation
        setTimeout(() => {
            this.playCricketPlayerAnimation(this.bowler, 'regularcatch');
        }, 200);
        
    }

    checkBowlerCatchZone() {
        // Only check if bowler is ready to receive and ball is moving
        if (!this.bowlerReceivingSystem.isReceivingThrow || 
            !this.ballPhysics.isMoving || 
            !this.bowlerReceivingSystem.catchZone || 
            !this.cricketBall) {
            return;
        }
        
        // Calculate distance between ball and bowler catch zone center
        const ballPosition = this.cricketBall.position;
        const catchZonePosition = this.bowlerReceivingSystem.catchZone.position;
        const distance = ballPosition.distanceTo(catchZonePosition);
        
        // Check if ball is within catch zone
        if (distance <= this.bowlerReceivingSystem.catchZoneRadius) {
            this.bowlerCatchBall();
        }
    }

    bowlerCatchBall() {
        if (!this.bowler || !this.cricketBall) return;
        
        console.log('🥎 DEBUG: bowlerCatchBall() called');
        console.log(`   Ball state: isActive=${this.ballState.isActive}, isComplete=${this.ballState.isComplete}`);
        
        if (this.cricketScore.boundaryAwarded) {
            console.log('📝 Ball already went for a boundary. Ignoring bowler catch.');
            this.ballPhysics.isMoving = false;
            this.ballPhysics.velocity.set(0, 0, 0);
            return;
        }
        
        // ✅ NEW: Check for run-out scenario
        console.log('🔍 About to check for run-out...');
        const isRunOut = this.checkForRunOut();
        
        if (isRunOut) {
            console.log(`🏃‍♂️💥 RUN OUT! Batsman caught short while running!`);
            this.executeRunOut();
            return;
        }
        
        console.log(`✋ Bowler caught ball - ${this.runningSystem.runsCompleted} runs scored`);
        
        // Stop ball movement immediately
        this.ballPhysics.isMoving = false;
        this.ballPhysics.velocity.set(0, 0, 0);
        
        // Position ball in bowler's hands
        this.cricketBall.position.copy(this.bowler.position);
        this.cricketBall.position.y += 1.5; // Hand height
        
        // Reset bowler receiving state
        this.bowlerReceivingSystem.isReceivingThrow = false;
        
        // Play catch completion animation
        this.playCricketPlayerAnimation(this.bowler, 'standingidle');
        
        // Complete the ball (this handles both run-out and normal cases)
        if (this.ballState.isActive) {
            // If ball was already marked as fielded, keep that type, otherwise set as bowler caught
            if (this.ballState.ballType !== 'fielded') {
                this.ballState.ballType = 'fielded';
                this.ballState.completionReason = 'bowler_caught';
            }
            
            console.log('🔚 Bowler caught ball - completing ball now');
            // Force complete the ball immediately (bowler has priority)
            this.forceCompleteBall();
        } else {
            console.log(`⚠️ Cannot complete ball - Ball not active`);
        }
        
    }

    loadWicketKeeper() {
        const loader = new FBXLoader();
        // Load keeper directly with idle animation
        loader.load('standingidle.fbx', (character) => {
            // Use the same scaling logic as the main character
            this.setupCricketCharacter(character, 0, 0, 15, Math.PI);
            
            // Setup keeper info and animation system
            character.userData = {
                description: 'keeper',
                animationMixer: new THREE.AnimationMixer(character),
                animations: new Map()
            };
            
            // Setup and play idle animation immediately
            if (character.animations && character.animations.length > 0) {
                const idleAction = character.userData.animationMixer.clipAction(character.animations[0]);
                character.userData.animations.set('standingidle', idleAction);
                idleAction.play();
                console.log('🎭 Keeper idle animation started immediately');
            }
            
            this.keeper = character;
            this.cricketCharacters.push(character);
            this.scene.add(character);
            
            console.log('✅ Wicket keeper loaded and positioned');
            
            // ✅ NEW: Mark keeper as loaded
            this.onTeamMemberLoaded('Wicket Keeper');
        }, undefined, (error) => {
            console.log('⚠️ standingidle.fbx failed for keeper, falling back to character.fbx + animation loading:', error);
            // Fallback to original method
            this.loadWicketKeeperFallback();
        });
    }

    loadFielder(position, index) {
        const loader = new FBXLoader();
        // Load fielder directly with idle animation
        loader.load('standingidle.fbx', (character) => {
            // Use the same scaling logic as the main character
            this.setupCricketCharacter(character, position.x, 0, position.z, null);
            
            // Make fielder face the batsman/center of pitch
            character.lookAt(0, 0, 5);
            
            // Store fielder info and setup animation system
            character.userData = {
                fieldingPosition: position.name,
                description: position.description,
                animationMixer: new THREE.AnimationMixer(character),
                animations: new Map(),
                // ✅ FIX: Ensure all fielders have required properties
                role: 'fielder',
                topSpeed: this.fieldingSystem.DEFAULT_TOP_SPEED,
                sector: 0,
                lastHandoverTime: 0
            };
            
            // Setup and play idle animation immediately
            if (character.animations && character.animations.length > 0) {
                const idleAction = character.userData.animationMixer.clipAction(character.animations[0]);
                character.userData.animations.set('standingidle', idleAction);
                idleAction.play();
                console.log(`🎭 ${position.description} idle animation started immediately`);
            }
            
            // Store original position for return after fielding
            this.fieldingSystem.fielderOriginalPositions.set(position.description, {
                x: position.x,
                y: 0,
                z: position.z
            });
            
            // Initialize fielder state
            this.fieldingSystem.fielderStates.set(position.description, 'idle');
            
            this.fielders.push(character);
            this.cricketCharacters.push(character);
            this.scene.add(character);
            
            console.log(`✅ ${position.description} loaded with immediate idle animation at (${position.x}, ${position.z})`);
            
            // ✅ NEW: Mark fielder as loaded
            this.onTeamMemberLoaded(position.description);
        }, undefined, (error) => {
            console.log(`⚠️ standingidle.fbx failed for ${position.description}, falling back to character.fbx + animation loading:`, error);
            // Fallback to original method
            this.loadFielderFallback(position, index);
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
        
        // Initialize fielding attributes for hybrid system
        if (!characterModel.userData) {
            characterModel.userData = {};
        }
        
        // Determine role and speed based on position
        const distanceFromStumps = Math.sqrt(x * x + z * z);
        let role = 'fielder';
        let topSpeed = this.fieldingSystem.DEFAULT_TOP_SPEED;
        
        if (characterModel.userData.description) {
            const desc = characterModel.userData.description.toLowerCase();
            if (desc.includes('keeper')) {
                role = 'keeper';
                topSpeed = 7.5; // Keepers are quick but not the fastest
            } else if (desc.includes('bowler')) {
                role = 'bowler';
                topSpeed = 8.5; // Bowlers are generally athletic
            } else if (desc.includes('slip')) {
                role = 'slip';
                topSpeed = 8.2; // Slip fielders need quick reflexes
            } else if (distanceFromStumps < 20) {
                role = 'innerRing';
                topSpeed = 9.0; // Inner ring fielders are usually faster
            } else {
                role = 'boundary';
                topSpeed = 7.8; // Boundary fielders may be slower but have strong arms
            }
        }
        
        characterModel.userData.role = role;
        characterModel.userData.topSpeed = topSpeed;
        characterModel.userData.sector = 0; // Will be calculated in rebuildFieldingMeta
        characterModel.userData.lastHandoverTime = 0;
        
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

    // Fallback methods for loading cricket team members with character.fbx + animation
    loadBowlerFallback() {
        console.log('🔄 Loading bowler with fallback method (character.fbx + animation)');
        const loader = new FBXLoader();
        loader.load('character.fbx', (character) => {
            this.setupCricketCharacter(character, 1, 0, -9, 0);
            
            // Setup user data
            character.userData = {
                description: 'bowler'
            };
            
            // Load idle animation for bowler
            this.loadCharacterAnimation(character, 'standingidle.fbx', 'bowler');
            
            // Load throwing animation for bowler
            this.loadCharacterAnimation(character, 'Throw.fbx', 'bowler');
            
            this.bowler = character;
            this.cricketCharacters.push(character);
            this.scene.add(character);
            
            // Store bowler's original position
            this.bowlerReceivingSystem.originalPosition = character.position.clone();
            
            // Create invisible catch zone around bowler
            this.createBowlerCatchZone();
            
            console.log('✅ Bowler loaded via fallback method');
        }, undefined, (error) => {
            console.log('❌ Bowler fallback loading also failed:', error);
        });
    }

    loadWicketKeeperFallback() {
        console.log('🔄 Loading keeper with fallback method (character.fbx + animation)');
        const loader = new FBXLoader();
        loader.load('character.fbx', (character) => {
            this.setupCricketCharacter(character, 0, 0, 15, Math.PI);
            
            // Setup user data
            character.userData = {
                description: 'keeper'
            };
            
            // Load idle animation for keeper
            this.loadCharacterAnimation(character, 'standingidle.fbx', 'keeper');
            
            this.keeper = character;
            this.cricketCharacters.push(character);
            this.scene.add(character);
            
            console.log('✅ Wicket keeper loaded via fallback method');
        }, undefined, (error) => {
            console.log('❌ Keeper fallback loading also failed:', error);
        });
    }

    loadFielderFallback(position, index) {
        console.log(`🔄 Loading ${position.description} with fallback method (character.fbx + animation)`);
        const loader = new FBXLoader();
        loader.load('character.fbx', (character) => {
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
            
            console.log(`✅ ${position.description} loaded via fallback method at (${position.x}, ${position.z})`);
        }, undefined, (error) => {
            console.log(`❌ ${position.description} fallback loading also failed:`, error);
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
                
                // Extract animation name from file - handle both file paths and file names
                const animName = animationFile.replace('.fbx', '').replace(/.*\//, '');
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
                console.log(`Available animations for ${characterName}:`, Array.from(character.userData.animations.keys()));
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

    // Helper function to wait for animation to load and then play it
    waitForAnimationAndPlay(character, animationName, isLoop = true, callback = null) {
        const maxWaitTime = 5000; // 5 seconds max wait
        const checkInterval = 100; // Check every 100ms
        let totalWaitTime = 0;
        
        const checkAndPlay = () => {
            if (character.userData.animations && character.userData.animations.has(animationName)) {
                // console.log(`🎬 Animation ${animationName} is loaded, playing now...`);
                if (isLoop) {
                    return this.playCricketPlayerAnimation(character, animationName);
                } else {
                    return this.playCricketPlayerAnimationOnce(character, animationName, callback);
                }
            } else if (totalWaitTime < maxWaitTime) {
                totalWaitTime += checkInterval;
                setTimeout(checkAndPlay, checkInterval);
            } else {
                console.log(`❌ Timeout waiting for ${animationName} to load after ${maxWaitTime}ms`);
                console.log(`Available animations for ${character.userData.description || 'character'}:`, 
                    character.userData.animations ? Array.from(character.userData.animations.keys()) : 'none');
                
                // For fielders, if running animation is not available, just keep idle
                if (character.userData.description && character.userData.description !== 'batsman' && animationName === 'runningcharacter') {
                    console.log(`🔄 Fielder ${character.userData.description} falling back to idle animation`);
                    this.playCricketPlayerAnimation(character, 'standingidle');
                }
                
                return false;
            }
        };
        
        checkAndPlay();
    }

    // Cricket team animation management methods
    playCricketPlayerAnimation(character, animationName) {
        if (!character || !character.userData || !character.userData.animations) {
            console.log('Character or animations not available');
            return false;
        }
        
        if (!character.userData.animations.has(animationName)) {
            console.log(`❌ Animation ${animationName} not loaded for this character`);
            console.log(`Available animations for ${character.userData.description || 'character'}:`, Array.from(character.userData.animations.keys()));
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
        
        // console.log(`✅ Playing ${animationName} on ${character.userData.description || 'character'}`);
        return true;
    }

    // Play animation once (no loop) with callback when finished
    playCricketPlayerAnimationOnce(character, animationName, onFinishedCallback) {
        console.log(`🔍 playCricketPlayerAnimationOnce called for ${animationName}`);
        
        if (!character || !character.userData || !character.userData.animations) {
            console.log('❌ Character or animations not available for once animation');
            return false;
        }
        
        if (!character.userData.animations.has(animationName)) {
            console.log(`❌ Animation ${animationName} not loaded for this character`);
            console.log('Available animations:', Array.from(character.userData.animations.keys()));
            return false;
        }
        
        // Stop current animation
        if (character.userData.currentAction) {
            character.userData.currentAction.stop();
        }
        
        // Clean up any existing event listeners to prevent multiple callbacks
        if (character.userData.animationMixer && character.userData.currentFinishedListener) {
            character.userData.animationMixer.removeEventListener('finished', character.userData.currentFinishedListener);
            character.userData.currentFinishedListener = null;
        }
        
        // Play new animation ONCE
        const action = character.userData.animations.get(animationName);
        action.reset();
        action.setLoop(THREE.LoopOnce); // Play once, don't loop
        action.clampWhenFinished = true; // Stay on last frame when finished
        action.play();
        
        character.userData.currentAction = action;
        character.userData.currentAnimationName = animationName;
        
        // Set up callback when animation finishes
        if (onFinishedCallback && character.userData.animationMixer) {
            const mixer = character.userData.animationMixer;
            console.log('🔗 Setting up animation finished callback');
            
            const onFinished = (event) => {
                console.log('🎬 Animation finished event received:', event);
                if (event.action === action) {
                    mixer.removeEventListener('finished', onFinished);
                    character.userData.currentFinishedListener = null;
                    onFinishedCallback();
                }
            };
            
            // Store the listener reference to clean up later
            character.userData.currentFinishedListener = onFinished;
            mixer.addEventListener('finished', onFinished);
        }
        
        console.log(`✅ Playing ${animationName} ONCE on ${character.userData.description || 'character'}`);
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
            f.userData && f.userData.description === fieldingPosition
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
            // Don't process game keys if paused
            if (this.isPaused) return;
            
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
                    // Start running between wickets
                    this.startRun();
                    break;
                case 'KeyL':
                    // Play slide animation
                    this.playSlideAnimation();
                    break;
                case 'KeyT':
                    // Reset running system (for testing)
                    this.resetRunningSystem();
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
                    // Bowl ball towards batsman (manual control)
                    this.manualBowl('straight', new THREE.Vector3(-0.01, 0, 1), 17);
                    break;
                case 'Digit7':
                    // Bowl ball to the left (manual control)
                    this.manualBowl('leftSide', new THREE.Vector3(0.02, 0, 1), 17);
                    break;
                case 'Digit8':
                    // Bowl ball to the right (manual control)
                    this.manualBowl('rightSide', new THREE.Vector3(-0.05, 0, 1), 17);
                    break;
                case 'Digit9':
                    // Bowl a yorker (manual control)
                    this.manualBowl('yorker', new THREE.Vector3(-0.05, 0, 1.25), 20);
                    break;
                case 'Digit0':
                    // Bowl a Bouncer (manual control)
                    this.manualBowl('bouncer', new THREE.Vector3(-0.05, -0.5, 1.5), 25);
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

        // ✅ NEW: Mouse event listeners for fielder positioning
        document.addEventListener('mousedown', (event) => {
            if (!this.fielderPositioning.isActive) return;
            
            this.fielderPositioning.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.fielderPositioning.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            this.handleFielderSelection(event);
        });

        document.addEventListener('mousemove', (event) => {
            if (!this.fielderPositioning.isActive) return;
            
            this.fielderPositioning.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.fielderPositioning.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            if (this.fielderPositioning.isDragging && this.fielderPositioning.selectedFielder) {
                this.handleFielderDrag();
            }
        });

        document.addEventListener('mouseup', (event) => {
            if (!this.fielderPositioning.isActive) return;
            
            this.handleFielderDrop();
        });
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Don't render if paused or not initialized
        if (this.isPaused || !this.isInitialized) return;
        
        // Safety check for renderer
        if (!this.renderer || !this.scene || !this.camera) {
            console.warn('⚠️ Renderer, scene or camera missing in animate loop');
            return;
        }
        
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
        
        // Check if ball enters bowler catch zone
        this.checkBowlerCatchZone();
        
        // Update ball trail
        if (this.ballPhysics.isMoving) {
            this.updateBallTrail();
        }
        
        // Update batting system
        this.updateBatSwing();
        
        // Update fielding system
        this.updateFieldingSystem(deltaTime);
        
        // ✅ NEW: Update fielding debug overlay (throttled)
        if (this.frameCount % 10 === 0) { // Update every 10 frames (~6 times per second)
            this.updateFieldingDebugOverlay();
        }
        this.frameCount = (this.frameCount || 0) + 1;
        
        // Update running system
        this.updateRunningSystem(deltaTime);
        
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

    checkForActiveCatches() {
        // ✅ NEW: Real-time catch detection for balls in flight
        if (!this.fieldingSystem.ballIsHit || 
            this.fieldingSystem.catchingSystem.catchInProgress ||
            !this.ballPhysics.isMoving) {
            return;
        }

        const ballPos = this.cricketBall.position;
        const ballHeight = ballPos.y;
        const ballSpeed = this.ballPhysics.velocity.length();
        
        // Only check for catches if ball is at catchable height and moving reasonably fast
        if (ballHeight < 0.2 || ballHeight > 15 || ballSpeed < 2) {
            return;
        }

        let closestFielder = null;
        let closestDistance = Infinity;
        let bestCatchProbability = 0;
        
        // ✅ IMPROVED: Find fielder with reasonable catch chance, not just closest
        this.fielders.forEach(fielder => {
            const fielderState = this.fieldingSystem.fielderStates.get(fielder.userData.description);
            
            // Only consider idle or chasing fielders for catches
            if (fielderState !== 'idle' && fielderState !== 'chasing' && fielderState !== 'anticipating') {
                return;
            }
            
            const distance = fielder.position.distanceTo(ballPos);
            
            // Check if this fielder is within catch range
            if (distance <= this.fieldingSystem.catchingSystem.catchRadius) {
                // ✅ NEW: Calculate catch probability for this fielder
                const catchProbability = this.calculateCatchProbability(fielder, ballPos, this.ballPhysics.velocity, distance);
                
                console.log(`🎯 ${fielder.userData.description}: ${distance.toFixed(1)}m away, ${(catchProbability * 100).toFixed(1)}% catch chance`);
                
                // ✅ NEW: Only consider fielders with reasonable catch probability (≥20%)
                if (catchProbability >= 0.15) {
                    if (distance < closestDistance || catchProbability > bestCatchProbability) {
                        closestDistance = distance;
                        closestFielder = fielder;
                        bestCatchProbability = catchProbability;
                    }
                } else {
                    console.log(`❌ ${fielder.userData.description} catch probability too low (${(catchProbability * 100).toFixed(1)}% < 15%) - won't attempt`);
                }
            }
        });
        
        if (closestFielder && bestCatchProbability >= 0.15) {
            console.log(`🎯 CATCH OPPORTUNITY! ${closestFielder.userData.description} selected with ${(bestCatchProbability * 100).toFixed(1)}% chance (${closestDistance.toFixed(1)}m, height: ${ballHeight.toFixed(1)}m)`);
            
            // Clear any existing chaser - this fielder is taking over
            if (this.fieldingSystem.chasingFielder && this.fieldingSystem.chasingFielder !== closestFielder) {
                console.log(`   Clearing previous chaser: ${this.fieldingSystem.chasingFielder.userData.description}`);
                this.fieldingSystem.fielderStates.set(this.fieldingSystem.chasingFielder.userData.description, 'idle');
                this.fieldingSystem.chasingFielder = null;
            }
            
            // Attempt the catch
            this.attemptCatch(closestFielder, closestDistance);
        } else if (closestFielder) {
            console.log(`⚠️ Best fielder ${closestFielder.userData.description} has only ${(bestCatchProbability * 100).toFixed(1)}% chance - waiting for better opportunity or ground fielding`);
        }
    }

    showWicketNotification(fielder, catchType) {
        // Create a notification element for catch wicket
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 20px;
                border-radius: 10px;
                font-family: Arial, sans-serif;
                text-align: center;
                z-index: 1000;
                font-size: 20px;
                border: 3px solid #ff0040;
                box-shadow: 0 0 20px rgba(255, 0, 64, 0.5);
                animation: bowledPulse 0.6s ease-in-out;
            ">
                <h2 style="margin: 0 0 10px 0; color: #4ecdc4; font-size: 28px;">🎉 WICKET!</h2>
                <p style="margin: 0; font-weight: bold;">${fielder.userData.description} takes a spectacular ${catchType}!</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Outstanding fielding!</p>
            </div>
            <style>
                @keyframes catchPulse {
                    0% { transform: translateX(-50%) scale(0.8); opacity: 0; }
                    50% { transform: translateX(-50%) scale(1.1); opacity: 1; }
                    100% { transform: translateX(-50%) scale(1); opacity: 1; }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after longer time for catches (more dramatic)
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
        
        console.log('🎉 Catch wicket notification displayed');
    }

    // ✅ NEW: Show run-out notification
    showRunOutNotification() {
        // Create a notification element for run-out
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 20px;
                border-radius: 10px;
                font-family: Arial, sans-serif;
                text-align: center;
                z-index: 1000;
                font-size: 20px;
                border: 3px solid #ff6b35;
                box-shadow: 0 0 20px rgba(255, 107, 53, 0.5);
                animation: runOutPulse 0.6s ease-in-out;
            ">
                <h2 style="margin: 0 0 10px 0; color: #ff6b35; font-size: 28px;">🏃‍♂️💥 RUN OUT!</h2>
                <p style="margin: 0; font-weight: bold;">Batsman caught short of crease!</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Excellent fielding by the team!</p>
            </div>
            <style>
                @keyframes runOutPulse {
                    0% { transform: translateX(-50%) scale(0.8); opacity: 0; }
                    50% { transform: translateX(-50%) scale(1.1); opacity: 1; }
                    100% { transform: translateX(-50%) scale(1); opacity: 1; }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after longer time for run-out (more dramatic)
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
        
        console.log('🏃‍♂️💥 Run-out notification displayed');
    }

    // ✅ NEW: Show bowled notification
    showBowledNotification() {
        // Create a notification element for bowled dismissal
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 20px;
                border-radius: 10px;
                font-family: Arial, sans-serif;
                text-align: center;
                z-index: 1000;
                font-size: 20px;
                border: 3px solid #ff0040;
                box-shadow: 0 0 20px rgba(255, 0, 64, 0.5);
                animation: bowledPulse 0.6s ease-in-out;
            ">
                <h2 style="margin: 0 0 10px 0; color: #ff0040; font-size: 28px;">🎯💥 BOWLED!</h2>
                <p style="margin: 0; font-weight: bold;">Batsman missed and ball hit the stumps!</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Perfect bowling delivery!</p>
            </div>
            <style>
                @keyframes bowledPulse {
                    0% { transform: translateX(-50%) scale(0.8); opacity: 0; }
                    50% { transform: translateX(-50%) scale(1.1); opacity: 1; }
                    100% { transform: translateX(-50%) scale(1); opacity: 1; }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after time
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
        
        console.log('🎯💥 Bowled notification displayed');
    }

    // Method to remove objects from the scene (for future use)
    removeFromScene(object) {
        this.scene.remove(object);
    }

    // ✅ NEW: Calculate catch probability without side effects (for threshold checking)
    calculateCatchProbability(fielder, ballPosition, ballVelocity, distance = null) {
        if (!fielder || !ballPosition || !ballVelocity) return 0;
        
        // Use provided distance or calculate it
        const catchDistance = distance || fielder.position.distanceTo(ballPosition);
        const ballSpeed = ballVelocity.length();
        
        // Start with 100% probability
        let catchProbability = 1.0;
        
        // Reduce probability based on distance
        const maxDistance = this.fieldingSystem.catchingSystem.catchRadius;
        const distanceFactor = Math.max(0, 1 - (catchDistance / maxDistance));
        catchProbability *= distanceFactor;
        
        // Reduce probability based on ball speed
        const speedFactor = Math.max(0.3, 1 - (ballSpeed / 30));
        catchProbability *= speedFactor;
        
        // Determine catch type and apply difficulty modifier
        const divingRadius = this.fieldingSystem.catchingSystem.divingCatchRadius;
        const isDivingCatch = catchDistance > divingRadius;
        
        if (isDivingCatch) {
            catchProbability *= 0.7; // 30% harder for diving catches
        }
        
        // Ensure probability is between 0 and 1
        return Math.max(0, Math.min(1, catchProbability));
    }

    // ✅ NEW: Fielder Positioning System Methods

    initializeFielderPositioning() {
        // Store default positions for all fielders
        this.fielders.forEach((fielder, index) => {
            if (fielder && fielder.position && fielder.userData && fielder.userData.description) {
                const defaultPos = fielder.position.clone();
                this.fielderPositioning.defaultPositions.set(fielder.userData.description, defaultPos);
                this.fielderPositioning.customPositions.set(fielder.userData.description, defaultPos.clone());
                console.log(`📍 Stored default position for ${fielder.userData.description}: (${defaultPos.x.toFixed(1)}, ${defaultPos.z.toFixed(1)})`);
            }
        });
        
        // Create selection indicator (glowing ring)
        const ringGeometry = new THREE.RingGeometry(1.5, 2.0, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        this.fielderPositioning.selectionIndicator = new THREE.Mesh(ringGeometry, ringMaterial);
        this.fielderPositioning.selectionIndicator.rotation.x = -Math.PI / 2; // Lay flat on ground
        this.fielderPositioning.selectionIndicator.visible = false;
        this.scene.add(this.fielderPositioning.selectionIndicator);
        
        // Set up UI event listeners
        this.setupFieldingUIListeners();
        
        console.log('✅ Fielder positioning system initialized');
    }

    setupFieldingUIListeners() {
        const fieldingModeBtn = document.getElementById('fieldingModeBtn');
        const resetFieldingBtn = document.getElementById('resetFieldingBtn');
        const exitFieldingBtn = document.getElementById('exitFieldingBtn');
        
        if (fieldingModeBtn) {
            fieldingModeBtn.addEventListener('click', () => {
                this.enterFieldingMode();
            });
        }
        
        if (resetFieldingBtn) {
            resetFieldingBtn.addEventListener('click', () => {
                this.resetFielderPositions();
            });
        }
        
        if (exitFieldingBtn) {
            exitFieldingBtn.addEventListener('click', () => {
                this.exitFieldingMode();
            });
        }
    }

    enterFieldingMode() {
        this.fielderPositioning.isActive = true;
        this.fielderPositioning.camera = this.camera; // Store camera reference
        
        // Update UI
        document.getElementById('fieldingModeBtn').style.display = 'none';
        document.getElementById('resetFieldingBtn').style.display = 'block';
        document.getElementById('exitFieldingBtn').style.display = 'block';
        
        // Add visual indicators to all fielders
        this.addFielderIndicators();
        
        // Pause ball physics if active
        if (this.ballPhysics.isMoving) {
            this.ballPhysics.isMoving = false;
            this.ballPhysics.velocity.set(0, 0, 0);
            console.log('⏸️ Ball physics paused for fielding mode');
        }
        
        console.log('🎯 Entered fielding mode');
    }

    exitFieldingMode() {
        this.fielderPositioning.isActive = false;
        this.fielderPositioning.selectedFielder = null;
        this.fielderPositioning.isDragging = false;
        
        // Update UI
        document.getElementById('fieldingModeBtn').style.display = 'block';
        document.getElementById('resetFieldingBtn').style.display = 'none';
        document.getElementById('exitFieldingBtn').style.display = 'none';
        
        // Remove visual indicators
        this.removeFielderIndicators();
        this.fielderPositioning.selectionIndicator.visible = false;
        
        // Update fielding zones with new positions
        this.updateFieldingZones();
        
        console.log('✅ Exited fielding mode');
    }

    resetFielderPositions() {
        // Reset all fielders to default positions
        this.fielders.forEach((fielder) => {
            if (fielder && fielder.userData && fielder.userData.description) {
                const defaultPos = this.fielderPositioning.defaultPositions.get(fielder.userData.description);
                if (defaultPos) {
                    fielder.position.copy(defaultPos);
                    this.fielderPositioning.customPositions.set(fielder.userData.description, defaultPos.clone());
                    
                    // ✅ Also update the original positions map for consistency
                    this.fieldingSystem.fielderOriginalPositions.set(fielder.userData.description, defaultPos.clone());
                    
                    console.log(`🔄 Reset ${fielder.userData.description} to default position`);
                }
            }
        });
        
        // Update position indicators if visible
        this.updatePositionIndicators();
        
        console.log('🔄 Reset all fielders to default positions');
    }

    addFielderIndicators() {
        // Add hover/selection indicators to all fielders
        this.fielders.forEach((fielder) => {
            if (fielder) {
                // Create position indicator ring
                const ringGeometry = new THREE.RingGeometry(0.8, 1.2, 12);
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: 0x4444ff,
                    transparent: true,
                    opacity: 0.4,
                    side: THREE.DoubleSide
                });
                
                const indicator = new THREE.Mesh(ringGeometry, ringMaterial);
                indicator.rotation.x = -Math.PI / 2;
                indicator.position.copy(fielder.position);
                indicator.position.y = 0.1; // Slightly above ground
                
                indicator.userData.isFielderIndicator = true;
                indicator.userData.parentFielder = fielder;
                
                this.scene.add(indicator);
                this.fielderPositioning.positionIndicators.push(indicator);
            }
        });
    }

    removeFielderIndicators() {
        this.fielderPositioning.positionIndicators.forEach(indicator => {
            this.scene.remove(indicator);
            if (indicator.geometry) indicator.geometry.dispose();
            if (indicator.material) indicator.material.dispose();
        });
        this.fielderPositioning.positionIndicators = [];
    }

    updatePositionIndicators() {
        // Update position indicator positions to match fielders
        this.fielderPositioning.positionIndicators.forEach(indicator => {
            if (indicator.userData.parentFielder) {
                indicator.position.copy(indicator.userData.parentFielder.position);
                indicator.position.y = 0.1;
            }
        });
    }

    handleFielderSelection(event) {
        this.fielderPositioning.raycaster.setFromCamera(this.fielderPositioning.mousePosition, this.camera);
        
        // Check for fielder intersections
        const intersects = this.fielderPositioning.raycaster.intersectObjects(this.fielders, true);
        
        if (intersects.length > 0) {
            // Find the fielder object (might be nested in the model)
            let selectedFielder = null;
            for (let intersect of intersects) {
                let obj = intersect.object;
                while (obj && !obj.userData.description) {
                    obj = obj.parent;
                }
                if (obj && obj.userData.description) {
                    selectedFielder = obj;
                    break;
                }
            }
            
            if (selectedFielder) {
                this.fielderPositioning.selectedFielder = selectedFielder;
                this.fielderPositioning.isDragging = true;
                this.fielderPositioning.dragStartPosition.copy(selectedFielder.position);
                
                // Show selection indicator
                this.fielderPositioning.selectionIndicator.position.copy(selectedFielder.position);
                this.fielderPositioning.selectionIndicator.position.y = 0.2;
                this.fielderPositioning.selectionIndicator.visible = true;
                
                // Disable camera controls during drag
                this.controls.enabled = false;
                
                console.log(`🎯 Selected fielder: ${selectedFielder.userData.description}`);
            }
        }
    }

    handleFielderDrag() {
        if (!this.fielderPositioning.selectedFielder) return;
        
        // Cast ray to ground plane
        this.fielderPositioning.raycaster.setFromCamera(this.fielderPositioning.mousePosition, this.camera);
        
        // Create ground plane for intersection
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        
        if (this.fielderPositioning.raycaster.ray.intersectPlane(groundPlane, intersection)) {
            // Validate position
            const validPosition = this.validateFielderPosition(intersection);
            
            if (validPosition) {
                this.fielderPositioning.selectedFielder.position.copy(intersection);
                this.fielderPositioning.selectionIndicator.position.copy(intersection);
                this.fielderPositioning.selectionIndicator.position.y = 0.2;
                
                // Update indicator color based on validity
                this.fielderPositioning.selectionIndicator.material.color.setHex(0x00ff00); // Green for valid
            } else {
                // Red for invalid position
                this.fielderPositioning.selectionIndicator.material.color.setHex(0xff0000);
            }
        }
    }

    handleFielderDrop() {
        if (this.fielderPositioning.selectedFielder) {
            const finalPosition = this.fielderPositioning.selectedFielder.position.clone();
            
            if (!this.validateFielderPosition(finalPosition)) {
                // Invalid position - revert to start
                this.fielderPositioning.selectedFielder.position.copy(this.fielderPositioning.dragStartPosition);
                console.log('❌ Invalid fielder position - reverted to original');
            } else {
                // Valid position - save it
                const fieldingPosition = this.fielderPositioning.selectedFielder.userData.description;
                this.fielderPositioning.customPositions.set(fieldingPosition, finalPosition.clone());
                
                // ✅ CRITICAL FIX: Immediately update the original positions map
                // This ensures that resetPlayersForNextBall() uses the new custom position
                this.fieldingSystem.fielderOriginalPositions.set(fieldingPosition, finalPosition.clone());
                
                console.log(`✅ Moved ${fieldingPosition} to new position and updated original position map`);
            }
            
            // Update position indicators
            this.updatePositionIndicators();
            
            // ✅ NEW: Rebuild fielding metadata after position change
            this.rebuildFieldingMeta();
            
            // Reset drag state
            this.fielderPositioning.selectedFielder = null;
            this.fielderPositioning.isDragging = false;
            this.fielderPositioning.selectionIndicator.visible = false;
            
            // Re-enable camera controls
            this.controls.enabled = true;
        }
    }

    validateFielderPosition(position) {
        // Check boundary limits
        const distanceFromCenter = Math.sqrt(position.x * position.x + position.z * position.z);
        if (distanceFromCenter > (this.FIELD_RADIUS - this.fielderPositioning.boundaryBuffer)) {
            return false;
        }
        
        // Check minimum distance from batsman (at 0, 0, 9)
        const batsmanPosition = new THREE.Vector3(0, 0, 9);
        const distanceFromBatsman = position.distanceTo(batsmanPosition);
        if (distanceFromBatsman < this.fielderPositioning.minDistanceFromBatsman) {
            return false;
        }
        
        // Check minimum distance from other fielders
        for (let fielder of this.fielders) {
            if (fielder && fielder !== this.fielderPositioning.selectedFielder) {
                const distance = position.distanceTo(fielder.position);
                if (distance < this.fielderPositioning.minDistanceBetweenFielders) {
                    return false;
                }
            }
        }
        
        return true;
    }

    updateFieldingZones() {
        // Recalculate which fielders are in which zones based on new positions
        // This will be called when exiting fielding mode
        
        // Update fielder original positions map for the return-to-position system
        this.fielders.forEach((fielder) => {
            if (fielder && fielder.userData && fielder.userData.description) {
                const customPosition = this.fielderPositioning.customPositions.get(fielder.userData.description);
                if (customPosition) {
                    // Update the original positions map used by the reset system
                    this.fieldingSystem.fielderOriginalPositions.set(fielder.userData.description, customPosition.clone());
                    console.log(`🎯 Updated ${fielder.userData.description} original position to custom position`);
                }
            }
        });
        
        console.log('🔄 Updated fielding zones with new positions');
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
        
        // Expose game control functions for menu system
        window.startCricketGame = () => game.start();
        window.pauseCricketGame = () => game.pause();
        window.resumeCricketGame = () => game.resume();
        window.stopCricketGame = () => game.stop();
        
        // Expose settings functions
        window.setGraphicsQuality = (quality) => game.setGraphicsQuality(quality);
        window.setShadowsEnabled = (enabled) => game.setShadowsEnabled(enabled);
        window.setBallTrailEnabled = (enabled) => game.setBallTrailEnabled(enabled);
        
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
        
        // ✅ NEW: Expose AI Bowler controls to console
        window.enableAIBowler = () => game.enableAIBowler();
        window.disableAIBowler = () => game.disableAIBowler();
        window.setAIBowlingStrategy = (strategy) => game.setAIBowlingStrategy(strategy);
        window.getAIBowlerStats = () => game.getAIBowlerStats();
        window.humanBowlSelected = (variation) => game.humanBowlSelected(variation);
        
        // ✅ NEW: Expose Multiplayer Bowling controls
        window.enableMultiplayerBowling = (playerId) => game.enableMultiplayerBowling(playerId);
        window.disableMultiplayerBowling = () => game.disableMultiplayerBowling();
        
        // ✅ NEW: AI Bowler demonstration function
        window.demoAIBowler = () => {
            console.log('🎳 AI BOWLER DEMONSTRATION');
            console.log('==========================');
            console.log('✅ AI Bowler is now integrated into the game!');
            console.log('');
            console.log('🎮 FREE PLAY MODE FEATURES:');
            console.log('  • Toggle button in bottom-right corner');
            console.log('  • Switch between AI and manual bowling');
            console.log('  • Manual controls with digit keys 6-0');
            console.log('  • Real-time help display when manual');
            console.log('');
            console.log('🤖 AUTOMATIC FEATURES:');
            console.log('  • Bowls automatically 3 seconds after each ball');
            console.log('  • Shows 3-2-1 countdown before bowling');
            console.log('  • Uses all 5 bowling variations (keys 6-0)');
            console.log('  • Adapts strategy based on game situation');
            console.log('');
            console.log('🎯 BOWLING VARIATIONS:');
            Object.entries(game.aiBowler.bowlingVariations).forEach(([key, variation]) => {
                console.log(`  • ${variation.name}: ${variation.description} (${variation.difficulty})`);
            });
            console.log('');
            console.log('🧠 AI STRATEGIES:');
            Object.entries(game.aiBowler.strategies).forEach(([key, strategy]) => {
                console.log(`  • ${key}: ${strategy.description}`);
            });
            console.log('');
            console.log('🎮 TRY IT NOW:');
            console.log('  1. Start Free Play mode');
            console.log('  2. Look for toggle button in bottom-right');
            console.log('  3. Toggle AI ON/OFF as desired');
            console.log('  4. Use digit keys 6-0 when AI is OFF');
            console.log('');
            console.log('⚡ QUICK COMMANDS:');
            console.log('  • toggleAIBowler() - toggle via console');
            console.log('  • disableAIBowler() - disable for manual control');
            console.log('  • enableAIBowler() - re-enable automatic bowling');
            console.log('  • setAIBowlingStrategy("aggressive") - change AI strategy');
            console.log('  • getAIBowlerStats() - view AI performance');
            console.log('');
            console.log('🚀 PERFECT FOR PRACTICE: Full control over bowling pace and style!');
        };
        
        // ✅ NEW: AI Bowler toggle demonstration
        window.demoAIBowlerToggle = () => {
            console.log('🔄 AI BOWLER TOGGLE DEMO');
            console.log('========================');
            console.log('');
            console.log('🎮 HOW TO USE:');
            console.log('  1. Start Free Play mode (not Target Chase)');
            console.log('  2. Look for 🤖 AI Bowler button in bottom-right corner');
            console.log('  3. Click to toggle between AI and Manual modes');
            console.log('');
            console.log('🤖 AI MODE (Default):');
            console.log('  • Green button: "AI Bowler: ON"');
            console.log('  • Automatic 3-second countdown');
            console.log('  • Intelligent strategy selection');
            console.log('  • Digit keys 6-0 are blocked');
            console.log('');
            console.log('👤 MANUAL MODE:');
            console.log('  • Red button: "AI Bowler: OFF"');
            console.log('  • Manual bowling help appears');
            console.log('  • Full control with digit keys:');
            console.log('    - 6: Straight delivery');
            console.log('    - 7: Bowl to left');
            console.log('    - 8: Bowl to right');
            console.log('    - 9: Yorker (fast & low)');
            console.log('    - 0: Bouncer (short & aggressive)');
            console.log('');
            console.log('💡 SMART FEATURES:');
            console.log('  • Blocked manual bowling shows helpful notification');
            console.log('  • Manual bowling shows delivery info');
            console.log('  • Toggle persists during gameplay');
            console.log('  • Works seamlessly with existing game flow');
            console.log('');
            console.log('🎯 PERFECT FOR:');
            console.log('  • Learning different bowling styles');
            console.log('  • Practicing batting against specific deliveries');
            console.log('  • Full control over game pacing');
            console.log('  • Training and skill development');
        };
        
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
        
        // Running system controls
        window.startRun = () => game.startRun();
        window.playSlide = () => game.playSlideAnimation();
        window.resetRunning = () => game.resetRunningSystem();
        window.showRunningStatus = () => {
            console.log('🏃‍♂️ Running System Status:');
            console.log(`  Running: ${game.runningSystem.isRunning}`);
            console.log(`  State: ${game.runningSystem.runState}`);
            console.log(`  Current End: ${game.runningSystem.currentEnd}`);
            console.log(`  Target End: ${game.runningSystem.targetEnd}`);
            console.log(`  Progress: ${(game.runningSystem.runProgress * 100).toFixed(1)}%`);
            console.log(`  Runs Completed: ${game.runningSystem.runsCompleted}`);
            console.log(`  Waiting for Next Run: ${game.runningSystem.waitingForNextRun}`);
            
            // ✅ NEW: Add run-out risk assessment
            if (game.runningSystem.isRunning) {
                const runProgress = game.runningSystem.runProgress;
                const isInMiddleOfRun = runProgress > 0 && runProgress < 1.0;
                console.log(`  🚨 Run-out Risk: ${isInMiddleOfRun ? 'HIGH (mid-run)' : 'LOW (at crease)'}`);
                if (isInMiddleOfRun) {
                    console.log(`     ⚠️ If ball reaches bowler now = RUN OUT!`);
                }
            }
        };
        
        // Debug turn animation
        window.testTurnAnimation = () => {
            console.log('🔍 Testing turn animation...');
            if (game.character && game.character.userData && game.character.userData.animations) {
                console.log('Available animations:', Array.from(game.character.userData.animations.keys()));
                game.loadCharacterAnimation(game.character, 'leftturn.fbx', 'batsman');
                setTimeout(() => {
                    game.playCricketPlayerAnimationOnce(game.character, 'leftturn', () => {
                        console.log('✅ Turn animation test completed!');
                        game.playCricketPlayerAnimation(game.character, 'standingidle');
                    });
                }, 300);
            } else {
                console.log('❌ Character not ready for animation test');
            }
        };
        
        // Debug animation states
        window.debugAnimations = () => {
            game.debugAnimations();
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

        // 3D Scoreboard controls
        window.updateScoreboards = () => {
            game.update3DScoreboards();
            console.log('📊 3D scoreboards manually updated');
        };
        
        window.setTestScore = (runs = 50, wickets = 3, overs = 12.4) => {
            game.cricketScore.runs = runs;
            game.cricketScore.wickets = wickets;
            game.cricketScore.overs = overs;
            game.updateCricketScore();
            console.log(`🎯 Test score set: ${runs}/${wickets} in ${overs} overs`);
        };
        
        window.hideScoreboards = () => {
            if (game.scoreboards.panels.batsman) game.scoreboards.panels.batsman.visible = false;
            if (game.scoreboards.panels.bowler) game.scoreboards.panels.bowler.visible = false;
            console.log('👁️ 3D scoreboards hidden');
        };
        
        window.showScoreboards = () => {
            if (game.scoreboards.panels.batsman) game.scoreboards.panels.batsman.visible = true;
            if (game.scoreboards.panels.bowler) game.scoreboards.panels.bowler.visible = true;
            console.log('👁️ 3D scoreboards shown');
        };
        
        // Enhanced real-time fielding debug
        window.debugFieldingLive = () => {
            if (!game.cricketBall) {
                console.log('❌ No ball found');
                return;
            }
            
            const ballPos = game.cricketBall.position;
            const ballVel = game.ballPhysics.velocity;
            const ballMoving = game.ballPhysics.isMoving;
            const ballHit = game.fieldingSystem.ballIsHit;
            
            console.log('🔍 LIVE FIELDING DEBUG:');
            console.log(`📍 Ball: (${ballPos.x.toFixed(1)}, ${ballPos.y.toFixed(1)}, ${ballPos.z.toFixed(1)})`);
            console.log(`⚡ Velocity: (${ballVel.x.toFixed(1)}, ${ballVel.y.toFixed(1)}, ${ballVel.z.toFixed(1)}) Speed: ${ballVel.length().toFixed(1)}`);
            console.log(`🎯 Ball Status: Moving=${ballMoving}, Hit=${ballHit}`);
            
            // Test ball landing prediction
            const landing = game.predictBallLanding();
            if (landing) {
                console.log(`🎯 Predicted landing: (${landing.x.toFixed(1)}, ${landing.z.toFixed(1)})`);
            } else {
                console.log('❌ Could not predict landing');
            }
            
            console.log('👥 FIELDER ANALYSIS:');
            let closestToLanding = null;
            let closestLandingDist = Infinity;
            let closestToBall = null;
            let closestBallDist = Infinity;
            
            game.fielders.forEach(fielder => {
                const pos = fielder.position;
                const state = game.fieldingSystem.fielderStates.get(fielder.userData.description);
                const ballDist = pos.distanceTo(ballPos);
                const landingDist = landing ? pos.distanceTo(landing) : 'N/A';
                
                console.log(`  ${fielder.userData.description}:`);
                console.log(`    Position: (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
                console.log(`    State: ${state}`);
                console.log(`    Distance to ball: ${ballDist.toFixed(1)}m`);
                console.log(`    Distance to landing: ${typeof landingDist === 'number' ? landingDist.toFixed(1) + 'm' : landingDist}`);
                
                if (ballDist < closestBallDist) {
                    closestBallDist = ballDist;
                    closestToBall = fielder;
                }
                
                if (landing && landingDist < closestLandingDist) {
                    closestLandingDist = landingDist;
                    closestToLanding = fielder;
                }
                
                // ✅ NEW: Show catch eligibility
                if (ballDist <= game.fieldingSystem.catchingSystem.catchRadius) {
                    console.log(`    🎯 CATCH ELIGIBLE! (${ballDist.toFixed(1)}m <= ${game.fieldingSystem.catchingSystem.catchRadius}m)`);
                }
                
                // Check immediate pickup eligibility
                if (ballDist <= 2.0) {
                    console.log(`    🚨 IMMEDIATE PICKUP RANGE! (${ballDist.toFixed(1)}m <= 2.0m)`);
                }
            });
            
            console.log(`🏆 CLOSEST TO BALL: ${closestToBall ? closestToBall.userData.description : 'None'} (${closestBallDist.toFixed(1)}m)`);
            console.log(`🎯 CLOSEST TO LANDING: ${closestToLanding ? closestToLanding.userData.description : 'None'} (${closestLandingDist.toFixed(1)}m)`);
            
            // Check system states
            console.log('🔧 SYSTEM STATUS:');
            console.log(`   Catch in progress: ${game.fieldingSystem.catchingSystem.catchInProgress}`);
            console.log(`   Catching fielder: ${game.fieldingSystem.catchingSystem.catchingFielder?.userData?.description || 'None'}`);
            console.log(`   Chasing fielder: ${game.fieldingSystem.chasingFielder ? game.fieldingSystem.chasingFielder.userData.description : 'None'}`);
            console.log(`   Nearest fielder: ${game.fieldingSystem.nearestFielder ? game.fieldingSystem.nearestFielder.userData.description : 'None'}`);
        };
        
        // ✅ NEW: Scorecard System Controls
        window.showScorecard = () => {
            if (!game.scorecardUI.isVisible) {
                game.toggleScorecard();
            }
            console.log('📊 Scorecard displayed');
        };
        
        window.hideScorecard = () => {
            if (game.scorecardUI.isVisible) {
                game.toggleScorecard();
            }
            console.log('📊 Scorecard hidden');
        };
        
        window.updateScorecard = () => {
            game.updateScorecardDisplay();
            console.log('📊 Scorecard updated');
        };
        
        window.resetTeamStats = () => {
            // Reset all player stats
            game.battingTeam.players.forEach(player => {
                player.runs = 0;
                player.ballsFaced = 0;
                player.dismissal = null;
                player.isOut = false;
            });
            
            // Reset team position
            game.battingTeam.currentBatsman = 0;
            game.battingTeam.currentPartner = 1;
            
            // Reset extras
            game.battingTeam.extras = {
                byes: 0, legByes: 0, wides: 0, noBalls: 0, penalties: 0
            };
            
            // Update display
            if (game.scorecardUI.isVisible) {
                game.updateScorecardDisplay();
            }
            
            console.log('🔄 Team stats reset to starting position');
        };
        
        window.simulateInnings = () => {
            console.log('🏏 Simulating a sample innings...');
            
            // Reset first
            window.resetTeamStats();
            
            // Simulate some realistic scores
            const performances = [
                { runs: 95, balls: 231, dismissal: 'caught' },      // A Cook
                { runs: 26, balls: 59, dismissal: 'bowled' },       // S Robson  
                { runs: 156, balls: 288, dismissal: 'run out' },    // G Ballance
                { runs: 167, balls: 256, dismissal: 'caught' },     // I Bell
                { runs: 3, balls: 25, dismissal: 'bowled' },        // J Root
                { runs: 12, balls: 28, dismissal: 'caught' },       // Moeen Ali
                { runs: 85, balls: 83, dismissal: 'caught' },       // J Buttler
                { runs: 7, balls: 12, dismissal: null },            // C Woakes (not out)
                { runs: 0, balls: 0, dismissal: null },             // C Jordan (not out)
                { runs: 0, balls: 0, dismissal: null },             // S Broad (not out)
                { runs: 0, balls: 0, dismissal: null }              // J Anderson (not out)
            ];
            
            // Apply simulated data
            performances.forEach((perf, index) => {
                const player = game.battingTeam.players[index];
                player.runs = perf.runs;
                player.ballsFaced = perf.balls;
                if (perf.dismissal) {
                    player.isOut = true;
                    player.dismissal = perf.dismissal;
                }
            });
            
            // Set current batsmen (those not out)
            game.battingTeam.currentBatsman = 7;  // C Woakes
            game.battingTeam.currentPartner = 8;  // C Jordan
            
            // Add some extras
            game.battingTeam.extras.byes = 4;
            game.battingTeam.extras.legByes = 8;
            game.battingTeam.extras.wides = 3;
            game.battingTeam.extras.noBalls = 3;
            
            // Update total score to match
            const totalRuns = performances.reduce((sum, p) => sum + p.runs, 0) + 18; // +18 for extras
            game.cricketScore.runs = totalRuns;
            game.cricketScore.wickets = 7;
            game.cricketScore.balls = 981; // 163.3 overs
            game.cricketScore.overs = 163.3;
            
            // Update displays
            game.updateCricketScore();
            if (game.scorecardUI.isVisible) {
                game.updateScorecardDisplay();
            }
            
            console.log(`✅ Sample innings simulated: ${totalRuns}/7 (163.3 overs)`);
            console.log('📊 Run showScorecard() to see the full scorecard');
        };
        
        window.testWicket = (dismissalType = 'caught') => {
            // Start a new ball and record a wicket
            game.startNewBall();
            game.ballState.ballType = 'wicket';
            
            // ✅ FIXED: Properly handle all dismissal types
            if (dismissalType === 'run out') {
                game.ballState.completionReason = 'run_out';
            } else if (dismissalType === 'bowled') {
                game.ballState.completionReason = 'bowled';
            } else {
                game.ballState.completionReason = 'caught';
            }
            
            game.ballState.runsThisBall = 0;
            
            // Complete the ball to trigger wicket processing
            game.doCompleteBall();
            
            console.log(`🏏 Test wicket recorded: ${dismissalType}`);
        };
        
        window.testBoundary = (boundaryType = 4) => {
            // Start a new ball and score boundary
            game.startNewBall();
            game.ballState.ballType = 'boundary';
            game.ballState.completionReason = 'boundary';
            game.ballState.runsThisBall = boundaryType;
            
            // Complete the ball
            game.doCompleteBall();
            
            console.log(`🏏 Test boundary scored: ${boundaryType} runs`);
        };
        
        window.getCurrentBatsman = () => {
            const striker = game.battingTeam.players[game.battingTeam.currentBatsman];
            const nonStriker = game.battingTeam.players[game.battingTeam.currentPartner];
            
            console.log(`🏏 Current Batsmen:`);
            console.log(`   On Strike: ${striker.name} (${striker.runs} runs, ${striker.ballsFaced} balls) ${striker.isOut ? '[OUT]' : ''}`);
            console.log(`   Non-Strike: ${nonStriker.name} (${nonStriker.runs} runs, ${nonStriker.ballsFaced} balls) ${nonStriker.isOut ? '[OUT]' : ''}`);
            
            return { striker, nonStriker };
        };
        
        window.showBattingLineup = () => {
            console.log('🏏 Complete Batting Lineup:');
            console.log('=====================================');
            
            game.battingTeam.players.forEach((player, index) => {
                let status = '';
                if (index === game.battingTeam.currentBatsman) {
                    status = '🔥 ON STRIKE';
                } else if (index === game.battingTeam.currentPartner) {
                    status = '⚡ NON-STRIKER';
                } else if (player.isOut) {
                    status = `❌ OUT (${player.dismissal})`;
                } else {
                    status = '⏳ WAITING';
                }
                
                console.log(`${index + 1}. ${player.name}: ${player.runs} runs (${player.ballsFaced} balls) - ${status}`);
            });
            
            const wicketsDown = game.battingTeam.players.filter(p => p.isOut).length;
            console.log(`\n📊 Summary: ${game.cricketScore.runs}/${wicketsDown} (${game.cricketScore.overs.toFixed(1)} overs)`);
        };
        
        window.setTeamName = (name) => {
            game.battingTeam.teamName = name;
            if (game.scorecardUI.isVisible) {
                game.updateScorecardDisplay();
            }
            console.log(`🏏 Team name set to: ${name}`);
        };
        
        window.testBatsmanPromotion = () => {
            console.log('🧪 TESTING BATSMAN PROMOTION SYSTEM');
            console.log('====================================');
            
            // Reset to start
            window.resetTeamStats();
            
            console.log('\n1️⃣ Initial lineup:');
            window.showBattingLineup();
            
            // Score some runs with first batsman
            console.log('\n2️⃣ A Cook scores 15 runs...');
            for (let i = 0; i < 3; i++) {
                game.startNewBall();
                game.ballState.runsThisBall = 5;
                game.doCompleteBall();
            }
            window.getCurrentBatsman();
            
            // First wicket
            console.log('\n3️⃣ A Cook gets out (caught)...');
            window.testWicket('caught');
            console.log('After wicket:');
            window.showBattingLineup();
            
            // Score with new pair
            console.log('\n4️⃣ Current pair scores 10 runs...');
            for (let i = 0; i < 2; i++) {
                game.startNewBall();
                game.ballState.runsThisBall = 5;
                game.doCompleteBall();
            }
            window.getCurrentBatsman();
            
            // Second wicket
            console.log('\n5️⃣ Another wicket (run out)...');
            window.testWicket('run out');
            console.log('After second wicket:');
            window.showBattingLineup();
            
            console.log('\n✅ PROMOTION TEST COMPLETE!');
            console.log('📊 Check scorecard to see the progression');
            window.showScorecard();
        };
        
        // ✅ NEW: Test the improved fielding system
        window.testImprovedFieldingV3 = () => {
            console.log('🚀 Testing Improved Fielding System v3.0');
            console.log('==========================================');
            console.log('');
            console.log('✅ NEW FEATURES:');
            console.log('  🎯 Real-time catch detection (checkForActiveCatches)');
            console.log('  🏃 Closest fielder prioritization');
            console.log('  ⚡ Immediate response (no artificial delays)');
            console.log('  🎭 Dual criteria: closest to ball + closest to landing');
            console.log('  🔄 Improved state management');
            console.log('  🏏 WICKET HANDLING: Proper scoring, notifications, and ball completion');
            console.log('  🏃‍♂️💥 RUN-OUT SYSTEM: Automatic run-out detection when ball reaches bowler');
            console.log('');
            console.log('🧪 TESTING COMMANDS:');
            console.log('  bowlStraight() - Bowl ball straight down pitch');
            console.log('  playUpperCut() - Hit ball high to off-side');
            console.log('  playLoftedShot() - Hit ball high and straight');
            console.log('  playSlog() - Aggressive shot to leg-side');
            console.log('  debugFieldingLive() - Real-time analysis');
            console.log('  checkFieldingStates() - Check all fielder states');
            console.log('  stopAllFielders() - Emergency stop all fielding');
            console.log('  testWicketScenario() - Force a wicket to test scoring');
            console.log('  testRunOutScenario() - Force a run-out to test system');
            console.log('  testBowledScenario() - Force a bowled dismissal');
            console.log('  testLiveBowledDetection() - Instructions for live testing');
            console.log('  simulateBowledMiss() - Automated bowled test scenario');
            console.log('  debugBowledDetection() - Debug bowled detection system');
            console.log('  testBowledCollision() - Force test collision detection');
            console.log('');
            console.log('🔧 WHAT TO LOOK FOR:');
            console.log('  ✅ Fielders closest to ball should respond first');
            console.log('  ✅ Immediate catch attempts for balls in flight');
            console.log('  ✅ No delays or wrong fielder assignments');
            console.log('  ✅ Clear console messaging about fielder selection');
            console.log('  ✅ Proper wicket notifications and scoring when catches succeed');
            console.log('  ✅ Run-outs when batsman is caught mid-run');
            console.log('  ✅ Bowled dismissals when ball hits stumps (batsman misses)');
            console.log('');
            console.log('Bowl a ball and watch the console for detailed fielding analysis!');
        };
        
        // ✅ NEW: Test wicket scenario
        window.testWicketScenario = () => {
            console.log('🧪 Testing Wicket Scenario...');
            
            if (!game.fielders || game.fielders.length === 0) {
                console.log('❌ No fielders available for wicket test');
                return;
            }
            
            // Start a new ball first
            game.startNewBall();
            
            // Get the first fielder for testing
            const testFielder = game.fielders[0];
            
            console.log(`🎯 Simulating successful catch by ${testFielder.userData.description}`);
            console.log(`📊 Before wicket - Score: ${game.cricketScore.runs}/${game.cricketScore.wickets}`);
            
            // Simulate a successful catch
            game.successfulCatch(testFielder, 'regularcatch');
            
            console.log(`📊 After wicket - Score: ${game.cricketScore.runs}/${game.cricketScore.wickets}`);
            console.log('✅ Wicket test completed! Check for notifications and score updates.');
        };

        // ✅ NEW: Test run-out scenario
        window.testRunOutScenario = () => {
            console.log('🧪 Testing Run-Out Scenario...');
            
            if (!game.bowler) {
                console.log('❌ No bowler available for run-out test');
                return;
            }
            
            // Start a new ball first
            game.startNewBall();
            
            console.log(`📊 Before run-out - Score: ${game.cricketScore.runs}/${game.cricketScore.wickets}`);
            
            // Simulate batsman starting a run
            game.runningSystem.isRunning = true;
            game.runningSystem.runState = 'running';
            game.runningSystem.runProgress = 0.6; // 60% through the run (caught short!)
            game.runningSystem.currentEnd = 'batsman';
            game.runningSystem.targetEnd = 'bowler';
            game.runningSystem.runsCompleted = 0; // No completed runs yet
            
            console.log(`🏃‍♂️ Simulating batsman 60% through run when ball reaches bowler...`);
            
            // Simulate ball reaching bowler while batsman is mid-run
            game.executeRunOut();
            
            console.log(`📊 After run-out - Score: ${game.cricketScore.runs}/${game.cricketScore.wickets}`);
            console.log('✅ Run-out test completed! Check for notifications and score updates.');
        };

        // ✅ NEW: Test bowled scenario
        window.testBowledScenario = () => {
            console.log('🧪 Testing Bowled Scenario...');
            
            if (!game.cricketBall || !game.bowledDetection.stumpsAtBatsmanEnd.length) {
                console.log('❌ No ball or stumps available for bowled test');
                return;
            }
            
            // Start a new ball first
            game.startNewBall();
            
            console.log(`📊 Before bowled - Score: ${game.cricketScore.runs}/${game.cricketScore.wickets}`);
            
            // Reset ball hit flag to simulate missed ball
            game.cricketScore.ballHasBeenHit = false;
            
            // Position ball near stumps to simulate bowled
            const stumpPos = game.bowledDetection.stumpsAtBatsmanEnd[1].position; // Middle stump
            game.cricketBall.position.set(stumpPos.x + 0.1, stumpPos.y, stumpPos.z + 0.05);
            game.ballPhysics.isMoving = true;
            game.ballPhysics.velocity.set(0, 0, 2); // Moving toward stumps
            
            console.log(`🎯 Simulating ball hitting stumps at batsman's end...`);
            console.log(`   Ball position: (${game.cricketBall.position.x.toFixed(2)}, ${game.cricketBall.position.y.toFixed(2)}, ${game.cricketBall.position.z.toFixed(2)})`);
            console.log(`   Stump position: (${stumpPos.x.toFixed(2)}, ${stumpPos.y.toFixed(2)}, ${stumpPos.z.toFixed(2)})`);
            
            // Force bowled detection
            game.executeBowledDismissal();
            
            console.log(`📊 After bowled - Score: ${game.cricketScore.runs}/${game.cricketScore.wickets}`);
            console.log('✅ Bowled test completed! Check for notifications and score updates.');
        };

        // ✅ NEW: Test live bowled detection
        window.testLiveBowledDetection = () => {
            console.log('🧪 Testing Live Bowled Detection...');
            console.log('🎯 Bowl a ball straight at the stumps without swinging!');
            console.log('📋 Instructions:');
            console.log('   1. Run: bowlStraight()');
            console.log('   2. DON\'T hit any shot keys (let ball pass)');
            console.log('   3. Watch for bowled detection if ball hits stumps');
            console.log('');
            console.log('⚡ Or run: simulateBowledMiss() for automated test');
        };

        // ✅ NEW: Simulate a complete bowled miss
        window.simulateBowledMiss = () => {
            console.log('🎯 Simulating complete bowled scenario...');
            
            // Reset game state
            game.startNewBall();
            game.cricketScore.ballHasBeenHit = false;
            game.ballPhysics.isMoving = false;
            
            // Position ball at bowler's end
            game.cricketBall.position.set(0, 1, -8);
            
            // Bowl straight toward stumps
            game.bowlBall(new THREE.Vector3(0, 0, 1), 12);
            
            console.log('🏏 Ball bowled! Watch for bowled detection...');
            console.log('🚫 Remember: Don\'t hit any shot keys to simulate a miss!');
        };

        // ✅ NEW: Debug bowled detection system
        window.debugBowledDetection = () => {
            console.log('🔍 DEBUG: Bowled Detection System Status');
            console.log('==========================================');
            console.log(`Enabled: ${game.bowledDetection.enabled}`);
            console.log(`Collision radius: ${game.bowledDetection.stumpCollisionRadius}m`);
            console.log(`Stumps at batsman end: ${game.bowledDetection.stumpsAtBatsmanEnd.length}`);
            
            if (game.bowledDetection.stumpsAtBatsmanEnd.length > 0) {
                console.log('Stump positions:');
                game.bowledDetection.stumpsAtBatsmanEnd.forEach((stump, i) => {
                    const pos = stump.position;
                    console.log(`  ${stump.name}: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
                });
            }
            
            if (game.cricketBall) {
                const ballPos = game.cricketBall.position;
                console.log(`Ball position: (${ballPos.x.toFixed(2)}, ${ballPos.y.toFixed(2)}, ${ballPos.z.toFixed(2)})`);
                console.log(`Ball moving: ${game.ballPhysics.isMoving}`);
                console.log(`Ball has been hit: ${game.cricketScore.ballHasBeenHit}`);
                
                if (game.bowledDetection.stumpsAtBatsmanEnd.length > 0) {
                    const nearestStump = game.bowledDetection.stumpsAtBatsmanEnd[1]; // middle stump
                    const distance = ballPos.distanceTo(nearestStump.position);
                    console.log(`Distance to middle stump: ${distance.toFixed(3)}m`);
                }
            }
        };

        // ✅ NEW: Force ball position to test collision
        window.testBowledCollision = () => {
            console.log('🧪 Testing bowled collision detection...');
            
            if (!game.cricketBall || game.bowledDetection.stumpsAtBatsmanEnd.length === 0) {
                console.log('❌ Missing ball or stumps');
                return;
            }
            
            // Get middle stump position
            const middleStump = game.bowledDetection.stumpsAtBatsmanEnd[1];
            const stumpPos = middleStump.position;
            
            // Position ball very close to stump
            game.cricketBall.position.set(
                stumpPos.x + 0.05, 
                stumpPos.y, 
                stumpPos.z - 0.05
            );
            
            // Ensure ball is moving and hasn't been hit
            game.ballPhysics.isMoving = true;
            game.cricketScore.ballHasBeenHit = false;
            
            console.log(`Ball positioned at: (${game.cricketBall.position.x.toFixed(3)}, ${game.cricketBall.position.y.toFixed(3)}, ${game.cricketBall.position.z.toFixed(3)})`);
            console.log(`Stump at: (${stumpPos.x.toFixed(3)}, ${stumpPos.y.toFixed(3)}, ${stumpPos.z.toFixed(3)})`);
            
            const distance = game.cricketBall.position.distanceTo(stumpPos);
            console.log(`Distance: ${distance.toFixed(3)}m (threshold: ${game.bowledDetection.stumpCollisionRadius})`);
            
            if (distance <= game.bowledDetection.stumpCollisionRadius) {
                console.log('✅ Should trigger bowled detection!');
            } else {
                console.log('❌ Too far for collision detection');
            }
        };

        // ✅ NEW: Debug actual bowler catch scenario
        window.debugBowlerCatch = () => {
            console.log('🔍 DEBUG: Testing actual bowler catch with running state...');
            
            if (!game.bowler || !game.cricketBall) {
                console.log('❌ Missing bowler or ball');
                return;
            }
            
            // Start a new ball
            game.startNewBall();
            
            // Set up running state manually
            game.runningSystem.isRunning = true;
            game.runningSystem.runState = 'running';
            game.runningSystem.runProgress = 0.5; // 50% through run
            game.runningSystem.currentEnd = 'batsman';
            game.runningSystem.targetEnd = 'bowler';
            
            console.log('🏃‍♂️ Batsman set to 50% through run. Now calling bowlerCatchBall()...');
            
            // Trigger bowler catch
            game.bowlerCatchBall();
        };

        // ✅ NEW: Test the fixed run-out timing
        window.testRunOutTiming = () => {
            console.log('🧪 Testing Fixed Run-Out Timing...');
            
            // Start a new ball
            game.startNewBall();
            
            // Set up fielder with ball (simulate fielder pickup)
            const testFielder = game.fielders[0];
            if (!testFielder) {
                console.log('❌ No fielders available');
                return;
            }
            
            // Set up running state
            game.runningSystem.isRunning = true;
            game.runningSystem.runState = 'running';
            game.runningSystem.runProgress = 0.6; // 60% through run
            game.runningSystem.currentEnd = 'batsman';
            game.runningSystem.targetEnd = 'bowler';
            
            console.log('🏃‍♂️ Batsman 60% through run...');
            console.log('🤲 Fielder picks up ball (should NOT complete ball yet)...');
            
            // Simulate fielder pickup (should not complete ball due to running batsman)
            game.fielderReachBall(testFielder);
            
            // Wait for throw, then test bowler catch
            setTimeout(() => {
                console.log('🎯 Bowler catches thrown ball (should detect run-out)...');
                game.bowlerCatchBall();
            }, 2000);
        };

        // ✅ NEW: Test realistic run-out scenario
        window.testRealisticRunOut = () => {
            console.log('🧪 Testing Realistic Run-Out Scenario...');
            console.log('This simulates: hit ball → run → fielder throws → run-out');
            
            // Bowl a ball first
            game.bowlBall(new THREE.Vector3(0, 0, 1), 12);
            
            // Hit a defensive shot
            setTimeout(() => {
                game.playDefensiveShot();
                console.log('🏏 Ball hit defensively...');
                
                // Start running immediately after hitting
                setTimeout(() => {
                    const runStarted = game.startRun();
                    if (runStarted) {
                        console.log('🏃‍♂️ Batsman starts running...');
                        console.log('⚡ Wait for fielder to pick up ball and throw to bowler...');
                        console.log('🎯 If ball reaches bowler while batsman is mid-run = RUN OUT!');
                    }
                }, 500);
                
            }, 1000);
        };
        
        // ✅ NEW: Test scoring functions
        window.testScoring = () => {
            console.log('📊 Testing Cricket Scoring Functions...');
            console.log('');
            console.log('🔧 Current Score Functions:');
            console.log(`  Current Score: ${window.CricketScoring.formatScore()}`);
            console.log(`  Ball State: ${JSON.stringify(window.CricketScoring.getBallState())}`);
            console.log(`  Game Active: ${window.CricketScoring.isGameActive()}`);
            console.log('');
            console.log('🧮 Utility Functions:');
            console.log(`  Run Rate (50 runs in 10 overs): ${window.CricketScoringUtils.calculateRunRate(50, 10)}`);
            console.log(`  Required RR (100 runs in 20 overs): ${window.CricketScoringUtils.calculateRequiredRunRate(100, 20)}`);
            console.log(`  Balls to Overs (37 balls): ${window.CricketScoringUtils.ballsToOvers(37)}`);
            console.log(`  Overs to Balls (6.2 overs): ${window.CricketScoringUtils.oversToBalls(6.2)}`);
        };
        
        // Add to the existing console help
        console.log('🆕 NEW FIELDING TESTS:');
        console.log('  testImprovedFieldingV3() - test the new fielding improvements');
        console.log('  debugFieldingLive() - enhanced real-time fielding analysis');
        console.log('  testWicketScenario() - test wicket taking and scoring');
        console.log('  testRunOutScenario() - test run-out detection (forced scenario)');
        console.log('  testRealisticRunOut() - test realistic run-out (hit→run→field→throw)');
        console.log('  debugBowlerCatch() - debug bowler catch with mid-run state');
        console.log('  testRunOutTiming() - test the FIXED run-out timing issue');
        console.log('  testScoring() - test cricket scoring utility functions');
        console.log('  The system now prioritizes closest fielders and has immediate catch detection!');
        console.log('  ✅ WICKETS NOW PROPERLY HANDLED: scoring, notifications, and ball completion!');
        console.log('  ✅ RUN-OUTS NOW IMPLEMENTED: automatic detection when ball reaches bowler!');
        
        // Legacy test function for compatibility
        window.testFieldingSystem = () => {
            console.log('🧪 Use debugFieldingLive() for detailed real-time analysis');
            window.debugFieldingLive();
        };
        
        window.unstuckFielder = (fielderName) => {
            const fielder = game.fielders.find(f => f.userData.description === fielderName);
            if (fielder) {
                console.log(`🔧 Manually unsticking ${fielderName}...`);
                fielder.userData.chaseStartTime = null;
                game.fieldingSystem.fielderStates.set(fielderName, 'idle');
                game.startFielderReturning(fielder);
            } else {
                console.log(`❌ Fielder '${fielderName}' not found`);
            }
        };
        
        window.forceCompleteFielding = () => {
            console.log('🔧 Force completing fielding sequence...');
            game.fieldingSystem.ballIsHit = false;
            game.fieldingSystem.chasingFielder = null;
            game.ballPhysics.isMoving = false;
            if (game.ballState.isActive && !game.ballState.isComplete) {
                game.ballState.ballType = 'fielded';
                game.ballState.completionReason = 'forced';
                game.completeBall();
            }
        };
        
        window.testImprovedFielding = () => {
            console.log('🧪 Testing Improved Fielding System v2.0');
            console.log('==========================================');
            
            // Test catch probability calculation
            console.log('📊 Testing catch probability calculations:');
            
            const testCases = [
                { distance: 1.0, speed: 10, type: 'regularcatch' },
                { distance: 3.0, speed: 15, type: 'divingcatch' },
                { distance: 6.0, speed: 20, type: 'divingcatch' },
                { distance: 10.0, speed: 25, type: 'divingcatch' }
            ];
            
            testCases.forEach(test => {
                const maxDistance = game.fieldingSystem.catchingSystem.catchRadius; // 5.0
                const distanceFactor = Math.max(0, 1 - (test.distance / maxDistance));
                const speedFactor = Math.max(0.3, 1 - (test.speed / 30));
                let probability = distanceFactor * speedFactor;
                
                if (test.type === 'divingcatch') {
                    probability *= 0.7;
                }
                
                probability = Math.max(0, Math.min(1, probability));
                
                console.log(`  Distance: ${test.distance}m, Speed: ${test.speed}, Type: ${test.type}`);
                console.log(`    Probability: ${(probability * 100).toFixed(1)}% ✅`);
            });
            
            console.log('');
            console.log('🎯 Ball prediction accuracy test:');
            if (game.cricketBall && game.ballPhysics.isMoving) {
                const prediction = game.predictBallLanding();
                if (prediction) {
                    console.log(`  Current ball: (${game.cricketBall.position.x.toFixed(1)}, ${game.cricketBall.position.z.toFixed(1)})`);
                    console.log(`  Predicted landing: (${prediction.x.toFixed(1)}, ${prediction.z.toFixed(1)})`);
                } else {
                    console.log('  ❌ Could not predict landing (ball not moving or invalid trajectory)');
                }
            } else {
                console.log('  ⚠️ Ball not moving - bowl a ball first to test prediction');
            }
            
            console.log('');
            console.log('🛡️ Safety checks active:');
            console.log('  ✅ Catch probability clamped to 0-100%');
            console.log('  ✅ Max catch distance: 7m (5m catchRadius + 2m buffer)');
            console.log('  ✅ Running blocked during catch attempts');
            console.log('  ✅ Dynamic prediction updates during ball flight');
            console.log('  ✅ Reduced prediction uncertainty (0.2m vs 0.5m)');
            console.log('  ✅ Smart timeout switches to direct ball chase');
            
            console.log('');
            console.log('🆕 New Features v2.0:');
            console.log('  🔄 Dynamic target updates when prediction changes >1m');
            console.log('  ⚡ Smarter catch triggers (closer distances, ball stopped)');
            console.log('  🕐 Faster timeout (6s vs 8s) with direct chase fallback');
            console.log('  🎯 Better animation system fallbacks');
        };
        
        window.stopAllFielders = () => {
            console.log('🛑 Stopping all fielding activity...');
            game.fielders.forEach(fielder => {
                const state = game.fieldingSystem.fielderStates.get(fielder.userData.description);
                if (state !== 'idle') {
                    console.log(`  🔄 ${fielder.userData.description}: ${state} → idle`);
                    game.fieldingSystem.fielderStates.set(fielder.userData.description, 'idle');
                    fielder.userData.isRunningForAnticipation = false; // Clear animation flag
                    fielder.userData.chaseStartTime = null; // Clear chase timer
                    game.playCricketPlayerAnimation(fielder, 'standingidle');
                }
            });
            game.fieldingSystem.ballIsHit = false;
            game.fieldingSystem.chasingFielder = null;
            console.log('✅ All fielders stopped and returned to idle');
        };
        
        window.checkFieldingStates = () => {
            console.log('📊 Current fielding states:');
            game.fielders.forEach(fielder => {
                const state = game.fieldingSystem.fielderStates.get(fielder.userData.description);
                const ballDistance = game.cricketBall ? fielder.position.distanceTo(game.cricketBall.position).toFixed(1) : 'N/A';
                const isRunningFlag = fielder.userData.isRunningForAnticipation || false;
                const chaseTime = fielder.userData.chaseStartTime ? (Date.now() - fielder.userData.chaseStartTime) : 'N/A';
                
                console.log(`  ${fielder.userData.description}: ${state} (${ballDistance}m from ball, running: ${isRunningFlag}, chase: ${chaseTime}ms)`);
                
                // Special focus on slip fielder
                if (fielder.userData.description === 'First Slip') {
                    console.log(`    🎯 SLIP DETAILS: Position: (${fielder.position.x.toFixed(1)}, ${fielder.position.z.toFixed(1)}), State: ${state}, Running flag: ${isRunningFlag}`);
                }
            });
            
            const activeFielders = Array.from(game.fieldingSystem.fielderStates.values()).filter(state => state !== 'idle');
            console.log(`🏃 Active fielders: ${activeFielders.length}`);
            if (activeFielders.length > 1) {
                console.log('⚠️ WARNING: Multiple fielders active! Use stopAllFielders() to fix.');
            }
        };
        window.resetFielding = () => {
            game.resetFieldingSystem();
            game.resetCatchingSystem();
            console.log('🔄 Fielding and catching systems reset');
        };
        
        // ✅ NEW: Debug function to check fielding system health
        window.debugFieldingHealth = () => {
            console.log('🏥 FIELDING SYSTEM HEALTH CHECK:');
            
            // Check if all fielders have required userData
            game.fielders.forEach(fielder => {
                const hasUserData = !!fielder.userData;
                const hasDescription = hasUserData && !!fielder.userData.description;
                const hasTopSpeed = hasUserData && !!fielder.userData.topSpeed;
                const hasRole = hasUserData && !!fielder.userData.role;
                
                const status = hasUserData && hasDescription && hasTopSpeed && hasRole ? '✅' : '❌';
                console.log(`  ${status} ${hasDescription ? fielder.userData.description : 'Unknown'}: userData=${hasUserData}, topSpeed=${hasTopSpeed}, role=${hasRole}`);
                
                if (!hasTopSpeed && hasUserData) {
                    console.log(`    🔧 Fixing topSpeed for ${fielder.userData.description}`);
                    fielder.userData.topSpeed = game.fieldingSystem.DEFAULT_TOP_SPEED;
                }
            });
            
            // Check current task status
            const task = game.fieldingSystem.currentTask;
            if (task) {
                console.log(`  📋 Current Task: ${task.fielder.userData.description} (${task.mode})`);
            } else {
                console.log('  📋 No active fielding task');
            }
            
            // Check fielder states
            const activeFielders = Array.from(game.fieldingSystem.fielderStates.entries())
                .filter(([name, state]) => state !== 'idle');
            
            console.log(`  🏃 Active Fielders: ${activeFielders.length}`);
            activeFielders.forEach(([name, state]) => {
                console.log(`    - ${name}: ${state}`);
            });
            
            console.log('✅ Fielding system health check complete');
        };

        // ✅ NEW: Test stationary ball collection
        window.testStationaryBallCollection = () => {
            console.log('🧪 Testing stationary ball collection...');
            
            if (!game.cricketBall) {
                console.log('❌ No cricket ball found');
                return;
            }
            
            // Stop the ball and trigger collection
            game.ballPhysics.isMoving = false;
            game.ballPhysics.velocity.set(0, 0, 0);
            game.cricketBall.position.set(15, 0.2, 5); // Place ball in field
            
            console.log('🎾 Ball placed at (15, 0.2, 5) and stopped');
            console.log('🔄 Triggering stationary ball collection...');
            
            game.assignNearestFielderToStationaryBall();
        };

        // Expose catching system for testing
        window.testCatch = (fielderIndex = 0) => {
            if (game.fielders.length === 0) {
                console.log('❌ No fielders available for catch test');
                return;
            }
            
            const fielder = game.fielders[fielderIndex];
            if (!fielder) {
                console.log(`❌ Fielder ${fielderIndex} not found. Available fielders: 0-${game.fielders.length - 1}`);
                return;
            }
            
            // Reset systems first
            game.resetFieldingSystem();
            game.resetCatchingSystem();
            
            // Position ball near fielder for testing (2.5m for diving catch test)
            game.cricketBall.position.copy(fielder.position);
            game.cricketBall.position.x += 2.5; // 2.5 meters away for diving catch
            game.cricketBall.position.y += 2; // In the air at catchable height
            
            // Set ball moving toward fielder
            const direction = fielder.position.clone().sub(game.cricketBall.position);
            direction.normalize();
            game.ballPhysics.velocity.copy(direction.multiplyScalar(8)); // Moderate speed
            game.ballPhysics.velocity.y = -1; // Slight downward trajectory
            
            game.ballPhysics.isMoving = true;
            game.fieldingSystem.ballIsHit = true;
            
            console.log(`🧪 Testing catch with ${fielder.userData.description} (Index: ${fielderIndex})`);
            console.log(`📍 Ball positioned 2.5m away at catchable height`);
            console.log(`⚡ Ball moving toward fielder at moderate speed`);
            console.log(`🎯 This should trigger a diving catch attempt!`);
        };
        
        console.log('Cricket 3D Game initialized successfully!');
        console.log('Menu System integrated - Game ready to start.');
        console.log('Console commands available:');
        console.log('  playBowlerAnimation("animationName")');
        console.log('  playKeeperAnimation("animationName")');
        console.log('  playFielderAnimation("fieldingPosition", "animationName")');
        console.log('  playAllFieldersAnimation("animationName")');
        console.log('  loadAllAnimations() - loads all animation files for all characters');
        console.log('  bowlStraight() - bowl ball straight');
        console.log('  bowlBouncer() - bowl high ball');
        console.log('  bowlBall(direction, speed) - custom bowling');
        console.log('🤖 AI Bowler Commands:');
        console.log('  enableAIBowler() - enable automatic AI bowling');
        console.log('  disableAIBowler() - disable AI bowling (manual only)');
        console.log('  setAIBowlingStrategy("strategy") - set AI strategy:');
        console.log('    • "aggressive" - frequent yorkers and bouncers');
        console.log('    • "defensive" - tight lines outside off stump');
        console.log('    • "balanced" - mix of all deliveries (default)');
        console.log('    • "random" - completely unpredictable');
        console.log('  getAIBowlerStats() - show AI bowling statistics');
        console.log('  demoAIBowler() - 🎳 DEMO: Show AI Bowler overview & instructions');
        console.log('  demoAIBowlerToggle() - 🔄 DEMO: Show toggle feature guide');
        console.log('🔄 Free Play Toggle:');
        console.log('  toggleAIBowler() - toggle between AI and manual bowling');
        console.log('  • In Free Play: Use toggle button in bottom-right corner');
        console.log('  • Manual mode: Digit keys 6-0 for bowling control');
        console.log('  • AI mode: Automatic 3-second countdown bowling');
        console.log('👤 Multiplayer Bowling:');
        console.log('  enableMultiplayerBowling("playerId") - human takes bowling control');
        console.log('  disableMultiplayerBowling() - return to AI bowling');
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
        console.log('Running Commands:');
        console.log('  startRun() - start running between wickets');
        console.log('  playSlide() - play slide animation');
        console.log('  resetRunning() - reset running system');
        console.log('  showRunningStatus() - show current running status');
        console.log('  Press SPACE key - run between wickets');
        console.log('  Press L key - play slide animation');
        console.log('  Press T key - reset running system');
        console.log('Debugging:');
        console.log('  testShotDirection("shotType") - debug shot direction');
        console.log('  testFielderSelection("shotType") - test fielder assignment');
        console.log('  testThrowingPower("fielderName") - test throw strength');
        console.log('  showFieldCoords() - show field coordinate system');
        console.log('  debugAnimations() - debug animation states and availability');
        console.log('Ball Trail:');
        console.log('  toggleBallTrail() - turn trail on/off');
        console.log('  clearBallTrail() - clear current trail');
        console.log('  setBallTrailColor(0xff0000) - set trail color (hex)');
        console.log('3D Scoreboards:');
        console.log('  updateScoreboards() - manually update scoreboard display');
        console.log('  setTestScore(runs, wickets, overs) - set test score values');
        console.log('  hideScoreboards() - hide both 3D scoreboards');
        console.log('  showScoreboards() - show both 3D scoreboards');
        console.log('Fielding System:');
        console.log('  testImprovedFielding() - test the improved fielding system fixes');
        console.log('  debugFieldingLive() - real-time fielding analysis');
        console.log('  checkFieldingStates() - show current state of all fielders');
        console.log('  stopAllFielders() - immediately stop all fielding activity');
        console.log('  resetFielding() - reset fielding system to idle');
        console.log('  testCatch(fielderIndex) - test catching system with specific fielder');
        console.log('  unstuckFielder("fielderName") - manually unstick a stuck fielder');
        console.log('  forceCompleteFielding() - force complete current fielding sequence');
        console.log('  testBackupFielding() - test dropped catch backup system');
        console.log('  testDroppedCatch() - simulate dropped catch with backup fielder');
        console.log('  testCatchProbabilityThreshold() - test realistic catch probability system');
        console.log('  testCatchProbability("fielderName", distance, speed) - test specific scenarios');
        console.log('  testCatchScenario("easy/medium/hard/impossible") - test difficulty scenarios');
        console.log('  demoCatchProbabilityThreshold() - quick demo of all probability scenarios');
        console.log('Catching System:');
        console.log('  Regular catch: Ball within 1.5m - uses regularcatch.fbx');
        console.log('  Diving catch: Ball 2-3m away - uses divingcatch.fbx');
        console.log('  Catch success depends on distance, speed, and catch type');
        console.log('  ✅ NEW: Dropped catches trigger automatic backup fielding!');
        console.log('  ✅ NEW: Realistic catch attempts - only tries catches with ≥20% probability!');
        console.log('📊 Scorecard System:');
        console.log('  demoScorecardSystem() - 🆕 COMPLETE DEMO of the scorecard system!');
        console.log('  testBatsmanPromotion() - 🆕 TEST batsman promotion after wickets!');
        console.log('  showScorecard() - display full team scorecard');
        console.log('  hideScorecard() - hide the scorecard');
        console.log('  updateScorecard() - manually refresh scorecard display');
        console.log('  resetTeamStats() - reset all player stats to 0');
        console.log('  simulateInnings() - load a realistic sample innings');
        console.log('  testWicket("caught/run out/bowled") - test wicket recording');
        console.log('  testBowledScenario() - 🆕 TEST bowled dismissal scenario');
        console.log('  simulateBowledMiss() - 🆕 AUTOMATED bowled test (bowl + miss)');
        console.log('  testLiveBowledDetection() - 🆕 INSTRUCTIONS for live testing');
        console.log('  debugBowledDetection() - 🆕 DEBUG bowled detection system');
        console.log('  testBowledCollision() - 🆕 FORCE test collision detection');
        console.log('  testBoundary(4 or 6) - test boundary scoring');
        console.log('  testOverCompletion() - 🆕 TEST over completion & batsman switching!');
        console.log('  getCurrentBatsman() - show current batsmen details');
        console.log('  showBattingLineup() - show complete batting order and status');
        console.log('  setTeamName("Team Name") - change team name');
        console.log('  📊 BUTTON: Click "📊 Scorecard" button in bottom-right during gameplay!');
        console.log('Features:');
        console.log('  ✅ 11-player England batting team with realistic names');
        console.log('  ✅ Tracks individual runs, balls faced, dismissal type');
        console.log('  ✅ Highlights current batsmen (striker/non-striker)');
        console.log('  ✅ Automatic batsman rotation on dismissals, odd runs, and over completion');
        console.log('  ✅ Extras tracking (byes, leg-byes, wides, no-balls)');
        console.log('  ✅ Professional scorecard layout matching real cricket');
        console.log('  ✅ Real-time updates during gameplay');
        console.log('  ✅ 🆕 Bowled dismissal detection when ball hits stumps');
        
        // ✅ NEW: Test the improved fielding system
        window.testImprovedFieldingV4 = () => {
            console.log('🚀 Testing Improved Fielding System v4.0 - Shot Zone Based Selection');
            console.log('==================================================================');
            console.log('');
            console.log('✅ NEW FEATURES:');
            console.log('  🎯 Shot direction analysis (determines offSide/legSide/straight/behind)');
            console.log('  🏃 Zone-appropriate fielder selection first');
            console.log('  ⚖️ Weighted scoring: ball distance + landing distance');
            console.log('  📍 High ball vs ground ball prioritization');
            console.log('  🛑 FIXED: First Slip no longer selected for every shot!');
            console.log('');
            console.log('🧪 TESTING COMMANDS:');
            console.log('  testShotFielderSelection("straightDrive") - test straight shot');
            console.log('  testShotFielderSelection("coverDrive") - test off-side shot');
            console.log('  testShotFielderSelection("pullShot") - test leg-side shot');
            console.log('  testShotFielderSelection("lateCut") - test behind wicket');
            console.log('  debugFieldingLive() - real-time analysis during play');
            console.log('  showFieldCoords() - show all fielder positions');
            console.log('');
            console.log('🎯 WHAT TO LOOK FOR:');
            console.log('  ✅ Off-side shots → Cover, Point, Gully fielders respond');
            console.log('  ✅ Leg-side shots → Square Leg, Fine Leg, Mid On respond');
            console.log('  ✅ Straight shots → Mid Off, Mid On respond');
            console.log('  ✅ Behind shots → First Slip, Third Man, Fine Leg respond');
            console.log('  ✅ NO MORE First Slip chasing every shot!');
            console.log('');
            console.log('Try: bowlStraight() then playCoverDrive() - Cover should respond, not Slip!');
        };
        
        // ✅ NEW: Test shot-specific fielder selection
        window.testShotFielderSelection = (shotType) => {
            console.log(`🧪 Testing fielder selection for ${shotType}:`);
            
            // Get shot data
            const shot = game.shotTypes[shotType];
            if (!shot) {
                console.log(`❌ Shot type '${shotType}' not found`);
                return;
            }
            
            // Simulate ball velocity
            const ballVelocity = new THREE.Vector3(shot.direction[0], shot.direction[1], shot.direction[2]);
            ballVelocity.multiplyScalar(shot.power * 8);
            
            console.log(`🏏 Shot: ${shot.description}`);
            console.log(`⚡ Ball velocity: X=${ballVelocity.x.toFixed(1)}, Y=${ballVelocity.y.toFixed(1)}, Z=${ballVelocity.z.toFixed(1)}`);
            
            // Test the new zone determination
            const shotZone = game.determineShotZone(ballVelocity);
            console.log(`📍 Detected zone: ${shotZone}`);
            
            // Show preferred fielders for this zone
            const zoneFielders = game.fieldingSystem.fieldingZones[shotZone] || [];
            console.log(`🎯 Preferred fielders: ${zoneFielders.join(', ')}`);
            
            // Check which fielders are actually available in this zone
            const availableInZone = game.getFieldersInZone(shotZone);
            console.log(`✅ Available in zone: ${availableInZone.length} fielders`);
            availableInZone.forEach(f => {
                const pos = f.position;
                console.log(`   ${f.userData.description}: (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
            });
            
            // Show how this differs from old system (closest to batsman)
            const batsmanPos = new THREE.Vector3(0, 0, 9);
            let closestToBatsman = null;
            let closestDist = Infinity;
            
            game.fielders.forEach(f => {
                const dist = f.position.distanceTo(batsmanPos);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestToBatsman = f;
                }
            });
            
            console.log(`📊 OLD SYSTEM (closest to batsman): ${closestToBatsman.userData.description} (${closestDist.toFixed(1)}m)`);
            console.log(`📊 NEW SYSTEM (zone-appropriate): ${availableInZone.length > 0 ? availableInZone[0].userData.description : 'None in zone'}`);
            
            if (closestToBatsman.userData.description === 'First Slip') {
                console.log(`🎯 PROBLEM FIXED: Old system would select First Slip, new system uses proper zone!`);
            }
            
            return {
                shotZone,
                preferredFielders: zoneFielders,
                availableInZone: availableInZone.map(f => f.userData.description),
                oldSystemChoice: closestToBatsman.userData.description,
                newSystemChoice: availableInZone.length > 0 ? availableInZone[0].userData.description : 'None'
            };
        };
        
        // ✅ NEW: Test backup fielding system
        window.testBackupFielding = () => {
            console.log('🆘 Testing Backup Fielding System');
            console.log('===================================');
            console.log('');
            console.log('✅ NEW FEATURES:');
            console.log('  🎯 When catch is dropped → closest fielder backs up automatically');
            console.log('  🏃 Backup fielder chases deflected ball');
            console.log('  🎯 Predictive positioning ahead of ball movement');
            console.log('  ⚡ Realistic ball deflection when dropped');
            console.log('  🔄 Seamless transition from dropped catch to backup fielding');
            console.log('');
            console.log('🧪 TESTING:');
            console.log('  1. Bowl ball: bowlStraight()');
            console.log('  2. Hit shot: playUpperCut() or playCoverDrive()');
            console.log('  3. Watch fielder attempt catch');
            console.log('  4. If dropped → backup fielder should automatically respond');
            console.log('');
            console.log('🎯 WHAT TO LOOK FOR:');
            console.log('  ✅ First fielder attempts catch');
            console.log('  ✅ If dropped: "Looking for backup fielder..." message');
            console.log('  ✅ Closest fielder starts chasing deflected ball');
            console.log('  ✅ Ball deflects realistically when dropped');
            console.log('  ✅ Backup fielder targets predicted ball position');
            console.log('');
            console.log('Try: bowlStraight() → playUpperCut() → watch for backup!');
        };
        
        // ✅ NEW: Test catch probability threshold system
        window.testCatchProbabilityThreshold = () => {
            console.log('🎯 Testing Catch Probability Threshold System');
            console.log('==============================================');
            console.log('');
            console.log('✅ NEW FEATURE: Realistic Catch Attempts');
            console.log('  🚫 Fielders only attempt catches with ≥20% probability');
            console.log('  📊 Probability based on distance, ball speed, and catch type');
            console.log('  🧠 Smart fielding - no more impossible catch attempts!');
            console.log('');
            console.log('🧮 Probability Factors:');
            console.log('  📏 Distance: Closer = higher chance');
            console.log('  ⚡ Ball Speed: Slower = higher chance');
            console.log('  🤸 Catch Type: Regular catch > Diving catch');
            console.log('');
            console.log('🧪 TESTING:');
            console.log('  testCatchProbability("Cover", 2.5, 15) - test Cover fielder');
            console.log('  testCatchScenario("easy") - test easy catch scenario');
            console.log('  testCatchScenario("hard") - test difficult catch scenario');
            console.log('  testCatchScenario("impossible") - test impossible catch');
            console.log('');
            console.log('🎯 WHAT TO LOOK FOR:');
            console.log('  ✅ High probability (>20%): Fielder attempts catch');
            console.log('  ❌ Low probability (<20%): Fielder switches to ground fielding');
            console.log('  📊 Console shows exact probability calculations');
            console.log('');
            console.log('Try: testCatchScenario("impossible") to see fielder skip attempt!');
        };
        
        // ✅ NEW: Test catch probability for specific fielder
        window.testCatchProbability = (fielderName, distance = 3.0, ballSpeed = 15) => {
            const fielder = game.fielders.find(f => f.userData.description === fielderName);
            if (!fielder) {
                console.log(`❌ Fielder '${fielderName}' not found`);
                console.log('Available fielders:', game.fielders.map(f => f.userData.description).join(', '));
                return;
            }
            
            // Create test ball position and velocity
            const testBallPos = fielder.position.clone();
            testBallPos.x += distance; // Move ball away from fielder
            testBallPos.y += 2; // Ball in air
            
            const testBallVel = new THREE.Vector3(-ballSpeed, -2, 0); // Moving toward fielder
            
            const probability = game.calculateCatchProbability(fielder, testBallPos, testBallVel, distance);
            
            console.log(`🧪 Testing ${fielderName}:`);
            console.log(`   Distance: ${distance.toFixed(1)}m`);
            console.log(`   Ball Speed: ${ballSpeed.toFixed(1)}`);
            console.log(`   Catch Probability: ${(probability * 100).toFixed(1)}%`);
            console.log(`   Verdict: ${probability >= 0.15 ? '✅ WILL ATTEMPT' : '❌ TOO RISKY - will field instead'}`);
            
            return probability;
        };
        
        // ✅ NEW: Test different catch scenarios
        window.testCatchScenario = (scenario) => {
            const scenarios = {
                easy: { distance: 1.5, speed: 8, description: 'Easy catch (close, slow ball)' },
                medium: { distance: 3.0, speed: 15, description: 'Medium catch (moderate distance and speed)' },
                hard: { distance: 4.5, speed: 22, description: 'Hard catch (far, fast ball)' },
                impossible: { distance: 6.0, speed: 30, description: 'Nearly impossible catch (very far, very fast)' }
            };
            
            const test = scenarios[scenario];
            if (!test) {
                console.log('❌ Unknown scenario. Available: easy, medium, hard, impossible');
                return;
            }
            
            console.log(`🧪 Testing "${scenario}" scenario: ${test.description}`);
            console.log('📊 Fielder Probabilities:');
            
            let attempters = 0;
            let fielders = 0;
            
            game.fielders.forEach(fielder => {
                const probability = window.testCatchProbability(fielder.userData.description, test.distance, test.speed);
                if (probability >= 0.15) {
                    attempters++;
                } else {
                    fielders++;
                }
            });
            
            console.log('');
            console.log(`📈 Summary for "${scenario}" scenario:`);
            console.log(`   Will attempt catch: ${attempters} fielders`);
            console.log(`   Will field instead: ${fielders} fielders`);
            console.log(`   Realistic behavior: ${attempters === 0 && scenario === 'impossible' ? '✅ Perfect!' : attempters > 0 ? '✅ Some will try' : '⚠️ None will try'}`);
        };
        
        // ✅ NEW: Demo the complete scorecard system
        window.demoScorecardSystem = () => {
            console.log('🏏 SCORECARD SYSTEM DEMO');
            console.log('========================');
            console.log('');
            console.log('🎯 This demonstrates the full batting team and scorecard system:');
            console.log('');
            
            // Show initial state
            console.log('1️⃣ Initial State:');
            window.resetTeamStats();
            window.getCurrentBatsman();
            
            console.log('');
            console.log('2️⃣ Simulating some gameplay:');
            
            // Simulate a few balls
            console.log('   📍 Ball 1: Boundary (4 runs)');
            window.testBoundary(4);
            
            console.log('   📍 Ball 2: Single (1 run - batsmen swap)');
            game.startNewBall();
            game.ballState.runsThisBall = 1;
            game.doCompleteBall();
            
            console.log('   📍 Ball 3: Wicket!');
            window.testWicket('caught');
            
            console.log('');
            console.log('3️⃣ Current State After Wicket:');
            window.getCurrentBatsman();
            window.showBattingLineup();
            
            console.log('');
            console.log('4️⃣ Load Sample Full Innings:');
            window.simulateInnings();
            
            console.log('');
            console.log('5️⃣ View Scorecard:');
            window.showScorecard();
            
            console.log('');
            console.log('✅ DEMO COMPLETE!');
            console.log('📊 The scorecard should now be visible on screen');
            console.log('🎮 You can also click the "📊 Scorecard" button in bottom-right anytime during gameplay');
            console.log('');
            console.log('🧪 Try these commands:');
            console.log('  • bowlStraight() then playCoverDrive() - hit ball and score runs');
            console.log('  • testWicket("run out") - simulate different dismissal types'); 
            console.log('  • setTeamName("Your Team") - customize team name');
            console.log('  • hideScorecard() / showScorecard() - toggle display');
        };

        // ✅ NEW: Quick demo of probability threshold in action
        window.demoCatchProbabilityThreshold = () => {
            console.log('🚀 QUICK DEMO: Realistic Catch Probability System');
            console.log('================================================');
            console.log('');
            
            // Test all scenarios quickly
            const scenarios = ['easy', 'medium', 'hard', 'impossible'];
            scenarios.forEach(scenario => {
                console.log(`🎬 ${scenario.toUpperCase()} SCENARIO:`);
                window.testCatchScenario(scenario);
                console.log('');
            });
            
            console.log('🎯 SUMMARY:');
            console.log('  ✅ Easy catches: Most fielders will attempt');
            console.log('  ⚖️ Medium catches: Some fielders will attempt');
            console.log('  🔥 Hard catches: Few fielders will attempt');
            console.log('  🚫 Impossible catches: Fielders avoid and field instead');
            console.log('');
            console.log('🧠 This makes fielding much more realistic - no more impossible diving attempts!');
            console.log('🎮 Try bowling and hitting to see it in action: bowlStraight() → playUpperCut()');
        };
        
        // ✅ NEW: Test dropped catch scenario specifically
        window.testDroppedCatch = () => {
            if (!game.fielders || game.fielders.length < 2) {
                console.log('❌ Need at least 2 fielders for backup test');
                return;
            }
            
            // Start new ball
            game.startNewBall();
            
            // Get two fielders for testing
            const primaryFielder = game.fielders[0];
            const backupFielder = game.fielders[1];
            
            console.log(`🧪 Testing dropped catch scenario:`);
            console.log(`   Primary: ${primaryFielder.userData.description}`);
            console.log(`   Expected backup: ${backupFielder.userData.description}`);
            
            // Position ball near first fielder
            game.cricketBall.position.copy(primaryFielder.position);
            game.cricketBall.position.x += 3;
            game.cricketBall.position.y += 2;
            
            // Set ball moving moderately
            game.ballPhysics.velocity.set(-2, -1, 1);
            game.ballPhysics.isMoving = true;
            game.fieldingSystem.ballIsHit = true;
            
            // Force a dropped catch to test backup system
            setTimeout(() => {
                console.log('🎭 Simulating dropped catch...');
                game.droppedCatch(primaryFielder, 'regularcatch');
            }, 1000);
            
            console.log('🎬 Dropped catch test started - watch console for backup fielder assignment!');
        };

        // ✅ NEW: Target Chase System Global Functions
        window.startTargetChase = (targetRuns = null, maxOvers = 2.0) => {
            if (game) {
                game.startTargetChase(targetRuns, maxOvers);
            } else {
                console.log('⚠️ Game not initialized yet');
            }
        };

        window.restartTargetChase = () => {
            if (game) {
                game.resetTargetChase();
                // Generate new random target
                game.startTargetChase();
            } else {
                console.log('⚠️ Game not initialized yet');
            }
        };

        // ✅ NEW: Target Chase Demo Functions
        window.demoTargetChase = () => {
            console.log('🎯 TARGET CHASE DEMO');
            console.log('==================');
            console.log('');
            console.log('🎮 QUICK START:');
            console.log('  startTargetChase() - Start with random target (15-34 runs in 2 overs)');
            console.log('  startTargetChase(25) - Chase specific target (25 runs)');
            console.log('  startTargetChase(30, 3.0) - Custom target and overs (30 runs in 3 overs)');
            console.log('');
            console.log('🏏 GAMEPLAY:');
            console.log('  • Bowl balls using: bowlStraight(), bowlLeft(), bowlRight()');
            console.log('  • Play shots using: playCoverDrive(), playPullShot(), etc.');
            console.log('  • Run between wickets with SPACE key or startRun()');
            console.log('  • Watch target display in top-right corner');
            console.log('');
            console.log('🏆 WIN CONDITIONS:');
            console.log('  ✅ Reach target runs before overs run out');
            console.log('  ❌ Fail if overs complete without reaching target');
            console.log('  ❌ Fail if all 10 wickets lost');
            console.log('  ❌ Fail if target becomes mathematically impossible');
            console.log('');
            console.log('🎯 FEATURES:');
            console.log('  • Real-time required run rate calculation');
            console.log('  • Color-coded urgency indicators');
            console.log('  • Professional game over screens');
            console.log('  • Restart functionality');
            console.log('');
            console.log('Try: startTargetChase() to begin!');
        };

        // ✅ NEW: Test boundary scoring fix
        window.testBoundaryFix = () => {
            console.log('🏏 TESTING BOUNDARY SCORING FIX');
            console.log('===============================');
            console.log('✅ FIXED: Ball physics stops at boundary to prevent false bounces');
            console.log('✅ FIXED: Proper cricket rules for 4s vs 6s');
            console.log('');
            console.log('🏆 CRICKET RULES:');
            console.log('  📏 SIX: Ball crosses boundary WITHOUT touching ground anywhere');
            console.log('  📏 FOUR: Ball touches ground anywhere during flight (even if airborne at boundary)');
            console.log('');
            console.log('🔧 TECHNICAL FIX:');
            console.log('  🛑 Ball physics stops immediately when boundary crossed');
            console.log('  🚫 Prevents false ground contact after boundary bounce-back');
            console.log('');
            
            // Test 1: Lofted shot for potential six
            console.log('📈 Test 1: Lofted shot (may bounce early but still reach boundary high)');
            game.startNewBall();
            game.playLoftedShot();
            
            setTimeout(() => {
                // Test 2: Drive shot for four
                console.log('\n📉 Test 2: Drive shot (lower trajectory, likely touches ground)');
                game.startNewBall();
                game.playDriveShot();
                
                setTimeout(() => {
                    // Test 3: Power shot for six
                    console.log('\n🚀 Test 3: Power shot (high arc, should be TRUE SIX now!)');
                    game.startNewBall();
                    game.playPowerShot();
                    
                    setTimeout(() => {
                        // Test 4: Helicopter shot for guaranteed six
                        console.log('\n🚁 Test 4: Helicopter shot (maximum height, must be SIX)');
                        game.startNewBall();
                        game.playHelicopterShot();
                        
                        console.log('\n🎯 Watch for these key messages:');
                        console.log('📊 "🛑 Ball physics stopped" → Boundary crossed, physics halted');
                        console.log('📊 "🚀 SIX! without touching ground" → TRUE SIX achieved!');
                        console.log('📊 "🏏 FOUR! bounced during flight" → Proper four with early bounce');
                    }, 3000);
                }, 3000);
            }, 3000);
        };

        // ✅ NEW: Quick six test
        window.testSix = () => {
            console.log('🚀 TESTING FOR TRUE SIX...');
            console.log('✅ FIXED: Lofted shots now start at bat height (1.2m)');
            console.log('✅ FIXED: Only natural ground contact registers as bounce');
            game.startNewBall();
            game.playHelicopterShot(); // Maximum height shot
            console.log('🎯 Watch for: "🚀 Lofted shot: Starting at bat height" and "🚀 SIX! without touching ground"');
        };

        window.testFour = () => {
            console.log('🏏 TESTING FOR FOUR...');
            game.startNewBall();
            game.playDriveShot(); // Lower trajectory shot
            console.log('🎯 Watch for: "🏐 Ball naturally hit ground" and "🏏 FOUR!"');
        };

        window.compareSixVsFour = () => {
            console.log('⚖️ COMPARING SIX VS FOUR...');
            console.log('1️⃣ Testing lofted shot (should be SIX):');
            game.startNewBall();
            game.playHelicopterShot();
            
            setTimeout(() => {
                console.log('\n2️⃣ Testing ground shot (should be FOUR):');
                game.startNewBall();
                game.playCoverDrive();
                
                console.log('\n🎯 Compare the console messages to see the difference!');
            }, 4000);
        };

        window.testTimingEffect = () => {
            console.log('⏱️ TESTING TIMING EFFECT ON LOFTED SHOTS');
            console.log('==========================================');
            console.log('✅ NOW FIXED: Distance-based bounce detection');
            console.log('📏 NEW: Only infield bounces (< 68m) result in FOUR');
            console.log('🎯 Timing affects trajectory and bounce location');
            console.log('');
            console.log('🔄 Hit multiple slogs and watch the timing differences:');
            console.log('   🎯 PERFECT timing → High start (1.2m) → Clears field → SIX');
            console.log('   ✅ GOOD timing → Good start (1.0m) → May clear field → SIX/FOUR');  
            console.log('   ⚠️ OKAY timing → Lower start (0.7m) → Infield bounce → FOUR');
            console.log('   ❌ POOR timing → Low start (0.4m) → Early infield bounce → FOUR');
            console.log('');
            console.log('🏏 Try multiple playSlog() or playHelicopterShot() calls!');
            console.log('🔧 Or use testDistanceBounceLogic() to understand the new system');
        };

        // Helper functions to test specific timing scenarios
        window.testPerfectSlog = () => {
            console.log('🎯 FORCING PERFECT TIMING SLOG...');
            game.startNewBall();
            // Temporarily force perfect timing by manipulating distance
            const originalPos = game.cricketBall.position.clone();
            game.cricketBall.position.set(0, 0, 1.5); // Perfect hitting distance
            game.playSlog();
            console.log('Should see: "🎯 PERFECT lofted shot: Starting at 1.2m" → SIX');
        };

        window.testPoorSlog = () => {
            console.log('❌ FORCING POOR TIMING SLOG...');
            game.startNewBall();
            // Force poor timing by manipulating distance 
            game.cricketBall.position.set(0, 0, 4.0); // Too far for good timing
            game.playSlog();
            console.log('Should see: "❌ POOR lofted shot: Starting at 0.4m" → FOUR');
        };

        window.testMistimedBounce = () => {
            console.log('🔧 TESTING MISTIMED SLOG THAT BOUNCES');
            console.log('====================================');
            console.log('✅ FIXED: Distance-based bounce detection');
            console.log('📏 NEW LOGIC: Only infield bounces (< 68m) count as FOUR');
            console.log('🎯 This test should show:');
            console.log('   1. "❌ POOR lofted shot: Starting at 0.4m"');
            console.log('   2. "🏐 Ball bounced INSIDE field" → FOUR');
            console.log('   3. "🏏 FOUR! Ball bounced during flight"');
            console.log('   4. "📝 Bounce flag: true"');
            console.log('');
            
            game.startNewBall();
            game.cricketBall.position.set(0, 0, 4.0); // Force poor timing
            game.playSlog();
            
            console.log('⏱️ Watch the console for the sequence above...');
        };

        window.testDistanceBounceLogic = () => {
            console.log('📏 TESTING DISTANCE-BASED BOUNCE LOGIC');
            console.log('=====================================');
            console.log('✅ NEW SYSTEM: Bounce location determines 4 vs 6');
            console.log('');
            console.log('🏏 CRICKET RULES:');
            console.log('  📍 Bounce < 68m (inside field) → FOUR if crosses boundary');
            console.log('  📍 Bounce > 68m (outside field) → SIX (already crossed boundary)');
            console.log('  📍 No bounce → SIX');
            console.log('');
            console.log('🔄 Hit multiple shots and watch bounce distances:');
            console.log('  🎯 Well-timed lofted shots → May clear field entirely → SIX');
            console.log('  ⚠️ Mistimed shots → Bounce early (infield) → FOUR');
            console.log('  🚀 Perfect shots → High arc, may bounce beyond boundary → SIX');
            console.log('');
            console.log('🧪 Try: playSlog(), playHelicopterShot(), playPowerShot()');
        };

        // ✅ NEW: Test over completion and batsman switching
        window.testOverCompletion = () => {
            console.log('🏏 OVER COMPLETION BATSMAN SWITCHING TEST');
            console.log('==========================================');
            console.log('');
            
            // Show current batsmen
            const striker = game.battingTeam.players[game.battingTeam.currentBatsman];
            const nonStriker = game.battingTeam.players[game.battingTeam.currentPartner];
            console.log(`📍 BEFORE: Striker = ${striker.name}, Non-striker = ${nonStriker.name}`);
            console.log(`📊 Current score: ${game.cricketScore.runs}/${game.cricketScore.wickets} (${game.cricketScore.overs.toFixed(1)} overs, ${game.cricketScore.balls} balls)`);
            console.log('');
            
            // Simulate balls to complete current over
            const ballsInCurrentOver = game.cricketScore.balls % 6;
            const ballsNeeded = 6 - ballsInCurrentOver;
            
            console.log(`🎯 Current ball count: ${game.cricketScore.balls} (${ballsInCurrentOver} balls in current over)`);
            console.log(`🎾 Simulating ${ballsNeeded} balls to complete the over...`);
            console.log('');
            
            for (let i = 0; i < ballsNeeded; i++) {
                const ballNumber = ballsInCurrentOver + i + 1;
                console.log(`--- Ball ${ballNumber} of over ---`);
                
                // Simulate even runs so we can see the over-completion swap clearly
                game.ballState.runsThisBall = 2; // Even runs - no swap during ball
                game.ballState.ballType = 'normal';
                game.ballState.isComplete = false;
                game.ballState.isActive = true;
                game.ballState.completionReason = null;
                
                // Complete the ball
                game.doCompleteBall();
                
                // Show result
                const currentStriker = game.battingTeam.players[game.battingTeam.currentBatsman];
                console.log(`   After ball: ${currentStriker.name} on strike`);
                console.log('');
            }
            
            // Final state
            const finalStriker = game.battingTeam.players[game.battingTeam.currentBatsman];
            const finalNonStriker = game.battingTeam.players[game.battingTeam.currentPartner];
            console.log(`📍 AFTER OVER: Striker = ${finalStriker.name}, Non-striker = ${finalNonStriker.name}`);
            console.log(`📊 Final score: ${game.cricketScore.runs}/${game.cricketScore.wickets} (${game.cricketScore.overs.toFixed(1)} overs, ${game.cricketScore.balls} balls)`);
            console.log('');
            console.log('✅ Over completed! Notice how batsmen switched ends for the new over.');
        };

        // ✅ NEW: Test optimized character loading system
        window.testOptimizedLoading = () => {
            console.log('🚀 OPTIMIZED CHARACTER LOADING SYSTEM');
            console.log('=====================================');
            console.log('');
            console.log('✅ OPTIMIZATION IMPLEMENTED:');
            console.log('  🎯 All cricket team members now load standingidle.fbx directly');
            console.log('  ⚡ Eliminates two-step loading process (character.fbx + animation)');
            console.log('  🏃 Immediate idle animation starts on load');
            console.log('  🛡️ Fallback to original method if standingidle.fbx fails');
            console.log('');
            console.log('🏏 AFFECTED CHARACTERS:');
            console.log('  🎳 Bowler: standingidle.fbx → immediate idle animation');
            console.log('  🥅 Wicket Keeper: standingidle.fbx → immediate idle animation');
            console.log('  ⚾ 9 Fielders: standingidle.fbx → immediate idle animations');
            console.log('');
            console.log('⚡ PERFORMANCE BENEFITS:');
            console.log('  • Faster loading: Single file vs character + animation');
            console.log('  • Immediate animations: No delay waiting for animation loading');
            console.log('  • Better user experience: Characters appear animated from start');
            console.log('  • Reduced network requests: 11 fewer animation file requests');
            console.log('');
            console.log('🔍 WHAT TO OBSERVE:');
            console.log('  ✅ Check console for "idle animation started immediately" messages');
            console.log('  ✅ All fielders should be animating as soon as they appear');
            console.log('  ✅ No delay between character appearance and animation start');
            console.log('  ⚠️ Watch for fallback messages if standingidle.fbx is missing');
            console.log('');
            console.log('🎮 TEST COMMANDS:');
            console.log('  game.loadCricketTeam() - Reload entire team with optimization');
            console.log('  game.fielders.length - Check how many fielders loaded');
            console.log('  game.bowler.userData - Check bowler animation system');
        };
    } catch (error) {
        console.error('Error initializing game:', error);
        document.body.innerHTML = '<div style="color: white; text-align: center; padding: 50px;">Error: ' + error.message + '</div>';
    }
});
