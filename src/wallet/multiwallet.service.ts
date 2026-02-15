import { WalletService, SUPPORTED_NETWORKS } from '../wallet/wallet.service.js';
import { WalletConfig, ChainConfig } from '../types.js';

export interface ManagedWallet {
  id: string;
  name: string;
  address: string;
  chainId: number;
  privateKey?: string;
  createdAt: number;
  lastUsed?: number;
}

export interface WalletGroup {
  id: string;
  name: string;
  wallets: ManagedWallet[];
}

export class MultiWalletService {
  private wallets: Map<string, WalletService> = new Map();
  private managedWallets: Map<string, ManagedWallet> = new Map();
  private groups: Map<string, WalletGroup> = new Map();
  private activeWalletId: string | null = null;

  createWallet(
    config: WalletConfig | ChainConfig,
    name?: string
  ): ManagedWallet {
    const id = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const wallet = new WalletService(config);

    const managedWallet: ManagedWallet = {
      id,
      name: name || `Wallet ${this.managedWallets.size + 1}`,
      address: '',
      chainId: config.chainId,
      privateKey: (config as WalletConfig).privateKey,
      createdAt: Date.now(),
    };

    this.wallets.set(id, wallet);
    this.managedWallets.set(id, managedWallet);

    return managedWallet;
  }

  async initializeWallet(id: string): Promise<void> {
    const wallet = this.wallets.get(id);
    const managed = this.managedWallets.get(id);

    if (!wallet || !managed) {
      throw new Error(`Wallet ${id} not found`);
    }

    await wallet.initialize();
    managed.address = wallet.getAddress();
    managed.lastUsed = Date.now();

    this.wallets.set(id, wallet);
    this.managedWallets.set(id, managed);
  }

  getWallet(id: string): WalletService | null {
    const wallet = this.wallets.get(id);
    if (wallet) {
      const managed = this.managedWallets.get(id);
      if (managed) {
        managed.lastUsed = Date.now();
        this.managedWallets.set(id, managed);
      }
    }
    return wallet || null;
  }

  getWalletByAddress(address: string): WalletService | null {
    for (const [id, managed] of this.managedWallets.entries()) {
      if (managed.address.toLowerCase() === address.toLowerCase()) {
        return this.wallets.get(id) || null;
      }
    }
    return null;
  }

  getManagedWallet(id: string): ManagedWallet | undefined {
    return this.managedWallets.get(id);
  }

  getAllWallets(): ManagedWallet[] {
    return Array.from(this.managedWallets.values());
  }

  removeWallet(id: string): boolean {
    this.wallets.delete(id);
    return this.managedWallets.delete(id);
  }

  setActiveWallet(id: string): boolean {
    const wallet = this.wallets.get(id);
    if (!wallet) return false;

    this.activeWalletId = id;
    const managed = this.managedWallets.get(id);
    if (managed) {
      managed.lastUsed = Date.now();
      this.managedWallets.set(id, managed);
    }
    return true;
  }

  getActiveWallet(): WalletService | null {
    if (!this.activeWalletId) return null;
    return this.wallets.get(this.activeWalletId) || null;
  }

  getActiveManagedWallet(): ManagedWallet | null {
    if (!this.activeWalletId) return null;
    return this.managedWallets.get(this.activeWalletId) || null;
  }

  createGroup(name: string): WalletGroup {
    const id = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const group: WalletGroup = {
      id,
      name,
      wallets: [],
    };

    this.groups.set(id, group);
    return group;
  }

  addWalletToGroup(groupId: string, walletId: string): boolean {
    const group = this.groups.get(groupId);
    const managed = this.managedWallets.get(walletId);

    if (!group || !managed) return false;

    if (!group.wallets.find(w => w.id === walletId)) {
      group.wallets.push(managed);
      this.groups.set(groupId, group);
    }
    return true;
  }

  removeWalletFromGroup(groupId: string, walletId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    group.wallets = group.wallets.filter(w => w.id !== walletId);
    this.groups.set(groupId, group);
    return true;
  }

  getGroup(id: string): WalletGroup | undefined {
    return this.groups.get(id);
  }

  getAllGroups(): WalletGroup[] {
    return Array.from(this.groups.values());
  }

  getWalletsByChain(chainId: number): ManagedWallet[] {
    return Array.from(this.managedWallets.values()).filter(w => w.chainId === chainId);
  }

  async getTotalBalance(): Promise<string> {
    let total = 0;
    for (const wallet of this.wallets.values()) {
      const balance = await wallet.getBalance();
      total += parseFloat(balance.balance || '0');
    }
    return total.toString();
  }

  async broadcastToAll(walletIds: string[], tx: {
    to: string;
    value?: string;
    data?: string;
  }): Promise<Map<string, { success: boolean; hash?: string; error?: string }>> {
    const results = new Map<string, { success: boolean; hash?: string; error?: string }>();

    for (const id of walletIds) {
      const wallet = this.wallets.get(id);
      if (!wallet) {
        results.set(id, { success: false, error: 'Wallet not found' });
        continue;
      }

      try {
        const result = await wallet.sendTransaction(tx.to, tx.data, tx.value);
        results.set(id, { success: true, hash: result.hash });
      } catch (error: any) {
        results.set(id, { success: false, error: error.message });
      }
    }

    return results;
  }

  exportWallets(): ManagedWallet[] {
    return this.getAllWallets();
  }

  importWallet(managed: ManagedWallet, config: WalletConfig | ChainConfig): void {
    const wallet = new WalletService(config);
    this.wallets.set(managed.id, wallet);
    this.managedWallets.set(managed.id, managed);
  }

  clearAll(): void {
    this.wallets.clear();
    this.managedWallets.clear();
    this.groups.clear();
    this.activeWalletId = null;
  }
}
