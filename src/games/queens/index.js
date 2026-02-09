const GAME_NAME = 'queens';

const GRID_SIZE = 6;
const TIME_LIMIT = 60000; // 60 seconds

/**
 * Place N queens on an NxN grid such that:
 * - One queen per row
 * - One queen per column
 * - No two queens are king-adjacent (|dr|<=1 && |dc|<=1)
 * Returns array of column indices (index = row), or null if failed.
 */
function placeQueens() {
  const n = GRID_SIZE;
  const cols = new Array(n).fill(-1);

  function isValid(row, col) {
    for (let r = 0; r < row; r++) {
      const c = cols[r];
      // Same column
      if (c === col) return false;
      // King-adjacent
      if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1) return false;
    }
    return true;
  }

  function solve(row) {
    if (row === n) return true;

    // Shuffle columns for randomness
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    for (const col of order) {
      if (isValid(row, col)) {
        cols[row] = col;
        if (solve(row + 1)) return true;
        cols[row] = -1;
      }
    }
    return false;
  }

  return solve(0) ? cols.slice() : null;
}

/**
 * Generate regions via round-robin BFS growth from queen positions.
 * Each region seeds at its queen cell, grows to adjacent unassigned cells.
 * Returns a 6x6 grid of region IDs (0-5).
 */
function generateRegions(queenCols) {
  const n = GRID_SIZE;
  const grid = Array.from({ length: n }, () => new Array(n).fill(-1));

  // Seed each region at its queen position
  const queues = [];
  for (let row = 0; row < n; row++) {
    const col = queenCols[row];
    grid[row][col] = row; // region ID = row index
    queues.push([[row, col]]);
  }

  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  let totalAssigned = n; // n queens already placed

  while (totalAssigned < n * n) {
    let anyGrew = false;

    for (let region = 0; region < n; region++) {
      const queue = queues[region];
      if (queue.length === 0) continue;

      const nextQueue = [];
      for (const [r, c] of queue) {
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc] === -1) {
            grid[nr][nc] = region;
            totalAssigned++;
            nextQueue.push([nr, nc]);
          }
        }
      }
      queues[region] = nextQueue;
      if (nextQueue.length > 0) anyGrew = true;
    }

    if (!anyGrew && totalAssigned < n * n) {
      // Shouldn't happen with valid queen placement, but safety check
      return null;
    }
  }

  return grid;
}

/**
 * Count solutions for the given region grid.
 * Stops early if count exceeds 1 (we only need to know if it's unique).
 */
function countSolutions(grid) {
  const n = GRID_SIZE;
  const cols = new Array(n).fill(-1);
  let count = 0;

  // Build region map: regionId -> set of (row, col) strings
  const regionCells = {};
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const regionId = grid[r][c];
      if (!regionCells[regionId]) regionCells[regionId] = new Set();
      regionCells[regionId].add(`${r},${c}`);
    }
  }

  function isValid(row, col) {
    for (let r = 0; r < row; r++) {
      const c = cols[r];
      if (c === col) return false;
      if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1) return false;
      // Same region
      if (grid[r][c] === grid[row][col]) return false;
    }
    return true;
  }

  function solve(row) {
    if (row === n) {
      count++;
      return;
    }
    if (count > 1) return; // Early exit

    for (let col = 0; col < n; col++) {
      if (isValid(row, col)) {
        cols[row] = col;
        solve(row + 1);
        cols[row] = -1;
        if (count > 1) return;
      }
    }
  }

  solve(0);
  return count;
}

/**
 * Check if region sizes are roughly equal (each region has exactly 6 cells for a 6x6 grid).
 */
function regionsAreEqual(grid) {
  const n = GRID_SIZE;
  const sizes = {};
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const id = grid[r][c];
      sizes[id] = (sizes[id] || 0) + 1;
    }
  }

  const expectedSize = (n * n) / n; // 36/6 = 6
  return Object.values(sizes).every(s => s === expectedSize);
}

/**
 * Generate a valid Queens puzzle with retry loop.
 * Returns { grid, solution } or throws if generation fails.
 */
function generatePuzzle() {
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const queenCols = placeQueens();
    if (!queenCols) continue;

    const grid = generateRegions(queenCols);
    if (!grid) continue;

    if (!regionsAreEqual(grid)) continue;

    const solutions = countSolutions(grid);
    if (solutions === 1) {
      return { grid, solution: queenCols };
    }
  }

  throw new Error('Failed to generate a valid Queens puzzle');
}

/**
 * Validate a player's submitted solution against the grid.
 * queens: array of { row, col } (length 6)
 * Returns true if all constraints are satisfied.
 */
function validateSolution(grid, queens) {
  const n = GRID_SIZE;

  if (!Array.isArray(queens) || queens.length !== n) return false;

  // Check bounds
  for (const q of queens) {
    if (q.row < 0 || q.row >= n || q.col < 0 || q.col >= n) return false;
  }

  // One queen per row
  const rows = new Set(queens.map(q => q.row));
  if (rows.size !== n) return false;

  // One queen per column
  const cols = new Set(queens.map(q => q.col));
  if (cols.size !== n) return false;

  // One queen per region
  const regions = new Set(queens.map(q => grid[q.row][q.col]));
  if (regions.size !== n) return false;

  // No king-adjacency
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dr = Math.abs(queens[i].row - queens[j].row);
      const dc = Math.abs(queens[i].col - queens[j].col);
      if (dr <= 1 && dc <= 1) return false;
    }
  }

  return true;
}

