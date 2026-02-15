import { WalletService } from '../wallet/wallet.service.js';
import axios from 'axios';

export interface PortfolioItem {
  contractAddress: string;
  tokenId: string;
  name?: string;
  imageUrl?: string;
  acquisitionPrice?: string;
  acquisitionDate?: number;
  currentFloorPrice?: string;
}

export interface PortfolioSummary {
  totalValue: string;
  totalCost: string;
  totalPnL: string;
  totalPnLPercent: string;
  itemCount: number;
}

export interface Trade {
  id: string;
  type: 'buy' | 'sell';
  contractAddress: string;
  tokenId: string;
  price: string;
  paymentToken: string;
  txHash: string;
  timestamp: number;
  collectionName?: string;
  imageUrl?: string;
}

export class PortfolioService {
  private wallet: WalletService;
  private holdings: Map<string, PortfolioItem> = new Map();
  private tradeHistory: Trade[] = [];
  private floorPrices: Map<string, string> = new Map();

  constructor(wallet: WalletService) {
    this.wallet = wallet;
  }

  async fetchHoldings(owner: string): Promise<PortfolioItem[]> {
    try {
      const chainId = this.wallet.getChainId();
      
      const response = await axios.get('https://api.reservoir.tools/users/{user}/collections/v7', {
        params: { user: owner },
        headers: { 'x-api-key': process.env.RESERVOIR_API_KEY },
      });

      const holdings: PortfolioItem[] = [];
      
      return holdings;
    } catch (error) {
      console.error('Error fetching holdings:', error);
      return [];
    }
  }

  addHolding(item: PortfolioItem): void {
    const key = `${item.contractAddress}:${item.tokenId}`;
    this.holdings.set(key, item);
  }

  removeHolding(contractAddress: string, tokenId: string): boolean {
    const key = `${contractAddress}:${tokenId}`;
    return this.holdings.delete(key);
  }

  getHolding(contractAddress: string, tokenId: string): PortfolioItem | undefined {
    const key = `${contractAddress}:${tokenId}`;
    return this.holdings.get(key);
  }

  getAllHoldings(): PortfolioItem[] {
    return Array.from(this.holdings.values());
  }

  async updateFloorPrices(): Promise<void> {
    const addresses = Array.from(this.holdings.keys()).map(k => k.split(':')[0]);
    
    for (const address of [...new Set(addresses)]) {
      try {
        const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
        const price = response.data?.pairs?.[0]?.priceNative;
        if (price) {
          this.floorPrices.set(address.toLowerCase(), price);
        }
      } catch (error) {
        console.error(`Error fetching floor price for ${address}:`, error);
      }
    }
  }

  getPortfolioSummary(): PortfolioSummary {
    let totalValue = 0;
    let totalCost = 0;

    for (const item of this.holdings.values()) {
      const floorPrice = this.floorPrices.get(item.contractAddress.toLowerCase()) || item.currentFloorPrice || '0';
      totalValue += parseFloat(floorPrice);
      totalCost += parseFloat(item.acquisitionPrice || '0');
    }

    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = totalCost > 0 ? ((totalPnL / totalCost) * 100) : 0;

    return {
      totalValue: totalValue.toString(),
      totalCost: totalCost.toString(),
      totalPnL: totalPnL.toString(),
      totalPnLPercent: totalPnLPercent.toFixed(2),
      itemCount: this.holdings.size,
    };
  }

  recordTrade(trade: Omit<Trade, 'id'>): Trade {
    const newTrade: Trade = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.tradeHistory.push(newTrade);

    if (trade.type === 'buy') {
      this.addHolding({
        contractAddress: trade.contractAddress,
        tokenId: trade.tokenId,
        acquisitionPrice: trade.price,
        acquisitionDate: trade.timestamp,
        imageUrl: trade.imageUrl,
      });
    } else if (trade.type === 'sell') {
      this.removeHolding(trade.contractAddress, trade.tokenId);
    }

    return newTrade;
  }

  getTradeHistory(options?: {
    contractAddress?: string;
    type?: 'buy' | 'sell';
    limit?: number;
  }): Trade[] {
    let trades = [...this.tradeHistory];

    if (options?.contractAddress) {
      trades = trades.filter(t => t.contractAddress === options.contractAddress);
    }

    if (options?.type) {
      trades = trades.filter(t => t.type === options.type);
    }

    trades.sort((a, b) => b.timestamp - a.timestamp);

    if (options?.limit) {
      trades = trades.slice(0, options.limit);
    }

    return trades;
  }

  getPnLByCollection(): Map<string, { buys: number; sells: number; pnl: string }> {
    const pnlMap = new Map<string, { buys: number; sells: number; pnl: string }>();

    for (const trade of this.tradeHistory) {
      const existing = pnlMap.get(trade.contractAddress) || { buys: 0, sells: 0, pnl: '0' };
      
      if (trade.type === 'buy') {
        existing.buys += parseFloat(trade.price);
      } else {
        existing.sells += parseFloat(trade.price);
      }

      existing.pnl = (existing.sells - existing.buys).toString();
      pnlMap.set(trade.contractAddress, existing);
    }

    return pnlMap;
  }

  clearHoldings(): void {
    this.holdings.clear();
  }

  clearTradeHistory(): void {
    this.tradeHistory = [];
  }

  exportPortfolio(): { holdings: PortfolioItem[]; trades: Trade[]; summary: PortfolioSummary } {
    return {
      holdings: this.getAllHoldings(),
      trades: this.tradeHistory,
      summary: this.getPortfolioSummary(),
    };
  }

  importPortfolio(data: { holdings?: PortfolioItem[]; trades?: Trade[] }): void {
    if (data.holdings) {
      for (const item of data.holdings) {
        this.addHolding(item);
      }
    }

    if (data.trades) {
      this.tradeHistory = data.trades;
    }
  }
}
