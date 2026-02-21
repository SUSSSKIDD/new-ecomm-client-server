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

const dirsToMigrate = ['./src/components/admin', './src/components/delivery'];
const files = [];
dirsToMigrate.forEach(dir => {
    if (fs.existsSync(dir)) files.push(...walkDir(dir));
});

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    if (content.includes('<button') || content.includes('</button>')) {
        let newContent = content.replace(/<button/g, '<RippleButton');
        newContent = newContent.replace(/<\/button>/g, '</RippleButton>');
        
        let prefix = '../ui/ripple-button'; 
        
        if (!newContent.includes('RippleButton')) return;
        
        if (!newContent.includes('import { RippleButton }')) {
            let importStatement = `import { RippleButton } from '${prefix}';\n`;
            if (newContent.includes('import ')) {
                newContent = newContent.replace(/import /, importStatement + 'import ');
            } else {
                newContent = importStatement + newContent;
            }
        }

        fs.writeFileSync(file, newContent);
        console.log(`Replaced buttons in ${file}`);
    }
});
console.log('Done replacing admin & delivery buttons');
