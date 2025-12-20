import { Pool } from "pg";

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Function to clear and reset the database
async function resetDatabase(): Promise<boolean> {
  try {
    
    // Delete tables in reverse order of creation (to avoid foreign key constraints)
    await pool.query("DROP TABLE IF EXISTS documents CASCADE");
    await pool.query("DROP TABLE IF EXISTS users CASCADE");

    // Delete functions if they exist
    await pool.query("DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE");
    await pool.query("DROP FUNCTION IF EXISTS update_users_updated_at_column() CASCADE");
    await pool.query("DROP FUNCTION IF EXISTS update_documents_updated_at_column() CASCADE");

    // Recreate tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);


    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL DEFAULT '',
        tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC)"
    );

    // Create automatic update function for users
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_users_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Create automatic update function for documents
    // Do not update updated_at if only the is_favorite field has been modified
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_documents_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Do not update updated_at if only the is_favorite field has changed
        IF (OLD.is_favorite IS DISTINCT FROM NEW.is_favorite) AND
           (OLD.title IS NOT DISTINCT FROM NEW.title) AND
           (OLD.content IS NOT DISTINCT FROM NEW.content) AND
           (OLD.tags IS NOT DISTINCT FROM NEW.tags) AND
           (OLD.user_id IS NOT DISTINCT FROM NEW.user_id) THEN
          -- Only is_favorite has changed, preserve updated_at
          NEW.updated_at = OLD.updated_at;
        ELSE
          -- Other fields have changed, update updated_at
          NEW.updated_at = CURRENT_TIMESTAMP;
        END IF;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Create triggers
    await pool.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_users_updated_at_column()
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
      CREATE TRIGGER update_documents_updated_at
        BEFORE UPDATE ON documents
        FOR EACH ROW
        EXECUTE FUNCTION update_documents_updated_at_column()
    `);

    return true;
  } catch (error) {
    console.error("❌ Reset error:", error);
    return false;
  }
}

// Function to update triggers without resetting the database
async function updateTriggers(): Promise<boolean> {
  try {
    // Create automatic update function for users
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_users_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Create automatic update function for documents
    // Do not update updated_at if only the is_favorite field has been modified
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_documents_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Do not update updated_at if only the is_favorite field has changed
        IF (OLD.is_favorite IS DISTINCT FROM NEW.is_favorite) AND
           (OLD.title IS NOT DISTINCT FROM NEW.title) AND
           (OLD.content IS NOT DISTINCT FROM NEW.content) AND
           (OLD.tags IS NOT DISTINCT FROM NEW.tags) AND
           (OLD.user_id IS NOT DISTINCT FROM NEW.user_id) THEN
          -- Only is_favorite has changed, preserve updated_at
          NEW.updated_at = OLD.updated_at;
        ELSE
          -- Other fields have changed, update updated_at
          NEW.updated_at = CURRENT_TIMESTAMP;
        END IF;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Update trigger for users
    await pool.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_users_updated_at_column()
    `);

    // Update trigger for documents
    await pool.query(`
      DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
      CREATE TRIGGER update_documents_updated_at
        BEFORE UPDATE ON documents
        FOR EACH ROW
        EXECUTE FUNCTION update_documents_updated_at_column()
    `);

    console.log("✅ Triggers updated successfully");
    return true;
  } catch (error) {
    console.error("❌ Error while updating triggers:", error);
    return false;
  }
}

export { resetDatabase, updateTriggers };

