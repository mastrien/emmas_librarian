module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:prettier/recommended',
  ],
  // public/ holds vendored, minified browser bundles (pdf.js worker, etc.) that are not ours to lint.
  ignorePatterns: [
    'dist',
    'dist-electron',
    'build',
    'release',
    '.eslintrc.cjs',
    'coverage',
    'public',
    'reports',
    '.stryker-tmp',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['prettier'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    'prettier/prettier': 'warn',
    // Props are typed with TypeScript interfaces; runtime PropTypes would duplicate them.
    'react/prop-types': 'off',
    // Quotes and apostrophes are ordinary text in our Portuguese copy; only flag characters that break JSX.
    'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
    // React Compiler advisory: flags the "reset form when opened" and "load on mount" effects used across
    // the app. Kept visible as a warning until those are moved to keyed remounts / data hooks.
    'react-hooks/set-state-in-effect': 'warn',
    // A leading underscore marks a parameter or binding that is intentionally unused.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      // Playwright specs and build scripts are plain CommonJS Node scripts.
      files: [
        'e2e-tests/**/*.js',
        'build-db.js',
        'playwright.config.js',
        'scripts/**/*.js',
        'performance-tests/performance-harness.js',
      ],
      rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    {
      // k6 load tests run in k6's runtime, which provides __ENV.
      files: ['performance-tests/**/*.js'],
      globals: { __ENV: 'readonly' },
    },
  ],
};
