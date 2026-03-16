# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the [Toit](https://toitlang.org/) programming language. Tree-sitter generates an incremental, error-tolerant parser from a grammar definition.

## Key Commands

**Activate the virtual environment first** (required before any `tree-sitter` commands):
```bash
source "${VENV_DIR:-/home/david/apps/tresit/.venv}/bin/activate"
```

**Generate parser from grammar:**
```bash
tree-sitter generate
```
Run this after every change to `grammar.js` or `src/scanner.c`. It regenerates `src/parser.c`, `src/grammar.json`, and `src/node-types.json`.

**Parse a single file:**
```bash
(ulimit -v 2000000; timeout 0.5s tree-sitter parse <file.toit>)
(ulimit -v 2000000; timeout 0.5s tree-sitter parse -q <file.toit>)   # quiet mode, only errors
```
Always wrap `tree-sitter parse` with `ulimit -v 2000000` and `timeout 0.5s` to guard against infinite loops in the parser.

**Run corpus tests:**
```bash
tree-sitter test                    # runs test/corpus/*.txt
tree-sitter test -f "test name"     # run a single named test
```

**Run against all Toit library files:**
```bash
./test_lib.sh    # parses /home/david/workspaceToit/toit/lib/ only
./test_all.sh    # parses all .toit files in /home/david/workspaceToit/toit/
```

**Debugging infinite loops / timeout issues:**
`bisect.py` bisects a specific `.toit` file to find the line causing parsing loops/timeouts. The scripts use `timeout 0.5s` and `ulimit -v 2000000` to catch infinite loops.

## Architecture

The parser has two components that work together:

### `grammar.js`
The context-free grammar rules defining Toit's AST structure. Key design points:
- **External tokens**: `_indent`, `_dedent`, `_newline`, `_error_sentinel`, `_continuation` — these are NOT produced by `grammar.js` but by the external scanner
- **Heavy use of `conflicts`**: Toit's syntax is highly ambiguous (e.g., `foo bar` could be a function call or two separate expressions). Many GLR conflicts are declared explicitly
- **Indented blocks**: used by `class_definition`, `function_definition`, `if_statement`, `while_statement`, `for_statement`, `block_function_call` — all use `$._indent ... $._dedent` pattern
- **`function_call` vs `block_function_call`**: `block_function_call` takes a trailing block (`:` or `::` expression)
- **Comments**: `comment` (line `//`) and `block_comment` (`/* */`) are separate rules in `extras` — tree-sitter does not handle `choice()` inside a single extras entry correctly

### `src/scanner.c`
The external (hand-written) C scanner that handles indentation-sensitive tokenization. It:
- Maintains a stack of indentation levels
- Emits `INDENT`/`DEDENT` tokens based on whitespace changes
- Handles `NEWLINE` tokens (statement-terminating vs. continuation)
- Queues multiple `DEDENT`s when indentation drops several levels at once
- Handles `CONTINUATION` for expression continuation across lines
- `src/parser.c` is auto-generated — **never edit it manually**

### `src/grammar.json` and `src/node-types.json`
Auto-generated from `grammar.js` — do not edit manually.

## Toit Language Notes

- Indentation-sensitive (like Python): blocks are defined by indentation, not braces
- `:=` declares a local variable, `::=` declares a final (const) variable
- `/` in a parameter or field declaration indicates a type annotation: `name/Type`
- `--name` is a named argument syntax, `--no-name` sets to false
- `:` starts a block (lambda), `::` is block shorthand: `list.map:: it + 1`
- `monitor` is a class-like construct with mutex semantics
- `#identifier.path` is a primitive expression
- String interpolation: `"hello $name"` or `"$(expr)"`
- `kebab-case` for identifiers (hyphens in names: `my-function`)
- `_` suffix marks private fields/methods
- `.field` in constructors for field-storing parameters

## Workflow for Grammar Changes

1. Edit `grammar.js` (and/or `src/scanner.c` for tokenization changes)
2. Run `tree-sitter generate`
3. Run `tree-sitter test` to check corpus tests
4. Test with `tree-sitter parse <test_file.toit>` for specific files
5. Run `./test_lib.sh` to check for regressions across the Toit standard library
6. Debug failures with `tree-sitter parse <failed_file.toit>` (without `-q`) for the CST

## Reference

The Toit language reference is scraped into `docs_raw/` as HTML and `.txt` files. Coding conventions are in `doc/instructions-long.md`. The design rationale is documented in `doc/design.md`.
