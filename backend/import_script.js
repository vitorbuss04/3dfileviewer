const path = require('path');
const fs = require('fs');
const dbServices = require('./database');

const sourceDir = `c:\\Users\\augus\\Downloads\\drive-download-20260720T122600Z-1-002`;
const uploadsDir = path.join(__dirname, 'uploads');

// Ensure uploads folder exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDir(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.stl' || ext === '.3mf') {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

async function runImport() {
  console.log(`Scanning source directory: ${sourceDir}`);
  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory does not exist: ${sourceDir}`);
    process.exit(1);
  }

  const modelFiles = scanDir(sourceDir);
  console.log(`Found ${modelFiles.length} 3D model files (.stl, .3mf).`);

  for (const srcPath of modelFiles) {
    try {
      const stat = fs.statSync(srcPath);
      const originalName = path.basename(srcPath);
      const ext = path.extname(originalName).toLowerCase();
      
      // Determine folder name (relative to sourceDir)
      const relativePath = path.relative(sourceDir, srcPath);
      const parts = relativePath.split(path.sep);
      const folderName = parts.length > 1 ? parts[0] : 'Geral';

      // Model display name (friendly name: filename without extension, replace underscores/hyphens with spaces)
      const baseName = path.basename(originalName, ext);
      const displayName = baseName
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Generate unique name for uploads folder
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const uniqueFilename = `file-${uniqueSuffix}${ext}`;
      const destPath = path.join(uploadsDir, uniqueFilename);

      // Copy file
      fs.copyFileSync(srcPath, destPath);

      // Insert into DB
      const filepath = `/api/uploads/${uniqueFilename}`;
      await dbServices.insertModel(
        displayName,
        uniqueFilename,
        filepath,
        folderName,
        stat.size,
        null // imagepath starts as null (frontend will auto-generate)
      );

      console.log(`Imported: "${displayName}" -> Category: "${folderName}" (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (err) {
      console.error(`Failed to import file ${srcPath}:`, err.message);
    }
  }

  console.log('Batch import complete!');
  process.exit(0);
}

runImport();
