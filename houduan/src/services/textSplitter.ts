// 文本分块服务
// 向量库按法律结构切：一条一块。不按固定字数切断，避免一条法条被拆开。

// 行首才算条文标题。正文里的“依照本法第一百零八条”不会被当成新的一条。
const ARTICLE_HEAD = /^[ \t\u3000]*第[0-9一二三四五六七八九十百千零]+条(?:之[0-9一二三四五六七八九十]+)?/;
// 修正案正文通常是“一、将刑法第X条……”，没有独立的“第X条”标题
const ITEM_HEAD = /^[ \t\u3000]*[一二三四五六七八九十百千]+、/;

export function splitText(text: string, docName = ''): string[] {
  const normalized = text.replace(/\r/g, '');
  const articles = splitByHeading(normalized, ARTICLE_HEAD);
  const chunks = articles.length > 0 ? articles : splitByHeading(normalized, ITEM_HEAD);
  const picked = chunks.length > 0 ? chunks : splitByParagraph(normalized);
  return picked.map((chunk) => withLawName(chunk, docName));
}

// 从第一个标题切到下一个标题。标题前的法律名称、通过日期、目录不入库。
function splitByHeading(text: string, head: RegExp): string[] {
  const lines = text.split('\n');
  const indexes: number[] = [];
  lines.forEach((line, index) => {
    if (head.test(line)) indexes.push(index);
  });
  if (indexes.length === 0) return [];

  const chunks: string[] = [];
  for (let i = 0; i < indexes.length; i++) {
    const from = indexes[i];
    const to = i + 1 < indexes.length ? indexes[i + 1] : lines.length;
    const body = lines.slice(from, to).map((line) => line.trim()).filter(Boolean).join('\n').trim();
    if (body.length >= 8) chunks.push(body);
  }
  return chunks;
}

// 没有条文标题的普通文档按空行分段，仍然不按字数截断
function splitByParagraph(text: string): string[] {
  const parts = text.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.length >= 8);
  if (parts.length > 0) return parts;
  const one = text.trim();
  return one ? [one] : [];
}

// 给人看的法律名：去掉扩展名和文件名末尾的 _20121228 这类日期
export function lawTitleFromDocName(docName: string): string {
  return docName.replace(/\.[^.]+$/, '').replace(/_\d{8}$/, '').trim();
}

// 每块开头写上法律名，检索和回答才能对上是哪一部法
function withLawName(chunk: string, docName: string): string {
  const title = lawTitleFromDocName(docName);
  if (!title || chunk.startsWith(`《${title}》`)) return chunk;
  return `《${title}》\n${chunk}`;
}
