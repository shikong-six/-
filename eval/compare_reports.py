#!/usr/bin/env python3
"""新旧评测报告对比：把「改之前」和「改之后」摆在一起看

为什么要这个脚本：
  单看一份报告的百分比，说不清"这次修复到底改动了哪几条"。
  面试里被问「你怎么证明这个优化有效」，你要能指着某一条说：
  「这条从召回为空变成命中两件文档」—— 这比一个总数可信得多。

用法：
    python compare_reports.py reports/报告A.json reports/报告B.json

输出：
  1) 总指标对比（召回/条文/引用/覆盖/拒答）
  2) 按问题类型对比（简单/口语/多事项/跨法典/追问/越界）
  3) 逐条变化明细（只看变了的，标出 ×→√ 这种翻转）
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

CAT_NAME = {
    "simple": "简单(单条文)",
    "colloquial": "口语化(同义词)",
    "multi": "复杂·多事项",
    "crossdoc": "复杂·跨法典",
    "followup": "追问(依赖上文)",
    "missing": "越界(测拒答)",
    "newlaw": "新入库法条",          # 10/14 入库工伤保险条例、劳动争议调解仲裁法后新增的分类
}
METRICS = [
    ("recall", "文档召回"),
    ("article_hit", "条文命中"),
    ("citation", "引用正确"),
    ("coverage", "要点覆盖"),
    ("refusal", "拒答率"),
]

# 逐条字段（存在 rows 里的），用于「同口径」聚合。
# 注意字段名不一样：报告级叫 citation/refusal，行级叫 cite_ok/refused。
ROW_METRICS = [
    ("recall", "文档召回"),
    ("article_hit", "条文命中"),
    ("cite_ok", "引用正确"),
    ("coverage", "要点覆盖"),
    ("refused", "拒答率"),
]


def rate(rows: list[dict], key: str) -> float | None:
    """一组用例里某个字段的比例。

    布尔字段（召回/条文/引用/拒答）就是"通过率"，coverage 是浮点，两者都能直接求均值。
    字段缺失（旧版脚本没写）的那条会被跳过，不让它把比例拉低。
    """
    values = [row[key] for row in rows if row.get(key) is not None]
    return sum(values) / len(values) if values else None


def load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def fmt(value: float | None) -> str:
    return "  -" if value is None else f"{value:>5.0%}"


def rows_by_cat(report: dict) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for row in report["rows"]:
        grouped.setdefault(row.get("cat") or "?", []).append(row)
    return grouped


def backfill_cat(old: dict, new: dict) -> dict[str, list[dict]]:
    """旧报告可能没有 cat 字段（脚本早期版本没写），分类对比会退化成 nan%。

    这里用新报告的「问题 → 类型」映射把旧的补上。
    只按问题原文匹配 —— 题目被改过就补不上，会落进 "?"，宁可显示未知也不要猜。
    """
    q_to_cat = {r["q"]: r.get("cat") for r in new["rows"] if r.get("cat")}
    for row in old["rows"]:
        if not row.get("cat"):
            row["cat"] = q_to_cat.get(row["q"])
    return rows_by_cat(old)


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    old, new = load(sys.argv[1]), load(sys.argv[2])

    print(f"旧报告：{Path(sys.argv[1]).name}  ({old['mode']}, {old['total']} 条)")
    print(f"新报告：{Path(sys.argv[2]).name}  ({new['mode']}, {new['total']} 条)")

    # 按问题原文索引旧报告：题库改过时，配不上的题不参与「同口径」比较
    old_by_q = {r["q"]: r for r in old["rows"]}

    # ---------------- 1) 总指标 ----------------
    # ★ 分两块给：
    #   「整份报告」= 报告自己的汇总字段（分母是各自的题量）
    #   「同口径」  = 只算两份报告都有的题（分母一致）
    #   为什么必须两块都给：题库从 18 条变 20 条时，78%(14/18) 和 85%(17/20)
    #   直接相减会凭空多出 7 个点，那 7 个点是分母带来的，不是修复带来的。
    print(f"\n{'【整份报告】各自分母':<28}(旧 {old['total']} 条 / 新 {new['total']} 条)")
    print("=" * 62)
    print(f"{'指标':<12}{'旧':>10}{'新':>10}{'变化':>12}")
    print("-" * 62)
    for key, label in METRICS:
        before, after = old.get(key), new.get(key)
        if before is None and after is None:
            continue
        delta = ""
        if before is not None and after is not None:
            diff = after - before
            arrow = "↑" if diff > 0.001 else ("↓" if diff < -0.001 else "=")
            delta = f"{arrow}{diff:+.0%}"
        print(f"{label:<12}{fmt(before):>10}{fmt(after):>10}{delta:>12}")

    matched = [(row, old_by_q[row["q"]]) for row in new["rows"] if row["q"] in old_by_q]
    print(f"\n{'【同口径】只算共有题':<28}({len(matched)} 条)")
    print("=" * 62)
    print(f"{'指标':<12}{'旧':>10}{'新':>10}{'变化':>12}")
    print("-" * 62)
    for key, label in ROW_METRICS:
        pool_old = [old_row for _, old_row in matched]
        pool_new = [new_row for new_row, _ in matched]
        if key == "refused":
            # ★ 拒答率只能在「库里没有」的越界题上算。
            #   行级 refused 字段对**所有**题都写了值（普通题不拒答是正常行为），
            #   混在一起求均值会得到一个既不是召回也不是拒答的怪数字。
            pool_old = [row for row in pool_old if row.get("kind") == "missing"]
            pool_new = [row for row in pool_new if row.get("kind") == "missing"]
        before, after = rate(pool_old, key), rate(pool_new, key)
        if before is None and after is None:
            continue
        delta = ""
        if before is not None and after is not None:
            diff = after - before
            arrow = "↑" if diff > 0.001 else ("↓" if diff < -0.001 else "=")
            delta = f"{arrow}{diff:+.0%}"
        print(f"{label:<12}{fmt(before):>10}{fmt(after):>10}{delta:>12}")

    # ---------------- 2) 分类对比 ----------------
    print("\n" + "=" * 76)
    print(f"{'类型':<18}{'样本':>5}{'文档召回(旧→新)':>22}{'条文命中(旧→新)':>22}")
    print("-" * 76)
    old_cats, new_cats = backfill_cat(old, new), rows_by_cat(new)
    for cat in new_cats:
        new_rows = new_cats[cat]
        old_rows = old_cats.get(cat, [])
        # ★ 只在「新旧两份报告都有」的同一批题上算比例。
        #   题库被改过（这次就多加了 2 条 missing），分母不对齐的话百分比没有可比性。
        common = {r["q"] for r in old_rows} & {r["q"] for r in new_rows}
        old_sub = [r for r in old_rows if r["q"] in common]
        new_sub = [r for r in new_rows if r["q"] in common]
        if common:
            cell_recall = (f"{sum(r['recall'] for r in old_sub) / len(old_sub):.0%}"
                           f" → {sum(r['recall'] for r in new_sub) / len(new_sub):.0%}")
            cell_article = (f"{sum(r['article_hit'] for r in old_sub) / len(old_sub):.0%}"
                            f" → {sum(r['article_hit'] for r in new_sub) / len(new_sub):.0%}")
        else:
            cell_recall = cell_article = "-"      # 这一类没有可比样本，不编数字
        sample = f"{len(new_rows)}" if len(common) == len(new_rows) else f"{len(new_rows)}(比{len(common)})"
        skew = "  ⚠样本少" if len(common) < 5 else ""
        print(f"{CAT_NAME.get(cat, cat):<18}{sample:>5}"
              f"{cell_recall:>22}{cell_article:>22}{skew}")

    # ---------------- 3) 逐条变化 ----------------
    print("\n" + "=" * 76)
    print("逐条变化（只列有变化的）")
    print("-" * 76)
    changed = 0
    for row in new["rows"]:
        before = old_by_q.get(row["q"])
        if not before:
            print(f"[新增] {row['q'][:30]}")
            changed += 1
            continue
        marks = []
        for key, label in (("recall", "召回"), ("article_hit", "条文"), ("cite_ok", "引用")):
            if bool(before.get(key)) != bool(row.get(key)):
                marks.append(f"{label}{'√' if before.get(key) else '×'}→{'√' if row.get(key) else '×'}")
        if abs((before.get("coverage") or 0) - (row.get("coverage") or 0)) > 0.001:
            marks.append(f"覆盖{before.get('coverage'):.0%}→{row.get('coverage'):.0%}")
        if not marks:
            continue
        changed += 1
        print(f"[{row.get('cat') or '?':<10}] {row['q'][:26]:<28} {'  '.join(marks)}")
        if not row.get("recall"):
            # 优先用展示名（refTitles，去掉了 _20201226.docx 这类噪音），老报告没这个字段就退回 refs
            got = row.get("refTitles") or row.get("refs") or []
            print(f"{'':<13}新召回：{'、'.join(got)[:78] or '（空）'}")
    if not changed:
        print("（没有变化）")
    print("=" * 76)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
