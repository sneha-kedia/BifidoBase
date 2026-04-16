document.addEventListener("DOMContentLoaded", () => {

let selectedIndex = -1;
let suggestionsData = [];
let currentPage = 1;
let totalResults = 0;
let previousResults = null;
let activeStats = [];
let currentResults = [];


const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const resultsTable = document.getElementById("resultsTable");
const pageInfo = document.getElementById("pageInfo");

const sourceFilter = document.getElementById("sourceFilter");
const countryFilter = document.getElementById("countryFilter");
const assemblyFilter = document.getElementById("assemblyFilter");
const searchBtn = document.getElementById("searchBtn");


// ================= AUTOCOMPLETE =================
if (searchBox && suggestions) {
searchBox.addEventListener("input", async () => {

    selectedIndex = -1;

    const q = searchBox.value.trim();

    if (q.length < 2) {
        suggestions.style.display = "none";
        return;
    }

    const res = await fetch(`/api/autocomplete?q=${q}`);
    const data = await res.json();

    suggestions.innerHTML = "";
    suggestions.style.display = "block";

    data.forEach(item => {
        const div = document.createElement("div");
        div.textContent = item;
        div.style.padding = "8px";
        div.style.cursor = "pointer";

        div.onclick = () => {
            searchBox.value = item;
            suggestions.style.display = "none";
            performSearch(true);
        };

        suggestions.appendChild(div);
    });
});
}


// ================= 🔥 AUTO SEARCH (NEW) =================
let debounceTimer;

if (searchBox) {
    searchBox.addEventListener("input", () => {
        if (searchBox.value.length < 2) return;

        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            performSearch(true);
        }, 400);
    });
}


// ================= 🔥 ARROW NAVIGATION (NEW) =================
if (searchBox) {
    searchBox.addEventListener("keydown", (e) => {
        const items = suggestions?.children;
        if (!items || !items.length) return;

        if (e.key === "ArrowDown") {
            selectedIndex = (selectedIndex + 1) % items.length;
        } 
        else if (e.key === "ArrowUp") {
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        } 
        else if (e.key === "Enter" && selectedIndex >= 0) {
            searchBox.value = items[selectedIndex].textContent;
            suggestions.style.display = "none";
            performSearch(true);
            return;
        }

        Array.from(items).forEach((el, i) => {
            el.style.background = i === selectedIndex ? "#eee" : "#fff";
        });
    });
}

// ================= STAT RANGE LOGIC =================
const statFilterEl = document.getElementById("statFilter");
const statRangeEl = document.getElementById("statRange");

if (statFilterEl && statRangeEl) {
    statFilterEl.addEventListener("change", function () {
        const val = this.value;

        previousResults = null; 

        if (val && !activeStats.includes(val)) {
            activeStats.push(val);
        }

        statRangeEl.innerHTML = "";

        if (val === "gc_content") {
            statRangeEl.innerHTML = `
                <option value="">Select Range</option>
                <option value="<30"><30%</option>
                <option value="30-40">30–40%</option>
                <option value="40-50">40–50%</option>
                <option value="50-60">50–60%</option>
                <option value=">60">>60%</option>

            `;
        }

        if (val === "genome_size") {
            statRangeEl.innerHTML = `
                <option value="">Select Range</option>
                <option value="<1000000"><1Mb</option>
                <option value="1000000-2000000">1–2Mb</option>
                <option value="2000000-3000000">2–3Mb</option>
                <option value="3000000-5000000">3–5Mb</option>
                <option value=">5000000">>5Mb</option>
            `;
        }

        if (val === "n50") {
            statRangeEl.innerHTML = `
                <option value="">Select Range</option>
                <option value="<50000"><50k</option>
                <option value="50000-200000">50k–200k</option>
                <option value="200000-500000">200k–500k</option>
                <option value=">500000">>500k</option>
            `;
        }

        if (val === "l50") {
            statRangeEl.innerHTML = `
                <option value="">Select Range</option>
                <option value="<10"><10</option>
                <option value="10-50">10–50</option>
                <option value="50-100">50–100</option>
                <option value=">100">>100</option>
            `;
        }
        
        if (val === "completeness") {
            statRangeEl.innerHTML = `
                <option value="">Select Range</option>
                <option value="<90"><90%</option>
                <option value="90-95">90–95%</option>
                <option value="95-100">95–100%</option>
            `;
        }

        if (val === "contamination") {
            statRangeEl.innerHTML = `
                <option value="">Select Range</option>
                <option value="<1"><1%</option>
                <option value="1-5">1–5%</option>
                <option value=">5">>5%</option>
            `;
        }

        if (val === "contigs") {
            statRangeEl.innerHTML = `
                <option value="">Select Range</option>
                <option value="<50"><50</option>
                <option value="50-100">50–100</option>
                <option value="100-200">100–200</option>
                <option value="200-500">200–500</option>
                <option value=">500">>500</option>
            `;
        }
    });
}

