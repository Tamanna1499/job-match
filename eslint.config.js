import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  /** A command-line tool writes to the console by definition; the rule stands everywhere else. */
  {
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'eslint.config.js'] },
);
