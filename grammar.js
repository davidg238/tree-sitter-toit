module.exports = grammar({
  name: "toit",
  externals: ($) => [$._indent, $._dedent, $._newline, $._error_sentinel],
  extras: ($) => [/[ \t\f\r\v\uFEFF\u2060\u200B]/, $.comment],
  word: ($) => $.identifier,
  conflicts: ($) => [
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
      ),

    import_statement: ($) =>
      seq(
        "import",
        optional("."),
        field("path", $._module_path),
        optional(seq("as", field("alias", $.identifier))),
        optional(seq("show", repeat1($.identifier))),
        $._newline,
      ),

    _module_path: ($) => seq($.identifier, repeat(seq(".", $.identifier))),

    export_declaration: ($) =>
      prec.left(seq(
        "export",
        repeat1(choice($.identifier, "*")),
        optional($._newline)
      )),

    class_definition: ($) =>
      seq(
        "class",
        $.identifier,
        optional(seq("extends", $.identifier)),
        ":",
        $._indent,
        repeat1($._statement),
        $._dedent,
      ),

    function_definition: ($) =>
      prec(
        12,
        seq(
          $.identifier,
          repeat($.parameter),
          optional(seq("->", choice($.identifier, $._primary_expression))),
          ":",
          choice(
            seq($._indent, repeat1($._statement), $._dedent),
            $._statement,
          ),
        ),
      ),

    parameter: ($) =>
      seq($.identifier, optional(seq("/", field("type", $.identifier)))),

    _statement: ($) =>
      choice(
        $.if_statement,
        $.while_statement,
        $.for_statement,
        prec(12, $.function_definition),
        seq(
          choice(
            prec(15, $.field_declaration),
            prec(14, $.variable_declaration),
            prec(13, $.assignment),
            $.return_statement,
            $.function_call,
            $.block_function_call,
          ),
          $._newline,
        ),
      ),

    field_declaration: ($) =>
      prec(
        15,
        seq(
          $.identifier,
          "/",
          field("type", $.identifier),
          optional(seq($._assign_op, $._expression)),
        ),
      ),

    variable_declaration: ($) =>
      seq(
        field(
          "left",
          choice($.identifier, $.member_access, $.parenthesized_expression),
        ),
        alias(choice(":=", "::="), $.operator),
        field("right", choice($._expression, $.block_function_call)),
      ),

    assignment: ($) =>
      prec.left(
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
              "<<=",
              ">>=",
              "&=",
              "|=",
              "^=",
              "<<=",
            ),
            $.operator,
          ),
          field("right", choice($._expression, $.block_function_call)),
        ),
      ),

    return_statement: ($) => seq("return", optional(choice($._expression, $.block_function_call))),

    if_statement: ($) =>
      prec.right(
        5,
        seq(
          "if",
          field("condition", $._expression),
          prec(10, ":"),
          choice(
            seq($._indent, repeat1($._statement), $._dedent),
            $._statement,
          ),
          optional(
            seq(
              "else",
              prec(10, ":"),
              choice(
                seq($._indent, repeat1($._statement), $._dedent),
                $._statement,
              ),
            ),
          ),
        ),
      ),

    while_statement: ($) =>
      prec(
        5,
        seq(
          "while",
          $._expression,
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
          optional(choice($.assignment, $.function_call)),
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
            repeat1(choice($._primary_expression, $.named_argument)),
            seq(
              $._indent,
              repeat1(choice($._primary_expression, $.named_argument, $._newline)),
              $._dedent,
            )
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
                repeat1(choice($._primary_expression, $.named_argument, $._newline)),
                $._dedent,
              )
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
      prec.right(5, seq("--", field("name", $.identifier), optional(seq("=", $._expression)))),

    double_colon_block: ($) => seq($._double_colon, $._expression),

    _expression: ($) =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $._primary_expression,
        $.function_call,
      ),

    _primary_expression: ($) =>
      choice(
        prec(2, $.identifier),
        $.number,
        $.string,
        $.member_access,
        $.subscript_expression,
        $.parenthesized_expression,
        $.interpolation,
      ),

    member_access: ($) =>
      prec(
        20,
        seq(
          choice($.identifier, $.parenthesized_expression, $.member_access),
          ".",
          $.identifier,
        ),
      ),
    subscript_expression: ($) =>
      prec(
        19,
        seq(
          choice($.identifier, $.member_access, $.parenthesized_expression),
          "[",
          $._expression,
          "]",
        ),
      ),

    block: ($) =>
      prec(
        1,
        seq(
          ":",
          choice(
            prec.dynamic(1, $._expression),
            seq($._indent, repeat1($._statement), $._dedent),
          ),
        ),
      ),

    parenthesized_expression: ($) => seq("(", choice($._expression, $.block_function_call), ")"),

    binary_expression: ($) => {
      const table = [
        [prec.left, 1, choice("or", "||")],
        [prec.left, 2, choice("and", "&&")],
        [prec.left, 3, choice("==", "!=", ">=", "<=", ">", "<")],
        [prec.left, 4, choice("|", "&", "^", "<<", ">>")],
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
      prec(8, seq(choice("-", "not", "!"), $._expression)),

    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_-]*/,
    number: ($) =>
      token(
        choice(
          /-?\d[\d_]*\.?[\d_]*([eE][+-]?[\d_]+)?/,
          /0x[0-9a-fA-F_]+/,
          /0b[01_]+/,
        ),
      ),

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

    escape_sequence: ($) => token.immediate(seq("\\", /./)),

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
        token(seq("//", /.*/)),
        token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
      ),

    _assign_op: ($) => choice(":=", "::="),
    _double_colon: ($) => "::",
  },
});
