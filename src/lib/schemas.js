/**
 * Zod schemas for every POST endpoint. Keeping them in one file means the
 * error shape is consistent ({ error, code, issues? }) and the input surface
 * is easy to audit.
 */

import { z } from "zod";

const email = z.string().trim().min(3).max(254).email();

/** POST /api/feedback */
export const FeedbackSchema = z.object({
  type: z.enum(["bug", "feature", "improvement", "general", "security"]),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional().default(""),
  priority: z.coerce.number().int().min(0).max(4).optional().default(0),
  skill: z.string().trim().max(60).optional(),
  email: email.optional(),
  // ── Security-disclosure-only fields ────────────────────────────
  // Surfaced by the /security page form. Optional on the schema so
  // the existing feedback widget keeps working unchanged; the worker
  // composes them into the Linear issue body when type === "security".
  component: z.string().trim().max(200).optional(),
  reproduction: z.string().trim().max(5000).optional(),
  impact: z.string().trim().max(2000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  // ── Roadmap submission form (/changelog) ───────────────────────
  // Set by the community feature-request form. Presence flips the
  // worker into "community submission" mode: applies the
  // `community-submitted` Linear label (when LINEAR_COMMUNITY_LABEL_ID
  // is configured), prefixes the title with [community/<type>], and
  // surfaces `Category` in the issue body. Items do NOT show on the
  // public roadmap until a team-member adds `roadmap-visible` during
  // triage — keeps spam out of the public timeline.
  category: z.enum(["skill", "feature", "docs", "integration", "other"]).optional(),
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
 * POST /api/email-pipeline
 *
 * Step 5 of the /pipeline-builder wizard. User typed their name + email and
 * clicked "email it to me"; the handler renders a rich HTML email (wizard
 * answers + recommended skills + next-steps) and ships it via Resend. The
 * payload mirrors the in-memory wizard state — `answers` carries the four
 * user choices, `skills` carries the recommended pipeline.
 *
 * Strings are bounded so a malicious caller can't inflate the rendered
 * HTML body; the renderer also escapes every value before interpolation.
 */
const answerString = z.string().trim().min(1).max(40);
export const NotifyPipelineSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email,
  answers: z.object({
    kind: answerString,
    team: answerString,
    deploy: answerString,
    aiSurface: answerString,
  }),
  skills: z.array(
    z.object({
      id: z.string().trim().min(1).max(200),
      name: z.string().trim().min(1).max(200),
      summary: z.string().trim().min(1).max(200),
    }),
  ).min(1).max(12),
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
