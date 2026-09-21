import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import { Linter } from 'eslint'

export default <Linter.Config[]>[{
  files: ['**/*.ts'],
  ignores: ['node_modules/', 'dist/**'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  plugins: {
    '@typescript-eslint': tseslint.plugin,
    '@stylistic': stylistic,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    // '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    'prefer-const': 'error',
    '@stylistic/arrow-parens': ['error', 'as-needed'],
    '@stylistic/comma-spacing': 'error',
    '@stylistic/object-curly-spacing': ['error', 'always', {
      objectsInObjects: false,
      emptyObjects: 'never',
    }],
    '@stylistic/space-in-parens': ['error', 'never'],
    '@stylistic/array-bracket-spacing': ['error', 'never', {
      objectsInArrays: false
    }],
    '@stylistic/quotes': ['error', 'single', {
      avoidEscape: true
    }],
    '@stylistic/semi': ['error', 'never', {
      beforeStatementContinuationChars: 'never'
    }],
    '@stylistic/semi-style': ['error', 'first'],
    '@stylistic/generator-star-spacing': ['error', 'after'],
    '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
    '@stylistic/computed-property-spacing': 'error',
    '@stylistic/block-spacing': 'error',
    '@stylistic/padded-blocks': ['error', 'never'],
    '@stylistic/space-before-blocks': 'error',
  },
}]
