param([string]$Image = "zhixuan-library:latest")
$ErrorActionPreference = "Stop"
$env:AUTH_TEST_IMAGE = $Image
try { node (Join-Path $PSScriptRoot "smoke-auth.js"); if ($LASTEXITCODE -ne 0) { throw "容器认证验证失败" } }
finally { Remove-Item Env:AUTH_TEST_IMAGE -ErrorAction SilentlyContinue }
