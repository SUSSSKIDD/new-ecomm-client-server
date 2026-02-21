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

const dirsToMigrate = ['./src/components/united', './src/views', './src/components/auth'];
const files = [];
dirsToMigrate.forEach(dir => {
    if (fs.existsSync(dir)) files.push(...walkDir(dir));
});

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    if (content.includes('<button') || content.includes('</button>')) {
        let newContent = content.replace(/<button/g, '<RippleButton');
        newContent = newContent.replace(/<\/button>/g, '</RippleButton>');
        
        const depth = file.split(path.sep).length - 3; 
        let prefix = '';
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
console.log('Done replacing buttons');
