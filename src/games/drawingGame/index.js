const GAME_NAME = 'drawing-game';

// Timing settings (in ms)
const TIMING = {
  WORD_SUBMISSION: 30000,   // 30 seconds to submit words
  DRAWING_PHASE: 30000,     // 30 seconds to draw
  VIEWING_EACH: 5000,       // 5 seconds to view each drawing
  VOTING_GRACE: 2000,       // Extra time after viewing for final votes
  RESULTS_DISPLAY: 5000,    // Time to show results
};

/**
 * Initialize the game state for Drawing Game
 */
function initGame(lobby, io) {
  const playerIds = Array.from(lobby.players.keys());

  lobby.gameState = {
    phase: 'word-submission',
    submittedWords: {},       // playerId -> word
    chosenWord: null,
    drawings: {},             // playerId -> drawing data (base64 or canvas data)
    votes: {},                // playerId -> { odrawingOwnerId: 'up' | 'down' }
    scores: {},               // playerId -> { up: number, down: number }
    currentViewingIndex: 0,
    viewingOrder: [],
    results: null,
    timers: {}
  };

  // Initialize scores for all players
  for (const playerId of playerIds) {
    lobby.gameState.scores[playerId] = { up: 0, down: 0 };
    lobby.gameState.votes[playerId] = {};
  }

  return lobby.gameState;
}

/**
 * Start the word submission phase
 */
function startWordSubmission(lobby, io) {
  const roomCode = lobby.code;
  const state = lobby.gameState;

  state.phase = 'word-submission';

  io.to(roomCode).emit('game:phase', {
    phase: 'word-submission',
    timeLimit: TIMING.WORD_SUBMISSION
  });

  // Set timer for word submission phase
  state.timers.wordSubmission = setTimeout(() => {
    finishWordSubmission(lobby, io);
  }, TIMING.WORD_SUBMISSION);
}

/**
 * Handle word submission from a player
 */
function submitWord(lobby, playerId, word, io) {
  const state = lobby.gameState;

  if (state.phase !== 'word-submission') {
    return { error: 'Not in word submission phase' };
  }

  if (!word || word.trim().length === 0) {
    return { error: 'Word cannot be empty' };
  }

  state.submittedWords[playerId] = word.trim();

  const player = lobby.players.get(playerId);
  io.to(lobby.code).emit('game:word-submitted', {
    playerId,
    username: player.username
  });

  // Check if all players have submitted
  if (Object.keys(state.submittedWords).length === lobby.players.size) {
    clearTimeout(state.timers.wordSubmission);
    finishWordSubmission(lobby, io);
  }

  return { success: true };
}

/**
 * Finish word submission and pick a random word
 */
function finishWordSubmission(lobby, io) {
  const state = lobby.gameState;
  const roomCode = lobby.code;

  // If no words submitted, use a default
  const words = Object.values(state.submittedWords);
  if (words.length === 0) {
    state.chosenWord = 'banana'; // Default fallback
  } else {
    // Pick a random word
    const randomIndex = Math.floor(Math.random() * words.length);
    state.chosenWord = words[randomIndex];
  }

  state.phase = 'drawing';

  io.to(roomCode).emit('game:phase', {
    phase: 'drawing',
    word: state.chosenWord,
    timeLimit: TIMING.DRAWING_PHASE
  });

  // Set timer for drawing phase
  state.timers.drawing = setTimeout(() => {
    finishDrawing(lobby, io);
  }, TIMING.DRAWING_PHASE);
}

/**
 * Handle drawing submission from a player
 */
function submitDrawing(lobby, playerId, drawingData, io) {
  const state = lobby.gameState;

  if (state.phase !== 'drawing') {
    return { error: 'Not in drawing phase' };
  }

  state.drawings[playerId] = drawingData;

  const player = lobby.players.get(playerId);
  io.to(lobby.code).emit('game:drawing-submitted', {
    playerId,
    username: player.username
  });

  // Check if all players have submitted
  if (Object.keys(state.drawings).length === lobby.players.size) {
    clearTimeout(state.timers.drawing);
    finishDrawing(lobby, io);
  }

  return { success: true };
}

/**
 * Finish drawing phase and start viewing
 */
function finishDrawing(lobby, io) {
  const state = lobby.gameState;
  const roomCode = lobby.code;

  // Create random viewing order
  const playerIds = Array.from(lobby.players.keys());
  state.viewingOrder = shuffleArray(playerIds);
  state.currentViewingIndex = 0;
  state.phase = 'viewing';

  // Notify clients that we're entering viewing phase
  io.to(roomCode).emit('game:phase', { phase: 'viewing' });

  // Start viewing the first drawing
  showNextDrawing(lobby, io);
}

