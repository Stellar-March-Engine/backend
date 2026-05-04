const express = require('express');
const Redis = require('ioredis');
const StellarClient = require('./stellar_client');
const QueueManager = require('./queue_manager');
const rankingService = require('./ranking_service');
const createRouter = require('./routes');

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const stellarClient = new StellarClient();
const queueManager = new QueueManager(redis);

app.use('/', createRouter(stellarClient, queueManager, rankingService));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`DME backend running on port ${PORT}`));
}

module.exports = { app, stellarClient, queueManager };
