module.exports = {
  env: {
    es6: true,
  },

  parser: '@typescript-eslint/parser',

  parserOptions: {
    sourceType: 'module',
  },

  plugins: [
    '@typescript-eslint'
  ],

  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended'
  ],

  settings: {
    react: {
      version: 'detect',
    },
  },

  overrides: [
    {
      files: ['**/__tests__/**/*.{js,ts,tsx}'],
      env: {
        jest: true
      },
    },
  ],

  ignorePatterns: ['build/**/**', 'dist/**/**', 'rollup.config.js'],

  rules: {
    'comma-dangle': 0,
    'curly': 0,
    'eqeqeq': 0,
    'indent': [1, 2, { 'SwitchCase': 1 }],
    'key-spacing': 1,
    'no-bitwise': 0,
    'no-shadow': 0,
    'no-unexpected-multiline': 0,
    'no-unused-vars': 0,
    'semi': [1, 'never'],
    'object-curly-spacing': [1, 'always'],
    'no-trailing-spaces': 0,
    'quotes': [0, 'single', 'avoid-escape'],

    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
  }
}
