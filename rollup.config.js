import resolve from 'rollup-plugin-node-resolve'
import sourceMaps from 'rollup-plugin-sourcemaps'

const pkg = require('./package.json')

const globals = {
  'mobx-state-tree': 'mobxStateTree',
  'tslib': 'tslib'
}

export default {
  input: 'build/index.js',
  external: ['mobx-state-tree', 'tslib'],
  output: [
    { file: pkg.main, format: 'cjs', globals, sourcemap: true },
    { file: pkg['umd:main'], name: 'mstAsyncTask', format: 'umd', globals, sourcemap: true },
    { file: pkg.module, format: 'es', globals, sourcemap: true },
  ],
  plugins: [
    resolve(),
    sourceMaps(),
  ]
}
