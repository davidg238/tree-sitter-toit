# tree-sitter-toit

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the [Toit](https://toitlang.org/) programming language.

## Status

**Test results against Toit standard library (`toit/lib/`):**

| Date       | Success | Failed | Pass Rate |
|------------|---------|--------|-----------|
| 2026-03-16 | 105     | 39     | 73%       |
| 2026-03-14 | 94      | 50     | 65%       |
| 2026-03-13 | 55      | 89     | 38%       |

Corpus tests: `test/corpus/` covers imports, variables, functions, classes, control flow, expressions, literals, strings, blocks, comments, exceptions.

## What Works

- Import/export declarations
- Class, interface, mixin, monitor definitions (with extends/implements/with)
- Function definitions (params, return types, continuation-line params, constructors, operators, abstract, static)
- Variable/field declarations (`:=`, `::=`, typed fields with `/Type`, nullable `?`)
- Expressions (binary, unary, ternary, member access, subscript, slice)
- String interpolation (`$name`, `$(expr)`, format specifiers)
- Literals (numbers, chars, strings, triple strings, lists, maps, sets, byte arrays)
- Block/lambda syntax (`:` and `::` blocks with params)
- Control flow (if, while, for, try/finally, throw, return, break, continue)
- Named arguments (`--name=value`, `--no-name`)
- Block comments (`/* */`) and line comments (`//`)
- Indentation-based scoping via external scanner

## Known Issues / TODOs

### High Priority

1. **`else` / `else if` after indented blocks** — After an indented if-body, the scanner emits DEDENT then queues a NEWLINE. The grammar doesn't consume this NEWLINE before `else`, causing `else`/`else if` chains to fail. This is the single most impactful bug, affecting many files. Needs a solution that adds NEWLINE consumption between the body DEDENT and `else` without creating ambiguity with the `$._newline` in `_statement`.

2. **Multi-line ternary expressions** — Ternary `?`/`:` split across continuation lines (e.g., `reply := is-exception\n    ? [...]\n    : [...]`) are not parsed. The scanner emits CONTINUATION tokens for indented lines, but the ternary rule doesn't span across them.

3. **Multi-line constructor/function calls with named args** — Calls like `Foo\n  --name=val\n  --count=3` inside function bodies fail. The continuation-line argument handling works for `function_definition` params but not for `function_call` args in all contexts.

### Medium Priority

4. **Chained comparisons** — `0 <= x < 10` parses as nested `binary_expression` instead of `chained_comparison`. The `chained_comparison` rule exists but has lower precedence than binary comparison operators.

5. **Return type `->` on continuation line** — `-> Type:` on its own indented line after params (e.g., in `spi.toit`) isn't always handled.

6. **Variable initialized to block literal** — `replace-block := : | replacement |` (string.toit) — assigning a block literal directly to a variable.

7. **Cascade failures** — Some files have a single early error that cascades into ERROR[0,0] wrapping the entire file. Better error recovery would help.

### Low Priority / Edge Cases

8. **`is not` operator** — Used as `is-not` in binary expressions, may need specific handling.
9. **Primitive expressions in complex contexts** — `#primitive.core.xxx:` followed by complex block bodies.
10. **Empty-body classes at top level** — `class Foo:\n` without a body sometimes fails depending on what follows.

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
