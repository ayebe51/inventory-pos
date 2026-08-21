const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'frontend/src/features'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const regex = /color:\s*'#(E2E8F0|64748B)'\s*,?\s*/g;
  if (regex.test(content)) {
    const newContent = content.replace(regex, '');
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Fixed colors in ${path.basename(file)}`);
  }
});
