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
