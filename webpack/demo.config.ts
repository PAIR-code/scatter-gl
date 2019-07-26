const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
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
    demo: './demo/index.ts',
  },
  output: {
    path: path.join(__dirname, '../demo_build'),
    filename: 'bundle.min.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, '../demo/index.html'),
    }),
  ],
};
