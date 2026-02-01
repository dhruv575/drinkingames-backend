const { createDeck, shuffleDeck } = require('../../utils/deck');
const { findBestHand, compareHands } = require('./handEvaluator');

const GAME_NAME = 'dead-draw-poker';

// Timing for dramatic card dealing (in ms)
const DEAL_TIMING = {
  HOLE_CARDS: 500,      // Time between dealing hole cards to players
  FLOP_DELAY: 2000,     // Delay before flop
  FLOP_CARD: 800,       // Time between flop cards
  TURN_DELAY: 2000,     // Delay before turn
  RIVER_DELAY: 2000,    // Delay before river
  REVEAL_DELAY: 3000,   // Delay before revealing results
};

/**
 * Initialize the game state for Dead Draw Poker
 */
function initGame(lobby, io) {
  const playerIds = Array.from(lobby.players.keys());
  const deck = shuffleDeck(createDeck());

  // Deal 2 cards to each player
  const playerHands = {};
  let cardIndex = 0;

  for (const playerId of playerIds) {
    playerHands[playerId] = {
      holeCards: [deck[cardIndex++], deck[cardIndex++]],
      bestHand: null
    };
  }

  // Prepare community cards
  const communityCards = [
    deck[cardIndex++],
    deck[cardIndex++],
    deck[cardIndex++],
    deck[cardIndex++],
    deck[cardIndex++]
  ];

  lobby.gameState = {
    phase: 'dealing',
    playerHands,
    communityCards,
    revealedCommunity: [],
    results: null
  };

  return lobby.gameState;
}

/**
 * Start the dramatic dealing sequence
 */
async function startDealing(lobby, io) {
  const roomCode = lobby.code;
  const state = lobby.gameState;
  const playerIds = Array.from(lobby.players.keys());

  // Phase 1: Deal hole cards to each player
  io.to(roomCode).emit('game:phase', { phase: 'dealing-hole-cards' });

  for (const playerId of playerIds) {
    const player = lobby.players.get(playerId);
    // Send hole cards only to the specific player
    io.to(player.socketId).emit('game:hole-cards', {
      cards: state.playerHands[playerId].holeCards
    });
    await delay(DEAL_TIMING.HOLE_CARDS);
  }

  // Notify everyone that all hole cards are dealt
  io.to(roomCode).emit('game:hole-cards-complete');
  await delay(DEAL_TIMING.FLOP_DELAY);

  // Phase 2: Deal the flop (3 cards)
  io.to(roomCode).emit('game:phase', { phase: 'flop' });
  for (let i = 0; i < 3; i++) {
    state.revealedCommunity.push(state.communityCards[i]);
    io.to(roomCode).emit('game:community-card', {
      card: state.communityCards[i],
      position: i,
      communityCards: [...state.revealedCommunity]
    });
    await delay(DEAL_TIMING.FLOP_CARD);
  }
  await delay(DEAL_TIMING.TURN_DELAY);

  // Phase 3: Deal the turn (4th card)
  io.to(roomCode).emit('game:phase', { phase: 'turn' });
  state.revealedCommunity.push(state.communityCards[3]);
  io.to(roomCode).emit('game:community-card', {
    card: state.communityCards[3],
    position: 3,
    communityCards: [...state.revealedCommunity]
  });
  await delay(DEAL_TIMING.RIVER_DELAY);

  // Phase 4: Deal the river (5th card)
  io.to(roomCode).emit('game:phase', { phase: 'river' });
  state.revealedCommunity.push(state.communityCards[4]);
  io.to(roomCode).emit('game:community-card', {
    card: state.communityCards[4],
    position: 4,
    communityCards: [...state.revealedCommunity]
  });
  await delay(DEAL_TIMING.REVEAL_DELAY);

  // Phase 5: Evaluate all hands and determine loser
  state.phase = 'results';
  const results = evaluateResults(lobby);
  state.results = results;

  io.to(roomCode).emit('game:phase', { phase: 'results' });
  io.to(roomCode).emit('game:results', results);

  return results;
}

/**
 * Evaluate all hands and find the loser(s)
 */
function evaluateResults(lobby) {
  const state = lobby.gameState;
  const playerResults = [];

  for (const [playerId, handData] of Object.entries(state.playerHands)) {
    const player = lobby.players.get(playerId);
    const bestHand = findBestHand(handData.holeCards, state.communityCards);
    handData.bestHand = bestHand;

    playerResults.push({
      playerId,
      username: player.username,
      holeCards: handData.holeCards,
      bestHand: bestHand,
      handName: bestHand.name
    });
  }

  // Sort by hand strength (ascending - worst first)
  playerResults.sort((a, b) => compareHands(a.bestHand, b.bestHand));

  // Find the loser(s) - could be ties for worst hand
  const worstHand = playerResults[0].bestHand;
  const losers = playerResults.filter(p => compareHands(p.bestHand, worstHand) === 0);

  return {
    players: playerResults,
    losers: losers.map(l => ({
      playerId: l.playerId,
      username: l.username,
      handName: l.handName
    })),
    communityCards: state.communityCards
  };
}

/**
 * Handle a player action (not many actions in Dead Draw Poker - it's passive)
 */
function handleAction(lobby, playerId, action, data, io) {
  // Dead Draw Poker has no player actions - it's all automatic
  return { error: 'No actions available in Dead Draw Poker' };
}

/**
 * End the game and clean up
 */
function endGame(lobby) {
  lobby.endGame();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  GAME_NAME,
  initGame,
  startDealing,
  handleAction,
  endGame
};
