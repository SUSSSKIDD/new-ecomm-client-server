import konstaConfig from 'konsta/config';

/** @type {import('tailwindcss').Config} */
export default konstaConfig({
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'page-bg': 'var(--color-bg-page)',
        'ud-surface': 'var(--color-bg-surface)',
        'ud-elevated': 'var(--color-bg-elevated)',
        'ud-subtle': 'var(--color-bg-subtle)',
        'ud-primary': 'var(--color-primary)',
        'ud-secondary': '#fbbf24',
        'ud-dark': '#0f172a',
        'ud-gray': 'var(--color-bg-subtle)',
        // semantic tokens
        'text-base': 'var(--color-text-primary)',
        'text-muted': 'var(--color-text-secondary)',
        'border-base': 'var(--color-border)',
      }
    },
  },
  plugins: [],
});

