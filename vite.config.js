import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/old_quiz.html', '**/quiz-setup-anleitung.md', '**/questions.json', '**/*.cjs', '**/*.mjs']
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallbackDenylist: [/\.pdf$/]
      },
      manifest: {
        name: 'ScrumFit',
        short_name: 'Quiz',
        description: 'ScrumFit – sprint to success',
        theme_color: '#2563eb',
        background_color: '#f0f4f8',
        display: 'standalone',
        start_url: '/'
      }
    })
  ]
});
