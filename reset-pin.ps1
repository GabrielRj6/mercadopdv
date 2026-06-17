# ============================================
# MercadoPDV - Reset PIN Administrador
# ============================================
# SHA-256 de "1234" = 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4

$hash1234 = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  MercadoPDV - Reset PIN para 1234" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Procura o banco em TODOS os usuarios
Write-Host "Procurando banco de dados..." -ForegroundColor Yellow
$bancos = Get-ChildItem -Path "C:\Users" -Recurse -Filter "mercadopdv.db" -ErrorAction SilentlyContinue

if ($bancos.Count -eq 0) {
    Write-Host "Nenhum banco encontrado! Abra o MercadoPDV uma vez e rode este script novamente." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "Bancos encontrados:" -ForegroundColor Green
$bancos | ForEach-Object { Write-Host "  -> $($_.FullName)" }
Write-Host ""

# Baixa sqlite3 se precisar
$sqlitePath = "$env:TEMP\sqlite3.exe"
if (-not (Test-Path $sqlitePath)) {
    Write-Host "Baixando ferramenta sqlite3..." -ForegroundColor Yellow
    try {
        $url = "https://www.sqlite.org/2024/sqlite-tools-win-x64-3460000.zip"
        Invoke-WebRequest -Uri $url -OutFile "$env:TEMP\sqlite.zip" -UseBasicParsing
        Expand-Archive -Path "$env:TEMP\sqlite.zip" -DestinationPath "$env:TEMP\sqlitetools" -Force
        $exe = Get-ChildItem "$env:TEMP\sqlitetools" -Filter "sqlite3.exe" -Recurse | Select-Object -First 1
        Copy-Item $exe.FullName $sqlitePath -Force
        Write-Host "OK." -ForegroundColor Green
    } catch {
        Write-Host "ERRO ao baixar sqlite3. Verifique a conexao com internet." -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
}

# Atualiza o PIN em cada banco encontrado
foreach ($banco in $bancos) {
    Write-Host "Resetando PIN em: $($banco.FullName)" -ForegroundColor Yellow
    & $sqlitePath $banco.FullName "UPDATE operadores SET pin_hash = '$hash1234' WHERE id = 1;"
    $resultado = & $sqlitePath $banco.FullName "SELECT nome FROM operadores WHERE id = 1;"
    if ($resultado) {
        Write-Host "  OK! Operador: $resultado" -ForegroundColor Green
    } else {
        Write-Host "  AVISO: Operador id=1 nao encontrado neste banco." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  PRONTO! PIN resetado para: 1234" -ForegroundColor Green
Write-Host "  Abra o MercadoPDV e use o PIN 1234" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Read-Host "Pressione Enter para sair"
