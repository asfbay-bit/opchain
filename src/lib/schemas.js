/**
 * Zod schemas for every POST endpoint. Keeping them in one file means the
 * error shape is consistent ({ error, code, issues? }) and the input surface
 * is easy to audit.
 */

import { z } from "zod";

const email = z.string().trim().min(3).max(254).email();

/** POST /api/feedback */
export const FeedbackSchema = z.object({
  type: z.enum(["bug", "feature", "improvement", "general"]),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional().default(""),
  priority: z.coerce.number().int().min(0).max(4).optional().default(0),
  skill: z.string().trim().max(60).optional(),
  email: email.optional(),
});

/**
 * POST /api/notify
 *
 * Soft-gate capture at the install / download moment. Email required;
 * the qualitative fields (role, teamSize, building) are optional to
 * keep friction low.
 */
export const NotifySchema = z.object({
  email,
  role: z.enum([
    "engineer",
    "engineering-manager",
    "product-manager",
    "designer",
    "founder",
    "other",
  ]).optional(),
  teamSize: z.enum(["solo", "2-5", "6-20", "21-plus"]).optional(),
  building: z.string().trim().max(280).optional(),
  // Where on the site the user submitted from. Useful for funnel
  // analysis ("install vs per-skill download conversion") without
  // needing a separate event.
  source: z.enum([
    "install",
    "skill-download",
    "bundle-download",
    "homepage",
    "other",
  ]).optional().default("other"),
});

/**
 * Parse a JSON body against a schema. Returns either
 * `{ ok: true, data }` or `{ ok: false, error, code, issues }`.
 */
export async function parseBody(request, schema) {
  let raw;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      error: "Invalid JSON body.",
      code: "invalid_json",
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return {
      ok: false,
      error: issues[0]?.message || "Invalid request body.",
      code: "invalid_body",
      issues,
    };
  }
  return { ok: true, data: result.data };
}
