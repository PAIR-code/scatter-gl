const path = require('path');

module.exports = {
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
    ],
  },
  resolve: {
    modules: ['node_modules'],
    extensions: ['.ts', '.js'],
  },
  entry: {
    demo: './src/lib.ts',
  },
  output: {
    path: path.join(__dirname, '../lib'),
    filename: 'scatter-gl.js',
  },
  plugins: [],
};
