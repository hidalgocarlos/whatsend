/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: { DEFAULT: '#25D366', hover: '#20BD5C', light: '#dcfce7' },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.06), 0 2px 6px -2px rgb(0 0 0 / 0.04)',
        elevated: '0 10px 40px -10px rgb(0 0 0 / 0.1), 0 4px 12px -4px rgb(0 0 0 / 0.06)',
      },
      transitionDuration: { 200: '200ms' },
    },
  },
  plugins: [],
};
