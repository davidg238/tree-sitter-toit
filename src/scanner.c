#include <tree_sitter/parser.h>
#include <string.h>
#include <stdint.h>
#include <stdlib.h>

enum TokenType {
  INDENT,
  DEDENT,
  NEWLINE,
  ERROR_SENTINEL,
  CONTINUATION
};

typedef struct {
  uint16_t *indent_stack;
  uint32_t length;
  uint32_t capacity;
  uint16_t queued_dedent_count;
  uint16_t pending_indent_length;
  bool eof_newline_emitted;
  bool queued_newline;
} Scanner;

static void push_indent(Scanner *scanner, uint16_t indent) {
  if (scanner->length == scanner->capacity) {
    scanner->capacity = scanner->capacity == 0 ? 8 : scanner->capacity * 2;
    scanner->indent_stack = realloc(scanner->indent_stack, scanner->capacity * sizeof(uint16_t));
  }
  scanner->indent_stack[scanner->length++] = indent;
}

static uint16_t pop_indent(Scanner *scanner) {
  if (scanner->length == 0) return 0;
  return scanner->indent_stack[--scanner->length];
}

static uint16_t back_indent(Scanner *scanner) {
  if (scanner->length == 0) return 0;
  return scanner->indent_stack[scanner->length - 1];
}

void *tree_sitter_toit_external_scanner_create() {
  Scanner *scanner = calloc(1, sizeof(Scanner));
  push_indent(scanner, 0);
  return scanner;
}

void tree_sitter_toit_external_scanner_destroy(void *payload) {
  Scanner *scanner = (Scanner *)payload;
  if (scanner->indent_stack) free(scanner->indent_stack);
  free(scanner);
}

