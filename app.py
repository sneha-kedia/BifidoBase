print("🔥 APP FILE LOADED FROM:", __file__)
from flask import Flask, jsonify, request, render_template, send_file
import requests
import time
from concurrent.futures import ThreadPoolExecutor, as_completed


biosample_cache = None

app = Flask(__name__)

from supabase import create_client

# -------------------------------
# SUPABASE CONFIG
# -------------------------------
SUPABASE_URL = "https://rhbcztpxudkgyrqmzjir.supabase.co"
SUPABASE_KEY = "sb_publishable_HACQ5tt20RG4j9y4FmDuGA_9VN4SZPD"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_all(table, column):
    all_data = []
    start = 0
    batch = 1000

    while True:
        res = safe_execute(
            supabase.table(table)
            .select(column)
            .range(start, start + batch - 1)
        )

        data = res.data
        if not data:
            break

        all_data.extend(data)
        start += batch

    return all_data

def safe_execute(query, retries=3):
    for attempt in range(retries):
        try:
            return query.execute()
        except Exception as e:
            print(f"Retry {attempt+1} due to error: {e}")
            time.sleep(1)
    raise Exception("Max retries reached")

import zipfile
import io

@app.route("/download")
def download_genomes():

    # -------------------------------
    # GET FILTERS
    # -------------------------------
    query_text = request.args.get("q", "").strip().lower()
    country = request.args.get("country", "All")
    source = request.args.get("source", "All")
    assembly = request.args.get("assembly", "All")
    accession_filter = request.args.get("accession", "All")
    stat = request.args.get("stat")
    range_val = request.args.get("range")
    min_val = request.args.get("min")
    max_val = request.args.get("max")
    genome_type_filter = request.args.get("genome_type")

    print("Running FULL download with filters")

    # -------------------------------
    # FETCH DATA
    # -------------------------------
    genomes = fetch_all(
        "genomes",
        "accession, species, assembly_level, biosample, genome_size, gc_content, contigs, n50, l50, completeness, contamination, ftp_path"
    )

    biosamples = fetch_all("biosamples", "biosample, country_final, source_final")

    # -------------------------------
    # BIOSAMPLE MAP
    # -------------------------------
    biosample_map = {}
    for b in biosamples:
        key = str(b.get("biosample") or "").strip().upper()
        if key:
            biosample_map[key] = b

    # -------------------------------
    # FILTERING (SAME AS SEARCH)
    # -------------------------------
    filtered = []

    for g in genomes:

        g_species = (g.get("species") or "").lower()
        g_assembly = g.get("assembly_level") or ""

        g_bio = str(g.get("biosample") or "").strip().upper()
        bio = biosample_map.get(g_bio, {})

        g_country = (bio.get("country_final") or "unknown").strip().lower()
        g_source = (bio.get("source_final") or "unknown").strip().lower()

        bio_text = (g_source + " " + g_species).lower()

        genome_type = "MAG" if any(k in bio_text for k in [
            "metagenome", "environmental", "uncultured", "microbiome"
        ]) else "isolate"

        if genome_type_filter and genome_type != genome_type_filter:
            continue

        if query_text:
            g_acc = (g.get("accession") or "").lower()

            if query_text.startswith("gcf_") or query_text.startswith("gca_"):
                if query_text not in g_acc:
                    continue
            else:
                parts = g_species.split()
                species_name = parts[1] if len(parts) > 1 else ""
                if query_text.split()[-1] != species_name:
                    continue

        if country != "All" and g_country != country.lower():
            continue

        if source != "All" and g_source != source.lower():
            continue

        if assembly != "All" and g_assembly != assembly:
            continue

        g_acc = (g.get("accession") or "").upper()

        if accession_filter == "RefSeq" and not g_acc.startswith("GCF_"):
            continue

        if accession_filter == "GenBank" and not g_acc.startswith("GCA_"):
            continue

        if stat:
            value = g.get(stat)

            if value is None:
                continue

            try:
                value = float(value)
            except:
                continue

            if min_val and value < float(min_val):
                continue

            if max_val and value > float(max_val):
                continue

        filtered.append(g)

    # -------------------------------
    # ACCESSIONS
    # -------------------------------
    accessions = [g["accession"] for g in filtered]

    print("Total genomes to download:", len(accessions))

    # -------------------------------
    # SAFETY LIMIT (OPTIONAL)
    # -------------------------------
    if len(accessions) > 15000:
        return jsonify({"error": "Too many genomes to download"})

    # -------------------------------
    # PARALLEL DOWNLOAD
    # -------------------------------
    import zipfile
    import io
    import time
    from concurrent.futures import ThreadPoolExecutor, as_completed

    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w") as zf:

        def download_one(g):

            ftp = g.get("ftp_path")

            if not ftp:
                return None

            file_name = ftp.rstrip("/").split("/")[-1]
            fna_url = f"{ftp}/{file_name}_genomic.fna.gz"

            for attempt in range(3):
                try:
                    r = requests.get(fna_url, timeout=20)

                    if r.status_code == 200:
                        return (f"{file_name}.fna.gz", r.content)

                except:
                    time.sleep(1)

            print("Failed:", g.get("accession"))
            return None

        MAX_WORKERS = 8

        print("Starting parallel download...")

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:

            futures = [executor.submit(download_one, g) for g in filtered]

            for future in as_completed(futures):

                result = future.result()

                if result:
                    fname, content = result
                    zf.writestr(fname, content)

    zip_buffer.seek(0)

    return send_file(
        zip_buffer,
        mimetype="application/zip",
        as_attachment=True,
        download_name="bifidobase_genomes.zip"
    )


