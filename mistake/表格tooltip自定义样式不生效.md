# 踩坑记录：表格悬停提示框自定义样式不生效（tooltip-options 用错层级）

## 问题现象

对话历史页的回答列用 `show-overflow-tooltip` 悬停显示全文，但提示框横贯全屏一行展示。给列加 `:tooltip-options="{ popperClass: 'answer-tooltip' }"` 并写了限宽换行的 CSS 后，样式依然没有生效。

## 问题原因

两个错误叠加：

1. **`tooltip-options` 是 `<el-table>`（表格整体）的属性，不是 `<el-table-column>` 的**。写在列上会被 Vue 当作无效属性忽略，不报错也不生效。
2. 想给**某一列**的提示框传自定义配置，正确写法是把对象直接传给列的 `show-overflow-tooltip`：Element Plus 内部会把对象 merge 进 tooltip 配置（源码：`merge({ effect }, tooltipOptions, column.showOverflowTooltip)`）。

## 解决方法

```vue
<!-- ❌ 错误：tooltip-options 不是列的属性 -->
<el-table-column show-overflow-tooltip :tooltip-options="{ popperClass: 'answer-tooltip' }" />

<!-- ✅ 正确：对象直接传给 show-overflow-tooltip -->
<el-table-column :show-overflow-tooltip="{ popperClass: 'answer-tooltip' }" />
```

配套 CSS 必须写在**不带 scoped 的 style 块**里（提示框挂载在 body 下，scoped 够不着）：

```css
.answer-tooltip {
  max-width: 500px;
  white-space: pre-wrap;
  line-height: 1.6;
}
```

## 经验总结

1. UI 组件库的 prop"看着合理"不代表存在：Vue 对不存在的 prop 只是静默忽略，**不报错**。排查"属性没效果"时，先去查这个组件到底有没有这个 prop、属于哪个层级。
2. 需要确认组件库行为时，**直接读源码比翻文档快**（本次就是在 `node_modules/element-plus/es/.../render-helper.mjs` 里看到 merge 逻辑才确定的写法）。
3. 弹层类组件（tooltip/dialog/message）大多挂载在 body 下，改它们的样式记得用全局 style 块。
