# Post-install: verify Node.js 18+ is on PATH
$min = [version]"18.0.0"
try {
  $v = (node -v) -replace '^v',''
  $ver = [version]$v
  if ($ver -lt $min) {
    Write-Warning "Node.js $v found; MCP Mastyff AI requires >= 18. Install from https://nodejs.org/"
    exit 1
  }
  Write-Host "Node.js $v OK"
  exit 0
} catch {
  Write-Warning "Node.js not found on PATH. Install Node 18+ then run: node `"$PSScriptRoot\..\dist\cli.js`" doctor"
  exit 1
}