# -------------------------------
# HOME PAGE
# -------------------------------
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/search-page")
def search_page():
    return render_template("search.html")

import re

def clean_species(name):
    if not name:
        return None

    sp = " ".join(name.split()[:2])
    sp = re.sub(r'[\[\]]', '', sp)
    sp = sp.strip().capitalize()

    return sp


# -------------------------------
# STATS API
# -------------------------------
@app.route("/api/stats")
def get_stats():
    try:
        print("NEW STATS FUNCTION RUNNING")

        total_genomes = supabase.table("genomes") \
            .select("id", count="exact") \
            .execute().count

        species_data = fetch_all("genomes", "species")
        country_data = fetch_all("biosamples", "country_final")

        unique_species = len(set([
            clean_species(s["species"])
            for s in species_data if s["species"]
        ]))

        unique_countries = len(set([
            c["country_final"].strip().lower()
            for c in country_data if c["country_final"]
        ]))

        return jsonify({
            "genomes": total_genomes,
            "species": unique_species,
            "countries": unique_countries
        })

    except Exception as e:
        print("STATS ERROR:", e)
        return jsonify({"genomes": 0, "species": 0, "countries": 0})


# -------------------------------
# SEARCH API (FINAL FIX)
# -------------------------------
@app.route("/api/search")
def search():
    query_text = request.args.get("q", "").strip().lower()
    country = request.args.get("country", "All")
    source = request.args.get("source", "All")
    assembly = request.args.get("assembly", "All")
    accession_filter = request.args.get("accession", "All")
    page = int(request.args.get("page", 1))
    stat = request.args.get("stat")
    range_val = request.args.get("range")
    min_val = request.args.get("min")
    max_val = request.args.get("max")
    genome_type_filter = request.args.get("genome_type")

    limit = 50

    try:
        global biosample_cache

        if biosample_cache is None:
            biosample_cache = fetch_all("biosamples", "biosample, country_final, source_final")

        # -------------------------------
        # FETCH ALL GENOMES (NO LOSS)
        # -------------------------------
        genomes = fetch_all(
            "genomes",
            "accession, species, assembly_level, biosample, genome_size, gc_content, contigs, n50, l50, completeness, contamination, ftp_path"
        )

        # -------------------------------
        # BIOSAMPLE MAP
        # -------------------------------
        biosample_map = {}
        for b in biosample_cache:
            key = str(b.get("biosample") or "").strip().upper()
            if key:
                biosample_map[key] = b

        # -------------------------------
        # FINAL FILTERING (ALL CONDITIONS)
        # -------------------------------
        filtered = []

        for g in genomes:
            g_species = (g.get("species") or "").lower()
            g_assembly = g.get("assembly_level") or ""

            g_bio = str(g.get("biosample") or "").strip().upper()
            bio = biosample_map.get(g_bio, {})

            g_country = (bio.get("country_final") or "unknown").strip().lower()
            g_source = (bio.get("source_final") or "unknown").strip().lower()
            bio_text = (g_source + " " + g_species).lower()

            if any(k in bio_text for k in ["metagenome", "environmental", "uncultured", "microbiome"]):
                genome_type = "MAG"
            else:
                genome_type = "isolate"


            if genome_type_filter:
                if genome_type != genome_type_filter:
                    continue

            if query_text:
                q = query_text.strip().lower()
                g_acc = (g.get("accession") or "").lower()

    # accession search
                if q.startswith("gcf_") or q.startswith("gca_"):
                    if q not in g_acc:
                        continue

    # species search
                else:
                    q_species = q.split()[-1]

                    parts = g_species.lower().split()
                    species_name = parts[1] if len(parts) > 1 else ""

                    if q_species != species_name:
                        continue

            if country != "All" and g_country != country.lower():
                continue

            if source != "All" and g_source != source.lower():
                continue

            if assembly != "All" and g_assembly != assembly:
                continue

            g_acc = (g.get("accession") or "").upper()

            if accession_filter == "RefSeq" and not g_acc.startswith("GCF_"):
                continue

            if accession_filter == "GenBank" and not g_acc.startswith("GCA_"):
                continue
            if stat:
                value = g.get(stat)

                if value is None:
                     continue

                try:
                    value = float(value)
                except:
                    continue

    # ✅ CUSTOM RANGE TAKES PRIORITY
                if min_val or max_val:
                    if min_val:
                        if value < float(min_val):
                            continue
                    if max_val:
                        if value > float(max_val):
                            continue

    # ✅ OTHERWISE USE PRESET RANGE
                elif range_val:
                    if range_val.startswith("<"):
                        if not value < float(range_val[1:]):
                            continue

                    elif range_val.startswith(">"):
                        if not value > float(range_val[1:]):
                            continue

                    elif "-" in range_val:
                        low, high = map(float, range_val.split("-"))
                        if not (low <= value <= high):
                            continue

            filtered.append({
                "accession": g.get("accession"),
                "species": g.get("species"),
                "assembly_level": g.get("assembly_level"),
                "country": bio.get("country_final") or "unknown",
                "source": bio.get("source_final") or "unknown",
	
                "gc_content": g.get("gc_content"),
                "genome_size": g.get("genome_size"),
                "contigs": g.get("contigs"),
                "n50": g.get("n50"),
                "l50": g.get("l50"),
                "completeness": g.get("completeness"),
                "contamination": g.get("contamination"),
                "genome_type": genome_type,
            })

        # -------------------------------
        # TOTAL COUNT (FINAL CORRECT)
        # -------------------------------
        total_count = len(filtered)

        # -------------------------------
        # PAGINATION
        # -------------------------------
        if total_count <= 50:
            results = filtered
        else:
            start = (page - 1) * limit
            end = start + limit
            results = filtered[start:end]

        return jsonify({
            "results": results,
            "total": total_count
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)})

