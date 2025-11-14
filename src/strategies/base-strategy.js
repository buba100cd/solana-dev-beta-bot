// src/strategies/base-strategy.js
export class BaseStrategy {
  constructor(walletManager, swapExecutor, notifier) {
    this.walletManager = walletManager;
    this.swapExecutor = swapExecutor;
    this.notifier = notifier;
    this.isRunning = false;
  }

  async initialize() {
    throw new Error("initialize() method must be implemented by subclass.");
  }

  async execute(data) {
    throw new Error("execute() method must be implemented by subclass.");
  }

  async stop() {
    this.isRunning = false;
    console.log(`${this.constructor.name} stopped.`);
  }
}