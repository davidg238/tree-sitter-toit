#include <tree_sitter/parser.h>
#include <vector>
#include <cstring>
#include <stdint.h>

extern "C" {

// Index must strictly match:
// externals: ($) => [$._indent, $._dedent, $._newline, $._error_sentinel]
enum TokenType {
  INDENT,
  DEDENT,
  NEWLINE,
  ERROR_SENTINEL
};

struct Scanner {
  std::vector<uint16_t> indent_stack;

  Scanner() {
    indent_stack.push_back(0);
  }

  unsigned serialize(char *buffer) {
    size_t i = 0;
    // Skip the root 0 to save space
    for (size_t j = 1; j < indent_stack.size(); ++j) {
      if (i + sizeof(uint16_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) break;
      memcpy(buffer + i, &indent_stack[j], sizeof(uint16_t));
      i += sizeof(uint16_t);
    }
    return i;
  }

  void deserialize(const char *buffer, unsigned length) {
    indent_stack.clear();
    indent_stack.push_back(0);
    if (length > 0) {
      for (size_t i = 0; i < length; i += sizeof(uint16_t)) {
        uint16_t indent;
        memcpy(&indent, buffer + i, sizeof(uint16_t));
        indent_stack.push_back(indent);
      }
    }
  }

  bool scan(TSLexer *lexer, const bool *valid_symbols) {
    // 1. Error Recovery Damping:
    // If the parser is panicking, don't supply virtual tokens that might confuse it.
    if (valid_symbols[ERROR_SENTINEL]) return false;

    // 2. Horizontal Whitespace: Skip ONLY spaces and tabs.
    // Do NOT skip \n here, or we lose the trigger for the next line.
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
      lexer->advance(lexer, true);
    }

    // 3. Newline Handling:
    // If we see a newline, consume exactly one and report it.
    // This moves 'Pos' forward in the parser, preventing infinite loops.
    if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
      if (valid_symbols[NEWLINE]) {
        lexer->advance(lexer, false);
        lexer->result_symbol = NEWLINE;
        return true;
      }
    }

    // 4. Indentation Logic:
    // This is the "Handshake." We only measure column at the start of a statement.
    uint16_t column = lexer->get_column(lexer);

    // INDENT: Push to stack and return
    if (valid_symbols[INDENT] && column > indent_stack.back()) {
      indent_stack.push_back(column);
      lexer->result_symbol = INDENT;
      return true;
    }

    // DEDENT: Pop from stack and return
    // If column < back, we return DEDENT. Tree-sitter calls scan() again
    // immediately if it needs to pop multiple levels (e.g. jumping from 8 back to 0).
    if (valid_symbols[DEDENT] && column < indent_stack.back()) {
      indent_stack.pop_back();
      lexer->result_symbol = DEDENT;
      return true;
    }

    return false;
  }
};

void *tree_sitter_toit_external_scanner_create() {
  return new Scanner();
}

bool tree_sitter_toit_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  return static_cast<Scanner *>(payload)->scan(lexer, valid_symbols);
}

unsigned tree_sitter_toit_external_scanner_serialize(void *payload, char *buffer) {
  return static_cast<Scanner *>(payload)->serialize(buffer);
}

void tree_sitter_toit_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  static_cast<Scanner *>(payload)->deserialize(buffer, length);
}

void tree_sitter_toit_external_scanner_destroy(void *payload) {
  delete static_cast<Scanner *>(payload);
}

} // extern "C"
