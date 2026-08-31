param(
  [switch]$SkipNovels,
  [switch]$SkipImage
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$deployDir = Join-Path $projectRoot "deploy"
$manifestPath = Join-Path $projectRoot "exports/novels-score-7.5-plus-files.txt"
$databasePath = Join-Path $projectRoot "prisma/dev.db"
$coversPath = Join-Path $projectRoot "public/covers"
$localEnvPath = Join-Path $projectRoot ".env"
$productionEnvPath = Join-Path $deployDir ".env.production"

function Read-DotEnvValue([string]$Path, [string]$Name) {
  $prefix = "$Name="
  $line = Get-Content -LiteralPath $Path | Where-Object { $_.TrimStart().StartsWith($prefix) } | Select-Object -First 1
  if (-not $line) {
    throw "缺少环境变量 $Name"
  }
  return $line.Substring($line.IndexOf("=") + 1).Trim().Trim('"').Trim("'")
}

function Assert-LastExitCode([string]$Action) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Action 失败，退出码 $LASTEXITCODE"
  }
}

New-Item -ItemType Directory -Path $deployDir -Force | Out-Null

if (-not (Test-Path -LiteralPath $productionEnvPath)) {
  $secretBytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)
  $authSecret = [Convert]::ToBase64String($secretBytes)
  $productionEnv = @"
DATABASE_URL=file:/app/data/library.db
NOVEL_ROOT=/data/novels
MIN_BOOK_SCORE=7.5
NEXTAUTH_URL=https://library.aivideoart.cn
NEXTAUTH_SECRET=$authSecret
OWNER_USERNAME=codingCat
OWNER_PASSWORD=Think24
OWNER_NICKNAME=老板
"@
  [IO.File]::WriteAllText($productionEnvPath, $productionEnv, [Text.UTF8Encoding]::new($false))
}

Copy-Item -LiteralPath $databasePath -Destination (Join-Path $deployDir "zhixuan-library.db") -Force

$coversArchive = Join-Path $deployDir "zhixuan-covers.tar.gz"
if (Test-Path -LiteralPath $coversArchive) {
  Remove-Item -LiteralPath $coversArchive -Force
}
& tar -C $coversPath -czf $coversArchive .
Assert-LastExitCode "封面打包"

if (-not $SkipNovels) {
  $novelRoot = [IO.Path]::GetFullPath((Read-DotEnvValue $localEnvPath "NOVEL_ROOT"))
  $rootPrefix = $novelRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  $relativeFiles = Get-Content -LiteralPath $manifestPath
  if ($relativeFiles.Count -ne 3077) {
    throw "高分正文清单数量异常：期望 3077，实际 $($relativeFiles.Count)"
  }

  foreach ($relativeFile in $relativeFiles) {
    $fullPath = [IO.Path]::GetFullPath((Join-Path $novelRoot $relativeFile))
    if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      throw "正文路径越出 NOVEL_ROOT"
    }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
      throw "正文清单存在缺失文件"
    }
  }

  $novelsArchive = Join-Path $deployDir "zhixuan-novels-score-7.5-plus.tar.gz"
  if (Test-Path -LiteralPath $novelsArchive) {
    Remove-Item -LiteralPath $novelsArchive -Force
  }
  & docker run --rm `
    --mount "type=bind,source=$novelRoot,target=/novels,readonly" `
    --mount "type=bind,source=$manifestPath,target=/manifest/files.txt,readonly" `
    --mount "type=bind,source=$deployDir,target=/out" `
    node:20-alpine `
    sh -c "tar -C /novels -czf /out/zhixuan-novels-score-7.5-plus.tar.gz -T /manifest/files.txt"
  Assert-LastExitCode "高分正文打包"
}

if (-not $SkipImage) {
  & docker image inspect zhixuan-library:latest *> $null
  Assert-LastExitCode "检查 Docker 镜像"
  $imageArchive = Join-Path $deployDir "zhixuan-library-image.tar"
  if (Test-Path -LiteralPath $imageArchive) {
    Remove-Item -LiteralPath $imageArchive -Force
  }
  & docker save --output $imageArchive zhixuan-library:latest
  Assert-LastExitCode "导出 Docker 镜像"
}

$artifactNames = @(
  "zhixuan-library.db",
  "zhixuan-covers.tar.gz",
  "zhixuan-novels-score-7.5-plus.tar.gz",
  "zhixuan-library-image.tar"
)
$hashLines = foreach ($artifactName in $artifactNames) {
  $artifactPath = Join-Path $deployDir $artifactName
  if (Test-Path -LiteralPath $artifactPath) {
    $hash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $artifactName"
  }
}
[IO.File]::WriteAllLines((Join-Path $deployDir "zhixuan-artifacts.sha256"), $hashLines, [Text.UTF8Encoding]::new($false))

Get-ChildItem -LiteralPath $deployDir -File |
  Where-Object { $_.Name -in ($artifactNames + @("zhixuan-artifacts.sha256")) } |
  Select-Object Name, Length
