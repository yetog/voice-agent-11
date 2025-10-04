const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/js/conversational-app.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/'
    },
    mode: 'development',
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        port: 3000,
        proxy: [
            {
                context: ['/api'],
                target: 'http://localhost:5001'
            }
        ],
        hot: true
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'conversational.html', to: 'index.html' },
                { from: 'src/styles', to: 'styles' }
            ],
        }),
    ],
    resolve: {
        fallback: {
            "fs": false,
            "path": false,
            "crypto": false
        }
    }
};
