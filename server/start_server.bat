@echo off
rem カレントディレクトリをプロジェクトのルート（一つ上の階層）に変更
cd /d %~dp0..

echo ==============================================
echo  ワードクラウド用 Webサーバーを起動しています...
echo ==============================================

rem PowerShellスクリプトを実行（ポリシーを一時的にバイパス）
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_server.ps1"

echo.
echo サーバーが停止しました。
pause
