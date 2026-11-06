import { privateKeyToAccount } from "viem/accounts";
import { settingsFromEnv } from "../src/settings.js";

const settings = settingsFromEnv(process.env);
if (!settings.agentPrivateKey) {
  console.error("Set AGENT_PRIVATE_KEY in .env first. See .env.example.");
  process.exit(1);
}
const account = privateKeyToAccount(settings.agentPrivateKey);
console.log(
  JSON.stringify(
    {
      address: account.address,
      payTo: settings.payTo,
      attributionCode: settings.attributionCode,
      network: "celo",
      chainId: 42220,
      fundWith: "10 to 20 USD₮ on Celo mainnet, at this address",
      celoscan: `https://celoscan.io/address/${account.address}`,
    },
    null,
    2,
  ),
);