// ================= CUSTOM OVERRIDES PRESET =================
const statMinEl = document.getElementById("statMin");
const statMaxEl = document.getElementById("statMax");

if (statMinEl && statMaxEl && statRangeEl) {

    function handleCustomInput() {
        if (statMinEl.value || statMaxEl.value) {
            statRangeEl.value = "";        // clear preset
            statRangeEl.disabled = true;   // disable dropdown
        } else {
            statRangeEl.disabled = false;  // re-enable
        }
    }

    statMinEl.addEventListener("input", handleCustomInput);
    statMaxEl.addEventListener("input", handleCustomInput);
}

// ================= SEARCH =================
async function performSearch(resetPage = false) {
    if (!searchBox || !resultsTable) return;

    if (resetPage) currentPage = 1;

    const q = searchBox.value.trim();
    const source = sourceFilter?.value || "All";
    const country = countryFilter?.value || "All";
    const assembly = assemblyFilter?.value || "All";
    const accession = document.getElementById("accessionFilter")?.value || "All";
    const stat = document.getElementById("statFilter")?.value || "";
    const range = document.getElementById("statRange")?.value || "";
    const statMin = document.getElementById("statMin")?.value || "";
    const statMax = document.getElementById("statMax")?.value || "";
    const genomeType = document.getElementById("genomeType")?.value || "";

    const url = `/api/search?q=${q}&source=${source}&country=${country}&assembly=${assembly}&genome_type=${genomeType}&accession=${accession}&stat=${stat}&range=${range}&min=${statMin}&max=${statMax}&page=${currentPage}`;
    console.log("Calling:", url);
    const res = await fetch(url);
    const data = await res.json();

    let results = data.results;
    currentResults = results;

    const refineMode = document.getElementById("refineToggle")?.checked;

    totalResults = data.total;


    let shown = Math.min(currentPage * 50, totalResults);

    document.getElementById("resultCount").innerText =
        `Showing ${shown} of ${data.total} results`;

    const headerRow = document.querySelector("thead tr");

// remove old dynamic headers
    document.querySelectorAll(".dynamic-header").forEach(el => el.remove());

    activeStats.forEach(stat => {
        const th = document.createElement("th");
        th.classList.add("dynamic-header");

        if (stat === "gc_content") th.innerText = "GC %";
        else if (stat === "genome_size") th.innerText = "Genome Size";
        else if (stat === "n50") th.innerText = "N50";
        else if (stat === "l50") th.innerText = "L50";
        else if (stat === "completeness") th.innerText = "Completeness";
        else if (stat === "contamination") th.innerText = "Contamination";
        else if (stat === "contigs") th.innerText = "Contigs";

        headerRow.appendChild(th);
    });


    resultsTable.innerHTML = "";

    if (!results || results.length === 0) {
        resultsTable.innerHTML = "<tr><td colspan='5'>No results found</td></tr>";
        if (pageInfo) pageInfo.textContent = `Page ${currentPage}`;
        return;
    }

    results.forEach(row => {
        const tr = document.createElement("tr");
        
        let extraCols = "";

        activeStats.forEach(stat => {
            let val = row[stat];
            if (val == null) val = "NA";

            extraCols += `<td class="dynamic-cell">${val}</td>`;
        });

        tr.innerHTML = `
            <td>
                <a href="/genome/${row.accession}">
                    ${row.accession}
                </a>
                ${
                    row.genome_type === "MAG"
                    ? '<span style="background:#fff3cd; color:#b45309; padding:2px 6px; border-radius:6px; font-size:11px; margin-left:6px;">MAG</span>'
                    : '<span style="background:#e6f9ec; color:#15803d; padding:2px 6px; border-radius:6px; font-size:11px; margin-left:6px;">Isolate</span>'
                }
            </td>
            <td>${row.species}</td>
            <td>${row.source === "unknown" ? "Unknown" : row.source}</td>
            <td>${row.country === "unknown" ? "Unknown" : row.country}</td>
            <td>${row.assembly_level || "NA"}</td>
            ${extraCols}
        `;


        resultsTable.appendChild(tr);
    });

    if (pageInfo) pageInfo.textContent = `Page ${currentPage}`;
}

