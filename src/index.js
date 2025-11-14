// src/index.js

import 'dotenv/config';

import { config } from '../config/devnet.config.js';
import { Connection } from '@solana/web3.js';
import { WalletManager } from './core/wallet-manager.js';
import { Logger } from './utils/logger.js';

async function main() {
  Logger.info("Starting Solana Dev Beta Bot...");

  const connection = new Connection(config.rpc.http);
  Logger.info(`Connected to Solana ${config.network}`);

  try {
    const walletManager = new WalletManager(connection, config.wallet.privateKey);
    const balance = await walletManager.getBalance();
    Logger.info(`Wallet loaded. Public Key: ${walletManager.getPublicKey().toBase58()}`);
    Logger.info(`Current SOL balance: ${balance}`);

    Logger.info("Bot is running. Press Ctrl+C to stop.");

    // Tutaj w przyszłości zainicjujemy strategie
    // const strategy = new SniperDevStrategy(...);
    // await strategy.initialize();

  } catch (error) {
    Logger.error("Failed to start the bot.", error);
    process.exit(1);
  }
}

main();