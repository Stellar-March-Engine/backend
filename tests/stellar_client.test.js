const StellarClient = require('../src/stellar_client');

// Mock the entire @stellar/stellar-sdk to avoid real network calls
jest.mock('@stellar/stellar-sdk', () => {
  const mockScVal = (val) => ({ _type: 'scVal', val });
  return {
    SorobanRpc: {
      Server: jest.fn().mockImplementation(() => ({
        getAccount: jest.fn().mockResolvedValue({ id: 'MOCK', sequence: '0', incrementSequenceNumber: jest.fn() }),
        simulateTransaction: jest.fn().mockResolvedValue({
          result: { retval: mockScVal({ rating: 1000, reputation: 100, matches: 0 }) },
          minResourceFee: '100',
          transactionData: {},
        }),
        sendTransaction: jest.fn().mockResolvedValue({ status: 'PENDING', hash: 'MOCK_HASH' }),
        getTransaction: jest.fn().mockResolvedValue({
          status: 'SUCCESS',
          returnValue: mockScVal(42),
        }),
        getEvents: jest.fn().mockResolvedValue({ events: [] }),
      })),
      Api: {
        isSimulationError: jest.fn().mockReturnValue(false),
        GetTransactionStatus: { SUCCESS: 'SUCCESS', FAILED: 'FAILED' },
        assembleTransaction: jest.fn(),
      },
      assembleTransaction: jest.fn().mockReturnValue({ build: jest.fn().mockReturnValue({ sign: jest.fn() }) }),
    },
    Contract: jest.fn().mockImplementation(() => ({
      call: jest.fn().mockReturnValue({ type: 'invokeHostFunction' }),
    })),
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ sign: jest.fn() }),
    })),
    Networks: { TESTNET: 'Test SDF Network ; September 2015' },
    BASE_FEE: '100',
    xdr: {},
    scValToNative: jest.fn().mockReturnValue({ rating: 1000, reputation: 100, matches: 0 }),
    nativeToScVal: jest.fn().mockImplementation((val) => ({ _type: 'scVal', val })),
    Keypair: {
      fromSecret: jest.fn().mockReturnValue({ publicKey: () => 'MOCK_PUBLIC', sign: jest.fn() }),
    },
  };
});

describe('StellarClient', () => {
  let client;

  beforeEach(() => {
    client = new StellarClient({
      contractIds: {
        player_registry: 'CONTRACT_A',
        match_contract: 'CONTRACT_B',
        ranking_engine: 'CONTRACT_C',
        reputation: 'CONTRACT_D',
      },
    });
    client.viewAccount = 'MOCK_VIEW_ACCOUNT';
  });

  test('instantiates without throwing', () => {
    expect(client).toBeDefined();
    expect(client.server).toBeDefined();
  });

  test('getPlayer calls simulateTransaction', async () => {
    const result = await client.getPlayer('ADDR_A');
    expect(client.server.simulateTransaction).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  test('getMatch calls simulateTransaction', async () => {
    await client.getMatch(1);
    expect(client.server.simulateTransaction).toHaveBeenCalled();
  });

  test('getEvents calls server.getEvents', async () => {
    const events = await client.getEvents('CONTRACT_B', 'finalized');
    expect(client.server.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({ filters: expect.any(Array) })
    );
    expect(events.events).toEqual([]);
  });
});
