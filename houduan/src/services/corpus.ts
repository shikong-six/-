// 法律条文页的全文列表。数据来自问答用的向量库，不写入 law_articles。
// 那张表仍然只放手写的常用摘录。
import {lawTitleFromDocName} from './textSplitter';
import {listChunkTexts} from './vectorStore';

export interface CorpusLaw {
  docName: string;
  title: string;
  count: number;
}

export interface CorpusArticle {
  key: string;
  docName: string;
  source: string;
  content: string;
  chunkIndex: number;
}

export interface CorpusPage {
  laws: CorpusLaw[];
  total: number;
  page: number;
  pageSize: number;
  items: CorpusArticle[];
}

// 展示顺序。修正案单独排在刑法后面，避免被「刑法」两个字提前匹配走。
const LAW_ORDER = ['民法典', '刑法', '修正案', '民事诉讼法', '劳动合同法', '道路交通安全法', '消费者权益保护法'];

function lawRank(docName: string): number {
  const title = lawTitleFromDocName(docName);
  if (title.includes('修正案')) {
    const at = LAW_ORDER.indexOf('修正案');
    return at === -1 ? 50 : at;
  }
  const at = LAW_ORDER.findIndex((name) => name !== '修正案' && title.includes(name));
  return at === -1 ? 100 : at;
}

function toArticle(row: {text: string; docName: string; chunkIndex: number}): CorpusArticle {
  const title = lawTitleFromDocName(row.docName);
  const lines = row.text.split('\n').map((line) => line.trim()).filter(Boolean);
  const body = lines[0]?.startsWith('《') ? lines.slice(1) : lines;
  const head = body[0] || title;
  const articleNo = head.match(/^第[0-9一二三四五六七八九十百千零]+条(?:之[0-9一二三四五六七八九十]+)?/)?.[0]
    || head.match(/^[一二三四五六七八九十百千]+、/)?.[0]
    || '';
  return {
    key: `${row.docName}#${row.chunkIndex}`,
    docName: row.docName,
    source: articleNo ? `《${title}》${articleNo}` : `《${title}》`,
    content: body.join('\n') || row.text,
    chunkIndex: row.chunkIndex,
  };
}

// 条号检索：页面上习惯输入 1085，正文写的是「第一千零八十五条」。
function chineseNumber(num: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const units = ['', '十', '百', '千'];
  const raw = String(num);
  let result = '';
  let zeroPending = false;
  for (let i = 0; i < raw.length; i++) {
    const digit = Number(raw[i]);
    const unit = units[raw.length - 1 - i];
    if (digit === 0) {
      zeroPending = result.length > 0;
      continue;
    }
    if (zeroPending) result += '零';
    zeroPending = false;
    result += digits[digit] + unit;
  }
  return result.replace(/^一十/, '十');
}

function keywordForms(keyword: string): string[] {
  const compact = keyword.replace(/\s+/g, '');
  const forms = [compact];
  const digits = compact.match(/\d+/g) || [];
  for (const text of digits) {
    const num = Number(text);
    if (!Number.isInteger(num) || num <= 0 || num > 9999) continue;
    forms.push(chineseNumber(num));
  }
  return [...new Set(forms)].filter(Boolean);
}

export async function listCorpus(options: {
  docName?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<CorpusPage> {
  const rows = await listChunkTexts();
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.docName, (counts.get(row.docName) ?? 0) + 1);
  }
  const laws = [...counts.entries()]
    .map(([docName, count]) => ({docName, title: lawTitleFromDocName(docName), count}))
    .sort((a, b) => lawRank(a.docName) - lawRank(b.docName) || a.title.localeCompare(b.title, 'zh'));

  const forms = keywordForms(options.keyword || '');
  const matched = rows
    .filter((row) => !options.docName || row.docName === options.docName)
    .filter((row) => {
      if (forms.length === 0) return true;
      const compact = row.text.replace(/\s+/g, '');
      return forms.some((form) => compact.includes(form));
    })
    .sort((a, b) => lawRank(a.docName) - lawRank(b.docName) || a.chunkIndex - b.chunkIndex);

  const pageSize = Math.min(48, Math.max(1, options.pageSize || 12));
  const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, options.page || 1));
  const start = (page - 1) * pageSize;
  return {
    laws,
    total: matched.length,
    page,
    pageSize,
    items: matched.slice(start, start + pageSize).map(toArticle),
  };
}
