// Linear feedback config used by the /api/feedback handler. Extracted from
// src/index.js so the Worker entry module exports only its default handler
// (workerd rejects non-handler named exports on the entry module).

// Defaults preserved so existing production deploys keep working if the env
// vars aren't set — but env.LINEAR_TEAM_ID / LINEAR_PROJECT_ID override them.
export const DEFAULT_TEAM_ID = "7548a4f9-6ed3-42a6-9130-3b2b45db3c5c";
export const DEFAULT_PROJECT_ID = "7a8ea196-9a52-4efb-b997-003cb48a3f1a";

export const LABEL_MAP = {
  bug: "68403073-fd71-44aa-95bc-aea91ed7e4de",
  feature: "a9f89cba-878b-4c2e-a9e4-871866a03592",
  improvement: "e9956661-28ed-4ca2-8d54-8e5457bbb773",
  general: "ec0403ab-31b9-4aa6-a097-e54e4bbff69c",
  // Security disclosures: ops should create a dedicated "security"
  // label in Linear and override this via env.LINEAR_SECURITY_LABEL_ID.
  // Until then, fall back to the bug label so the issue still gets
  // categorised — the [SECURITY] title prefix and forced P1 priority
  // (see handleFeedback) keep it visible regardless.
  security: "68403073-fd71-44aa-95bc-aea91ed7e4de",
};

export const PRIORITY_MAP = { 0: 0, 1: 4, 2: 3, 3: 2, 4: 1 };

// Linear's priority scale: 1=urgent, 2=high, 3=medium, 4=low, 0=none.
// Security severity → Linear priority. Unconditional — the form's
// "severity" field never lets a reporter downgrade past Linear high.
export const SECURITY_PRIORITY = {
  critical: 1, // Urgent
  high:     1, // Urgent (treat high-severity disclosures as urgent for triage)
  medium:   2, // High
  low:      3, // Medium
};

export const LINEAR_MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url }
  }
}`;
