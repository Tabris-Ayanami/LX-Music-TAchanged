const path = require('path')
const { VueLoaderPlugin } = require('vue-loader')
const HTMLPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const ESLintPlugin = require('eslint-webpack-plugin')

const vueLoaderConfig = require('../vue-loader.config')
const { mergeCSSLoader } = require('../utils')

const isDev = process.env.NODE_ENV === 'development'

module.exports = {
  target: 'electron-renderer',
  entry: {
    renderer: path.join(__dirname, '../../src/renderer/main.ts'),
  },
  output: {
    filename: '[name].js',
    library: {
      type: 'commonjs2',
    },
    path: path.join(__dirname, '../../dist'),
    publicPath: '',
  },
  resolve: {
    alias: {
      '@root': path.join(__dirname, '../../src'),
      '@main': path.join(__dirname, '../../src/main'),
      '@renderer': path.join(__dirname, '../../src/renderer'),
      '@lyric': path.join(__dirname, '../../src/renderer-lyric'),
      '@static': path.join(__dirname, '../../src/static'),
      '@common': path.join(__dirname, '../../src/common'),
      // babel 的 transform-modules-umd 会把 .vue 脚本的 import 编译成 require()，
      // 导致解析到该包的 cjs 构建，其内部 __toESM(require("@ungap/structured-clone"), 1)
      // 的 default 是模块对象而非函数，setLyricLines 会抛 "is not a function"。强制走 ESM 构建。
      '@applemusic-like-lyrics/core$': path.join(__dirname, '../../node_modules/@applemusic-like-lyrics/core/dist/amll-core.mjs'),
    },
    extensions: ['.tsx', '.ts', '.js', '.json', '.node'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            appendTsSuffixTo: [/\.vue$/],
          },
        },
        parser: {
          worker: [
            '*audioContext.audioWorklet.addModule()',
            '...',
          ],
        },
      },
      {
        test: /\.node$/,
        use: 'node-loader',
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: vueLoaderConfig,
      },
      {
        test: /\.pug$/,
        loader: 'pug-plain-loader',
      },
      {
        test: /\.css$/,
        oneOf: mergeCSSLoader(),
      },
      {
        test: /\.less$/,
        oneOf: mergeCSSLoader({
          loader: 'less-loader',
          options: {
            sourceMap: true,
          },
        }),
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        exclude: path.join(__dirname, '../../src/renderer/assets/svgs'),
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10000,
          },
        },
        generator: {
          filename: 'imgs/[name]-[contenthash:8][ext]',
        },
      },
      {
        test: /\.svg$/,
        include: path.join(__dirname, '../../src/renderer/assets/svgs'),
        use: [
          {
            loader: 'svg-sprite-loader',
            options: {
              symbolId: 'icon-[name]',
            },
          },
          'svg-transform-loader',
          'svgo-loader',
        ],
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10000,
          },
        },
        generator: {
          filename: 'media/[name]-[contenthash:8][ext]',
        },
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10000,
          },
        },
        generator: {
          filename: 'fonts/[name]-[contenthash:8][ext]',
        },
      },
    ],
  },
  plugins: [
    new HTMLPlugin({
      filename: 'index.html',
      template: path.join(__dirname, '../../src/renderer/index.html'),
      isProd: process.env.NODE_ENV == 'production',
      browser: process.browser,
      __dirname,
    }),
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: isDev ? '[name].css' : '[name].[contenthash:8].css',
      chunkFilename: isDev ? '[id].css' : '[id].[contenthash:8].css',
      ignoreOrder: true,
    }),
    new ESLintPlugin({
      extensions: ['js', 'vue'],
      formatter: require('eslint-formatter-friendly'),
    }),
  ],
}
