import resolve from 'rollup-plugin-node-resolve'

const pkg = require('./package.json')

const globals = {
  'mobx-state-tree': 'mobxStateTree',
  'tslib': 'tslib'
}

export default {
  input: 'build/index.js',
  external: ['mobx-state-tree', 'tslib'],
  output: [
    { file: pkg.main, format: 'cjs', globals },
    { file: pkg['umd:main'], name: 'mstAsyncTask', format: 'umd', globals },
    { file: pkg.module, format: 'es', globals },
  ],
  plugins: [
    resolve()
  ]
}
