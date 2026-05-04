import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // Chrome Extension APIs
        chrome: 'readonly',
        // Vitest globals (for test files)
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      // Error prevention
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-undef': 'error',
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],

      // Best practices
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-empty': [
        'warn',
        {
          allowEmptyCatch: true,
        },
      ],

      // Style (Prettier handles most, these are semantic)
      'no-multiple-empty-lines': ['warn', { max: 2 }],
      'no-trailing-spaces': 'warn',
    },
  },
  {
    // Content scripts — DATA_ATTR is declared in config.js (loaded first via manifest)
    files: ['src/content/**/*.js'],
    languageOptions: {
      globals: {
        DATA_ATTR: 'readonly',
      },
    },
  },
  {
    // Test files - more relaxed rules
    files: ['test/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Ignore patterns
    ignores: ['node_modules/', 'coverage/', 'dist/', '*.min.js'],
  },
];
