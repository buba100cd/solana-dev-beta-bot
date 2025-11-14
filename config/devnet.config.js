// config/devnet.config.js
export const config = {
  network: "devnet",
  rpc: {
    http: "https://api.devnet.solana.com",
    ws: "wss://api.devnet.solana.com",
    // Przykład użycia specjalnego endpointu Jito dla Dev Beta
    jito: "https://devnet.jito.rpc.extrnode.com" 
  },
  wallet: {
    // Klucz prywatny powinien być ładowany z zmiennych środowiskowych
    privateKey: process.env.DEVNET_PRIVATE_KEY || null,
  },
  strategies: {
    sniper: {
      enabled: true,
      // Filtry dla pooli, zgodne z Dev Beta specs
      minLiquidity: 5000, 
      filters: ["raydium", "orca"],
    },
    mev: {
      enabled: true,
      // Konfiguracja tipów dla Jito
      defaultTipLamports: 10000, 
    }
  },
  monitoring: {
    discordWebhook: process.env.DISCORD_WEBHOOK_URL,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
  }
};