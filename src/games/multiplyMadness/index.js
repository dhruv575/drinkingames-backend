const GAME_NAME = 'multiply-madness';

const TIMING = {
  GAME_DURATION: 15000,  // 15 seconds
  PENALTY_TIME: 3000,    // 3 second penalty for wrong answers
};

const QUESTION_COUNT = 15;

/**
 * Generate valid multiplication problems (1-digit x 1-digit with 2-digit answer)
 */
function generateQuestions() {
  const validPairs = [];

  // Find all pairs where product >= 10
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      if (a * b >= 10) {
        validPairs.push([a, b]);
      }
    }
  }

  // Generate questions by randomly picking from valid pairs
  const questions = [];
  for (let i = 0; i < QUESTION_COUNT; i++) {
    const pair = validPairs[Math.floor(Math.random() * validPairs.length)];
    questions.push({
      id: i,
      a: pair[0],
      b: pair[1],
      answer: pair[0] * pair[1]
    });
  }

  return questions;
}

/**
 * Initialize the game state
 */
function initGame(lobby, io) {
  const playerIds = Array.from(lobby.players.keys());
  const questions = generateQuestions();

  lobby.gameState = {
    phase: 'playing',
    questions: questions,
    scores: {},          // playerId -> { correct: number, wrong: number }
    submissions: {},     // playerId -> boolean (has submitted final score)
    results: null,
    timers: {}
  };

  // Initialize scores for all players
  for (const playerId of playerIds) {
    lobby.gameState.scores[playerId] = { correct: 0, wrong: 0 };
    lobby.gameState.submissions[playerId] = false;
  }

  return lobby.gameState;
}

/**
 * Start the game
 */
function startGame(lobby, io) {
  const roomCode = lobby.code;
  const state = lobby.gameState;

  state.phaseStartTime = Date.now();

  io.to(roomCode).emit('game:phase', {
    phase: 'playing',
    questions: state.questions,
    timeLimit: TIMING.GAME_DURATION,
    penaltyTime: TIMING.PENALTY_TIME
  });

  // Set timer for game end
  state.timers.gameEnd = setTimeout(() => {
    finishGame(lobby, io);
  }, TIMING.GAME_DURATION + 1000); // Extra second for network latency
}

/**
 * Handle score submission from a player
 */
function submitScore(lobby, playerId, correct, wrong, io) {
  const state = lobby.gameState;

  if (state.phase !== 'playing') {
    return { error: 'Game is not in playing phase' };
  }

  state.scores[playerId] = { correct, wrong };
  state.submissions[playerId] = true;

  // Check if all players have submitted
  const allSubmitted = Object.values(state.submissions).every(s => s);
  if (allSubmitted) {
    clearTimeout(state.timers.gameEnd);
    finishGame(lobby, io);
  }

  return { success: true };
}

/**
 * Finish the game and calculate results
 */
function finishGame(lobby, io) {
  const state = lobby.gameState;
  const roomCode = lobby.code;

  if (state.phase === 'results') return; // Already finished

  state.phase = 'results';

  // Calculate results
  const playerScores = [];

  for (const [playerId, scores] of Object.entries(state.scores)) {
    const player = lobby.players.get(playerId);
    if (!player) continue; // Skip disconnected players

    playerScores.push({
      playerId,
      username: player.username,
      correct: scores.correct,
      wrong: scores.wrong
    });
  }

  // Sort by correct answers (ascending - lowest first for loser)
  playerScores.sort((a, b) => a.correct - b.correct);

  // Find loser(s) - player(s) with fewest correct answers
  const lowestScore = playerScores[0]?.correct ?? 0;
  const losers = playerScores.filter(p => p.correct === lowestScore);

  state.results = {
    players: playerScores,
    losers: losers.map(l => ({
      playerId: l.playerId,
      username: l.username,
      correct: l.correct
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
    case 'submit-score':
      return submitScore(lobby, playerId, data.correct, data.wrong, io);
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
 * Build reconnect state for a player rejoining mid-game
 */
function getReconnectState(lobby, playerId) {
  const state = lobby.gameState;
  if (!state) return {};

  if (state.phase === 'playing') {
    const elapsed = Date.now() - (state.phaseStartTime || Date.now());
    const remaining = Math.max(0, TIMING.GAME_DURATION - elapsed);
    return {
      phase: 'playing',
      questions: state.questions,
      timeLimit: remaining,
      penaltyTime: TIMING.PENALTY_TIME
    };
  }

  if (state.phase === 'results') {
    return { phase: 'results', results: state.results };
  }

  return { phase: state.phase };
}

module.exports = {
  GAME_NAME,
  initGame,
  startGame,
  handleAction,
  endGame,
  getReconnectState
};
