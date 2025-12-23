package tree_sitter_cereka_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_cereka "github.com/mishoshup/tree-sitter-cereka.git/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_cereka.Language())
	if language == nil {
		t.Errorf("Error loading Cereka grammar")
	}
}
