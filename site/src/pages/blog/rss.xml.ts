import type { APIContext } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { authorFor } from "../../data/authors";

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
      const creator = authorFor(post.data.author).name;
      const cats = [...((post.data.tags as string[] | undefined) ?? [])];
      if (post.data.pillar) cats.unshift(post.data.pillar);
      return [
        "    <item>",
        `      <title>${escape(post.data.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(post.data.date).toUTCString()}</pubDate>`,
        `      <dc:creator>${escape(creator)}</dc:creator>`,
        `      <description>${escape(post.data.description)}</description>`,
        ...cats.map((t: string) => `      <category>${escape(t)}</category>`),
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const lastBuild = posts.length
    ? new Date(posts[0].data.date).toUTCString()
    : new Date(0).toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>opchain blog</title>
    <link>${site}/blog</link>
    <description>Engineering deep-dives, opinions on AI-assisted development, playbooks, and releases.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${site}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
