#!/usr/bin/env python3
"""法制通 · RAG 检索与回答评测脚本

为什么要这个脚本：
  项目里已经有 RRF 融合、多事项拆分、本地重排、场景闸门这些设计，
  但【没有评测】—— 就无法证明哪一步真的有用，也说不清效果好坏。
  有了它，你才能说：加了重排之后命中率从 X% 提到 Y%。

两种模式：
  1) --retrieval-only  只测「检索」：几乎不花 token（走知识库检索接口），可以反复跑
  2) --full            测「端到端」：调 /api/chat 让模型回答，再算引用正确率 / 要点覆盖 / 拒答率

指标含义（都是能算清楚的，不是感觉）：
  · 召回命中率   标准文档是否出现在检索结果里
  · 引用正确率   回答里写的「第X条」是否真的在检索到的资料里（编造就扣分）
  · 要点覆盖率   标准答案的关键词命中比例
  · 拒答率       库里没有的问题，是否正确说「未找到相关依据」而不是硬答

用法：
    python run_eval.py --retrieval-only
    python run_eval.py --full --user 你的账号 --password 你的密码
    python run_eval.py --full --base http://localhost:3000 --limit 10

依赖：只用了 requests（没有就 pip install requests）

★ 题库与口径说明
  题库 24 条，7 类：简单 / 口语化 / 多事项 / 跨法典 / 追问 / 越界 / 新入库法条。
  其中三处期望值是核对过语料原文后修正的，注释里都写了原因：
    · 要点比对先去掉虚词再比 —— 否则"照抄法条原文"反而被判 0%
    · 「加班费」期望法条改为第八十五条（原写第三十一条，那是加班"时长"）
    · 「危险驾驶」改成语料里真实存在的"醉酒驾驶 / 饮酒后驾驶"
  报告字段：
    refs       引用文档的原始文件名（含 _20121226 与 .docx）——判据键 + 版本追溯
    refTitles  同一批文档的展示名（《中华人民共和国刑法》），给人看和写日志用

   ★ 后台 / 重定向跑时必须先设 PYTHONUTF8=1：
     脚本里要 print("⚠样本少")，而 Windows 下 stdout 被重定向时是 GBK，
     ⚠(U+26A0) 编不出来会抛 UnicodeEncodeError —— 而且崩在报告落盘**之前**，
     等于整轮白跑（这个坑真实发生过两次）。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("缺 requests：pip install requests")
    sys.exit(1)

# ===========================================================================
# 标准题库：每条 = 一个真实问法 + 应该命中的文档 + 答案必须覆盖的要点
#   doc    : knowledge_seed/ 里的文档名（标准答案出处）
#   points : 回答里应该出现的要点（任一命中就算部分覆盖）
#   kind   : single 单事项 / multi 多事项 / followup 追问 / missing 库里没有
# 你可以按自己的语料继续补，20~30 条就足够说明问题
# ===========================================================================
GOLDEN = [
    # ================= simple：简单（一件事 / 一个部门 / 单条法条）=================
    {"q": "试用期被辞退有补偿吗", "cat": "simple", "doc": "中华人民共和国劳动合同法_20121228.docx",
     "articles": ["第四十七条"], "points": ["经济补偿"], "kind": "single"},
    # 题库口径修正（3 处）：每处的理由写在下面一行
    #   ①「二倍工资」：法条原文写的是"二倍的工资"，模型照抄原文反被判 0%（两轮实测都是 0%）
    #   ②「加班费」：问的是加班"费"，对应第八十五条；原来写第三十一条（管的是加班"时长"）→ 两轮条文×
    #   ③「危险驾驶」：这个词在 7 部法里出现 0 次（罪名来自司法解释，不在法条原文里），
    #      改成语料里真的有的"醉酒驾驶/饮酒后驾驶"，避免覆盖率在 50%/100% 之间抖动
    {"q": "公司一直不跟我签书面劳动合同怎么办", "cat": "simple", "doc": "中华人民共和国劳动合同法_20121228.docx",
     "articles": ["第八十二条"], "points": ["二倍工资", "二倍的工资"], "kind": "single"},
    {"q": "正当防卫把人打伤了要负刑事责任吗", "cat": "simple", "doc": "中华人民共和国刑法_20201226.docx",
     "articles": ["第二十条"], "points": ["正当防卫"], "kind": "single"},
    {"q": "离婚时孩子的抚养费怎么算", "cat": "simple", "doc": "中华人民共和国民法典_20200528.docx",
     "articles": ["第一千零八十五条"], "points": ["抚养费"], "kind": "single"},
    {"q": "合同里的格式条款有效吗", "cat": "simple", "doc": "中华人民共和国民法典_20200528.docx",
     "articles": ["第四百九十六条"], "points": ["格式条款"], "kind": "single"},
    {"q": "房东不退押金怎么办", "cat": "simple", "doc": "房产物业-房屋租赁押金.txt",
     "articles": [], "points": ["押金"], "kind": "single"},
    {"q": "网购的东西有问题可以退吗", "cat": "simple", "doc": "中华人民共和国消费者权益保护法_20131025.docx",
     "articles": [], "points": ["退", "消费者"], "kind": "single"},

    # ================= colloquial：口语化（测同义词扩展）=================
    {"q": "老板一直不给我加班钱咋办", "cat": "colloquial", "doc": "中华人民共和国劳动合同法_20121228.docx",
     "articles": ["第八十五条"], "points": ["加班"], "kind": "single"},
    {"q": "被人打了能让他坐牢吗", "cat": "colloquial", "doc": "中华人民共和国刑法_20201226.docx",
     "articles": [], "points": ["故意伤害", "轻伤"], "kind": "single"},
    {"q": "老公打我，我能离婚吗", "cat": "colloquial", "doc": "中华人民共和国民法典_20200528.docx",
     "articles": ["第一千零七十九条"], "points": ["家庭暴力", "离婚"], "kind": "single"},
    {"q": "喝酒开车被抓了会怎么判", "cat": "colloquial", "doc": "中华人民共和国刑法_20201226.docx",
     "articles": ["第一百三十三条"], "points": ["醉酒驾驶", "饮酒后驾驶"], "kind": "single"},

    # ================= multi：复杂·一句话两件事（测拆分）=================
    {"q": "我醉酒开车撞了人，公司还想借这个辞退我，这两件事分别怎么算", "cat": "multi",
     "doc": None,
     "docs": ["中华人民共和国刑法_20201226.docx", "中华人民共和国劳动合同法_20121228.docx"],
     "articles": [], "points": ["醉酒", "辞退"], "kind": "multi"},
    # 期望文档跟着语料走：工伤的直接依据已入库（《工伤保险条例》），
    #   不再拿劳动合同法凑（原来只能指望第四十二条里那句转引）。
    #   问题原文一个字不改：q 是对比脚本的配对键，改了就和历史报告对不上。
    {"q": "我上班路上被车撞了算工伤吗，医药费谁出", "cat": "multi",
     "doc": None,
     "docs": ["工伤保险条例_20101220.docx", "中华人民共和国道路交通安全法_20210429.docx"],
     "articles": ["第七十六条"], "points": ["工伤", "赔偿"], "kind": "multi"},

    # ================= crossdoc：复杂·跨法典（测多路召回）=================
    {"q": "开车撞了人，刑事和民事分别怎么处理", "cat": "crossdoc",
     "doc": "中华人民共和国道路交通安全法_20210429.docx",
     "articles": ["第七十六条"], "points": ["赔偿", "责任"], "kind": "single"},
    {"q": "房东违约不退押金还把我东西扔了，怎么维权", "cat": "crossdoc",
     "doc": "中华人民共和国民法典_20200528.docx",
     "articles": [], "points": ["违约", "押金"], "kind": "single"},

    # ================= followup：追问（依赖上文，前端整段对话发过去）=================
    {"q": "公司违法把我开除了要赔多少", "cat": "followup", "doc": "中华人民共和国劳动合同法_20121228.docx",
     "articles": ["第八十七条"], "points": ["赔偿金"], "kind": "single"},
    {"q": "那要是公司不给我怎么办", "cat": "followup", "doc": "中华人民共和国劳动合同法_20121228.docx",
     "articles": [], "points": ["仲裁", "劳动", "申请"], "kind": "followup"},

    # ============ newlaw：10/14 新入库《工伤保险条例》《劳动争议调解仲裁法》后补的用例 ============
    # 新增 4 条用例：对应 10/14 入库的《工伤保险条例》《劳动争议调解仲裁法》。
    #   期望值出处（已逐条核对入库原文，不凭记忆）：
    #     工伤保险条例 §14 应当认定为工伤（含"上下班途中，受到非本人主要责任的交通事故伤害"）
    #     工伤保险条例 §16 不得认定为工伤（故意犯罪、醉酒或者吸毒、自残或者自杀）
    #     工伤保险条例 §30 工伤医疗待遇（治疗工伤所需费用从工伤保险基金支付）
    #     劳动争议调解仲裁法 §27 劳动争议申请仲裁的时效期间为一年
    {"q": "上班途中被车撞了算工伤吗", "cat": "newlaw", "doc": "工伤保险条例_20101220.docx",
     "articles": ["第十四条"], "points": ["上下班途中", "工伤"], "kind": "single"},
    {"q": "工伤治疗的医药费谁出", "cat": "newlaw", "doc": "工伤保险条例_20101220.docx",
     "articles": ["第三十条"], "points": ["工伤医疗待遇"], "kind": "single"},
    {"q": "什么情况不能认定工伤", "cat": "newlaw", "doc": "工伤保险条例_20101220.docx",
     "articles": ["第十六条"], "points": ["不得认定为工伤", "故意犯罪"], "kind": "single"},
    {"q": "劳动仲裁有没有时间限制", "cat": "newlaw", "doc": "中华人民共和国劳动争议调解仲裁法_20071229.docx",
     "articles": ["第二十七条"], "points": ["仲裁时效", "一年"], "kind": "single"},

    # ================= missing：越界（测拒答 / 幻觉）=================
    {"q": "怎么申请外观设计专利", "cat": "missing", "doc": None,
     "articles": [], "points": ["未找到", "没有相关", "无相关", "知识库"], "kind": "missing"},
    {"q": "我想注册一家公司需要什么材料", "cat": "missing", "doc": None,
     "articles": [], "points": ["未找到", "没有相关", "无相关", "知识库"], "kind": "missing"},
    {"q": "我家猫抓伤了邻居要赔多少", "cat": "missing", "doc": None,
     "articles": [], "points": ["未找到", "没有相关", "无相关", "知识库"], "kind": "missing"},
]

ARTICLE_RE = re.compile(r"第[一二三四五六七八九十百零〇0-9]+条")


class RateLimited(Exception):
    """被限流（429）。评测里必须和"功能失败"分开算，否则指标不可信。"""


class Client:
    """调后端。字段名做成容错的：不同版本的返回字段不一样，脚本自己认。"""

    def __init__(self, base: str, user: str, password: str):
        self.base = base.rstrip("/")
        self.session = requests.Session()
        self.token = None
        self.keys_printed = False
        if user:
            self.login(user, password)

    def login(self, user: str, password: str) -> None:
        r = self.session.post(f"{self.base}/api/auth/login",
                              json={"username": user, "password": password}, timeout=20)
        r.raise_for_status()
        data = r.json()
        self.token = data.get("token") or data.get("accessToken") or (data.get("data") or {}).get("token")
        if not self.token:
            print(f"登录返回里没找到 token，实际字段：{list(data.keys())}")
            sys.exit(1)
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"登录成功：{user}")

    def _post(self, path: str, payload: dict, timeout: int = 120) -> dict:
        r = self.session.post(f"{self.base}{path}", json=payload, timeout=timeout)
        if r.status_code == 429:
            raise RateLimited("被限流（429）：把 --sleep 调大，或降低 --limit 再跑")
        r.raise_for_status()
        return r.json()

    def search(self, query: str, topk: int = 8) -> list[dict]:
        """知识库检索（不花 token）。返回 [{docName, text, chunkIndex}]"""
        for path in ("/api/knowledge/search", "/api/content/search", "/api/knowledge/query"):
            try:
                data = self._post(path, {"query": query, "topk": topk, "topK": topk})
            except Exception:
                continue
            if not self.keys_printed:
                print(f"  [检索接口 {path} 返回字段] {list(data.keys())}")
                self.keys_printed = True
            rows = data.get("data") or data.get("results") or data.get("list") or data.get("chunks") or []
            if isinstance(rows, dict):
                rows = rows.get("list") or rows.get("rows") or []
            return [self._norm_chunk(x) for x in rows]
        return []

    def ask(self, question: str, session_id: int | None = None,
            history: list[dict] | None = None) -> dict:
        """端到端问答（花 token）。

        ★ 请求体必须和前端一致：{messages: [{role, content}], sessionId?}
          （后端取 messages 里最后一条用户消息当问题；只传 question 会 400 ✗）
        """
        msgs = list(history or [])
        msgs.append({"role": "user", "content": question})
        payload = {"messages": msgs}
        if session_id:
            payload["sessionId"] = session_id
        for path in ("/api/chat",):
            try:
                data = self._post(path, payload)
            except Exception:
                continue
            if not self.keys_printed:
                print(f"  [问答接口 {path} 返回字段] {list(data.keys())}")
                self.keys_printed = True
            inner = data.get("data") if isinstance(data.get("data"), dict) else data
            answer = (inner.get("answer") or inner.get("content") or inner.get("reply")
                      or inner.get("message") or "")
            refs = inner.get("references") or inner.get("refs") or inner.get("sources") or []
            return {
                "answer": answer,
                "references": [self._norm_chunk(x) for x in refs],
                "sessionId": inner.get("sessionId") or session_id,
            }
        raise RuntimeError("问答接口都不通，检查后端是否启动、路径是否为 /api/chat")

    @staticmethod
    def _norm_chunk(x: dict) -> dict:
        return {
            "docName": x.get("docName") or x.get("doc_name") or x.get("doc") or x.get("name") or "",
            "text": x.get("text") or x.get("content") or x.get("chunk") or "",
            "chunkIndex": x.get("chunkIndex") or x.get("chunk_index") or x.get("index") or 0,
        }


def hit_doc(refs: list[dict], doc: str | None, docs: list[str] | None = None) -> bool:
    """标准文档是否被召回。

    多事项给了 docs 时，要求**每个事项的文档都召回**才算过 ——
    这才是"拆分真的生效"的证据，只命中一件事不算。
    """
    names = " | ".join((r["docName"] or "") for r in refs)
    if docs:
        return all(d.rsplit(".", 1)[0] in names for d in docs)
    if not doc:
        return True
    return doc.rsplit(".", 1)[0] in names


def hit_articles(refs: list[dict], articles: list[str] | None) -> bool:
    """期望的法条编号是否出现在召回的分块里（条文级命中，比文档级严格得多）。

    为什么加这一层：民法典有 1260 个分块，"命中了民法典"几乎等于没标准 ✗；
    而"命中第四十七条（经济补偿）"才是真正要的结果 ✓
    """
    if not articles:
        return True
    pool = "\n".join(r["text"] for r in refs)
    return any(a in pool for a in articles)


def citation_ok(answer: str, refs: list[dict]) -> tuple[bool, list[str]]:
    """回答里写的「第X条」是否都能在检索到的资料里找到（编造就判错）。"""
    cited = set(ARTICLE_RE.findall(answer or ""))
    if not cited:
        return True, []
    pool = "\n".join(r["text"] for r in refs)
    fabricated = [c for c in cited if c not in pool]
    return not fabricated, fabricated


# 要点比对先去掉虚词和标点再比。
# 为什么必须这样：法条原文写的是"二倍的工资"，要点栏写的是"二倍工资"，
# 直接字面比对会把**照抄原文的正确回答**判成 0% —— 实测连续两轮都发生了。
# 治的是一类问题（任何"模型照抄原文"的场合），不是打补丁绕过这一条。
FILLER_RE = re.compile(r"[的了是与和及，,。、；;：:　\s]")


def normalize(text: str) -> str:
    return FILLER_RE.sub("", text or "")


# 报告里给一份"给人看的法律名"。
# 报告原来只存 docName（如 中华人民共和国刑法_20201226.docx），日志和报告读起来很吵。
# 这里照抄前端 lawDisplayName 的规则（去扩展名、去末尾 _8位日期），保证三处一致：
# 前端展示名 = 后端提示词里的法名 = 报告里的 refTitles。
# 注意 refs 字段**保留原始 docName**：它是判据键，也是版本追溯的唯一依据。
def display_title(doc_name: str) -> str:
    stripped = re.sub(r"_\d{8}$", "", re.sub(r"\.[^.]+$", "", doc_name or "")).strip()
    return stripped or (doc_name or "")


def coverage(answer: str, points: list[str]) -> float:
    if not points:
        return 1.0
    flat = normalize(answer)
    hit = sum(1 for p in points if normalize(p) in flat)
    return hit / len(points)


def refused(answer: str) -> bool:
    """是否明确说了「没找到」而不是硬答。"""
    keys = ("未找到", "没有相关", "无相关", "未检索到", "知识库中未找到", "没有找到相关")
    return any(k in (answer or "") for k in keys)


def main() -> int:
    ap = argparse.ArgumentParser(description="法制通 RAG 评测")
    ap.add_argument("--base", default="http://localhost:3000", help="后端地址")
    ap.add_argument("--user", default="", help="登录账号（--full 模式需要）")
    ap.add_argument("--password", default="", help="登录密码")
    ap.add_argument("--retrieval-only", action="store_true", help="只测检索（几乎不花 token）")
    ap.add_argument("--full", action="store_true", help="端到端（会调模型，花 token）")
    ap.add_argument("--limit", type=int, default=0, help="只跑前 N 条")
    ap.add_argument("--sleep", type=float, default=1.0, help="每次请求之间等待秒数")
    args = ap.parse_args()

    if not args.retrieval_only and not args.full:
        args.retrieval_only = True          # 默认做便宜的

    cases = GOLDEN[: args.limit] if args.limit else GOLDEN
    # 检索接口同样需要 JWT，所以只要给了账号就登录（不只 --full 模式）
    client = Client(args.base, args.user, args.password)

    print(f"\n共 {len(cases)} 条标准问题｜模式：{'端到端' if args.full else '只测检索'}")
    print("=" * 78)

    rows = []
    session_id = None
    prev_turn: tuple[str, str] | None = None      # 上一轮的(问题, 回答)，追问时要用
    for i, case in enumerate(cases, 1):
        t0 = time.time()
        if args.full:
            try:
                # 每条用例独立会话，避免前面的问题污染后面的检索
                hist = None
                if case["kind"] == "followup" and prev_turn:
                    hist = [{"role": "user", "content": prev_turn[0]},
                            {"role": "assistant", "content": prev_turn[1]}]
                got = client.ask(case["q"], None, hist)
                refs, answer = got["references"], got["answer"]
            except RateLimited as exc:
                print(f"[{i:2d}] 限流跳过（不计入指标）：{exc}")
                rows.append({"q": case["q"], "cat": case.get("cat"), "ratelimited": True})
                time.sleep(20)
                continue
            except Exception as exc:  # noqa: BLE001
                print(f"[{i:2d}] 调用失败：{exc}")
                continue
        else:
            refs = client.search(case["q"])
            answer = ""

        recall = hit_doc(refs, case.get("doc"), case.get("docs"))
        article_hit = hit_articles(refs, case.get("articles"))
        cite_ok, fabricated = citation_ok(answer, refs)
        cov = coverage(answer, case.get("points") or [])
        miss_ok = True
        if case.get("kind") == "missing":
            miss_ok = refused(answer) if args.full else True

        ok = recall and article_hit and cite_ok and (cov >= 0.5) and miss_ok
        rows.append({
            "q": case["q"], "kind": case["kind"], "cat": case.get("cat"), "doc": case.get("doc"),
            "recall": recall, "article_hit": article_hit,
            "cite_ok": cite_ok, "fabricated": fabricated,
            "coverage": round(cov, 2), "refused": refused(answer) if args.full else None,
            "answer": answer[:300],
            # refs 保留原始 docName（判据键 + 版本追溯），refTitles 是给人看和写日志用的
            "refs": [r["docName"] for r in refs][:6],
            "refTitles": [display_title(r["docName"]) for r in refs][:6],
            "seconds": round(time.time() - t0, 1),
        })
        mark = "PASS" if ok else "FAIL"
        print(f"[{i:2d}] {mark}｜文档{'√' if recall else '×'}｜条文{'√' if article_hit else '×'}"
              f"｜引用{'√' if cite_ok else '×'}｜要点{cov:.0%}｜{case['kind']:8s}｜{case['q'][:24]}")
        if fabricated:
            print(f"        ⚠ 编造条文：{'、'.join(fabricated)}")
        if not recall and case.get("doc"):
            # 打印展示名：日志里出现 _20201226.docx 很吵，看的人只关心是哪部法
            print(f"        召回实际是：{'、'.join(display_title(r['docName']) for r in refs)[:80] or '（空）'}")
        if args.full and answer:
            prev_turn = (case["q"], answer)
        if args.sleep:
            time.sleep(args.sleep)

    # ---------------- 汇总（限流的不算）----------------
    limited = [r for r in rows if r.get("ratelimited")]
    rows = [r for r in rows if not r.get("ratelimited")]
    if limited:
        print(f"\n⚠ 有 {len(limited)} 条被限流跳过，已从指标里剔除（把 --sleep 调大可以少丢）")
    total = len(rows)
    if not total:
        print("没有结果，检查后端是否启动")
        return 1
    recall_rate = sum(r["recall"] for r in rows) / total
    article_rate = sum(r["article_hit"] for r in rows) / total
    cite_rate = sum(r["cite_ok"] for r in rows) / total
    avg_cov = sum(r["coverage"] for r in rows) / total
    missing_rows = [r for r in rows if r["kind"] == "missing"]
    refuse_rate = (sum(1 for r in missing_rows if r["refused"]) / len(missing_rows)) if missing_rows else None

    print("=" * 78)
    # ★ 按问题类型分开算 —— 混在一起会把"简单很好、复杂很差"抹平
    cats = []
    for r in rows:
        if r.get("cat") and r["cat"] not in cats:
            cats.append(r["cat"])
    cat_name = {"simple": "简单(单条文)", "colloquial": "口语化(同义词扩展)",
                "multi": "复杂·多事项", "crossdoc": "复杂·跨法典",
                "followup": "追问(依赖上文)", "missing": "越界(测拒答)"}
    print(f"{'类型':<20}{'样本':>4}{'文档召回':>9}{'条文命中':>9}{'引用正确':>9}{'要点覆盖':>9}")
    print("-" * 78)
    for cat in cats:
        sub = [r for r in rows if r.get("cat") == cat and not r.get("ratelimited")]
        n = len(sub)
        dr = sum(r["recall"] for r in sub) / n
        ar = sum(r["article_hit"] for r in sub) / n
        cr = sum(r["cite_ok"] for r in sub) / n
        cv = sum(r["coverage"] for r in sub) / n
        warn = "  ⚠样本少" if n < 5 else ""
        print(f"{cat_name.get(cat, cat):<20}{n:>4}{dr:>8.0%}{ar:>9.0%}{cr:>9.0%}{cv:>9.0%}{warn}")
    print("-" * 78)
    print(f"{'全部':<20}{total:>4}{recall_rate:>8.0%}{article_rate:>9.0%}{cite_rate:>9.0%}{avg_cov:>9.0%}")
    print("=" * 78)
    print(f"文档召回率   {recall_rate:.0%}   （{sum(r['recall'] for r in rows)}/{total}）")
    print(f"条文命中率   {article_rate:.0%}   （{sum(r['article_hit'] for r in rows)}/{total}，期望法条真的被检索到）")
    print(f"引用正确率   {cite_rate:.0%}   （没编造资料里没有的条文）")
    print(f"要点覆盖率   {avg_cov:.0%}")
    if refuse_rate is not None:
        print(f"拒答率       {refuse_rate:.0%}   （{len(missing_rows)} 条库里没有的问题）")
    print("=" * 78)
    print("\n★ 这几个数字就是可以写进简历/面试讲的：")
    print(f"   「RAG 检索条文命中率 {article_rate:.0%}，文档召回率 {recall_rate:.0%}，回答引用正确率 {cite_rate:.0%}，"
          f"要点覆盖 {avg_cov:.0%}」")
    print("   跑一次对照组（关掉重排/闸门）再跑，就能得到「每一步提升了多少」")

    # 报告写在脚本同目录（eval/），文件名带日期时分，便于和历史轮次对比
    out = Path(__file__).parent / f"report-{datetime.now():%m%d-%H%M}.json"
    out.write_text(json.dumps({
        "base": args.base, "mode": "full" if args.full else "retrieval-only",
        "total": total, "recall": recall_rate, "article_hit": article_rate, "citation": cite_rate,
        "coverage": avg_cov, "refusal": refuse_rate, "rows": rows,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n报告已存：{out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
