export interface Transaction {
  hash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  gas: number;
  gasUsed?: number;
  gasPrice?: string;
  nonce: number;
  input: string;
  status?: 'success' | 'pending' | 'failed';
}

export interface TransactionDetail extends Transaction {
  blockHash: string;
  transactionIndex: number;
  logs?: any[];
}
