import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui-design-system/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui-components/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // v13 Section 4.3.1 Color Palette
        primary: '#87CEEB',
        secondary: '#70DF82',
        'card-bg': '#FFFBFB',
        'card-bg-alt': '#F4F5F7',
        'text-primary': '#000000',
        'text-secondary': '#FFFBFB',
        placeholder: '#D9D9D9',
      },
      fontFamily: {
        // v13 Section 4.3.2 Typography
        display: ['"Life Savers"', 'sans-serif'],
        body: ['"Life Savers"', 'sans-serif'],
        price: ['Alata', 'sans-serif'],
        brand: ['"Lohit Tamil"', '"Lohit Bengali"', '"Noto Sans"', 'sans-serif'],
        system: ['"SF Pro"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // v13 Section 4.3.3 Spacing
        card: '35px',
        'card-small': '20px',
        image: '12px',
        'image-large': '21px',
        nav: '12.5px',
      },
      spacing: {
        // v13 Section 4.3.3 Spacing
        'card-gap': '13px',
        'feed-padding': '10px',
      },
      width: {
        card: '180px',
        'card-desktop': '260px',
      },
      screens: {
        // v13 Section 4.8 Breakpoints
        tablet: '768px',
        desktop: '1024px',
        wide: '1280px',
        ultrawide: '1440px',
      },
    },
  },
  plugins: [],
} satisfies Config;
