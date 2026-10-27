import { defineConfig } from 'eslint/config';

export default defineConfig([{
  ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  files: ['**/*.js', '**/*.jsx'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } }
  },
  rules: {
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-constant-condition': 'error',
    'no-debugger': 'error'
  }
}]);