/**
 * Show the next drawing to everyone
 */
function showNextDrawing(lobby, io) {
  const state = lobby.gameState;
  const roomCode = lobby.code;

  if (state.currentViewingIndex >= state.viewingOrder.length) {
    // All drawings viewed, show results
    finishViewing(lobby, io);
    return;
  }

  const currentPlayerId = state.viewingOrder[state.currentViewingIndex];
  const currentPlayer = lobby.players.get(currentPlayerId);

  // Skip if player disconnected
  if (!currentPlayer) {
    state.currentViewingIndex++;
    showNextDrawing(lobby, io);
    return;
  }

  const drawing = state.drawings[currentPlayerId] || null;

  io.to(roomCode).emit('game:show-drawing', {
    drawingPlayerId: currentPlayerId,
    drawingPlayerUsername: currentPlayer.username,
    drawing: drawing,
    index: state.currentViewingIndex,
    total: state.viewingOrder.length,
    timeLimit: TIMING.VIEWING_EACH
  });

  // Set timer for next drawing
  state.timers.viewing = setTimeout(() => {
    state.currentViewingIndex++;
    showNextDrawing(lobby, io);
  }, TIMING.VIEWING_EACH);
}

/**
 * Handle a vote (thumbs up or down) from a player
 */
function submitVote(lobby, voterId, drawingOwnerId, voteType, io) {
  const state = lobby.gameState;

  if (state.phase !== 'viewing') {
    return { error: 'Not in viewing phase' };
  }

  // Can't vote for your own drawing
  if (voterId === drawingOwnerId) {
    return { error: 'Cannot vote for your own drawing' };
  }

  if (voteType !== 'up' && voteType !== 'down') {
    return { error: 'Invalid vote type' };
  }

  // Check if voting for the currently displayed drawing
  const currentDrawingOwner = state.viewingOrder[state.currentViewingIndex];
  if (drawingOwnerId !== currentDrawingOwner) {
    return { error: 'Can only vote for the current drawing' };
  }

  // Record the vote
  state.votes[voterId][drawingOwnerId] = voteType;

  // Update scores
  if (voteType === 'up') {
    state.scores[drawingOwnerId].up++;
  } else {
    state.scores[drawingOwnerId].down++;
  }

  return { success: true };
}

/**
 * Finish viewing and calculate results
 */
function finishViewing(lobby, io) {
  const state = lobby.gameState;
  const roomCode = lobby.code;

  state.phase = 'results';

  // Calculate final scores and find loser(s)
  const playerScores = [];

  for (const [playerId, scores] of Object.entries(state.scores)) {
    const player = lobby.players.get(playerId);
    // Skip disconnected players
    if (!player) continue;

    const netScore = scores.up - scores.down;
    playerScores.push({
      playerId,
      username: player.username,
      thumbsUp: scores.up,
      thumbsDown: scores.down,
      netScore,
      drawing: state.drawings[playerId] || null
    });
  }

  // Sort by net score (ascending - lowest first)
  playerScores.sort((a, b) => a.netScore - b.netScore);

  // Find the loser(s) - players with the lowest net score
  const lowestScore = playerScores[0].netScore;
  const losers = playerScores.filter(p => p.netScore === lowestScore);

  state.results = {
    word: state.chosenWord,
    players: playerScores,
    losers: losers.map(l => ({
      playerId: l.playerId,
      username: l.username,
      netScore: l.netScore
    }))
  };

  io.to(roomCode).emit('game:phase', { phase: 'results' });
  io.to(roomCode).emit('game:results', state.results);

  return state.results;
}

/**
 * Handle player actions
 */
function handleAction(lobby, playerId, action, data, io) {
  switch (action) {
    case 'submit-word':
      return submitWord(lobby, playerId, data.word, io);
    case 'submit-drawing':
      return submitDrawing(lobby, playerId, data.drawing, io);
    case 'vote':
      return submitVote(lobby, playerId, data.drawingOwnerId, data.voteType, io);
    default:
      return { error: `Unknown action: ${action}` };
  }
}

/**
 * End the game and clean up timers
 */
function endGame(lobby) {
  const state = lobby.gameState;
  if (state && state.timers) {
    for (const timer of Object.values(state.timers)) {
      clearTimeout(timer);
    }
  }
  lobby.endGame();
}

/**
 * Shuffle array using Fisher-Yates
 */
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

module.exports = {
  GAME_NAME,
  initGame,
  startWordSubmission,
  handleAction,
  endGame
};
