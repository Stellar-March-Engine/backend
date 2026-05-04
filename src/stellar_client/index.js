const { SorobanRpc, Contract, TransactionBuilder, Networks, BASE_FEE, xdr, scValToNative, nativeToScVal } = require('@stellar/stellar-sdk');

const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK || Networks.TESTNET;

const CONTRACT_IDS = {
  player_registry: process.env.PLAYER_REGISTRY_ID || '',
  match_contract: process.env.MATCH_CONTRACT_ID || '',
  ranking_engine: process.env.RANKING_ENGINE_ID || '',
  reputation: process.env.REPUTATION_ID || '',
};

class StellarClient {
  constructor({ rpcUrl = RPC_URL, networkPassphrase = NETWORK_PASSPHRASE, contractIds = CONTRACT_IDS } = {}) {
    this.server = new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
    this.networkPassphrase = networkPassphrase;
    this.contractIds = contractIds;
  }

  async _simulateAndSend(keypair, contractId, method, args) {
    const account = await this.server.getAccount(keypair.publicKey());
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.networkPassphrase })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) throw new Error(simResult.error);

    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
    preparedTx.sign(keypair);

    const sendResult = await this.server.sendTransaction(preparedTx);
    if (sendResult.status === 'ERROR') throw new Error(JSON.stringify(sendResult.errorResult));

    return this._pollTransaction(sendResult.hash);
  }

  async _pollTransaction(hash) {
    for (let i = 0; i < 20; i++) {
      const result = await this.server.getTransaction(hash);
      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return result.returnValue ? scValToNative(result.returnValue) : null;
      }
      if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction failed: ${hash}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Transaction timeout: ${hash}`);
  }

  async _view(contractId, method, args) {
    const contract = new Contract(contractId);
    if (!this.viewAccount) throw new Error('No view account configured — set client.viewAccount');
    const account = await this.server.getAccount(this.viewAccount).catch(() => null);
    if (!account) throw new Error('No view account configured');
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.networkPassphrase })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();
    const simResult = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) throw new Error(simResult.error);
    return simResult.result?.retval ? scValToNative(simResult.result.retval) : null;
  }

  // player_registry
  async registerPlayer(keypair) {
    const addr = nativeToScVal(keypair.publicKey(), { type: 'address' });
    return this._simulateAndSend(keypair, this.contractIds.player_registry, 'register', [addr]);
  }

  async getPlayer(address) {
    const addr = nativeToScVal(address, { type: 'address' });
    return this._view(this.contractIds.player_registry, 'get_player', [addr]);
  }

  async updatePlayer(keypair, address, newRating, newReputation) {
    const args = [
      nativeToScVal(address, { type: 'address' }),
      nativeToScVal(newRating, { type: 'i64' }),
      nativeToScVal(newReputation, { type: 'i64' }),
    ];
    return this._simulateAndSend(keypair, this.contractIds.player_registry, 'update_player', args);
  }

  // match_contract
  async createMatch(keypair, playerA, playerB) {
    const args = [
      nativeToScVal(playerA, { type: 'address' }),
      nativeToScVal(playerB, { type: 'address' }),
    ];
    return this._simulateAndSend(keypair, this.contractIds.match_contract, 'create_match', args);
  }

  async commitMatch(keypair, matchId, player) {
    const args = [
      nativeToScVal(matchId, { type: 'u64' }),
      nativeToScVal(player, { type: 'address' }),
    ];
    return this._simulateAndSend(keypair, this.contractIds.match_contract, 'commit_match', args);
  }

  async submitResult(keypair, matchId, player, result) {
    const args = [
      nativeToScVal(matchId, { type: 'u64' }),
      nativeToScVal(player, { type: 'address' }),
      nativeToScVal(result, { type: 'symbol' }),
    ];
    return this._simulateAndSend(keypair, this.contractIds.match_contract, 'submit_result', args);
  }

  async getMatch(matchId) {
    return this._view(this.contractIds.match_contract, 'get_match', [nativeToScVal(matchId, { type: 'u64' })]);
  }

  // ranking_engine
  async updateElo(keypair, ratingA, ratingB, winner) {
    const args = [
      nativeToScVal(ratingA, { type: 'i64' }),
      nativeToScVal(ratingB, { type: 'i64' }),
      nativeToScVal(winner, { type: 'symbol' }),
    ];
    return this._simulateAndSend(keypair, this.contractIds.ranking_engine, 'update_elo', args);
  }

  // reputation
  async initReputation(keypair, player) {
    return this._simulateAndSend(keypair, this.contractIds.reputation, 'init', [nativeToScVal(player, { type: 'address' })]);
  }

  async recordDispute(keypair, player) {
    return this._simulateAndSend(keypair, this.contractIds.reputation, 'record_dispute', [nativeToScVal(player, { type: 'address' })]);
  }

  async recordAbandonment(keypair, player) {
    return this._simulateAndSend(keypair, this.contractIds.reputation, 'record_abandonment', [nativeToScVal(player, { type: 'address' })]);
  }

  async getReputation(address) {
    return this._view(this.contractIds.reputation, 'get_reputation', [nativeToScVal(address, { type: 'address' })]);
  }

  async getEvents(contractId, topic) {
    const now = Math.floor(Date.now() / 1000);
    return this.server.getEvents({
      startLedger: 0,
      filters: [{ type: 'contract', contractIds: [contractId], topics: [[topic]] }],
    });
  }
}

module.exports = StellarClient;
