// scripts/manual-swap.js

import 'dotenv/config';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletManager } from '../src/core/wallet-manager.js';
import { SwapExecutorDev } from '../src/services/execution/swap-executor-dev.js';
import { config } from '../config/devnet.config.js';
import { Logger } from '../src/utils/logger.js';

async function performManualSwap() {
  Logger.info("=== Rozpoczynam ręczny test swapu ===");

  const connection = new Connection(config.rpc.http);
  const walletManager = new WalletManager(connection, config.wallet.privateKey);
  const swapExecutor = new SwapExecutorDev(connection, walletManager);

  try {
    // Inicjalizacja executora (wczytuje dane z Jupitera)
    Logger.info("Inicjalizuję Swap Executor...");
    await swapExecutor.initialize();
    Logger.info("Swap Executor zainicjalizowany pomyślnie.");

    // Definicja parametrów swapu
    const inputToken = new PublicKey("So11111111111111111111111111111111111111112"); // WSOL
    const outputToken = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC (Devnet)
    const swapAmount = 0.01; // Zamień 0.01 SOL
    const amountInLamports = swapAmount * LAMPORTS_PER_SOL;
    const slippage = 3; // 3% tolerancja na slippage

    Logger.info(`Planuję swap: ${swapAmount} SOL -> USDC`);
    Logger.info(`Kwota w lamports: ${amountInLamports}`);
    Logger.info(`Tolerancja slippage: ${slippage}%`);

    // Wykonanie swapu
    const result = await swapExecutor.executeSwap(inputToken, outputToken, amountInLamports, slippage);

    if (result.success) {
      Logger.info("✅ SWAP WYKONANY POMYŚLNIE!");
      Logger.info(`Link do transakcji: https://solscan.io/tx/${result.signature}?cluster=devnet`);
    } else {
      Logger.error("❌ SWAP NIE POWIÓDŁ SIĘ.");
      Logger.error(`Powód: ${result.error}`);
    }

  } catch (error) {
    Logger.error("Wystąpił krytyczny błąd podczas skryptu swapu.", error);
  }

  Logger.info("=== Zakończono test swapu ===");
}

// Uruchomienie funkcji
performManualSwap();
