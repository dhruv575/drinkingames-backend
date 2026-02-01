const deadDrawPoker = require('./deadDrawPoker');
const drawingGame = require('./drawingGame');

const games = {
  [deadDrawPoker.GAME_NAME]: deadDrawPoker,
  [drawingGame.GAME_NAME]: drawingGame
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
