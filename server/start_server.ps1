# Windows標準のPowerShellを使用した超軽量ローカルWebサーバー
# インストール不要・管理者権限不要で動作します。

$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    Write-Error "ポート $port の起動に失敗しました。すでに別のサーバーが起動している可能性があります。"
    Read-Host "Enterキーを押して終了してください..."
    exit
}

Write-Host "============================================="
Write-Host "  ワードクラウド用 ローカルWebサーバー 起動中"
Write-Host "============================================="
Write-Host "アドレス: http://localhost:$port/"
Write-Host "停止するには、このウィンドウで Ctrl + C を押すか閉じてください。"
Write-Host "============================================="

# 既定のブラウザで自動的にアプリを開く
Start-Process "http://localhost:$port/"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        
        # リクエストパスの解析
        $urlPath = $req.Url.LocalPath
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }
        
        # Windowsのパス形式に変換してローカルファイルを探す
        $relativePath = $urlPath.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
        # 先頭の円記号を除去してカレントディレクトリと結合
        if ($relativePath.StartsWith([System.IO.Path]::DirectorySeparatorChar)) {
            $relativePath = $relativePath.Substring(1)
        }
        $localPath = Join-Path (Get-Location) $relativePath

        if (Test-Path $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            
            # 拡張子に応じた適切なMIMEタイプの設定（辞書ファイルの二重展開を防ぐ）
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $contentType = "application/octet-stream"
            
            if ($ext -eq ".html" -or $ext -eq ".htm") {
                $contentType = "text/html; charset=utf-8"
            } elseif ($ext -eq ".css") {
                $contentType = "text/css; charset=utf-8"
            } elseif ($ext -eq ".js") {
                $contentType = "application/javascript; charset=utf-8"
            } elseif ($ext -eq ".txt") {
                $contentType = "text/plain; charset=utf-8"
            } elseif ($ext -eq ".ttf") {
                $contentType = "font/ttf"
            } elseif ($ext -eq ".gzip") {
                # kuromoji辞書用：Content-Encodingを設定せず転送
                $contentType = "application/x-gzip"
            }
            
            $res.ContentType = $contentType
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $errorBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $res.OutputStream.Write($errorBytes, 0, $errorBytes.Length)
        }
        $res.Close()
    } catch {
        # クライアント（ブラウザ）が途中で接続を切った場合などの例外をキャッチして続行
    }
}
