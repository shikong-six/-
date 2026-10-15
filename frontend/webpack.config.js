const path=require('path');
const HtmlWebpackPlugin=require('html-webpack-plugin');
const {VueLoaderPlugin}=require('vue-loader');

module.exports={
    entry:'./src/main.ts',
    output:{
        path:path.resolve(__dirname,'dist'),
        // 内容哈希：文件内容变了才换名字，没变就命中浏览器缓存。
        // 原来固定叫 bundle.js —— dev 里靠 devServer 的 no-store 兜着，
        // 但生产环境没有这层保护，发包后用户可能一直拿到旧包。
        // ★ 分包之后这条是必须的：main / element-plus / vendors / runtime
        //   都是初始 chunk，共用一个固定文件名会直接构建冲突。
        filename:'[name].[contenthash:8].js',
        // 异步 chunk（懒加载路由）也要带哈希，否则同样会被缓存住旧版本
        chunkFilename:'[name].[contenthash:8].chunk.js',
        // 资源根路径固定为 /：history 模式下深链（/cases/marriage）访问时，
        // index.html 里的相对路径 bundle.js 会被解析成 /cases/bundle.js 导致 404 白屏
        publicPath:'/',
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
    // ===== 产物分包与长期缓存 =====
    optimization:{
        // runtime 里存着 chunk 映射关系，它跟着业务代码变；单独拆出来后，
        // 第三方包的内容哈希不会因为业务改动而失效
        runtimeChunk:'single',
        splitChunks:{
            cacheGroups:{
                // Element Plus 最重（当前是全量引入，1MiB 量级）且几乎不随业务改动，
                // 单独一包：用户只需下载一次，后续改业务不会让它重新下载
                elementPlus:{
                    test:/[\\/]node_modules[\\/]element-plus[\\/]/,
                    name:'element-plus',
                    chunks:'all',
                    priority:30
                },
                // 其余第三方（vue / axios / marked / dompurify …）合成一包
                vendors:{
                    test:/[\\/]node_modules[\\/]/,
                    name:'vendors',
                    chunks:'all',
                    priority:10
                }
            }
        }
    },
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