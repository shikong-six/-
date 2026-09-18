# Web Speech API 只在安全上下文可用（真机调试语音按钮消失之谜）

## 问题

H5 问答页做了语音输入功能：按住说话 → Web Speech API 识别 → 自动发问。开发时在电脑浏览器（localhost:8081）测试正常，按钮显示、能识别。但手机连同一 WiFi 访问局域网地址（`http://192.168.x.x:8081` 或 `http://10.x.x.x:8081`）时，**语音按钮神秘消失了**——不是样式问题，是整条功能没了。

## 原因

`SpeechRecognition`（含 webkit 前缀版本）是**安全上下文 API**（Secure Context），只在以下环境可用：

- `http://localhost` / `http://127.0.0.1`（浏览器视为安全）
- `https://`（合法证书）

局域网 IP（`http://192.168.x.x`）既不是 localhost 也不是 HTTPS，属于不安全上下文，`window.SpeechRecognition` 直接是 `undefined`。项目代码启动时做了特性检测（`isSpeechSupported()`），不支持就隐藏按钮——所以表现为"按钮消失"，这正是静默降级设计生效的表现，不是 bug。

微信内置浏览器同理：即便页面在 HTTPS 下，X5/WebKit 内核对 SpeechRecognition 的支持也不稳定，多数情况下同样检测不到。

## 解决方法

1. **代码侧（已做）**：特性检测 + 静默降级。不支持就藏按钮，用户无感知，功能可用性不受影响
2. **本地真机要测语音**：只能本机测（localhost），或者给局域网 IP 配 HTTPS（mkcert 签本地证书 + Vite `server.https`），成本高、仅调试用
3. **生产要上语音**：必须 HTTPS 部署（Nginx + certbot 免费证书），且要做好"微信里不可用"的心理预期——所以语音只能是增强项，文字输入必须是完整可用的主路径

## 一句话总结

Web Speech API 是安全上下文 API：localhost 和 HTTPS 才行，局域网 IP 访问时按钮自动隐藏是特性检测的降级表现，不是 bug。
