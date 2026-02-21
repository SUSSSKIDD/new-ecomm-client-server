const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walkDir(file));
        } else { 
            if (file.endsWith('.jsx')) results.push(file);
        }
    });
    return results;
}

const files = [
    ...walkDir('./src/components/united'),
    ...walkDir('./src/views'),
    ...walkDir('./src/components/auth'),
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Only import if we are replacing something
    if (content.includes('<button') || content.includes('</button>')) {
        let newContent = content.replace(/<button/g, '<RippleButton');
        newContent = newContent.replace(/<\/button>/g, '</RippleButton>');
        
        // Add import at the top
        // Find how many levels up to components/ui
        const depth = file.split(path.sep).length - 3; // roughly from src/
        let prefix = depth === 0 ? './components/ui/ripple-button' : 
                     depth === 1 ? '../components/ui/ripple-button' : 
                     depth === 2 ? '../../components/ui/ripple-button' : 
                     depth === 3 ? '../../../components/ui/ripple-button' : '../../components/ui/ripple-button';
                     
        if (file.includes('views/')) {
            prefix = '../components/ui/ripple-button';
        } else if (file.includes('united/profile/')) {
            prefix = '../../../components/ui/ripple-button';
        } else if (file.includes('united/header/')) {
            prefix = '../../../components/ui/ripple-button';
        } else if (file.includes('united/')) {
            prefix = '../../components/ui/ripple-button';
        } else if (file.includes('auth/')) {
            prefix = '../ui/ripple-button';
        }
        
        if (!newContent.includes('RippleButton')) return;
        
        let importStatement = `import { RippleButton } from '${prefix}';\n`;
        
        // Match first import or 'use client';
        if (newContent.includes('import ')) {
            newContent = newContent.replace(/import /, importStatement + 'import ');
        } else {
            newContent = importStatement + newContent;
        }

        fs.writeFileSync(file, newContent);
    }
});
console.log('Done replacing buttons');
