#!/usr/bin/env python3
"""把新法律文档入库到知识库（走 /api/knowledge/upload），并回查结果

为什么要先本地预检：
  分块靠"第X条"识别（textSplitter 按条文切）。如果文档里条文号是"第 一 条"
  这种带空格的排版，或者干脆是 PDF 转出来的乱序文本，切块会碎，
  入库后表现为"召回到了但条文对不上"，很难查。
  所以先数一遍条文号再上传，心里有数。

为什么文件名要显式指定：
  浏览器下载会给重名文件加 " (1)" 后缀。带进库里会变成
  中华人民共和国劳动争议调解仲裁法_20071229 (1).docx —— 难看，而且题库里
  写期望文档名时要跟着带空格括号。所以这里用**规范名**上传，
  服务端存的是我们传过去的名字（multer 用 originalname）。

安全设计：库里已存在同名文档就跳过，不重复入库（避免向量库出现两份）。
"""
from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"
USER, PASSWORD = "eval_bot", "eval123456"
CORPUS_DIR = Path(r"C:\Users\shiko\Desktop\new object - 副本\法律案例")

# (磁盘上的文件, 入库用的规范名, 预检必须出现的关键词)
TO_UPLOAD = [
    ("工伤保险条例_20101220.docx", "工伤保险条例_20101220.docx", ["上下班途中", "第十四条", "第十五条"]),
    ("中华人民共和国劳动争议调解仲裁法_20071229 (1).docx",
     "中华人民共和国劳动争议调解仲裁法_20071229.docx", ["仲裁委员会", "第一条", "申请"]),
]

ARTICLE_RE = re.compile(r"第[一二三四五六七八九十百千零〇0-9]+条")


def docx_text(path: Path) -> str:
    """docx 就是 zip，正文在 word/document.xml，去标签即得纯文本。"""
    with zipfile.ZipFile(path) as zf:
        xml = zf.read("word/document.xml").decode("utf-8", "ignore")
    return re.sub(r"<[^>]+>", "", re.sub(r"</w:p>", "\n", xml))


def main() -> int:
    session = requests.Session()
    body = session.post(f"{BASE}/api/auth/login",
                        json={"username": USER, "password": PASSWORD}, timeout=20).json()
    token = body.get("token") or (body.get("data") or {}).get("token")
    session.headers.update({"Authorization": f"Bearer {token}"})

    existing = {row.get("filename") for row in
                (session.get(f"{BASE}/api/knowledge/list", timeout=20).json().get("data") or [])}
    print(f"入库前库里已有 {len(existing)} 个文档\n")

    for disk_name, clean_name, must_have in TO_UPLOAD:
        path = CORPUS_DIR / disk_name
        print("=" * 74)
        print(f"【预检】{disk_name}")
        if not path.exists():
            print("  ✗ 文件不存在，跳过")
            continue
        text = docx_text(path)
        articles = ARTICLE_RE.findall(text)
        print(f"  正文 {len(text)} 字｜条文号 {len(articles)} 个"
              f"（首 {articles[0] if articles else '—'} / 末 {articles[-1] if articles else '—'}）")
        for keyword in must_have:
            print(f"  {'✓' if keyword in text else '✗'} 含关键内容「{keyword}」")
        print(f"  开头：{text.strip()[:70]}")

        if clean_name in existing:
            print(f"  → 库里已有《{clean_name}》，跳过不重复入库")
            continue

        print(f"【入库】以规范名上传：{clean_name}")
        with path.open("rb") as handle:
            resp = session.post(
                f"{BASE}/api/knowledge/upload",
                files={"file": (clean_name, handle,
                                "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
                timeout=600,
            )
        if resp.status_code != 200:
            print(f"  ✗ 上传失败 HTTP {resp.status_code}：{resp.text[:200]}")
            continue
        data = (resp.json().get("data") or {})
        print(f"  ✓ 入库成功：{data.get('chunkCount')} 块｜同步条文 {data.get('articleCount')} 条"
              f"｜库里名字 {data.get('filename')}")

    print("\n" + "=" * 74)
    print("【回查】入库后的知识库清单")
    for row in (session.get(f"{BASE}/api/knowledge/list", timeout=20).json().get("data") or []):
        print(f"  {str(row.get('chunkCount')):>5} 块  {row.get('filename')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
