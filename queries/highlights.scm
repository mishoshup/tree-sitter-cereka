
;; =====================
;; Keywords
;; =====================

"say"       @keyword
"narrate"   @keyword
"bg"        @keyword
"char"      @keyword
"hide"      @keyword
"bgm"       @keyword
"stop_bgm"  @keyword
"sfx"       @keyword
"label"     @keyword
"jump"      @keyword
"call"      @keyword
"include"   @keyword
"end"       @keyword
"menu"      @keyword
"button"    @keyword
"goto"      @keyword
"exit"      @keyword
"set"       @keyword
"if"        @keyword
"endif"     @keyword
"fade"      @keyword
"save_menu" @keyword
"load_menu" @keyword
"save"      @keyword
"load"      @keyword
"ui"        @keyword

;; =====================
;; UI elements & positions
;; =====================

(ui_element)  @type
(position)    @constant

;; =====================
;; Operators
;; =====================

(comparison_op) @operator

;; =====================
;; Named fields
;; =====================

; Speaker name in dialogue
(say speaker: (identifier) @variable.special)

; Character IDs
(char_stmt id: (identifier) @variable.special)
(hide_char id: (identifier) @variable.special)

; Labels and jump targets
(label_stmt name: (identifier) @label)
(jump target: (identifier) @label)
(button target: (identifier) @label)

; Variables
(set_stmt variable: (identifier) @variable)
(set_stmt value: (identifier) @string)
(if_block variable: (identifier) @variable)
(if_block value: (identifier) @string)

;; =====================
;; Filenames
;; =====================

(bg_stmt file: (filename)    @string.special)
(menu_bg file: (filename)    @string.special)
(char_stmt file: (filename)  @string.special)
(bgm file: (filename)        @string.special)
(sfx file: (filename)        @string.special)
(call file: (filename)       @string.special)
(include file: (filename)    @string.special)
(ui_property path: (filename) @string.special)

;; =====================
;; Literals
;; =====================

(string)   @string
(number)   @number
(ui_value) @number

;; =====================
;; Comments
;; =====================

(comment) @comment
