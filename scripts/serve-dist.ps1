# Serve prebuilt Press (dist/) on 127.0.0.1 — no Node.
# Used by START.cmd / release ZIP. Leave this window open.
param(
  [int]$Port = 5177,
  [string]$DistDir = ""
)

$ErrorActionPreference = "Stop"
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$root = Split-Path -Parent $here
if (-not $DistDir) { $DistDir = Join-Path $root "dist" }
$DistDir = [System.IO.Path]::GetFullPath($DistDir)

if (-not (Test-Path (Join-Path $DistDir "index.html"))) {
  Write-Host ""
  Write-Host "No built Press found at: $DistDir"
  Write-Host "Download a Press release ZIP (not the source ZIP), or run: npm run build"
  Write-Host ""
  exit 1
}

$mimes = @{
  ".html"         = "text/html; charset=utf-8"
  ".js"           = "text/javascript; charset=utf-8"
  ".css"          = "text/css; charset=utf-8"
  ".json"         = "application/json; charset=utf-8"
  ".svg"          = "image/svg+xml"
  ".png"          = "image/png"
  ".jpg"          = "image/jpeg"
  ".jpeg"         = "image/jpeg"
  ".webp"         = "image/webp"
  ".ico"          = "image/x-icon"
  ".webmanifest"  = "application/manifest+json"
  ".txt"          = "text/plain; charset=utf-8"
  ".woff"         = "font/woff"
  ".woff2"        = "font/woff2"
  ".map"          = "application/json"
}

$prefix = "http://127.0.0.1:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not bind $prefix — is something else on port $Port?"
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host ""
Write-Host "Heart's Archive Press"
Write-Host "  $prefix"
Write-Host "  Serving: $DistDir"
Write-Host "  Leave this window open. Close it to stop."
Write-Host ""

Start-Process $prefix

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $rel = $rel -replace "/", [System.IO.Path]::DirectorySeparatorChar
    $full = [System.IO.Path]::GetFullPath((Join-Path $DistDir $rel))
    if (-not $full.StartsWith($DistDir, [System.StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $res.Close()
      continue
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
      continue
    }
    $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
    $res.ContentType = if ($mimes.ContainsKey($ext)) { $mimes[$ext] } else { "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($full)
    $res.ContentLength64 = $bytes.LongLength
    $res.Headers.Add("Cache-Control", "no-cache")
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
  } catch {
    try {
      $res.StatusCode = 500
      $res.Close()
    } catch { }
  }
}
