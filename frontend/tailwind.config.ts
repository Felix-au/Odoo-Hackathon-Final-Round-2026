import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          foreground: '#FFFFFF',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        secondary: {
          DEFAULT: '#3B82F6',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#EA580C',
          foreground: '#FFFFFF',
          hover: '#C2410C',
        },
        background: '#F8FAFC',
        foreground: '#1E293B',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#1E293B',
        },
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
        border: '#E2E8F0',
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        success: {
          DEFAULT: '#16A34A',
          foreground: '#FFFFFF',
        },
        dark: {
          bg: '#0B0D11',
          surface: '#12151C',
          elevated: '#181D26',
          border: '#222834',
          borderSubtle: '#1A202C',
        },
        warning: {
          DEFAULT: '#D97706',
          foreground: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 4px 30px rgba(0, 0, 0, 0.05)',
        'glass-card': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'elevated': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
