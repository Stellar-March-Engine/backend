const RATING_WINDOW = 200; // max rating diff for a fair match

/**
 * Pairs players from the queue by rating proximity.
 * Algorithm:
 *   1. Get all queued players sorted by score (rating-based)
 *   2. Greedily pair adjacent players within RATING_WINDOW
 *   3. Return list of pairs; unpaired players stay in queue
 *
 * @param {import('../queue_manager')} queueManager
 * @returns {Promise<Array<{playerA: string, playerB: string}>>}
 */
async function runMatchmaking(queueManager) {
  const players = await queueManager.getAll();
  if (players.length < 2) return [];

  const pairs = [];
  const matched = new Set();

  for (let i = 0; i < players.length - 1; i++) {
    if (matched.has(players[i].address)) continue;
    for (let j = i + 1; j < players.length; j++) {
      if (matched.has(players[j].address)) continue;
      if (Math.abs(players[i].score - players[j].score) <= RATING_WINDOW) {
        pairs.push({ playerA: players[i].address, playerB: players[j].address });
        matched.add(players[i].address);
        matched.add(players[j].address);
        break;
      }
    }
  }

  // Remove matched players from queue
  await Promise.all([...matched].map(addr => queueManager.dequeue(addr)));

  return pairs;
}

module.exports = { runMatchmaking, RATING_WINDOW };
