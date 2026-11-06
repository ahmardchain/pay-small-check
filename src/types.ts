export type Risk = "low" | "medium" | "high";

export type ParsedInput = {
  raw: string;
  instagram: string | null;
  phone: string | null;
  url: string | null;
};

export type ReceiptOutcome = "confirmed" | "rejected" | "ambiguous" | "skipped" | "mock";

export type Receipt = {
  capability: string;
  catalogId: string;
  title: string;
  url: string;
  token: string | null;
  amountAtomic: string | null;
  amountDisplay: string | null;
  txHash: string | null;
  outcome: ReceiptOutcome;
  detail: string | null;
};

export type Finding = {
  source: string;
  summary: string;
  excerpts: string[];
  scamHits: number;
  present: boolean;
};

export type CheckReport = {
  id: string;
  input: ParsedInput;
  risk: Risk;
  summary: string;
  reasons: string[];
  findings: Finding[];
  receipts: Receipt[];
  paidCalls: number;
  mode: "mock" | "live";
  llm: "cencori" | "heuristic-only";
  disclaimer: string;
};
