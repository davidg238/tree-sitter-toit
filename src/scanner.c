#include <tree_sitter/parser.h>
#include <string.h>
#include <stdint.h>
#include <stdlib.h>

enum TokenType {
  INDENT,
  DEDENT,
  NEWLINE,
  ERROR_SENTINEL
};

typedef struct {
  uint16_t *indent_stack;
  uint32_t length;
  uint32_t capacity;
  uint16_t queued_dedent_count;
  bool eof_newline_emitted;
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

      if (valid_symbols[INDENT] && indent_length > current_indent_length) {
        push_indent(scanner, indent_length);
        lexer->result_symbol = INDENT;
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
