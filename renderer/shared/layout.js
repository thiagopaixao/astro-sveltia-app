'use strict';

/**
 * @fileoverview Shared layout wrapper component for renderer pages.
 * @author Documental Team
 * @since 1.0.0
 *
 * Provides a consistent page structure (header → main → footer) used by
 * all secondary pages (new, open, create, config, index, all-projects).
 * Pages load this via a <script> tag and call renderLayout() to generate
 * the body's inner HTML.
 */

/**
 * Renders a complete page layout with optional header and footer.
 * @param {Object} opts
 * @param {string} [opts.header] - HTML string for header area
 * @param {string} opts.content - HTML string for main content
 * @param {string} [opts.footer] - HTML string for footer area
 * @param {string} [opts.bodyClass] - Additional body classes
 * @returns {string} Complete page body inner HTML
 */
function renderLayout({ header = '', content, footer = '', bodyClass = '' }) {
  if (!content && content !== '') {
    throw new Error('renderLayout requires a content parameter');
  }

  return [
    `<div class="flex flex-col h-screen${bodyClass ? ' ' + bodyClass : ''}">`,
    header ? `  <header class="shrink-0">${header}</header>` : '',
    `  <main class="flex-1 overflow-hidden flex flex-col">${content}</main>`,
    footer ? `  <footer class="shrink-0">${footer}</footer>` : '',
    '</div>',
  ]
    .filter(Boolean)
    .join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderLayout };
}
if (typeof window !== 'undefined') {
  window.Documental = window.Documental || {};
  window.Documental.renderLayout = renderLayout;
}
