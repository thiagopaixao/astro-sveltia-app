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
        primary: "#22c55e",
        "background-light": "#f3f4f6",
        "background-dark": "#111827",
        "surface-light": "#ffffff",
        "surface-dark": "#1f2937",
        "text-light": "#111827",
        "text-dark": "#f9fafb",
        "muted-light": "#6b7280",
        "muted-dark": "#9ca3af",
        "accent-orange": "#ff5722",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
}