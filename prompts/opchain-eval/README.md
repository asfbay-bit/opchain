# opchain-eval

opchain's own eval set — the dogfooding artifact for `oc-prompt-ops` / `/oc-prompt eval`.

It evaluates **opchain routing**: given a natural-language dev request, does
opchain pick the correct skill and its canonical entry command? That exercises
the two surfaces that decide which skill triggers — each skill's `description:`
frontmatter and the orchestrator routing table — so trigger-copy drift shows up
as a failing case instead of a silent mis-route in production.

## Files

| File | Shape |
|---|---|
| `inputs.jsonl` | one `{id, input}` per line — the request |
| `expected.jsonl` | one `{id, expect:{mode:"contains", all:[<skill>, <command>]}}` per line — the route the answer must name |
| `eval.yaml` | default grader (`contains`) + `pass_rate` / `regression_epsilon` thresholds |

## Run it

```
/oc-prompt eval prompts/opchain-eval
```

`oc-prompt-ops` joins inputs↔expected on `id`, routes each input, grades against
the rubric in `eval.yaml`, and compares the mean score to the stored baseline
(see `skills/oc-prompt-ops/references/drift-detection.md`). CI validates that the
set parses and that every `expected.skill` is a real skill and every
`expected.command` verb is a registered command (`tests/opchain-eval.test.js`).

## Extending

Add a paired line to `inputs.jsonl` and `expected.jsonl` with a new unique `id`.
In `expect.all`, name a real `skills/<id>` directory and a registered `/verb`.
Re-run the test to keep the set honest.
