# Toit Tree-Sitter Parser Design Document

## References and Documentation Links
* [Toit Language syntax](https://docs.toit.io/language)
* [Toit Language typeconversion](https://docs.toit.io/language/typeconversion)
* [Toit Language definitions](https://docs.toit.io/language/definitions)
* [Toit Language style](https://docs.toit.io/language/style)
* [Toit Language Syntax](https://docs.toit.io/language/syntax)
* [Toit Language imports](https://docs.toit.io/language/imports)
* [Toit Language objects-constructors-inheritance-interfaces](https://docs.toit.io/language/objects-constructors-inheritance-interfaces)
* [Toit Strings](https://docs.toit.io/language/strings)
* [Toit Language blocks-and-lambdas](https://docs.toit.io/language/blocks-and-lambdas)
* [Toit Language listsetmap](https://docs.toit.io/language/listsetmap)
* [Toit Language loops](https://docs.toit.io/language/loops)
* [Toit Booleans](https://docs.toit.io/language/booleans)
* [Toit Language math](https://docs.toit.io/language/math)
* [Toit Language bitmask](https://docs.toit.io/language/bitmask)
* [Toit Language tasks](https://docs.toit.io/language/tasks)
* [Toit Exceptions](https://docs.toit.io/language/exceptions)

## Toit Language Quick Reference

The file `doc/instructions-long.md` contains a comprehensive Toit coding conventions guide, useful as a reference for parser development. Key syntax points relevant to grammar design:

* **Naming**: `kebab-case` for variables/functions, `PascalCase` for classes, `KEBAB-CASE` for constants
* **Variable/field declaration**: `:=` mutable, `::=` immutable, `/` suffix for type annotations, `_` suffix for private
* **Constructor fields**: `.field` syntax initializes fields directly, `this.field_ = param` for explicit assignment
* **Named parameters**: `--name` at call and declaration sites, `--no-name` for false
* **Blocks**: `:` starts a block (lambda), `::` for shorthand, `[block]` for block parameters
* **Types**: `/` suffix (e.g., `name/string`), `?` for nullable (e.g., `int?`), `->` for return types
* **Literals**: `{:}` empty map, `{}` empty set, `#[]` empty byte array, trailing commas in multi-line
* **Loops**: `x.repeat:`, `collection.do:`, `continue.do` / `continue.repeat` for next iteration
* **Exceptions**: `throw` (usually strings), `catch:` with block, `try:/finally:` (no `try/catch` blocks)
* **String interpolation**: `$name` or `$(expr)` with optional format specifiers like `$(%04d value)`

## Architecture Decisions

### Custom Scanner vs. grammar.js
Tree-sitter uses `grammar.js` for the core, context-free parsing rules. However, many languages, including Toit, rely significantly on indentation to define structure (blocks, scopes, etc.), which requires context-sensitive parsing.

**grammar.js Responsibilities:**
* Defining the keywords and syntactical structure.
* Creating the Abstract Syntax Tree (AST) nodes for expressions, declarations, statements, etc.
* It operates strictly on the token stream provided by the lexer.

**Custom Scanner (`scanner.c` / `scanner.cc`) Responsibilities:**
* Handling indentation-based scoping (emitting `INDENT` and `DEDENT` tokens).
* Complex tokenization that requires lookahead or state storage (e.g., distinguishing between a newline that continues a statement vs. a newline that ends a statement).
* Custom resolution for specific ambiguous operators or strings that `grammar.js` cannot easily express as regular expressions.

In our Toit grammar, the external scanner is essential for effectively tracking the current indentation level and intelligently handling whitespace and newlines, feeding the relevant control tokens back to `grammar.js`.

## Progress

### Pass Rate (Toit standard library `/toit/lib/`)

| Date       | Corpus Tests | Library Files | Pass Rate |
|------------|-------------|---------------|-----------|
| 2026-03-13 | —           | 55/144        | 38%       |
| 2026-03-14 | —           | 94/144        | 65%       |
| 2026-03-16 | 105/~119    | 105/144       | 73%       |
| 2026-03-26 | 85/~119     | 126/144       | 87.5%     |

### Key Fix: else/else-if after indented blocks (2026-03-26)

The biggest single improvement came from removing the post-DEDENT NEWLINE in the scanner.

**Problem:** The scanner emitted `DEDENT NEWLINE` after an indented block. The `NEWLINE` was consumed by `_statement`'s `$._newline` alternative, ending `if_statement` before the parser could see `else`. This caused `else:` to be misinterpreted as a `block_function_call` (function named "else" with a block argument).

**Fix:** Removed `scanner->queued_newline = true` from the DEDENT handler in `scanner.c`. The DEDENT itself closes the block, and the preceding NEWLINE already terminated the last statement. Also removed the corresponding `$._newline` before `"finally"` in the `try_statement` grammar rule.

**Insight from Toit compiler:** The Toit compiler (`toit/src/compiler/scanner.cc`) solves this differently — the scanner doesn't even emit INDENT/DEDENT tokens; it reports indentation *values* on NEWLINE tokens, and the *parser* synthesizes INDENT/DEDENT. The parser then peeks ahead for `else`/`finally` keywords and consumes the DEDENT when found. Tree-sitter's architecture doesn't allow this (the external scanner must emit tokens), so the cleaner solution was to simply not produce the redundant post-DEDENT NEWLINE.

**Impact:** 21 files fixed (105 → 126), covering the vast majority of `else`/`else if` chains.

### Remaining 18 Failures — TODO

All remaining failures are independent "grind it out" issues, no architectural blockers.

| # | Category | Files | Description | Difficulty |
|---|----------|-------|-------------|------------|
| 1 | Multi-line calls / continuation args | 5 | Args on continuation lines not properly bounded; blank lines don't terminate | Medium |
| 2 | Chained/nested blocks (`: ... : ...`) | 3 | Nested `block_function_call` chains like `a: b: expr` | Medium |
| 3 | Postfix `++`/`--` vs `--` named arg | 2 | `start--` parsed as named arg prefix, not postfix decrement | Easy |
| 4 | Mixed same-line/continuation class clauses | 1 | `class Foo extends Bar\n    implements Baz:` | Easy-Medium |
| 5 | Operator-first continuation (`+ expr`) | 1 | `ns_ = ns\n    + (us * ...)` | Medium |
| 6 | Backslash line continuation `\` | 1 | Not implemented in scanner | Medium |
| 7 | Empty set `{}` conflict | 1 | Conflict with `literal_map`; fix applied but file has other errors | Done |
| 8 | Assignment in return (`return x = y`) | 1 | `return hash_ = expr`; fix applied but file has other errors | Done |
| 9 | Positional arg after boolean named arg | 1 | `--flash "string"` — named arg ends the repeat | Easy |
| 10 | Character arithmetic + block call | 1 | `ByteArray '~' - '-' + 1:` | Medium |
| 11 | Abstract method consumed by prior expr | 1 | `abstract to-string -> string` swallowed by preceding call | Medium |
| 12 | Chained block calls on same line | 1 | `return not bytes_.any: it != 0` | Medium |

**Files affected per category:**
- **#1**: buffer.toit, bytes.toit, hex.toit, remote.toit, coap/message.toit
- **#2**: task.toit, rpc.toit, adler32.toit
- **#3**: byte-order.toit, tls/session.toit
- **#4**: esp32/net/ethernet.toit
- **#5**: core/time.toit
- **#6**: bitmap.toit
- **#7**: net/modules/dns.toit (fix applied, other errors remain)
- **#8**: uuid.toit (fix applied, other errors remain)
- **#9**: system/system.toit
- **#10**: encoding/url.toit
- **#11**: core/numbers.toit
- **#12**: uuid.toit (secondary error)
