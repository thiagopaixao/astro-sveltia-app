'use strict';

/**
 * @fileoverview Shared footer component for renderer pages.
 * @author Documental Team
 * @since 1.0.0
 *
 * Generates the app footer bar with optional action buttons.
 * Pattern extracted from new.html, open.html, create.html:
 *   p-4 border-t border-gray-700 bg-surface-dark mt-auto
 */

/**
 * Renders a page footer bar with optional action buttons.
 * @param {Object} opts
 * @param {string} [opts.content=''] - Arbitrary footer content HTML
 * @param {Array<{label: string, class?: string, id?: string, attributes?: string}>} [opts.buttons=[]]
 *   Action buttons to render on the right side
 * @param {string} [opts.maxWidth=''] - Optional max-width class (e.g. 'max-w-2xl')
 * @returns {string} Footer HTML string
 */
function renderFooter({ content = '', buttons = [], maxWidth = '' } = {}) {
  const maxWClass = maxWidth ? ` ${maxWidth}` : '';
  const alignClass = buttons.length > 0 || content
    ? 'flex justify-end gap-4'
    : '';

  let buttonsHtml = '';
  if (buttons.length > 0) {
    buttonsHtml = buttons.map((btn) => {
      const classes = btn.class || 'btn-secondary';
      const id = btn.id ? ` id="${btn.id}"` : '';
      const attrs = btn.attributes || '';
      return `            <button${id} class="${classes} px-5 py-2 font-semibold"${attrs}>${btn.label}</button>`;
    }).join('\n');
  }

  const innerContent = [content, buttonsHtml].filter(Boolean).join('\n');

  return [
    '<div class="p-4 border-t border-gray-700 bg-surface-dark mt-auto">',
    `    <div class="${alignClass}${maxWClass}">`,
    innerContent,
    '    </div>',
    '</div>',
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderFooter };
}
if (typeof window !== 'undefined') {
  window.Documental = window.Documental || {};
  window.Documental.renderFooter = renderFooter;
}
