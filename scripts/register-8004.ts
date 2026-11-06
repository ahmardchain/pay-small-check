import { createPublicClient, createWalletClient, http, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { agentRegistration, buildRegistrationCall, identityAbi, IDENTITY_REGISTRY } from "../src/identity.js";
import { settingsFromEnv, USDT } from "../src/settings.js";

const settings = settingsFromEnv(process.env);
const broadcast = process.argv.includes("--broadcast");
const document = agentRegistration(settings);
const uri = dataUri(document);
const callData = buildRegistrationCall(uri, settings.attributionCode);

if (!settings.agentPrivateKey) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        broadcast: false,
        note: "No AGENT_PRIVATE_KEY, so this only prints the registration document. Add the key and run again.",
        attributionCode: settings.attributionCode,
        identityRegistry: IDENTITY_REGISTRY,
        chainId: 42220,
        registration: document,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const account = privateKeyToAccount(settings.agentPrivateKey);
const preview = {
  dryRun: !broadcast,
  address: account.address,
  attributionCode: settings.attributionCode,
  identityRegistry: IDENTITY_REGISTRY,
  chainId: 42220,
  feeCurrency: USDT.asset,
  agentURI: uri,
  scanAfterMint: "https://8004scan.io/agents/celo/<agentId>",
  registration: document,
};

if (!broadcast) {
  console.log(JSON.stringify({ ...preview, note: "Pass --broadcast to send the tagged register transaction." }, null, 2));
  process.exit(0);
}

const publicClient = createPublicClient({ chain: celo, transport: http(settings.rpcUrl) });
const walletClient = createWalletClient({ account, chain: celo, transport: http(settings.rpcUrl) });
const hash = await walletClient.sendTransaction({
  account,
  chain: celo,
  to: IDENTITY_REGISTRY,
  data: callData,
  feeCurrency: USDT.asset,
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
const events = parseEventLogs({ abi: identityAbi, logs: receipt.logs, eventName: "Registered" });
const agentId = events[0]?.args.agentId?.toString() ?? null;
console.log(
  JSON.stringify(
    {
      hash,
      agentId,
      explorer: `https://celoscan.io/tx/${hash}`,
      scan: agentId ? `https://8004scan.io/agents/celo/${agentId}` : null,
      attributionCode: settings.attributionCode,
    },
    null,
    2,
  ),
);

function dataUri(value: unknown): string {
  return `data:application/json;base64,${Buffer.from(JSON.stringify(value)).toString("base64")}`;
}
