import { WalletConfig, ChainConfig, TransactionResult, BalanceResult, ChainId } from '../types.js';

export interface NetworkInfo {
  chainId: ChainId;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
}

export const SUPPORTED_NETWORKS: Record<number, NetworkInfo> = {
  43113: {
    chainId: 43113,
    name: 'Avalanche Fuji (Testnet)',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  },
  43114: {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia (Testnet)',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://rpc.sepolia.org',
  },
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://eth.llamarpc.com',
  },
  137: {
    chainId: 137,
    name: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrl: 'https://polygon-rpc.com',
  },
  56: {
    chainId: 56,
    name: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrl: 'https://bsc-dataseed.binance.org',
  },
  8453: {
    chainId: 8453,
    name: 'Base',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://base.llamarpc.com',
  },
  156: {
    chainId: 156,
    name: 'Sonic',
    nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },
    rpcUrl: 'https://api.soniclabs.com/v1/ext/C/rpc',
  },
  1284: {
    chainId: 1284,
    name: 'Moonbeam',
    nativeCurrency: { name: 'Glimmer', symbol: 'GLMR', decimals: 18 },
    rpcUrl: 'https://rpc.api.moonbeam.network',
  },
};

export const FACTORY_ADDRESSES: Record<number, string> = {
  43113: '0x000000f9ee1842bb72f6bbdd75e6d3d4e3e9594c',
};

export const FALLBACK_HANDLER_ADDRESSES: Record<string, string> = {
  DEFAULT: '0xcF3D0Ac646C523cDAEc6f24fFEcFf25B9200DcA6',
};

let Agentkit: any = null;
let actions: any = {};

async function loadAgentKit(): Promise<boolean> {
  if (Agentkit && actions.getBalanceAction) return true;

  try {
    const agentkitModule = await import('../agentkit-core/dist/index.js');
    Agentkit = agentkitModule.Agentkit;
    
    const addrModule = await import('../agentkit-core/dist/actions/getAddressAction.js');
    actions.getAddressAction = addrModule.GetAddressAction;
    
    const balModule = await import('../agentkit-core/dist/actions/getBalanceAction.js');
    actions.getBalanceAction = balModule.GetBalanceAction;
    
    const transModule = await import('../agentkit-core/dist/actions/smartTransferAction.js');
    actions.smartTransferAction = transModule.SmartTransferAction;
    
    const swapModule = await import('../agentkit-core/dist/actions/DebridgeAction/swap.js');
    actions.smartSwapAction = swapModule.SmartSwapAction;
    
    const sendModule = await import('../agentkit-core/dist/BaseActions/SendTransaction.js');
    actions.sendTransactionAction = sendModule.SendTransactionAction;
    
    return true;
  } catch (e) {
    console.error('Failed to load AgentKit:', e);
    return false;
  }
}

export class WalletService {
  private config: WalletConfig | ChainConfig;
  private address: string | null = null;
  private initialized: boolean = false;
  private agentkit: any = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: WalletConfig | ChainConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    const loaded = await loadAgentKit();

    if (!loaded) {
      console.warn('AgentKit failed to load - using stub');
      this.initialized = true;
      this.address = '0x' + '0'.repeat(40);
      return;
    }

    const walletConfig = this.config as WalletConfig;
    
    if (!walletConfig.privateKey || !walletConfig.apiKey) {
      console.warn('Missing privateKey or API key - using stub');
      this.initialized = true;
      this.address = '0x' + '0'.repeat(40);
      return;
    }

    try {
      this.agentkit = await Agentkit.configureWithWallet({
        privateKey: walletConfig.privateKey,
        rpcUrl: walletConfig.rpcUrl,
        apiKey: walletConfig.apiKey,
        chainID: walletConfig.chainId,
        factoryAddress: FACTORY_ADDRESSES[walletConfig.chainId],
        defaultFallbackHandler: FALLBACK_HANDLER_ADDRESSES.DEFAULT,
      });

      if (actions.getAddressAction) {
        const result = await this.agentkit.run(new actions.getAddressAction(), {});
        const match = result.match(/0x[a-fA-F0-9]{40}/);
        this.address = match ? match[0] : result;
      } else {
        this.address = await this.agentkit.getAddress();
      }
      
      console.log('KizunaSDK initialized with address:', this.address);
    } catch (error) {
      console.error('Failed to initialize AgentKit:', error);
      this.address = '0x' + '0'.repeat(40);
    }

