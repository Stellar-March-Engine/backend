# DME Backend — Decentralized Matchmaking Engine

Off-chain backend service for the Stellar-based Decentralized Matchmaking Engine. Handles player queuing, rating-based pairing, and anchors match results on-chain via Soroban smart contracts. Finality is provided by Stellar Consensus Protocol (SCP).

---

## Architecture

```
Client (Freighter wallet)
        │
        ▼
  REST API (Express)
        │
   ┌────┴────────────────────┐
   │                         │
Queue Manager           Stellar Client
(Redis sorted set)      (Soroban RPC)
   │                         │
Matchmaking Engine      ┌────┴──────────────────┐
(ELO-based pairing)     │                       │
                  Player Registry         Match Contract
                  Ranking Engine          Reputation
                  (Soroban contracts on Testnet)
```

**Key design decision:** All compute-heavy work (sorting, pairing, ELO calculation) runs off-chain. Stellar/SCP is used exclusively for finality — tamper-proof storage of match results and player rankings.

---

## Project Structure

```
backend/
├── src/
│   ├── index.js              # Express app entry point
│   ├── stellar_client/       # Soroban RPC wrapper (all 4 contracts)
│   ├── ranking_service/      # ELO computation + on-chain update flow
│   ├── queue_manager/        # Redis sorted-set player queue
│   ├── matchmaking/          # Greedy rating-proximity pairing algorithm
│   └── routes/               # REST API route handlers
├── tests/                    # Jest unit tests (31 tests, all passing)
├── package.json
└── .gitignore
```

---

## Prerequisites

- Node.js 18+
- Redis (local or remote)
- A funded Stellar testnet keypair (for submitting transactions)
- Deployed Soroban contract IDs (see [Ai.md](./Ai.md) for contract specs)

---

## Setup

```bash
npm install
```

Create a `.env` file:

```env
PORT=3000
REDIS_URL=redis://localhost:6379
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK=Test SDF Network ; September 2015

PLAYER_REGISTRY_ID=C...
MATCH_CONTRACT_ID=C...
RANKING_ENGINE_ID=C...
REPUTATION_ID=C...
```

---

## Running

```bash
npm start
```

Server starts on `http://localhost:3000`.

---

## API Reference

### Player

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/player/register` | Register a new player on-chain (rating=1000, reputation=100) |
| `GET` | `/player/:address` | Get player rating, reputation, and match count |
| `POST` | `/player/queue` | Join the matchmaking queue |
| `DELETE` | `/player/queue/:address` | Leave the matchmaking queue |

### Match

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/match/create` | Create a match between two players on-chain |
| `GET` | `/match/:matchId` | Get match state |
| `POST` | `/match/:matchId/commit` | Player acknowledges match on-chain |
| `POST` | `/match/:matchId/result` | Submit match result (`A`, `B`, or `draw`) |

Full request/response shapes and frontend integration guide: see [AI2.md](./AI2.md).

---

## Matchmaking Algorithm

Players are stored in a Redis sorted set scored by `rating - floor(reputation / 2)`.

On each matchmaking cycle:
1. Fetch all queued players sorted by score
2. Greedily pair adjacent players within a **±200 rating window**
3. Remove matched players from the queue
4. Unpaired players remain queued for the next cycle

---

## ELO Ranking

Uses standard ELO with **K=32**, integer math only (mirrors the on-chain `ranking_engine` contract):

```
expected_A = 1 / (1 + 10^((rating_B - rating_A) / 400))
new_rating_A = rating_A + 32 * (score_A - expected_A)
```

After a match is finalized on-chain, the backend:
1. Reads both players from `player_registry`
2. Computes new ratings
3. Writes back via `update_player`

---

## Contracts (Soroban)

| Contract | Responsibility |
|----------|---------------|
| `player_registry` | Stores rating, reputation, match count per address |
| `match_contract` | Match lifecycle: create → commit → result → finalize/dispute |
| `ranking_engine` | Stateless ELO computation (pure function) |
| `reputation` | Tracks disputes and abandonments, adjusts score |

Contract source and specs: see [Ai.md](./Ai.md).

---

## Tests

```bash
npm test
```

```
Test Suites: 5 passed
Tests:       31 passed
```

Covers: ELO edge cases, queue priority ordering, matchmaking pairing logic, Soroban client (mocked), and all API routes.

---

## SCP Role (Clarification)

SCP is **not** used to compute matchmaking. It provides:
- **Finality** (~2–5s) on match results stored on-chain
- **Tamper-proof** ranking history
- **Global agreement** on player state across all nodes

---

## License

MIT
