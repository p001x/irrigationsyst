const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const regex = /<\/?div(?:[^>]*)>/gi;
let match;
let stack = [];

while ((match = regex.exec(html)) !== null) {
    const fullTag = match[0];
    const index = match.index;
    const line = html.substring(0, index).split('\n').length;

    if (fullTag.toLowerCase().startsWith('<div')) {
        let idMatch = fullTag.match(/id=[\"']([^\"']+)[\"']/);
        let id = idMatch ? idMatch[1] : '';
        let classMatch = fullTag.match(/class=[\"']([^\"']+)[\"']/);
        let cls = classMatch ? classMatch[1] : '';
        stack.push({tag: fullTag, id: id, cls: cls, line: line});
    } else if (fullTag.toLowerCase().startsWith('</div')) {
        if (stack.length > 0) {
            stack.pop();
        } else {
            console.log('Unmatched closing tag at line ' + line + ': ' + fullTag);
        }
    }
}

if (stack.length > 0) {
    console.log('Unclosed tags remaining:');
    stack.forEach(s => console.log('Line ' + s.line + ' | id: ' + s.id + ' | class: ' + s.cls));
} else {
    console.log('All tags perfectly balanced.');
}
