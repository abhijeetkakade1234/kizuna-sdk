export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  shouldRetry?: (error: any) => boolean;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    if (error?.response?.status === 429) return true;
    if (error?.code === 'ECONNREFUSED') return true;
    if (error?.code === 'ETIMEDOUT') return true;
    return false;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === opts.maxRetries) {
        break;
      }

      const shouldRetry = opts.shouldRetry?.(error) ?? true;
      if (!shouldRetry) {
        throw error;
      }

      console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`);
      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class KizunaError extends Error {
  code: string;
  statusCode?: number;
  retryable: boolean;

  constructor(message: string, code: string, statusCode?: number, retryable: boolean = false) {
    super(message);
    this.name = 'KizunaError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export const ErrorCodes = {
  WALLET_NOT_INITIALIZED: 'WALLET_NOT_INITIALIZED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  NFT_NOT_FOUND: 'NFT_NOT_FOUND',
  PRICE_FETCH_FAILED: 'PRICE_FETCH_FAILED',
} as const;

export function isRetryable(error: any): boolean {
  if (error?.retryable) return true;
  if (error?.statusCode === 429) return true;
  if (error?.statusCode >= 500) return true;
  if (error?.code === 'ETIMEDOUT') return true;
  if (error?.code === 'ECONNREFUSED') return true;
  return false;
}
