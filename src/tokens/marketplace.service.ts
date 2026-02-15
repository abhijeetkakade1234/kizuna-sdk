import axios, { AxiosInstance } from 'axios';

export interface MarketplaceConfig {
  apiKey?: string;
  rateLimit?: {
    maxRequests: number;
    timeWindowMs: number;
  };
}

export interface NFTListing {
  id: string;
  contractAddress: string;
  tokenId: string;
  seller: string;
  price: string;
  paymentToken: string;
  marketplace: string;
  url: string;
}

export interface BuyListingParams {
  listingId: string;
  contractAddress: string;
  tokenId: string;
  price: string;
  paymentToken?: string;
}

export class MarketplaceService {
  private marketplaces: Map<string, AxiosInstance> = new Map();
  private configs: Map<string, MarketplaceConfig> = new Map();

  configureMarketplace(
    name: string,
    baseURL: string,
    config: MarketplaceConfig = {}
  ): void {
    const instance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-API-KEY': config.apiKey }),
      },
    });

    this.marketplaces.set(name, instance);
    this.configs.set(name, config);
  }

  getMarketplace(name: string): AxiosInstance | null {
    return this.marketplaces.get(name) || null;
  }

  getConfig(name: string): MarketplaceConfig | undefined {
    return this.configs.get(name);
  }

  hasMarketplace(name: string): boolean {
    return this.marketplaces.has(name);
  }

  removeMarketplace(name: string): void {
    this.marketplaces.delete(name);
    this.configs.delete(name);
  }
}

export class OpenSeaService {
  private client: AxiosInstance;
  private config: MarketplaceConfig;

  constructor(config: MarketplaceConfig = {}) {
    this.config = config;
    this.client = axios.create({
      baseURL: 'https://api.opensea.io',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-API-KEY': config.apiKey }),
      },
    });
  }

  async getListings(
    collection: string,
    options?: { limit?: number; offset?: number }
  ): Promise<NFTListing[]> {
    try {
      const response = await this.client.get('/v2/listings', {
        params: {
          asset_contract_address: collection,
          limit: options?.limit || 20,
          offset: options?.offset || 0,
        },
      });

      return response.data.listings.map((listing: any) => ({
        id: listing.order_hash,
        contractAddress: listing.asset_contract_address,
        tokenId: listing.maker_asset_bundle.assets[0]?.token_id || '',
        seller: listing.maker,
        price: listing.base_price,
        paymentToken: listing.payment_token?.symbol || 'ETH',
        marketplace: 'opensea',
        url: `https://opensea.io/assets/${listing.asset_contract_address}/${listing.maker_asset_bundle.assets[0]?.token_id}`,
      }));
    } catch (error) {
      console.error('OpenSea API error:', error);
      return [];
    }
  }

  async getCollectionStats(collection: string): Promise<{
    floorPrice: string;
    volume24h: string;
    owners: number;
    totalSupply: number;
  } | null> {
    try {
      const response = await this.client.get(`/v2/collection/${collection}/stats`);
      return {
        floorPrice: response.data.stats.floor_price?.toString() || '0',
        volume24h: response.data.stats.one_day_volume?.toString() || '0',
        owners: response.data.stats.num_owners || 0,
        totalSupply: response.data.stats.total_supply || 0,
      };
    } catch (error) {
      console.error('OpenSea stats error:', error);
      return null;
    }
  }

  async buy(params: BuyListingParams): Promise<{ success: boolean; txHash?: string; error?: string }> {
    return {
      success: false,
      error: 'Use SDK wallet to purchase - this just fetches listings',
    };
  }
}

export class BlurService {
  private client: AxiosInstance;
  private config: MarketplaceConfig;

  constructor(config: MarketplaceConfig = {}) {
    this.config = config;
    this.client = axios.create({
      baseURL: 'https://api.blur.io',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getListings(collection: string): Promise<NFTListing[]> {
    try {
      const response = await this.client.get('/v1/collections', {
        params: { address: collection },
      });

      return [];
    } catch (error) {
      console.error('Blur API error:', error);
      return [];
    }
  }

  async getCollectionStats(collection: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/collections/${collection}/stats`);
      return response.data;
    } catch (error) {
      console.error('Blur stats error:', error);
      return null;
    }
  }
}

export class TensorService {
  private client: AxiosInstance;
  private config: MarketplaceConfig;

  constructor(config: MarketplaceConfig = {}) {
    this.config = config;
    this.client = axios.create({
      baseURL: 'https://api.tensor.so',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-TENSOR-API-KEY': config.apiKey }),
      },
    });
  }

  async getListings(collection: string): Promise<NFTListing[]> {
    try {
      const response = await this.client.get('/v1/markets/floor', {
        params: { collection },
      });

      return response.data?.mints?.map((mint: any) => ({
        id: mint.mintId,
        contractAddress: collection,
        tokenId: mint.mintId,
        seller: mint.seller,
        price: mint.price,
        paymentToken: 'SOL',
        marketplace: 'tensor',
        url: `https://tensor.so/collection/${collection}/mint/${mint.mintId}`,
      })) || [];
    } catch (error) {
      console.error('Tensor API error:', error);
      return [];
    }
  }

  async getCollectionStats(collection: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/collections/${collection}`);
      return response.data;
    } catch (error) {
      console.error('Tensor stats error:', error);
      return null;
    }
  }
}

export class MarketplaceAggregator {
  private openSea: OpenSeaService;
  private blur: BlurService;
  private tensor: TensorService;

  constructor(config: MarketplaceConfig = {}) {
    this.openSea = new OpenSeaService(config);
    this.blur = new BlurService(config);
    this.tensor = new TensorService(config);
  }

  async getAllListings(
    collection: string,
    marketplaces: ('opensea' | 'blur' | 'tensor')[] = ['opensea']
  ): Promise<NFTListing[]> {
    const promises: Promise<NFTListing[]>[] = [];

    if (marketplaces.includes('opensea')) {
      promises.push(this.openSea.getListings(collection));
    }
    if (marketplaces.includes('blur')) {
      promises.push(this.blur.getListings(collection));
    }
    if (marketplaces.includes('tensor')) {
      promises.push(this.tensor.getListings(collection));
    }

    const results = await Promise.allSettled(promises);
    
    const allListings: NFTListing[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allListings.push(...result.value);
      }
    });

    return allListings.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  }

  async getBestPrice(
    collection: string,
    tokenId?: string
  ): Promise<{ listing: NFTListing; marketplace: string } | null> {
    const listings = await this.getAllListings(collection);

    if (tokenId) {
      const filtered = listings.filter(l => l.tokenId === tokenId);
      if (filtered.length > 0) {
        return { listing: filtered[0], marketplace: filtered[0].marketplace };
      }
    }

    if (listings.length > 0) {
      return { listing: listings[0], marketplace: listings[0].marketplace };
    }

    return null;
  }

  getOpenSea(config?: MarketplaceConfig): OpenSeaService {
    return new OpenSeaService(config || this['config']);
  }

  getBlur(config?: MarketplaceConfig): BlurService {
    return new BlurService(config || this['config']);
  }

  getTensor(config?: MarketplaceConfig): TensorService {
    return new TensorService(config || this['config']);
  }
}
