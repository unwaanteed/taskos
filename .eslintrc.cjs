/**
 *  @type {import('eslint').ESLint.ConfigData}
 */
module.exports = {
  root: true,
  env: { node: true, browser: true, es2021: true },
  plugins: ['perfectionist', 'unused-imports', '@typescript-eslint', 'prettier'],
  extends: ['airbnb', 'airbnb-typescript', 'airbnb/hooks', 'prettier'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest',
    ecmaFeatures: { jsx: true },
    project: './tsconfig.json',
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  /**
   * 0 ~ 'off'
   * 1 ~ 'warn'
   * 2 ~ 'error'
   */
  rules: {
    // general
    'no-alert': 0,
    camelcase: 0,
    'no-plusplus': 0,
    'no-console': 0,
    'no-unused-vars': 0,
    'no-nested-ternary': 0,
    'no-param-reassign': 0,
    'no-underscore-dangle': 0,
    'no-restricted-exports': 0,
    'no-promise-executor-return': 0,
    'max-classes-per-file': 0,
    'import/prefer-default-export': 0,
    'prefer-destructuring': [1, { object: true, array: false }],
    // typescript
    '@typescript-eslint/naming-convention': 0,
    '@typescript-eslint/no-use-before-define': 0,
    '@typescript-eslint/consistent-type-exports': 1,
    '@typescript-eslint/consistent-type-imports': 1,
    '@typescript-eslint/no-unused-vars': [1, { args: 'none', 'caughtErrors': 'none', }],
    '@typescript-eslint/lines-between-class-members': 0,
    '@typescript-eslint/no-throw-literal': 0,
    // unused imports
    'unused-imports/no-unused-imports': 1,
    'unused-imports/no-unused-vars': [
      0,
      { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
    ],
    // perfectionist
    'perfectionist/sort-exports': [1, { order: 'asc', type: 'line-length' }],
    'perfectionist/sort-named-imports': [1, { order: 'asc', type: 'line-length' }],
    'perfectionist/sort-named-exports': [1, { order: 'asc', type: 'line-length' }],
    'perfectionist/sort-imports': [ 1, { order: 'asc', type: 'line-length' },
    ],
  },
};
