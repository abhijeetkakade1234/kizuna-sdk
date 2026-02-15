declare module '../agentkit-core/dist/index.js' {
  export class Agentkit {
    static configureWithWallet(config: any): Promise<Agentkit>;
    getAddress(): Promise<string>;
    run(action: any, args: any): Promise<string>;
  }
}

declare module '../agentkit-core/dist/actions/getAddressAction.js' {
  export class GetAddressAction {
    name: string;
    description: string;
    func: any;
  }
}

declare module '../agentkit-core/dist/actions/getBalanceAction.js' {
  export class GetBalanceAction {
    name: string;
    description: string;
    func: any;
  }
}

declare module '../agentkit-core/dist/actions/smartTransferAction.js' {
  export class SmartTransferAction {
    name: string;
    description: string;
    func: any;
  }
}

declare module '../agentkit-core/dist/actions/DebridgeAction/swap.js' {
  export class SmartSwapAction {
    name: string;
    description: string;
    func: any;
  }
}

declare module '../agentkit-core/dist/BaseActions/SendTransaction.js' {
  export class SendTransactionAction {
    name: string;
    description: string;
    func: any;
  }
}
