# MCP Mastyff AI stdio proxy launcher (Windows native).
# Equivalent to scripts/mastyff-ai-proxy.sh — use from repo root.
$ErrorActionPreference = 'Stop'

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ProxyArgs
)

try {
    $Root = $PSScriptRoot
    $cliPath = Join-Path $Root 'dist\cli.js'

    if (-not (Test-Path -LiteralPath $cliPath)) {
        throw "Mastyff AI CLI not built: missing $cliPath (run pnpm build)"
    }

    if (-not $env:MASTYFF_AI_DB_PATH) {
        $env:MASTYFF_AI_DB_PATH = Join-Path $env:USERPROFILE '.mastyff-ai\history.db'
    }
    if (-not $env:DASHBOARD_ENABLED) { $env:DASHBOARD_ENABLED = 'true' }
    if (-not $env:METRICS_ENABLED) { $env:METRICS_ENABLED = 'true' }
    if (-not $env:METRICS_PORT) { $env:METRICS_PORT = '9090' }
    if (-not $env:DASHBOARD_PORT) { $env:DASHBOARD_PORT = '4000' }

    $nodeExe = (Get-Command node -ErrorAction Stop).Source
    $argList = @($cliPath, 'proxy') + @($ProxyArgs)
    & $nodeExe @argList
    exit $LASTEXITCODE
}
catch {
    Write-Error "Failed to launch Mastyff AI proxy: $_"
    exit 1
}
