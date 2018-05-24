const webpack     = require('webpack'),
      path        = require('path'),
      fs          = require('fs'),
      CleanPlugin = require('clean-webpack-plugin'),
          
      CopyWebpackPlugin = require('copy-webpack-plugin'),
      ExtractTextPlugin = require('extract-text-webpack-plugin'),
      HtmlWebpackPlugin = require('html-webpack-plugin'),

  extractCSS = new ExtractTextPlugin({
    filename: '[name].css'
  });

const pkgJson = require('../package.json'),
  output = {
    path: path.join(__dirname, '../dist'),
    filename: '[name].js',
    pathinfo: true,
    publicPath: './'
  };

module.exports = [{
  devtool: 'source-map',
  entry: {
    'paho.mqtt.javascript': path.join(__dirname, '../src'),
    'paho.mqtt.javascript.min': path.join(__dirname, '../src')
  },
  output: Object.assign({
    library: "Paho",
    libraryTarget: "umd", // "var" for simple variable 'Paho'
    libraryExport: 'default'
  }, output),
  target: 'node',
  module: {
    rules: [{
      test:    /\.js$/i,
      include: path.resolve(__dirname, '../src'),
      use:     ['babel-loader']
    }]
  },
  plugins: [
    new CleanPlugin(['dist'], {
      root: path.resolve(__dirname, '..')
    }),
    new webpack.EnvironmentPlugin({
      VERSION: pkgJson.version
    }),
    new webpack.optimize.UglifyJsPlugin({
      sourceMap: false,
      comments: false,
      compress: {
        drop_console: true
      },
      mangle: true,
      sourceMap: false,
      include: /.min.js$/
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true
    }),
    new webpack.BannerPlugin({
      banner: fs.readFileSync(path.join(__dirname, 'header.txt'), {
        encoding: 'utf8'
      }),
      raw: true
    })
  ]
}, {
  devtool: 'source-map',
  entry: {
    'utility': path.join(__dirname, '../utility/utility.js')
  },
  output,
  target: 'web',

  module: {
    rules: [{
      test:    /\.js$/i,
      include: path.resolve(__dirname, '../src'),
      use:     ['babel-loader']
    }, {
      test: /\.css$/i,
      use: extractCSS.extract({
        fallback: 'style-loader',
        use: {
          loader: 'css-loader',
          options: {
            sourceMap: true,
            minimize: false
          }
        }
      })
    }, {
      test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/i,
      use: [{
        loader: 'url-loader',
        options: {
          limit: 10000,
          mimetype: 'application/font-woff',
          name: '[name].[ext]'
        }
      }]
    }, {
      test: /\.svg?$/i,
      use: [{
        loader: 'file-loader',
        options: {
          name: '[name].[ext]'
        }
      }]
    }]
  },

  plugins: [
    new CopyWebpackPlugin([
      path.join(__dirname, "../utility/background.js"),
      path.join(__dirname, "../utility/manifest.json"),
      path.join(__dirname, "../utility/paho-small-logo.png")
    ]),
    extractCSS,
    new webpack.EnvironmentPlugin({
      VERSION: pkgJson.version
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.join(__dirname, '../utility/index.html')
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
}];