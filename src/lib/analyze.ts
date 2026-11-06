import { accountLink, parseTime, postLink, type AccountFacts, type PostFacts } from "./normalize.js";

export type Verdict = "safe" | "caution" | "risky";
export type SignalTone = "good" | "warn" | "bad" | "info";

export interface Signal {
  tone: SignalTone;
  title: string;
  detail: string;
}

export interface Evidence {
  kind: "profile" | "post" | "complaint" | "follower";
  label: string;
  excerpt?: string;
  url?: string;
}

export interface VendorSnapshot {
  profile: AccountFacts | null;
  posts: PostFacts[];
  replies: PostFacts[];
  mentions: PostFacts[];
  followers: AccountFacts[];
  /** A source is closed when the call failed or the payload was not recognizable. */
  gaps: {
    profile: boolean;
    posts: boolean;
    replies: boolean;
    followers: boolean;
    mentions: boolean;
  };
}

export interface Analysis {
  verdict: Verdict;
  summary: string;
  signals: Signal[];
  evidence: Evidence[];
  complaintCount: number;
}

const COMPLAINTS: RegExp[] = [
  /\bscam(?:med|mer|ming)?\b/i,
  /\bfraud(?:ulent)?\b/i,
  /\bfake\b/i,
  /\brip-?off\b/i,
  /\bthief\b/i,
  /\bstole\b/i,
  /\bstolen\b/i,
  /didn'?t deliver/i,
  /did not deliver/i,
  /never delivered/i,
  /no refund/i,
  /didn'?t refund/i,
  /did not refund/i,
  /\bwaste of money\b/i,
  /\bdon'?t pay\b/i,
  /\bdo not pay\b/i,
];

