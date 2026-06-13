# Nix shell fallback for users without flakes enabled
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "mastyff-ai";

  buildInputs = with pkgs; [
    nodejs_20
    nodePackages.pnpm # use pnpm directly instead of corepack

    # Native build toolchain (required for better-sqlite3)
    python3
    gnumake
    gcc

    # Go (for apps/proxy-core)
    go

    # Python for adversarial harness
    (python3.withPackages (ps: with ps; [ pyyaml ]))

    # Optional: local services
    redis
    postgresql

    # Utilities
    curl
    jq
    git
  ];

  shellHook = ''
    echo "MCP Mastyff AI Dev Environment"
    echo "─────────────────────────────────────"
    echo "  Node.js: $(node --version)"
    echo "  pnpm:    $(pnpm --version)"
    echo "  Go:      $(go version)"
    echo "  Python:  $(python3 --version)"
    echo "─────────────────────────────────────"
    echo ""
    echo "Run: pnpm install && pnpm build"
    echo ""
    export PATH="$PWD/node_modules/.bin:$PATH"
  '';

  NODE_OPTIONS = "--max-old-space-size=4096";
}
