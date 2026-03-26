import fs from 'node:fs';
import path from 'node:path';

const copyFile = (sourcePath, targetPath) => {
  if (!fs.existsSync(sourcePath)) {
    console.error(`Missing source asset: ${sourcePath}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
};

copyFile(
  path.resolve('src/dom/dom_tree/index.js'),
  path.resolve('dist/dom/dom_tree/index.js')
);

const agentSourceDir = path.resolve('src/agent');
const agentTargetDir = path.resolve('dist/agent');
const agentPromptTemplates = fs
  .readdirSync(agentSourceDir)
  .filter((file) => file.endsWith('.md'))
  .sort();

if (agentPromptTemplates.length === 0) {
  console.error(`Missing agent prompt templates in: ${agentSourceDir}`);
  process.exit(1);
}

for (const templateName of agentPromptTemplates) {
  copyFile(
    path.join(agentSourceDir, templateName),
    path.join(agentTargetDir, templateName)
  );
}