export function isComplaint(text: string): boolean {
  return COMPLAINTS.some((pattern) => pattern.test(text));
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function lowQualityFollower(account: AccountFacts, now: Date): boolean {
  if (account.defaultProfileImage) return true;
  const created = parseTime(account.createdAt, account.id);
  const age = created ? daysBetween(now, created) : null;
  const followers = account.followers ?? 0;
  const posts = account.postsCount ?? 0;
  const following = account.following ?? 0;
  if (followers <= 2 && posts <= 1 && age !== null && age < 90) return true;
  if (following >= 500 && followers <= 5) return true;
  return false;
}

function sameAuthor(post: PostFacts, handle: string): boolean {
  if (!post.handle) return false;
  return post.handle.toLowerCase() === handle.toLowerCase();
}

export function analyzeVendor(handle: string, snapshot: VendorSnapshot, now = new Date()): Analysis {
  const signals: Signal[] = [];
  const evidence: Evidence[] = [];
  let score = 0;
  const profile = snapshot.profile;

  evidence.push({
    kind: "profile",
    label: `@${handle} on X`,
    url: accountLink(handle),
  });

  if (!profile) {
    signals.push({
      tone: "bad",
      title: "No profile was read",
      detail: "The profile call did not return an account. This check cannot call the vendor safe.",
    });
    return {
      verdict: "caution",
      summary: `Caution. Pay Small Check could not read @${handle}, so this is not a safe result.`,
      signals,
      evidence,
      complaintCount: 0,
    };
  }

  const created = parseTime(profile.createdAt, profile.id);
  const ageDays = created ? daysBetween(now, created) : null;
  if (ageDays === null) {
    score += 2;
    signals.push({
      tone: "warn",
      title: "Account age is unknown",
      detail: "The profile had no creation date, so a brand-new account cannot be ruled out.",
    });
  } else if (ageDays < 14) {
    score += 4;
    signals.push({
      tone: "bad",
      title: `Account is ${ageDays} day${ageDays === 1 ? "" : "s"} old`,
      detail: "Accounts opened in the last two weeks are a common shape for shops that disappear.",
    });
  } else if (ageDays < 45) {
    score += 3;
    signals.push({
      tone: "warn",
      title: `Account is ${ageDays} days old`,
      detail: "The account is still new. Pay only an amount you can afford to lose.",
    });
  } else if (ageDays < 180) {
    score += 1;
    signals.push({
      tone: "warn",
      title: `Account is about ${Math.floor(ageDays / 30)} months old`,
      detail: "Old enough to have a history, but not a long one.",
    });
  } else {
    signals.push({
      tone: "good",
      title: `Account is about ${Math.floor(ageDays / 365)} year${ageDays >= 730 ? "s" : ""} old`,
      detail: created ? `Opened ${created.toISOString().slice(0, 10)}.` : "Opened long enough to judge.",
    });
  }

  const followers = profile.followers;
  const following = profile.following;
  if (followers !== undefined) {
    signals.push({
      tone: "info",
      title: `${followers.toLocaleString("en-US")} followers`,
      detail:
        following !== undefined
          ? `Following ${following.toLocaleString("en-US")}. Posts on the profile: ${(profile.postsCount ?? 0).toLocaleString("en-US")}.`
          : "Following count was not in the profile payload.",
    });
  }
  if (followers !== undefined && following !== undefined && followers < 100 && following > followers * 20) {
    score += 1;
    signals.push({
      tone: "warn",
      title: "Follows far more accounts than follow back",
      detail: "A small account that follows hundreds of people is often still hunting for a crowd.",
    });
  }
  if (profile.verified) {
    score = Math.max(0, score - 1);
    signals.push({
      tone: "good",
      title: "Verification badge is present",
      detail: "A badge is one signal. It does not cancel complaints.",
    });
  }
  if (!profile.bio) {
    score += 1;
    signals.push({
      tone: "warn",
      title: "No bio",
      detail: "The profile description was empty.",
    });
  }

  const ownPosts = snapshot.posts.filter((post) => !post.handle || sameAuthor(post, handle));
  if (snapshot.gaps.posts) {
    signals.push({
      tone: "info",
      title: "Recent posts were not read",
      detail: "Engagement and repetition were not scored.",
    });
  } else if (ownPosts.length === 0) {
    score += 1;
    signals.push({
      tone: "warn",
      title: "No recent posts were found",
      detail: "An empty timeline gives a buyer nothing to compare against the goods.",
    });
  } else {
    const texts = ownPosts.map((post) => post.text.toLowerCase().replace(/\s+/g, " ").trim());
    const unique = new Set(texts).size;
    if (ownPosts.length >= 4 && unique / ownPosts.length < 0.6) {
      score += 2;
      signals.push({
        tone: "bad",
        title: "Posts repeat themselves",
        detail: `${ownPosts.length - unique} of ${ownPosts.length} recent posts are copies of another.`,
      });
    } else {
      signals.push({
        tone: "good",
        title: "Recent posts are not copies of each other",
        detail: `${unique} distinct posts in a sample of ${ownPosts.length}.`,
      });
    }
    const likes = ownPosts.map((post) => post.likes).filter((value): value is number => value !== undefined);
    const mid = median(likes);
    if (mid !== null && followers !== undefined && followers >= 500 && ownPosts.length >= 3) {
      if (mid === 0) {
        score += 2;
        signals.push({
          tone: "warn",
          title: "A large following and almost no likes",
          detail: "The median recent post has no likes. That can mean bought followers.",
        });
      } else if (ageDays !== null && ageDays < 180 && mid / followers > 0.2) {
        score += 2;
        signals.push({
          tone: "warn",
          title: "Engagement is unusually high for a new account",
          detail: `Median likes are ${mid} on ${followers} followers.`,
        });
      } else {
        signals.push({
          tone: "good",
          title: "Engagement looks ordinary",
          detail: `Median likes on the sample: ${mid}.`,
        });
      }
    }
    for (const post of ownPosts.slice(0, 2)) {
      evidence.push({
        kind: "post",
        label: "Recent post",
        excerpt: post.text.slice(0, 180),
        url: postLink(post, handle),
      });
    }
  }

  if (snapshot.gaps.followers) {
    signals.push({
      tone: "info",
      title: "Follower sample was not read",
      detail: "Follower quality was not scored.",
    });
  } else {
    const sample = snapshot.followers.filter((account) => account.handle.toLowerCase() !== handle.toLowerCase());
    if (sample.length < 5) {
      signals.push({
        tone: "info",
        title: "Follower sample is small",
        detail: `${sample.length} follower profile${sample.length === 1 ? "" : "s"} came back, which is too few to judge.`,
      });
    } else {
      const low = sample.filter((account) => lowQualityFollower(account, now)).length;
      const ratio = low / sample.length;
      if (ratio >= 0.45) {
        score += 3;
        signals.push({
          tone: "bad",
          title: "Many followers look empty",
          detail: `${low} of ${sample.length} sampled followers are new, default, or follow-only accounts.`,
        });
      } else if (ratio >= 0.25) {
        score += 1;
        signals.push({
          tone: "warn",
          title: "Some followers look thin",
          detail: `${low} of ${sample.length} sampled followers have little of their own history.`,
        });
      } else {
        signals.push({
          tone: "good",
          title: "Follower sample looks ordinary",
          detail: `${low} of ${sample.length} sampled followers matched the thin-account checks.`,
        });
      }
    }
  }

  const complaints = snapshot.gaps.mentions
    ? []
    : snapshot.mentions.filter((post) => !sameAuthor(post, handle) && isComplaint(post.text));
  if (snapshot.gaps.mentions) {
    score += 2;
    signals.push({
      tone: "warn",
      title: "Complaint search was not read",
      detail: "A safe verdict needs this search. It failed or came back in an unknown shape.",
    });
  } else if (complaints.length === 0) {
    signals.push({
      tone: "good",
      title: "No scam or non-delivery posts in the search",
      detail: "The latest search for scam, fraud, fake, and non-delivery next to this handle was empty.",
    });
  } else if (complaints.length === 1) {
    score += 3;
    signals.push({
      tone: "warn",
      title: "One complaint post",
      detail: "Someone publicly used scam, fraud, fake, or non-delivery language about this handle.",
    });
  } else {
    score += 5;
    signals.push({
      tone: "bad",
      title: `${complaints.length} complaint posts`,
      detail: "More than one public post accuses this handle of a scam, fraud, a fake, or a failed delivery.",
    });
  }
  for (const post of complaints.slice(0, 3)) {
    evidence.push({
      kind: "complaint",
      label: post.handle ? `Complaint by @${post.handle}` : "Complaint post",
      excerpt: post.text.slice(0, 180),
      url: postLink(post, post.handle || handle),
    });
  }

  if (!snapshot.gaps.replies) {
    signals.push({
      tone: "info",
      title: snapshot.replies.length ? `${snapshot.replies.length} replies in the sample` : "No replies in the sample",
      detail: "Replies show how the account talks to other people. They are context, not a score by themselves.",
    });
  }

  let verdict: Verdict;
  if (complaints.length >= 3 || (ageDays !== null && ageDays < 30 && complaints.length >= 1) || score >= 6) {
    verdict = "risky";
  } else if (score >= 2 || snapshot.gaps.mentions) {
    verdict = "caution";
  } else {
    verdict = "safe";
  }

  const summary =
    verdict === "safe"
      ? `Safe. @${handle} looks like an established account, and the complaint search came back clean.`
      : verdict === "risky"
        ? `Risky. @${handle} has strong warning signs. Do not pay them based on this profile alone.`
        : `Caution. @${handle} is not a clear scam and not a clear pass. Read the evidence before you pay.`;

  return { verdict, summary, signals, evidence, complaintCount: complaints.length };
}
