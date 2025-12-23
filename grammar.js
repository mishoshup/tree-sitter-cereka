/**
 * @file Script language for Cereka, a simple visual novel engine written in C++
 * @author Danial Haikal <danialhaikalsanusi@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "cereka",

  extras: ($) => [/\s/, $.comment],

  rules: {
    source_file: ($) => repeat($.statement),

    statement: ($) =>
      choice($.say, $.narrate, $.jump, $.label, $.end, $.bg, $.char, $.menu),

    say: ($) =>
      seq("say", field("speaker", $.identifier), field("text", $.string)),
    narrate: ($) => seq("narrate", field("text", $.string)),
    jump: ($) => seq("jump", field("target", $.identifier)),
    label: ($) => seq("label", field("name", $.identifier)),
    end: ($) => "end",
    bg: ($) => seq("bg", field("file", $.filename)),

    char: ($) =>
      seq(
        "char",
        field("name", $.identifier), // Alice
        field("pose", $.filename), // Alice_normal.png
      ),
    // -------------------------------------------

    menu: ($) => seq("menu", "{", repeat1($.choice), "}"),
    choice: ($) =>
      seq(field("text", $.string), "->", field("target", $.identifier)),

    // normal identifiers
    identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    // filenames: allow dots inside
    filename: (_) => /[a-zA-Z_][a-zA-Z0-9_.]+/,

    string: (_) => /"[^"]*"/,
    comment: (_) => token(seq("#", /.*/)),
  },
});
