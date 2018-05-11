const webpack = require('webpack'),
  path = require('path'),
  fs = require('fs'),
  CopyWebpackPlugin = require('copy-webpack-plugin'),
  ExtractTextPlugin = require('extract-text-webpack-plugin'),
  HtmlWebpackPlugin = require('html-webpack-plugin'),

  extractCSS = new ExtractTextPlugin({
    filename: '[name].css'
  });

module.exports = {
  devtool: 'source-map',
  entry: {
    'paho.mqtt.javascript': './src',
    'utility': './utility/utility.js'
  },

  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    pathinfo: true,
    publicPath: '/'
  },

  target: 'web',

  node: {
    // node polyfills
  },

  devServer: {
    hot: false,
    inline: true,
    progress: true,
    https: false,
    proxy: {
      '/eclipse': {
        target: 'http://iot.eclipse.org:443'
        //, agent: require('http-proxy-agent')('http://localhost:3128')
      }
    }
  },

  module: {
    rules: [{
      test: /\.css$/i,
      use:  extractCSS.extract({
        fallback: 'style-loader',
        use:      {
          loader:  'css-loader',
          options: {
            sourceMap: true,
            minimize:  false
          }
        }
      })
    }, {
      test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/i,
      use:  [{
        loader:  'url-loader',
        options: {
          limit:    10000,
          mimetype: 'application/font-woff',
          name:     '[name].[ext]'
        }
      }]
    }, {
      test: /\.svg?$/i,
      use:  [{
        loader:  'file-loader',
        options: {
          name: '[name].[ext]'
        }
      }]
    }]
  },

  plugins: [
    new CopyWebpackPlugin([
      "./utility/background.js",
      "./utility/manifest.json",
      './utility/paho-small-logo.png'
    ]),
    extractCSS,
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: `${__dirname}/utility/index.html`
    }),
    // display relative path of module on Hot Module Replacement
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.ProvidePlugin({
      jQuery: "jquery"
    })
  ],

  resolve: {
    mainFields: ['jsnext:main', 'module', 'browser', 'main'],
    aliasFields: ['browser']
  }
};
