declare module '*.vue' {
    import {DefineComponent} from 'vue';
    const component:DefineComponent<{},{},any>;
    export default component;
}
//声明css文件可以被导入
declare module '*.css'{}
declare module '*.scss'{}
declare module '*.less'{}