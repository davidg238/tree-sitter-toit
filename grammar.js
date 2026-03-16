module.exports = grammar({
  name: "toit",
  externals: ($) => [$._indent, $._dedent, $._newline, $._error_sentinel, $._continuation],
  extras: ($) => [/[ \t\f\r\v\uFEFF\u2060\u200B]/, $.comment, $._continuation],
  word: ($) => $.identifier,
  conflicts: ($) => [
    [$.function_definition, $._primary_expression, $.member_access],
    [$.function_definition, $.member_access],
    [$.member_access, $._primary_expression],
    [$.literal_set, $.literal_map],
    [
      $.field_declaration,
      $.variable_declaration,
      $.function_call,
      $._primary_expression,
    ],
    [$.variable_declaration, $.function_call],
    [$.variable_declaration, $._expression],
    [$.block, $.binary_expression],
    [$.function_definition, $.function_call, $._primary_expression],
    [$.function_definition, $.function_call],
    [$.if_statement, $.function_call],
    [$.while_statement, $.function_call],
    [$.for_statement, $.function_call],
    [$.field_declaration, $._expression],
    [$.binary_expression, $.function_call, $.block_function_call],
    [$._statement, $._expression],
    [$.function_call, $.block_function_call, $._expression],
    [$.parameter, $._primary_expression],
    [$._expression, $.parameter],
    [$._statement],
    [$.member_access, $.function_call],
    [$.variable_declaration, $.assignment],
    [$.function_call, $.block_function_call, $._primary_expression],
    [$.function_call, $._primary_expression],
    [$.block_function_call, $._primary_expression],
    [$.function_call, $.block_function_call],
    [$.variable_declaration, $.block_function_call],
    [$._statement, $.function_call, $.block_function_call],
    [$._statement, $._primary_expression],
    // New conflicts for abstract methods and extended features
    [$.function_definition, $._statement],
    [$.function_definition, $._expression],
    [$.function_definition, $.function_call, $._statement],
    [$.parameter, $.named_argument],
    [$.class_definition, $._primary_expression],
    // type path vs field-storing parameter conflict
    [$.type, $.parameter],
    // try_statement vs block_function_call (try: body)
    [$.try_statement, $.function_call],
    [$.try_statement, $.block_function_call],
    // typed local declaration (name/Type :=) vs division expression
    [$.typed_local_declaration, $._primary_expression],
    [$.typed_local_declaration, $.binary_expression],
    [$.typed_local_declaration, $.function_call],
    [$.typed_local_declaration, $.block_function_call],
    // ternary ? : conflicts
    [$.ternary_expression, $.block],
    [$.ternary_expression, $.binary_expression],
    [$.ternary_expression, $.function_call],
    [$.ternary_expression, $.block_function_call],
    // block param type annotation conflicts
    [$._block_param_entry, $.parameter],
    [$.ternary_expression, $.literal_list],
    [$.ternary_expression, $.literal_byte_array],
    [$.ternary_expression, $.literal_set],
    [$.ternary_expression, $.literal_map],
    [$.variable_declaration, $.ternary_expression],
    [$.typed_local_declaration, $.ternary_expression],
    [$.assignment, $.ternary_expression],
    [$.field_declaration, $.ternary_expression],
    // chained comparison vs binary expression
    [$.chained_comparison, $.binary_expression],
    // prefix expression conflicts
    [$.prefix_expression, $.named_argument],
    // while/if with condition declaration
    [$.while_statement, $._condition_declaration],
    [$.if_statement, $._condition_declaration],
    [$._condition_declaration, $._expression],
    [$._condition_declaration, $.function_call],
    [$._condition_declaration, $.block_function_call],
    [$._condition_declaration, $._primary_expression],
  ],
  rules: {
    source_file: ($) => repeat(choice($._definition, $._newline)),

    _definition: ($) =>
      choice(
        $.import_statement,
        $.export_declaration,
        $.class_definition,
        prec(3, $.function_definition),
        $.variable_declaration,
        $.field_declaration,
      ),

    import_statement: ($) =>
      seq(
        "import",
        optional(repeat1(".")),
        field("path", $._module_path),
        optional(seq("as", field("alias", $.identifier))),
        optional(seq("show", repeat1(choice($.identifier, "*")))),
        $._newline,
      ),

    _module_path: ($) => prec.left(seq($.identifier, repeat(seq(".", $.identifier)))),

    export_declaration: ($) =>
      prec.left(seq(
        "export",
        repeat1(choice($.identifier, "*")),
        optional($._newline)
      )),

    // Handles class, abstract class, interface, mixin, monitor
    class_definition: ($) =>
      seq(
        optional("abstract"),
        choice("class", "interface", "mixin", "monitor"),
        $.identifier,
        optional(seq("extends", $.type)),
        optional(seq("with", repeat1($.type))),
        optional(seq("implements", repeat1($.type))),
        choice(
          // Case 1: no continuation lines, colon directly
          seq(
            ":",
            choice(
              seq($._indent, repeat($._class_member), $._dedent),
              $._newline,
            ),
          ),
          // Case 2: continuation lines for extends/with/implements, colon at end of continuation block
          seq(
            $._indent,
            repeat1(choice(
              seq("extends", $.type),
              seq("with", repeat1($.type)),
              seq("implements", repeat1($.type)),
              $._newline,
            )),
            ":",
            $._newline,
            $._dedent,
            // Body follows at class indent level
            choice(
              seq($._indent, repeat($._class_member), $._dedent),
              $._newline,
            ),
          ),
          // Case 3: continuation lines, colon NOT inside continuation block
          seq(
            $._indent,
            repeat1(choice(
              seq("extends", $.type),
              seq("with", repeat1($.type)),
              seq("implements", repeat1($.type)),
              $._newline,
            )),
            $._dedent,
            ":",
            choice(
              seq($._indent, repeat($._class_member), $._dedent),
              $._newline,
            ),
          ),
        ),
      ),

    // Class body members: method/field/variable definitions (no block_function_call)
    _class_member: ($) =>
      choice(
        $.function_definition,
        seq(
          choice(
            prec(15, $.field_declaration),
            prec(14, $.variable_declaration),
          ),
          $._newline,
        ),
        $._newline,
      ),

    function_definition: ($) =>
      prec(
        12,
        seq(
          optional("abstract"),
          optional("static"),
          choice(
            $._operator_method_name,
            // setter method: name= (no space before =)
            prec(22, seq($.identifier, token.immediate("="))),
            $.identifier,
            prec(21, seq($.identifier, token.immediate("."), $.identifier)),
            prec(21, seq("constructor", token.immediate("."), $.identifier)),
            "constructor",
            $.member_access
          ),
          repeat($.parameter),
          optional(seq("->", field("return_type", $.type))),
          choice(
            // Case 1: inline colon + body
            seq(
              ":",
              choice(
                seq($._indent, repeat1($._statement), $._dedent),
                $._statement,
                $._newline,
              ),
            ),
            // Case 2: continuation-line params with colon at end
            seq(
              $._indent,
              repeat1(choice(
                $.parameter,
                seq("->", field("return_type", $.type)),
                $._newline,
              )),
              ":",
              $._newline,
              $._dedent,
              // Body follows after dedent from param block
              choice(
                seq($._indent, repeat1($._statement), $._dedent),
                $._newline,
              ),
            ),
            // Case 3: continuation-line params without colon (abstract or colon on next construct)
            seq(
              $._indent,
              repeat1(choice(
                $.parameter,
                seq("->", field("return_type", $.type)),
                $._newline,
              )),
              $._dedent,
              choice(
                seq(
                  ":",
                  choice(
                    seq($._indent, repeat1($._statement), $._dedent),
                    $._statement,
                    $._newline,
                  ),
                ),
                $._newline,
              ),
            ),
            $._newline,  // abstract method: no colon, no body
          ),
        ),
      ),

    // operator == / operator [] / operator []= etc.
    _operator_method_name: ($) =>
      seq(
        "operator",
        choice(
          "==", "!=", "<", "<=", ">", ">=",
          "+", "-", "*", "/", "%",
          "~", "&", "|", "^", "<<", ">>", ">>>",
          seq("[", "]", "="),
          seq("[", "]"),
          seq("[", "..", "]"),
        )
      ),

    parameter: ($) =>
      choice(
        // Named parameter with optional field-storing: --[.]name/Type=default
        // Type annotation can be immediate (--name/Type) or spaced (--name /Type)
        seq(
          "--",
          optional(token.immediate(".")),
          field("name", $.identifier),
          optional(seq(choice(token.immediate("/"), "/"), field("type", $.type))),
          optional(seq("=", choice($._param_default, $.block))),
        ),
        // Positional or field-storing parameter: [.] name [/Type] [=default]
        // Type annotation can be immediate (name/Type) or spaced (name /Type)
        seq(
          optional("."),
          field("name", $.identifier),
          optional(seq(choice(token.immediate("/"), "/"), field("type", $.type))),
          optional(seq("=", choice($._param_default, $.block))),
        ),
        $.block_parameter
      ),

    // Restricted expression for parameter defaults: self-contained expression
    // that does NOT include function_call (which would greedily consume --name
    // as named_argument). All sub-expressions reference _param_default, not _expression.
    _param_default: ($) =>
      choice(
        $._primary_expression,
        prec(8, seq(choice("-", "~"), $._param_default)),
        prec.left(7, seq($._param_default, choice("*", "/", "%"), $._param_default)),
        prec.left(6, seq($._param_default, choice("+", "-"), $._param_default)),
        prec.left(5, seq($._param_default, choice("<<", ">>", ">>>"), $._param_default)),
        prec.left(4, seq($._param_default, choice("&", "|", "^"), $._param_default)),
        prec.left(3, seq($._param_default, choice("==", "!=", "<", ">", "<=", ">="), $._param_default)),
        prec.left(2, seq($._param_default, choice("and", "or"), $._param_default)),
        prec(0, seq("not", $._param_default)),
      ),

    // Block parameters: [name] or [--name] with optional default
    block_parameter: ($) =>
      seq(
        "[",
        optional("--"),
        field("name", $.identifier),
        optional(seq("=", choice($._expression, $.block))),
        "]",
      ),

    _statement: ($) =>
      choice(
        $.if_statement,
        $.while_statement,
        $.for_statement,
        $.try_statement,
        $._newline,  // blank lines / post-dedent newlines
        seq(
          choice(
            prec(15, $.typed_local_declaration),
            prec(14, $.variable_declaration),
            prec(13, $.assignment),
            $.return_statement,
            $.throw_statement,
            $.break_statement,
            $.continue_statement,
            $.function_call,
            $.block_function_call,
            $.primitive_expression,
            prec(-1, $._expression),  // expression statement (zero-arg calls, etc.)
          ),
          $._newline,
        ),
      ),

    throw_statement: ($) => seq("throw", $._expression),
    break_statement: ($) => prec.right(seq("break", optional($.identifier))),
    continue_statement: ($) => prec.right(seq("continue", optional($.identifier))),

    field_declaration: ($) =>
      prec(
        15,
        seq(
          optional("static"),
          $.identifier,
          "/",
          field("type", $.type),
          optional(choice(
            seq($._assign_op, $._expression),
            // Multi-line: value on continuation lines
            seq($._assign_op, $._indent, repeat1(choice($._expression, $.block_function_call, $._newline)), $._dedent),
          )),
        ),
      ),

    variable_declaration: ($) =>
      seq(
        optional("static"),
        field(
          "left",
          choice($.identifier, $.member_access, $.parenthesized_expression),
        ),
        alias(choice(":=", "::="), $.operator),
        field("right", choice(
          $._expression,
          $.block_function_call,
          $.block,
          // Multi-line: value on continuation lines
          seq($._indent, repeat1(choice($._expression, $.block_function_call, $._newline)), $._dedent),
        )),
      ),

    // Variable declaration inside while/if conditions (no block/block_function_call on right)
    _condition_declaration: ($) =>
      seq(
        field("left", $.identifier),
        alias(choice(":=", "::="), $.operator),
        field("right", $._expression),
      ),

    // Typed local variable: name/Type := expr  (only valid in function bodies)
    typed_local_declaration: ($) =>
      prec(14, seq(
        field("left", $.identifier),
        "/",
        field("type", $.type),
        alias(choice(":=", "::="), $.operator),
        field("right", choice($._expression, $.block_function_call)),
      )),

    assignment: ($) =>
      prec.right(
        1,
        seq(
          field(
            "left",
            choice($.identifier, $.subscript_expression, $.member_access),
          ),
          alias(
            choice(
              "=",
              "+=",
              "-=",
              "*=",
              "/=",
              "%=",
              "<<=",
              ">>=",
              ">>>=",
              "&=",
              "|=",
              "^=",
            ),
            $.operator,
          ),
          field("right", choice(
            $.assignment,
            $._expression,
            $.block_function_call,
            // Multi-line: value on continuation lines
            seq($._indent, repeat1(choice($._expression, $.block_function_call, $._newline)), $._dedent),
          )),
        ),
      ),

    return_statement: ($) => prec.right(seq("return", optional(choice(
      $._expression,
      $.block_function_call,
      // Multi-line return: expression on continuation lines
      seq($._indent, repeat1(choice($._expression, $.block_function_call, $._newline)), $._dedent),
    )))),

    try_statement: ($) =>
      prec.right(5, seq(
        "try",
        ":",
        choice(
          seq($._indent, repeat1($._statement), $._dedent),
          $._statement,
        ),
        optional(seq(
          $._newline,  // NEWLINE emitted after try block's DEDENT
          "finally",
          ":",
          optional($._block_params),
          choice(
            seq($._indent, repeat1($._statement), $._dedent),
            $._statement,
          ),
        )),
      )),

    if_statement: ($) =>
      prec.right(
        5,
        seq(
          "if",
          field("condition", choice($._condition_declaration, $._expression)),
          prec(10, ":"),
          choice(
            seq($._indent, repeat1($._statement), $._dedent),
            $._statement,
          ),
          optional(
            choice(
              seq(
                "else",
                prec(10, ":"),
                choice(
                  seq($._indent, repeat1($._statement), $._dedent),
                  $._statement,
                ),
              ),
              seq("else", $.if_statement),
            ),
          ),
        ),
      ),

    while_statement: ($) =>
      prec(
        5,
        seq(
          "while",
          choice($._condition_declaration, $._expression),
          prec(10, ":"),
          choice(
            seq($._indent, repeat1($._statement), $._dedent),
            $._statement,
          ),
        ),
      ),

    for_statement: ($) =>
      prec(
        5,
        seq(
          "for",
          optional($.variable_declaration),
          ";",
          optional($._expression),
          ";",
          optional(choice($.assignment, $.function_call, $.postfix_expression, $.prefix_expression)),
          prec(10, ":"),
          choice(
            seq($._indent, repeat1($._statement), $._dedent),
            $._statement,
          ),
        ),
      ),

    function_call: ($) =>
      prec.left(
        2,
        seq(
          field("function", choice($.identifier, $.member_access)),
          choice(
            // All args on same line
            repeat1(choice($._primary_expression, $.named_argument)),
            // All args in continuation block
            seq(
              $._indent,
              repeat1(choice($._expression, $.named_argument, $._newline)),
              $._dedent,
            ),
            // Mixed: some args on same line, more on continuation lines
            seq(
              repeat1(choice($._primary_expression, $.named_argument)),
              $._indent,
              repeat1(choice($._expression, $.named_argument, $._newline)),
              $._dedent,
            ),
          )
        )
      ),

    block_function_call: ($) =>
      prec.left(
        2,
        seq(
          field("function", choice($.identifier, $.member_access)),
          optional(
            choice(
              repeat1(choice($._primary_expression, $.named_argument)),
              seq(
                $._indent,
                repeat1(choice($._expression, $.named_argument, $._newline)),
                $._dedent,
              ),
              seq(
                repeat1(choice($._primary_expression, $.named_argument)),
                $._indent,
                repeat1(choice($._expression, $.named_argument, $._newline)),
                $._dedent,
              ),
            )
          ),
          choice(
            $.block,
            $.double_colon_block,
            seq($._indent, repeat1($._statement), $._dedent)
          )
        )
      ),

    named_argument: ($) =>
      prec.right(5, seq("--", field("name", $.identifier), optional(seq("=", choice($._expression, $.block))))),

    double_colon_block: ($) => seq(
      $._double_colon,
      optional($._block_params),
      choice(
        $._expression,
        seq($._indent, repeat1($._statement), $._dedent),
      ),
    ),

    _expression: ($) =>
      choice(
        $.ternary_expression,
        $.binary_expression,
        $.chained_comparison,
        $.unary_expression,
        $.prefix_expression,
        $.postfix_expression,
        $._primary_expression,
        $.function_call,
      ),

    chained_comparison: ($) =>
      prec.left(3, seq(
        $._expression,
        choice("<=", ">=", "<", ">"),
        $._expression,
        choice("<=", ">=", "<", ">"),
        $._expression,
      )),

    ternary_expression: ($) =>
      prec.right(-1, seq(
        $._expression,
        token(prec(1, "?")),
        $._expression,
        ":",
        $._expression,
      )),

    prefix_expression: ($) =>
      prec(10, seq(
        choice("++", "--"),
        choice($.identifier, $.member_access),
      )),

    postfix_expression: ($) =>
      prec(10, seq(
        choice($.identifier, $.subscript_expression, $.member_access),
        choice(token.immediate("++"), token.immediate("--")),
      )),

    _primary_expression: ($) =>
      choice(
        prec(2, $.identifier),
        $.number,
        $.character,
        $.string,
        $.triple_string,
        $.member_access,
        $.subscript_expression,
        $.parenthesized_expression,
        $.literal_list,
        $.literal_byte_array,
        $.literal_map,
        $.literal_set,
        $.interpolation,
        $.uninitialized_literal,
        $.primitive_expression,
      ),

    member_access: ($) =>
      prec(
        1,
        seq(
          choice($.identifier, $._primary_expression),
          token.immediate("."),
          $.identifier,
        ),
      ),
    subscript_expression: ($) =>
      prec(
        19,
        seq(
          choice(
            $.identifier,
            $.member_access,
            $.parenthesized_expression,
            $.string,
            $.triple_string,
            $.subscript_expression,
          ),
          token.immediate("["),
          choice(
            seq(optional($._expression), "..", optional($._expression)),
            $._expression,
          ),
          "]",
        ),
      ),

    _block_params: ($) => seq("|", repeat($._block_param_entry), "|"),

    _block_param_entry: ($) => seq(
      $.identifier,
      optional(seq(token.immediate("/"), $.type)),
    ),

    block: ($) =>
      prec(
        1,
        seq(
          ":",
          optional($._block_params),
          choice(
            prec.dynamic(1, $._expression),
            $.assignment,
            $.return_statement,
            $.throw_statement,
            $.break_statement,
            $.continue_statement,
            $.if_statement,
            $.while_statement,
            $.for_statement,
            $.try_statement,
            seq($._indent, repeat1($._statement), $._dedent),
          ),
        ),
      ),

    parenthesized_expression: ($) => seq("(", choice($._expression, $.block_function_call, $.block), ")"),

    binary_expression: ($) => {
      const table = [
        [prec.left, 1, choice("or", "||")],
        [prec.left, 2, choice("and", "&&")],
        [prec.left, 3, choice("==", "!=", ">=", "<=", ">", "<", "is", "as", "is-not")],
        [prec.left, 4, choice("|", "&", "^", "<<", ">>", ">>>")],
        [prec.left, 5, choice("+", "-")],
        [prec.left, 6, choice("*", "/", "%")],
      ];
      return choice(
        ...table.map(([fn, p, op]) =>
          fn(p, seq($._expression, op, $._expression)),
        ),
      );
    },

    unary_expression: ($) =>
      choice(
        // Arithmetic/bitwise unary: higher precedence than comparisons
        prec(8, seq(choice("-", "~"), $._expression)),
        // Logical not: lower precedence than comparisons (3), higher than or/and (1-2)
        prec(0, seq(choice("not", "!"), $._expression)),
      ),

    // Identifiers can contain hyphens, but a hyphen must be followed by an
    // alphanumeric character (so `i--` is not a single identifier).
    identifier: ($) => /[a-zA-Z_]([a-zA-Z0-9_]|-[a-zA-Z0-9])*/,

    // Type supports dotted paths (e.g., io.Data) and optional nullable marker
    // prec.right: prefer SHIFT over REDUCE so "?" is consumed as nullable marker
    type: ($) => prec.right(seq(
      $.identifier,
      repeat(prec.dynamic(1, seq(token.immediate("."), $.identifier))),
      optional(token.immediate("?")),
    )),

    number: ($) =>
      token(
        choice(
          /-?\d[\d_]*(\.\d[\d_]*([eE][+-]?[\d_]+)?)?/,
          /0x[0-9a-fA-F_]+/,
          /0b[01_]+/,
        ),
      ),

    triple_string: ($) =>
      token(seq(
        '"""',
        /([^"\\]|\\.|"[^"]|""[^"])*/,
        '"""',
      )),

    string: ($) =>
      seq(
        '"',
        repeat(
          choice(
            token.immediate(/[^"$\\]+/),
            $.interpolation,
            $.escape_sequence,
          ),
        ),
        '"',
      ),

    escape_sequence: ($) =>
      token.immediate(
        choice(
          seq("\\", /[^xuU]/),             // simple: \n \t \\ \" etc.
          seq("\\x", /[0-9a-fA-F]+/),      // hex: \xf8 \x2a
          seq("\\x{", /[0-9a-fA-F]+/, "}"), // hex braces: \x{e5}
          seq("\\u{", /[0-9a-fA-F]+/, "}"), // unicode braces: \u{00e6}
          seq("\\u", /[0-9a-fA-F]{4}/),    // unicode: \u00e6
        ),
      ),

    interpolation: ($) =>
      choice(
        seq("$", $.identifier),
        seq("$(", optional($.format_specifier), $._expression, ")"),
      ),

    format_specifier: ($) =>
      token(
        seq("%", repeat(choice(/[-+ 0#]/, /\d/, /\./)), /[diouxXeEfFgGcs]/),
      ),

    comment: ($) =>
      choice(
        token(seq("//", /[^\n]*/)),
        token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
      ),

    _assign_op: ($) => choice(":=", "::="),
    _double_colon: ($) => "::",

    character: ($) =>
      token(
        seq(
          "'",
          choice(
            /[^'\n\\]/,                      // regular char
            seq("\\", /[^xuU]/),             // simple: \n \t \\  etc.
            seq("\\x", /[0-9a-fA-F]+/),      // hex: \x2a
            seq("\\x{", /[0-9a-fA-F]+/, "}"), // hex braces
            seq("\\u{", /[0-9a-fA-F]+/, "}"), // unicode braces: \u{00e6}
            seq("\\u", /[0-9a-fA-F]{4}/),    // unicode: \u00e6
          ),
          "'",
        ),
      ),

    literal_byte_array: ($) =>
      seq(
        "#",
        token.immediate("["),
        repeat(choice(seq($._expression, optional(",")), $._newline)),
        "]",
      ),

    literal_list: ($) =>
      seq("[", repeat(choice(seq($._expression, optional(",")), $._newline)), "]"),

    literal_set: ($) =>
      seq("{", repeat(choice(seq($._expression, optional(",")), $._newline)), "}"),

    // Map literal: { key: value, ... } or {:} for empty map
    literal_map: ($) =>
      choice(
        seq("{", ":", "}"),  // empty map {:}
        seq("{", repeat1(choice(seq($._map_entry, optional(",")), $._newline)), "}"),
      ),

    _map_entry: ($) => seq($._expression, ":", choice($._expression, $._newline)),

    uninitialized_literal: ($) => "?",

    primitive_expression: ($) => seq("#", $._module_path),
  },
});
