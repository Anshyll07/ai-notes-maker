"""
Simple migration script to add summary and summary_status columns to attachment table
"""
import sqlite3
import os

# Path to your database
db_path = 'instance/app.db'

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(attachment)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'summary' not in columns:
        print("Adding 'summary' column...")
        cursor.execute("ALTER TABLE attachment ADD COLUMN summary TEXT")
        print("✓ Added 'summary' column")
    else:
        print("'summary' column already exists")
    
    if 'summary_status' not in columns:
        print("Adding 'summary_status' column...")
        cursor.execute("ALTER TABLE attachment ADD COLUMN summary_status VARCHAR(20) DEFAULT 'pending'")
        print("✓ Added 'summary_status' column")
    else:
        print("'summary_status' column already exists")
    
    conn.commit()
    print("\n✓ Migration completed successfully!")
    
except Exception as e:
    print(f"Error during migration: {e}")
    conn.rollback()
finally:
    conn.close()
