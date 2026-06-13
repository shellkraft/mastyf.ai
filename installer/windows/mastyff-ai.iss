; Inno Setup script — MCP Mastyff AI Windows MSI (build on Windows with Inno Setup 6)
#define MyAppName "Mastyff AI"
#define MyAppVersion "2.7.0"
#define MyAppPublisher "Mastyff AI"
#define MyAppURL "https://github.com/mastyff-ai/mastyff-ai"

[Setup]
AppId={{A8F3C2E1-9B4D-4F6A-8C1E-2D5F7A9B3C4E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=..\..\dist\installer
OutputBaseFilename=mastyff-ai-{#MyAppVersion}-win64
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "..\..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs
Source: "..\..\mastyff-ai-proxy.ps1"; DestDir: "{app}"
Source: "..\..\scripts\mastyff-ai-proxy.ps1"; DestDir: "{app}\scripts"
Source: "..\..\default-policy.yaml"; DestDir: "{app}"
Source: "postinstall-check-node.ps1"; DestDir: "{app}\installer"

[Icons]
Name: "{group}\MCP Mastyff AI Doctor"; Filename: "cmd.exe"; Parameters: "/c node ""{app}\dist\cli.js"" doctor"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\installer\postinstall-check-node.ps1"""; StatusMsg: "Checking Node.js..."; Flags: waituntilterminated

[Registry]
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; Check: NeedsAddPath('{app}')

[Code]
function NeedsAddPath(Param: string): Boolean;
var OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath) then
  begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Param + ';', ';' + OrigPath + ';') = 0;
end;
