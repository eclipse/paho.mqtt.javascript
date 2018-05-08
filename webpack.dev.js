const webpack = require('webpack'),
      path = require('path'),
      fs = require('fs'),
      HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  devtool: 'source-map',
  entry:   {
    'paho.mqtt.javascript': ['./src', './utility/utility.js']
  },

  output: {
    path:       path.join(__dirname, '../dist'),
    filename:   '[name].js',
    pathinfo:   true,
    publicPath: '/'
  },

  target: 'web',

  node: {
    // node polyfills
  },

  devServer: {
    hot:      false,
    inline:   true,
    progress: true,
    https:    false,
    proxy:    {
      '/rest/v2/measurement': {
        target: 'http://unide.eclipse.org:443'
        //, agent: require('http-proxy-agent')('http://localhost:3128')
      }
    }
  },

  module: {
    rules: []
  },

  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: `${__dirname}/utility/index.html`
    }),
    // display relative path of module on Hot Module Replacement
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin()
  ],

  resolve: {
    mainFields:  ['jsnext:main', 'module', 'browser', 'main'],
    aliasFields: ['browser']
  }
};
