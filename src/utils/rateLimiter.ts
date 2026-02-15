export interface RateLimiterConfig {
  maxRequests: number;
  timeWindowMs: number;
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  async acquire(key: string = 'default'): Promise<boolean> {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    
    const validTimestamps = timestamps.filter(
      ts => now - ts < this.config.timeWindowMs
    );
    
    if (validTimestamps.length >= this.config.maxRequests) {
      const oldestTimestamp = validTimestamps[0];
      const waitTime = this.config.timeWindowMs - (now - oldestTimestamp);
      
      if (waitTime > 0) {
        await this.sleep(waitTime);
        return this.acquire(key);
      }
    }
    
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    
    return true;
  }

  tryAcquire(key: string = 'default'): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    
    const validTimestamps = timestamps.filter(
      ts => now - ts < this.config.timeWindowMs
    );
    
    if (validTimestamps.length >= this.config.maxRequests) {
      return false;
    }
    
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }

  getWaitTime(key: string = 'default'): number {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter(
      ts => now - ts < this.config.timeWindowMs
    );

    if (validTimestamps.length >= this.config.maxRequests) {
      const oldestTimestamp = validTimestamps[0];
      return this.config.timeWindowMs - (now - oldestTimestamp);
    }

    return 0;
  }

  getConfig(): RateLimiterConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export interface UserRateLimitConfig {
  openSea?: {
    maxRequests?: number;
    timeWindowMs?: number;
  };
  blur?: {
    maxRequests?: number;
    timeWindowMs?: number;
  };
  tensor?: {
    maxRequests?: number;
    timeWindowMs?: number;
  };
  rpc?: {
    maxRequests?: number;
    timeWindowMs?: number;
  };
  dexScreener?: {
    maxRequests?: number;
    timeWindowMs?: number;
  };
}

const DEFAULT_CONFIGS: UserRateLimitConfig = {
  openSea: { maxRequests: 2, timeWindowMs: 1000 },
  blur: { maxRequests: 5, timeWindowMs: 1000 },
  tensor: { maxRequests: 3, timeWindowMs: 1000 },
  rpc: { maxRequests: 10, timeWindowMs: 1000 },
  dexScreener: { maxRequests: 10, timeWindowMs: 1000 },
};

export class UserRateLimiterManager {
  private limiters: Map<string, RateLimiter> = new Map();
  private userConfig: UserRateLimitConfig;

  constructor(userConfig?: UserRateLimitConfig) {
    this.userConfig = { ...DEFAULT_CONFIGS, ...userConfig };
    this.initializeLimiters();
  }

  private initializeLimiters(): void {
    Object.entries(this.userConfig).forEach(([key, config]) => {
      if (config) {
        this.limiters.set(
          key,
          new RateLimiter({
            maxRequests: config.maxRequests || 10,
            timeWindowMs: config.timeWindowMs || 1000,
          })
        );
      }
    });
  }

  async acquire(service: string, key: string = 'default'): Promise<boolean> {
    const limiter = this.limiters.get(service);
    if (!limiter) {
      return true;
    }
    return limiter.acquire(key);
  }

  tryAcquire(service: string, key: string = 'default'): boolean {
    const limiter = this.limiters.get(service);
    if (!limiter) {
      return true;
    }
    return limiter.tryAcquire(key);
  }

  getWaitTime(service: string, key: string = 'default'): number {
    const limiter = this.limiters.get(service);
    if (!limiter) {
      return 0;
    }
    return limiter.getWaitTime(key);
  }

  updateConfig(service: string, config: { maxRequests?: number; timeWindowMs?: number }): void {
    const limiter = this.limiters.get(service);
    if (limiter) {
      limiter.updateConfig(config);
    }
  }

  reset(service?: string): void {
    if (service) {
      const limiter = this.limiters.get(service);
      if (limiter) {
        limiter.reset();
      }
    } else {
      this.limiters.forEach(limiter => limiter.reset());
    }
  }

  getConfig(service: string): RateLimiterConfig | null {
    const limiter = this.limiters.get(service);
    return limiter?.getConfig() || null;
  }

  getAllConfigs(): Record<string, RateLimiterConfig> {
    const configs: Record<string, RateLimiterConfig> = {};
    this.limiters.forEach((limiter, key) => {
      configs[key] = limiter.getConfig();
    });
    return configs;
  }
}

export const createRateLimiter = (maxRequests: number, timeWindowSeconds: number): RateLimiter => {
  return new RateLimiter({
    maxRequests,
    timeWindowMs: timeWindowSeconds * 1000,
  });
};

export const createUserRateLimiterManager = (config?: UserRateLimitConfig): UserRateLimiterManager => {
  return new UserRateLimiterManager(config);
};
