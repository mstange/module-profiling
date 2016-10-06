var fs = require('fs');
var getStdin = require('get-stdin');
var asciitree = require('ascii-tree');
var AsciiTable = require('ascii-table')

function parse(str) {
  var lines = str.split('\n');
  var root = { children: [] };
  var stack = [root];
  var parent = root;
  var nodesPerLabel = {};
  for (line of lines) {
    line = line.trim();
    var match = line.match(/ begin (.*)$/);
    if (match) {
      var node = { children: [] };
      parent.children.push(node);
      stack.push(node);
      parent = node;
      continue;
    }
    match = line.match(/ end (.*) (.*)$/);
    if (match) {
      parent.timings = {
        label: match[1].trim(),
        subtree: match[2] * 1
      };
      parent.timings.self = parent.timings.subtree - parent.children.reduce((s, e) => s + e.timings.subtree, 0);
      if (!(parent.timings.label in nodesPerLabel)) {
        nodesPerLabel[parent.timings.label] = [];
      }
      nodesPerLabel[parent.timings.label].push(parent);
      stack.pop();
      parent = stack[stack.length - 1];
    }
  }
  root.timings = {
    label: 'total',
    subtree: root.children.reduce((s, e) => s + e.timings.subtree, 0),
    self: 0,
  };
  return { root, nodesPerLabel };
}

function toAsciiInput(treeRoots) {
  function oneLine(timings, indent) {
    return '#'.repeat(indent) + timings.subtree.toFixed(2) + 'ms ' + timings.self.toFixed(2) + 'ms ' + timings.label + '\r\n';
  }
  function forSubtree(subtreeRoot, children, indent) {
    return oneLine(subtreeRoot, indent) +
      children.map(child => forSubtree(child.timings, child.children, indent + 1)).join('');
  }
  return treeRoots.map(root => forSubtree(root.timings, root.children, 1)).join('');
}

function generateTable(nodesPerLabel) {
  var rows = [];
  for (label in nodesPerLabel) {
    var nodes = nodesPerLabel[label];
    var selfTimeSum = nodes.reduce((sum, node) => sum + node.timings.self, 0);
    var subtreeTimeSum = nodes.reduce((sum, node) => sum + node.timings.subtree, 0);
    rows.push({
      count: nodes.length,
      subtreeTimeSum,
      selfTimeSum,
      avgSelfTime: selfTimeSum / nodes.length,
      avgSubtreeTime: subtreeTimeSum / nodes.length,
      label,
    });
  }
  return rows;
}

function generateAsciiTable(selfTable) {
  var table = new AsciiTable({ heading: [ '#', 'total', 'avg', 'total self', 'avg self', '' ], rows: []});
  table.removeBorder();
  for (row of selfTable) {
    table.addRow(row.count, row.subtreeTimeSum.toFixed(2) + 'ms', row.avgSubtreeTime.toFixed(2) + 'ms', row.selfTimeSum.toFixed(2) + 'ms', row.avgSelfTime.toFixed(2) + 'ms', row.label);
  }
  return table.toString().split('\n').map(s => s.trimRight()).join('\n');
}

function firstEvaluationSum(nodesPerLabel) {
  var sum = 0;
  for (label in nodesPerLabel) {
    var nodes = nodesPerLabel[label];
    sum += nodes[0].timings.self;
  }
  return sum;
}

function main(str) {
  var { root: tree, nodesPerLabel } = parse(str);
  console.log('Full require() / Cu.import timeline:');
  console.log('  (The first number is the time it takes to evaluate the file including everything that happens');
  console.log('  inside it, and the second number is the "self" time, i.e. excluding the evaluation time of');
  console.log('  files that get included by this file.)');
  console.log('');
  console.log(asciitree.generate(toAsciiInput([tree])));
  console.log('');
  console.log('');
  var table = generateTable(nodesPerLabel);
  console.log('Evaluation times per file, sorted by total self time:');
  console.log('');
  table.sort((a, b) => b.selfTimeSum - a.selfTimeSum);
  console.log(generateAsciiTable(table));
  console.log('');
  console.log('');
  console.log('Evaluation times per file, sorted by average inclusive time [avg]:');
  console.log('');
  table.sort((a, b) => b.avgSubtreeTime - a.avgSubtreeTime);
  console.log(generateAsciiTable(table));

  console.log('');
  var totalSelfTime = table.reduce((sum, row) => sum + row.selfTimeSum, 0);
  var totalFirstSelfTime = firstEvaluationSum(nodesPerLabel);
  console.log('total time spent in require() / Cu.import calls: ' + totalSelfTime.toFixed(2) + 'ms');
  console.log('total time spent in the first evaluation of each file: ' + totalFirstSelfTime.toFixed(2) + 'ms');
  console.log('optimal time savings if every file were only evaluated once: ' + totalSelfTime.toFixed(2) + 'ms - ' + totalFirstSelfTime.toFixed(2) + 'ms = ' + (totalSelfTime - totalFirstSelfTime).toFixed(2) + 'ms');
}

if (process.argv.length < 3) {
  console.log('pass filename or - to read from stdin');
  process.exit();
}

if (process.argv[2] == '-') {
  getStdin().then(main);
} else {
  main(fs.readFileSync(process.argv[2], 'utf8'));
}
