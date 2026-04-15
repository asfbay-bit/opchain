/**
 * Skill Library — data and client-side filter (static opchain site).
 * Phase ids: all | foundation | plan | plan-build | build
 */
window.OPCHAIN_SKILLS = [
  {
    id: 'checkpoint-protocol',
    name: 'Checkpoint Protocol',
    short: 'Session persistence across skills.',
    phases: ['foundation'],
    triAgent: false,
    doc: '/docs/checkpoint-protocol/SKILL.md',
  },
  {
    id: 'reverse-spec',
    name: 'Reverse Spec',
    short: 'Turn existing code into pipeline-ready specs.',
    phases: ['plan'],
    triAgent: false,
    doc: '/docs/reverse-spec/SKILL.md',
  },
  {
    id: 'app-architect',
    name: 'App Architect',
    short: 'Idea → spec → design → build → launch in one skill.',
    phases: ['plan', 'build'],
    triAgent: true,
    doc: '/docs/app-architect/SKILL.md',
  },
  {
    id: 'stack-forge',
    name: 'Stack Forge',
    short: 'Stack decisions, Cloudflare patterns, typed pipeline.',
    phases: ['plan', 'build'],
    triAgent: false,
    doc: '/docs/stack-forge/SKILL.md',
  },
  {
    id: 'ux-engineer',
    name: 'UX Engineer',
    short: 'Design Planner → Generator → Evaluator harness.',
    phases: ['plan'],
    triAgent: true,
    doc: '/docs/ux-engineer/SKILL.md',
  },
  {
    id: 'code-auditor',
    name: 'Code Auditor',
    short: 'Auditor → Fixer → Verifier quality loop.',
    phases: ['build'],
    triAgent: true,
    doc: '/docs/code-auditor/SKILL.md',
  },
  {
    id: 'integrations-engineer',
    name: 'Integrations Engineer',
    short: 'Third-party APIs, OAuth, webhooks.',
    phases: ['build'],
    triAgent: true,
    doc: '/docs/integrations-engineer/SKILL.md',
  },
  {
    id: 'scale-ops',
    name: 'Scale Ops',
    short: 'Load, caching, capacity planning.',
    phases: ['plan'],
    triAgent: false,
    doc: '/docs/scale-ops/SKILL.md',
  },
  {
    id: 'git-ops',
    name: 'Git Ops',
    short: 'Branch, commit, PR, sync workflows.',
    phases: ['build'],
    triAgent: false,
    doc: '/docs/git-ops/SKILL.md',
  },
  {
    id: 'deploy-ops',
    name: 'Deploy Ops',
    short: 'Audit gate → staging → production → monitoring.',
    phases: ['build'],
    triAgent: false,
    doc: '/docs/deploy-ops/SKILL.md',
  },
];

window.OPCHAIN_PHASES = [
  { id: 'all', label: 'All' },
  { id: 'foundation', label: 'Foundation' },
  { id: 'plan', label: 'Plan' },
  { id: 'plan-build', label: 'Plan + build' },
  { id: 'build', label: 'Build' },
];
