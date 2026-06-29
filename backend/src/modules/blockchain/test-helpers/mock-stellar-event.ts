import { rpc } from '@stellar/stellar-sdk';

export const mockEvent = (
  overrides: Partial<rpc.Api.EventResponse> = {},
): rpc.Api.EventResponse => {
  const base = {
    id: 'event-1',
    ledger: 100,
    contractId: 'contract-1',
    txHash: 'tx-1',
    inSuccessfulContractCall: true,
    ledgerClosedAt: '2020-01-01T00:00:00Z',
    type: 'contract',
    topic: [],
    value: { toXDR: () => 'AAAA' },
  } as unknown as rpc.Api.EventResponse;

  return { ...base, ...overrides } as rpc.Api.EventResponse;
};
