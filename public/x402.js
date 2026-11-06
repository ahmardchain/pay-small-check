/**
 * Browser half of an x402 v2 exact EIP-3009 payment.
 * The shape matches @x402/evm exact client + @x402/core HTTP payload
 * (x402Version, resource, accepted, payload.authorization, payload.signature).
 * MiniPay cannot sign this. Wallets with eth_signTypedData_v4 can.
 */

const AUTHORIZATION_TYPES = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "validAfter", type: "uint256" },
  { name: "validBefore", type: "uint256" },
  { name: "nonce", type: "bytes32" },
];

export function randomNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function decodeHeader(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function encodeHeader(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function selectRequirement(paymentRequired, asset, network = "eip155:42220") {
  const accepts = paymentRequired?.accepts ?? [];
  const match = accepts.find(
    (item) => item.network === network && String(item.asset).toLowerCase() === asset.toLowerCase(),
  );
  if (!match) {
    throw new Error("This check is not offered in that token on Celo.");
  }
  return match;
}

export function typedDataFor(requirement, authorization) {
  if (!requirement.extra?.name || !requirement.extra?.version) {
    throw new Error("The payment challenge is missing the token name and version.");
  }
  const chainId = Number(String(requirement.network).split(":")[1]);
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: AUTHORIZATION_TYPES,
    },
    primaryType: "TransferWithAuthorization",
    domain: {
      name: requirement.extra.name,
      version: requirement.extra.version,
      chainId,
      verifyingContract: requirement.asset,
    },
    message: {
      from: authorization.from,
      to: authorization.to,
      value: authorization.value,
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
      nonce: authorization.nonce,
    },
  };
}

export function buildAuthorization(from, requirement, nowSeconds = Math.floor(Date.now() / 1000), nonce = randomNonce()) {
  const timeout = Number(requirement.maxTimeoutSeconds ?? 60);
  return {
    from,
    to: requirement.payTo,
    value: String(requirement.amount),
    validAfter: "0",
    validBefore: String(nowSeconds + timeout),
    nonce,
  };
}

export function buildPaymentPayload(paymentRequired, requirement, authorization, signature) {
  return {
    x402Version: paymentRequired.x402Version ?? 2,
    resource: paymentRequired.resource,
    accepted: requirement,
    payload: { authorization, signature },
    extensions: paymentRequired.extensions,
  };
}
