#!/bin/bash
# Move to the project root directory
cd "$(dirname "$0")/.."

echo "=============================================="
echo " ワードクラウド用 ローカルWebサーバー 起動中 (Linux/Mac)"
echo "=============================================="
echo "アドレス: http://localhost:8000/"
echo "停止するには、このウィンドウで Ctrl + C を押してください。"
echo "=============================================="

# Check for Python 3
if command -v python3 &>/dev/null; then
    python3 -m http.server 8000
# Fallback to Python 2
elif command -v python &>/dev/null; then
    python -m SimpleHTTPServer 8000
# Fallback to Node.js http-server if available
elif command -v npx &>/dev/null; then
    npx http-server -p 8000
else
    echo "エラー: Python 3 がインストールされていません。"
    echo "sudo apt install python3 などを実行してインストールしてください。"
    exit 1
fi
