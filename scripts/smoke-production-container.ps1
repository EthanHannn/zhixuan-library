$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$smokeRoot = Join-Path $tempRoot ("zhixuan-library-smoke-" + [guid]::NewGuid().ToString("N"))
$containerName = "zhixuan-library-smoke-" + [guid]::NewGuid().ToString("N").Substring(0, 8)

New-Item -ItemType Directory -Path $smokeRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $smokeRoot "novels"), (Join-Path $smokeRoot "covers") | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot "prisma/dev.db") -Destination (Join-Path $smokeRoot "library.db")

try {
  $databasePath = (Resolve-Path (Join-Path $smokeRoot "library.db")).Path
  $novelPath = (Resolve-Path (Join-Path $smokeRoot "novels")).Path
  $coverPath = (Resolve-Path (Join-Path $smokeRoot "covers")).Path

  & docker run --detach --name $containerName `
    --publish "127.0.0.1:16870:3000" `
    --mount "type=bind,source=$databasePath,target=/app/data/library.db" `
    --mount "type=bind,source=$novelPath,target=/data/novels,readonly" `
    --mount "type=bind,source=$coverPath,target=/app/public/covers,readonly" `
    --env "DATABASE_URL=file:/app/data/library.db" `
    --env "NOVEL_ROOT=/data/novels" `
    --env "MIN_BOOK_SCORE=7.5" `
    --env "NEXTAUTH_URL=http://127.0.0.1:16870" `
    --env "NEXTAUTH_SECRET=container-smoke-secret-at-least-32-bytes" `
    zhixuan-library:latest | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "容器启动失败"
  }

  $health = $null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:16870/api/health" -TimeoutSec 2
      if ($health.status -eq "ok") { break }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if ($health.status -ne "ok") {
    & docker logs $containerName
    throw "健康检查超时"
  }

  $webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $login = Invoke-WebRequest -Uri "http://127.0.0.1:16870/login" -WebSession $webSession -SkipHttpErrorCheck
  $homeStatus = [int](& curl.exe --silent --output NUL --write-out "%{http_code}" "http://127.0.0.1:16870/")
  $apiStatus = [int](& curl.exe --silent --output NUL --write-out "%{http_code}" "http://127.0.0.1:16870/api/books")
  $csrf = Invoke-RestMethod -Uri "http://127.0.0.1:16870/api/auth/csrf" -WebSession $webSession
  $authBody = @{
    csrfToken = $csrf.csrfToken
    username = "codingCat"
    password = "Think24"
    callbackUrl = "http://127.0.0.1:16870/"
    json = "true"
  }
  Invoke-WebRequest `
    -Uri "http://127.0.0.1:16870/api/auth/callback/credentials" `
    -Method Post `
    -Body $authBody `
    -WebSession $webSession `
    -MaximumRedirection 0 `
    -SkipHttpErrorCheck | Out-Null

  $session = Invoke-RestMethod -Uri "http://127.0.0.1:16870/api/auth/session" -WebSession $webSession
  $categories = Invoke-RestMethod -Uri "http://127.0.0.1:16870/api/categories" -WebSession $webSession

  if ($login.StatusCode -ne 200) { throw "登录页状态异常" }
  if ($homeStatus -lt 300 -or $homeStatus -ge 400) { throw "匿名首页没有跳转" }
  if ($apiStatus -ne 401) { throw "匿名 API 没有返回 401" }
  if ($session.user.username -ne "codingCat" -or $session.user.role -ne "ADMIN") { throw "管理员会话异常" }
  if ($categories.stats.minScore -ne 7.5) { throw "评分阈值异常" }

  [pscustomobject]@{
    Health = $health.status
    Login = $login.StatusCode
    AnonymousHome = $homeStatus
    AnonymousApi = $apiStatus
    AuthenticatedUser = $session.user.username
    Role = $session.user.role
    MinScore = $categories.stats.minScore
    VisibleBooks = $categories.stats.books
  } | Format-List
} finally {
  $existingContainer = & docker ps -a --filter "name=^/$containerName$" --format "{{.Names}}"
  if ($existingContainer -eq $containerName) {
    & docker rm --force $containerName | Out-Null
  }

  $resolvedSmokeRoot = [IO.Path]::GetFullPath($smokeRoot)
  if ($resolvedSmokeRoot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path -Leaf $resolvedSmokeRoot).StartsWith("zhixuan-library-smoke-")) {
    Remove-Item -LiteralPath $resolvedSmokeRoot -Recurse -Force
  }
}
