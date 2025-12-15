/**
 * OwnYou Tailwind CSS Configuration
 *
 * Extends Tailwind with OwnYou design tokens from v13 Section 4.3.
 * Import this in your app's tailwind.config.js to use OwnYou tokens.
 *
 * @example
 * // In your app's tailwind.config.js
 * const ownyouPreset = require('@ownyou/ui-design-system/tailwind.config');
 *
 * module.exports = {
 *   presets: [ownyouPreset],
 *   content: ['./src/** /*.{ts,tsx}'],
 * };
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.3
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      // Colors - v13 Section 4.3.1
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        'card-bg': 'var(--color-card-bg)',
        'card-bg-alt': 'var(--color-card-bg-alt)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        placeholder: 'var(--color-placeholder)',
        // Raw values for SSR
        ownyou: {
          primary: '#87CEEB',
          secondary: '#70DF82',
          'card-bg': '#FFFBFB',
          'card-bg-alt': '#F4F5F7',
          placeholder: '#D9D9D9',
        },
        // Brand colors for OAuth providers
        brand: {
          microsoft: '#2f2f2f',
          apple: '#000000',
          google: '#4285F4',
        },
        // Ikigai dimension colors
        ikigai: {
          experiences: '#FF6B6B',
          relationships: '#4ECDC4',
          interests: '#45B7D1',
          giving: '#96CEB4',
        },
      },

      // Font Family - v13 Section 4.3.2
      fontFamily: {
        display: ['Life Savers', 'cursive', 'sans-serif'],
        price: ['Alata', 'sans-serif'],
        brand: ['Lohit Tamil', 'Lohit Bengali', 'Noto Sans', 'sans-serif'],
        system: ['SF Pro', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },

      // Font Size with line-height and weight
      fontSize: {
        display: ['16px', { lineHeight: '1.3', fontWeight: '700' }],
        body: ['12px', { lineHeight: '1.4', fontWeight: '700' }],
        label: ['11px', { lineHeight: '1.3', fontWeight: '700' }],
        price: ['11px', { lineHeight: '1.3', fontWeight: '400' }],
        brand: ['13px', { lineHeight: '1.3', fontWeight: '400' }],
        'system-text': ['17px', { lineHeight: '1.2', fontWeight: '600' }],
      },

      // Border Radius - v13 Section 4.3.3
      borderRadius: {
        card: '35px',
        'card-small': '20px',
        image: '12px',
        'image-lg': '21px',
        nav: '12.5px',
        button: '8px',
      },

      // Spacing & Width
      width: {
        card: '180px',
        'card-desktop': '260px',
      },

      spacing: {
        'card-gap': '13px',
        'feed-padding': '10px',
      },

      // Breakpoints - v13 Section 4.8
      screens: {
        mobile: '640px',
        tablet: '768px',
        desktop: '1024px',
        'desktop-md': '1280px',
        'desktop-lg': '1440px',
        'ultra-wide': '1920px',
      },

      // Animation keyframes
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-out-to-right': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'zoom-in': {
          '0%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
      },

      // Animation utilities
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.2s ease-out',
        'slide-in-from-right': 'slide-in-from-right 0.2s ease-out',
        'slide-out-to-right': 'slide-out-to-right 0.2s ease-out',
        'zoom-in': 'zoom-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
