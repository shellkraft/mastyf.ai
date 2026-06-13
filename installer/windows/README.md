# Windows MSI installer

Build a per-user MSI with [Inno Setup 6](https://jrsoftware.org/isinfo.php) on Windows.

## Prerequisites

1. `pnpm build` at repo root (produces `dist/`).
2. Inno Setup 6 installed.
3. Node.js 18+ on the build machine (runtime check only).

## Build

```powershell
cd installer\windows
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" mastyff-ai.iss
```

Output: `dist/installer/mastyff-ai-2.7.0-win64.exe` (setup) — rename to `.msi` if you wrap with WiX, or distribute the Inno installer as-is.

## Installed layout

- `{app}\dist\` — compiled MastyffAi
- `{app}\mastyff-ai-proxy.ps1` — IDE wrap launcher
- `{app}\default-policy.yaml`
- HKCU `Path` append for `{app}` (per-user)

## Post-install

```powershell
node "$env:LOCALAPPDATA\Programs\MCP MastyffAi\dist\cli.js" doctor
mastyff-ai wrap --client cursor --policy default-policy.yaml --apply
```

Signing: use your org code-signing cert with `signtool` on the generated setup executable before distribution.
