'use strict';

/**
 * @fileoverview Shared header component for renderer pages.
 * @author Documental Team
 * @since 1.0.0
 *
 * Generates the app header bar with consistent styling.
 * Pattern extracted from config.html:
 *   h-16 bg-surface-dark border-b border-gray-700 px-4 flex items-center justify-between
 */

/**
 * Renders a page header bar.
 * @param {Object} opts
 * @param {string} opts.title - Page title text
 * @param {string} [opts.leftContent=''] - Additional left-side HTML (e.g. breadcrumb)
 * @param {string} [opts.rightContent=''] - Right-side HTML (e.g. actions, close button)
 * @param {string} [opts.subtitle=''] - Optional subtitle / breadcrumb separator text
 * @returns {string} Header HTML string
 */
function renderHeader({ title, leftContent = '', rightContent = '', subtitle = '' }) {
  if (!title) {
    throw new Error('renderHeader requires a title parameter');
  }

  const leftSide = [
    '<div class="flex items-center space-x-2">',
    leftContent,
    `  <h1 class="text-xl font-bold text-text-dark">${title}</h1>`,
    subtitle ? `  <span class="text-xl font-light text-muted-dark">/</span>` : '',
    subtitle ? `  <h2 class="text-xl font-semibold text-text-dark">${subtitle}</h2>` : '',
    '</div>',
  ].filter(Boolean).join('\n');

  const rightSide = rightContent
    ? `<div class="flex items-center space-x-4">${rightContent}</div>`
    : '';

  return [
    '<div class="flex items-center justify-between h-16 px-4 bg-surface-dark border-b border-gray-700 shrink-0">',
    leftSide,
    rightSide,
    '</div>',
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderHeader };
}
if (typeof window !== 'undefined') {
  window.Documental = window.Documental || {};
  window.Documental.renderHeader = renderHeader;
}
