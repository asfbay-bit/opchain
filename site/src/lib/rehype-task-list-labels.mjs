// rehype plugin — wraps GFM task-list checkboxes in an accessible label.
//
// Astro's GFM pipeline emits each task-list item as:
//   <li class="task-list-item">
//     <input type="checkbox" disabled [checked]>
//     <text or inline children>
//   </li>
//
// The bare <input> has no associated <label> and no aria-label, so axe's
// `label` rule (WCAG 1.3.1, 4.1.2) flags it. The checkboxes are also
// `disabled`, so they're decorative — the surrounding <li> text already
// describes the state. We solve both by giving the input an explicit
// aria-label derived from the li's text content, prefixed with the
// completion state so the reading order ("Done: …" / "Todo: …") matches
// what a sighted user infers from the visual checkmark.
//
// Why aria-label rather than a real <label>: wrapping the checkbox in a
// <label> would require restructuring the li's children, which breaks
// nested markdown (a paragraph inside a task item, for instance). aria-
// label is single-attribute, additive, and ignored by browsers that
// already render the disabled checkbox decoratively.
//
// Tracked under B-11 in roadmap/05-post-sprint-7-backlog.md.

import { visit } from "unist-util-visit";

const STATE_LABEL = { true: "Done", false: "Todo" };

export function rehypeTaskListLabels() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "li") return;
      if (!hasClass(node, "task-list-item")) return;
      const checkbox = (node.children ?? []).find(
        (c) =>
          c.type === "element" &&
          c.tagName === "input" &&
          c.properties?.type === "checkbox",
      );
      if (!checkbox) return;
      // Skip if the markdown author already supplied a label.
      if (
        checkbox.properties?.["aria-label"] ||
        checkbox.properties?.["aria-labelledby"]
      ) {
        return;
      }
      const text = textOf(node).trim();
      if (!text) return;
      const checked = checkbox.properties?.checked === true;
      checkbox.properties = {
        ...checkbox.properties,
        "aria-label": `${STATE_LABEL[String(checked)]}: ${text}`,
      };
    });
  };
}

function hasClass(node, name) {
  const cls = node.properties?.className;
  if (!cls) return false;
  if (Array.isArray(cls)) return cls.includes(name);
  return typeof cls === "string" && cls.split(/\s+/).includes(name);
}

function textOf(node) {
  if (node.type === "text") return node.value ?? "";
  // Skip nested input/checkbox — we want the surrounding text, not the box.
  if (node.type === "element" && node.tagName === "input") return "";
  return (node.children ?? []).map(textOf).join("");
}
