/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary':   'rgb(var(--bg) / <alpha-value>)',
        'bg-secondary': 'rgb(var(--surface-dim) / <alpha-value>)',
        'bg-card':      'rgb(var(--surface) / <alpha-value>)',
        'bg-input':     'rgb(var(--surface) / <alpha-value>)',
        'bg-hover':     'rgb(var(--surface) / <alpha-value>)',
        'bg-elevated':  'rgb(var(--surface) / <alpha-value>)',   // NUEVO: GPUCalculatorPage usa bg-bg-elevated (hoy clase muerta)
        'text-primary':   'rgb(var(--fg) / <alpha-value>)',
        'text-secondary': 'rgb(var(--fg-2) / <alpha-value>)',
        'text-muted':     'rgb(var(--fg-3) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--link) / <alpha-value>)',
          hover:   'rgb(var(--link-hover) / <alpha-value>)',
          dim:     'var(--accent-dim)',
        },
        danger: {
          DEFAULT: 'rgb(var(--err) / <alpha-value>)',
          hover:   'rgb(var(--err) / <alpha-value>)',
        },
        gpu: {
          green:  'rgb(var(--success) / <alpha-value>)',
          yellow: 'rgb(var(--warn) / <alpha-value>)',
          red:    'rgb(var(--err) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          light:   'rgb(var(--line) / <alpha-value>)',
        },
        'btn-primary':       'rgb(var(--btn-primary-bg) / <alpha-value>)',
        'btn-primary-hover': 'rgb(var(--btn-primary-hover-bg) / <alpha-value>)',
        'btn-primary-fg':    'rgb(var(--btn-primary-fg) / <alpha-value>)',
      },
      fontFamily: {
        sans:    ['Figtree', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"Chakra Petch"', '"Segoe UI"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: { sm: '4px', md: '6px', lg: '8px' },
      boxShadow: {
        card:         'var(--card-shadow)',
        'card-hover': 'var(--card-shadow)',
        'btn-primary':'var(--btn-glow)',
        'btn-danger': 'var(--card-shadow)',
        fab:          'var(--shadow)',
        dialog:       'var(--shadow)',
      },
      animation: {
        'card-enter':    'cardSlideInUp 0.4s ease-out both',
        'gpu-fill':      'gpuBarFill 0.6s cubic-bezier(0.25,0.8,0.25,1) both',
        'gpu-warning':   'gpuWarningPulse 1.8s ease-in-out infinite',
        'dialog-fade':   'dialogFadeIn 0.25s ease-out both',
      },
      keyframes: {
        cardSlideInUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        gpuBarFill: {
          from: { width: '0%' },
          to:   { width: 'var(--gpu-target-width, 100%)' },
        },
        gpuWarningPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(248,81,73,0)' },
          '50%':      { boxShadow: '0 0 8px 2px rgba(248,81,73,0.35)' },
        },
        dialogFadeIn: {
          from: { opacity: '0', transform: 'scale(0.96) translateY(-8px)' },
          to:   { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      screens: { lg: '1200px', md: '768px' },
    },
  },
  plugins: [],
}
