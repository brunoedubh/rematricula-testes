// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    '@vueuse/nuxt',
    'nuxt-og-image'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/docs': { redirect: '/docs/getting-started', prerender: false }
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    prerender: {
      routes: [
        '/'
      ],
      crawlLinks: true
    }
  },

  runtimeConfig: {
    // Private keys (only available on the server-side)
    encryptionKey: process.env.ENCRYPTION_KEY,
    sessionSecret: process.env.SESSION_SECRET,
    sessionDuration: process.env.SESSION_DURATION || '28800000',

    azureClientIdDev: process.env.AZURE_CLIENT_ID_DEV,
    azureScopeDev: process.env.AZURE_SCOPE_DEV,
    azureClientIdProd: process.env.AZURE_CLIENT_ID_PROD,
    azureScopeProd: process.env.AZURE_SCOPE_PROD,

    databricksWorkspaceDev: process.env.DATABRICKS_WORKSPACE_DEV,
    databricksClientIdDev: process.env.DATABRICKS_CLIENT_ID_DEV,
    databricksClientSecretDev: process.env.DATABRICKS_CLIENT_SECRET_DEV,
    databricksWorkspaceProd: process.env.DATABRICKS_WORKSPACE_PROD,
    databricksClientIdProd: process.env.DATABRICKS_CLIENT_ID_PROD,
    databricksClientSecretProd: process.env.DATABRICKS_CLIENT_SECRET_PROD,

    allowedDomain: process.env.ALLOWED_DOMAIN || 'animaeducacao.com.br',

    // Public keys (exposed to the frontend)
    public: {
      urlBaseDev: process.env.URL_BASE_DEV,
      urlBaseHml: process.env.URL_BASE_HML,
      urlBaseProd: process.env.URL_BASE_PROD
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
