const tokens = require('./src/constants/tokens.json');

const c = tokens.colors;

/** Surface colors come from CSS variables so the theme setting (dark / OLED) can swap them at runtime. */
const surface = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  // The app is dark-only; 'class' stops NativeWind from following the OS scheme on web.
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: surface('background'),
        surface: surface('surface'),
        card: surface('card'),
        elevated: surface('elevated'),
        line: surface('border'),
        'line-strong': surface('border-strong'),
        accent: { DEFAULT: c.accent, soft: c.accentSoft, deep: c.accentDeep, ink: c.accentInk },
        ink: { DEFAULT: c.text, secondary: c.textSecondary, muted: c.textMuted },
        success: c.success,
        danger: c.danger,
        warning: c.warning,
        info: c.info,
      },
      fontFamily: {
        regular: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
        extrabold: ['Inter_800ExtraBold'],
      },
      borderRadius: {
        sm: `${tokens.radius.sm}px`,
        md: `${tokens.radius.md}px`,
        lg: `${tokens.radius.lg}px`,
        xl: `${tokens.radius.xl}px`,
      },
    },
  },
  plugins: [],
};
