module.exports = {
  env: {
    es6: true,
  },

  parser: '@typescript-eslint/parser',

  parserOptions: {
    sourceType: 'module',
  },

  plugins: [
    '@typescript-eslint',
    'eslint-comments',
    'jest',
  ],

  settings: {
    react: {
      version: 'detect',
    },
  },

  overrides: [
    {
      files: ['*.{spec,test}.{js,ts,tsx}', '**/__tests__/**/*.{js,ts,tsx}'],
      env: {
        jest: true,
        'jest/globals': true,
      },
    },
  ],

  rules: {
    'comma-dangle': 0,
    'curly': 0,
    'eqeqeq': 0,
    'indent': [1, 2, { 'SwitchCase': 1 }],
    'key-spacing': 1,
    'no-bitwise': 0,
    'no-shadow': 0,
    'no-unexpected-multiline': 0,
    'no-unused-vars': [1, { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    'semi': [1, 'never'],
    'object-curly-spacing': [1, 'always'],
    'no-trailing-spaces': 0,
    'quotes': [0, 'single', 'avoid-escape']
  },
};
