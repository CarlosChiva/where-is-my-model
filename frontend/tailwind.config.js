/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary':   '#0b0f14',
        'bg-secondary': '#111821',
        'bg-card':      '#182030',
        'bg-input':     '#1e2a3a',
        'bg-hover':     '#1f2b3d',
        'text-primary':   '#e6edf3',
        'text-secondary': '#7a8a9e',
        'text-muted':     '#4a5a6e',
        accent: {
          DEFAULT:  '#00d4aa',
          hover:    '#00f0c0',
          dim:      'rgba(0, 212, 170, 0.15)',
        },
        danger: {
          DEFAULT: '#ff6b6b',
          hover:   '#ff8a8a',
        },
        gpu: {
          green:  '#3fb950',
          yellow: '#d29922',
          red:    '#f85149',
        },
        border: {
          DEFAULT: '#233045',
          light:   'rgba(230, 237, 243, 0.06)',
        },
      },
      fontFamily: {
        sans: ['Spectral', 'Georgia', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px' },
      boxShadow: {
        card:     '0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
        'card-hover': '0 6px 24px rgba(0,212,170,0.1), 0 2px 8px rgba(0,0,0,0.3)',
        'btn-primary': '0 1px 4px rgba(0,212,170,0.25)',
        'btn-danger': '0 1px 4px rgba(255,107,107,0.25)',
        fab:          '0 4px 20px rgba(0,212,170,0.3), 0 6px 8px rgba(0,0,0,0.35)',
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