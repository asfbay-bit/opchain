(function () {
  'use strict';

  var MAX_EXCHANGES = 5;
  var skills = window.OPCHAIN_SKILLS || [];

  // Starter prompts per skill
  var STARTERS = {
    'app-architect': [
      'I want to build a habit tracking app',
      'Plan a SaaS analytics dashboard',
      'Design a recipe sharing platform',
    ],
    'reverse-spec': [
      'I have a Next.js e-commerce app with 30+ components',
      'My Flask API needs architecture documentation',
      'Audit my React component library structure',
    ],
    'stack-forge': [
      'I need a real-time chat app stack',
      'What stack for a content management system?',
      'Best approach for a mobile-first marketplace?',
    ],
    'ux-engineer': [
      'Design a fitness app onboarding flow',
      'Style guide for a developer tools site',
      'Wireframe a social media dashboard',
    ],
    'code-auditor': [
      'Review my authentication middleware',
      'Audit this database query handler',
      'Check my API rate limiting code',
    ],
    'integrations-engineer': [
      'Integrate Stripe payments into my app',
      'Connect to the GitHub API for repo analytics',
      'Set up OAuth with Google for my SaaS',
    ],
    'scale-ops': [
      'My app gets 10k requests/min, what should I do?',
      'How to cache this PostgreSQL-heavy app?',
      'Load balancing strategy for microservices',
    ],
    'git-ops': [
      'Set up a monorepo workflow for 4 devs',
      'Branch strategy for a solo project',
      'PR review process for a startup team',
    ],
    'deploy-ops': [
      'Deploy a Next.js app to Cloudflare',
      'CI/CD pipeline for a Python API',
      'Zero-downtime deployment strategy',
    ],
  };

  // Skill intro messages
  var INTROS = {
    'app-architect': 'You\'re chatting with <strong>App Architect</strong>. Describe your app idea and it will run a discovery interview, then produce a mini-spec.',
    'reverse-spec': 'You\'re chatting with <strong>Reverse Spec</strong>. Describe your existing codebase and it will generate structured specification documents.',
    'stack-forge': 'You\'re chatting with <strong>Stack Forge</strong>. Tell it what you\'re building and it will recommend a complete tech stack with rationale.',
    'ux-engineer': 'You\'re chatting with <strong>UX Engineer</strong>. Describe your app concept and it will produce a mini style book with design tokens.',
    'code-auditor': 'You\'re chatting with <strong>Code Auditor</strong>. Share a code snippet or describe what to audit and it will produce a quality report.',
    'integrations-engineer': 'You\'re chatting with <strong>Integrations Engineer</strong>. Tell it what services to integrate and it will produce an implementation plan.',
    'scale-ops': 'You\'re chatting with <strong>Scale Ops</strong>. Describe your architecture and traffic patterns for a scaling assessment.',
    'git-ops': 'You\'re chatting with <strong>Git Ops</strong>. Describe your team and workflow for a git strategy recommendation.',
    'deploy-ops': 'You\'re chatting with <strong>Deploy Ops</strong>. Describe your stack and targets for a deployment pipeline plan.',
  };

  // DOM refs
  var gateEl = document.getElementById('tryit-gate');
  var gateFormEl = document.getElementById('tryit-gate-form');
  var emailEl = document.getElementById('tryit-email');
  var gateErrorEl = document.getElementById('tryit-gate-error');
  var appEl = document.getElementById('tryit-app');
  var skillsEl = document.getElementById('tryit-skills');
  var chatEl = document.getElementById('tryit-chat');
  var messagesEl = document.getElementById('tryit-messages');
  var introEl = document.getElementById('tryit-intro');
  var startersEl = document.getElementById('tryit-starters');
  var inputRowEl = document.getElementById('tryit-input-row');
  var inputEl = document.getElementById('tryit-input');
  var sendEl = document.getElementById('tryit-send');
  var counterEl = document.getElementById('tryit-counter');
  var completeEl = document.getElementById('tryit-complete');

  // State
  var sessionToken = null;
  var currentSkill = null;
  var messages = []; // { role, content }
  var remaining = MAX_EXCHANGES;
  var isSending = false;

  // ── Email gate ──

  gateFormEl.addEventListener('submit', function (e) {
    e.preventDefault();
    submitEmail();
  });

  function submitEmail() {
    var email = emailEl.value.trim();
    if (!email) return;

    gateErrorEl.hidden = true;
    var btn = gateFormEl.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'starting…';

    fetch('/api/try/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          showGateError(data.error);
          btn.disabled = false;
          btn.textContent = 'start';
          return;
        }
        sessionToken = data.session_token;
        remaining = data.remaining;
        sessionStorage.setItem('opchain-try-token', sessionToken);
        sessionStorage.setItem('opchain-try-remaining', String(remaining));
        showApp();
      })
      .catch(function () {
        showGateError('Could not connect. Please try again.');
        btn.disabled = false;
        btn.textContent = 'start';
      });
  }

  function showGateError(msg) {
    gateErrorEl.textContent = msg;
    gateErrorEl.hidden = false;
  }

  // ── App init ──

  function showApp() {
    gateEl.hidden = true;
    appEl.hidden = false;
    buildSkillPills();
    updateCounter();
  }

  // Restore session on page load
  var savedToken = sessionStorage.getItem('opchain-try-token');
  var savedRemaining = sessionStorage.getItem('opchain-try-remaining');
  if (savedToken) {
    sessionToken = savedToken;
    remaining = savedRemaining ? parseInt(savedRemaining, 10) : MAX_EXCHANGES;
    showApp();
    if (remaining <= 0) {
      showComplete();
    }
  }

  // ── Skill pills ──

  function buildSkillPills() {
    skillsEl.innerHTML = '';
    // Only show skills that have system prompts (all 9 tryable skills)
    var tryableIds = Object.keys(STARTERS);
    var tryableSkills = skills.filter(function (s) { return tryableIds.indexOf(s.id) !== -1; });

    tryableSkills.forEach(function (s) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tryit-skill-pill';
      btn.dataset.skill = s.id;
      btn.textContent = s.name;
      btn.addEventListener('click', function () { selectSkill(s.id); });
      skillsEl.appendChild(btn);
    });
  }

  function selectSkill(skillId) {
    if (isSending) return;
    currentSkill = skillId;
    messages = [];

    // Update pill active states
    var pills = skillsEl.querySelectorAll('.tryit-skill-pill');
    pills.forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.skill === skillId ? 'true' : 'false');
    });

    // Clear and set intro
    messagesEl.innerHTML = '';
    introEl = document.createElement('div');
    introEl.className = 'tryit-intro';
    introEl.innerHTML = INTROS[skillId] || 'Select a skill above to get started.';
    messagesEl.appendChild(introEl);

    // Show starter prompts
    showStarters(skillId);

    // Show input row
    inputRowEl.hidden = false;
    inputEl.disabled = false;
    inputEl.value = '';
    sendEl.disabled = false;
    completeEl.hidden = true;
    updateCounter();
    inputEl.focus();
  }

  // ── Starter prompts ──

  function showStarters(skillId) {
    var prompts = STARTERS[skillId] || [];
    if (prompts.length === 0) {
      startersEl.hidden = true;
      return;
    }
    startersEl.innerHTML = '';
    prompts.forEach(function (text) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tryit-starter';
      chip.textContent = text;
      chip.addEventListener('click', function () {
        inputEl.value = text;
        sendMessage();
      });
      startersEl.appendChild(chip);
    });
    startersEl.hidden = false;
  }

  // ── Send message ──

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  sendEl.addEventListener('click', function () { sendMessage(); });

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || isSending || !currentSkill || !sessionToken) return;
    if (remaining <= 0) return;

    isSending = true;
    inputEl.disabled = true;
    sendEl.disabled = true;
    startersEl.hidden = true;

    // Add user message
    messages.push({ role: 'user', content: text });
    addMessageBubble('user', text);
    inputEl.value = '';

    // Add assistant placeholder
    var assistantEl = addMessageBubble('assistant', '');
    assistantEl.classList.add('tryit-streaming');

    // Stream from API
    fetch('/api/try/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skill: currentSkill,
        messages: messages,
        session_token: sessionToken,
      }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error(data.error || 'Request failed');
          });
        }
        return readStream(res, assistantEl);
      })
      .then(function (fullText) {
        assistantEl.classList.remove('tryit-streaming');
        messages.push({ role: 'assistant', content: fullText });
        updateCounter();

        if (remaining <= 0) {
          showComplete();
        } else {
          isSending = false;
          inputEl.disabled = false;
          sendEl.disabled = false;
          inputEl.focus();
        }
      })
      .catch(function (err) {
        assistantEl.classList.remove('tryit-streaming');
        var content = assistantEl.querySelector('.tryit-msg-content');
        if (content) {
          content.innerHTML = '<span class="tryit-error-inline">' + escapeHtml(err.message) + '</span>';
        }
        // Remove the failed user message from history so they can retry
        messages.pop();
        isSending = false;
        inputEl.disabled = false;
        sendEl.disabled = false;

        if (err.message.indexOf('free exchanges') !== -1 || err.message.indexOf('exchanges reached') !== -1) {
          remaining = 0;
          showComplete();
        }
      });
  }

  // ── Streaming ──

  function readStream(response, containerEl) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var fullText = '';
    var contentEl = containerEl.querySelector('.tryit-msg-content');

    function processChunk() {
      return reader.read().then(function (result) {
        if (result.done) return fullText;

        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop();

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (line.startsWith('data: ')) {
            var data = line.slice(6);
            try {
              var event = JSON.parse(data);
              if (event.text) {
                fullText += event.text;
                contentEl.innerHTML = renderMarkdown(fullText);
                scrollToBottom();
              }
              if (event.done && event.remaining !== undefined) {
                remaining = event.remaining;
                sessionStorage.setItem('opchain-try-remaining', String(remaining));
              }
              if (event.error) {
                contentEl.innerHTML += '<span class="tryit-error-inline">' + escapeHtml(event.error) + '</span>';
              }
            } catch (e) { /* skip unparseable */ }
          }
        }

        return processChunk();
      });
    }

    return processChunk();
  }

  // ── UI helpers ──

  function addMessageBubble(role, content) {
    var wrapper = document.createElement('div');
    wrapper.className = 'tryit-msg tryit-msg--' + role;

    var label = document.createElement('div');
    label.className = 'tryit-msg-label';
    label.textContent = role === 'user' ? 'You' : currentSkill ? formatSkillName(currentSkill) : 'Assistant';

    var contentEl = document.createElement('div');
    contentEl.className = 'tryit-msg-content';
    if (content) {
      contentEl.innerHTML = role === 'user' ? escapeHtml(content) : renderMarkdown(content);
    }

    wrapper.appendChild(label);
    wrapper.appendChild(contentEl);
    messagesEl.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  function scrollToBottom() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function updateCounter() {
    if (remaining <= 0) {
      counterEl.textContent = 'No exchanges remaining';
      counterEl.hidden = false;
      return;
    }
    counterEl.textContent = remaining + ' of ' + MAX_EXCHANGES + ' exchanges remaining';
    counterEl.hidden = false;
  }

  function showComplete() {
    inputRowEl.hidden = true;
    startersEl.hidden = true;
    completeEl.hidden = false;
    isSending = false;
  }

  function formatSkillName(id) {
    var skill = skills.find(function (s) { return s.id === id; });
    return skill ? skill.name : id;
  }

  // ── Markdown renderer (simple) ──

  function renderMarkdown(text) {
    // Escape HTML first
    var html = escapeHtml(text);

    // Extract code blocks into placeholders to protect them from line-break processing
    var codeBlocks = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      var idx = codeBlocks.length;
      codeBlocks.push('<pre class="tryit-code"><code>' + code + '</code></pre>');
      return '\x00CODEBLOCK' + idx + '\x00';
    });

    // Inline code (extract to protect from further processing)
    var inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, function (_, code) {
      var idx = inlineCodes.length;
      inlineCodes.push('<code class="tryit-inline-code">' + code + '</code>');
      return '\x00INLINE' + idx + '\x00';
    });

    // Headers
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold (before italic to avoid conflict)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic (match *text* but not inside already-rendered tags)
    html = html.replace(/(^|[\s(>])\*([^\s*][^*]*?[^\s*])\*([\s,.):<]|$)/g, '$1<em>$2</em>$3');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

    // Numbered lists (convert before wrapping so both types get wrapped)
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Wrap consecutive <li> elements in <ul>
    html = html.replace(/((?:<li>[\s\S]*?<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Line breaks (double newline = paragraph break)
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }

    // Restore code blocks and inline code
    for (var i = 0; i < codeBlocks.length; i++) {
      html = html.replace('\x00CODEBLOCK' + i + '\x00', codeBlocks[i]);
    }
    for (var j = 0; j < inlineCodes.length; j++) {
      html = html.replace('\x00INLINE' + j + '\x00', inlineCodes[j]);
    }

    return html;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Auto-resize textarea ──

  inputEl.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });
})();
