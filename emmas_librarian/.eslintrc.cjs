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
  ignorePatterns: ['dist', 'dist-electron', 'build', 'release', '.eslintrc.cjs', 'coverage', 'public', 'reports', '.stryker-tmp'],
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
  },
};
