// src/services/execution/swap-executor-dev.js
import { Jupiter, RouteInfo, TOKEN_LIST_URL } from '@jup-ag/core';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';

export class SwapExecutorDev {
  constructor(connection, walletManager) {
    this.connection = connection;
    this.walletManager = walletManager;
    this.jupiter = null;
  }

  async initialize() {
    // Wykorzystanie najnowszych funkcji Jupiter API
    this.jupiter = await Jupiter.load({
      connection: this.connection,
      userPublicKey: this.walletManager.getPublicKey(),
      // Obsługa nowych DEXów dostępnych w Dev Beta
      // Może wymagać aktualizacji listy tokenów lub routera
    });
  }

  async executeSwap(inputToken, outputToken, amount, slippage = 1) {
    if (!this.jupiter) {
      await this.initialize();
    }

    try {
      const routes = await this.jupiter.computeRoutes({
        inputMint: inputToken,
        outputMint: outputToken,
        inputAmount: amount,
        slippage: slippage,
      });

      if (routes.routesInfos.length === 0) {
        return { success: false, error: "No routes found." };
      }

      const { routeInfo } = routes.routesInfos[0]; // We take the best route

      // Lepsze zarządzanie slippage i priorytetami
      const { swapTransaction, execute } = await this.jupiter.exchange({
        routeInfo,
      });

      // Podpisanie transakcji
      const signedTx = this.walletManager.signTransaction(swapTransaction);
      
      // Wysłanie transakcji z opcjonalnym priorytetem (dla MEV)
      const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });

      console.log(`Swap executed. TX: ${signature}`);
      return { success: true, signature };

    } catch (error) {
      console.error("Swap execution failed:", error);
      return { success: false, error: error.message };
    }
  }
}