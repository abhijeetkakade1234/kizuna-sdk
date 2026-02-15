export type EventType = 
  | 'transaction.pending'
  | 'transaction.confirmed'
  | 'transaction.failed'
  | 'balance.changed'
  | 'price.alert'
  | 'nft.bought'
  | 'nft.sold'
  | 'error';

export interface SDKEvent {
  type: EventType;
  timestamp: number;
  data: any;
}

export type EventCallback = (event: SDKEvent) => void;

export class EventEmitter {
  private listeners: Map<EventType, EventCallback[]> = new Map();
  private allListeners: EventCallback[] = [];

  on(event: EventType, callback: EventCallback): void {
    const listeners = this.listeners.get(event) || [];
    listeners.push(callback);
    this.listeners.set(event, listeners);
  }

  once(event: EventType, callback: EventCallback): void {
    const wrapper: EventCallback = (e) => {
      callback(e);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  off(event: EventType, callback: EventCallback): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  onAny(callback: EventCallback): void {
    this.allListeners.push(callback);
  }

  emit(type: EventType, data: any): void {
    const event: SDKEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    const listeners = this.listeners.get(type) || [];
    listeners.forEach(cb => cb(event));

    this.allListeners.forEach(cb => cb(event));
  }

  removeAllListeners(event?: EventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
      this.allListeners = [];
    }
  }

  listenerCount(event?: EventType): number {
    if (event) {
      return (this.listeners.get(event) || []).length;
    }
    return this.listeners.size + this.allListeners.length;
  }
}

export const globalEventEmitter = new EventEmitter();
