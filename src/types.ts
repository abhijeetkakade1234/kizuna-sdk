export type ChainId = number;

export interface ChainConfig {
  chainId: ChainId;
  name: string;
  rpcUrl: string;
  apiKey?: string;
}

export interface WalletConfig {
  privateKey: `0x${string}`;
  rpcUrl: string;
  apiKey?: string;
  chainId: ChainId;
}

export interface TransferParams {
  to: string;
  amount: string;
  tokenAddress?: string;
}

export interface SwapParams {
  tokenIn?: string;
  tokenOut?: string;
  tokenInSymbol?: string;
  tokenOutSymbol?: string;
  amount: string;
  slippage?: string;
}

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
}

export interface BalanceResult {
  address: string;
  balance: string;
  tokens?: TokenBalance[];
}

export interface TokenBalance {
  symbol: string;
  address: string;
  balance: string;
  decimals: number;
}

export interface NFTCollection {
  address: string;
  name: string;
  symbol?: string;
}

export interface NFTAsset {
  tokenId: string;
  contractAddress: string;
  name?: string;
  imageUrl?: string;
  attributes?: Record<string, any>;
}

export interface PriceAlert {
  id: string;
  collectionAddress: string;
  targetPrice: string;
  condition: 'above' | 'below';
  active: boolean;
  createdAt: number;
}

export interface AITradingParams {
  collectionAddress: string;
  maxBudget: string;
  strategy?: 'aggressive' | 'conservative' | 'balanced';
}

export interface AIAnalysisResult {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  suggestedPrice?: string;
}
