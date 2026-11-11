// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  // e2e/ é um projeto à parte (Playwright, package.json próprio)
  ignores: ['e2e/**']
})