unsigned tree_sitter_toit_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *scanner = (Scanner *)payload;
  size_t i = 0;
  
  if (i + sizeof(uint16_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) return i;
  memcpy(buffer + i, &scanner->queued_dedent_count, sizeof(uint16_t));
  i += sizeof(uint16_t);

  if (i + sizeof(bool) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) return i;
  memcpy(buffer + i, &scanner->eof_newline_emitted, sizeof(bool));
  i += sizeof(bool);

  if (i + sizeof(bool) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) return i;
  memcpy(buffer + i, &scanner->queued_newline, sizeof(bool));
  i += sizeof(bool);

  if (i + sizeof(uint16_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) return i;
  memcpy(buffer + i, &scanner->pending_indent_length, sizeof(uint16_t));
  i += sizeof(uint16_t);

  for (size_t j = 1; j < scanner->length; ++j) {
    if (i + sizeof(uint16_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) break;
    memcpy(buffer + i, &scanner->indent_stack[j], sizeof(uint16_t));
    i += sizeof(uint16_t);
  }
  return i;
}

void tree_sitter_toit_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  Scanner *scanner = (Scanner *)payload;
  scanner->queued_dedent_count = 0;
  scanner->pending_indent_length = 0;
  scanner->length = 0;
  push_indent(scanner, 0);

  if (length == 0) return;

  size_t i = 0;
  if (i + sizeof(uint16_t) > length) return;
  memcpy(&scanner->queued_dedent_count, buffer + i, sizeof(uint16_t));
  i += sizeof(uint16_t);

  if (i + sizeof(bool) <= length) {
    memcpy(&scanner->eof_newline_emitted, buffer + i, sizeof(bool));
    i += sizeof(bool);
  } else {
    scanner->eof_newline_emitted = false;
  }

  if (i + sizeof(bool) <= length) {
    memcpy(&scanner->queued_newline, buffer + i, sizeof(bool));
    i += sizeof(bool);
  } else {
    scanner->queued_newline = false;
  }

  if (i + sizeof(uint16_t) <= length) {
    memcpy(&scanner->pending_indent_length, buffer + i, sizeof(uint16_t));
    i += sizeof(uint16_t);
  } else {
    scanner->pending_indent_length = 0;
  }

  for (; i < length; i += sizeof(uint16_t)) {
    uint16_t indent;
    if (i + sizeof(uint16_t) > length) break;
    memcpy(&indent, buffer + i, sizeof(uint16_t));
    push_indent(scanner, indent);
  }
}

static void skip(TSLexer *lexer) {
  lexer->advance(lexer, true);
}

bool tree_sitter_toit_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;

  if (valid_symbols[ERROR_SENTINEL]) return false;

  if (scanner->queued_dedent_count > 0 && valid_symbols[DEDENT]) {
    scanner->queued_dedent_count--;
    pop_indent(scanner);
    lexer->result_symbol = DEDENT;
    // Don't queue a NEWLINE after DEDENT. The DEDENT itself closes the block,
    // and the preceding NEWLINE already terminated the last statement.
    // A post-DEDENT NEWLINE would be consumed by _statement's $._newline,
    // breaking else/finally continuation (the parser would see the if_statement
    // as complete before reaching "else").
    return true;
  }

  if (scanner->queued_dedent_count > 0 && lexer->eof(lexer)) {
    // At EOF with queued dedents but DEDENT not valid: clear to avoid loop
    scanner->queued_dedent_count--;
    pop_indent(scanner);
  }

  // After all queued dedents consumed, check if we need to re-indent.
  // This handles: indent 6 -> indent 4 when stack was [0, 2, 6]:
  //   DEDENT pops 6, stack = [0, 2], then INDENT pushes 4.
  // Check BEFORE queued_newline so INDENT takes priority over NEWLINE.
  if (scanner->pending_indent_length > 0) {
    if (valid_symbols[INDENT]) {
      push_indent(scanner, scanner->pending_indent_length);
      scanner->pending_indent_length = 0;
      scanner->queued_newline = false;
      lexer->result_symbol = INDENT;
      return true;
    }
    // If INDENT not valid, emit as CONTINUATION (expression continuation)
    if (valid_symbols[CONTINUATION]) {
      scanner->pending_indent_length = 0;
      scanner->queued_newline = false;
      lexer->mark_end(lexer);
      lexer->result_symbol = CONTINUATION;
      return true;
    }
    scanner->pending_indent_length = 0;
  }

  if (scanner->queued_newline && valid_symbols[NEWLINE]) {
    scanner->queued_newline = false;
    lexer->result_symbol = NEWLINE;
    return true;
  }

  bool found_end_of_line = false;
  uint32_t indent_length = 0;

  for (;;) {
    if (lexer->lookahead == '\n') {
      found_end_of_line = true;
      indent_length = 0;
      skip(lexer);
    } else if (lexer->lookahead == ' ') {
      indent_length++;
      skip(lexer);
    } else if (lexer->lookahead == '\r' || lexer->lookahead == '\f') {
      indent_length = 0;
      skip(lexer);
    } else if (lexer->lookahead == '\t') {
      indent_length += 8;
      skip(lexer);
    } else if (lexer->lookahead == '\\') {
      // Backslash line continuation: \ followed by newline joins lines.
      // We need to peek ahead without committing if it's not a continuation.
      skip(lexer);
      if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
        // It IS a continuation. Skip the newline and following whitespace,
        // then emit CONTINUATION so tree-sitter commits the position advance.
        skip(lexer);
        if (lexer->lookahead == '\n') skip(lexer);
        // Skip continuation line indentation
        while (lexer->lookahead == ' ' || lexer->lookahead == '\t') skip(lexer);
        lexer->mark_end(lexer);
        lexer->result_symbol = CONTINUATION;
        return true;
      }
      // Not a continuation — but we already consumed the backslash.
      // Return false; tree-sitter will restore position.
      break;
    } else if (lexer->lookahead == '/' && valid_symbols[INDENT]) {
        break;
    } else if (lexer->eof(lexer)) {
      indent_length = 0;
      found_end_of_line = true;
      break;
    } else {
      break;
    }
  }

  if (found_end_of_line) {
    if (scanner->length > 0) {
      uint16_t current_indent_length = back_indent(scanner);

      if (indent_length > current_indent_length) {
        // Mark end BEFORE peeking, so INDENT/CONTINUATION tokens end here.
        lexer->mark_end(lexer);

        // When the line starts with a binary operator, this is expression
        // continuation, not a new block. Emit CONTINUATION instead of INDENT.
        // Must distinguish: '+' (binary) vs '++' (prefix increment).
        bool starts_with_binop = false;
        int32_t ch = lexer->lookahead;
        if (ch == '*' || ch == '/' || ch == '%' ||
            ch == '|' || ch == '&' || ch == '^' || ch == '?' || ch == '.' ||
            ch == '<' || ch == '>' || ch == '=') {
          starts_with_binop = true;
        } else if (ch == '+') {
          // Peek: '+' followed by non-'+' → binary addition (continuation).
          // '++' → prefix increment (not continuation).
          skip(lexer);
          starts_with_binop = (lexer->lookahead != '+');
        }

        if (valid_symbols[INDENT] && !starts_with_binop) {
          push_indent(scanner, indent_length);
          lexer->result_symbol = INDENT;
          return true;
        }
        lexer->result_symbol = CONTINUATION;
        return true;
      }

      if (indent_length < current_indent_length) {
        uint16_t extra_dedents = 0;
        uint16_t temp_length = scanner->length;
        while (temp_length > 0) {
          uint16_t prev_indent = scanner->indent_stack[temp_length - 1];
          if (indent_length < prev_indent) {
             temp_length--;
             extra_dedents++;
          } else {
             break;
          }
        }

        // Check if we need to re-indent after dedenting.
        // e.g., indent 6 -> 4, stack [0, 2, 6]: dedent to [0, 2], then indent to 4.
        uint16_t target_indent = (temp_length > 0) ? scanner->indent_stack[temp_length - 1] : 0;
        if (indent_length > target_indent) {
          scanner->pending_indent_length = indent_length;
        }

        if (valid_symbols[NEWLINE]) {
          scanner->queued_dedent_count = extra_dedents;
          lexer->result_symbol = NEWLINE;
          return true;
        } else if (valid_symbols[DEDENT]) {
          scanner->queued_dedent_count = extra_dedents - 1;
          pop_indent(scanner);
          lexer->result_symbol = DEDENT;
          return true;
        }
      }
    }

    if (valid_symbols[NEWLINE]) {
      if (!lexer->eof(lexer) || !scanner->eof_newline_emitted) {
          if (lexer->eof(lexer)) {
              scanner->eof_newline_emitted = true;
          }
          lexer->result_symbol = NEWLINE;
          return true;
      }
    }
  }

  return false;
}
