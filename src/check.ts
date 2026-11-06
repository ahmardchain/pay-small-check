import { privateKeyToAccount } from "viem/accounts";
import { assertListed, isBalanceStop, loadCatalog, payService, type PaidResponse } from "./buy.js";
import {
  evidenceForModel,
  findInstagramCode,
  findRedditPostId,
  findingFromPayload,
  profileLooksPresent,
  readCount,
  scamHits,
  collectStrings,
} from "./evidence.js";
import { vendorTokens } from "./parse.js";
import {
  cencoriBody,
  instagramCommentsBody,
  planCalls,
  redditCommentsBody,
  type PlannedCall,
} from "./plan.js";
import { llmContent, parseLlmContent, scoreCheck } from "./score.js";
import { MAX_PAID_CALLS, SERVICES } from "./services.js";
import type { Settings } from "./settings.js";
import type { CheckReport, Finding, ParsedInput, Receipt } from "./types.js";

export const DISCLAIMER =
  "Pay-Small-Check reads public pages and paid data APIs. It does not read WhatsApp chats, and it is not a guarantee the vendor will deliver. A low score still means you can lose the money if you pay first.";

type Buyer = {
  call(planned: PlannedCall): Promise<PaidResponse>;
};

export async function runCheck(input: ParsedInput, settings: Settings): Promise<CheckReport> {
  if (settings.buyMode === "live" && !settings.agentPrivateKey) {
    throw new Error("BUY_MODE=live needs AGENT_PRIVATE_KEY. Nothing was spent.");
  }
  const catalog = settings.buyMode === "live" ? await loadCatalog() : null;
  const buyer = settings.buyMode === "live" ? liveBuyer(settings, input) : mockBuyer(input);
  const plan = planCalls(input);
  const receipts: Receipt[] = [];
  const findings: Finding[] = [];
  const tokens = vendorTokens(input);
  let profileFound: boolean | null = input.instagram ? false : null;
  let followers: number | null = null;
  let posts: number | null = null;
  let siteLoaded: boolean | null = input.url ? false : null;
  let shortcode: string | null = null;
  let redditPostId: string | null = null;
  let stop = false;

  const run = async (planned: PlannedCall): Promise<PaidResponse | null> => {
    if (stop || receipts.length >= MAX_PAID_CALLS) return null;
    if (catalog) assertListed(catalog, planned.service);
    const paid = await buyer.call(planned);
    receipts.push(paid.receipt);
    if (isBalanceStop(paid.receipt)) stop = true;
    return paid;
  };

  for (const planned of plan.before) {
    const paid = await run(planned);
    if (!paid) break;
    absorb(planned, paid, input, tokens, findings, (patch) => {
      if (patch.profileFound != null) profileFound = patch.profileFound;
      if (patch.followers != null) followers = patch.followers;
      if (patch.posts != null) posts = patch.posts;
      if (patch.siteLoaded != null) siteLoaded = patch.siteLoaded;
      if (patch.shortcode) shortcode = patch.shortcode;
      if (patch.redditPostId) redditPostId = patch.redditPostId;
    });
    if (planned.service.id === "instagram.posts" && plan.followups.instagramComments && shortcode) {
      const comments = await run({
        service: SERVICES.instagramComments,
        body: instagramCommentsBody(shortcode),
      });
      if (comments) {
        const texts = collectStrings(comments.json);
        const scam = scamHits(texts, []);
        findings.push({
          source: "instagram-comments",
          summary: comments.ok
            ? `Read comments on post ${shortcode}. Scam-like comments: ${scam.hits}.`
            : "The comments call did not return a usable body.",
          excerpts: scam.excerpts,
          scamHits: scam.hits,
          present: comments.ok,
        });
      }
    }
    if (planned.service.id === "reddit.search" && plan.followups.redditComments && redditPostId) {
      const comments = await run({
        service: SERVICES.redditComments,
        body: redditCommentsBody(redditPostId),
      });
      if (comments) {
        findings.push(
          findingFromPayload(
            "reddit-comments",
            comments.ok ? `Read comments on ${redditPostId}.` : "Reddit comments did not return a usable body.",
            comments.json,
            tokens,
            comments.ok,
          ),
        );
      }
    }
  }

  let llm = null;
  let llmMode: CheckReport["llm"] = "heuristic-only";
  if (!stop && receipts.length < MAX_PAID_CALLS) {
    const paid = await run({
      service: SERVICES.cencori,
      body: cencoriBody(evidenceForModel(input, findings)),
    });
    if (paid?.ok) {
      llm = parseLlmContent(llmContent(paid.json) ?? "");
      if (llm) llmMode = "cencori";
      findings.push({
        source: "cencori",
        summary: llm?.summary ?? "The model replied, but not in the expected JSON shape. The score stays on the heuristic.",
        excerpts: [],
        scamHits: 0,
        present: true,
      });
    } else if (paid) {
      findings.push({
        source: "cencori",
        summary: "The verdict model did not return a usable response. The score uses the other paid calls only.",
        excerpts: [],
        scamHits: 0,
        present: false,
      });
    }
  }

  const scored = scoreCheck({
    findings,
    instagramRequested: Boolean(input.instagram),
    profileFound,
    followers,
    posts,
    siteRequested: Boolean(input.url),
    siteLoaded,
    llm,
  });

  return {
    id: crypto.randomUUID(),
    input,
    risk: scored.risk,
    summary: scored.summary,
    reasons: scored.reasons,
    findings: findings.filter((finding) => finding.source !== "cencori" || finding.present),
    receipts,
    paidCalls: receipts.filter((receipt) => receipt.outcome === "confirmed" || receipt.outcome === "mock").length,
    mode: settings.buyMode,
    llm: llmMode,
    disclaimer: DISCLAIMER,
  };
}

