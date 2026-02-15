import { WalletService } from '../wallet/wallet.service.js';
import { NFTCollection, NFTAsset, TransactionResult } from '../types.js';
import { createRateLimiter, RateLimiter } from '../utils/rateLimiter.js';
import axios from 'axios';

export interface NFTPriceData {
  floorPrice: string;
  lastUpdated: number;
  volume24h?: string;
  listedCount?: number;
}

export interface MarketplaceListing {
  id: string;
  contractAddress: string;
  tokenId: string;
  seller: string;
  price: string;
  paymentToken: string;
  marketplace: string;
  url: string;
}

export class NFTSevice {
  private wallet: WalletService;
  private priceCache: Map<string, NFTPriceData> = new Map();
  private priceRateLimiter: RateLimiter;
  private rpcRateLimiter: RateLimiter;

  constructor(wallet: WalletService, rateLimiters?: { nftPrice?: RateLimiter; rpc?: RateLimiter }) {
    this.wallet = wallet;
    this.priceRateLimiter = rateLimiters?.nftPrice || createRateLimiter(10, 60);
    this.rpcRateLimiter = rateLimiters?.rpc || createRateLimiter(5, 1);
  }

  setRateLimiter(limiter: RateLimiter): void {
    this.priceRateLimiter = limiter;
  }

  async getCollections(owner: string): Promise<NFTCollection[]> {
    return [];
  }

  async getAssets(owner: string, collectionAddress?: string): Promise<NFTAsset[]> {
    return [];
  }

  async getCollectionFloorPrice(collectionAddress: string, useCache: boolean = true): Promise<string | null> {
    const cacheKey = `floor:${collectionAddress.toLowerCase()}`;
    
    if (useCache) {
      const cached = this.priceCache.get(cacheKey);
      if (cached && Date.now() - cached.lastUpdated < 60000) {
        return cached.floorPrice;
      }
    }

    await this.priceRateLimiter.acquire(`nft:${collectionAddress.toLowerCase()}`);

    try {
      const floorPrice = await this.fetchFloorPriceFromAPI(collectionAddress);
      
      if (floorPrice) {
        this.priceCache.set(cacheKey, {
          floorPrice,
          lastUpdated: Date.now(),
        });
      }

      return floorPrice;
    } catch (error) {
      console.error('Error fetching floor price:', error);
      return null;
    }
  }

  async getFloorPriceWithRateLimit(collectionAddress: string): Promise<string | null> {
    const cacheKey = `floor:${collectionAddress.toLowerCase()}`;
    const cached = this.priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.lastUpdated < 60000) {
      return cached.floorPrice;
    }

    await this.priceRateLimiter.acquire(collectionAddress.toLowerCase());

    try {
      const floorPrice = await this.fetchFloorPriceFromAPI(collectionAddress);
      
      if (floorPrice) {
        this.priceCache.set(cacheKey, {
          floorPrice,
          lastUpdated: Date.now(),
        });
      }

      return floorPrice;
    } catch (error) {
      console.error('Rate limited or error:', error);
      return cached?.floorPrice || null;
    }
  }

  private async fetchFloorPriceFromAPI(collectionAddress: string): Promise<string | null> {
    const chainId = this.wallet.getChainId();
    
    const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${collectionAddress}`;
    
    try {
      const response = await axios.get(dexScreenerUrl, {
        timeout: 8000,
      });

      const pairs = response.data?.pairs;
      if (pairs && pairs.length > 0) {
        const pair = pairs[0];
        return pair.priceNative || pair.priceUsd || null;
      }
    } catch (error) {
      console.error('DexScreener API error:', error);
    }

    return null;
  }

  async getMultipleFloorPrices(
    collectionAddresses: string[],
    parallel: boolean = true
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    if (parallel) {
      const promises = collectionAddresses.map(async (addr) => {
        const price = await this.getFloorPriceWithRateLimit(addr);
        if (price) {
          results.set(addr.toLowerCase(), price);
        }
      });

      await Promise.allSettled(promises);
    } else {
      for (const addr of collectionAddresses) {
        const price = await this.getFloorPriceWithRateLimit(addr);
        if (price) {
          results.set(addr.toLowerCase(), price);
        }
      }
    }

    return results;
  }

  async getMarketplaceListings(
    collectionAddress: string,
    marketplace: 'opensea' | 'blur' | 'tensor' | 'all' = 'all'
  ): Promise<MarketplaceListing[]> {
    const listings: MarketplaceListing[] = [];

    if (marketplace === 'opensea' || marketplace === 'all') {
      await this.priceRateLimiter.acquire('opensea');
      const openSeaListings = await this.fetchOpenSeaListings(collectionAddress);
      listings.push(...openSeaListings);
    }

    return listings.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  }

  private async fetchOpenSeaListings(collection: string): Promise<MarketplaceListing[]> {
    try {
      const response = await axios.get('https://api.opensea.io/v2/listings', {
        params: {
          asset_contract_address: collection,
          limit: 20,
        },
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data?.listings?.map((listing: any) => ({
        id: listing.order_hash,
        contractAddress: listing.asset_contract_address,
        tokenId: listing.maker_asset_bundle.assets[0]?.token_id || '',
        seller: listing.maker,
        price: listing.base_price,
        paymentToken: listing.payment_token?.symbol || 'ETH',
        marketplace: 'opensea',
        url: `https://opensea.io/assets/${listing.asset_contract_address}/${listing.maker_asset_bundle.assets[0]?.token_id}`,
      })) || [];
    } catch (error) {
      console.error('OpenSea API error:', error);
      return [];
    }
  }

  async findBestListing(
    collectionAddress: string,
    tokenId?: string
  ): Promise<MarketplaceListing | null> {
    const listings = await this.getMarketplaceListings(collectionAddress, 'all');
    
    if (tokenId) {
      const filtered = listings.filter(l => l.tokenId === tokenId);
      return filtered[0] || null;
    }
    
    return listings[0] || null;
  }

  async transfer(
    collectionAddress: string,
    to: string,
    tokenId: string
  ): Promise<TransactionResult> {
    return {
      hash: '0x' + '0'.repeat(64),
      status: 'confirmed',
    };
  }

  async setPrice(
    collectionAddress: string,
    tokenId: string,
    price: string,
    paymentToken?: string
  ): Promise<TransactionResult> {
    return {
      hash: '0x' + '0'.repeat(64),
      status: 'confirmed',
    };
  }

  async buy(
    collectionAddress: string,
    tokenId: string,
    price: string,
    paymentToken?: string
  ): Promise<TransactionResult> {
    return {
      hash: '0x' + '0'.repeat(64),
      status: 'confirmed',
    };
  }

  getKnownCollections(): NFTCollection[] {
    return [
      { address: '0x65559019d93C317CC3f237a19D4a67B5B22f5E8', name: 'OnlyPngs' },
    ];
  }

  clearPriceCache(): void {
    this.priceCache.clear();
  }
}
