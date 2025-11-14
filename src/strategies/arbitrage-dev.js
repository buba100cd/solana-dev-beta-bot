import { BaseStrategy } from './base-strategy.js';
import { Logger } from '../utils/logger.js';
import { SwapExecutorDev } from '../services/execution/swap-executor-dev.js';
import { FlashloanExecutor } from '../services/flashloan/flashloan-executor.js';
import { PriceService } from '../services/price/price-service.js';

export class ArbitrageDevStrategy extends BaseStrategy {
  constructor(walletManager, config) {
    super('arbitrage-dev', walletManager, config);
    this.logger = new Logger('ArbitrageDevStrategy');
    this.swapExecutor = new SwapExecutorDev(walletManager, config);
    this.flashloanExecutor = new FlashloanExecutor(walletManager, config);
    this.priceService = new PriceService(config);
    this.arbitrageConfig = this.config.strategies.arbitrage || {};
    this.priceCache = new Map();
    this.opportunityThreshold = this.arbitrageConfig.threshold || 0.3; // Obniżony próg domyślny
    // Konfiguracja dla małych kwot
    this.minProfitThreshold = this.config.network.rpcUrl.includes('mainnet') ? 0.3 : 0.3;
    this.maxTradeAmount = this.config.network.rpcUrl.includes('mainnet') ? 0.1 : 0.1; // 0.1 SOL dla startu
    this.useFlashloan = false; // Wyłączenie flashloanów dla małych kwot
    // Zähler für aufeinanderfolgende API-Fehler
    this.apiErrorCount = 0;
    this.maxApiErrors = 10; // Max. Anzahl aufeinanderfolgender Fehler
  }

  async initialize() {
    await super.initialize();
    await this.flashloanExecutor.initialize();
    this.logger.info('ArbitrageDev strategy initialized with flashloan support');
    // Inicjalizacja dla małych kwot
    if (this.config.network.rpcUrl.includes('mainnet')) {
      this.logger.info('Running on Mainnet with small amounts - using conservative settings');
      this.opportunityThreshold = this.minProfitThreshold;
    }
  }

  async start() {
    await super.start();
    this.logger.info('ArbitrageDev strategy started');

    // Start price monitoring with longer intervals to reduce API load
    this.priceMonitoringInterval = setInterval(() => this.monitorPrices(), 5000); // every 5 seconds (erhöht von 2)

    // Start arbitrage scanning with longer intervals to reduce API load
    this.arbitrageInterval = setInterval(() => this.scanForArbitrage(), 10000); // every 10 seconds (erhöht von 5)
  }

  async stop() {
    await super.stop();
    if (this.priceMonitoringInterval) {
      clearInterval(this.priceMonitoringInterval);
    }
    if (this.arbitrageInterval) {
      clearInterval(this.arbitrageInterval);
    }
    this.logger.info('ArbitrageDev strategy stopped');
  }

  async monitorPrices() {
    try {
      // Monitor prices across different DEXes
      const dexes = ['raydium', 'orca', 'jupiter'];
      const tokens = ['SOL', 'USDC', 'USDT', 'wBTC'];
      const baseTokens = ['USDC', 'USDT', 'SOL'];

      // Create promises for all price requests to run in parallel
      const pricePromises = [];
      
      for (const token of tokens) {
        for (const baseToken of baseTokens) {
          if (token === baseToken) continue;
          
          for (const dex of dexes) {
            // Create a promise for each price request
            pricePromises.push(
              this.priceService.getTokenPrice(token, dex)
                .then(price => ({ token, baseToken, dex, price }))
                .catch(error => {
                  this.logger.error(`Error getting price for ${token}/${baseToken} on ${dex}`, error);
                  // Zähler für API-Fehler erhöhen
                  this.apiErrorCount++;
                  if (this.apiErrorCount > this.maxApiErrors) {
                    this.logger.warn(`Too many consecutive API errors (${this.apiErrorCount}), consider checking network connection`);
                  }
                  return { token, baseToken, dex, price: null };
                })
            );
          }
        }
      }

      // Wait for all price requests to complete
      const results = await Promise.all(pricePromises);
      
      // Process results
      for (const { token, baseToken, dex, price } of results) {
        if (price) {
          // Update cache with token_baseToken_dex structure
          const key = `${token}_${baseToken}_${dex}`;
          const previousPrice = this.priceCache.get(key);

          this.priceCache.set(key, {
            price,
            timestamp: Date.now(),
            previousPrice
          });

          // Log significant price changes
          if (previousPrice && Math.abs(price - previousPrice.price) / previousPrice.price > 0.01) {
            this.logger.info(`Price change: ${token}/${baseToken} on ${dex}: $${price.toFixed(4)} (${((price - previousPrice.price) / previousPrice.price * 100).toFixed(2)}%)`);
          }
          
          // Zurücksetzen des Fehlerzählers bei erfolgreicher Abfrage
          this.apiErrorCount = 0;
        }
      }
    } catch (error) {
      this.logger.error('Error monitoring prices', error);
    }
  }

