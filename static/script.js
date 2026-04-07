document.addEventListener("DOMContentLoaded", () => {

let selectedIndex = -1;
let suggestionsData = [];
let currentPage = 1;

const searchBox = document.getElementById("searchBox");
const suggestions = document.getElementById("suggestions");
const resultsTable = document.getElementById("resultsTable");
const pageInfo = document.getElementById("pageInfo");

const sourceFilter = document.getElementById("sourceFilter");
const countryFilter = document.getElementById("countryFilter");
const assemblyFilter = document.getElementById("assemblyFilter");
const searchBtn = document.getElementById("searchBtn");


// ================= AUTOCOMPLETE =================
searchBox.addEventListener("input", async () => {
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
        };

        suggestions.appendChild(div);
    });
});


// ================= SEARCH =================
async function performSearch(resetPage = false) {
    if (resetPage) currentPage = 1;

    const q = searchBox.value.trim();
    const source = sourceFilter.value;
    const country = countryFilter.value;
    const assembly = assemblyFilter.value;

    const url = `/api/search?q=${q}&source=${source}&country=${country}&assembly=${assembly}&page=${currentPage}`;
    console.log("Calling:", url);

    const res = await fetch(url);
    const data = await res.json();

    console.log("DATA:", data);

    resultsTable.innerHTML = "";

    if (!data || data.length === 0) {
        resultsTable.innerHTML = "<tr><td colspan='5'>No results found</td></tr>";
        pageInfo.textContent = `Page ${currentPage}`;
        return;
    }

    data.forEach(row => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><a href="#">${row.accession}</a></td>
            <td>${row.species}</td>
            <td>${row.source || "unknown"}</td>
            <td>${row.country || "unknown"}</td>
            <td>${row.assembly_level || "NA"}</td>
        `;

        resultsTable.appendChild(tr);
    });

    // ✅ CORRECT PLACE
    pageInfo.textContent = `Page ${currentPage}`;
}

async function loadStats() {
    const res = await fetch("/api/stats");
    const data = await res.json();

    document.getElementById("genomeCount").textContent = data.genomes || 0;
    document.getElementById("speciesCount").textContent = data.species || 0;
    document.getElementById("countryCount").textContent = data.countries || 0;
}

// ================= LOAD FILTERS =================
async function loadFilters() {
    const res = await fetch("/api/filters");
    const data = await res.json();

    countryFilter.innerHTML = '<option value="All">All Countries</option>';
    sourceFilter.innerHTML = '<option value="All">All Sources</option>';
    assemblyFilter.innerHTML = '<option value="All">All Assembly Levels</option>';

    data.countries.forEach(c => {
        const val = c || "unknown";
        countryFilter.innerHTML += `<option value="${val}">${val}</option>`;
    });

    data.sources.forEach(s => {
        const val = s || "unknown";
        sourceFilter.innerHTML += `<option value="${val}">${val}</option>`;
    });

    data.assemblies.forEach(a => {
        assemblyFilter.innerHTML += `<option value="${a}">${a}</option>`;
    });
}

function nextPage() {
    currentPage++;
    performSearch();
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        performSearch();
    }
}

// ================= EVENTS =================
searchBtn.addEventListener("click", () => performSearch(true));

searchBox.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        performSearch(true);
    }
});

// ================= INIT =================
loadStats();
loadFilters();
performSearch();

window.nextPage = nextPage;
window.prevPage = prevPage;
});
