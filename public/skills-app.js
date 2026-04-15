(function () {
  const skills = window.OPCHAIN_SKILLS || [];
  const phaseDefs = window.OPCHAIN_PHASES || [];

  const qEl = document.getElementById('skill-search');
  const triEl = document.getElementById('tri-only');
  const selectEl = document.getElementById('phase-select');
  const pillsEl = document.getElementById('phase-pills');
  const listEl = document.getElementById('skill-list');
  const countEl = document.getElementById('skill-count');

  let phase = 'all';

  function phaseMatch(skill) {
    if (phase === 'all') return true;
    const p = skill.phases || [];
    const hasPlan = p.includes('plan');
    const hasBuild = p.includes('build');
    if (phase === 'foundation') return p.includes('foundation');
    if (phase === 'plan') return hasPlan && !hasBuild;
    if (phase === 'build') return hasBuild && !hasPlan;
    if (phase === 'plan-build') return hasPlan && hasBuild;
    return true;
  }

  function textMatch(skill, q) {
    if (!q) return true;
    const hay = (skill.name + ' ' + skill.short + ' ' + skill.id).toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function render() {
    const q = (qEl && qEl.value) || '';
    const triOnly = triEl && triEl.checked;
    const filtered = skills.filter(
      (s) => phaseMatch(s) && textMatch(s, q) && (!triOnly || s.triAgent),
    );

    if (countEl) {
      countEl.textContent =
        'Showing ' + filtered.length + ' of ' + skills.length + ' skills';
    }

    if (!listEl) return;
    listEl.innerHTML = '';
    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'meta';
      empty.textContent = 'No skills match these filters.';
      listEl.appendChild(empty);
      return;
    }

    for (const s of filtered) {
      const card = document.createElement('article');
      card.className = 'skill-card';
      const phaseLabel = (s.phases || [])
        .map((x) =>
          x === 'plan'
            ? 'Plan'
            : x === 'build'
              ? 'Build'
              : x === 'foundation'
                ? 'Foundation'
                : x,
        )
        .join(' · ');
      card.innerHTML =
        '<h2>' +
        escapeHtml(s.name) +
        '</h2>' +
        '<span class="skill-tag">' +
        escapeHtml(phaseLabel || 'Skill') +
        '</span>' +
        (s.triAgent ? '<span class="skill-tag">Tri-agent</span>' : '') +
        '<p class="skill-desc">' +
        escapeHtml(s.short) +
        '</p>' +
        '<div class="skill-actions"><a href="' +
        escapeAttr(s.doc) +
        '">View docs</a></div>';
      listEl.appendChild(card);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  function setPhase(next) {
    phase = next;
    if (selectEl) selectEl.value = phase;
    if (pillsEl) {
      pillsEl.querySelectorAll('.phase-pill').forEach((btn) => {
        btn.setAttribute('aria-pressed', btn.dataset.phase === phase ? 'true' : 'false');
      });
    }
    render();
  }

  if (selectEl) {
    phaseDefs.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.label;
      selectEl.appendChild(opt);
    });
    selectEl.value = 'all';
    selectEl.addEventListener('change', () => setPhase(selectEl.value));
  }

  if (pillsEl) {
    phaseDefs.forEach((d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'phase-pill';
      btn.dataset.phase = d.id;
      btn.textContent = d.label;
      btn.setAttribute('aria-pressed', d.id === 'all' ? 'true' : 'false');
      btn.addEventListener('click', () => setPhase(d.id));
      pillsEl.appendChild(btn);
    });
  }

  if (qEl) qEl.addEventListener('input', render);
  if (triEl) triEl.addEventListener('change', render);

  setPhase('all');
})();
