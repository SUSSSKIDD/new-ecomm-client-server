const fs = require('fs');
const file = './src/components/GhostState.jsx';
let content = fs.readFileSync(file, 'utf8');
if (content.includes('<button') || content.includes('</button>')) {
    let newContent = content.replace(/<button/g, '<RippleButton');
    newContent = newContent.replace(/<\/button>/g, '</RippleButton>');
    let importStatement = `import { RippleButton } from './ui/ripple-button';\n`;
    if (newContent.includes('import ')) {
        newContent = newContent.replace(/import /, importStatement + 'import ');
    } else {
        newContent = importStatement + newContent;
    }
    fs.writeFileSync(file, newContent);
    console.log(`Replaced buttons in ${file}`);
}
