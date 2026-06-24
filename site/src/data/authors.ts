// Blog author registry. Bylines reference an author *id* in frontmatter
// (`author: opchain`); this maps it to display name, role, bio, and a link
// for the post-foot bio card. Keeping it here (not in each post's frontmatter)
// keeps bios DRY and consistent across posts.
//
// Today there's one canonical author — the team — but the shape is built to
// add named contributors later without touching the templates.

export interface Author {
  /** Frontmatter `author:` value. */
  id: string;
  /** Display name on the byline + bio card. */
  name: string;
  /** One-line role/credential under the name. */
  role: string;
  /** 1–2 sentence bio for the foot-of-post card. */
  bio: string;
  /** Where the name links (profile, /uses, etc.). */
  url?: string;
}

export const authors: Record<string, Author> = {
  opchain: {
    id: "opchain",
    name: "The opchain team",
    role: "Builders of opchain",
    bio: "We build opchain — a skillchain and checkpoint protocol for shipping real software with Claude. We write about what we learn dogfooding it on our own pipeline.",
    url: "/uses",
  },
};

/** Resolve a frontmatter author id to an Author, falling back to the team. */
export function authorFor(id: string | undefined): Author {
  return (id && authors[id]) || authors.opchain;
}
