import globals from 'globals';

export default [
  {
    files: ['yulaf.user.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        GM_getValue: 'readonly',
        GM_setValue: 'readonly',
        GM_addStyle: 'readonly',
        module: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
];
