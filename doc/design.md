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
