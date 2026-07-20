const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.db');

// Ensure SQLite database exists or create it
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    createTables();
  }
});

// Helper functions wrapper for Promises
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Create schema
async function createTables() {
  const createModelsTableSql = `
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      imagepath TEXT,
      folder TEXT NOT NULL DEFAULT 'Geral',
      size INTEGER NOT NULL,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await run(createModelsTableSql);
    console.log('Models table verified/created.');
    
    // Self-healing migration for existing databases
    try {
      await run('ALTER TABLE models ADD COLUMN imagepath TEXT;');
      console.log('Database migrated: added imagepath column.');
    } catch (migrateErr) {
      // Column probably already exists, ignore
    }
  } catch (error) {
    console.error('Error creating models table:', error);
  }
}

// Model Database Services
const dbServices = {
  getAllModels: async () => {
    return await all('SELECT * FROM models ORDER BY upload_date DESC');
  },
  
  getModelById: async (id) => {
    return await get('SELECT * FROM models WHERE id = ?', [id]);
  },
  
  insertModel: async (name, filename, filepath, folder, size, imagepath = null) => {
    // Normalise folder name (trim and default to 'Geral')
    const formattedFolder = folder && folder.trim() !== '' ? folder.trim() : 'Geral';
    const sql = `
      INSERT INTO models (name, filename, filepath, imagepath, folder, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await run(sql, [name, filename, filepath, imagepath, formattedFolder, size]);
    return { id: result.id, name, filename, filepath, imagepath, folder: formattedFolder, size };
  },
  
  deleteModel: async (id) => {
    return await run('DELETE FROM models WHERE id = ?', [id]);
  },
  
  updateModelImage: async (id, imagepath) => {
    return await run('UPDATE models SET imagepath = ? WHERE id = ?', [imagepath, id]);
  }
};

module.exports = dbServices;
