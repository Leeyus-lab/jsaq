@echo off
REM ============================================================
REM  江苏省大学新生安全知识教育 · 一键完成工具  —— 构建脚本
REM  用法：双击本文件，或在 jsaq 目录下执行 build.bat
REM  需要：本机已安装 Python 3.10+ （已装可跳过 venv 创建）
REM ============================================================
setlocal
cd /d "%~dp0"

REM 1) 创建/使用虚拟环境（可选，避免污染全局）
if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
)
set PY=.venv\Scripts\python.exe
if not exist "%PY%" set PY=python

REM 2) 安装依赖
%PY% -m pip install --quiet --upgrade pip
%PY% -m pip install --quiet requests pyinstaller

REM 3) 打包为单文件 exe（答案库 database.db 一并内置）
%PY% -m PyInstaller --onefile --console --name jsaq --add-data "database.db;." --clean jsaq.py

echo.
echo 构建完成！exe 位于 dist\jsaq.exe
pause
endlocal
