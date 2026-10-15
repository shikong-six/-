// 长对话只把最近几轮原话交给模型。更早的回答里常有当时引用的法条，整段带上后，后面的问题会沿用那些条文。
// 更早的用户原话收成一份事实，检索仍用完整对话，不在这里裁。

const RECENT_USER_TURNS = 3;
const FACT_CHARS = 120;
const MAX_OLDER_FACTS = 16;

export interface DialogMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function earlierFactNote(facts: string): string {
  if (!facts) return '';
  return `\n用户更早说过这些事实。它们只用来补全最后一问里没有再说的经过。最后一问如果已经换成另一件事，就只回答最后一问，不要把旧事实再答一遍。更早的回答已省略，不要沿用那些回答里的法条编号，法条只以本次资料为准。\n${facts}\n`;
}

function clipFact(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > FACT_CHARS ? `${flat.slice(0, FACT_CHARS)}…` : flat;
}

// 最近三轮用户提问及其中间的回答原样保留。再早的只留用户原话。
export function packConversation(messages: Array<{role?: string; content?: string}>): {history: DialogMessage[]; earlierFacts: string} {
  const dialog: DialogMessage[] = [];
  for (const item of messages) {
    const content = item.content?.trim() || '';
    if ((item.role !== 'user' && item.role !== 'assistant') || !content) continue;
    dialog.push({role: item.role, content});
  }
  const userAt = dialog.map((item, index) => (item.role === 'user' ? index : -1)).filter((index) => index >= 0);
  if (userAt.length <= RECENT_USER_TURNS) {
    return {history: dialog, earlierFacts: ''};
  }
  const cut = userAt[userAt.length - RECENT_USER_TURNS];
  const older = dialog.slice(0, cut).filter((item) => item.role === 'user').map((item) => clipFact(item.content));
  const kept = older.length <= MAX_OLDER_FACTS
    ? older
    : [older[0], ...older.slice(older.length - (MAX_OLDER_FACTS - 1))];
  const earlierFacts = kept.map((line, index) => `${index + 1}. ${line}`).join('\n');
  return {history: dialog.slice(cut), earlierFacts};
}
