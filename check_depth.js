const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const regex = /<\/?div(?:[^>]*)>/gi;
let match;
let stack = [];
while ((match = regex.exec(html)) !== null) {
    const fullTag = match[0];
    const line = html.substring(0, match.index).split('\n').length;
    if (fullTag.toLowerCase().startsWith('<div')) {
        let idMatch = fullTag.match(/id=[\"']([^\"']+)[\"']/);
        let id = idMatch ? idMatch[1] : '';
        stack.push({tag: fullTag, id: id, line: line});
        if (fullTag.includes('class="panel"')) {
            console.log(`Panel ${id} starts at depth ${stack.length}`);
        }
    } else {
        stack.pop();
    }
}
console.log(`Final depth: ${stack.length}`);
