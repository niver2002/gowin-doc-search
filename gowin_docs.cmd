@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Gowin Doc Search

pushd "%~dp0"

echo ==================================================
echo   Gowin Document Search - Auto Launcher
echo ==================================================
echo.

set "PYTHON="
set "REAL_PYTHON="

REM --- Check existing valid venv ---
if exist ".venv\pyvenv.cfg" (
    if exist ".venv\Scripts\python.exe" (
        set "PYTHON=.venv\Scripts\python.exe"
        echo [OK] Using existing virtual environment
        goto :check_deps
    )
)

REM --- Remove broken venv if exists ---
if exist ".venv" (
    echo [..] Removing broken venv...
    rmdir /s /q .venv 2>nul
)

REM --- Find real Python (not from another venv) ---
REM Priority: py launcher > known install paths > python command

REM Try py -3 launcher first (always points to real Python)
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 --version >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=2 delims= " %%v in ('py -3 --version 2^>^&1') do set "PYVER=%%v"
        echo [OK] Found Python !PYVER! via py launcher
        set "REAL_PYTHON=py -3"
        goto :make_venv
    )
)

REM Try known install locations
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "%ProgramFiles%\Python311\python.exe"
    "%ProgramFiles%\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python312\python.exe"
) do (
    if exist %%P (
        for /f "tokens=2 delims= " %%v in ('%%P --version 2^>^&1') do set "PYVER=%%v"
        echo [OK] Found Python !PYVER! at %%P
        set "REAL_PYTHON=%%P"
        goto :make_venv
    )
)

REM Last resort: python command, but verify it's not inside a venv
where python >nul 2>&1
if %errorlevel% equ 0 (
    python --version >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=*" %%p in ('python -c "import sys; print(sys.prefix == sys.base_prefix)"') do set "IS_REAL=%%p"
        if "!IS_REAL!"=="True" (
            for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set "PYVER=%%v"
            echo [OK] Found Python !PYVER!
            set "REAL_PYTHON=python"
            goto :make_venv
        ) else (
            REM python is inside another venv, find real base
            for /f "tokens=*" %%p in ('python -c "import sys; print(sys.base_prefix)"') do set "BASE_PREFIX=%%p"
            if exist "!BASE_PREFIX!\python.exe" (
                for /f "tokens=2 delims= " %%v in ('"!BASE_PREFIX!\python.exe" --version 2^>^&1') do set "PYVER=%%v"
                echo [OK] Found base Python !PYVER! at !BASE_PREFIX!
                set "REAL_PYTHON=!BASE_PREFIX!\python.exe"
                goto :make_venv
            )
        )
    )
)

echo [ERROR] Python 3.8+ not found.
echo Please install from: https://www.python.org/downloads/
echo Make sure to check "Add Python to PATH"
goto :fail

:make_venv
echo [..] Creating virtual environment...
%REAL_PYTHON% -m venv .venv
if %errorlevel% neq 0 (
    echo [!!] venv creation failed, trying without pip...
    %REAL_PYTHON% -m venv --without-pip .venv
)

REM Validate venv
if not exist ".venv\pyvenv.cfg" (
    echo [!!] venv invalid, using Python directly without venv
    set "PYTHON=%REAL_PYTHON%"
    goto :check_deps
)
if not exist ".venv\Scripts\python.exe" (
    echo [!!] venv incomplete, using Python directly
    set "PYTHON=%REAL_PYTHON%"
    goto :check_deps
)

set "PYTHON=.venv\Scripts\python.exe"
echo [OK] Virtual environment ready

:check_deps
REM --- Install/verify dependencies ---
set "DEPS_HASH_FILE=.venv\.deps_hash"
if not exist ".venv" mkdir .venv
set "NEED_INSTALL=0"

if not exist "%DEPS_HASH_FILE%" (
    set "NEED_INSTALL=1"
) else (
    for %%F in (requirements.txt) do set "REQ_DATE=%%~tF"
    set /p SAVED_DATE=<"%DEPS_HASH_FILE%"
    if "!REQ_DATE!" neq "!SAVED_DATE!" set "NEED_INSTALL=1"
)

if "!NEED_INSTALL!"=="1" (
    echo [..] Installing dependencies...
    "%PYTHON%" -m pip install --upgrade pip -q 2>nul
    "%PYTHON%" -m pip install -r requirements.txt -q
    if !errorlevel! neq 0 (
        echo [!!] Retrying with force-reinstall...
        "%PYTHON%" -m pip install -r requirements.txt --force-reinstall -q
        if !errorlevel! neq 0 (
            echo [ERROR] Dependency installation failed
            goto :fail
        )
    )
    for %%F in (requirements.txt) do echo %%~tF>"%DEPS_HASH_FILE%"
    echo [OK] Dependencies ready
) else (
    echo [OK] Dependencies up to date
)

REM --- Launch ---
echo.
echo [..] Starting service...
echo.
"%PYTHON%" run.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Exited with code %errorlevel%
)
goto :done

:fail
echo.
echo [ERROR] Setup failed. See messages above.

:done
echo.
pause
popd
endlocal
