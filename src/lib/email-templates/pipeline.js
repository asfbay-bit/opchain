/**
 * Pipeline email renderer — used by POST /api/email-pipeline.
 *
 * Renders a table-based HTML email summarising the user's
 * /pipeline-builder result: their four wizard answers, the recommended
 * skill set, and a numbered next-steps checklist. Plain-text fallback is
 * short and links-only.
 *
 * Constraints:
 *   - Every interpolated value comes from user input (or wizard state
 *     derived from user input). escapeHtml is applied to every cell —
 *     do NOT bypass it.
 *   - No external images, fonts, scripts, or stylesheets. Some mail
 *     clients strip <style> blocks; the layout still has to be
 *     readable without them, hence inline `style="..."` on each cell.
 *   - No tracking pixel.
 *   - Dark-mode-safe: colours have enough contrast against both light
 *     and dark client themes; the background is left to the client.
 */

const SITE_ORIGIN = "https://opchain.dev";

const ANSWER_LABELS = {
  kind: "Project kind",
  team: "Team size",
  deploy: "Deploy target",
  aiSurface: "Claude surface",
};

const NEXT_STEPS = [
  {
    title: "Install the recommended skills",
    body:
      'Drop `.claude/skills/` from <a href="' +
      SITE_ORIGIN +
      '/install" style="color:#bf8b3b;text-decoration:underline;">opchain.dev/install</a> into your repo (or upload each SKILL.md in the Claude.ai settings).',
  },
  {
    title: "Add the CLAUDE.md scaffold",
    body:
      "Copy the CLAUDE.md starter from your /pipeline-builder result into the repo root so every session boots with the right context.",
  },
  {
    title: "Run /orchestrator in your first session",
    body:
      "Type <code>/orchestrator</code> (or <code>/ops</code>) in Claude Code to confirm checkpoints are wired and the skills resolved correctly.",
  },
  {
    title: "Ship with deploy-ops",
    body:
      "When you're ready, deploy via <code>/deploy staging</code> then <code>/deploy prod</code> — the audit gate runs before either.",
  },
];

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function answersRows(answers) {
  return Object.entries(ANSWER_LABELS)
    .map(([key, label]) => {
      const raw = answers?.[key] ?? "";
      return (
        '<tr>' +
        '<td style="padding:6px 0;color:#6b6457;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;width:140px;vertical-align:top;">' +
        escapeHtml(label) +
        '</td>' +
        '<td style="padding:6px 0;color:#1c1710;font-size:14px;vertical-align:top;">' +
        escapeHtml(raw) +
        '</td>' +
        '</tr>'
      );
    })
    .join("");
}

function skillsRows(skills) {
  return skills
    .map((s) => {
      const id = encodeURIComponent(String(s.id || "").trim());
      const href = id ? SITE_ORIGIN + "/skills/" + id : SITE_ORIGIN + "/skills";
      return (
        '<tr><td style="padding:10px 0;border-top:1px solid #e6dfd1;">' +
        '<a href="' +
        escapeHtml(href) +
        '" style="color:#1c1710;font-weight:600;text-decoration:none;font-size:15px;">' +
        escapeHtml(s.name) +
        '</a>' +
        '<div style="margin-top:2px;color:#5b5447;font-size:13px;line-height:1.45;">' +
        escapeHtml(s.summary) +
        '</div></td></tr>'
      );
    })
    .join("");
}

function nextStepsRows() {
  return NEXT_STEPS.map((step, i) => {
    return (
      '<tr><td style="padding:8px 0;vertical-align:top;width:24px;color:#bf8b3b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:600;">' +
      String(i + 1).padStart(2, "0") +
      '</td>' +
      '<td style="padding:8px 0;color:#1c1710;font-size:14px;line-height:1.5;">' +
      '<strong style="font-weight:600;">' +
      escapeHtml(step.title) +
      '</strong><br />' +
      '<span style="color:#5b5447;">' +
      step.body +
      '</span></td></tr>'
    );
  }).join("");
}

