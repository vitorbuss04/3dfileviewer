const path = require('path');
const fs = require('fs');

// Resolve sqlite3 from backend/node_modules because execution/ does not have it installed
const sqlite3Path = path.join(__dirname, '..', 'backend', 'node_modules', 'sqlite3');
const sqlite3 = require(sqlite3Path).verbose();

const dbPath = path.join(__dirname, '..', 'backend', 'database.db');
const uploadsDir = path.join(__dirname, '..', 'backend', 'uploads');

async function clearAll() {
  console.log('Starting full database and upload directory cleanup...');

  // 1. Clean upload directory files
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    let deletedFilesCount = 0;
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      try {
        fs.unlinkSync(filePath);
        deletedFilesCount++;
      } catch (err) {
        console.error(`Failed to delete file ${file}:`, err.message);
      }
    }
    console.log(`Successfully deleted ${deletedFilesCount} files from uploads folder.`);
  } else {
    console.log('Uploads directory does not exist, skipping file deletion.');
  }

  // 2. Clear SQLite Database
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      process.exit(1);
    }
  });

  db.serialize(() => {
    // Delete all records
    db.run('DELETE FROM models', function(err) {
      if (err) {
        console.error('Error deleting records from models table:', err.message);
      } else {
        console.log(`Cleared ${this.changes} records from models table.`);
      }
    });

    // Reset autoincrement sequence
    db.run("DELETE FROM sqlite_sequence WHERE name='models'", (err) => {
      if (err) {
        console.error('Error resetting autoincrement sequence:', err.message);
      } else {
        console.log('Autoincrement sequence reset.');
      }
    });
  });

  db.close((err) => {
    if (err) {
      console.error('Error closing database connection:', err.message);
    } else {
      console.log('Database connection closed. Cleanup complete!');
    }
    process.exit(0);
  });
}

clearAll();