/**
 * Initialize the game state.
 */
function initGame(lobby, io) {
  const { grid, solution } = generatePuzzle();

  lobby.gameState = {
    phase: 'playing',
    grid,
    solution,
    solvedPlayers: {}, // playerId -> { solveTime, username }
    phaseStartTime: null,
    timers: {},
    results: null
  };

  return lobby.gameState;
}

/**
 * Start the game — emit puzzle to all players and start timer.
 */
function startGame(lobby, io) {
  const roomCode = lobby.code;
  const state = lobby.gameState;

  state.phaseStartTime = Date.now();

  io.to(roomCode).emit('game:phase', {
    phase: 'playing',
    grid: state.grid,
    timeLimit: TIME_LIMIT
  });

  // Server timer with 1s buffer for network latency
  state.timers.gameEnd = setTimeout(() => {
    finishGame(lobby, io);
  }, TIME_LIMIT + 1000);
}

/**
 * Handle player actions.
 */
function handleAction(lobby, playerId, action, data, io) {
  switch (action) {
    case 'submit-solution':
      return submitSolution(lobby, playerId, data.queens, io);
    default:
      return { error: `Unknown action: ${action}` };
  }
}

/**
 * Handle a player submitting their solution.
 */
function submitSolution(lobby, playerId, queens, io) {
  const state = lobby.gameState;

  if (state.phase !== 'playing') {
    return { error: 'Game is not in playing phase' };
  }

  if (state.solvedPlayers[playerId]) {
    return { error: 'Already solved', correct: true };
  }

  const correct = validateSolution(state.grid, queens);

  if (!correct) {
    return { correct: false };
  }

  const solveTime = Date.now() - state.phaseStartTime;
  const player = lobby.players.get(playerId);

  state.solvedPlayers[playerId] = {
    solveTime,
    username: player ? player.username : 'Unknown'
  };

  // Notify all players that someone solved it
  io.to(lobby.code).emit('game:player-solved', {
    playerId,
    username: player ? player.username : 'Unknown',
    solveTime
  });

  // Check if all players have solved
  const totalPlayers = lobby.players.size;
  const solvedCount = Object.keys(state.solvedPlayers).length;

  if (solvedCount >= totalPlayers) {
    clearTimeout(state.timers.gameEnd);
    finishGame(lobby, io);
  }

  return { correct: true, solveTime };
}

/**
 * Finish the game and determine losers.
 */
function finishGame(lobby, io) {
  const state = lobby.gameState;
  const roomCode = lobby.code;

  if (state.phase === 'results') return;

  state.phase = 'results';

  const playerScores = [];
  const solvedPlayers = state.solvedPlayers;

  for (const [playerId, player] of lobby.players) {
    const solved = solvedPlayers[playerId];
    playerScores.push({
      playerId,
      username: player.username,
      solved: !!solved,
      solveTime: solved ? solved.solveTime : null
    });
  }

  // Sort: solvers by time ascending, then non-solvers
  playerScores.sort((a, b) => {
    if (a.solved && b.solved) return a.solveTime - b.solveTime;
    if (a.solved) return -1;
    if (b.solved) return 1;
    return 0;
  });

  // Determine losers
  let losers;
  const solvers = playerScores.filter(p => p.solved);
  const nonSolvers = playerScores.filter(p => !p.solved);

  if (solvers.length === 0) {
    // Nobody solved: everyone loses
    losers = playerScores.map(p => ({
      playerId: p.playerId,
      username: p.username,
      reason: 'no-solve'
    }));
  } else if (nonSolvers.length > 0) {
    // Some didn't solve: non-solvers lose
    losers = nonSolvers.map(p => ({
      playerId: p.playerId,
      username: p.username,
      reason: 'no-solve'
    }));
  } else {
    // All solved: slowest loses (could be tie)
    const slowestTime = solvers[solvers.length - 1].solveTime;
    losers = solvers
      .filter(p => p.solveTime === slowestTime)
      .map(p => ({
        playerId: p.playerId,
        username: p.username,
        reason: 'slowest',
        solveTime: p.solveTime
      }));
  }

  state.results = {
    players: playerScores,
    losers,
    solution: state.solution
  };

  io.to(roomCode).emit('game:phase', { phase: 'results' });
  io.to(roomCode).emit('game:results', state.results);

  return state.results;
}

/**
 * End the game and clean up timers.
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
 * Build reconnect state for a player rejoining mid-game.
 */
function getReconnectState(lobby, playerId) {
  const state = lobby.gameState;
  if (!state) return {};

  if (state.phase === 'playing') {
    const elapsed = Date.now() - (state.phaseStartTime || Date.now());
    const remaining = Math.max(0, TIME_LIMIT - elapsed);

    const solvedPlayersList = Object.entries(state.solvedPlayers).map(([id, data]) => ({
      playerId: id,
      username: data.username,
      solveTime: data.solveTime
    }));

    return {
      phase: 'playing',
      grid: state.grid,
      timeLimit: remaining,
      solved: !!state.solvedPlayers[playerId],
      solvedPlayers: solvedPlayersList
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
