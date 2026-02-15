import { WalletService } from '../wallet/wallet.service.js';
import { TransactionResult } from '../types.js';
import axios from 'axios';

export interface AutoBuyConfig {
  collectionAddress: string;
  maxPrice: string;
  paymentToken?: string;
  maxRetries?: number;
  stopOnError?: boolean;
}

export interface AutoBuyPosition {
  id: string;
  config: AutoBuyConfig;
  status: 'active' | 'purchased' | 'stopped' | 'error';
  lastCheck: number;
  attempts: number;
  purchasedTokenId?: string;
  purchasedPrice?: string;
  purchasedTxHash?: string;
  error?: string;
}

export interface PurchaseTrigger {
  listingId: string;
  tokenId: string;
  price: string;
  seller: string;
  url: string;
}

export type AutoBuyCallback = (position: AutoBuyPosition, trigger: PurchaseTrigger) => void;
export type ErrorCallback = (position: AutoBuyPosition, error: Error) => void;

export class AutoBuyService {
  private wallet: WalletService;
  private positions: Map<string, AutoBuyPosition> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private onPurchaseCallbacks: AutoBuyCallback[] = [];
  private onErrorCallbacks: ErrorCallback[] = [];
  private isRunning: boolean = false;

  constructor(wallet: WalletService) {
    this.wallet = wallet;
  }

  createPosition(config: AutoBuyConfig): AutoBuyPosition {
    const position: AutoBuyPosition = {
      id: `autobuy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      config: {
        ...config,
        maxRetries: config.maxRetries || 5,
        stopOnError: config.stopOnError ?? true,
      },
      status: 'active',
      lastCheck: Date.now(),
      attempts: 0,
    };

    this.positions.set(position.id, position);
    return position;
  }

  onPurchase(callback: AutoBuyCallback): void {
    this.onPurchaseCallbacks.push(callback);
  }

  onError(callback: ErrorCallback): void {
    this.onErrorCallbacks.push(callback);
  }

  private async checkListings(position: AutoBuyPosition): Promise<PurchaseTrigger | null> {
    try {
      const chainId = this.wallet.getChainId();
      let apiUrl: string;

      if (chainId === 43113 || chainId === 43114) {
        apiUrl = 'https://api.opensea.io/v2/listings';
      } else if (chainId === 8453) {
        apiUrl = 'https://api.opensea.io/v2/listings';
      } else {
        apiUrl = 'https://api.opensea.io/v2/listings';
      }

      const response = await axios.get(apiUrl, {
        params: {
          asset_contract_address: position.config.collectionAddress,
          limit: 10,
        },
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const listings = response.data?.listings || [];
      
      for (const listing of listings) {
        const price = parseFloat(this.convertPrice(listing.base_price, listing.payment_token?.decimals || 18));
        const maxPrice = parseFloat(position.config.maxPrice);

        if (price <= maxPrice) {
          return {
            listingId: listing.order_hash,
            tokenId: listing.maker_asset_bundle.assets[0]?.token_id || '',
            price: listing.base_price,
            seller: listing.maker,
            url: `https://opensea.io/assets/${position.config.collectionAddress}/${listing.maker_asset_bundle.assets[0]?.token_id}`,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error checking listings:', error);
      return null;
    }
  }

  private convertPrice(price: string, decimals: number): string {
    return (parseInt(price) / Math.pow(10, decimals)).toString();
  }

  private async executePurchase(position: AutoBuyPosition, trigger: PurchaseTrigger): Promise<boolean> {
    try {
      const price = this.convertPrice(trigger.price, 18);
      
      const result = await this.wallet.transfer(
        trigger.seller,
        price,
        position.config.paymentToken || 'eth'
      );

      if (result.status === 'confirmed') {
        position.status = 'purchased';
        position.purchasedTokenId = trigger.tokenId;
        position.purchasedPrice = price;
        position.purchasedTxHash = result.hash;
        this.positions.set(position.id, position);

        this.onPurchaseCallbacks.forEach(cb => cb(position, trigger));
        return true;
      }

      throw new Error('Transaction failed');
    } catch (error: any) {
      position.attempts++;
      position.error = error.message;
      
      if (position.attempts >= (position.config.maxRetries || 5)) {
        position.status = position.config.stopOnError ? 'stopped' : 'error';
      }
      
      this.positions.set(position.id, position);
      this.onErrorCallbacks.forEach(cb => cb(position, error));
      return false;
    }
  }

  async start(checkIntervalMs: number = 5000): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.checkInterval = setInterval(async () => {
      await this.checkAllPositions();
    }, checkIntervalMs);

    console.log('Auto-buy service started');
  }

  private async checkAllPositions(): Promise<void> {
    for (const [id, position] of this.positions.entries()) {
      if (position.status !== 'active') continue;

      position.lastCheck = Date.now();
      this.positions.set(id, position);

      const trigger = await this.checkListings(position);
      
      if (trigger) {
        console.log(`Auto-buy triggered for ${position.config.collectionAddress}: ${trigger.price}`);
        await this.executePurchase(position, trigger);
      }
    }
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('Auto-buy service stopped');
  }

  getPosition(id: string): AutoBuyPosition | undefined {
    return this.positions.get(id);
  }

  getActivePositions(): AutoBuyPosition[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'active');
  }

  getAllPositions(): AutoBuyPosition[] {
    return Array.from(this.positions.values());
  }

  pausePosition(id: string): boolean {
    const position = this.positions.get(id);
    if (position && position.status === 'active') {
      position.status = 'stopped';
      this.positions.set(id, position);
      return true;
    }
    return false;
  }

  resumePosition(id: string): boolean {
    const position = this.positions.get(id);
    if (position && position.status === 'stopped') {
      position.status = 'active';
      position.attempts = 0;
      this.positions.set(id, position);
      return true;
    }
    return false;
  }

  removePosition(id: string): boolean {
    return this.positions.delete(id);
  }

  clearAllPositions(): void {
    this.positions.clear();
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
