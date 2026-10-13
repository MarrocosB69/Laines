import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tsParser from '@typescript-eslint/parser'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'server/dist', '**/dist/**', 'server/scripts/**', '.claude/**', 'tmp/**', 'e2e-artifacts/**', 'playwright-avaliacao-map.js']),
  {
    files: ['server/src/**/*.ts'],
    languageOptions: { parser: tsParser, parserOptions: { sourceType: 'module' } },
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'TSAsExpression > TSAnyKeyword, TSAsExpression > :matches(TSArrayType, TSTypeReference, TSUnionType, TSIntersectionType) TSAnyKeyword, TSTypeAssertion > TSAnyKeyword', message: 'Valide e tipifique o valor; não use casts para any.' },
        { selector: 'TSAsExpression > TSAsExpression', message: 'Não use cast duplo para contornar o contrato de tipos.' }
      ]
    }
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^(?:[A-Z_].*|motion)$',
          argsIgnorePattern: '^(?:_|[A-Z].*)',
          caughtErrorsIgnorePattern: '^(?:_|err|error)$',
        },
      ],
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/set-state-in-render': 'off',
    },
  },
])
