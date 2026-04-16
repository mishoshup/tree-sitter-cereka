; Labels for go-to-definition
(label_stmt name: (identifier) @definition.label)

; Variable definitions
(set_stmt variable: (identifier) @definition.variable)

; Character definitions
(char_stmt id: (identifier) @definition.character)

; References to labels (jumps, buttons)
(jump target: (identifier) @reference.label)
(button (identifier) @reference.label)

; References to variables
(set_stmt value: (value) @reference.variable)
(arithmetic_stmt variable: (identifier) @reference.variable)
(arithmetic_stmt value: (value) @reference.variable)
(if_block variable: (identifier) @reference.variable)
(if_block value: (value) @reference.variable)

; File references
(call file: (filename) @reference.file)
(include file: (filename) @reference.file)
(bgm file: (filename) @reference.file)
(sfx file: (filename) @reference.file)
(bg_stmt file: (filename) @reference.file)
(menu_bg file: (filename) @reference.file)
(char_stmt file: (filename) @reference.file)
(ui_property path: (filename) @reference.file)
