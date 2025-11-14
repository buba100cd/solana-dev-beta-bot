// src/core/wallet-manager.js
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

export class WalletManager {
  constructor(connection, privateKeyString) {
    this.connection = connection;
    if (privateKeyString) {
      this.keypair = Keypair.fromSecretKey(bs58.decode(privateKeyString));
    } else {
      throw new Error("Private key not provided.");
    }
  }

  getPublicKey() {
    return this.keypair.publicKey;
  }

  async getBalance() {
    const balance = await this.connection.getBalance(this.keypair.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  async getTokenBalance(tokenMintAddress) {
    // Implementacja do sprawdzania salda tokenów
    // Wykorzystanie najnowszych funkcji API do odczytu kont tokenów
    console.log(`Checking balance for token: ${tokenMintAddress}`);
    // ... logika odczytu salda
    return 0;
  }

  signTransaction(transaction) {
    // Podpisywanie transakcji z użyciem newest API
    transaction.partialSign(this.keypair);
    return transaction;
  }
}