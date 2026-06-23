// Lightweight markdown → plain-text for the search index. We deliberately do
// NOT reuse renderSafeMarkdown (marked + DOMPurify): the index only needs
// searchable text, and a tiny regex strip keeps the index builder pure and
// fast with zero heavy deps. Not a general-purpose markdown parser — just
// enough to drop syntax noise so search matches read cleanly.

export function stripMarkdown(md: string): string {
  return (
    md
      // fenced code blocks → keep inner text, drop fences
      .replace(/```[a-z]*\n?/gi, " ")
      .replace(/```/g, " ")
      // inline code / bold / italic / strikethrough markers
      .replace(/[`*_~]+/g, "")
      // images ![alt](url) → alt
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      // links [text](url) → text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // headings / blockquote markers at line start
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      // table pipes and separator rows
      .replace(/^\s*\|?[-:\s|]+\|?\s*$/gm, " ")
      .replace(/\|/g, " ")
      // list markers
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      // html tags, if any slipped in
      .replace(/<[^>]+>/g, " ")
      // collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}