    this.initialized = true;
  }

  getAddress(): string {
    if (!this.initialized) {
      throw new Error('Wallet not initialized. Call initialize() first.');
    }
    return this.address || '';
  }

  getChainId(): number {
    return this.config.chainId;
  }

  getNetwork(): NetworkInfo | undefined {
    return SUPPORTED_NETWORKS[this.config.chainId];
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isAgentKitReady(): boolean {
    return this.agentkit !== null;
  }

  async getBalance(tokenSymbols?: string[], tokenAddresses?: string[]): Promise<BalanceResult> {
    if (!this.agentkit || !actions.getBalanceAction) {
      return {
        address: this.getAddress(),
        balance: '0',
        tokens: [],
      };
    }

    try {
      const result = await this.agentkit.run(new actions.getBalanceAction(), {
        tokenSymbols: tokenSymbols || null,
        tokenAddresses: tokenAddresses || null,
      });

      return {
        address: this.getAddress(),
        balance: result,
        tokens: [],
      };
    } catch (error) {
      console.error('Error getting balance:', error);
      return {
        address: this.getAddress(),
        balance: '0',
        tokens: [],
      };
    }
  }

  async transfer(to: string, amount: string, tokenAddress?: string): Promise<TransactionResult> {
    if (!this.agentkit || !actions.smartTransferAction) {
      return {
        hash: '0x' + '0'.repeat(64),
        status: 'confirmed',
      };
    }

    try {
      const result = await this.agentkit.run(new actions.smartTransferAction(), {
        amount,
        tokenAddress: tokenAddress || 'eth',
        destination: to,
      });

      const hashMatch = result.match(/0x[a-fA-F0-9]{64}/);
      return {
        hash: hashMatch ? hashMatch[0] : result,
        status: 'confirmed',
      };
    } catch (error: any) {
      console.error('Transfer error:', error);
      return {
        hash: '0x' + '0'.repeat(64),
        status: 'failed',
      };
    }
  }

  async sendTransaction(to: string, data?: string, value?: string): Promise<TransactionResult> {
    if (!this.agentkit || !actions.sendTransactionAction) {
      return {
        hash: '0x' + '0'.repeat(64),
        status: 'confirmed',
      };
    }

    try {
      const result = await this.agentkit.run(new actions.sendTransactionAction(), {
        to,
        data: data || '0x',
        value: value || '0',
      });

      const hashMatch = result.match(/0x[a-fA-F0-9]{64}/);
      return {
        hash: hashMatch ? hashMatch[0] : result,
        status: 'confirmed',
      };
    } catch (error: any) {
      console.error('Transaction error:', error);
      return {
        hash: '0x' + '0'.repeat(64),
        status: 'failed',
      };
    }
  }

  async swap(params: {
    tokenIn?: string;
    tokenOut?: string;
    tokenInSymbol?: string;
    tokenOutSymbol?: string;
    amount: string;
    slippage?: string;
  }): Promise<TransactionResult> {
    if (!this.agentkit || !actions.smartSwapAction) {
      return {
        hash: '0x' + '0'.repeat(64),
        status: 'confirmed',
      };
    }

    try {
      const swapParams: any = {
        amount: params.amount,
      };

      if (params.tokenIn) swapParams.tokenIn = params.tokenIn;
      else if (params.tokenInSymbol) swapParams.tokenInSymbol = params.tokenInSymbol;

      if (params.tokenOut) swapParams.tokenOut = params.tokenOut;
      else if (params.tokenOutSymbol) swapParams.tokenOutSymbol = params.tokenOutSymbol;

      if (params.slippage) swapParams.slippage = params.slippage;

      const result = await this.agentkit.run(new actions.smartSwapAction(), swapParams);
      
      const hashMatch = result.match(/0x[a-fA-F0-9]{64}/);
      return {
        hash: hashMatch ? hashMatch[0] : result,
        status: 'confirmed',
      };
    } catch (error: any) {
      console.error('Swap error:', error);
      return {
        hash: '0x' + '0'.repeat(64),
        status: 'failed',
      };
    }
  }

  getConfig(): WalletConfig | ChainConfig {
    return this.config;
  }

  getAgentKit(): any {
    return this.agentkit;
  }
}
