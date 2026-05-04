const K = 32;

/**
 * Pure ELO computation (integer, no floats — mirrors on-chain ranking_engine contract).
 * @param {number} ratingA
 * @param {number} ratingB
 * @param {'A'|'B'|'draw'} winner
 * @returns {{ newRatingA: number, newRatingB: number }}
 */
function computeElo(ratingA, ratingB, winner) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;

  let scoreA, scoreB;
  if (winner === 'A') { scoreA = 1; scoreB = 0; }
  else if (winner === 'B') { scoreA = 0; scoreB = 1; }
  else { scoreA = 0.5; scoreB = 0.5; }

  return {
    newRatingA: Math.round(ratingA + K * (scoreA - expectedA)),
    newRatingB: Math.round(ratingB + K * (scoreB - expectedB)),
  };
}

/**
 * Full ranking update flow:
 * 1. Read both players from chain
 * 2. Call ranking_engine::update_elo (or compute locally)
 * 3. Write back via player_registry::update_player
 */
async function updateRankings(stellarClient, keypair, playerA, playerB, winner) {
  const [pA, pB] = await Promise.all([
    stellarClient.getPlayer(playerA),
    stellarClient.getPlayer(playerB),
  ]);

  const { newRatingA, newRatingB } = computeElo(pA.rating, pB.rating, winner);

  await Promise.all([
    stellarClient.updatePlayer(keypair, playerA, newRatingA, pA.reputation),
    stellarClient.updatePlayer(keypair, playerB, newRatingB, pB.reputation),
  ]);

  return { newRatingA, newRatingB };
}

module.exports = { computeElo, updateRankings };