  // getTokenPrice method removed as it's now handled by PriceService

  // updatePriceCache method removed as it's now handled in monitorPrices

  async scanForArbitrage() {
    try {
      const opportunities = this.findArbitrageOpportunities();

      for (const opportunity of opportunities) {
        // Dla małych kwot bardziej liberalne podejście
        if (opportunity.spread > this.minProfitThreshold) {
          if (await this.isOpportunityProfitable(opportunity)) {
            await this.executeArbitrage(opportunity);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error scanning for arbitrage', error);
    }
  }

  findArbitrageOpportunities() {
    const opportunities = [];
    const tokens = ['SOL', 'USDC', 'USDT', 'wBTC'];
    const baseTokens = ['USDC', 'USDT', 'SOL'];

    // Check all token pairs
    for (const token of tokens) {
      for (const baseToken of baseTokens) {
        if (token === baseToken) continue;
        
        const dexPrices = this.getDexPricesForTokenPair(token, baseToken);

        if (dexPrices.length >= 2) {
          // Find best buy and sell prices
          const bestBuy = dexPrices.reduce((min, p) => p.price < min.price ? p : min);
          const bestSell = dexPrices.reduce((max, p) => p.price > max.price ? p : max);

          const spread = (bestSell.price - bestBuy.price) / bestBuy.price * 100;

          if (spread > this.opportunityThreshold) {
            opportunities.push({
              token,
              baseToken,
              buyDex: bestBuy.dex,
              sellDex: bestSell.dex,
              buyPrice: bestBuy.price,
              sellPrice: bestSell.price,
              spread,
              estimatedProfit: spread - 0.2 // Zmniejszone opłaty dla małych kwot
            });
          }
        }
      }
    }

    // Sort opportunities by spread (highest first) and limit to top 5
    opportunities.sort((a, b) => b.spread - a.spread);
    return opportunities.slice(0, 5);
  }

  getDexPricesForTokenPair(token, baseToken) {
    const dexes = ['raydium', 'orca', 'jupiter'];
    const prices = [];

    for (const dex of dexes) {
      // Price is stored as token_baseToken_dex
      const cacheKey = `${token}_${baseToken}_${dex}`;
      const cached = this.priceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 10000) { // Within 10 seconds
        prices.push({
          dex,
          price: cached.price
        });
      }
    }

    return prices;
  }

  async isOpportunityProfitable(opportunity) {
    // Check if opportunity is still valid and profitable
    const currentBuyPrice = this.priceCache.get(`${opportunity.token}_${opportunity.baseToken}_${opportunity.buyDex}`)?.price;
    const currentSellPrice = this.priceCache.get(`${opportunity.token}_${opportunity.baseToken}_${opportunity.sellDex}`)?.price;

    if (!currentBuyPrice || !currentSellPrice) {
      return false;
    }

    const currentSpread = (currentSellPrice - currentBuyPrice) / currentBuyPrice * 100;
    const netProfit = currentSpread - 0.2; // Zmniejszone opłaty dla małych kwot

    // Dla małych kwot niższe wymagania dotyczące opłacalności
    const requiredProfit = this.minProfitThreshold;
    return netProfit > requiredProfit;
  }

  async validateOpportunity(opportunity) {
    // Additional validation to ensure opportunity is still valid
    try {
      // Check if the DEXes are still operational
      // This is a simplified check - in production you would check DEX status
      const dexes = ['raydium', 'orca', 'jupiter'];
      const buyDexOperational = dexes.includes(opportunity.buyDex);
      const sellDexOperational = dexes.includes(opportunity.sellDex);
      
      // Check if tokens are still supported
      const supportedTokens = ['SOL', 'USDC', 'USDT', 'wBTC'];
      const tokenSupported = supportedTokens.includes(opportunity.token);
      const baseTokenSupported = supportedTokens.includes(opportunity.baseToken);
      
      return buyDexOperational && sellDexOperational && tokenSupported && baseTokenSupported;
    } catch (error) {
      this.logger.error('Error validating arbitrage opportunity', error);
      return false;
    }
  }

  async executeArbitrage(opportunity) {
    try {
      // Validate opportunity before execution
      const isValid = await this.validateOpportunity(opportunity);
      if (!isValid) {
        this.logger.warn(`Arbitrage opportunity is no longer valid: ${opportunity.token}`);
        return;
      }

      this.logger.info(`Executing arbitrage: ${opportunity.token}/${opportunity.baseToken} - Buy: ${opportunity.buyDex} ($${opportunity.buyPrice.toFixed(4)}), Sell: ${opportunity.sellDex} ($${opportunity.sellPrice.toFixed(4)}), Spread: ${opportunity.spread.toFixed(2)}%`);

      // Dla małych kwot zawsze używamy bezpośredniego arbitrażu
      await this.executeDirectArbitrage(opportunity);

    } catch (error) {
      this.logger.error('Arbitrage execution failed', error);
    }
  }

  async executeDirectArbitrage(opportunity) {
    // Execute arbitrage without flashloan
    const amount = this.maxTradeAmount; // 0.1 SOL dla startu

    try {
      // Buy on cheaper DEX
      const buyResult = await this.swapExecutor.executeSwap({
        fromToken: opportunity.baseToken,
        toToken: opportunity.token,
        amount: amount,
        dex: opportunity.buyDex
      });

      if (!buyResult.success) {
        throw new Error(`Buy failed: ${buyResult.error}`);
      }

      // Sell on expensive DEX
      const sellResult = await this.swapExecutor.executeSwap({
        fromToken: opportunity.token,
        toToken: opportunity.baseToken,
        amount: amount,
        dex: opportunity.sellDex
      });

      if (!sellResult.success) {
        throw new Error(`Sell failed: ${sellResult.error}`);
      }

      this.logger.info('Direct arbitrage completed successfully');

    } catch (error) {
      this.logger.error('Direct arbitrage failed', error);
    }
  }

  async executeFlashloanArbitrage() {
    // Wykonanie arbitrażu z flashloanem dla większych kwot
    // Wyłączone dla małych kwot
    this.logger.info('Flashloan disabled for small amounts');
  }

  getArbitrageStats() {
    const opportunities = this.findArbitrageOpportunities();
    const monitoredTokens = new Set();
    const monitoredDexes = new Set();
    const monitoredPairs = new Set();
    
    // Extract unique tokens, dexes, and pairs from cache
    for (const key of this.priceCache.keys()) {
      const parts = key.split('_');
      if (parts.length >= 3) {
        monitoredTokens.add(parts[0]);
        monitoredTokens.add(parts[1]);
        monitoredDexes.add(parts[2]);
        monitoredPairs.add(`${parts[0]}/${parts[1]}`);
      }
    }
    
    return {
      activeOpportunities: opportunities.length,
      bestOpportunity: opportunities.length > 0 ? opportunities[0] : null,
      monitoredTokens: Array.from(monitoredTokens),
      monitoredDexes: Array.from(monitoredDexes),
      monitoredPairs: Array.from(monitoredPairs)
    };
  }
}