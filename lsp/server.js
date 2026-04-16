const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  DiagnosticSeverity,
  MarkupKind,
  CompletionItemKind,
  SymbolKind,
  StreamMessageReader,
  StreamMessageWriter,
} = require("vscode-languageserver");
const { TextDocument } = require("vscode-languageserver-textdocument");

const connection = createConnection(
  new StreamMessageReader(process.stdin),
  new StreamMessageWriter(process.stdout),
  ProposedFeatures.all
);
const documents = new TextDocuments(TextDocument);

const KEYWORDS = [
  "say", "narrate", "bg", "char", "hide", "bgm", "stop_bgm", "sfx",
  "label", "jump", "call", "include", "end", "menu", "button", "goto",
  "exit", "set", "if", "endif", "fade", "save", "load", "save_menu",
  "load_menu", "ui"
];

const UI_ELEMENTS = ["textbox", "namebox", "button", "font"];
const POSITIONS = ["left", "center", "right"];
const OPERATORS = ["==", "!="];

let parser = null;
let Cereka = null;
let documentCache = new Map();

async function initParser() {
  try {
    const path = require("path");
    const { Parser, Language } = require("web-tree-sitter");
    const wasmRuntimePath = path.join(__dirname, "node_modules/web-tree-sitter/web-tree-sitter.wasm");
    await Parser.init({ locateFile: () => wasmRuntimePath });
    const langWasmPath = path.join(__dirname, "..", "tree-sitter-cereka.wasm");
    const CerekaLang = await Language.load(langWasmPath);
    parser = new Parser();
    parser.setLanguage(CerekaLang);
    connection.console.log("Cereka tree-sitter parser loaded (WASM)");
    // Parser loaded after initial didOpen — re-validate all open documents now
    for (const doc of documents.all()) {
      const tree = parser.parse(doc.getText());
      documentCache.set(doc.uri, tree);
      connection.sendDiagnostics({ uri: doc.uri, diagnostics: validateDocument(doc, tree) });
    }
  } catch (e) {
    connection.console.warn("tree-sitter parser unavailable, diagnostics disabled: " + e.message);
  }
}

function nodeToRange(node) {
  return {
    start: { line: node.startPosition.row, character: node.startPosition.column },
    end: { line: node.endPosition.row, character: node.endPosition.column },
  };
}

function getNodeText(doc, node) {
  return doc.getText(nodeToRange(node));
}

function findLabels(tree, doc) {
  const labels = new Map();
  
  function walk(node) {
    if (node.type === "label_stmt") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        labels.set(getNodeText(doc, nameNode), nameNode);
      }
    }
    for (const child of node.children) {
      walk(child);
    }
  }
  
  walk(tree.rootNode);
  return labels;
}

