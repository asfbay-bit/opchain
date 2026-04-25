# opchain dev skills ecosystem

A full concept-to-ops software development pipeline for Claude — one skill per
phase, a shared checkpoint protocol that carries context across sessions.

## Installation (Claude.ai / Cowork)

1. Go to Settings → Customize → Skills
2. Upload each .zip file
3. Delete any existing tri-dev skill (merged into app-architect)

## Installation (Claude Code)

1. Unzip all skills into `.claude/skills/` in your repo
2. Claude Code auto-discovers them at startup

## Skills

| Skill | Phase | Role |
|---|---|---|
| checkpoint-protocol    | foundation  | Session persistence (bundled in all skills) |
| orchestrator           | foundation  | `/ops` — multi-project registry, status, routing |
| reverse-spec           | plan        | Code → spec docs |
| stack-forge            | plan        | Universal stack advisor |
| ux-engineer            | plan+build  | Tri-design harness |
| dash-forge             | plan        | Dashboards + dense data UI (spec + React prototype) |
| scale-ops              | plan        | Scaling readiness |
| app-architect          | plan+build  | Unified planning + build harness |
| integrations-engineer  | plan+build  | API integration harness |
| migration-ops          | plan+build  | `/migrate` — DB / framework / auth / platform migrations |
| code-auditor           | build       | Auditor → Fixer → Verifier |
| security-auditor       | build       | Threat modeling, OWASP hardening, attack-surface review |
| git-ops                | build       | Git workflow |
| deploy-ops             | build       | Deployment pipeline |
| monitoring-ops         | build       | Post-deploy observability — uptime, errors, alerts, incidents |

## More info

https://opchain.dev
