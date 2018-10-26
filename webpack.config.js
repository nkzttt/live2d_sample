const path = require('path');

module.exports = {
  entry: path.join(__dirname, 'src/js/index'),
  output: {
    path: path.join(__dirname, 'dist/js'),
    filename: 'app.bundle.js'
  },
  resolve: {
    extensions: ['.ts', '.js', '.json']
  },
  module: {
    rules: [{
      test: /\.(ts)|(js)$/,
      exclude: /node_modules/,
      loader: 'babel-loader'
    }]
  },
  mode: 'development',
  devtool: 'inline-source-map'
};