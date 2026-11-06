import type { Finding, Risk } from "./types.js";

export type LlmVerdict = {
  risk?: Risk;
  summary?: string;
  reasons?: string[];
};

export type ScoreInput = {
  findings: Finding[];
  instagramRequested: boolean;
  profileFound: boolean | null;
  followers: number | null;
  posts: number | null;
  siteRequested: boolean;
  siteLoaded: boolean | null;
  llm: LlmVerdict | null;
};

export type Score = {
  risk: Risk;
  summary: string;
  reasons: string[];
  llmUsed: boolean;
};

const RANK: Record<Risk, number> = { low: 0, medium: 1, high: 2 };

export function scoreCheck(input: ScoreInput): Score {
  const reasons: string[] = [];
  const scamReports = input.findings
    .filter((finding) => finding.source !== "instagram-comments")
    .reduce((sum, finding) => sum + finding.scamHits, 0);
  const commentScams = input.findings
    .filter((finding) => finding.source === "instagram-comments")
    .reduce((sum, finding) => sum + finding.scamHits, 0);

  let risk: Risk = "medium";
  if (scamReports > 0) {
    risk = "high";
    reasons.push("Public posts name this vendor alongside scam or non-delivery language.");
  } else if (commentScams >= 2) {
    risk = "high";
    reasons.push("More than one comment on the vendor's own post describes a scam or missing delivery.");
  } else if (input.instagramRequested && input.profileFound === false) {
    risk = "high";
    reasons.push("The Instagram handle did not resolve to a public profile.");
  } else if (
    input.profileFound &&
    (input.followers ?? 0) >= 500 &&
    (input.posts ?? 0) >= 5 &&
    scamReports === 0 &&
    commentScams === 0 &&
    (input.siteLoaded === null || input.siteLoaded === true)
  ) {
    risk = "low";
    reasons.push("A public profile with posts is up, and the paid searches did not return a scam report.");
  } else if (input.profileFound && (input.followers ?? 0) < 100 && (input.posts ?? 0) < 3) {
    risk = "medium";
    reasons.push("The profile is thin: few followers and few posts for a shop asking to be paid first.");
  } else {
    reasons.push("The public traces are incomplete, so this stays a cautious middle score.");
  }

  if (input.siteRequested && input.siteLoaded === false) {
    if (RANK[risk] < RANK.medium) risk = "medium";
    reasons.push("The shop link did not return a readable page in the paid browser session.");
  }
  if (commentScams === 1 && risk === "low") {
    risk = "medium";
    reasons.push("One comment mentions a scam or a missed delivery.");
  }

  const llmRisk = input.llm?.risk;
  let llmUsed = false;
  if (llmRisk && RANK[llmRisk] > RANK[risk]) {
    risk = llmRisk;
    llmUsed = true;
    reasons.push("The paid model raised the score from the evidence bundle.");
  } else if (llmRisk) {
    llmUsed = true;
  }

  const summary = cleanSentence(input.llm?.summary) ?? defaultSummary(risk);
  for (const reason of input.llm?.reasons ?? []) {
    const cleaned = cleanSentence(reason);
    if (cleaned && reasons.length < 6) reasons.push(cleaned);
  }

  return { risk, summary, reasons: reasons.slice(0, 6), llmUsed };
}

export function parseLlmContent(content: string): LlmVerdict | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
    const risk = parsed.risk === "low" || parsed.risk === "medium" || parsed.risk === "high" ? parsed.risk : undefined;
    const summary = typeof parsed.summary === "string" ? parsed.summary : undefined;
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((item): item is string => typeof item === "string")
      : undefined;
    if (!risk && !summary) return null;
    return { risk, summary, reasons };
  } catch {
    return null;
  }
}

function defaultSummary(risk: Risk): string {
  if (risk === "high") return "Do not pay this vendor upfront. The public traces look like a scam or a missing shop.";
  if (risk === "low") return "Nothing in the paid public traces marks this vendor as a scam. Paying upfront is still your decision.";
  return "The traces are mixed or thin. Confirm a real person and a real pickup before you pay.";
}

function cleanSentence(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 8 || text.length > 240) return null;
  if (/ignore (all|previous)|system prompt|you are now/i.test(text)) return null;
  return text;
}

export function llmContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  return typeof message?.content === "string" ? message.content : null;
}
