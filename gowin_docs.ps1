#!/usr/bin/env pwsh
# ============================================================
# 高云半导体文档检索 - 全自动安装启动器 (PowerShell)
# 兼容: Windows PowerShell 5.1+ / PowerShell Core 7+ / Linux / macOS
# 功能: 检测/安装 Python → 创建 venv → 安装依赖 → 启动服务
# ============================================================

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $ScriptDir

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  高云半导体文档检索工具 - 自动启动" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 第一步：检测 Python
# ============================================================
$Python = $null
$IsWindows_ = ($env:OS -eq "Windows_NT") -or $IsWindows

# 优先检测 venv
$VenvPython = if ($IsWindows_) { ".venv\Scripts\python.exe" } else { ".venv/bin/python" }
if (Test-Path $VenvPython) {
    $Python = $VenvPython
    Write-Host "[*] 使用虚拟环境 Python" -ForegroundColor Green
}
else {
    # 检测系统 Python
    foreach ($cmd in @("python3", "python", "py")) {
        try {
            $ver = & $cmd --version 2>&1
            if ($LASTEXITCODE -eq 0 -and $ver -match "Python 3\.(\d+)") {
                $minor = [int]$Matches[1]
                if ($minor -ge 8) {
                    $Python = $cmd
                    Write-Host "[*] 检测到: $ver" -ForegroundColor Green
                    break
                }
            }
        } catch {}
    }

    if (-not $Python) {
        Write-Host "[!] 未找到 Python 3.8+，尝试自动安装..." -ForegroundColor Yellow

        if ($IsWindows_) {
            # 尝试 winget
            $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
            if ($hasWinget) {
                Write-Host "[*] 通过 winget 安装 Python 3.11..." -ForegroundColor Yellow
                winget install Python.Python.3.11 --accept-package-agreements --accept-source-agreements -h
                if ($LASTEXITCODE -eq 0) {
                    $env:PATH = "$env:LOCALAPPDATA\Programs\Python\Python311;$env:LOCALAPPDATA\Programs\Python\Python311\Scripts;$env:PATH"
                    $Python = "python"
                    Write-Host "[✓] Python 安装完成" -ForegroundColor Green
                }
            }

            if (-not $Python) {
                # 下载安装
                $installer = Join-Path $env:TEMP "python_installer.exe"
                $url = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
                Write-Host "[*] 下载 Python 安装包..." -ForegroundColor Yellow
                try {
                    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                    Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
                } catch {
                    Write-Host "[错误] 下载失败，请手动安装 Python: https://www.python.org/downloads/" -ForegroundColor Red
                    Read-Host "按回车退出"
                    exit 1
                }

                Write-Host "[*] 安装 Python..." -ForegroundColor Yellow
                Start-Process -FilePath $installer -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1" -Wait
                Remove-Item $installer -Force -ErrorAction SilentlyContinue
                $env:PATH = "$env:LOCALAPPDATA\Programs\Python\Python311;$env:LOCALAPPDATA\Programs\Python\Python311\Scripts;$env:PATH"
                $Python = "python"
                Write-Host "[✓] Python 安装完成" -ForegroundColor Green
            }
        }
        else {
            # Linux/macOS
            Write-Host "[错误] 请先安装 Python 3.8+:" -ForegroundColor Red
            Write-Host "  Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip"
            Write-Host "  macOS: brew install python3"
            Read-Host "按回车退出"
            exit 1
        }
    }

    # 创建 venv
    if (-not (Test-Path $VenvPython)) {
        Write-Host "[*] 创建虚拟环境..." -ForegroundColor Yellow
        & $Python -m venv .venv
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[错误] 创建虚拟环境失败" -ForegroundColor Red
            Read-Host "按回车退出"
            exit 1
        }
        Write-Host "[✓] 虚拟环境就绪" -ForegroundColor Green
    }
    $Python = $VenvPython
}

# ============================================================
# 第二步：安装/校验依赖
# ============================================================
$DepsHashFile = ".venv/.deps_hash"
$NeedInstall = $false

if (-not (Test-Path $DepsHashFile)) {
    $NeedInstall = $true
} else {
    $reqTime = (Get-Item "requirements.txt").LastWriteTime.ToString("o")
    $savedTime = Get-Content $DepsHashFile -Raw -ErrorAction SilentlyContinue
    if ($reqTime.Trim() -ne $savedTime.Trim()) {
        $NeedInstall = $true
    }
}

if ($NeedInstall) {
    Write-Host "[*] 安装/更新依赖..." -ForegroundColor Yellow
    & $Python -m pip install --upgrade pip -q 2>$null
    & $Python -m pip install -r requirements.txt -q
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] 依赖安装失败，强制重装..." -ForegroundColor Yellow
        & $Python -m pip install -r requirements.txt --force-reinstall -q
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[错误] 依赖安装失败" -ForegroundColor Red
            Read-Host "按回车退出"
            exit 1
        }
    }
    $reqTime = (Get-Item "requirements.txt").LastWriteTime.ToString("o")
    Set-Content -Path $DepsHashFile -Value $reqTime
    Write-Host "[✓] 依赖就绪" -ForegroundColor Green
} else {
    Write-Host "[✓] 依赖已是最新" -ForegroundColor Green
}

# ============================================================
# 第三步：启动服务
# ============================================================
Write-Host ""
& $Python run.py

Pop-Location
