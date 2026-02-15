import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';

export interface LoggedTrade {
  id: string;
  timestamp: number;
  date: string;
  type: 'buy' | 'sell' | 'transfer' | 'swap';
  walletAddress: string;
  collectionAddress?: string;
  tokenId?: string;
  amount: string;
  paymentToken: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  gasFee?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface TradeLogSummary {
  totalTrades: number;
  buys: number;
  sells: number;
  transfers: number;
  swaps: number;
  totalVolume: string;
  totalGasFees: string;
  successRate: string;
  period: {
    start: number;
    end: number;
  };
}

export class TradeHistoryService {
  private trades: LoggedTrade[] = [];
  private logFilePath: string | null = null;
  private autoSave: boolean = false;

  setLogFile(path: string, autoSave: boolean = false): void {
    this.logFilePath = path;
    this.autoSave = autoSave;
    
    if (existsSync(path)) {
      this.loadFromFile();
    }
  }

  private loadFromFile(): void {
    if (!this.logFilePath) return;
    
    try {
      const data = readFileSync(this.logFilePath, 'utf-8');
      this.trades = JSON.parse(data);
    } catch (error) {
      console.error('Error loading trade history:', error);
      this.trades = [];
    }
  }

  private saveToFile(): void {
    if (!this.logFilePath) return;
    
    try {
      writeFileSync(this.logFilePath, JSON.stringify(this.trades, null, 2));
    } catch (error) {
      console.error('Error saving trade history:', error);
    }
  }

  private appendToFile(trade: LoggedTrade): void {
    if (!this.logFilePath) return;
    
    try {
      appendFileSync(this.logFilePath, JSON.stringify(trade) + '\n');
    } catch (error) {
      console.error('Error appending to trade history:', error);
    }
  }

  logTrade(trade: Omit<LoggedTrade, 'id' | 'timestamp' | 'date'>): LoggedTrade {
    const loggedTrade: LoggedTrade = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      date: new Date().toISOString(),
    };

    this.trades.push(loggedTrade);

    if (this.autoSave && this.logFilePath) {
      this.appendToFile(loggedTrade);
    }

    return loggedTrade;
  }

  logBuy(params: {
    walletAddress: string;
    collectionAddress: string;
    tokenId: string;
    amount: string;
    paymentToken: string;
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed';
    gasUsed?: string;
    gasFee?: string;
    notes?: string;
    metadata?: Record<string, any>;
  }): LoggedTrade {
    return this.logTrade({ ...params, type: 'buy' });
  }

  logSell(params: {
    walletAddress: string;
    collectionAddress: string;
    tokenId: string;
    amount: string;
    paymentToken: string;
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed';
    gasUsed?: string;
    gasFee?: string;
    notes?: string;
    metadata?: Record<string, any>;
  }): LoggedTrade {
    return this.logTrade({ ...params, type: 'sell' });
  }

  logTransfer(params: {
    walletAddress: string;
    collectionAddress?: string;
    tokenId?: string;
    amount: string;
    paymentToken: string;
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed';
    gasUsed?: string;
    gasFee?: string;
    notes?: string;
  }): LoggedTrade {
    return this.logTrade({ ...params, type: 'transfer' });
  }

  logSwap(params: {
    walletAddress: string;
    amount: string;
    paymentToken: string;
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed';
    gasUsed?: string;
    gasFee?: string;
    notes?: string;
    metadata?: Record<string, any>;
  }): LoggedTrade {
    return this.logTrade({ ...params, type: 'swap' });
  }

  updateTradeStatus(id: string, status: LoggedTrade['status']): boolean {
    const trade = this.trades.find(t => t.id === id);
    if (trade) {
      trade.status = status;
      if (this.autoSave && this.logFilePath) {
        this.saveToFile();
      }
      return true;
    }
    return false;
  }

  getTrade(id: string): LoggedTrade | undefined {
    return this.trades.find(t => t.id === id);
  }

  getAllTrades(): LoggedTrade[] {
    return [...this.trades].sort((a, b) => b.timestamp - a.timestamp);
  }

  getTradesByWallet(address: string): LoggedTrade[] {
    return this.trades
      .filter(t => t.walletAddress.toLowerCase() === address.toLowerCase())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getTradesByCollection(address: string): LoggedTrade[] {
    return this.trades
      .filter(t => t.collectionAddress?.toLowerCase() === address.toLowerCase())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getTradesByType(type: LoggedTrade['type']): LoggedTrade[] {
    return this.trades
      .filter(t => t.type === type)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getTradesByStatus(status: LoggedTrade['status']): LoggedTrade[] {
    return this.trades
      .filter(t => t.status === status)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getTradesInRange(startTime: number, endTime: number): LoggedTrade[] {
    return this.trades
      .filter(t => t.timestamp >= startTime && t.timestamp <= endTime)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getSummary(period?: { start: number; end: number }): TradeLogSummary {
    const trades = period 
      ? this.getTradesInRange(period.start, period.end)
      : this.trades;

    const confirmed = trades.filter(t => t.status === 'confirmed');
    const totalGasFees = trades.reduce((sum, t) => sum + parseFloat(t.gasFee || '0'), 0);
    const totalVolume = confirmed.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return {
      totalTrades: trades.length,
      buys: trades.filter(t => t.type === 'buy').length,
      sells: trades.filter(t => t.type === 'sell').length,
      transfers: trades.filter(t => t.type === 'transfer').length,
      swaps: trades.filter(t => t.type === 'swap').length,
      totalVolume: totalVolume.toString(),
      totalGasFees: totalGasFees.toString(),
      successRate: trades.length > 0 
        ? ((confirmed.length / trades.length) * 100).toFixed(2)
        : '0',
      period: period || {
        start: trades.length > 0 ? Math.min(...trades.map(t => t.timestamp)) : Date.now(),
        end: Date.now(),
      },
    };
  }

  searchTrades(query: string): LoggedTrade[] {
    const lowerQuery = query.toLowerCase();
    return this.trades.filter(t => 
      t.txHash.toLowerCase().includes(lowerQuery) ||
      t.collectionAddress?.toLowerCase().includes(lowerQuery) ||
      t.tokenId?.toLowerCase().includes(lowerQuery) ||
      t.notes?.toLowerCase().includes(lowerQuery)
    );
  }

  clearHistory(): void {
    this.trades = [];
    if (this.logFilePath) {
      this.saveToFile();
    }
  }

  exportToJSON(): string {
    return JSON.stringify(this.trades, null, 2);
  }

  importFromJSON(json: string): number {
    try {
      const imported = JSON.parse(json);
      if (Array.isArray(imported)) {
        this.trades = imported;
        if (this.autoSave && this.logFilePath) {
          this.saveToFile();
        }
        return imported.length;
      }
      return 0;
    } catch (error) {
      console.error('Error importing trade history:', error);
      return 0;
    }
  }
}
