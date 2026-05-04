const express = require('express');
const RedisMock = require('ioredis-mock');
const QueueManager = require('../src/queue_manager');
const rankingService = require('../src/ranking_service');
const createRouter = require('../src/routes');

// Minimal supertest-like helper using Node http
const http = require('http');

function request(app) {
  const server = http.createServer(app);
  server.listen(0);
  const port = server.address().port;

  const base = `http://localhost:${port}`;

  const call = (method, path, body) => new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': data ? Buffer.byteLength(data) : 0 },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(raw) });
        server.close();
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });

  return {
    post: (path, body) => call('POST', path, body),
    get: (path) => call('GET', path),
    delete: (path) => call('DELETE', path),
  };
}

function buildApp(mockClient) {
  const app = express();
  app.use(express.json());
  const redis = new RedisMock();
  const queue = new QueueManager(redis);
  app.use('/', createRouter(mockClient, queue, rankingService));
  return { app, queue };
}

describe('API Routes', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      registerPlayer: jest.fn().mockResolvedValue(null),
      getPlayer: jest.fn().mockResolvedValue({ rating: 1000, reputation: 100, matches: 5 }),
      updatePlayer: jest.fn().mockResolvedValue(null),
      createMatch: jest.fn().mockResolvedValue(42),
      commitMatch: jest.fn().mockResolvedValue(null),
      submitResult: jest.fn().mockResolvedValue(null),
      getMatch: jest.fn().mockResolvedValue({ player_a: 'A', player_b: 'B', status: 'Pending' }),
    };
  });

  test('POST /player/register — success', async () => {
    const { app } = buildApp(mockClient);
    const res = await request(app).post('/player/register', { address: 'ADDR_A' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /player/register — missing address returns 400', async () => {
    const { app } = buildApp(mockClient);
    const res = await request(app).post('/player/register', {});
    expect(res.status).toBe(400);
  });

  test('GET /player/:address — returns player data', async () => {
    const { app } = buildApp(mockClient);
    const res = await request(app).get('/player/ADDR_A');
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(1000);
  });

  test('POST /player/queue — enqueues player', async () => {
    const { app, queue } = buildApp(mockClient);
    const res = await request(app).post('/player/queue', { address: 'ADDR_A', rating: 1000, reputation: 90 });
    expect(res.status).toBe(200);
    expect(res.body.queued).toBe(true);
  });

  test('POST /player/queue — missing fields returns 400', async () => {
    const { app } = buildApp(mockClient);
    const res = await request(app).post('/player/queue', { address: 'ADDR_A' });
    expect(res.status).toBe(400);
  });

  test('DELETE /player/queue/:address — dequeues player', async () => {
    const { app } = buildApp(mockClient);
    const res = await request(app).delete('/player/queue/ADDR_A');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /match/:matchId — returns match', async () => {
    const { app } = buildApp(mockClient);
    const res = await request(app).get('/match/42');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Pending');
  });
});
