const GAME_NAME = 'queens';

const GRID_SIZE = 6;
const TIME_LIMIT = 60000; // 60 seconds

/**
 * Generate random contiguous regions by building a random spanning tree
 * of the grid graph, then removing (n-1) edges to create n components.
 * Returns a 6x6 grid of region IDs (0 to n-1).
 */
function generateRandomRegions() {
  const n = GRID_SIZE;

  // Build all grid edges
  const edges = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (c + 1 < n) edges.push([r * n + c, r * n + c + 1]);
      if (r + 1 < n) edges.push([r * n + c, (r + 1) * n + c]);
    }
  }

  // Shuffle edges for random spanning tree
  for (let i = edges.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [edges[i], edges[j]] = [edges[j], edges[i]];
  }

  // Union-Find
  const parent = Array.from({ length: n * n }, (_, i) => i);
  const rnk = new Array(n * n).fill(0);

  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }

  function unite(x, y) {
    const px = find(x), py = find(y);
    if (px === py) return false;
    if (rnk[px] < rnk[py]) parent[px] = py;
    else if (rnk[px] > rnk[py]) parent[py] = px;
    else { parent[py] = px; rnk[px]++; }
    return true;
  }

  // Kruskal's: build random spanning tree
  const treeEdges = [];
  for (const [a, b] of edges) {
    if (unite(a, b)) {
      treeEdges.push([a, b]);
      if (treeEdges.length === n * n - 1) break;
    }
  }

  // Shuffle tree edges, remove first (n-1) to create n components
  for (let i = treeEdges.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [treeEdges[i], treeEdges[j]] = [treeEdges[j], treeEdges[i]];
  }

  const keptEdges = treeEdges.slice(n - 1); // remove first n-1

  // Reset union-find and rebuild with kept edges
  for (let i = 0; i < n * n; i++) { parent[i] = i; rnk[i] = 0; }
  for (const [a, b] of keptEdges) {
    unite(a, b);
  }

  // Assign region IDs
  const grid = Array.from({ length: n }, () => new Array(n).fill(-1));
  const rootToRegion = {};
  let nextRegion = 0;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const root = find(r * n + c);
      if (!(root in rootToRegion)) {
        rootToRegion[root] = nextRegion++;
      }
      grid[r][c] = rootToRegion[root];
    }
  }

  // Verify we got exactly n regions
  if (nextRegion !== n) return null;

  return grid;
}

/**
 * Find all valid queen placements for a given region grid.
 * Returns the unique solution as column array, or null if not unique.
 * Constraints: one queen per row, column, region, no king-adjacency.
 */
function findUniqueSolution(grid) {
  const n = GRID_SIZE;
  const cols = new Array(n).fill(-1);
  const usedCols = new Set();
  const usedRegions = new Set();
  const solutions = [];

  function isKingAdjacent(row, col) {
    if (row > 0) {
      const prevCol = cols[row - 1];
      if (Math.abs(prevCol - col) <= 1) return true;
    }
    return false;
  }

  function solve(row) {
    if (row === n) {
      solutions.push(cols.slice());
      return;
    }
    if (solutions.length > 1) return;

    for (let col = 0; col < n; col++) {
      if (usedCols.has(col)) continue;
      const region = grid[row][col];
      if (usedRegions.has(region)) continue;
      if (isKingAdjacent(row, col)) continue;

      cols[row] = col;
      usedCols.add(col);
      usedRegions.add(region);
      solve(row + 1);
      cols[row] = -1;
      usedCols.delete(col);
      usedRegions.delete(region);

      if (solutions.length > 1) return;
    }
  }

  solve(0);

  if (solutions.length === 1) return solutions[0];
  return null;
}

/**
 * Generate a valid Queens puzzle with retry loop.
 * Strategy: generate random contiguous regions, then check for unique solution.
 * Returns { grid, solution } or throws if generation fails.
 */
function generatePuzzle() {
  const maxAttempts = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid = generateRandomRegions();
    if (!grid) continue;

    const solution = findUniqueSolution(grid);
    if (solution) {
      return { grid, solution };
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
