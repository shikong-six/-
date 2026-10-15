#!/usr/bin/env python3
"""零 token 探针：确认线上后端 :3000 到底加载了哪一版 retrieve.ts

为什么要写这个：
  retrieve.ts 是 01:25 改的，而后端进程是 10/13 20:10 启动的。
  如果后端不是 `tsx watch`（热重载），那它跑的还是改之前的代码 ——
  这时候直接跑 20 分钟评测，得到的数字全是废的（跑的是旧逻辑）。

原理（不用花钱）：
  /api/chat/stream 的顺序是「先检索 → 推 status 事件 → 最后才调 Kimi」。
  新代码在拆分命中时会推一条 `这个问题里有 N 件事，分开查找法条…`
  （来自 retrieve.ts 的 retrieveForUserQuestion）。
  所以只要读到检索阶段那几个 status 就断开，就能判断：
    · 看到「N 件事」 → 线上是新代码 ✓
    · 没看到         → 线上是旧代码 ✗（评测前必须先重启后端）

代价：断开时服务端可能已经发起了 Kimi 请求（首 token 前后会被中断），
      只有一条短请求的零头，不是一次完整生成。
"""
from __future__ import annotations

import json
import sys

import requests

# 中文输出别乱码（Windows 控制台默认 GBK）
sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"
USER = "eval_bot"
PASSWORD = "eval123456"
# 就用题库里那条多事项问题，它最能区分新旧代码
QUESTION = "我醉酒开车撞了人，公司还想借这个辞退我，这两件事分别怎么算"


def main() -> int:
    session = requests.Session()
    resp = session.post(f"{BASE}/api/auth/login",
                        json={"username": USER, "password": PASSWORD}, timeout=20)
    resp.raise_for_status()
    body = resp.json()
    token = body.get("token") or (body.get("data") or {}).get("token")
    if not token:
        print(f"登录返回里没有 token，字段：{list(body.keys())}")
        return 1
    session.headers.update({"Authorization": f"Bearer {token}"})
    print(f"登录成功：{USER}")

    statuses: list[str] = []
    print(f"提问：{QUESTION}")
    print("-" * 70)
    with session.post(f"{BASE}/api/chat/stream",
                      json={"messages": [{"role": "user", "content": QUESTION}]},
                      stream=True, timeout=180) as stream:
        print(f"HTTP {stream.status_code}｜{stream.headers.get('Content-Type')}")
        for raw in stream.iter_lines(decode_unicode=True):
            if not raw:
                continue
            if not raw.startswith("data:"):
                continue
            try:
                event = json.loads(raw[5:].strip())
            except json.JSONDecodeError:
                print(f"  （非 JSON 行）{raw[:100]}")
                continue
            kind = event.get("type")
            if kind == "status":
                message = event.get("message", "")
                print(f"  [status] {message}")
                statuses.append(message)
                # 检索阶段结束的信号 → 立刻断开，别等模型生成
                if "正在生成回答" in message:
                    print(">>> 检索阶段已结束，立即断开（不等生成）")
                    break
            elif kind == "token":
                print(">>> 已经进入生成阶段（断晚了，会产生一次生成请求）")
                break
            else:
                print(f"  [{kind}] {str(event)[:120]}")
                break

    print("-" * 70)
    split_evidence = [m for m in statuses if "件事" in m]
    if split_evidence:
        print("结论：线上后端跑的是【新代码】✓")
        print(f"  拆分证据：{split_evidence[0]}")
    else:
        print("结论：线上后端【没有】多事项拆分（旧代码）✗")
        print("  → 必须先重启后端再评测，否则数字全废")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
