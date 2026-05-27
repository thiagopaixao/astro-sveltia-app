/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./renderer/**/*.{html,js}",
    "./src/**/*.{js,ts}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, #22c55e)',
        "primary-hover": 'var(--color-primary-hover, #16a34a)',
        "background-light": 'var(--color-background-light, #f3f4f6)',
        "background-dark": 'var(--color-background-dark, #111827)',
        "surface-light": 'var(--color-surface-light, #ffffff)',
        "surface-dark": 'var(--color-surface-dark, #1f2937)',
        "text-light": 'var(--color-text-light, #111827)',
        "text-dark": 'var(--color-text-dark, #f9fafb)',
        "muted-light": 'var(--color-muted-light, #6b7280)',
        "muted-dark": 'var(--color-muted-dark, #9ca3af)',
        "accent-orange": 'var(--color-accent, #ff5722)',
        "accent-orange-hover": 'var(--color-accent-hover, #e64a19)',
        success: 'var(--color-success, #22c55e)',
        "success-dark": 'var(--color-success-dark, #16a34a)',
        danger: 'var(--color-danger, #ef4444)',
        "danger-dark": 'var(--color-danger-dark, #dc2626)',
        warning: 'var(--color-warning, #f59e0b)',
        info: 'var(--color-info, #3b82f6)',
        "info-dark": 'var(--color-info-dark, #2563eb)',
        "border-subtle": 'var(--color-border-subtle, #374151)',
        "border-default": 'var(--color-border-default, #4b5563)',
        "surface-card": 'var(--color-surface-card, #163f5d)',
        "surface-card-alt": 'var(--color-surface-card-alt, #1a3650)',
        "surface-secondary": 'var(--color-surface-secondary, #374151)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
}
