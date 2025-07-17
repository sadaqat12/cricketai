// Cricket Scoring System - External Interface
// This file provides external interfaces for cricket scoring
// The main scoring logic is integrated into cricket-game.js

console.log('📊 Cricket Scoring System loaded');

// External scoring interface for potential future extensions
window.CricketScoring = {
    
    // Get current score
    getCurrentScore: function() {
        if (window.cricketGame && window.cricketGame.cricketScore) {
            return {
                runs: window.cricketGame.cricketScore.runs,
                wickets: window.cricketGame.cricketScore.wickets,
                overs: window.cricketGame.cricketScore.overs,
                balls: window.cricketGame.cricketScore.balls
            };
        }
        return { runs: 0, wickets: 0, overs: 0, balls: 0 };
    },
    
    // Format score for display
    formatScore: function() {
        const score = this.getCurrentScore();
        return `${score.runs}/${score.wickets} (${score.overs.toFixed(1)} overs)`;
    },
    
    // Get ball state
    getBallState: function() {
        if (window.cricketGame && window.cricketGame.ballState) {
            return window.cricketGame.ballState;
        }
        return null;
    },
    
    // Check if game is active
    isGameActive: function() {
        return window.cricketGame && window.cricketGame.ballState && window.cricketGame.ballState.isActive;
    },
    
    // External event handlers
    onScoreUpdate: function(callback) {
        // Store callback for score updates
        if (!window.cricketScoringCallbacks) {
            window.cricketScoringCallbacks = [];
        }
        window.cricketScoringCallbacks.push(callback);
    },
    
    // Trigger score update callbacks
    triggerScoreUpdate: function() {
        if (window.cricketScoringCallbacks) {
            const score = this.getCurrentScore();
            window.cricketScoringCallbacks.forEach(callback => {
                try {
                    callback(score);
                } catch (error) {
                    console.error('Error in score update callback:', error);
                }
            });
        }
    }
};

// Utility functions for cricket scoring
window.CricketScoringUtils = {
    
    // Calculate run rate
    calculateRunRate: function(runs, overs) {
        if (overs === 0) return 0;
        return (runs / overs).toFixed(2);
    },
    
    // Calculate required run rate
    calculateRequiredRunRate: function(runsNeeded, oversRemaining) {
        if (oversRemaining === 0) return 0;
        return (runsNeeded / oversRemaining).toFixed(2);
    },
    
    // Convert balls to overs
    ballsToOvers: function(balls) {
        const completedOvers = Math.floor(balls / 6);
        const ballsInCurrentOver = balls % 6;
        return completedOvers + (ballsInCurrentOver / 10.0);
    },
    
    // Convert overs to balls
    oversToBalls: function(overs) {
        const completedOvers = Math.floor(overs);
        const ballsInCurrentOver = Math.round((overs - completedOvers) * 10);
        return (completedOvers * 6) + ballsInCurrentOver;
    }
};

// Initialize when cricket game is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Cricket Scoring external interface ready');
    
    // Set up integration with main game
    if (window.cricketGame) {
        console.log('📊 Cricket Scoring connected to main game');
    } else {
        // Wait for game to initialize
        let checkCount = 0;
        const checkInterval = setInterval(() => {
            if (window.cricketGame) {
                console.log('📊 Cricket Scoring connected to main game (delayed)');
                clearInterval(checkInterval);
            } else if (checkCount++ > 50) {
                console.log('⚠️ Cricket Scoring: Main game not found after 5 seconds');
                clearInterval(checkInterval);
            }
        }, 100);
    }
}); 