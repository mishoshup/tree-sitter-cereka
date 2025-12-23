
;; =====================
;; Statements / Keywords
;; =====================

(say) @keyword
(narrate) @keyword
(jump) @keyword
(label) @keyword
(end) @keyword
(bg) @keyword
(char) @keyword
(menu) @keyword


;; =========
;; Fields
;; =========

(say
  speaker: (identifier) @variable)

(jump
  target: (identifier) @function.call)

(label
  name: (identifier) @label)

(choice
  target: (identifier) @function.call)


;; =========
;; Literals
;; =========

(string) @string
(filename) @string.special
(identifier) @variable
(comment) @comment
