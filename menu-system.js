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
    // Show multiplayer setup screen
    hideAllMenus();
    showMultiplayerSetup();
}

// Multiplayer Setup Functions
function showMultiplayerSetup() {
    // Create multiplayer setup screen if it doesn't exist
    let multiplayerSetup = document.getElementById('multiplayerSetup');
    
    if (!multiplayerSetup) {
        multiplayerSetup = document.createElement('div');
        multiplayerSetup.id = 'multiplayerSetup';
        multiplayerSetup.className = 'menu-screen';
        multiplayerSetup.innerHTML = `
            <div class="menu-container">
                <h2 class="menu-title">Local Multiplayer</h2>
                
                <div class="player-setup">
                    <div class="player-input-section">
                        <div class="player-icon">🏏</div>
                        <h3>Player 1</h3>
                        <input type="text" id="player1Name" class="player-name-input" 
                               placeholder="Enter name" maxlength="20" 
                               value="Player 1">
                    </div>
                    
                    <div class="vs-divider">VS</div>
                    
                    <div class="player-input-section">
                        <div class="player-icon">🏏</div>
                        <h3>Player 2</h3>
                        <input type="text" id="player2Name" class="player-name-input" 
                               placeholder="Enter name" maxlength="20" 
                               value="Player 2">
                    </div>
                </div>
                
                <div class="match-settings">
                    <p class="settings-info">
                        <span class="info-icon">📋</span> Match Format: 3 overs per innings
                    </p>
                    <p class="settings-info">
                        <span class="info-icon">🎯</span> Second innings: Chase the target
                    </p>
                    <p class="settings-info">
                        <span class="info-icon">🎳</span> Bowling: Manual control only
                    </p>
                </div>
                
                <button class="menu-btn primary-btn" onclick="proceedToToss()">
                    <span class="btn-icon">🪙</span> Proceed to Toss
                </button>
                
                <button class="menu-btn back-btn" onclick="showGameModes()">
                    <span class="btn-icon">←</span> Back
                </button>
            </div>
        `;
        document.body.appendChild(multiplayerSetup);
    }
    
    multiplayerSetup.classList.add('active');
    gameState.currentMenu = 'multiplayerSetup';
    
    // Focus on first input
    setTimeout(() => {
        document.getElementById('player1Name').focus();
    }, 100);
}

function proceedToToss() {
    // Get player names
    const player1Name = document.getElementById('player1Name').value.trim() || 'Player 1';
    const player2Name = document.getElementById('player2Name').value.trim() || 'Player 2';
    
    // Store player names
    gameState.multiplayerData = {
        player1: { name: player1Name, runs: 0, wickets: 0 },
        player2: { name: player2Name, runs: 0, wickets: 0 },
        currentInnings: 1,
        firstInningsScore: 0,
        tossWinner: null,
        battingFirst: null
    };
    
    // Show toss screen
    showTossScreen();
}

function showTossScreen() {
    hideAllMenus();
    
    let tossScreen = document.getElementById('tossScreen');
    
    if (!tossScreen) {
        tossScreen = document.createElement('div');
        tossScreen.id = 'tossScreen';
        tossScreen.className = 'menu-screen';
        tossScreen.innerHTML = `
            <div class="menu-container">
                <h2 class="menu-title">Coin Toss</h2>
                
                <div class="toss-container">
                    <div class="coin-container">
                        <div class="coin" id="tossCoin">
                            <div class="coin-face heads">H</div>
                            <div class="coin-face tails">T</div>
                        </div>
                    </div>
                    
                    <div class="toss-selection">
                        <h3>${gameState.multiplayerData.player1.name}, choose:</h3>
                        <div class="toss-buttons">
                            <button class="toss-btn" onclick="performToss('heads')">
                                <span class="coin-icon">🪙</span> Heads
                            </button>
                            <button class="toss-btn" onclick="performToss('tails')">
                                <span class="coin-icon">🪙</span> Tails
                            </button>
                        </div>
                    </div>
                    
                    <div class="toss-result" id="tossResult" style="display: none;">
                        <h3 id="tossResultText"></h3>
                        <div class="choice-buttons" id="tossChoice" style="display: none;">
                            <button class="choice-btn" onclick="chooseToBat()">
                                <span class="btn-icon">🏏</span> Bat First
                            </button>
                            <button class="choice-btn" onclick="chooseToBowl()">
                                <span class="btn-icon">🎳</span> Bowl First
                            </button>
                        </div>
                    </div>
                </div>
                
                <button class="menu-btn back-btn" onclick="showMultiplayerSetup()">
                    <span class="btn-icon">←</span> Back
                </button>
            </div>
        `;
        document.body.appendChild(tossScreen);
    }
    
    tossScreen.classList.add('active');
    gameState.currentMenu = 'tossScreen';
}

function performToss(choice) {
    const coin = document.getElementById('tossCoin');
    const tossButtons = document.querySelectorAll('.toss-btn');
    const tossResult = document.getElementById('tossResult');
    const tossResultText = document.getElementById('tossResultText');
    
    // Disable buttons during animation
    tossButtons.forEach(btn => btn.disabled = true);
    
    // Add spinning animation
    coin.classList.add('spinning');
    
    // Determine result
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const player1Won = (choice === result);
    
    // After animation, show result
    setTimeout(() => {
        coin.classList.remove('spinning');
        coin.classList.add(result);
        
        // Update game state
        gameState.multiplayerData.tossWinner = player1Won ? 
            gameState.multiplayerData.player1.name : 
            gameState.multiplayerData.player2.name;
        
        // Show result
        tossResult.style.display = 'block';
        tossResultText.textContent = `${result.toUpperCase()}! ${gameState.multiplayerData.tossWinner} won the toss!`;
        
        // Show choice buttons after a short delay
        setTimeout(() => {
            document.getElementById('tossChoice').style.display = 'flex';
        }, 1000);
    }, 2000);
}

function chooseToBat() {
    const winner = gameState.multiplayerData.tossWinner;
    const player1Name = gameState.multiplayerData.player1.name;
    
    gameState.multiplayerData.battingFirst = (winner === player1Name) ? 'player1' : 'player2';
    startMultiplayerGame();
}

function chooseToBowl() {
    const winner = gameState.multiplayerData.tossWinner;
    const player1Name = gameState.multiplayerData.player1.name;
    
    gameState.multiplayerData.battingFirst = (winner === player1Name) ? 'player2' : 'player1';
    startMultiplayerGame();
}

function startMultiplayerGame() {
    gameState.gameMode = 'multiplayer';
    showLoadingScreen();
    
    // Hide menus and show game
    hideAllMenus();
    document.getElementById('gameContainer').style.display = 'block';
    
    // Initialize the game
    if (window.startCricketGame) {
        window.startCricketGame();
    }
    
    // Set pending multiplayer flag
    window.pendingMultiplayer = true;
    
    gameState.isPlaying = true;
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
        gameState.gameMode = null;
        
        // Reset multiplayer data if exists
        if (gameState.multiplayerData) {
            gameState.multiplayerData = null;
        }
        
        // Stop game
        if (window.stopCricketGame) {
            window.stopCricketGame();
        }
        
        // Hide game and show main menu
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('pauseMenu').style.display = 'none';
        
        // Hide loading screen if it's stuck
        hideLoadingScreen();
        
        // Remove any lingering UI elements
        const gameScreens = document.querySelectorAll('[id*="multiplayerSetup"], [id*="tossScreen"]');
        gameScreens.forEach(screen => {
            if (screen && screen.classList.contains('active')) {
                screen.classList.remove('active');
            }
        });
        
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