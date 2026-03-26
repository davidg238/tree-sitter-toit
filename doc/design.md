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
| 2026-03-26 | 85/~119     | 126→132/144   | 87.5→91.7%|

### Key Fix: else/else-if after indented blocks (2026-03-26)

The biggest single improvement came from removing the post-DEDENT NEWLINE in the scanner.

**Problem:** The scanner emitted `DEDENT NEWLINE` after an indented block. The `NEWLINE` was consumed by `_statement`'s `$._newline` alternative, ending `if_statement` before the parser could see `else`. This caused `else:` to be misinterpreted as a `block_function_call` (function named "else" with a block argument).

**Fix:** Removed `scanner->queued_newline = true` from the DEDENT handler in `scanner.c`. The DEDENT itself closes the block, and the preceding NEWLINE already terminated the last statement. Also removed the corresponding `$._newline` before `"finally"` in the `try_statement` grammar rule.

**Insight from Toit compiler:** The Toit compiler (`toit/src/compiler/scanner.cc`) solves this differently — the scanner doesn't even emit INDENT/DEDENT tokens; it reports indentation *values* on NEWLINE tokens, and the *parser* synthesizes INDENT/DEDENT. The parser then peeks ahead for `else`/`finally` keywords and consumes the DEDENT when found. Tree-sitter's architecture doesn't allow this (the external scanner must emit tokens), so the cleaner solution was to simply not produce the redundant post-DEDENT NEWLINE.

**Impact:** 21 files fixed (105 → 126), covering the vast majority of `else`/`else if` chains.

### Additional fixes (2026-03-26)

- **Postfix `++`/`--` in function args**: Added `$.postfix_expression` to function_call arg choices. Fixes `start--` and `seq++` as args.
- **Top-level field/variable newlines**: Added `$._newline` to `_definition` for field/variable declarations. Fixes positional arg after boolean named arg.
- **Operator-first continuations**: Scanner treats `+`, `*`, `/`, etc. at start of deeper-indented line as CONTINUATION not INDENT. Distinguishes `+` (binary) from `++` (prefix) by peeking one char.
- **Chained block calls**: Added `$.block_function_call` to block inline body. Fixes `a: b: expr` pattern.
- **Backslash line continuation**: Scanner handles `\` + newline by emitting CONTINUATION. Fixes bitmap.toit.

### Remaining 11 Failures — TODO

| # | Category | Files | Description | Difficulty |
|---|----------|-------|-------------|------------|
| 1 | GLR explosion: 3+ multi-line calls | 4 | 3+ consecutive function calls each with `$._indent ... $._dedent` continuations causes combinatorial state explosion. 2 work, 3 fail. Needs restructuring of how function_call continuations interact with `repeat1($._statement)`. | Hard |
| 2 | Nested block params | 3 | `--if-error=: expr` or `primitive: \| bytes \| expr` — blocks as named arg values | Medium |
| 3 | Character arithmetic + block call | 1 | `ByteArray '~' - '-' + 1:` — function args include binary expression with char literals, ambiguous with multi-arg call | Hard |
| 4 | `not` + block_function_call | 1 | `return not bytes_.any: it != 0` — `not` applies to `$._expression`, block_function_call is not `$._expression` | Medium |
| 5 | `:=` tokenization in nested blocks | 1 | `:` consumed as block start instead of part of `:=` | Medium |

**Files affected:**
- **#1**: buffer.toit, bytes.toit, hex.toit, ethernet.toit, remote.toit (5 files)
- **#2**: numbers.toit, rpc.toit, adler32.toit
- **#3**: encoding/url.toit
- **#4**: uuid.toit
- **#5**: net/modules/dns.toit

**Key finding:** The 3+ multi-line call issue (#1) is the biggest remaining blocker. Two consecutive function calls with continuation-line named args parse fine, but three triggers GLR explosion. This is because each function_call's continuation block alternative (`$._indent ... $._dedent`) creates nested INDENT/DEDENT pairs within the outer block's `repeat1($._statement)`, leading to exponentially many possible partition strategies.
