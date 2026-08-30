import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'

const CampusPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: 'var(--practiq-violet-50)',
      100: 'var(--practiq-violet-100)',
      200: 'var(--practiq-violet-200)',
      300: 'var(--practiq-violet-300)',
      400: 'var(--practiq-violet-400)',
      500: 'var(--practiq-violet-500)',
      600: 'var(--practiq-violet-600)',
      700: 'var(--practiq-violet-700)',
      800: 'var(--practiq-violet-800)',
      900: 'var(--practiq-violet-900)',
      950: 'var(--practiq-violet-950)'
    }
  }
})

export const primeVueConfig = {
  theme: {
    preset: CampusPreset,
    options: {
      prefix: 'p',
      darkModeSelector: '.dark',
      cssLayer: false
    }
  }
}
