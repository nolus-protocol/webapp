const webpack = require('webpack')
module.exports = {
  transpileDependencies: true,
  lintOnSave: false,
  configureWebpack: {
    resolve: {
      fallback: {
        path: require.resolve('path-browserify'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify')
      },
      alias: {
        buffer: 'buffer',
        process: 'process/browser.js'
      }
    },
    plugins: [
      // ...config.plugins, // this is important !
      new webpack.ProvidePlugin({
        process: 'process/browser.js',
        Buffer: ['buffer', 'Buffer']
      })
    ]
  },
  css: {
    loaderOptions: {
      sass: {
        sassOptions: {
          includePaths: ['./node_modules', './src/assets']
        }
      }
    }
  }
}
