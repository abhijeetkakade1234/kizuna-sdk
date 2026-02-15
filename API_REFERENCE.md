# KizunaSDK API Reference

**Quick lookup for all available methods**

---

## KizunaClient

```typescript
const client = new KizunaClient(config, options)
await client.initialize()
await client.disconnect()
```

---

## WalletService

```typescript
client.walletService.getAddress(): string
client.walletService.getChainId(): number
client.walletService.getNetwork(): NetworkInfo
client.walletService.isInitialized(): boolean
client.walletService.getBalance(tokenSymbols?: string[]): Promise<BalanceResult>
client.walletService.transfer(to: string, amount: string, token?: string): Promise<TransactionResult>
client.walletService.sendTransaction(to: string, data?: string, value?: string): Promise<TransactionResult>
client.walletService.swap(params: SwapParams): Promise<TransactionResult>
```

---

## NFTService

```typescript
client.nftService.getFloorPriceWithRateLimit(collectionAddress: string): Promise<string | null>
client.nftService.getMultipleFloorPrices(addresses: string[]): Promise<Map<string, string>>
client.nftService.getMarketplaceListings(collection: string, marketplace?: string): Promise<MarketplaceListing[]>
client.nftService.findBestListing(collection: string, tokenId?: string): Promise<MarketplaceListing | null>
client.nftService.getKnownCollections(): NFTCollection[]
client.nftService.clearPriceCache(): void
```

---

## AutoBuyService

```typescript
const position = client.autoBuyService.createPosition(config): AutoBuyPosition

// Config:
{
  collectionAddress: string,  // NFT collection to watch
  maxPrice: string,           // Maximum price to pay
  paymentToken?: string,      // Token to pay with (default: 'eth')
  maxRetries?: number,       // Max purchase attempts
  stopOnError?: boolean      // Stop on failure
}

// Methods
client.autoBuyService.start(checkIntervalMs?: number): void
client.autoBuyService.stop(): void
client.autoBuyService.pausePosition(id: string): boolean
client.autoBuyService.resumePosition(id: string): boolean
client.autoBuyService.removePosition(id: string): boolean
client.autoBuyService.getPosition(id: string): AutoBuyPosition
client.autoBuyService.getActivePositions(): AutoBuyPosition[]
client.autoBuyService.onPurchase(callback): void
client.autoBuyService.onError(callback): void
```

---

## PortfolioService

```typescript
// Add/remove holdings
client.portfolioService.addHolding(item: PortfolioItem): void
client.portfolioService.removeHolding(contractAddress: string, tokenId: string): boolean
client.portfolioService.getHolding(contractAddress: string, tokenId: string): PortfolioItem
client.portfolioService.getAllHoldings(): PortfolioItem[]

// Update prices
client.portfolioService.updateFloorPrices(): Promise<void>

// Get summary with P&L
client.portfolioService.getPortfolioSummary(): PortfolioSummary
// Returns: { totalValue, totalCost, totalPnL, totalPnLPercent, itemCount }

// Record trades
client.portfolioService.recordTrade(trade): Trade

// Get P&L by collection
client.portfolioService.getPnLByCollection(): Map<string, { buys, sells, pnl }>

// Import/export
client.portfolioService.exportPortfolio(): { holdings, trades, summary }
client.portfolioService.importPortfolio(data): void
```

---

## AnalyticsService

```typescript
client.analyticsService.getCollectionStats(address: string): Promise<CollectionStats>
client.analyticsService.getFloorPriceHistory(address: string, days?: number): Promise<FloorPriceHistory[]>
client.analyticsService.getVolumeHistory(address: string, days?: number): Promise<VolumeData[]>
client.analyticsService.getFullAnalytics(address: string): Promise<CollectionAnalytics>
client.analyticsService.compareCollections(addresses: string[]): Promise<CollectionStats[]>
```

---

## MultiWalletService

```typescript
// Create new wallet
const wallet = client.multiWalletService.createWallet(config, name?): ManagedWallet

// Config:
{
  rpcUrl: string,           // RPC URL
  apiKey: string,            // 0xGasless API key
  chainId: number,           // Chain ID
  // Note: No privateKey = generates new wallet
}

// Initialize and use
await client.multiWalletService.initializeWallet(id): void
client.multiWalletService.getWallet(id: string): WalletService
client.multiWalletService.getAllWallets(): ManagedWallet[]
client.multiWalletService.setActiveWallet(id: string): boolean
client.multiWalletService.getActiveWallet(): WalletService
client.multiWalletService.removeWallet(id: string): boolean

// Groups
const group = client.multiWalletService.createGroup(name): WalletGroup
client.multiWalletService.addWalletToGroup(groupId, walletId): boolean
client.multiWalletService.getWalletsByChain(chainId: number): ManagedWallet[]
```

---

## TradeHistoryService

