# 踩坑记录：LanceDB 按文档名删除分块

## 问题现象

- 做"知识库文档删除"功能时，需要在向量库里删掉某文档的所有分块。LanceDB 的删除 API 是 `table.delete(where)`，where 是字符串条件。
- 如果直接把文档名拼进条件：`table.delete(\`docName = '${docName}'\`)`，文档名里含有单引号（如 `员工's手册.txt`）时条件串会被截断，轻则删不掉，重则语法报错。

## 问题原因

`delete` 的 where 参数本质是 SQL 风格的谓词字符串，文档名作为字符串字面量拼进去，其中的单引号就是特殊字符，必须转义。

## 解决方法

拼接前把单引号转义成两个单引号（SQL 标准转义法）：

```ts
export async function deleteChunksByDocName(docName: string): Promise<void> {
    const table = await getTable();
    if (!table) return;
    // 单引号转义成两个单引号，防止条件串被截断
    const escaped = docName.replace(/'/g, "''");
    await table.delete(`docName = '${escaped}'`);
}
```

另外删除顺序上：先删向量库、再删 MySQL 元数据；向量库删除失败只记日志不阻断（兜底宁可残留向量也不丢元数据，残留向量只是占空间、不会被检索出来展示）。

## 经验总结

- 凡是"用户输入拼进查询条件"的地方都要过一遍转义，文件名是用户输入。
- 跨存储（MySQL + LanceDB）的删除要想好失败顺序：哪边失败可以接受残留。
