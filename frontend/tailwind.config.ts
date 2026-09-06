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
          DEFAULT: '#FFFFFF',
          foreground: '#000000',
          50: '#FAFAFA',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
        },
        secondary: {
          DEFAULT: '#141414',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#FFFFFF',
          foreground: '#000000',
          hover: '#E4E4E7',
        },
        background: '#000000',
        foreground: '#FAFAFA',
        card: {
          DEFAULT: '#0A0A0A',
          foreground: '#FAFAFA',
        },
        muted: {
          DEFAULT: '#141414',
          foreground: '#A1A1AA',
        },
        border: '#1F1F1F',
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        success: {
          DEFAULT: '#16A34A',
          foreground: '#FFFFFF',
        },
        dark: {
          bg: '#000000',
          surface: '#0A0A0A',
          elevated: '#121212',
          border: '#1F1F1F',
          borderSubtle: '#161616',
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
