/**
 * @file Script language for Cereka, a visual novel engine written in C++
 * @author Danial Haikal <danialhaikalsanusi@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "cereka",

  extras: ($) => [/\s+/, $.comment],

  rules: {
    source_file: ($) => repeat($.statement),

    statement: ($) =>
      choice(
        $.say,
        $.narrate,
        $.bg_stmt,
        $.char_stmt,
        $.hide_char,
        $.bgm,
        $.stop_bgm,
        $.sfx,
        $.label_stmt,
        $.jump,
        $.call,
        $.include,
        $.end,
        $.menu,
        $.set_stmt,
        $.arithmetic_stmt,
        $.if_block,
        $.save_menu,
        $.load_menu,
        $.save_stmt,
        $.load_stmt,
        $.ui_block,
      ),

    // ── Dialogue ────────────────────────────────────────────────────────────
    say: ($) =>
      seq("say", field("speaker", $.identifier), field("text", $.string)),

    narrate: ($) => seq("narrate", field("text", $.string)),

    // ── Background ──────────────────────────────────────────────────────────
    bg_stmt: ($) =>
      seq(
        "bg",
        field("file", $.filename),
        optional(seq("fade", field("duration", $.number))),
      ),

    // ── Characters ──────────────────────────────────────────────────────────
    char_stmt: ($) =>
      seq(
        "char",
        field("id", $.identifier),
        field("position", $.position),
        field("file", $.filename),
      ),

    position: (_) => choice("left", "center", "right"),

    hide_char: ($) => seq("hide", "char", field("id", $.identifier)),

    // ── Audio ────────────────────────────────────────────────────────────────
    bgm: ($) => seq("bgm", field("file", $.filename)),
    stop_bgm: (_) => "stop_bgm",
    sfx: ($) => seq("sfx", field("file", $.filename)),

    // ── Flow control ─────────────────────────────────────────────────────────
    label_stmt: ($) => seq("label", field("name", $.identifier)),
    jump: ($) => seq("jump", field("target", $.identifier)),
    call: ($) => seq("call", field("file", $.filename)),
    include: ($) => seq("include", field("file", $.filename)),
    end: (_) => "end",

    // ── Menu / choices ───────────────────────────────────────────────────────
    // Syntax:
    //   menu
    //       bg backdrop.png [fade 0.5]   ; optional
    //       button "Option" goto label
    //       button "Quit"   exit
    menu: ($) => seq("menu", optional($.menu_bg), repeat1($.button)),

    menu_bg: ($) =>
      seq(
        "bg",
        field("file", $.filename),
        optional(seq("fade", field("duration", $.number))),
      ),

    button: ($) =>
      seq(
        "button",
        field("text", $.string),
        choice(seq("goto", field("target", $.identifier)), "exit"),
      ),

    // ── Variables ────────────────────────────────────────────────────────────
    set_stmt: ($) =>
      seq(
        "set",
        field("variable", $.identifier),
        field("value", $.value),
      ),

    // Arithmetic: $ var += value, $ var -= value, $ var *= value, $ var /= value, $ var = expr
    arithmetic_stmt: ($) =>
      choice(
        // Compound assignment: $ var += value (etc)
        seq(
          "$",
          field("variable", $.identifier),
          field("op", $.arithmetic_op),
          "=",
          field("value", $.value),
        ),
        // Direct assignment: $ var = expr (defaults to +=)
        seq(
          "$",
          field("variable", $.identifier),
          "=",
          field("value", $.expr),
        ),
      ),

    arithmetic_op: (_) => choice("+", "-", "*", "/"),

    // Expression: supports simple binary expressions like "gold * 2"
    expr: ($) => choice($.value, $.binary_expr),

    binary_expr: ($) =>
      seq(
        field("left", $.value),
        field("op", $.arithmetic_op),
        field("right", $.value),
      ),

    // ── Conditionals ─────────────────────────────────────────────────────────
    if_block: ($) =>
      seq(
        "if",
        field("variable", $.identifier),
        field("op", $.comparison_op),
        field("value", $.value),
        repeat($.statement),
        "endif",
      ),

    comparison_op: (_) => choice("==", "!=", ">", "<", ">=", "<="),

    // value can be identifier, number, or string
    value: ($) => choice($.identifier, $.number, $.string),

    // ── Save / load ──────────────────────────────────────────────────────────
    save_menu: (_) => "save_menu",
    load_menu: (_) => "load_menu",
    save_stmt: ($) => seq("save", field("slot", $.number)),
    load_stmt: ($) => seq("load", field("slot", $.number)),

    // ── UI theming ────────────────────────────────────────────────────────────
    // Syntax:
    //   ui textbox
    //       color 0 0 0 160
    //       y 75%
    //       h 25%
    //       text_margin_x 80
    //       text_color 255 255 255 255
    //       image assets/ui/textbox.png
    ui_block: ($) =>
      seq("ui", field("element", $.ui_element), repeat1($.ui_property)),

    ui_element: (_) => choice("textbox", "namebox", "button", "font"),

    ui_property: ($) =>
      choice(
        seq("color", $.number, $.number, $.number, $.number),
        seq("text_color", $.number, $.number, $.number, $.number),
        seq("y", field("value", $.ui_value)),
        seq("h", field("value", $.ui_value)),
        seq("x", field("value", $.ui_value)),
        seq("w", field("value", $.ui_value)),
        seq("y_offset", field("value", $.number)),
        seq("text_margin_x", field("value", $.number)),
        seq("image", field("path", $.filename)),
        seq("hover_image", field("path", $.filename)),
        seq("size", field("value", $.number)),
      ),

    // percent (75%) or plain pixels (540)
    ui_value: (_) => /\d+(\.\d+)?%?/,

    // ── Terminals ────────────────────────────────────────────────────────────
    identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    // filenames: letters/digits/underscore + dots, slashes, hyphens
    filename: (_) => /[a-zA-Z0-9_][a-zA-Z0-9_.\/-]*/,

    string: (_) => /"[^"]*"/,

    number: (_) => /-?\d+(\.\d+)?/,

    // comments start with ; in .crka files
    comment: (_) => token(seq(";", /.*/)),
  },
});
