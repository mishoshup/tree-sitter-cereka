import XCTest
import SwiftTreeSitter
import TreeSitterCereka

final class TreeSitterCerekaTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_cereka())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Cereka grammar")
    }
}
