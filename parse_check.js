const Parser = require('tree-sitter');
const Toit = require('./bindings/node');
const parser = new Parser();
parser.setLanguage(Toit);
const fs = require('fs');
const src = fs.readFileSync('thpv.toit', 'utf8');
const tree = parser.parse(src);
console.log("Has error:", tree.rootNode.hasError());
if (tree.rootNode.hasError()) {
    console.log(tree.rootNode.toString());
} else {
    console.log("Parse succeeded with NO errors.");
}
