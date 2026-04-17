/**
 * Render Markdown → HTML for the Try-It chat transcript, then sanitize.
 *
 * The output feeds `innerHTML`, so every render path goes through DOMPurify.
 * We run it in the browser (DOMPurify needs a DOM). The hook strips any href
 * that isn't http(s)/mailto/#-anchor so a model output like `[x](javascript:…)`
 * can't smuggle a protocol handler through.
 */
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: true });

const SAFE_SCHEME = /^(https?:|mailto:|#)/i;

let hookInstalled = false;
function ensureHook() {
  if (hookInstalled) return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";
      if (!SAFE_SCHEME.test(href)) {
        node.removeAttribute("href");
      } else {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
  });
  hookInstalled = true;
}

export function renderSafeMarkdown(source: string): string {
  ensureHook();
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "iframe", "form", "object", "embed", "input", "textarea"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "style"],
  });
}
