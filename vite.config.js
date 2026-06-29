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
      manifest: {
        name: 'PSM I Quiz',
        short_name: 'Quiz',
        description: 'PSM I Scrum-Quiz mit Nutzerkonten',
        theme_color: '#2563eb',
        background_color: '#f0f4f8',
        display: 'standalone',
        start_url: '/'
      }
    })
  ]
});
