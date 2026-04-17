/**
 * opchain theme toggle.
 *
 * Companion to the inline FOUC script in each HTML file's <head>. That
 * script sets data-theme before paint. This file wires the click behavior
 * on the header's .theme-toggle button.
 */
(function () {
  'use strict';

  var btn = document.querySelector('.theme-toggle');
  if (!btn) return;

  function syncAriaLabel() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    btn.setAttribute(
      'aria-label',
      current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    );
  }

  syncAriaLabel();

  btn.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    syncAriaLabel();
    try {
      localStorage.setItem('opchain-theme', next);
    } catch (e) {
      /* localStorage blocked — fall back to session-only toggle */
    }
  });
})();
