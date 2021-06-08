const path = require('path');

module.exports = (env, argv) => {
  const mode = argv.mode || 'development';
  const isProduction = mode === 'production';
  return {
    entry: path.join(__dirname, '_src/js/index'),
    output: {
      path: path.join(__dirname, 'dist/js'),
      filename: 'app.bundle.js'
    },
    resolve: {
      extensions: ['.ts', '.js', '.json'],
      fallback: {
        "path": require.resolve("path-browserify"),
        "url": require.resolve("url")
      }
    },
    module: {
      rules: [{
        test: /\.(ts)|(js)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }]
    },
    mode,
    devtool: isProduction ? undefined : 'inline-source-map'
  };
};