function findLabelReferences(tree, doc) {
  const refs = new Map();

  function addRef(target, node) {
    if (!refs.has(target)) refs.set(target, []);
    refs.get(target).push(node);
  }

  function walk(node) {
    if (node.type === "jump") {
      const target = node.childForFieldName("target");
      if (target) addRef(getNodeText(doc, target), target);
    } else if (node.type === "button") {
      const target = node.childForFieldName("target");
      if (target) addRef(getNodeText(doc, target), target);
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return refs;
}

function describeMissing(type) {
  switch (type) {
    case "string":       return 'Expected a quoted string, e.g. "Hello world"';
    case "identifier":   return "Expected an identifier (a name like myLabel or flag_met)";
    case "filename":     return "Expected a filename, e.g. backgrounds/forest.png";
    case "number":       return "Expected a number";
    case "position":     return "Expected a position: left, center, or right";
    case "comparison_op": return "Expected a comparison operator: == or !=";
    case "ui_element":   return "Expected a UI element: textbox, namebox, button, or font";
    default:             return `Expected ${type}`;
  }
}

function describeErrorNode(node) {
  const children = node.children;
  const keyword = children.find(c => !c.isNamed)?.type;
  const named = children.filter(c => c.isNamed);
  const namedTypes = named.map(c => c.type);

  switch (keyword) {
    case "say":
      if (named.length === 0)
        return 'say: expected speaker name and text, e.g. say Alice "Hello"';
      if (namedTypes[0] === "string")
        return 'say: expected speaker name before the quoted text, e.g. say Alice "Hello"';
      return 'say: expected quoted text after speaker name, e.g. say Alice "Hello"';

    case "narrate":
      return 'narrate: expected quoted text, e.g. narrate "Once upon a time..."';

    case "bg":
      return "bg: expected a filename, e.g. bg backgrounds/forest.png";

    case "jump":
      return "jump: expected a label name, e.g. jump intro";

    case "char":
      if (named.length === 0)
        return "char: expected id, position and file, e.g. char alice left characters/alice.png";
      if (named.length === 1)
        return "char: expected position (left, center, or right) after character id";
      return "char: expected character image filename after position";

    case "hide":
      return "hide: expected 'char' and a character id, e.g. hide char alice";

    case "bgm":
      return "bgm: expected a music filename, e.g. bgm music/theme.mp3";

    case "sfx":
      return "sfx: expected a sound filename, e.g. sfx sounds/click.wav";

    case "call":
      return "call: expected a script filename, e.g. call scenes/chapter1.crka";

    case "include":
      return "include: expected a script filename, e.g. include ui.crka";

    case "label":
      return "label: expected a name, e.g. label intro";

    case "set":
      if (named.length === 0)
        return "set: expected variable and value, e.g. set flag_met true";
      return "set: expected a value after variable name, e.g. set flag_met true";

    case "if": {
      if (named.length === 0)
        return "if: expected variable == value ... endif";
      if (named.length === 1)
        return "if: expected comparison operator (== or !=) after variable";
      if (named.length >= 2 && !namedTypes.includes("identifier"))
        return "if: expected a value after the comparison operator";
      return "if: missing endif";
    }

    case "menu":
      return "menu: expected at least one button, e.g. button \"Option\" goto label";

    case "button": {
      const hasGoto = children.some(c => c.type === "goto");
      if (named.length === 0)
        return 'button: expected quoted text, e.g. button "Choice" goto label';
      if (hasGoto)
        return "button: expected a label name after goto";
      return 'button: expected goto <label> or exit, e.g. button "Choice" goto intro';
    }

    case "save":
      return "save: expected a slot number, e.g. save 1";

    case "load":
      return "load: expected a slot number, e.g. load 1";

    case "ui":
      return "ui: expected element name (textbox, namebox, button, or font), then properties";

    case "fade":
      return "fade: expected a duration number, e.g. fade 0.5";

    default:
      return "Syntax error";
  }
}

function collectSyntaxErrors(tree) {
  const diagnostics = [];

  function walk(node) {
    if (node.type === "ERROR") {
      diagnostics.push({
        range: nodeToRange(node),
        severity: DiagnosticSeverity.Error,
        message: describeErrorNode(node),
        source: "cereka-lsp",
      });
      return; // don't recurse into ERROR subtrees
    }
    if (node.isMissing) {
      diagnostics.push({
        range: nodeToRange(node),
        severity: DiagnosticSeverity.Error,
        message: describeMissing(node.type),
        source: "cereka-lsp",
      });
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return diagnostics;
}

function checkDuplicateLabels(tree, doc) {
  const diagnostics = [];
  const seen = new Map();

  function walk(node) {
    if (node.type === "label_stmt") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        const name = getNodeText(doc, nameNode);
        if (seen.has(name)) {
          diagnostics.push({
            range: nodeToRange(nameNode),
            severity: DiagnosticSeverity.Error,
            message: `Duplicate label "${name}"`,
            source: "cereka-lsp",
          });
        } else {
          seen.set(name, nameNode);
        }
      }
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return diagnostics;
}

function validateDocument(doc, tree) {
  const diagnostics = [
    ...collectSyntaxErrors(tree),
    ...checkDuplicateLabels(tree, doc),
  ];

  const labels = findLabels(tree, doc);
  for (const [target, refs] of findLabelReferences(tree, doc)) {
    if (!labels.has(target)) {
      for (const ref of refs) {
        diagnostics.push({
          range: nodeToRange(ref),
          severity: DiagnosticSeverity.Error,
          message: `Label "${target}" is not defined`,
          source: "cereka-lsp",
        });
      }
    }
  }

  return diagnostics;
}

documents.onDidChangeContent((change) => {
  if (!parser) return;
  
  const text = change.document.getText();
  const tree = parser.parse(text);
  documentCache.set(change.document.uri, tree);
  
  const diagnostics = validateDocument(change.document, tree);
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});

connection.onInitialize(() => {
  initParser().catch(e => connection.console.warn("Parser init failed: " + e.message));
  
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [" ", '"', "."],
      },
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
    },
  };
});

connection.onHover((params) => {
  if (!parser) return null;
  
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  
  const tree = documentCache.get(doc.uri);
  if (!tree) return null;
  
  const pos = params.position;
  const node = tree.rootNode.descendantForPosition({ row: pos.line, column: pos.character });
  
  const text = getNodeText(doc, node);
  
  if (KEYWORDS.includes(text)) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${text}**\n\nKeyword used in Cereka scripts.`,
      },
    };
  }
  
  if (UI_ELEMENTS.includes(text)) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**UI Element: ${text}**\n\nCustomizable UI component.`,
      },
    };
  }
  
  if (POSITIONS.includes(text)) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**Position: ${text}**\n\nCharacter position on screen.`,
      },
    };
  }
  
  return null;
});

connection.onCompletion((params) => {
  if (!parser) return [];
  
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  
  const pos = params.position;
  const line = doc.getText().split("\n")[pos.line] || "";
  const beforeCursor = line.slice(0, pos.character);
  
  const items = [];
  
  if (beforeCursor.trim() === "") {
    for (const kw of KEYWORDS) {
      items.push({
        label: kw,
        kind: CompletionItemKind.Keyword,
        insertText: kw,
      });
    }
  }
  
  const tree = documentCache.get(doc.uri);
  if (tree) {
    const labels = findLabels(tree, doc);
    for (const [name] of labels) {
      items.push({
        label: name,
        kind: CompletionItemKind.Reference,
        detail: "Label",
      });
    }
  }
  
  for (const el of UI_ELEMENTS) {
    if (el.startsWith(beforeCursor.split(" ").pop() || "")) {
      items.push({
        label: el,
        kind: CompletionItemKind.Enum,
      });
    }
  }
  
  for (const pos of POSITIONS) {
    items.push({
      label: pos,
      kind: CompletionItemKind.Value,
    });
  }
  
  for (const op of OPERATORS) {
    items.push({
      label: op,
      kind: CompletionItemKind.Operator,
    });
  }
  
  return items;
});

connection.onDefinition((params) => {
  if (!parser) return null;
  
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  
  const tree = documentCache.get(doc.uri);
  if (!tree) return null;
  
  const pos = params.position;
  const node = tree.rootNode.descendantForPosition({ row: pos.line, column: pos.character });
  const text = getNodeText(doc, node);
  
  const labels = findLabels(tree, doc);
  if (labels.has(text)) {
    const target = labels.get(text);
    return {
      uri: doc.uri,
      range: nodeToRange(target),
    };
  }
  
  return null;
});

connection.onReferences((params) => {
  if (!parser) return null;
  
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  
  const tree = documentCache.get(doc.uri);
  if (!tree) return null;
  
  const pos = params.position;
  const node = tree.rootNode.descendantForPosition({ row: pos.line, column: pos.character });
  const text = getNodeText(doc, node);
  
  const locations = [];
  
  if (node.parent && node.parent.type === "label_stmt") {
    const labelRefs = findLabelReferences(tree, doc);
    const refs = labelRefs.get(text);
    if (refs) {
      for (const ref of refs) {
        locations.push({
          uri: doc.uri,
          range: nodeToRange(ref),
        });
      }
    }
  }
  
  return locations.length > 0 ? locations : null;
});

connection.onDocumentSymbol((params) => {
  if (!parser) return null;
  
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  
  const tree = documentCache.get(doc.uri);
  if (!tree) return null;
  
  const symbols = [];
  
  function walk(node) {
    if (node.type === "label_stmt") {
      const nameNode = node.childForFieldName("name");
      const name = nameNode ? getNodeText(doc, nameNode) : "unnamed";
      symbols.push({
        name,
        kind: SymbolKind.String,
        range: nodeToRange(node),
        selectionRange: nameNode ? nodeToRange(nameNode) : nodeToRange(node),
      });
    } else if (node.type === "menu") {
      symbols.push({
        name: "menu",
        kind: SymbolKind.Module,
        range: nodeToRange(node),
        selectionRange: nodeToRange(node),
      });
    } else if (node.type === "ui_block") {
      const elementNode = node.childForFieldName("element");
      const name = elementNode ? getNodeText(doc, elementNode) : "ui";
      symbols.push({
        name: `ui ${name}`,
        kind: SymbolKind.Namespace,
        range: nodeToRange(node),
        selectionRange: elementNode ? nodeToRange(elementNode) : nodeToRange(node),
      });
    } else if (node.type === "if_block") {
      symbols.push({
        name: "if block",
        kind: SymbolKind.Function,
        range: nodeToRange(node),
        selectionRange: nodeToRange(node),
      });
    }
    
    for (const child of node.children) {
      walk(child);
    }
  }
  
  walk(tree.rootNode);
  return symbols;
});

documents.listen(connection);
connection.listen();

console.error("Cereka LSP server started");
