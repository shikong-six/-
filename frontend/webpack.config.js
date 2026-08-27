const path=require('path');
const HtmlWebpackPlugin=require('html-webpack-plugin');
const {VueLoaderPlugin}=require('vue-loader');

module.exports={
    entry:'./src/main.ts',
    output:{
        path:path.resolve(__dirname,'dist'),
        filename:'bundle.js',
        clean:true
    },
    resolve:{
        extensions:['.ts','.js','.vue','.json'],
        alias:{
            '@':path.resolve(__dirname,'src'),     
        }
    },
    module:{
        rules:[
        {
        test:/\.vue$/,
        loader:'vue-loader'
        },
        {
            test:/\.ts$/,
            loader:'ts-loader',
            options:{
                appendTsSuffixTo:[/\.vue$/]
            },
            exclude:/node_modules/
        },
        {
            test:/\.css$/,
            use:['style-loader','css-loader']
        }
    ]
    },
    plugins:[
        new VueLoaderPlugin(),
        new HtmlWebpackPlugin({
            template:'./public/index.html'
        })
    ],
    devServer:{
        port:8080,
        hot:true,
        open:true,
        historyApiFallback:true
    }
};