const RedisMock = require('ioredis-mock');
const QueueManager = require('../src/queue_manager');
const { runMatchmaking, RATING_WINDOW } = require('../src/matchmaking');

let redis, queue;

beforeEach(async () => {
  redis = new RedisMock();
  queue = new QueueManager(redis);
  await queue.clear();
});

describe('runMatchmaking', () => {
  test('returns empty array when fewer than 2 players', async () => {
    await queue.enqueue('SOLO', 1000);
    const pairs = await runMatchmaking(queue);
    expect(pairs).toEqual([]);
  });

  test('pairs two players with close ratings', async () => {
    await queue.enqueue('A', 1000);
    await queue.enqueue('B', 1050);

    const pairs = await runMatchmaking(queue);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ playerA: 'A', playerB: 'B' });
  });

  test('removes matched players from queue', async () => {
    await queue.enqueue('A', 1000);
    await queue.enqueue('B', 1050);

    await runMatchmaking(queue);
    expect(await queue.size()).toBe(0);
  });

  test('does not pair players outside rating window', async () => {
    await queue.enqueue('LOW', 800);
    await queue.enqueue('HIGH', 800 + RATING_WINDOW + 1);

    const pairs = await runMatchmaking(queue);
    expect(pairs).toHaveLength(0);
    // Both still in queue
    expect(await queue.size()).toBe(2);
  });

  test('pairs closest players when 4 in queue', async () => {
    await queue.enqueue('A', 1000);
    await queue.enqueue('B', 1010);
    await queue.enqueue('C', 1500);
    await queue.enqueue('D', 1510);

    const pairs = await runMatchmaking(queue);
    expect(pairs).toHaveLength(2);
    const addresses = pairs.flatMap(p => [p.playerA, p.playerB]);
    expect(addresses).toContain('A');
    expect(addresses).toContain('B');
    expect(addresses).toContain('C');
    expect(addresses).toContain('D');
  });

  test('leaves unmatched player in queue', async () => {
    await queue.enqueue('A', 1000);
    await queue.enqueue('B', 1010);
    await queue.enqueue('LONE', 1800); // too far from anyone

    const pairs = await runMatchmaking(queue);
    expect(pairs).toHaveLength(1);
    expect(await queue.isQueued('LONE')).toBe(true);
  });
});
