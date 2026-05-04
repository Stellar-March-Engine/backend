const RedisMock = require('ioredis-mock');
const QueueManager = require('../src/queue_manager');

let redis, queue;

beforeEach(async () => {
  redis = new RedisMock();
  queue = new QueueManager(redis);
  await queue.clear();
});

describe('QueueManager', () => {
  test('enqueue adds player', async () => {
    await queue.enqueue('ADDR_A', 1000, 100);
    expect(await queue.size()).toBe(1);
  });

  test('isQueued returns true after enqueue', async () => {
    await queue.enqueue('ADDR_A', 1000);
    expect(await queue.isQueued('ADDR_A')).toBe(true);
  });

  test('isQueued returns false for unknown player', async () => {
    expect(await queue.isQueued('UNKNOWN')).toBe(false);
  });

  test('dequeue removes player', async () => {
    await queue.enqueue('ADDR_A', 1000);
    await queue.dequeue('ADDR_A');
    expect(await queue.size()).toBe(0);
  });

  test('getAll returns players sorted by score', async () => {
    await queue.enqueue('LOW', 800, 100);
    await queue.enqueue('HIGH', 1200, 100);
    await queue.enqueue('MID', 1000, 100);

    const all = await queue.getAll();
    expect(all.map(p => p.address)).toEqual(['LOW', 'MID', 'HIGH']);
  });

  test('reputation adjusts priority score', async () => {
    // Same rating, higher reputation → lower score → higher priority
    await queue.enqueue('GOOD', 1000, 100);
    await queue.enqueue('BAD', 1000, 0);

    const all = await queue.getAll();
    const good = all.find(p => p.address === 'GOOD');
    const bad = all.find(p => p.address === 'BAD');
    expect(good.score).toBeLessThan(bad.score);
  });

  test('clear empties queue', async () => {
    await queue.enqueue('A', 1000);
    await queue.enqueue('B', 1100);
    await queue.clear();
    expect(await queue.size()).toBe(0);
  });
});
