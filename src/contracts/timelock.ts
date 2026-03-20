export const timelockABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "MONTHLY_BUDGET",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "MONTHLY_BLOCKS",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "used",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "released",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "available",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const TIMELOCK_CORE_ADDRESS = '0x628beb88dD440A8c5e4cC89Ab33a041f521e4323' as const;
export const TIMELOCK_ECO_ADDRESS = '0xbb6b53Fadf85B73258cb6A54F1343Ac4D5F99773' as const;

export interface TimelockData {
  monthlyBudget: bigint;
  monthlyBlocks: bigint;
  used: bigint;
  released: bigint;
  available: bigint;
}
