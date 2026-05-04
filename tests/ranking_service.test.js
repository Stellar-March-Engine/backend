const { computeElo, updateRankings } = require('../src/ranking_service');

describe('computeElo', () => {
  test('winner A gains rating, B loses', () => {
    const { newRatingA, newRatingB } = computeElo(1000, 1000, 'A');
    expect(newRatingA).toBe(1016);
    expect(newRatingB).toBe(984);
    expect(newRatingA + newRatingB).toBe(2000); // zero-sum
  });

  test('winner B gains rating, A loses', () => {
    const { newRatingA, newRatingB } = computeElo(1000, 1000, 'B');
    expect(newRatingA).toBe(984);
    expect(newRatingB).toBe(1016);
  });

  test('draw keeps ratings near equal', () => {
    const { newRatingA, newRatingB } = computeElo(1000, 1000, 'draw');
    expect(newRatingA).toBe(1000);
    expect(newRatingB).toBe(1000);
  });

  test('higher-rated player losing drops more', () => {
    const { newRatingA, newRatingB } = computeElo(1200, 800, 'B');
    expect(newRatingA).toBeLessThan(1200);
    expect(newRatingB).toBeGreaterThan(800);
    // upset: B gains more than K/2
    expect(newRatingB - 800).toBeGreaterThan(16);
  });

  test('higher-rated player winning gains less', () => {
    const { newRatingA, newRatingB } = computeElo(1200, 800, 'A');
    expect(newRatingA - 1200).toBeLessThan(16);
  });

  test('zero-sum property holds for unequal ratings', () => {
    const { newRatingA, newRatingB } = computeElo(1500, 1000, 'A');
    expect(newRatingA + newRatingB).toBe(2500);
  });
});

describe('updateRankings', () => {
  test('calls getPlayer, updatePlayer for both players', async () => {
    const mockClient = {
      getPlayer: jest.fn()
        .mockResolvedValueOnce({ rating: 1000, reputation: 100 })
        .mockResolvedValueOnce({ rating: 1000, reputation: 90 }),
      updatePlayer: jest.fn().mockResolvedValue(null),
    };

    const result = await updateRankings(mockClient, {}, 'ADDR_A', 'ADDR_B', 'A');

    expect(mockClient.getPlayer).toHaveBeenCalledTimes(2);
    expect(mockClient.updatePlayer).toHaveBeenCalledTimes(2);
    expect(result.newRatingA).toBe(1016);
    expect(result.newRatingB).toBe(984);
  });
});
