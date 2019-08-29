const path = require('path');

const minimize = process.env.MINIMIZE === 'true';
const filename = minimize ? 'scatter-gl.min.js' : 'scatter-gl.js';

module.exports = {
  mode: 'production',
  module: {
    rules: [
      {
        test: /(\.ts$|\.js$)/,
        exclude: /node_modules/,
        loader: 'ts-loader',
      },
    ],
  },
  externals: {
    three: 'THREE',
  },
  resolve: {
    modules: ['node_modules'],
    extensions: ['.ts', '.js'],
  },
  entry: {
    lib: path.resolve(__dirname, '../src/lib.ts'),
  },
  output: {
    path: path.join(__dirname, '../lib'),
    libraryTarget: 'umd',
    filename,
  },
  optimization: {
    minimize,
  },
};
