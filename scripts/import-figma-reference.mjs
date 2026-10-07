import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import postcss from 'postcss';

// Mechanical import of the user-supplied React export; never executes the archive.
const sourceDir = process.argv[2];
if (!sourceDir) throw new Error('Pass the extracted Figma src directory');
const target = path.resolve('apps/web/src/design');
fs.mkdirSync(target, { recursive: true });
const raw = fs.readFileSync(path.join(sourceDir, 'App.tsx'), 'utf8');
const source = ts.createSourceFile('Reference.tsx', raw, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const parts = [];
for (const node of source.statements) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'App') continue;
  const text = node.getText(source);
  parts.push(ts.isImportDeclaration(node) ? text : `export ${text}`);
}
fs.writeFileSync(path.join(target, 'Reference.tsx'), parts.join('\n\n') + '\n');
fs.copyFileSync(path.join(sourceDir, 'index.css'), path.join(target, 'reference.css'));

// Keep older business screens available without allowing their global CSS into Figma views.
const legacyFiles = ['node_modules/bootstrap/dist/css/bootstrap.min.css', 'apps/web/src/styles.css', 'apps/web/src/theme.css', 'apps/web/src/figma-final.css'];
const scoped = legacyFiles.map(file => {
  const root = postcss.parse(fs.readFileSync(file, 'utf8'));
  root.walkAtRules('import', rule => rule.remove());
  root.walkRules(rule => {
    let parent = rule.parent;
    while (parent) { if (parent.type === 'atrule' && /keyframes$/.test(parent.name)) return; parent = parent.parent; }
    rule.selectors = rule.selectors.map(selector => {
      if (selector.includes(':root')) return selector.replaceAll(':root', '.legacy-ui');
      if (/^(html|body)(?=[\s.:#\[]|$)/.test(selector)) return selector.replace(/^(html|body)/, '.legacy-ui');
      return `.legacy-ui ${selector}`;
    });
  });
  return root.toString();
});
fs.writeFileSync(path.join(target, 'legacy-scoped.css'), scoped.join('\n'));
