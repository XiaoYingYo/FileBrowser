@echo off
chcp 65001
setlocal enabledelayedexpansion
cd /d %~dp0
set "zipname=FileBrowser.zip"
bz.exe c -r -ex:"%zipname%;target;.git;*\node_modules" "%zipname%" *
:: 检查是否成功
if %errorlevel% equ 0 (
    echo 打包成功:%zipname%
)
endlocal