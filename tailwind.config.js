/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark theme color palette
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Custom dark theme colors
        'dark-bg': '#0f172a',
        'dark-surface': '#1e293b',
        'dark-card': '#334155',
        'dark-border': '#475569',
        'dark-text': '#f1f5f9',
        'dark-text-secondary': '#cbd5e1',
        'dark-text-muted': '#94a3b8',
      },
      backgroundColor: {
        'dark-primary': '#0f172a',
        'dark-secondary': '#1e293b',
        'dark-accent': '#334155',
      },
      borderColor: {
        'dark-primary': '#475569',
        'dark-secondary': '#64748b',
      },
      textColor: {
        'dark-primary': '#f1f5f9',
        'dark-secondary': '#cbd5e1',
        'dark-muted': '#94a3b8',
      },
    },
  },
  plugins: [],
};
