@echo off
title Rematricula Testes
color 0A
cls

echo ========================================
echo      REMATRICULA - PORTAL GESTAO
echo ========================================
echo.
echo Iniciando servidor local...
echo.

REM Define a porta
set PORT=3000
set HOST=localhost

REM Verifica se a porta já está em uso
netstat -ano | findstr ":%PORT%" >nul
if %ERRORLEVEL% EQU 0 (
    echo AVISO: A porta %PORT% ja esta em uso.
    echo Tentando porta alternativa...
    set PORT=3001
)

echo Servidor iniciara em: http://localhost:%PORT%
echo.
echo Aguarde... O navegador abrira automaticamente.
echo Para FECHAR a aplicacao, feche esta janela.
echo.

REM Aguarda 2 segundos e abre o navegador
timeout /t 2 >nul
start http://localhost:%PORT%

REM Inicia o servidor com Node portátil
"%~dp0node-portable\node.exe" "%~dp0.output\server\index.mjs"

REM Se o servidor parar, mostra mensagem
echo.
echo Servidor encerrado.
pause