/* eslint-disable import/no-extraneous-dependencies */
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const config = require('./webpack.config');

const PORT = 5000;

config.devtool = 'eval';
config.mode = 'development';

if (process.env.HMR === 'true') {
  config.plugins = [new webpack.HotModuleReplacementPlugin(), ...config.plugins];
}

const options = {
  hot: process.env.HMR === 'true',
  historyApiFallback: true,
  port: PORT,
};

const server = new WebpackDevServer(options, webpack(config));

server.start();
