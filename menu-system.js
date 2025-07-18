// Menu System Controller
let gameState = {
    isPlaying: false,
    isPaused: false,
    gameMode: null,
    currentMenu: 'mainMenu'
};

// Menu Navigation Functions
function showMainMenu() {
    hideAllMenus();
    document.getElementById('mainMenu').classList.add('active');
    gameState.currentMenu = 'mainMenu';
}

function showGameModes() {
    hideAllMenus();
    document.getElementById('gameModeMenu').classList.add('active');
    gameState.currentMenu = 'gameModeMenu';
}

function showUserGuide() {
    hideAllMenus();
    document.getElementById('userGuide').classList.add('active');
    gameState.currentMenu = 'userGuide';
}

function showSettings() {
    hideAllMenus();
    document.getElementById('settingsMenu').classList.add('active');
    gameState.currentMenu = 'settingsMenu';
}

function showCredits() {
    hideAllMenus();
    document.getElementById('creditsMenu').classList.add('active');
    gameState.currentMenu = 'creditsMenu';
}

function hideAllMenus() {
    document.querySelectorAll('.menu-screen').forEach(menu => {
        menu.classList.remove('active');
    });
}

// Game Mode Functions
function startSinglePlayer() {
    // Show single player options instead of directly starting
    hideAllMenus();
    showSinglePlayerOptions();
}

function showSinglePlayerOptions() {
    // Create single player options menu if it doesn't exist
    let singlePlayerMenu = document.getElementById('singlePlayerOptions');
    
    if (!singlePlayerMenu) {
        singlePlayerMenu = document.createElement('div');
        singlePlayerMenu.id = 'singlePlayerOptions';
        singlePlayerMenu.className = 'menu-screen';
        singlePlayerMenu.innerHTML = `
            <div class="menu-container">
                <h2 class="menu-title">Single Player Mode</h2>
                
                <div class="game-mode-grid">
                    <div class="game-mode-card" onclick="startFreePlay()">
                        <div class="mode-icon">🏏</div>
                        <h3>Free Play</h3>
                        <p>Practice your batting skills with unlimited time</p>
                        <div class="mode-features">
                            <span>• No pressure</span>
                            <span>• Unlimited overs</span>
                            <span>• Practice all shots</span>
                        </div>
                    </div>
                    
                    <div class="game-mode-card" onclick="startTargetChaseMode()">
                        <div class="mode-icon">🎯</div>
                        <h3>Target Chase</h3>
                        <p>Chase a target score within limited overs!</p>
                        <div class="mode-features">
                            <span>• Random target (15-34 runs)</span>
                            <span>• 2 overs (12 balls)</span>
                            <span>• Win/lose conditions</span>
                        </div>
                    </div>
                </div>
                
                <button class="menu-btn back-btn" onclick="showGameModes()">
                    <span class="btn-icon">←</span> Back
                </button>
            </div>
        `;
        document.body.appendChild(singlePlayerMenu);
    }
    
    singlePlayerMenu.classList.add('active');
    gameState.currentMenu = 'singlePlayerOptions';
}

function startFreePlay() {
    gameState.gameMode = 'freePlay';
    showLoadingScreen();
    
    // Hide menus and show game immediately
    hideAllMenus();
    document.getElementById('gameContainer').style.display = 'block';
    
    // ✅ NEW: Let the game's loading system handle the loading screen
    // Don't hide loading screen here - the game will handle it
    
    // Initialize the game without target chase
    if (window.startCricketGame) {
        window.startCricketGame();
    }
    
    gameState.isPlaying = true;
}

function startTargetChaseMode() {
    gameState.gameMode = 'targetChase';
    showLoadingScreen();
    
    // Hide menus and show game immediately
    hideAllMenus();
    document.getElementById('gameContainer').style.display = 'block';
    
    // ✅ NEW: Let the game's loading system handle the loading screen
    // Don't hide loading screen here - the game will handle it
    
    // Initialize the game
    if (window.startCricketGame) {
        window.startCricketGame();
    }
    
    // Start target chase after loading is complete
    // The game will handle target chase activation after loading
    window.pendingTargetChase = true;
    
    gameState.isPlaying = true;
}

function showMultiplayerOptions() {
    // Placeholder for multiplayer functionality
    alert('Multiplayer mode coming soon! Stay tuned for online cricket matches.');
}

// In-Game Functions
function togglePauseMenu() {
    const pauseMenu = document.getElementById('pauseMenu');
    if (gameState.isPaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

function pauseGame() {
    gameState.isPaused = true;
    document.getElementById('pauseMenu').style.display = 'flex';
    
    // Pause game logic
    if (window.pauseCricketGame) {
        window.pauseCricketGame();
    }
}

function resumeGame() {
    gameState.isPaused = false;
    document.getElementById('pauseMenu').style.display = 'none';
    
    // Resume game logic
    if (window.resumeCricketGame) {
        window.resumeCricketGame();
    }
}

function showUserGuideInGame() {
    // Show user guide while in game
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('userGuide').classList.add('active');
    
    // Add a special back button handler for in-game
    const backBtn = document.querySelector('#userGuide .back-btn');
    backBtn.onclick = function() {
        document.getElementById('userGuide').classList.remove('active');
        document.getElementById('pauseMenu').style.display = 'flex';
    };
}

function showSettingsInGame() {
    // Show settings while in game
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('settingsMenu').classList.add('active');
    
    // Add a special back button handler for in-game
    const backBtn = document.querySelector('#settingsMenu .back-btn');
    backBtn.onclick = function() {
        document.getElementById('settingsMenu').classList.remove('active');
        document.getElementById('pauseMenu').style.display = 'flex';
    };
}

function quitToMenu() {
    // Confirm before quitting
    if (confirm('Are you sure you want to quit to the main menu? Your progress will be lost.')) {
        gameState.isPlaying = false;
        gameState.isPaused = false;
        
        // Stop game
        if (window.stopCricketGame) {
            window.stopCricketGame();
        }
        
        // Hide game and show main menu
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('pauseMenu').style.display = 'none';
        showMainMenu();
    }
}

// Loading Screen Functions
function showLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'flex';
}

function hideLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'none';
}