/**
 * Build the rich HTML email body.
 *
 * @param {{ name: string, answers: object, skills: Array<{id:string,name:string,summary:string}> }} input
 */
export function buildPipelineEmailHtml({ name, answers, skills }) {
  const safeName = escapeHtml(name);
  return (
    '<!doctype html><html><body style="margin:0;padding:0;background:#f5f0e6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1710;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f0e6;padding:24px 0;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fbf7ee;border:1px solid #e6dfd1;border-radius:8px;">' +
    // ── Header ───────────────────────────────────────────────
    '<tr><td style="padding:24px 28px 8px 28px;">' +
    '<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#bf8b3b;">opchain pipeline</div>' +
    '<h1 style="margin:6px 0 0;font-size:22px;font-weight:600;color:#1c1710;letter-spacing:-0.01em;">Hi ' +
    safeName +
    ', here’s your stack.</h1>' +
    '<p style="margin:10px 0 0;color:#5b5447;font-size:14px;line-height:1.5;">' +
    'Based on what you told us, this is the opchain pipeline we recommend. Save this email; everything links back to <a href="' +
    SITE_ORIGIN +
    '" style="color:#bf8b3b;text-decoration:underline;">opchain.dev</a>.</p>' +
    '</td></tr>' +
    // ── Wizard answers ───────────────────────────────────────
    '<tr><td style="padding:20px 28px 0 28px;">' +
    '<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#bf8b3b;margin-bottom:6px;">your answers</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    answersRows(answers) +
    '</table>' +
    '</td></tr>' +
    // ── Recommended skills ───────────────────────────────────
    '<tr><td style="padding:24px 28px 0 28px;">' +
    '<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#bf8b3b;margin-bottom:6px;">recommended skills</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    skillsRows(skills) +
    '</table>' +
    '</td></tr>' +
    // ── Next steps ──────────────────────────────────────────
    '<tr><td style="padding:24px 28px 0 28px;">' +
    '<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#bf8b3b;margin-bottom:6px;">next steps</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    nextStepsRows() +
    '</table>' +
    '</td></tr>' +
    // ── Footer ──────────────────────────────────────────────
    '<tr><td style="padding:24px 28px 24px 28px;border-top:1px solid #e6dfd1;">' +
    '<p style="margin:0;color:#8a8273;font-size:12px;line-height:1.5;">' +
    'Sent because you asked /pipeline-builder to email you the result. We don’t share your address. ' +
    '<a href="' +
    SITE_ORIGIN +
    '/privacy" style="color:#bf8b3b;text-decoration:underline;">Privacy</a>.</p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>'
  );
}

/**
 * Plain-text fallback. Short, links visible, no formatting tricks.
 *
 * @param {{ name: string, answers: object, skills: Array<{id:string,name:string,summary:string}> }} input
 */
export function buildPipelineEmailText({ name, answers, skills }) {
  const safeName = String(name || "there");
  const ans = Object.entries(ANSWER_LABELS)
    .map(([k, label]) => "  " + label + ": " + (answers?.[k] ?? ""))
    .join("\n");
  const skillsList = skills
    .map((s) => {
      const id = encodeURIComponent(String(s.id || "").trim());
      const url = id ? SITE_ORIGIN + "/skills/" + id : SITE_ORIGIN + "/skills";
      return "  - " + s.name + " — " + s.summary + "\n    " + url;
    })
    .join("\n");
  const steps = NEXT_STEPS.map(
    (s, i) => "  " + String(i + 1).padStart(2, "0") + ". " + s.title,
  ).join("\n");
  return [
    "Hi " + safeName + ",",
    "",
    "Here is your opchain pipeline.",
    "",
    "Your answers:",
    ans,
    "",
    "Recommended skills:",
    skillsList,
    "",
    "Next steps:",
    steps,
    "",
    "Everything links back to " + SITE_ORIGIN + ".",
    "",
    "— opchain",
  ].join("\n");
}
