// src/strategies/sniper-dev.js
import { BaseStrategy } from './base-strategy.js';
import { PublicKey } from '@solana/web3.js';

export class SniperDevStrategy extends BaseStrategy {
  constructor(walletManager, swapExecutor, notifier, dataFeed, config) {
    super(walletManager, swapExecutor, notifier);
    this.dataFeed = dataFeed;
    this.config = config;
  }

  async initialize() {
    console.log("Initializing Sniper Dev Strategy...");
    // Wykorzystanie gRPC do szybszego wykrywania nowych tokenów
    this.dataFeed.onNewPool((poolInfo) => {
      if (this.isRunning && this.filterPool(poolInfo)) {
        console.log(`New potential pool found: ${poolInfo.address}`);
        this.execute(poolInfo);
      }
    });
    this.isRunning = true;
  }

  filterPool(poolInfo) {
    // Lepsze filtry dla pooli (zgodne z Dev Beta specs)
    return poolInfo.liquidity >= this.config.minLiquidity;
  }

  async execute(poolInfo) {
    console.log(`Executing sniper strategy on pool: ${poolInfo.address}`);
    try {
      // Przykład: kup 0.01 SOL nowego tokenu
      const inputToken = new PublicKey("So11111111111111111111111111111111111111112"); // WSOL
      const outputToken = new PublicKey(poolInfo.tokenMintAddress);
      const amount = 0.01 * LAMPORTS_PER_SOL;
      
      const result = await this.swapExecutor.executeSwap(inputToken, outputToken, amount);
      
      if (result.success) {
        this.notifier.send(`Sniper success! Bought token. TX: ${result.signature}`);
      } else {
        this.notifier.send(`Sniper failed. Reason: ${result.error}`);
      }
    } catch (error) {
      console.error("Sniper strategy execution failed:", error);
    }
  }
}