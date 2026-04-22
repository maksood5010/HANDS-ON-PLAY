import pool from "../config/db.js";

async function createPlaylistTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create playlists table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log("Playlists table created successfully!");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlists_company_id ON playlists(company_id);
    `);

    // Create files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100),
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log("Files table created successfully!");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_files_company_id ON files(company_id);
    `);

    // Create playlist_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        playlist_id INTEGER NOT NULL,
        file_id INTEGER NOT NULL,
        duration INTEGER DEFAULT 5,
        display_order INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
        UNIQUE(playlist_id, display_order)
      );
    `);
    console.log("Playlist items table created successfully!");

    // Create index for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_items_company_id ON playlist_items(company_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_items_display_order ON playlist_items(playlist_id, display_order);
    `);
    console.log("Indexes created successfully!");

  } catch (error) {
    console.error("Error creating playlist tables:", error);
  } finally {
    await pool.end();
  }
}

createPlaylistTables();

