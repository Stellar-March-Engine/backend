const QUEUE_KEY = 'dme:queue';

/**
 * Redis-backed player queue.
 * Uses a sorted set: score = priority (lower rating diff from median = higher priority).
 * Score stored = rating (used for proximity matching). Wait time handled via timestamp offset.
 */
class QueueManager {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Add player to queue.
   * Score = rating (for proximity sorting). Reputation adjusts priority slightly.
   * @param {string} address
   * @param {number} rating
   * @param {number} reputation  0–100
   */
  async enqueue(address, rating, reputation = 100) {
    // Priority score: lower = higher priority. We use rating as base.
    // Reputation bonus: up to -50 points (better reputation = slightly higher priority)
    const score = rating - Math.floor(reputation / 2);
    await this.redis.zadd(QUEUE_KEY, score, address);
  }

  async dequeue(address) {
    await this.redis.zrem(QUEUE_KEY, address);
  }

  async size() {
    return this.redis.zcard(QUEUE_KEY);
  }

  /**
   * Get all queued players sorted by score (rating proximity).
   * @returns {Array<{address: string, score: number}>}
   */
  async getAll() {
    const raw = await this.redis.zrange(QUEUE_KEY, 0, -1, 'WITHSCORES');
    const result = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({ address: raw[i], score: Number(raw[i + 1]) });
    }
    return result;
  }

  async isQueued(address) {
    const score = await this.redis.zscore(QUEUE_KEY, address);
    return score !== null;
  }

  async clear() {
    await this.redis.del(QUEUE_KEY);
  }
}

module.exports = QueueManager;
