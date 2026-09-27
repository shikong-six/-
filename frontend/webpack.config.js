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
                appendTsSuffixTo:[/\.vue$/],
                // dev 下不做类型检查只转译（模板插槽的类型标注在 dev/prod 编译产物里表现不一致，
                // 会在 dev 报 Cannot find name；类型检查统一交给 npm run type-check 的 vue-tsc）
                transpileOnly:true
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
        historyApiFallback:true,
        // dev 下禁止缓存：bundle.js 文件名无 hash，浏览器缓存旧包会导致改了代码刷新也不生效（白屏/旧行为）
        headers:{'Cache-Control':'no-store'},
        // 关闭 gzip 压缩：v5 默认开启，压缩中间件会攒住 SSE 流、结束才一次性刷出，
        // 导致流式问答在 dev 代理下退化成"一大块冒出"
        compress:false,
        //代理配置:所有以/api开头的请求都会转发到后端
        proxy:[
            {   
                context:['/api'],
                target:'http://localhost:3000',
                changeOrigin:true
            }
        ]
    }
};