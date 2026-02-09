const deadDrawPoker = require('./deadDrawPoker');
const drawingGame = require('./drawingGame');
const multiplyMadness = require('./multiplyMadness');
const queens = require('./queens');

const games = {
  [deadDrawPoker.GAME_NAME]: deadDrawPoker,
  [drawingGame.GAME_NAME]: drawingGame,
  [multiplyMadness.GAME_NAME]: multiplyMadness,
  [queens.GAME_NAME]: queens
};

/**
 * Get list of available games
 */
function getAvailableGames() {
  return [
    {
      id: 'dead-draw-poker',
      name: 'Dead Draw Poker',
      description: 'Everyone gets 2 cards, 5 community cards are dealt. Worst poker hand loses!',
      minPlayers: 2,
      maxPlayers: 8
    },
    {
      id: 'drawing-game',
      name: 'Drawing Game',
      description: 'Submit a word, draw the chosen word, vote on drawings. Lowest rated drawing loses!',
      minPlayers: 2,
      maxPlayers: 8
    },
    {
      id: 'multiply-madness',
      name: 'Multiply Madness',
      description: '15 seconds of multiplication! Answer fast, wrong answers cost 3 seconds. Fewest correct loses!',
      minPlayers: 2,
      maxPlayers: 8
    },
    {
      id: 'queens',
      name: 'Queens',
      description: 'Race to place 6 queens on a 6x6 grid! One per row, column, and region with no adjacent queens. Slowest solver loses!',
      minPlayers: 2,
      maxPlayers: 8
    }
  ];
}

/**
 * Get a game module by its ID
 */
function getGame(gameId) {
  return games[gameId] || null;
}

module.exports = {
  getAvailableGames,
  getGame
};
