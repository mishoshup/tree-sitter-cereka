# Cereka LSP Server

Language Server Protocol implementation for Cereka script language.

## Features

- **Diagnostics** - Parse errors, undefined labels
- **Hover** - Keyword documentation
- **Completion** - Keywords, labels, UI elements, positions
- **Go-to Definition** - Jump to label definitions
- **Find References** - Find where labels are used
- **Document Symbols** - Outline view (labels, menus, UI blocks)

## Setup

```bash
cd lsp
pnpm install
pnpm build
```

## Usage with Editors

### Neovim (nvim-lspconfig)

```lua
local lspconfig = require('lspconfig')

lspconfig.cereka_lsp.setup({
  cmd = {'node', '/path/to/tree-sitter-cereka/lsp/dist/server.js'},
  filetypes = {'cereka'},
})
```

### VSCode

Create a VSCode extension that uses this LSP server:

```json
{
  "compilerOptions": {
    "lspServer": {
      "command": "node",
      "args": ["/path/to/tree-sitter-cereka/lsp/dist/server.js"]
    }
  }
}
```

### Emacs (eglot/lsp-mode)

```elisp
(add-to-list 'lsp-language-id-configuration '(".*\\.crka\\'" . "cereka"))
(lsp-register-client
 (make-lsp-client :new-connection (lsp-stdio-connection '("node" "/path/to/tree-sitter-cereka/lsp/dist/server.js"))
                  :activation-fn (lsp-activate-on "cereka")
                  :server-id 'cereka-lsp))
```

## Running Standalone

```bash
node dist/server.js
```

The LSP server communicates over stdin/stdout using the Language Server Protocol.
