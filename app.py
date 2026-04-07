from flask import Flask, jsonify, request, render_template
import requests

app = Flask(__name__)

from supabase import create_client

# -------------------------------
# SUPABASE CONFIG
# -------------------------------
SUPABASE_URL = "https://rhbcztpxudkgyrqmzjir.supabase.co"
SUPABASE_KEY = "sb_publishable_HACQ5tt20RG4j9y4FmDuGA_9VN4SZPD"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# -------------------------------
# HOME PAGE
# -------------------------------
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/search-page")
def search_page():
    return render_template("search.html")


# -------------------------------
# STATS API
# -------------------------------
@app.route("/api/stats")
def get_stats():
    try:
        # Total genomes
        total_genomes = supabase.table("genomes").select("accession", count="exact").execute().count

        # Total species (DISTINCT)
        species_data = supabase.table("genomes").select("species").execute().data
        unique_species = len(set([s["species"] for s in species_data if s["species"]]))

        # Total countries (DISTINCT)
        country_data = supabase.table("biosamples").select("country").execute().data
        unique_countries = len(set([c["country"] for c in country_data if c["country"]]))

        return jsonify({
            "genomes": total_genomes,
            "species": unique_species,
            "countries": unique_countries
        })

    except Exception as e:
        print("STATS ERROR:", e)
        return jsonify({"genomes": 0, "species": 0, "countries": 0})

# -------------------------------
# SEARCH API (FULL FIX)
# -------------------------------
@app.route("/api/search")
def search():
    query_text = request.args.get("q", "").strip()
    country = request.args.get("country", "All")
    source = request.args.get("source", "All")
    assembly = request.args.get("assembly", "All")
    page = int(request.args.get("page", 1))

    limit = 50
    offset = (page - 1) * limit

    try:
        query = supabase.table("genomes") \
            .select("accession, species, assembly_level, biosamples!inner(country, source)")

        # SEARCH
        if query_text:
            query = query.or_(
                f"species.ilike.%{query_text}%,accession.ilike.%{query_text}%"
            )

        # FILTERS
        if assembly != "All":
            query = query.eq("assembly_level", assembly)

        if country != "All":
            query = query.ilike("biosamples.country", f"%{country}%")

        if source != "All":
            query = query.ilike("biosamples.source", f"%{source}%")

        # PAGINATION
        res = query.range(offset, offset + limit - 1).execute()
        genomes = res.data

        results = []

        for g in genomes:
            bio = g.get("biosamples")

            if isinstance(bio, list):
                bio = bio[0] if bio else {}
            elif bio is None:
                bio = {}

            results.append({
                "accession": g.get("accession"),
                "species": " ".join(g.get("species", "").split()[:2]),
                "assembly_level": g.get("assembly_level"),
                "country": bio.get("country", "unknown"),
                "source": bio.get("source", "unknown"),
            })

        return jsonify(results)

    except Exception as e:
        print("SEARCH ERROR:", e)
        return jsonify([])


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
            if row.get("country"):
                countries.add(row["country"])

            # handle both cases safely
            src = row.get("source") or row.get("isolation_source")
            if src:
                sources.add(src)

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
# AUTOCOMPLETE (FINAL FIX)
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
                species_set.add(" ".join(sp.split()[:2]))

        return jsonify(sorted(species_set)[:20])

    except Exception as e:
        print("AUTOCOMPLETE ERROR:", e)
        return jsonify([])


# -------------------------------
# RUN
# -------------------------------
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
