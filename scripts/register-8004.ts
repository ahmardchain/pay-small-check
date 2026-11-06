import { concat, createPublicClient, createWalletClient, encodeFunctionData, http, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { withAttribution } from "@celo/attribution-tags";
import { attributionSuffix } from "../src/lib/attribution.js";
import { IDENTITY_REGISTRY, TOKENS } from "../src/lib/tokens.js";

/**
 * One command:
 *   AGENT_PRIVATE_KEY=0x... AGENT_URI=https://your.app/agent.json npm run register:8004
 * Add --dry-run to print the tagged transaction and not broadcast it.
 *
 * Gas is paid in USDT via the fee-currency adapter unless GAS_FEE_CURRENCY=celo.
 */

const ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

const dryRun = process.argv.includes("--dry-run");
const configuredUri = process.env.AGENT_URI?.trim() || (process.env.PUBLIC_APP_URL?.trim() ? `${process.env.PUBLIC_APP_URL.trim().replace(/\/$/, "")}/agent.json` : "");
const uri = configuredUri || (dryRun ? "https://example.com/agent.json" : "");
const code = (process.env.ATTRIBUTION_CODE?.trim() || "paysmallcheck").toLowerCase();
const rpcUrl = process.env.CELO_RPC_URL?.trim() || "https://forno.celo.org";
const feeMode = (process.env.GAS_FEE_CURRENCY?.trim() || "USDT").toLowerCase();
const feeCurrency = feeMode === "celo" ? undefined : feeMode === "usdc" ? TOKENS.USDC.feeCurrency : TOKENS.USDT.feeCurrency;

if (!uri || uri.includes("undefined")) {
  console.error("Set AGENT_URI or PUBLIC_APP_URL to the public origin that serves /agent.json");
  process.exit(1);
}
if (!configuredUri && dryRun) {
  console.error("AGENT_URI is unset. Dry run uses https://example.com/agent.json. Set AGENT_URI before broadcasting.");
}

const data = concat([
  encodeFunctionData({ abi: ABI, functionName: "register", args: [uri] }),
  attributionSuffix(code),
]);

const plan = {
  chainId: 42220,
  identityRegistry: IDENTITY_REGISTRY,
  agentURI: uri,
  attributionCode: code,
  feeCurrency: feeCurrency ?? "CELO",
  data,
  dryRun,
};

if (dryRun) {
  console.log(JSON.stringify(plan, null, 2));
  console.log("Dry run only. No transaction was sent.");
  process.exit(0);
}

const rawKey = process.env.AGENT_PRIVATE_KEY?.trim();
if (!rawKey) {
  console.error("Set AGENT_PRIVATE_KEY. Use --dry-run to print the transaction without a key.");
  process.exit(1);
}
const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });
const wallet = createWalletClient({ account, chain: celo, transport: http(rpcUrl) }).extend(withAttribution(code));

const hash = await wallet.writeContract({
  address: IDENTITY_REGISTRY,
  abi: ABI,
  functionName: "register",
  args: [uri],
  feeCurrency,
});
console.log("Submitted", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
const [registered] = parseEventLogs({ abi: ABI, eventName: "Registered", logs: receipt.logs });
console.log(
  JSON.stringify(
    {
      agentId: registered?.args.agentId?.toString() ?? null,
      owner: account.address,
      txHash: hash,
      agentURI: uri,
      next: "Set AGENT_ID to this id and redeploy so /agent.json includes registrations.",
    },
    null,
    2,
  ),
);
