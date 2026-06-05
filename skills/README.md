# opchain dev skills ecosystem

A full concept-to-ops software development pipeline for Claude — one skill per
phase, a shared checkpoint protocol that carries context across sessions.

## Installation (Claude.ai / Cowork)

1. Go to Settings → Customize → Skills
2. Upload each .zip file
3. Delete any existing tri-dev skill (merged into oc-app-architect)

## Installation (Claude Code)

1. Unzip all skills into `.claude/skills/` in your repo
2. Claude Code auto-discovers them at startup

## Skills

| Skill | Phase | Role |
|---|---|---|
| oc-checkpoint-protocol    | foundation  | Session persistence (bundled in all skills) |
| oc-orchestrator           | foundation  | `/oc-ops` — multi-project registry, status, routing |
| oc-reverse-spec           | plan        | Code → spec docs |
| oc-stack-forge            | plan        | Universal stack advisor |
| oc-ux-engineer            | plan+build  | Tri-design harness |
| oc-dash-forge             | plan        | Dashboards + dense data UI (spec + React prototype) |
| oc-scale-ops              | plan        | Scaling readiness |
| oc-app-architect          | plan+build  | Unified planning + build harness |
| oc-integrations-engineer  | plan+build  | API integration harness (third-party APIs you consume) |
| oc-api-dev                | plan+build  | First-party API design + build harness (OpenAPI, versioning, SDKs) |
| oc-migration-ops          | plan+build  | `/oc-migrate` — DB / framework / auth / platform migrations |
| oc-code-auditor           | build       | Auditor → Fixer → Verifier |
| oc-security-auditor       | build       | Threat modeling, OWASP hardening, attack-surface review |
| oc-git-ops                | build       | Git workflow |
| oc-deploy-ops             | build       | Deployment pipeline |
| oc-monitoring-ops         | build       | Post-deploy observability — uptime, errors, alerts, incidents |

## More info

https://opchain.dev
