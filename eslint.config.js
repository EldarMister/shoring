import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const languageOptions = {
  ecmaVersion: 'latest',
  parserOptions: {
    ecmaFeatures: { jsx: true },
    sourceType: 'module',
  },
}

export default defineConfig([
  globalIgnores(['dist', '.tmp/**', 'server/uploads/**']),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ...languageOptions,
      globals: globals.browser,
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['server/**/*.js', 'shared/**/*.js', 'scripts/**/*.js', '*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ...languageOptions,
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
