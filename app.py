from flask import Flask, render_template, request, jsonify, Response

app = Flask(__name__)
import os
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_data():
    csv_path = os.path.join(BASE_DIR, "metadata_final.csv")
    print("Loading from:", path)   # 🔥 DEBUG LINE
    df = pd.read_csv(csv_path)
    print("Shape:", df.shape)      # 🔥 DEBUG
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
    page = int(request.args.get("page", 1))
    per_page = 50

    df = load_data()
    results = df.copy()

    # SEARCH (FIXED)
    if query:
        results = results[results["species_final"].str.lower().str.contains(query, na=False)]

    # FILTERS
    if source:
        results = results[results["source_final"] == source]   # 👈 better for UI

    if country:
        results = results[results["country_final"] == country]

    if assembly:
        if assembly == "refseq":
            results = results[results["assembly_accession"].str.startswith("GCF")]
        elif assembly == "genbank":
            results = results[results["assembly_accession"].str.startswith("GCA")]

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
        "accessions": sorted(df["assembly_accession"].dropna().unique().tolist())  # 🔥 ADD THIS
    })

# ==============================
# DOWNLOAD
# ==============================
@app.route("/download")
def download():

    csv_data = df.to_csv(index=False)

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=bifidobase_results.csv"}
    )

# ==============================
# GENOME PAGE
# ==============================
@app.route("/genome/<accession>")
def genome(accession):
    df = load_data()
    row = df[df["assembly_accession"] == accession]

    if row.empty:
        return "Genome not found"

    data = row.iloc[0].to_dict()

    return render_template("genome.html", data=data)

# ==============================
# STATS
# ==============================
@app.route("/stats")
def stats():
    df = load_data()
    return jsonify({
        "genomes": len(df),
        "species": df["species_final"].nunique(),   # 🔥 FIXED
        "countries": df["country_final"].nunique()
    })

# ==============================
# AUTOCOMPLETE
# ==============================
@app.route("/autocomplete")
def autocomplete():

    import re

    df = load_data()   # 🔥 ADD THIS LINE

    q = request.args.get("q", "").lower()

    if not q:
        return jsonify([])

    species_raw = df["species_final"].dropna().unique()  # 🔥 FIX COLUMN

    cleaned_species = set()

    for s in species_raw:
        s = str(s)

        # remove brackets
        s = re.sub(r"\[|\]", "", s)

        # extract genus + species only
        match = re.match(r"(Bifidobacterium\s+\w+)", s)

        if match:
            cleaned_species.add(match.group(1))

    matches = [s for s in cleaned_species if q in s.lower()]

    return jsonify(sorted(matches)[:20])

# ==============================
# COMPARE PAGE
# ==============================
@app.route("/compare-page")
def compare_page():
    return render_template("compare.html")

@app.route("/compare")
def compare():

    df = load_data()

    acc1 = request.args.get("acc1")
    acc2 = request.args.get("acc2")

    g1 = df[df["assembly_accession"] == acc1]
    g2 = df[df["assembly_accession"] == acc2]

    if g1.empty or g2.empty:
        return jsonify({"error": "Genome not found"})

    g1 = g1.iloc[0]
    g2 = g2.iloc[0]

    return jsonify({
        "genome1": {
            "accession": g1["assembly_accession"],
            "species": g1["species_final"],
            "genome_size": g1["genome_size"],
            "gc_content": g1["gc_content"],
            "contigs": g1["contig_count"],
            "n50": g1["n50"],
            "source": g1["source_final"],
            "country": g1["country_final"]
        },
        "genome2": {
            "accession": g2["assembly_accession"],
            "species": g2["species_final"],
            "genome_size": g2["genome_size"],
            "gc_content": g2["gc_content"],
            "contigs": g2["contig_count"],
            "n50": g2["n50"],
            "source": g2["source_final"],
            "country": g2["country_final"]
        }
    })

# ==============================
# ACCESSIONS
# ==============================
@app.route("/accessions")
def accessions():
    df = load_data()
    return jsonify(df["assembly_accession"].dropna().unique().tolist())

# ==============================
# RUN
# ==============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
