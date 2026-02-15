import axios from 'axios';

export interface CollectionStats {
  address: string;
  name: string;
  floorPrice: string;
  floorPriceChange24h?: string;
  volume24h: string;
  volumeChange24h?: string;
  sales24h: number;
  totalSupply: number;
  holders: number;
  listedCount: number;
  averagePrice?: string;
  marketCap?: string;
}

export interface FloorPriceHistory {
  timestamp: number;
  price: string;
}

export interface VolumeData {
  timestamp: number;
  volume: string;
  sales: number;
}

export interface HolderDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface CollectionAnalytics {
  stats: CollectionStats;
  floorHistory: FloorPriceHistory[];
  volumeHistory: VolumeData[];
  holderDistribution: HolderDistribution[];
}

export class CollectionAnalyticsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL: number = 60000;

  async getCollectionStats(collectionAddress: string, useCache: boolean = true): Promise<CollectionStats | null> {
    const cacheKey = `stats:${collectionAddress}`;
    
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    try {
      const response = await axios.get(`https://api.reservoir.tools/collections/v5`, {
        params: { contract: collectionAddress },
        headers: { 'x-api-key': process.env.RESERVOIR_API_KEY },
        timeout: 10000,
      });

      const collection = response.data?.collections?.[0];
      
      if (!collection) return null;

      const stats: CollectionStats = {
        address: collectionAddress,
        name: collection.name || 'Unknown',
        floorPrice: collection.floorAsk?.price?.amount?.native || '0',
        volume24h: collection.volume?.['24h'] || '0',
        sales24h: collection.sales?.['24h'] || 0,
        totalSupply: collection.tokenCount || 0,
        holders: collection.ownerCount || 0,
        listedCount: collection.floorAsk?.count || 0,
      };

      this.cache.set(cacheKey, { data: stats, timestamp: Date.now() });
      return stats;
    } catch (error) {
      console.error('Error fetching collection stats:', error);
      return null;
    }
  }

  async getFloorPriceHistory(
    collectionAddress: string,
    days: number = 7
  ): Promise<FloorPriceHistory[]> {
    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (days * 24 * 60 * 60);

      const response = await axios.get(`https://api.reservoir.tools/collections/floor-history/v1`, {
        params: {
          collection: collectionAddress,
          startTime,
          endTime,
          granularity: 'day',
        },
        headers: { 'x-api-key': process.env.RESERVOIR_API_KEY },
        timeout: 10000,
      });

      return response.data?.floorHistory?.map((item: any) => ({
        timestamp: item.timestamp * 1000,
        price: item.floorPrice,
      })) || [];
    } catch (error) {
      console.error('Error fetching floor history:', error);
      return [];
    }
  }

  async getVolumeHistory(
    collectionAddress: string,
    days: number = 7
  ): Promise<VolumeData[]> {
    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (days * 24 * 60 * 60);

      const response = await axios.get(`https://api.reservoir.tools/collections/volume-history/v1`, {
        params: {
          collection: collectionAddress,
          startTime,
          endTime,
          granularity: 'day',
        },
        headers: { 'x-api-key': process.env.RESERVOIR_API_KEY },
        timeout: 10000,
      });

      return response.data?.volumes?.map((item: any) => ({
        timestamp: item.timestamp * 1000,
        volume: item.volume,
        sales: item.sales,
      })) || [];
    } catch (error) {
      console.error('Error fetching volume history:', error);
      return [];
    }
  }

  async getHolderDistribution(collectionAddress: string): Promise<HolderDistribution[]> {
    return [
      { range: '1 NFT', count: 0, percentage: 0 },
      { range: '2-5 NFTs', count: 0, percentage: 0 },
      { range: '6-10 NFTs', count: 0, percentage: 0 },
      { range: '10+ NFTs', count: 0, percentage: 0 },
    ];
  }

  async getFullAnalytics(collectionAddress: string): Promise<CollectionAnalytics | null> {
    const [stats, floorHistory, volumeHistory, holderDistribution] = await Promise.all([
      this.getCollectionStats(collectionAddress),
      this.getFloorPriceHistory(collectionAddress, 7),
      this.getVolumeHistory(collectionAddress, 7),
      this.getHolderDistribution(collectionAddress),
    ]);

    if (!stats) return null;

    return {
      stats,
      floorHistory,
      volumeHistory,
      holderDistribution,
    };
  }

  async compareCollections(addresses: string[]): Promise<CollectionStats[]> {
    const results = await Promise.all(
      addresses.map(addr => this.getCollectionStats(addr))
    );

    return results.filter((r): r is CollectionStats => r !== null);
  }

  getTrendingCollections(limit: number = 10): Promise<CollectionStats[]> {
    return Promise.resolve([]);
  }

  clearCache(): void {
    this.cache.clear();
  }

  setCacheTTL(ttlMs: number): void {
    this.cacheTTL = ttlMs;
  }
}