type Patch = {
  profileFound?: boolean;
  followers?: number;
  posts?: number;
  siteLoaded?: boolean;
  shortcode?: string;
  redditPostId?: string;
};

function absorb(
  planned: PlannedCall,
  paid: PaidResponse,
  input: ParsedInput,
  tokens: string[],
  findings: Finding[],
  patch: (value: Patch) => void,
): void {
  const id = planned.service.id;
  if (id === "instagram.profile") {
    const present = paid.ok && input.instagram ? profileLooksPresent(paid.json, input.instagram) : false;
    const followers = readCount(paid.json, ["follower_count", "followers", "followerCount", "edge_followed_by"]);
    patch({ profileFound: present, followers: followers ?? undefined });
    findings.push(
      findingFromPayload(
        "instagram-profile",
        present
          ? `Public profile @${input.instagram} is listed${followers != null ? ` with about ${followers} followers` : ""}.`
          : `No public Instagram profile came back for @${input.instagram}.`,
        paid.json,
        tokens,
        present,
      ),
    );
    return;
  }
  if (id === "instagram.posts") {
    const code = paid.ok ? findInstagramCode(paid.json) : null;
    const count = readCount(paid.json, ["media_count", "posts", "post_count"]);
    if (code) patch({ shortcode: code });
    if (count != null) patch({ posts: count });
    findings.push(
      findingFromPayload(
        "instagram-posts",
        paid.ok
          ? `Fetched recent posts${code ? `; latest code ${code}` : ""}.`
          : "Recent posts did not come back.",
        paid.json,
        tokens,
        paid.ok,
      ),
    );
    return;
  }
  if (id === "browser.session") {
    const page = readPage(paid.json, input);
    patch({ siteLoaded: page.loaded });
    findings.push({
      source: "shop-site",
      summary: page.summary,
      excerpts: page.excerpt ? [page.excerpt] : [],
      scamHits: page.excerpt ? scamHits([page.excerpt], tokens).hits : 0,
      present: page.loaded,
    });
    return;
  }
  if (id === "reddit.search" && paid.ok) {
    const postId = findRedditPostId(paid.json);
    if (postId) patch({ redditPostId: postId });
  }
  const source =
    id === "x.search"
      ? "x"
      : id === "reddit.search" || id === "reddit.apify"
        ? "reddit"
        : id === "instagram.search"
          ? "instagram-search"
          : id;
  findings.push(
    findingFromPayload(
      source,
      paid.ok ? `${planned.service.title} returned a payload.` : `${planned.service.title} did not return a usable body.`,
      paid.json,
      tokens,
      paid.ok,
    ),
  );
}

function readPage(payload: unknown, input: ParsedInput): { loaded: boolean; summary: string; excerpt: string | null } {
  if (!payload || typeof payload !== "object") {
    return { loaded: false, summary: "The browser rental returned nothing to read.", excerpt: null };
  }
  const record = payload as Record<string, unknown>;
  const page = record.page as { title?: string; excerpt?: string; loaded?: boolean } | undefined;
  if (page && typeof page.excerpt === "string") {
    return {
      loaded: page.loaded !== false,
      summary: page.title ? `Shop page title: ${page.title}` : "Read the shop page.",
      excerpt: page.excerpt.slice(0, 180),
    };
  }
  const browser = record.browser as { ready?: boolean } | undefined;
  if (browser) {
    return {
      loaded: false,
      summary: input.url
        ? `Rented a browser for ${input.url}, but no page text was captured.`
        : "Browser rental returned no page text.",
      excerpt: null,
    };
  }
  return { loaded: false, summary: "The shop page was not readable.", excerpt: null };
}

function liveBuyer(settings: Settings, input: ParsedInput): Buyer {
  const account = privateKeyToAccount(settings.agentPrivateKey as `0x${string}`);
  return {
    async call(planned) {
      const paid = await payService({
        account,
        service: planned.service,
        body: planned.body,
        token: settings.buyToken,
        readBalance: true,
      });
      if (planned.service.id === "browser.session" && paid.ok) {
        try {
          paid.json = await driveBrowser(paid.json, input.url);
        } catch {
          paid.json = { page: { loaded: false, title: "", excerpt: "" } };
        }
      }
      return paid;
    },
  };
}

