import { KizunaClient, SUPPORTED_NETWORKS } from './src/index.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function testSDK() {
    console.log('🚀 Testing Kizuna SDK...');

    // Configuration for Avalanche Fuji Testnet
    const config = {
        privateKey: (process.env.PRIVATE_KEY || '0x...') as `0x${string}`,
        rpcUrl: process.env.RPC_URL || SUPPORTED_NETWORKS[43113].rpcUrl,
        apiKey: process.env.GASLESS_API_KEY || 'test-api-key',
        chainId: 43113, // Avalanche Fuji
    };

    const client = new KizunaClient(config);

    try {
        await client.initialize();

        const address = client.walletService.getAddress();
        if (address === '0x0000000000000000000000000000000000000000') {
            console.warn('⚠️ SDK is in STUB mode (Missing Private Key or API Key)');
            console.log('📝 To test for real, please add PRIVATE_KEY and GASLESS_API_KEY to a .env file.');
        } else {
            console.log('✅ SDK Initialized Successfully!');
        }

        console.log('📍 Wallet Address:', address);

        console.log('⏳ Fetching balance...');
        const balance = await client.walletService.getBalance();
        console.log('💰 Wallet Balance result:', balance.balance);

        console.log('✨ Verification process completed!');
    } catch (error) {
        console.error('❌ SDK Verification Failed:', error);
    } finally {
        await client.disconnect();
    }
}

testSDK();
