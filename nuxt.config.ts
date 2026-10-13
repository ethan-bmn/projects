// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    storageKey: 'abby-projects-color-mode'
  },

  runtimeConfig: {
    public: {
      chartdbUrl: 'http://localhost:8080'
    },
    databaseUrl: '',
    abbyApiKey: '',
    abbyApiBaseUrl: 'https://api.app-abby.com',
    session: {
      maxAge: 60 * 60 * 8,
      cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
