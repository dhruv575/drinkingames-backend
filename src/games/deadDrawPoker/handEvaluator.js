const { getRankValue } = require('../../utils/deck');

/**
 * Hand rankings from lowest to highest
 */
const HAND_RANKS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10
};

const HAND_NAMES = {
  1: 'High Card',
  2: 'Pair',
  3: 'Two Pair',
  4: 'Three of a Kind',
  5: 'Straight',
  6: 'Flush',
  7: 'Full House',
  8: 'Four of a Kind',
  9: 'Straight Flush',
  10: 'Royal Flush'
};

/**
 * Evaluates a 5-card poker hand and returns its rank and value
 */
function evaluateHand(cards) {
  const sortedCards = [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
  const ranks = sortedCards.map(c => getRankValue(c.rank));
  const suits = sortedCards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(ranks);
  const rankCounts = getRankCounts(ranks);
  const countValues = Object.values(rankCounts).sort((a, b) => b - a);

  // Check for straight flush and royal flush
  if (isFlush && isStraight) {
    if (ranks[0] === 14 && ranks[1] === 13) {
      return { rank: HAND_RANKS.ROYAL_FLUSH, values: ranks, name: HAND_NAMES[10] };
    }
    return { rank: HAND_RANKS.STRAIGHT_FLUSH, values: getStraightHighCard(ranks), name: HAND_NAMES[9] };
  }

  // Four of a kind
  if (countValues[0] === 4) {
    const quadRank = findRankWithCount(rankCounts, 4);
    const kicker = findRankWithCount(rankCounts, 1);
    return { rank: HAND_RANKS.FOUR_OF_A_KIND, values: [quadRank, kicker], name: HAND_NAMES[8] };
  }

  // Full house
  if (countValues[0] === 3 && countValues[1] === 2) {
    const tripRank = findRankWithCount(rankCounts, 3);
    const pairRank = findRankWithCount(rankCounts, 2);
    return { rank: HAND_RANKS.FULL_HOUSE, values: [tripRank, pairRank], name: HAND_NAMES[7] };
  }

  // Flush
  if (isFlush) {
    return { rank: HAND_RANKS.FLUSH, values: ranks, name: HAND_NAMES[6] };
  }

  // Straight
  if (isStraight) {
    return { rank: HAND_RANKS.STRAIGHT, values: getStraightHighCard(ranks), name: HAND_NAMES[5] };
  }

  // Three of a kind
  if (countValues[0] === 3) {
    const tripRank = findRankWithCount(rankCounts, 3);
    const kickers = ranks.filter(r => r !== tripRank);
    return { rank: HAND_RANKS.THREE_OF_A_KIND, values: [tripRank, ...kickers], name: HAND_NAMES[4] };
  }

  // Two pair
  if (countValues[0] === 2 && countValues[1] === 2) {
    const pairs = findAllRanksWithCount(rankCounts, 2).sort((a, b) => b - a);
    const kicker = findRankWithCount(rankCounts, 1);
    return { rank: HAND_RANKS.TWO_PAIR, values: [...pairs, kicker], name: HAND_NAMES[3] };
  }

  // One pair
  if (countValues[0] === 2) {
    const pairRank = findRankWithCount(rankCounts, 2);
    const kickers = ranks.filter(r => r !== pairRank);
    return { rank: HAND_RANKS.PAIR, values: [pairRank, ...kickers], name: HAND_NAMES[2] };
  }

  // High card
  return { rank: HAND_RANKS.HIGH_CARD, values: ranks, name: HAND_NAMES[1] };
}

/**
 * Check if the hand is a straight (including A-2-3-4-5 wheel)
 */
function checkStraight(ranks) {
  // Normal straight
  for (let i = 0; i < ranks.length - 1; i++) {
    if (ranks[i] - ranks[i + 1] !== 1) {
      // Check for wheel (A-2-3-4-5)
      if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
        return true;
      }
      return false;
    }
  }
  return true;
}

/**
 * Get the high card for straight comparison (handle wheel)
 */
function getStraightHighCard(ranks) {
  // Wheel (A-2-3-4-5) - the 5 is the high card
  if (ranks[0] === 14 && ranks[1] === 5) {
    return [5];
  }
  return [ranks[0]];
}

function getRankCounts(ranks) {
  const counts = {};
  for (const rank of ranks) {
    counts[rank] = (counts[rank] || 0) + 1;
  }
  return counts;
}

function findRankWithCount(counts, count) {
  for (const [rank, c] of Object.entries(counts)) {
    if (c === count) return parseInt(rank);
  }
  return null;
}

function findAllRanksWithCount(counts, count) {
  const result = [];
  for (const [rank, c] of Object.entries(counts)) {
    if (c === count) result.push(parseInt(rank));
  }
  return result;
}

/**
 * Finds the best 5-card hand from 7 cards (2 hole + 5 community)
 */
function findBestHand(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];
  const combinations = getCombinations(allCards, 5);

  let bestHand = null;
  let bestCards = null;

  for (const combo of combinations) {
    const hand = evaluateHand(combo);
    if (!bestHand || compareHands(hand, bestHand) > 0) {
      bestHand = hand;
      bestCards = combo;
    }
  }

  return { ...bestHand, cards: bestCards };
}

/**
 * Compare two hands. Returns positive if hand1 > hand2, negative if hand1 < hand2, 0 if equal
 */
function compareHands(hand1, hand2) {
  if (hand1.rank !== hand2.rank) {
    return hand1.rank - hand2.rank;
  }

  // Same rank - compare values
  for (let i = 0; i < hand1.values.length; i++) {
    if (hand1.values[i] !== hand2.values[i]) {
      return hand1.values[i] - hand2.values[i];
    }
  }

  return 0;
}

/**
 * Get all combinations of k elements from array
 */
function getCombinations(arr, k) {
  const result = [];

  function combine(start, combo) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }

    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }

  combine(0, []);
  return result;
}

module.exports = {
  HAND_RANKS,
  HAND_NAMES,
  evaluateHand,
  findBestHand,
  compareHands
};
