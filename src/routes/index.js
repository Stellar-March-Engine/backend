const express = require('express');
const { v4: uuidv4 } = require('uuid');

/**
 * @param {import('../stellar_client')} stellarClient
 * @param {import('../queue_manager')} queueManager
 * @param {import('../ranking_service')} rankingService
 */
function createRouter(stellarClient, queueManager, rankingService) {
  const router = express.Router();

  // POST /player/register
  router.post('/player/register', async (req, res) => {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    try {
      await stellarClient.registerPlayer({ publicKey: () => address });
      res.json({ success: true, address });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /player/:address
  router.get('/player/:address', async (req, res) => {
    try {
      const player = await stellarClient.getPlayer(req.params.address);
      res.json(player);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // POST /player/queue — join matchmaking queue
  router.post('/player/queue', async (req, res) => {
    const { address, rating, reputation } = req.body;
    if (!address || rating == null) return res.status(400).json({ error: 'address and rating required' });
    try {
      await queueManager.enqueue(address, rating, reputation);
      res.json({ success: true, queued: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /player/queue/:address — leave queue
  router.delete('/player/queue/:address', async (req, res) => {
    await queueManager.dequeue(req.params.address);
    res.json({ success: true });
  });

  // POST /match/create
  router.post('/match/create', async (req, res) => {
    const { playerA, playerB, keypairSecret } = req.body;
    if (!playerA || !playerB) return res.status(400).json({ error: 'playerA and playerB required' });
    try {
      const { Keypair } = require('@stellar/stellar-sdk');
      const keypair = keypairSecret ? Keypair.fromSecret(keypairSecret) : null;
      const matchId = await stellarClient.createMatch(keypair, playerA, playerB);
      res.json({ matchId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /match/:matchId
  router.get('/match/:matchId', async (req, res) => {
    try {
      const match = await stellarClient.getMatch(Number(req.params.matchId));
      res.json(match);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // POST /match/:matchId/commit
  router.post('/match/:matchId/commit', async (req, res) => {
    const { player, keypairSecret } = req.body;
    if (!player) return res.status(400).json({ error: 'player required' });
    try {
      const { Keypair } = require('@stellar/stellar-sdk');
      const keypair = keypairSecret ? Keypair.fromSecret(keypairSecret) : null;
      await stellarClient.commitMatch(keypair, Number(req.params.matchId), player);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /match/:matchId/result
  router.post('/match/:matchId/result', async (req, res) => {
    const { player, result, keypairSecret } = req.body;
    if (!player || !result) return res.status(400).json({ error: 'player and result required' });
    try {
      const { Keypair } = require('@stellar/stellar-sdk');
      const keypair = keypairSecret ? Keypair.fromSecret(keypairSecret) : null;
      await stellarClient.submitResult(keypair, Number(req.params.matchId), player, result);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createRouter;
