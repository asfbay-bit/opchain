// Blog helpers — reading time, pillar metadata, and post relationships.
// Kept framework-agnostic (plain TS over CollectionEntry data) so both the
// index and the [slug] template share one source of truth.

import type { CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;
export type Pillar = "engineering" | "opinion" | "playbook" | "release";

// Pillar → display label + Badge variant + one-line remit (used in tooltips /
// the index filter). Order here is the canonical display order.
interface PillarMeta {
  label: string;
  variant: "accent" | "info" | "success" | "neutral";
  blurb: string;
}

export const PILLARS: Record<Pillar, PillarMeta> = {
  engineering: {
    label: "Engineering",
    variant: "accent",
    blurb: "How opchain is built and dogfooded.",
  },
  opinion: {
    label: "Opinion",
    variant: "info",
    blurb: "Takes on AI-assisted development as a discipline.",
  },
  playbook: {
    label: "Playbook",
    variant: "success",
    blurb: "Ship something real, end to end.",
  },
  release: {
    label: "Release",
    variant: "neutral",
    blurb: "The story behind a release.",
  },
};

export const PILLAR_ORDER: Pillar[] = ["engineering", "opinion", "playbook", "release"];

/** Lookup with a safe default so an unset/typo'd pillar never throws. */
export function pillarMeta(pillar?: string): PillarMeta | null {
  if (pillar && pillar in PILLARS) return PILLARS[pillar as Pillar];
  return null;
}

/** Words-per-minute reading estimate from the raw Markdown body. Min 1 min. */
export function readingTime(body: string | undefined): number {
  if (!body) return 1;
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Newest-first by `date`. Stable for equal dates. */
export function sortByDate(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.data.date).valueOf() - new Date(a.data.date).valueOf(),
  );
}

/** Published (non-draft) posts, newest first. */
export function publishedPosts(posts: BlogPost[]): BlogPost[] {
  return sortByDate(posts.filter((p) => !p.data.draft));
}

/**
 * Up to `limit` related posts: same pillar first, then posts sharing ≥1 tag,
 * newest first, excluding the current post and de-duped.
 */
export function relatedPosts(current: BlogPost, all: BlogPost[], limit = 3): BlogPost[] {
  const pool = publishedPosts(all).filter((p) => p.id !== current.id);
  const tags = new Set(current.data.tags ?? []);
  const scored = pool
    .map((p) => {
      const samePillar = current.data.pillar && p.data.pillar === current.data.pillar ? 2 : 0;
      const sharedTags = (p.data.tags ?? []).filter((t: string) => tags.has(t)).length;
      return { p, score: samePillar + sharedTags };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.p);
}

/** Posts in a named series, oldest → newest (reading order). */
export function seriesPosts(series: string, all: BlogPost[]): BlogPost[] {
  return publishedPosts(all)
    .filter((p) => p.data.series === series)
    .reverse(); // publishedPosts is newest-first; series reads oldest-first
}

/** Format an ISO date (YYYY-MM-DD) for display. */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
