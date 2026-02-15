# KizunaSDK for ClawBot

**A guide for ClawBot to use KizunaSDK**

---

## How It Works

### The Problem
- User doesn't want to give ClawBot their crypto wallet
- But still wants ClawBot to trade NFTs

### The Solution
- User creates a wallet via KizunaSDK
- Funds that wallet with some crypto
- ClawBot trades using that wallet
- User's main wallet is never exposed to ClawBot

```
User's Main Wallet (never given to ClawBot)
        │
        │ Funds
        ▼
┌─────────────────────────────┐
│   KizunaSDK Wallet         │
│   (ClawBot uses this)      │
└─────────────────────────────┘
        │
        │ Trades
        ▼
┌─────────────────────────────┐
│      NFT Marketplace       │
└─────────────────────────────┘
```

---

## Setup for ClawBot Owners

### Step 1: Create Trading Wallet
```typescript
const wallet = client.multiWalletService.createWallet(config, 'ClawBot Trading');
await client.multiWalletService.initializeWallet(wallet.id);

console.log('Send crypto here:', wallet.address);
// User sends funds to this address
```

### Step 2: Give to ClawBot
ClawBot now uses this wallet for trading. User's main wallet is safe.

---

## What ClawBot Can Do

### Check Wallet
```
User: "What's my trading wallet?"
ClawBot -> client.walletService.getAddress()
```

```
User: "How much is in my trading wallet?"
ClawBot -> client.walletService.getBalance()
```

### Trade NFTs
```
User: "Buy an NFT from 0xCollection under 0.5 AVAX"
ClawBot -> 
  1. Find listing
  2. Buy using SDK wallet
  3. User's main wallet never touched
```

### Auto-Buy
```
User: "Alert me and buy if 0xCollection drops to 0.3 AVAX"
ClawBot ->
  client.autoBuyService.createPosition({
    collectionAddress: '0xCollection',
    maxPrice: '0.3',
  })
  client.autoBuyService.start()
```

---

## What ClawBot CANNOT Do

| Action | Allowed? |
|--------|-----------|
| Access user's main wallet | ❌ |
| Withdraw to external address | ❌ (only trading) |
| See user's private key | ❌ |
| Drain all funds | ❌ |

---

## Security Model

```
┌────────────────────────────────────────────────────────┐
│                     User                                │
│  • Has main wallet with all funds                     │
│  • Creates trading wallet via SDK                      │
│  • Funds trading wallet with some crypto              │
└────────────────────────────────────────────────────────┘
                           │
                           │ Funds only what they want traded
                           ▼
┌────────────────────────────────────────────────────────┐
│              KizunaSDK Wallet                          │
│  • Created by user                                   │
│  • Controlled by SDK                                 │
│  • ClawBot can ONLY trade with this                  │
└────────────────────────────────────────────────────────┘
                           │
                           │ Trading only
                           ▼
┌────────────────────────────────────────────────────────┐
│                    ClawBot                            │
│  • Can check balance                                 │
│  • Can buy/sell NFTs                                │
│  • CANNOT access main wallet                        │
│  • CANNOT withdraw to other addresses               │
└────────────────────────────────────────────────────────┘
```

---

## ClawBot Commands

```javascript
// Initialize SDK with user's wallet (just to create trading wallet)
const { KizunaClient } = require('kizuna-sdk');

const client = new KizunaClient({
  privateKey: process.env.USER_PRIVATE_KEY, // To create wallet
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  apiKey: process.env.GASLESS_API_KEY,
  chainId: 43113,
});

// Create a trading wallet for ClawBot
const tradingWallet = client.multiWalletService.createWallet({
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  apiKey: process.env.GASLESS_API_KEY,
  chainId: 43113,
}, 'ClawBot Trading');

console.log('Send AVAX to:', tradingWallet.address);
// User funds this wallet

// Now ClawBot can trade
await client.walletService.transfer(seller, price, 'avax');
```

---

## Example Conversations

### User asks about wallet
```
User: "What's my trading wallet address?"
ClawBot: "Your trading wallet is: 0xABC...XYZ
          (This is different from your main wallet)"
```

### User asks to buy
```
User: "Buy an NFT from OnlyPngs under 1 AVAX"
ClawBot: "Looking for listings... Found one at 0.8 AVAX
          Purchasing now..."
```

### User checks balance
```
User: "How much is in my trading wallet?"
ClawBot: "Your trading wallet has 5.2 AVAX"
```

---

## Summary

| User Gives ClawBot | ClawBot Gets |
|-------------------|--------------|
| Nothing | Trading wallet created by SDK |
| Private key of main wallet | ❌ (never) |
| Funds to trading wallet | ✅ |

**ClawBot trades using SDK wallet. User's main funds stay safe.**
