import pandas as pd
from supabase import create_client

SUPABASE_URL = "https://rhbcztpxudkgyrqmzjir.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYmN6dHB4dWRrZ3lycW16amlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk0ODI4OCwiZXhwIjoyMDkwNTI0Mjg4fQ.wauyln8-hFUbr4dNw8CYwVMadUL9i1iXiS0myPnZ-AU"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

df = pd.read_csv("../data/final_master_clean.csv")
# keep only metadata
df = df[["biosample", "country_final", "source_final", "host_final"]]

# 🔥 FORCE REMOVE ALL NaN / invalid values
df = df.fillna("unknown")

# also clean weird strings
for col in ["country_final", "source_final", "host_final"]:
    df[col] = df[col].replace(["nan", "None", None], "unknown")


# remove duplicates
df = df.drop_duplicates(subset=["biosample"])

records = df.to_dict(orient="records")

batch_size = 500

for i in range(0, len(records), batch_size):
    batch = records[i:i+batch_size]
    supabase.table("biosamples").upsert(batch).execute()
    print(f"Uploaded {i + len(batch)} / {len(records)}")

print("✅ DONE")
