from flask import Flask, render_template, request, jsonify, Response

app = Flask(__name__)
import os
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
import sqlite3

def get_db_connection():
    db_path = os.path.join(BASE_DIR, "your_database.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn
def load_data():
    csv_path = os.path.join(BASE_DIR, "metadata_final.csv")
    print("Loading from:", csv_path)   # ✅ FIXED
    df = pd.read_csv(csv_path)
    print("Shape:", df.shape)
    df["assembly_type"] = df["assembly_accession"].apply(
    lambda x: "RefSeq" if str(x).startswith("GCF") else "GenBank"
    ) 
    return df.fillna("unknown")   

# 🔥 FIX SPECIES (VERY IMPORTANT)
import re

def extract_species(x):
    if pd.isna(x):
        return "unknown"
    x = str(x)
    match = re.match(r"(Bifidobacterium\s+\w+)", x)
    if match:
        return match.group(1)
    return x


# ==============================
# HOME
# ==============================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/search-page")
def search_page():
    return render_template("search.html")

@app.route("/compare-page")
def compare_page():
    return render_template("compare.html")   # make sure this file exists


@app.route("/annotation")
def annotation_page():
    return render_template("annotation.html")  
# ==============================
# SEARCH
# ==============================
@app.route("/search")
def search():

    query = request.args.get("query", "").lower()
    source = request.args.get("source", "")
    country = request.args.get("country", "")
    assembly = request.args.get("assembly_type", "")
    sort = request.args.get("sort", "")
    assembly_level = request.args.get("assembly_level", "")
    page = int(request.args.get("page", 1))
    per_page = 50

    df = load_data()
    results = df.copy()

    # SEARCH (FIXED)
    if query:
        results = results[
    results["species_final"].str.lower().str.contains(query, na=False) |
    results["assembly_accession"].str.lower().str.contains(query, na=False)
]
    # FILTERS
    if source:
        results = results[results["source_final"] == source]   # 👈 better for UI

    if country:
        results = results[results["country_final"] == country]

    if assembly.lower() == "refseq":
        results = results[results["assembly_accession"].str.startswith("GCF")]
    elif assembly.lower() == "genbank":
        results = results[results["assembly_accession"].str.startswith("GCA")]

    if assembly_level:
        results = results[results["assembly_level"] == assembly_level]
    # SORT
    if sort == "genome_size_asc":
        results = results.sort_values("genome_size")
    elif sort == "genome_size_desc":
        results = results.sort_values("genome_size", ascending=False)
    elif sort == "gc_content_asc":
        results = results.sort_values("gc_content")
    elif sort == "gc_content_desc":
        results = results.sort_values("gc_content", ascending=False)

    # PAGINATION
    total = len(results)
    start = (page - 1) * per_page
    end = start + per_page
    results_page = results.iloc[start:end]

    return jsonify({
        "data": results_page.to_dict(orient="records"),
        "total": total
    })

# ==============================
# FILTER DROPDOWNS
# ==============================
@app.route("/filters")
def filters():
    df = load_data()
    return jsonify({
        "sources": sorted(df["source_final"].dropna().unique().tolist()),
        "countries": sorted(df["country_final"].dropna().unique().tolist()),
        "species": sorted(df["species_final"].dropna().unique().tolist()),
        "assembly_levels": sorted(df["assembly_level"].dropna().unique().tolist()),
        "accessions": sorted(df["assembly_accession"].dropna().unique().tolist())  # 🔥 ADD THIS
    })

# ==============================
# DOWNLOAD
# ==============================
@app.route("/download")
def download():
    df = load_data()   # 🔥 ADD THIS
    csv_data = df.to_csv(index=False)

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=bifidobase_results.csv"}
    )
# ==============================
# GENOME PAGE
# ==============================
@app.route("/genome/<acc>")
def genome_page(acc):
    df = load_data()

    row = df[df["assembly_accession"] == acc]

    if row.empty:
        return "Genome not found"

    data = row.to_dict(orient="records")[0]

    return render_template("genome.html", data=data)
@app.route("/genome-json/<acc>")
def genome_json(acc):
    df = load_data()
    row = df[df["assembly_accession"] == acc]

    if row.empty:
        return jsonify({"error": "not found"})

    return jsonify(row.to_dict(orient="records")[0])
# ==============================
# STATS
# ==============================
@app.route("/stats")
def stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    total = cursor.execute(
        "SELECT COUNT(*) FROM genomes"
    ).fetchone()[0]

    species = cursor.execute("""
        SELECT COUNT(DISTINCT species_final)
        FROM genomes
        WHERE species_final IS NOT NULL
        AND TRIM(LOWER(species_final)) NOT IN ('unknown','none','nan','')
    """).fetchone()[0]

    countries = cursor.execute("""
        SELECT COUNT(DISTINCT country_final)
        FROM genomes
        WHERE country_final IS NOT NULL
        AND TRIM(LOWER(country_final)) NOT IN ('unknown','none','nan','')
    """).fetchone()[0]

    conn.close()

    return jsonify({
        "total": total,
        "species": species,
        "countries": countries
    })
# ==============================
# AUTOCOMPLETE
# ==============================
@app.route("/autocomplete")
def autocomplete():
    import re

    q = request.args.get("q", "").lower().strip()
    if not q:
        return jsonify([])

    df = load_data()  # keep this (since your project uses dataframe)

    species_raw = df["species_final"].dropna().unique()

    cleaned_species = set()

    for s in species_raw:
        s = str(s)

        # remove brackets
        s = re.sub(r"[\[\]]", "", s)

        # extract "Bifidobacterium species"
        match = re.match(r"(Bifidobacterium\s+\w+)", s)

        if match:
            cleaned_species.add(match.group(1))

    # 🔥 IMPROVED MATCHING (faster + cleaner)
    matches = [s for s in cleaned_species if q in s.lower()]

    return jsonify(sorted(matches)[:10])   # limit to 10 for speed
# ==============================
# COMPARE PAGE
# ==============================
@app.route("/compare")
def compare():
    acc1 = request.args.get("acc1")
    acc2 = request.args.get("acc2")

    conn = sqlite3.connect("your_database.db")
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    def fetch_row(acc):
        cur.execute("SELECT * FROM genomes WHERE assembly_accession=?", (acc,))
        return cur.fetchone()

    def get_best(acc):
        row = fetch_row(acc)

        # ✅ If row exists AND genome_size is NOT NULL
        if row is not None and row["genome_size"] is not None:
            return row

        # 🔁 fallback GCF → GCA
        if acc.startswith("GCF"):
            gca = acc.replace("GCF", "GCA")
            row2 = fetch_row(gca)
            if row2 is not None:
                return row2

        return row

    row1 = get_best(acc1)
    row2 = get_best(acc2)

    def safe(val):
        return val if val is not None else "NA"

    return jsonify({
        "genome_size_1": safe(row1["genome_size"]) if row1 else "NA",
        "genome_size_2": safe(row2["genome_size"]) if row2 else "NA",
        "gc_1": safe(row1["gc_content"]) if row1 else "NA",
        "gc_2": safe(row2["gc_content"]) if row2 else "NA"
    })

# ACCESSIONS
# ==============================
@app.route("/accessions")
def accessions():
    df = load_data()
    return jsonify(df["assembly_accession"].dropna().unique().tolist())

# ==============================
# RUN
# ==============================
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=True)
