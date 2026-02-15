import { KizunaClient, SUPPORTED_NETWORKS } from '../src/index.js';

const COLLECTION = '0x65559019d93C317CC3f237a19D4a67B5B22f5E8';

async function clawbotExample() {
  console.log('🤖 ClawBot + KizunaSDK Example\n');
  console.log('='.repeat(50));

  const client = new KizunaClient({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    rpcUrl: SUPPORTED_NETWORKS[43113].rpcUrl,
    apiKey: process.env.GASLESS_API_KEY!,
    chainId: 43113,
  });

  await client.initialize();

  console.log('✅ Wallet initialized');
  console.log('📍 Address:', client.walletService.getAddress());

  const balance = await client.walletService.getBalance(['AVAX', 'USDC']);
  console.log('💰 Balance:', balance.balance);

  console.log('\n--- NFT Market Data (for ClawBot AI) ---\n');

  const floorPrice = await client.nftService.getFloorPriceWithRateLimit(COLLECTION);
  console.log('📊 Floor Price:', floorPrice || 'N/A');

  const marketData = await client.agentService.getMarketData(COLLECTION);
  console.log('📈 24h Volume:', marketData?.volume24h || 'N/A');
  console.log('👥 Holders:', marketData?.holders || 'N/A');
  console.log('🎯 Potential:', marketData?.potential || 'N/A');

  console.log('\n--- ClawBot AI Decision ---\n');

  const analysis = await client.agentService.analyzeCollection(COLLECTION);
  console.log('🤖 AI Analysis from ClawBot:');
  console.log('   Recommendation:', analysis.recommendation);
  console.log('   Confidence:', (analysis.confidence * 100).toFixed(0) + '%');
  console.log('   Reasoning:', analysis.reasoning);

  console.log('\n--- Transaction History ---\n');

  const txs = await client.historyService.getTransactions(
    client.walletService.getAddress(),
    { limit: 5 }
  );
  console.log(`📜 Last ${txs.length} transactions:`);
  txs.forEach((tx, i) => {
    console.log(`   ${i + 1}. ${tx.hash.slice(0, 10)}... - ${tx.status}`);
  });

  console.log('\n--- Gas Estimation ---\n');

  const gas = await client.contractService.estimateGas(
    '0xRecipient...',
    '0x',
    '0.01'
  );
  console.log('⛽ Estimated Gas:', gas?.estimatedCost, gas?.nativeToken);

  console.log('\n--- Bridge Info ---\n');

  const chains = await client.bridgeService.getSupportedChains();
  console.log('🌉 Supported Chains:', chains.map(c => c.name).join(', '));

  const bridgeEstimate = await client.bridgeService.estimateBridge(
    43114,
    1,
    'AVAX',
    '1'
  );
  console.log('💱 Bridge Estimate:', bridgeEstimate);

  console.log('\n--- Price Alert ---\n');

  const alert = client.alertService.createAlert(COLLECTION, '2.0', 'above');
  console.log('🔔 Alert set:', alert.id);

  client.alertService.onAlertTriggered(alert.id, (alert, price) => {
    console.log(`🚀 PRICE ALERT: ${COLLECTION} reached ${price}!`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('✅ ClawBot can now make autonomous decisions!');
  console.log('\nThe SDK provides DATA, ClawBot provides INTELLIGENCE.');

  await client.disconnect();
}

clawbotExample().catch(console.error);
