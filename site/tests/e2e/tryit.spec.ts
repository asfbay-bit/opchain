import { test, expect } from "@playwright/test";

/**
 * Sprint 7a: Try-It UX flow with the Worker mocked.
 * Closes Sprint 4 DoD: email submit reveals chat; counter decrements.
 *
 * Mocks /api/try/start (gate) and /api/try/chat (SSE stream) so the test
 * doesn't depend on the Worker being up or burn Anthropic credits.
 */

test("tryit: gate → chat → counter decrements", async ({ page }) => {
  // Gate mock — accepts any email, returns a fake session token + 5 remaining.
  await page.route("**/api/try/start", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session_token: "test-session-token",
        remaining: 5,
      }),
    });
  });

  // Chat mock — SSE response with two `data:` events: text + done.
  await page.route("**/api/try/chat", async (route) => {
    const sse =
      `data: ${JSON.stringify({ text: "Hello from the e2e mock." })}\n\n` +
      `data: ${JSON.stringify({ done: true, remaining: 4 })}\n\n`;
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sse,
    });
  });

  // /tryit folded into /demo; Live tab via the hash. The demo page's
  // hash-driven tab switcher reveals the Live panel where TryIt is mounted.
  await page.goto("/demo#live");

  // Gate is visible; chat input is below it (still rendered, just preceded
  // by the gate). Check the gate by its form id.
  const gate = page.locator("#tryit-gate");
  await expect(gate).toBeVisible();

  // Submit a valid-looking email.
  await page.locator("#tryit-email").fill("e2e-tester@opchain.dev");
  await page.locator("#tryit-gate-form button[type=submit]").click();

  // Gate hides; counter shows 5 of 5.
  await expect(gate).toBeHidden();
  await expect(page.locator("#tryit-counter")).toHaveText(/5 of 5 exchanges remaining/);

  // Send a message.
  await page.locator("#tryit-message").fill("ping");
  await page.locator("#tryit-input-form button[type=submit]").click();

  // Assistant bubble eventually contains the mocked text. The intro
  // prompt was removed (PR-E 5.6.1), so the assistant response to "ping"
  // is the FIRST assistant bubble in the transcript now.
  const assistantBubbles = page.locator(".msg--assistant .msg-content");
  await expect(assistantBubbles.nth(0)).toContainText("Hello from the e2e mock.", { timeout: 5_000 });

  // Counter decremented.
  await expect(page.locator("#tryit-counter")).toHaveText(/4 of 5 exchanges remaining/);
});
