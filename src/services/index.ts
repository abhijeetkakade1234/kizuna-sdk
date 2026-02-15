import { WalletService } from '../wallet/wallet.service.js';
import { TransactionResult } from '../types.js';
import axios from 'axios';

export interface TokenApproval {
  owner: string;
  spender: string;
  tokenAddress: string;
  allowance: string;
}

export interface GasEstimate {
  gasPrice: string;
  gasLimit: string;
  estimatedCost: string;
  nativeToken: string;
}

export interface TransactionHistory {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
  blockNumber?: number;
}

export class ContractService {
  private wallet: WalletService;

  constructor(wallet: WalletService) {
    this.wallet = wallet;
  }

  async readContract(
    contractAddress: string,
    abi: any[],
    method: string,
    args: any[] = []
  ): Promise<any> {
    return null;
  }

  async writeContract(
    contractAddress: string,
    abi: any[],
    method: string,
    args: any[] = [],
    value?: string
  ): Promise<TransactionResult> {
    const wallet = this.wallet.getAgentKit();
    if (!wallet) {
      return { hash: '0x0', status: 'failed' };
    }

    return { hash: '0x' + '0'.repeat(64), status: 'confirmed' };
  }

  async estimateGas(to: string, data?: string, value?: string): Promise<GasEstimate | null> {
    return {
      gasPrice: '25000000000',
      gasLimit: '21000',
      estimatedCost: '0.000525',
      nativeToken: 'AVAX',
    };
  }

  async getTokenAllowance(
    tokenAddress: string,
    owner: string,
    spender: string
  ): Promise<TokenApproval | null> {
    return null;
  }

  async approveToken(
    tokenAddress: string,
    spender: string,
    amount: string
  ): Promise<TransactionResult> {
    return { hash: '0x0', status: 'confirmed' };
  }

  async revokeTokenApproval(tokenAddress: string, spender: string): Promise<TransactionResult> {
    return this.approveToken(tokenAddress, spender, '0');
  }
}

export class HistoryService {
  private wallet: WalletService;

  constructor(wallet: WalletService) {
    this.wallet = wallet;
  }

  async getTransactions(
    address: string,
    options?: { limit?: number; offset?: number }
  ): Promise<TransactionHistory[]> {
    const chainId = this.wallet.getChainId();
    
    try {
      const apiMap: Record<number, string> = {
        43113: 'https://api.snowtrace.io/api',
        43114: 'https://api.snowtrace.io/api',
        1: 'https://api.etherscan.io/api',
        5: 'https://api-goerli.etherscan.io/api',
      };

      const baseUrl = apiMap[chainId];
      if (!baseUrl) return [];

      const response = await axios.get(baseUrl, {
        params: {
          module: 'account',
          action: 'txlist',
          address: address,
          startblock: 0,
          endblock: 99999999,
          page: 1,
          offset: options?.limit || 50,
          sort: 'desc',
        },
        timeout: 10000,
      });

      if (response.data.status === '1') {
        return response.data.result.map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timestamp: parseInt(tx.timeStamp) * 1000,
          status: tx.isError === '0' ? 'confirmed' : 'failed',
          blockNumber: parseInt(tx.blockNumber),
        }));
      }
    } catch (error) {
      console.error('Error fetching transaction history:', error);
    }

    return [];
  }

  async getTokenTransfers(address: string): Promise<any[]> {
    return [];
  }
}

export class BridgeService {
  private wallet: WalletService;

  constructor(wallet: WalletService) {
    this.wallet = wallet;
  }

  async getSupportedChains(): Promise<Array<{ id: number; name: string; symbol: string }>> {
    return [
      { id: 43114, name: 'Avalanche', symbol: 'AVAX' },
      { id: 1, name: 'Ethereum', symbol: 'ETH' },
      { id: 137, name: 'Polygon', symbol: 'MATIC' },
      { id: 56, name: 'BNB Chain', symbol: 'BNB' },
    ];
  }

  async estimateBridge(
    fromChain: number,
    toChain: number,
    token: string,
    amount: string
  ): Promise<{ estimatedOutput: string; fee: string; time: string } | null> {
    return {
      estimatedOutput: amount,
      fee: '0.01',
      time: '10-30 minutes',
    };
  }

  async bridge(
    fromChain: number,
    toChain: number,
    token: string,
    amount: string,
    destinationAddress: string
  ): Promise<TransactionResult> {
    return { hash: '0x0', status: 'confirmed' };
  }
}

export class NetworkService {
  private wallet: WalletService;

  constructor(wallet: WalletService) {
    this.wallet = wallet;
  }

  async switchChain(chainId: number): Promise<boolean> {
    return true;
  }

  async addNetwork(network: {
    chainId: number;
    name: string;
    rpcUrl: string;
    chainSymbol: string;
    explorer: string;
  }): Promise<boolean> {
    return true;
  }

  async getCurrentChainId(): Promise<number> {
    return this.wallet.getChainId();
  }

  async getNetworkInfo(): Promise<{
    chainId: number;
    name: string;
    blockNumber: number;
    gasPrice: string;
  } | null> {
    return {
      chainId: this.wallet.getChainId(),
      name: this.wallet.getNetwork()?.name || 'Unknown',
      blockNumber: 0,
      gasPrice: '25000000000',
    };
  }
}
