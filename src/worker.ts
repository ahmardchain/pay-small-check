import { createApp } from "./app.js";
import { settingsFromEnv } from "./settings.js";

type Secrets = {
  AGENT_PRIVATE_KEY?: string;
  BUY_PRIVATE_KEY?: string;
  X402_API_KEY?: string;
};

export default {
  async fetch(request: Request, env: Env & Secrets): Promise<Response> {
    const settings = settingsFromEnv({
      BUY_MODE: env.BUY_MODE,
      PAYMENT_MODE: env.PAYMENT_MODE,
      BUY_TOKEN: env.BUY_TOKEN,
      CHECK_PRICE_USDT: env.CHECK_PRICE_USDT,
      CHECK_PRICE_CNGN: env.CHECK_PRICE_CNGN,
      CELO_RPC_URL: env.CELO_RPC_URL,
      ATTRIBUTION_CODE: env.ATTRIBUTION_CODE,
      PAY_TO: env.PAY_TO,
      AGENT_ENDPOINT: env.AGENT_ENDPOINT,
      AGENT_PRIVATE_KEY: env.AGENT_PRIVATE_KEY,
      BUY_PRIVATE_KEY: env.BUY_PRIVATE_KEY,
      X402_API_KEY: env.X402_API_KEY,
    });
    return createApp(settings).fetch(request);
  },
};
