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

/** POST /api/try/start */
export const TryStartSchema = z.object({
  email,
});

const ChatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

/** POST /api/try/chat */
export const TryChatSchema = z.object({
  session_token: z.string().min(10).max(2000),
  skill: z.string().min(1).max(60),
  messages: z.array(ChatMessage).min(1).max(20),
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
