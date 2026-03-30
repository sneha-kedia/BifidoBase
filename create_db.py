import pandas as pd
import sqlite3

# Load CSV
df = pd.read_csv("metadata_final.csv")

# Connect DB
conn = sqlite3.connect("your_database.db")

# Write properly
df.to_sql("genomes", conn, if_exists="replace", index=False)

conn.close()

print("Database created successfully!")
