import { PriceAlert } from '../types.js';

export type AlertCallback = (alert: PriceAlert, currentPrice: string) => void;

export class AlertService {
  private alerts: Map<string, PriceAlert> = new Map();
  private callbacks: Map<string, AlertCallback[]> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;

  createAlert(
    collectionAddress: string,
    targetPrice: string,
    condition: 'above' | 'below'
  ): PriceAlert {
    const alert: PriceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      collectionAddress,
      targetPrice,
      condition,
      active: true,
      createdAt: Date.now(),
    };

    this.alerts.set(alert.id, alert);
    return alert;
  }

  getAlerts(collectionAddress?: string): PriceAlert[] {
    const allAlerts = Array.from(this.alerts.values());
    if (collectionAddress) {
      return allAlerts.filter(a => a.collectionAddress === collectionAddress);
    }
    return allAlerts;
  }

  getActiveAlerts(collectionAddress?: string): PriceAlert[] {
    return this.getAlerts(collectionAddress).filter(a => a.active);
  }

  removeAlert(alertId: string): boolean {
    return this.alerts.delete(alertId);
  }

  toggleAlert(alertId: string, active: boolean): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.active = active;
      this.alerts.set(alertId, alert);
      return true;
    }
    return false;
  }

  onAlertTriggered(alertId: string, callback: AlertCallback): void {
    const callbacks = this.callbacks.get(alertId) || [];
    callbacks.push(callback);
    this.callbacks.set(alertId, callbacks);
  }

  removeCallback(alertId: string, callback: AlertCallback): void {
    const callbacks = this.callbacks.get(alertId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  async checkAlerts(currentPrices: Map<string, string>): Promise<PriceAlert[]> {
    const triggered: PriceAlert[] = [];

    for (const alert of this.getActiveAlerts()) {
      const currentPrice = currentPrices.get(alert.collectionAddress);
      if (!currentPrice) continue;

      const current = parseFloat(currentPrice);
      const target = parseFloat(alert.targetPrice);
      const shouldTrigger =
        (alert.condition === 'above' && current >= target) ||
        (alert.condition === 'below' && current <= target);

      if (shouldTrigger) {
        triggered.push(alert);
        const callbacks = this.callbacks.get(alert.id) || [];
        callbacks.forEach(cb => cb(alert, currentPrice));
      }
    }

    return triggered;
  }

  startMonitoring(
    getPrices: () => Promise<Map<string, string>>,
    intervalMs: number = 60000
  ): void {
    if (this.monitorInterval) {
      return;
    }

    this.monitorInterval = setInterval(async () => {
      try {
        const prices = await getPrices();
        await this.checkAlerts(prices);
      } catch (error) {
        console.error('Alert monitoring error:', error);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  clearAllAlerts(): void {
    this.alerts.clear();
    this.callbacks.clear();
  }
}
