/*
@license
Copyright 2019 Google LLC. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

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