function applyClientFilter(row) {
    const stat = document.getElementById("statFilter")?.value;
    const range = document.getElementById("statRange")?.value;
    const min = document.getElementById("statMin")?.value;
    const max = document.getElementById("statMax")?.value;

    if (!stat) return true;

    let val = row[stat];
    if (val == null) return false;

    if (min || max) {
        if (min && val < Number(min)) return false;
        if (max && val > Number(max)) return false;
        return true;
    }

    if (!range) return true;

    if (range.includes("-")) {
        const [rmin, rmax] = range.split("-").map(Number);
        return val >= rmin && val <= rmax;
    } else if (range.startsWith("<")) {
        return val < Number(range.slice(1));
    } else if (range.startsWith(">")) {
        return val > Number(range.slice(1));
    }

    return true;
}



// ================= STATS =================
async function loadStats() {
    try {
        const res = await fetch("/api/stats");
        const data = await res.json();

        const g = document.getElementById("genomeCount");
        const s = document.getElementById("speciesCount");
        const c = document.getElementById("countryCount");

        if (g) g.textContent = data.genomes || 0;
        if (s) s.textContent = data.species || 0;
        if (c) c.textContent = data.countries || 0;

    } catch (err) {
        console.error("Stats error:", err);
    }
}


// ================= LOAD FILTERS =================
async function loadFilters() {
    if (!countryFilter || !sourceFilter || !assemblyFilter) return;

    const res = await fetch("/api/filters");
    const data = await res.json();

    countryFilter.innerHTML = '<option value="All">All Countries</option>';
    sourceFilter.innerHTML = '<option value="All">All Sources</option>';
    assemblyFilter.innerHTML = '<option value="All">All Assembly Levels</option>';

    data.countries.forEach(c => {
        const val = c || "unknown";
        countryFilter.innerHTML += `<option value="${val.toLowerCase()}">${val}</option>`;
    });

    data.sources.forEach(s => {
        const val = s || "unknown";
        sourceFilter.innerHTML += `<option value="${val.toLowerCase()}">${val}</option>`;
    });

    data.assemblies.forEach(a => {
        assemblyFilter.innerHTML += `<option value="${a}">${a}</option>`;
    });
}


// ================= PAGINATION =================
function nextPage() {
    if (currentPage * 50 >= totalResults) return;
    currentPage++;
    performSearch();
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        performSearch();
    }
}

async function downloadGenomes() {

    const downloadBtn = document.getElementById("downloadBtn");

    // 🔥 ADD THIS BLOCK HERE
    if (downloadBtn) {
        downloadBtn.innerText = "Downloading...";
        downloadBtn.disabled = true;
    }


    const params = new URLSearchParams({
        q: document.getElementById("searchBox").value,
        source: document.getElementById("sourceFilter").value,
        country: document.getElementById("countryFilter").value,
        assembly: document.getElementById("assemblyFilter").value,
        accession: document.getElementById("accessionFilter").value,
        genome_type: document.getElementById("genomeType").value,
        stat: document.getElementById("statFilter").value,
        range: document.getElementById("statRange").value,
        min: document.getElementById("statMin").value,
        max: document.getElementById("statMax").value
    });

    console.log("Downloading ALL filtered genomes");

    const response = await fetch("/download?" + params.toString());

    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "bifidobase_genomes.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// ================= EVENTS =================
if (searchBtn) {
    searchBtn.addEventListener("click", () => performSearch(true));
}
const genomeTypeFilter = document.getElementById("genomeType");

if (genomeTypeFilter) {
    genomeTypeFilter.addEventListener("change", () => {
        performSearch(true);
    });
}
if (searchBox) {
    searchBox.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            performSearch(true);
        }
    });
}
const refineToggle = document.getElementById("refineToggle");

if (refineToggle) {
    refineToggle.addEventListener("change", () => {
        if (!refineToggle.checked) {
            previousResults = null;
            activeStats = [];
        }
    });
}

// 🔥 Reset refine cache when range changes
if (statRangeEl) {
    statRangeEl.addEventListener("change", () => {
        previousResults = null;
    });
}

// 🔥 Reset refine cache when manual values change
if (statMinEl && statMaxEl) {
    statMinEl.addEventListener("input", () => {
        previousResults = null;
    });

    statMaxEl.addEventListener("input", () => {
        previousResults = null;
    });
}

// ================= INIT =================
loadStats();
loadFilters();
performSearch();

const downloadBtn = document.getElementById("downloadBtn");

if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
        console.log("Download button clicked");
        downloadGenomes();
    });
}

window.nextPage = nextPage;
window.prevPage = prevPage;
window.downloadGenomes = downloadGenomes;
});
