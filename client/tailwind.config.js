/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef7ff',
          100: '#d9edff',
          200: '#bce0ff',
          300: '#8ecdff',
          400: '#59b1fc',
          500: '#3394f6',
          600: '#1e76eb',
          700: '#175ed8',
          800: '#194eae',
          900: '#1a4489',
          950: '#142b53',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 16px rgba(15, 23, 42, 0.06)',
        pop: '0 8px 30px rgba(15, 23, 42, 0.12)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.18s ease-out',
      },
    },
  },
  plugins: [],
};
