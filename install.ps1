#Requires -Version 5.1
<#
.SYNOPSIS
  将 typst-note-highlight 安装到 Cursor / VS Code 扩展目录。
#>
param(
  [ValidateSet("Cursor", "VSCode", "Both")]
  [string]$Target = "Both"
)

$ErrorActionPreference = "Stop"
$src = $PSScriptRoot
Push-Location $src
try {
  npm run compile
  if ($LASTEXITCODE -ne 0) {
    throw "npm run compile 失败"
  }
} finally {
  Pop-Location
}
$pkg = Get-Content (Join-Path $src "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$folderName = "{0}.{1}-{2}" -f $pkg.publisher, $pkg.name, $pkg.version

$destRoots = @()
if ($Target -eq "Cursor" -or $Target -eq "Both") {
  $destRoots += (Join-Path $env:USERPROFILE ".cursor\extensions")
}
if ($Target -eq "VSCode" -or $Target -eq "Both") {
  $destRoots += (Join-Path $env:USERPROFILE ".vscode\extensions")
}

foreach ($root in $destRoots) {
  if (-not (Test-Path $root)) {
    Write-Warning "跳过不存在的目录: $root"
    continue
  }

  Get-ChildItem -Path $root -Directory -Filter "$($pkg.publisher).$($pkg.name)-*" -ErrorAction SilentlyContinue |
    ForEach-Object {
      Write-Host "移除旧版本: $($_.FullName)"
      Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }

  # 兼容旧扩展 id
  Get-ChildItem -Path $root -Directory -Filter "$($pkg.publisher).typst-note-highlight-*" -ErrorAction SilentlyContinue |
    ForEach-Object {
      Write-Host "移除旧扩展: $($_.FullName)"
      Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }

  $dest = Join-Path $root $folderName
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  foreach ($name in @("package.json", "README.md", "CHANGELOG.md", "LICENSE")) {
    $from = Join-Path $src $name
    if (Test-Path -LiteralPath $from) {
      Copy-Item -Path $from -Destination $dest -Force
    }
  }
  Copy-Item -Path (Join-Path $src "syntaxes") -Destination $dest -Recurse -Force
  $outDir = Join-Path $src "out"
  if (-not (Test-Path -LiteralPath $outDir)) {
    throw "未找到 out/。请先在仓库根目录执行 npm run compile。"
  }
  Copy-Item -Path $outDir -Destination $dest -Recurse -Force
  Write-Host "已安装: $dest"
}

Write-Host ""
Write-Host "请在 Cursor / VS Code 中执行: Developer: Reload Window"
