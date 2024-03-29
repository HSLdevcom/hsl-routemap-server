const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  entry: ['./src/index.js'],
  optimization: {
    minimize: false,
  },
  plugins: [
    new HtmlWebpackPlugin({ template: 'index.ejs' }),
    new Dotenv({ systemvars: true }),
    new ESLintPlugin(),
  ],
  resolve: {
    modules: ['node_modules', 'src'],
  },
  output: {
    publicPath: '',
    path: path.join(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.worker\.js$/,
        use: ['babel-loader', 'worker-loader'],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: { localIdentName: '[name]_[local]_[hash:base64:5]' },
            },
          },
        ],
      },
      {
        test: /\.svg$/,
        loader: 'raw-loader',
      },
    ],
  },
};