```typescript
// Set up file logging
client.tradeHistoryService.setLogFile(path: string, autoSave?: boolean): void

// Log trades
client.tradeHistoryService.logBuy(params): LoggedTrade
client.tradeHistoryService.logSell(params): LoggedTrade
client.tradeHistoryService.logTransfer(params): LoggedTrade
client.tradeHistoryService.logSwap(params): LoggedTrade

// Query
client.tradeHistoryService.getAllTrades(): LoggedTrade[]
client.tradeHistoryService.getTradesByWallet(address: string): LoggedTrade[]
client.tradeHistoryService.getTradesByCollection(address: string): LoggedTrade[]
client.tradeHistoryService.getTradesByType(type: string): LoggedTrade[]
client.tradeHistoryService.getTradesInRange(startTime: number, endTime: number): LoggedTrade[]
client.tradeHistoryService.getSummary(period?): TradeLogSummary

// Update
client.tradeHistoryService.updateTradeStatus(id: string, status: string): boolean

// Export
client.tradeHistoryService.exportToJSON(): string
client.tradeHistoryService.importFromJSON(json: string): number
```

---

## WebhookService

```typescript
// Add webhook
client.webhookService.addWebhook(id: string, config: WebhookConfig): void
client.webhookService.removeWebhook(id: string): boolean
client.webhookService.updateWebhook(id: string, updates: Partial<WebhookConfig>): boolean

// Subscribe to events
client.webhookService.subscribe(event: string, callback): string
client.webhookService.unsubscribe(id: string): boolean

// Emit events
client.webhookService.emit(event: string, data: any): Promise<void>

// Events: 'trade.executed', 'trade.failed', 'nft.purchased', 'price.alert', 'error'

// Helpers
client.webhookService.sendDiscordWebhook(url: string, message: object): Promise<boolean>
client.webhookService.sendTelegramWebhook(botToken: string, chatId: string, message: string): Promise<boolean>
client.webhookService.formatTradeNotification(type, collection, tokenId, price, txHash): object
client.webhookService.formatPriceAlert(collection, current, target, condition): object
client.webhookService.formatErrorNotification(error, context?): object
```

---

## Rate Limiter

```typescript
client.getRateLimiterManager().acquire(service: string, key?: string): Promise<boolean>
client.getRateLimiterManager().tryAcquire(service: string, key?: string): boolean
client.getRateLimiterManager().getWaitTime(service: string, key?: string): number
client.getRateLimiterManager().updateConfig(service: string, config: object): void
client.getRateLimiterManager().reset(service?: string): void
client.getRateLimiterManager().getAllConfigs(): Record<string, RateLimiterConfig>
```

---

## Transaction Monitor

```typescript
const monitor = client.getTransactionMonitor()
await monitor.watchTransaction(hash: string, callback?: function, confirmations?: number): MonitoredTransaction
monitor.stopWatching(hash: string): boolean
monitor.stopAll(): void
monitor.getPendingTransactions(): MonitoredTransaction[]
monitor.setPollingInterval(ms: number): void
```

---

## Wallet Monitor

```typescript
const monitor = client.getWalletMonitor()
await monitor.startMonitoring(intervalMs?: number): void
monitor.onBalanceChange(callback): void
monitor.stopMonitoring(): void
monitor.getCurrentBalance(): string
```

---

## Supported Networks

```typescript
import { SUPPORTED_NETWORKS } from 'kizuna-sdk'

SUPPORTED_NETWORKS[43113]  // Avalanche Fuji
SUPPORTED_NETWORKS[43114]  // Avalanche
SUPPORTED_NETWORKS[1]     // Ethereum
SUPPORTED_NETWORKS[137]    // Polygon
SUPPORTED_NETWORKS[56]     // BNB Chain
SUPPORTED_NETWORKS[8453]   // Base
SUPPORTED_NETWORKS[156]    // Sonic
SUPPORTED_NETWORKS[1284]   // Moonbeam
```

---

## Types

```typescript
interface WalletConfig {
  privateKey: `0x${string}`  // Optional - can generate new wallet
  rpcUrl: string
  apiKey: string
  chainId: number
}

interface TransactionResult {
  hash: string
  status: 'pending' | 'confirmed' | 'failed'
  blockNumber?: number
}

interface BalanceResult {
  address: string
  balance: string
  tokens?: TokenBalance[]
}

interface NFTListing {
  id: string
  contractAddress: string
  tokenId: string
  seller: string
  price: string
  paymentToken: string
  marketplace: string
  url: string
}

interface PortfolioSummary {
  totalValue: string
  totalCost: string
  totalPnL: string
  totalPnLPercent: string
  itemCount: number
}

interface CollectionStats {
  address: string
  name: string
  floorPrice: string
  volume24h: string
  sales24h: number
  totalSupply: number
  holders: number
  listedCount: number
}
```
