'use strict';

/**
 * @fileoverview Shared logo component for Documental.
 * @author Documental Team
 * @since 1.0.0
 *
 * Generates the Documental document-icon logo SVG. The default icon is the
 * "document with lines" SVG also stored at themes/base/logo.svg.
 * Themes can override by providing their own logo.svg — use getLogoDataUri()
 * from ThemeService for CSS injection, or call renderLogo() for inline HTML.
 */

/**
 * Generate the Documental logo SVG.
 * @param {Object} opts
 * @param {string} [opts.size='md'] - Size preset: 'sm' (h-6 w-6), 'md' (h-10 w-10), 'lg' (h-12 w-12)
 * @param {string} [opts.className] - Additional CSS classes
 * @param {string} [opts.colorClass='text-primary'] - Color class (e.g. 'text-primary', 'text-white')
 * @returns {string} SVG HTML string
 */
function renderLogo({ size = 'md', className = '', colorClass = 'text-primary' } = {}) {
  const sizeMap = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };
  const sizeClass = sizeMap[size] || sizeMap.md;
  const classes = [sizeClass, colorClass, className].filter(Boolean).join(' ');

  return `<svg class="${classes}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
</svg>`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderLogo };
}
if (typeof window !== 'undefined') {
  window.Documental = window.Documental || {};
  window.Documental.renderLogo = renderLogo;
}
