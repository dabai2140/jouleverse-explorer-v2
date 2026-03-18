export interface Block {
  number: number;
  hash: string;
  timestamp: number;
  transactionCount: number;
  miner: string;
  size?: number;
  gasUsed?: number;
  gasLimit?: number;
  parentHash?: string;
}

export interface BlockInfo extends Block {
  transactions: string[];
  extraData?: string;
  stateRoot?: string;
  transactionsRoot?: string;
  receiptsRoot?: string;
  logsBloom?: string;
  difficulty?: string;
}