# -------------------------------
# FILTER OPTIONS API
# -------------------------------
@app.route("/api/filters")
def get_filters():
    try:
        b_res = supabase.table("biosamples").select("*").execute()
        g_res = supabase.table("genomes").select("assembly_level").execute()

        countries = set()
        sources = set()
        assemblies = set()

        for row in b_res.data:
            if row.get("country_final"):
                cf = row.get("country_final")
                if cf:
                    country = cf.split(":")[0].strip().lower()

                if country in {"unknown", "missing", "not applicable", "not determined", ""}:
                    continue

                countries.add(country.capitalize())

            src = row.get("source_final")
            if src:
                val = src.strip().lower()
                if val not in {"1", "true", "missing", "unknown", "none", ""}:
                    sources.add(val)

        for row in g_res.data:
            if row.get("assembly_level"):
                assemblies.add(row["assembly_level"])

        return jsonify({
            "countries": sorted(countries),
            "sources": sorted(sources),
            "assemblies": sorted(assemblies)
        })

    except Exception as e:
        print("FILTER ERROR:", e)
        return jsonify({"countries": [], "sources": [], "assemblies": []})


# -------------------------------
# AUTOCOMPLETE
# -------------------------------
@app.route("/api/autocomplete")
def autocomplete():
    query = request.args.get("q", "").lower()

    if not query:
        return jsonify([])

    try:
        response = supabase.table("genomes") \
            .select("species") \
            .ilike("species", f"%{query}%") \
            .limit(50) \
            .execute()

        species_set = set()

        for row in response.data:
            sp = row.get("species")
            if sp:
                cleaned = clean_species(sp)
                if cleaned:
                    species_set.add(cleaned)

        return jsonify(sorted(species_set)[:20])

    except Exception as e:
        print("AUTOCOMPLETE ERROR:", e)
        return jsonify([])

# -------------------------------
# GENOME PAGE (HTML)
# -------------------------------
@app.route("/genome/<accession>")
def genome_page(accession):
    return render_template("genome.html", accession=accession)


# -------------------------------
# GENOME API (DATA)
# -------------------------------
@app.route("/api/genome/<accession>")
def get_genome(accession):
    try:
        g = supabase.table("genomes") \
            .select("*") \
            .eq("accession", accession) \
            .execute().data

        if not g:
            return jsonify({})

        g = g[0]

        b = supabase.table("biosamples") \
            .select("*") \
            .eq("biosample", g.get("biosample")) \
            .execute().data

        bio = b[0] if b else {}

        # SAME LOGIC AS SEARCH (important)
        g_species = (g.get("species") or "").lower()
        g_source = (bio.get("source_final") or "unknown").lower()
        bio_text = (g_source + " " + g_species).lower()

        if any(k in bio_text for k in ["metagenome", "environmental", "uncultured", "microbiome"]):
            genome_type = "MAG"
        else:
            genome_type = "isolate"

        return jsonify({
            "accession": g.get("accession"),
            "species": g.get("species"),
            "assembly_level": g.get("assembly_level"),
            "genome_size": g.get("genome_size"),
            "gc_content": g.get("gc_content"),
            "contigs": g.get("contigs"),
            "n50": g.get("n50"),
            "source": bio.get("source_final"),
            "country": bio.get("country_final"),
            "genome_type": genome_type
        })

    except Exception as e:
        return jsonify({"error": str(e)})
# -------------------------------
# RUN
# -------------------------------
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