// Settings Management
function initializeSettings() {
    // Graphics Quality
    const qualitySelect = document.querySelector('.settings-group select');
    if (qualitySelect) {
        qualitySelect.addEventListener('change', (e) => {
            if (window.setGraphicsQuality) {
                window.setGraphicsQuality(e.target.value.toLowerCase());
            }
        });
    }
    
    // Shadows Toggle
    const shadowsCheckbox = document.querySelector('input[type="checkbox"][class="setting-control"]');
    if (shadowsCheckbox) {
        shadowsCheckbox.addEventListener('change', (e) => {
            if (window.setShadowsEnabled) {
                window.setShadowsEnabled(e.target.checked);
            }
        });
    }
    
    // Ball Trail Toggle
    const ballTrailCheckbox = document.querySelectorAll('input[type="checkbox"][class="setting-control"]')[1];
    if (ballTrailCheckbox) {
        ballTrailCheckbox.addEventListener('change', (e) => {
            if (window.setBallTrailEnabled) {
                window.setBallTrailEnabled(e.target.checked);
            }
        });
    }
    
    // Volume Controls
    const volumeSliders = document.querySelectorAll('input[type="range"]');
    volumeSliders.forEach((slider, index) => {
        slider.addEventListener('input', (e) => {
            const value = e.target.value;
            if (index === 0 && window.setMasterVolume) {
                window.setMasterVolume(value / 100);
            } else if (index === 1 && window.setSoundEffectsVolume) {
                window.setSoundEffectsVolume(value / 100);
            }
        });
    });
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (gameState.isPlaying) {
        // ESC key to toggle pause
        if (e.key === 'Escape') {
            togglePauseMenu();
        }
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeSettings();
    
    // Show main menu by default
    showMainMenu();
    
    // Update loading messages
    const loadingTexts = [
        'Preparing the cosmic cricket field',
        'Loading player animations',
        'Setting up fielding positions',
        'Calibrating ball physics',
        'Polishing the stumps',
        'Ready to play!'
    ];
    
    let textIndex = 0;
    setInterval(() => {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText && document.getElementById('loadingScreen').style.display === 'flex') {
            loadingText.textContent = loadingTexts[textIndex % loadingTexts.length];
            textIndex++;
        }
    }, 1000);
});

// Score Display Functions
function updateScore(runs, wickets, overs) {
    document.getElementById('runsScore').textContent = runs;
    document.getElementById('wicketsScore').textContent = wickets;
    document.getElementById('oversScore').textContent = overs;
}

// AI Bowler Toggle Functions
function toggleAIBowler() {
    if (window.cricketGame) {
        const game = window.cricketGame;
        const toggle = document.getElementById('aiBowlerToggleBtn');
        const help = document.getElementById('manualBowlingHelp');
        
        if (game.aiBowler.isEnabled) {
            // Disable AI Bowler
            game.disableAIBowler();
            toggle.className = 'bowling-btn ai-disabled';
            toggle.innerHTML = `
                <span class="btn-icon">👤</span> 
                <span class="btn-text">AI Bowler: OFF</span>
            `;
            help.style.display = 'block';
            console.log('🎳 AI Bowler disabled - Manual bowling mode activated');
            console.log('📋 Use digit keys 6-0 to bowl manually');
        } else {
            // Enable AI Bowler
            game.enableAIBowler();
            toggle.className = 'bowling-btn ai-enabled';
            toggle.innerHTML = `
                <span class="btn-icon">🤖</span> 
                <span class="btn-text">AI Bowler: ON</span>
            `;
            help.style.display = 'none';
            console.log('🤖 AI Bowler enabled - Automatic bowling activated');
            
            // ✅ NEW: Trigger AI bowling immediately when toggled on
            if (!game.ballPhysics.isMoving && !game.ballState.isActive) {
                console.log('🎳 Starting AI bowling sequence immediately...');
                setTimeout(() => {
                    game.initializeAIBowler();
                }, 500); // Small delay for UI feedback
            } else {
                console.log('⚠️ Ball already in play - AI will take over after ball completion');
            }
        }
    }
}

function showBowlingControls() {
    // Only show in free play mode
    if (gameState.gameMode === 'freePlay') {
        const controls = document.getElementById('bowlingControls');
        if (controls) {
            controls.style.display = 'flex';
        }
    }
}

function hideBowlingControls() {
    const controls = document.getElementById('bowlingControls');
    if (controls) {
        controls.style.display = 'none';
    }
}

function hideBowlingControls() {
    const controls = document.getElementById('bowlingControls');
    if (controls) {
        controls.style.display = 'none';
    }
}

// Export functions for game integration
window.menuSystem = {
    updateScore,
    pauseGame,
    resumeGame,
    showLoadingScreen,
    hideLoadingScreen,
    gameState,
    showBowlingControls,
    hideBowlingControls
};

// Make toggle function globally accessible
window.toggleAIBowler = toggleAIBowler; 