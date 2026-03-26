# tree-sitter-toit

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the [Toit](https://toitlang.org/) programming language.

## Status

**Test results against Toit standard library (`toit/lib/`):**

| Date       | Success | Failed | Pass Rate |
|------------|---------|--------|-----------|
| 2026-03-26 | 133     | 11     | 92.4%     |
| 2026-03-16 | 105     | 39     | 73%       |
| 2026-03-14 | 94      | 50     | 65%       |
| 2026-03-13 | 55      | 89     | 38%       |

Corpus tests: `test/corpus/` covers imports, variables, functions, classes, control flow, expressions, literals, strings, blocks, comments, exceptions.

## What Works

- Import/export declarations
- Class, interface, mixin, monitor definitions (with extends/implements/with, including continuation lines)
- Function definitions (params, return types, continuation-line params, constructors, operators, abstract, static)
- Variable/field declarations (`:=`, `::=`, typed fields with `/Type`, nullable `?`)
- Expressions (binary, unary, ternary, member access, subscript, slice)
- String interpolation (`$name`, `$(expr)`, format specifiers)
- Literals (numbers, chars, strings, triple strings, lists, maps, sets, byte arrays, empty set `{}`)
- Block/lambda syntax (`:` and `::` blocks with params, chained blocks `a: b: expr`)
- Control flow (if/else/else-if, while, for, try/finally, throw, return, break, continue)
- Named arguments (`--name=value`, `--no-name`), postfix `++`/`--` as function args
- Block comments (`/* */`) and line comments (`//`)
- Indentation-based scoping via external scanner
- Operator-first continuation lines (`x\n    + y`)
- Backslash line continuation (`\`)
- Assignment in return statements (`return x = expr`)

## Known Issues / Remaining TODOs

### Hard

1. **GLR explosion: 3+ consecutive multi-line function calls** — Two consecutive function calls with continuation-line named args parse fine, but three triggers combinatorial state explosion. Each call's `$._indent ... $._dedent` continuation creates ambiguity with the outer block's `repeat1($._statement)`. Affects 5 files (buffer.toit, bytes.toit, hex.toit, ethernet.toit, remote.toit).

2. **Character arithmetic + block call** — `ByteArray '~' - '-' + 1:` — function args that are binary expressions with char literals are ambiguous with multi-arg calls. Affects url.toit.

### Medium

3. **Nested block params in named args** — `--if-error=: expr` or `primitive: | bytes | expr` — blocks as named arg values with deep nesting. Affects 3 files (numbers.toit, rpc.toit, adler32.toit).

4. **`not` + block_function_call** — `return not list.any: it != 0` — `not` applies to `$._expression`, but `block_function_call` is not part of `$._expression`. Adding it causes GLR regressions elsewhere. Affects uuid.toit.

5. **`:=` tokenization in nested blocks** — `:` consumed as block start instead of part of `:=` in certain contexts. Affects dns.toit.

## Architecture

- `grammar.js` — Context-free grammar rules (AST structure)
- `src/scanner.c` — External scanner for indentation handling (INDENT/DEDENT/NEWLINE/CONTINUATION tokens)
- `src/parser.c` — Auto-generated, never edit manually
- `test/corpus/` — Tree-sitter test cases
- `doc/design.md` — Design decisions and language references
- `doc/instructions-long.md` — Toit coding conventions reference

## Usage

```bash
# Activate venv (provides tree-sitter CLI)
source "${VENV_DIR:-/home/david/apps/tresit/.venv}/bin/activate"

# Generate parser after grammar changes
tree-sitter generate

# Run corpus tests
tree-sitter test

# Parse a file
(ulimit -v 2000000; timeout 0.5s tree-sitter parse file.toit)

# Run against Toit standard library
./test_lib.sh
```

## License

MIT
