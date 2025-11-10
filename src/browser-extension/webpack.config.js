/**
 * Webpack Configuration for Browser Extension
 *
 * Compiles TypeScript to JavaScript and bundles for Chrome extension.
 */

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    background: './background.ts',
    content: './content.ts',
    popup: './popup/popup.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true  // Clean dist folder before each build
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        // Copy manifest
        { from: 'manifest.json', to: 'manifest.json' },

        // Copy popup HTML and CSS
        { from: 'popup/popup.html', to: 'popup.html' },
        { from: 'popup/popup.css', to: 'popup.css' },

        // Copy OAuth library (if needed as web_accessible_resources)
        { from: 'lib/*.ts', to: 'lib/[name][ext]', noErrorOnMissing: true }
      ]
    })
  ],
  optimization: {
    minimize: false  // Keep code readable for debugging
  },
  devtool: 'source-map'  // Enable source maps for debugging
};
