#!/bin/bash
# 测试 Kimi API 连通性
# 用法：在 houduan 目录下执行  bash test-kimi.sh
# 自动从 .env 读取 KIMI_API_KEY，不用手打 Key

# 从 .env 里取出 KIMI_API_KEY 的值
KEY=$(grep KIMI_API_KEY .env | cut -d= -f2)

echo "正在测试 Kimi API（模型: kimi-k2.6）..."
echo "----------------------------------------"

curl -s https://api.moonshot.cn/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"kimi-k2.6","messages":[{"role":"user","content":"1+1=?"}]}'

echo ""
echo "----------------------------------------"
