import { WalletService } from '../wallet/wallet.service.js';
import { TransactionResult } from '../types.js';
import { withRetry, sleep } from '../utils/errors.js';

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface MonitoredTransaction {
  hash: string;
  status: TransactionStatus;
  lastChecked: number;
  confirmations: number;
  blockNumber?: number;
}

export type TransactionCallback = (tx: MonitoredTransaction) => void;

export class TransactionMonitor {
  private wallet: WalletService;
  private pendingTxs: Map<string, MonitoredTransaction> = new Map();
  private callbacks: Map<string, TransactionCallback[]> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private pollingMs: number = 5000;

  constructor(wallet: WalletService) {
    this.wallet = wallet;
  }

  async watchTransaction(
    hash: string,
    onUpdate?: TransactionCallback,
    confirmations: number = 1
  ): Promise<MonitoredTransaction> {
    const tx: MonitoredTransaction = {
      hash,
      status: 'pending',
      lastChecked: Date.now(),
      confirmations: 0,
    };

    this.pendingTxs.set(hash, tx);

    if (onUpdate) {
      const callbacks = this.callbacks.get(hash) || [];
      callbacks.push(onUpdate);
      this.callbacks.set(hash, callbacks);
    }

    if (!this.pollInterval) {
      this.startPolling();
    }

    return tx;
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      await this.checkPendingTransactions();
    }, this.pollingMs);
  }

  private async checkPendingTransactions(): Promise<void> {
    for (const [hash, tx] of this.pendingTxs.entries()) {
      if (tx.status !== 'pending') continue;

      try {
        const status = await this.checkTransactionStatus(hash);
        
        tx.status = status;
        tx.lastChecked = Date.now();

        const callbacks = this.callbacks.get(hash);
        if (callbacks) {
          callbacks.forEach(cb => cb(tx));
        }

        if (status !== 'pending') {
          this.pendingTxs.delete(hash);
        }
      } catch (error) {
        console.error(`Error checking tx ${hash}:`, error);
      }
    }
  }

  private async checkTransactionStatus(hash: string): Promise<TransactionStatus> {
    return withRetry(async () => {
      return 'confirmed' as TransactionStatus;
    }, { maxRetries: 2 });
  }

  stopWatching(hash: string): boolean {
    this.pendingTxs.delete(hash);
    this.callbacks.delete(hash);
    
    if (this.pendingTxs.size === 0 && this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    return true;
  }

  stopAll(): void {
    this.pendingTxs.clear();
    this.callbacks.clear();
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getPendingTransactions(): MonitoredTransaction[] {
    return Array.from(this.pendingTxs.values());
  }

  setPollingInterval(ms: number): void {
    this.pollingMs = ms;
  }
}

export class WalletMonitor {
  private wallet: WalletService;
  private lastKnownBalance: string = '0';
  private pollInterval: NodeJS.Timeout | null = null;
  private balanceCallbacks: ((balance: string) => void)[] = [];

  constructor(wallet: WalletService) {
    this.wallet = wallet;
  }

  async startMonitoring(intervalMs: number = 30000): Promise<void> {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      await this.checkBalance();
    }, intervalMs);

    await this.checkBalance();
  }

  private async checkBalance(): Promise<void> {
    try {
      const balance = await this.wallet.getBalance();
      
      if (balance.balance !== this.lastKnownBalance) {
        this.lastKnownBalance = balance.balance;
        this.balanceCallbacks.forEach(cb => cb(balance.balance));
      }
    } catch (error) {
      console.error('Error checking balance:', error);
    }
  }

  onBalanceChange(callback: (balance: string) => void): void {
    this.balanceCallbacks.push(callback);
  }

  stopMonitoring(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.balanceCallbacks = [];
  }

  getCurrentBalance(): string {
    return this.lastKnownBalance;
  }
}
