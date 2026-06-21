import type { APIContext } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";

type BlogEntry = CollectionEntry<"blog">;

// Hand-rolled RSS 2.0 feed (no @astrojs/rss dependency). Static endpoint —
// rendered once at build time. Posts come from the `blog` content collection.
export const prerender = true;

const SITE = "https://opchain.dev";

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function GET(context: APIContext) {
  const site = context.site?.toString().replace(/\/$/, "") ?? SITE;
  const posts = ((await getCollection("blog")) as BlogEntry[])
    .filter((p) => !p.data.draft)
    .sort((a, b) => new Date(b.data.date).valueOf() - new Date(a.data.date).valueOf());

  const items = posts
    .map((post: BlogEntry) => {
      const url = `${site}/blog/${post.id}`;
      return [
        "    <item>",
        `      <title>${escape(post.data.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(post.data.date).toUTCString()}</pubDate>`,
        `      <description>${escape(post.data.description)}</description>`,
        ...((post.data.tags as string[] | undefined) ?? []).map(
          (t: string) => `      <category>${escape(t)}</category>`,
        ),
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>opchain blog</title>
    <link>${site}/blog</link>
    <description>Releases, engineering, and notes on building software that ships.</description>
    <language>en-us</language>
    <atom:link href="${site}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