async function driveBrowser(payload: unknown, url: string | null): Promise<unknown> {
  if (!url) return payload;
  const session = findSession(payload);
  if (!session) return { browser: { ready: false }, page: { loaded: false, excerpt: "" } };
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${session.accessToken}`,
  };
  const send = async (command: Record<string, unknown>) => {
    const response = await fetch(session.commandUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(40_000),
    });
    const text = await response.text();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { output: text.slice(0, 400) };
    }
  };
  await send({ action: "open", url });
  const titlePayload = await send({ action: "get", kind: "title" });
  const textPayload = await send({ action: "get", kind: "text", target: "body" });
  const title = textOf(titlePayload);
  const excerpt = textOf(textPayload).slice(0, 400);
  return {
    page: {
      loaded: Boolean(title || excerpt),
      title: title.slice(0, 140),
      excerpt,
    },
  };
}

function findSession(payload: unknown): { commandUrl: string; accessToken: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const browser = (payload as { browser?: { commandUrl?: string; accessToken?: string } }).browser;
  if (browser?.commandUrl && browser.accessToken) {
    return { commandUrl: browser.commandUrl, accessToken: browser.accessToken };
  }
  return null;
}

function textOf(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const output = (payload as { output?: unknown }).output;
  if (typeof output === "string") return output;
  if (output && typeof output === "object") {
    const record = output as { text?: string; title?: string };
    return record.text ?? record.title ?? "";
  }
  return "";
}

function mockBuyer(input: ParsedInput): Buyer {
  const tone = mockTone(input);
  return {
    async call(planned) {
      const json = mockPayload(planned.service.id, input, tone);
      return {
        ok: true,
        status: 200,
        json,
        receipt: {
          capability: planned.service.id,
          catalogId: planned.service.catalogId,
          title: planned.service.title,
          url: planned.service.url,
          token: null,
          amountAtomic: planned.service.quotedAtomic,
          amountDisplay: `$${(Number(planned.service.quotedAtomic) / 1_000_000).toFixed(4)} quoted, not spent`,
          txHash: null,
          outcome: "mock",
          detail: "Dry run. No x402 payment was signed.",
        },
      };
    },
  };
}

type Tone = "low" | "medium" | "high";

function mockTone(input: ParsedInput): Tone {
  const blob = `${input.instagram ?? ""} ${input.url ?? ""} ${input.phone ?? ""}`.toLowerCase();
  if (blob.includes("scam") || input.phone?.endsWith("0000")) return "high";
  if (blob.includes("trusted") || input.phone?.endsWith("1111")) return "low";
  return "medium";
}

function mockPayload(id: string, input: ParsedInput, tone: Tone): unknown {
  const name = input.instagram ?? "vendor";
  if (id === "instagram.profile") {
    if (tone === "high") return { status: "not found", message: `user not found ${name}` };
    return {
      username: name,
      full_name: tone === "low" ? "Yaba Bags" : "Shop",
      follower_count: tone === "low" ? 12000 : 80,
      biography: tone === "low" ? "Bags. Pickup in Yaba, Lagos." : "DM to order.",
    };
  }
  if (id === "instagram.posts") {
    if (tone === "high") return { items: [] };
    return {
      media_count: tone === "low" ? 40 : 2,
      items: [
        {
          shortcode: "MockPost1",
          caption: tone === "low" ? "New week, pickup in Yaba." : "Pay to account now.",
          permalink: "https://www.instagram.com/p/MockPost1/",
        },
      ],
    };
  }
  if (id === "instagram.comments") {
    if (tone === "high") {
      return { comments: [{ text: "I paid and nothing came. This is a scam." }, { text: "They collected my money." }] };
    }
    return { comments: [{ text: "Received mine, thank you." }] };
  }
  if (id === "instagram.search") {
    return { users: [{ username: name }] };
  }
  if (id === "x.search") {
    if (tone === "high") {
      return { posts: [{ text: `${input.instagram ?? input.phone ?? input.url} is a scam, they took my money` }] };
    }
    return { posts: [{ text: "Looking for a tailor in Lagos" }] };
  }
  if (id === "reddit.search" || id === "reddit.apify") {
    if (tone === "high") {
      return { posts: [{ id: "t3_mockscam01", title: `${input.phone ?? name} fraud 419` }] };
    }
    return { posts: [] };
  }
  if (id === "reddit.comments") {
    return { comments: [{ body: tone === "high" ? "Classic whatsapp vendor scam" : "No complaints here" }] };
  }
  if (id === "browser.session") {
    if (tone === "high") return { page: { loaded: false, title: "", excerpt: "" } };
    return {
      page: {
        loaded: true,
        title: "Yaba Bags",
        excerpt: "Pickup in Yaba. Pay on delivery or transfer after you see the bag.",
      },
    };
  }
  if (id === "cencori.chat") {
    const risk = tone;
    const summary =
      tone === "high"
        ? "Public posts call this vendor a scam."
        : tone === "low"
          ? "The public shop traces look ordinary."
          : "The traces are too thin to clear the vendor.";
    return {
      choices: [{ message: { content: JSON.stringify({ risk, summary, reasons: [summary] }) } }],
    };
  }
  return {};
}
