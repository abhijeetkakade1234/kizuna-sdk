import { WalletConfig, ChainConfig } from './types.js';
import { WalletService, SUPPORTED_NETWORKS } from './wallet/index.js';
import { MultiWalletService } from './wallet/multiwallet.service.js';
import { TokenService } from './tokens/index.js';
import { NFTSevice } from './tokens/index.js';
import { AgentService } from './agent/index.js';
import { AlertService } from './alerts/index.js';
import { TransactionMonitor, WalletMonitor } from './wallet/monitor.js';
import { ContractService, HistoryService, BridgeService, NetworkService } from './services/index.js';
import { OpenSeaService, BlurService, TensorService, MarketplaceAggregator } from './tokens/marketplace.service.js';
import { AutoBuyService, PortfolioService, CollectionAnalyticsService } from './trading/index.js';
import { TradeHistoryService } from './utils/tradeHistory.service.js';
import { WebhookService } from './utils/webhook.service.js';
import { RateLimiter, createRateLimiter, UserRateLimiterManager, createUserRateLimiterManager, UserRateLimitConfig } from './utils/rateLimiter.js';
import { Cache } from './utils/cache.js';
import { withRetry, KizunaError, ErrorCodes, isRetryable } from './utils/errors.js';

export class KizunaClient {
  private wallet: WalletService;
  private tokens: TokenService;
  private nft: NFTSevice;
  private agent: AgentService;
  private alerts: AlertService;
  private contract: ContractService;
  private history: HistoryService;
  private bridge: BridgeService;
  private network: NetworkService;
  private marketplace: MarketplaceAggregator;
  private autoBuy: AutoBuyService;
  private portfolio: PortfolioService;
  private analytics: CollectionAnalyticsService;
  private tradeHistory: TradeHistoryService;
  private webhook: WebhookService;
  private multiWallet: MultiWalletService;
  private rateLimiterManager: UserRateLimiterManager;
  private transactionMonitor: TransactionMonitor | null = null;
  private walletMonitor: WalletMonitor | null = null;

  constructor(
    config: WalletConfig | ChainConfig,
    options?: {
      rateLimitConfig?: UserRateLimitConfig;
      marketplaceApiKeys?: {
        openSea?: string;
        blur?: string;
        tensor?: string;
      };
    }
  ) {
    this.wallet = new WalletService(config);
    this.tokens = new TokenService(this.wallet);
    this.nft = new NFTSevice(this.wallet);
    this.agent = new AgentService(this.wallet);
    this.alerts = new AlertService();
    this.contract = new ContractService(this.wallet);
    this.history = new HistoryService(this.wallet);
    this.bridge = new BridgeService(this.wallet);
    this.network = new NetworkService(this.wallet);
    
    this.rateLimiterManager = createUserRateLimiterManager(options?.rateLimitConfig);
    
    const marketplaceConfig = {
      apiKey: options?.marketplaceApiKeys?.openSea,
    };
    this.marketplace = new MarketplaceAggregator(marketplaceConfig);
    
    this.autoBuy = new AutoBuyService(this.wallet);
    this.portfolio = new PortfolioService(this.wallet);
    this.analytics = new CollectionAnalyticsService();
    this.tradeHistory = new TradeHistoryService();
    this.webhook = new WebhookService();
    this.multiWallet = new MultiWalletService();
  }

  async initialize(): Promise<void> {
    await this.wallet.initialize();
  }

  get walletService(): WalletService {
    return this.wallet;
  }

  get tokenService(): TokenService {
    return this.tokens;
  }

  get nftService(): NFTSevice {
    return this.nft;
  }

  get agentService(): AgentService {
    return this.agent;
  }

  get alertService(): AlertService {
    return this.alerts;
  }

  get contractService(): ContractService {
    return this.contract;
  }

  get historyService(): HistoryService {
    return this.history;
  }

  get bridgeService(): BridgeService {
    return this.bridge;
  }

  get networkService(): NetworkService {
    return this.network;
  }

  get marketplaceService(): MarketplaceAggregator {
    return this.marketplace;
  }

  get autoBuyService(): AutoBuyService {
    return this.autoBuy;
  }

  get portfolioService(): PortfolioService {
    return this.portfolio;
  }

  get analyticsService(): CollectionAnalyticsService {
    return this.analytics;
  }

  get tradeHistoryService(): TradeHistoryService {
    return this.tradeHistory;
  }

  get webhookService(): WebhookService {
    return this.webhook;
  }

  get multiWalletService(): MultiWalletService {
    return this.multiWallet;
  }

  getRateLimiterManager(): UserRateLimiterManager {
    return this.rateLimiterManager;
  }

  getTransactionMonitor(): TransactionMonitor {
    if (!this.transactionMonitor) {
      this.transactionMonitor = new TransactionMonitor(this.wallet);
    }
    return this.transactionMonitor;
  }

  getWalletMonitor(): WalletMonitor {
    if (!this.walletMonitor) {
      this.walletMonitor = new WalletMonitor(this.wallet);
    }
    return this.walletMonitor;
  }

  async disconnect(): Promise<void> {
    this.autoBuy.stop();
    
    if (this.transactionMonitor) {
      this.transactionMonitor.stopAll();
    }
    if (this.walletMonitor) {
      this.walletMonitor.stopMonitoring();
    }
  }
}

export { WalletService } from './wallet/index.js';
export { MultiWalletService } from './wallet/multiwallet.service.js';
export { TokenService } from './tokens/index.js';
export { NFTSevice } from './tokens/index.js';
export { AgentService } from './agent/index.js';
export { AlertService } from './alerts/index.js';
export { TransactionMonitor, WalletMonitor } from './wallet/monitor.js';
export { ContractService, HistoryService, BridgeService, NetworkService } from './services/index.js';
export { OpenSeaService, BlurService, TensorService, MarketplaceAggregator } from './tokens/marketplace.service.js';
export { AutoBuyService, PortfolioService, CollectionAnalyticsService } from './trading/index.js';
export { TradeHistoryService } from './utils/tradeHistory.service.js';
export { WebhookService } from './utils/webhook.service.js';
export { SUPPORTED_NETWORKS } from './wallet/index.js';
export * from './types.js';

export const Utils = {
  RateLimiter,
  createRateLimiter,
  UserRateLimiterManager,
  createUserRateLimiterManager,
  Cache,
  withRetry,
  KizunaError,
  ErrorCodes,
  isRetryable,
};

export const RateLimiters = {
  NFTPrice: createRateLimiter(10, 60),
  RPC: createRateLimiter(5, 1),
  DexScreener: createRateLimiter(15, 60),
  OpenSea: createRateLimiter(2, 1),
};
