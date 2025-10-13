// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-og-image'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    // Redirecionar rotas antigas de docs para a home
    '/docs': { redirect: '/', prerender: false },
    '/docs/**': { redirect: '/', prerender: false }
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

    // Databricks Configuration
    databricksHost: process.env.DATABRICKS_HOST,
    databricksToken: process.env.DATABRICKS_TOKEN,
    databricksWarehouseId: process.env.DATABRICKS_WAREHOUSE_ID,
    databricksCatalog: process.env.DATABRICKS_CATALOG || 'hive_metastore',
    databricksSchema: process.env.DATABRICKS_SCHEMA || 'default',

    allowedDomain: process.env.ALLOWED_DOMAIN || 'animaeducacao.com.br',

    // URLs base por ambiente (server-side)
    urlBaseDev: process.env.URL_BASE_DEV || 'https://cloudapp-dev.animaeducacao.com.br/rematricula',
    urlBaseHml: process.env.URL_BASE_HML || 'https://cloudapp-hml.animaeducacao.com.br/rematricula',
    urlBaseProd: process.env.URL_BASE_PROD || 'https://cloudapp.animaeducacao.com.br/rematricula',

    // Public keys (exposed to the frontend)
    public: {

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
