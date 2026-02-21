import konstaConfig from 'konsta/config';

/** @type {import('tailwindcss').Config} */
export default konstaConfig({
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'page-bg': '#f7f7f8', // iOS light gray background
        'ud-primary': '#1e40af', // Deep Blue
        'ud-secondary': '#fbbf24', // Amber/Yellow
        'ud-dark': '#0f172a', // Dark Slate/Black
        'ud-gray': '#f3f4f6', // Light Gray for sections
      }
    },
  },
  plugins: [],
});

