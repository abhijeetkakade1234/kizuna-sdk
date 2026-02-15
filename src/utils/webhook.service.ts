import axios from 'axios';

export type WebhookEvent = 
  | 'trade.executed'
  | 'trade.failed'
  | 'nft.purchased'
  | 'nft.sold'
  | 'price.alert'
  | 'balance.changed'
  | 'autobuy.triggered'
  | 'error';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: number;
  data: any;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  enabled: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
}

export interface WebhookSubscription {
  id: string;
  event: WebhookEvent;
  callback: (payload: WebhookPayload) => void;
}

export class WebhookService {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private subscriptions: WebhookSubscription[] = [];
  private retryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
  };

  addWebhook(id: string, config: Partial<WebhookConfig> = {}): void {
    this.webhooks.set(id, {
      url: config.url || '',
      secret: config.secret,
      enabled: config.enabled ?? true,
      retryOnFailure: config.retryOnFailure ?? true,
      maxRetries: config.maxRetries ?? 3,
    });
  }

  removeWebhook(id: string): boolean {
    return this.webhooks.delete(id);
  }

  getWebhook(id: string): WebhookConfig | undefined {
    return this.webhooks.get(id);
  }

  getAllWebhooks(): Map<string, WebhookConfig> {
    return new Map(this.webhooks);
  }

  updateWebhook(id: string, updates: Partial<WebhookConfig>): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) return false;

    this.webhooks.set(id, { ...webhook, ...updates });
    return true;
  }

  subscribe(event: WebhookEvent, callback: (payload: WebhookPayload) => void): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.subscriptions.push({ id, event, callback });
    return id;
  }

  unsubscribe(id: string): boolean {
    const index = this.subscriptions.findIndex(s => s.id === id);
    if (index > -1) {
      this.subscriptions.splice(index, 1);
      return true;
    }
    return false;
  }

  async emit(event: WebhookEvent, data: any): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: Date.now(),
      data,
    };

    const relevantSubs = this.subscriptions.filter(s => s.event === event);
    relevantSubs.forEach(sub => {
      try {
        sub.callback(payload);
      } catch (error) {
        console.error(`Error in webhook subscription ${sub.id}:`, error);
      }
    });

    for (const [id, config] of this.webhooks.entries()) {
      if (!config.enabled) continue;

      try {
        await this.sendToWebhook(config, payload);
      } catch (error) {
        console.error(`Error sending webhook ${id}:`, error);
        
        if (config.retryOnFailure) {
          await this.retryWebhook(id, config, payload);
        }
      }
    }
  }

  private async sendToWebhook(config: WebhookConfig, payload: WebhookPayload): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.secret) {
      headers['X-Webhook-Secret'] = config.secret;
    }

    await axios.post(config.url, payload, {
      headers,
      timeout: 10000,
    });
  }

  private async retryWebhook(id: string, config: WebhookConfig, payload: WebhookPayload): Promise<void> {
    for (let i = 0; i < config.maxRetries; i++) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.retryConfig.retryDelay * (i + 1)));
        await this.sendToWebhook(config, payload);
        console.log(`Webhook ${id} succeeded after ${i + 1} retries`);
        return;
      } catch (error) {
        console.log(`Webhook ${id} retry ${i + 1} failed`);
      }
    }
    console.error(`Webhook ${id} failed after ${config.maxRetries} retries`);
  }

  async sendDiscordWebhook(webhookUrl: string, message: { content?: string; embeds?: any[] }): Promise<boolean> {
    try {
      await axios.post(webhookUrl, {
        ...message,
        username: 'KizunaSDK',
        avatar_url: 'https://example.com/logo.png',
      });
      return true;
    } catch (error) {
      console.error('Discord webhook error:', error);
      return false;
    }
  }

  async sendTelegramWebhook(botToken: string, chatId: string, message: string): Promise<boolean> {
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      });
      return true;
    } catch (error) {
      console.error('Telegram webhook error:', error);
      return false;
    }
  }

  formatTradeNotification(
    type: 'buy' | 'sell',
    collection: string,
    tokenId: string,
    price: string,
    txHash: string
  ): { content: string; embed: any } {
    const action = type === 'buy' ? '🟢 Bought' : '🔴 Sold';
    const content = `${action} NFT\nCollection: ${collection}\nToken: ${tokenId}\nPrice: ${price}\nTx: ${txHash}`;
    
    const embed = {
      title: `${action} NFT`,
      fields: [
        { name: 'Collection', value: collection, inline: false },
        { name: 'Token ID', value: tokenId, inline: true },
        { name: 'Price', value: price, inline: true },
        { name: 'Transaction', value: `[View on Explorer](https://snowtrace.io/tx/${txHash})`, inline: false },
      ],
      timestamp: new Date().toISOString(),
    };

    return { content, embed };
  }

  formatErrorNotification(error: Error, context?: string): { content: string; embed: any } {
    const content = `⚠️ Error in KizunaSDK${context ? ` (${context})` : ''}`;
    
    const embed = {
      title: '⚠️ Error Alert',
      fields: [
        { name: 'Error', value: error.message.substring(0, 500), inline: false },
        ...(context ? [{ name: 'Context', value: context, inline: false }] : []),
        { name: 'Time', value: new Date().toISOString(), inline: false },
      ],
      color: 16711680,
    };

    return { content, embed };
  }

  formatPriceAlert(collection: string, currentPrice: string, targetPrice: string, condition: string): { content: string; embed: any } {
    const content = `🔔 Price Alert: ${collection}`;
    
    const embed = {
      title: '🔔 Price Alert',
      fields: [
        { name: 'Collection', value: collection, inline: false },
        { name: 'Current Price', value: currentPrice, inline: true },
        { name: 'Target Price', value: targetPrice, inline: true },
        { name: 'Condition', value: condition, inline: false },
      ],
      timestamp: new Date().toISOString(),
      color: 65280,
    };

    return { content, embed };
  }
}
