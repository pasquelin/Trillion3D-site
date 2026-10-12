import { MATHS_FORMS, MATHS_ORACLES } from './scripts/lint-maths.ts'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      // The engine, checked out at the pinned commit (`scripts/engine.ts`): its own gates lint it.
      '.engine/**',
      // Worktrees and agents' logs inside the project.
      '.worktrees/**',
    ],
  },
  js.configs.recommended,
  {
    // The inline forms of a formula the engine's `packages/math` holds (`scripts/lint-maths.ts`),
    // refused outside the declared oracles. A later block that sets `no-restricted-syntax` for its
    // own files replaces these entries there, so it lists them too.
    files: ['**/*.{ts,mts,tsx}'],
    ignores: MATHS_ORACLES,
    rules: { 'no-restricted-syntax': ['error', ...MATHS_FORMS] },
  },
  {
    files: ['site/app/**/*.tsx'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['site/app/**/*.{ts,tsx}'],
    ignores: MATHS_ORACLES,
    rules: {
      // An effect returns its cleanup or nothing: an expression body returns whatever the
      // expression gives (`scrollTo` gives a promise), and React calls it at the next commit.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.name=/^use(Layout)?Effect$/] > ArrowFunctionExpression[expression=true]',
          message: 'An effect body is a block: it returns its cleanup or nothing.',
        },
        ...MATHS_FORMS,
      ],
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,mts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        GPUBufferUsage: 'readonly',
        GPUTextureUsage: 'readonly',
        GPUShaderStage: 'readonly',
        GPUMapMode: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,mts,tsx}'],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
)
