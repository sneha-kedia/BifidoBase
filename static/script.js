let selectedIndex = -1;
let suggestionsData = [];
let currentPage = 1;

// ================= LOAD FILTERS =================
async function loadFilters() {
    try {
        const res = await fetch("/filters");
        const data = await res.json();

        const sourceSelect = document.getElementById("sourceFilter");
        const countrySelect = document.getElementById("countryFilter");

        if (!sourceSelect || !countrySelect) return;
        
        sourceSelect.innerHTML = `<option value="">All Sources</option>`;
        countrySelect.innerHTML = `<option value="">All Countries</option>`;

        data.sources.forEach(s => {
            sourceSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });

        data.countries.forEach(c => {
            countrySelect.innerHTML += `<option value="${c}">${c}</option>`;
        });


    } catch (err) {
        console.error("Filter load error:", err);
    }
}

// ================= AUTOCOMPLETE =================
async function autocompleteSpecies() {
    const input = document.getElementById("searchBox");
    const box = document.getElementById("suggestions");

    if (!input || !box) return;

    const query = input.value.trim();

    box.innerHTML = "";
    box.style.display = "none";
    selectedIndex = -1;

    if (!query) return;

    try {
        const res = await fetch(`/autocomplete?q=${query}`);
        const data = await res.json();

        if (!data.length) return;

        suggestionsData = data;
        box.style.display = "block";

        data.forEach((item, index) => {
            const div = document.createElement("div");
            div.innerText = item;

            div.style.padding = "8px";
            div.style.cursor = "pointer";

            div.onmouseover = () => {
                selectedIndex = index;
                highlight();
            };

            div.onclick = () => selectSuggestion(item);

            box.appendChild(div);
        });

    } catch (err) {
        console.error(err);
    }
}

// ================= HIGHLIGHT =================
function highlight() {
    const box = document.getElementById("suggestions");
    if (!box) return;

    const items = box.children;

    for (let i = 0; i < items.length; i++) {
        items[i].style.background = "white";
    }

    if (items[selectedIndex]) {
        items[selectedIndex].style.background = "#ddd";
    }
}

// ================= SELECT =================
function selectSuggestion(value) {
    const input = document.getElementById("searchBox");
    const box = document.getElementById("suggestions");

    if (!input || !box) return;

    input.value = value;
    box.style.display = "none";
    searchData();
}

// ================= LOAD STATS =================
async function loadStats() {
    try {
        const res = await fetch("/stats");
        const data = await res.json();

        const g = document.getElementById("totalGenomes");
        const s = document.getElementById("totalSpecies");
        const c = document.getElementById("totalCountries");

        if (!g || !s || !c) return;

        g.innerText = data.genomes;
        s.innerText = data.species;
        c.innerText = data.countries;
    } catch (err) {
        console.error("Stats error:", err);
    }
}

// ================= SEARCH =================
async function searchData(page = 1) {

    const searchBox = document.getElementById("searchBox");
    if (!searchBox) return;

    currentPage = page;

    const query = searchBox.value;
    const source = document.getElementById("sourceFilter")?.value || "";
    const country = document.getElementById("countryFilter")?.value || "";
    const assembly = document.getElementById("assemblyFilter")?.value || "";
    const sort = document.getElementById("sortFilter")?.value || "";

    const suggestions = document.getElementById("suggestions");
    if (suggestions) suggestions.style.display = "none";

const url = `/search?query=${query}&source=${source}&country=${country}&assembly_type=${assembly}&sort=${sort}&page=${page}`;
    const res = await fetch(url);
    const result = await res.json();

    const data = result.data || [];
    const total = result.total || 0;

    const resultCount = document.getElementById("resultCount");
    if (resultCount) {
        resultCount.innerText = `Showing ${data.length} of ${total} results`;
    }

    const table = document.getElementById("resultsTable");
    if (!table) return;

    table.innerHTML = "";

    data.forEach(row => {
        table.innerHTML += `
            <tr>
                <td><a href="/genome/${row.assembly_accession}">${row.assembly_accession}</a></td>
                <td>${row.species_final}</td>
                <td>${row.source_final}</td>
                <td>${row.country_final}</td>
            </tr>
        `;
    });

    renderPagination(total);
}

// ================= PAGINATION =================
function renderPagination(total) {

    const container = document.getElementById("pagination");
    if (!container) return;

    const perPage = 50;
    const totalPages = Math.ceil(total / perPage);

    container.innerHTML = "";

    if (totalPages <= 1) return;

    if (currentPage > 1) {
        container.innerHTML += `<button onclick="searchData(${currentPage - 1})">Prev</button>`;
    }

    if (currentPage < totalPages) {
        container.innerHTML += `<button onclick="searchData(${currentPage + 1})">Next</button>`;
    }
}

// ================= COMPARE =================
function compareGenomes() {
    const acc1 = document.getElementById("acc1")?.value;
    const acc2 = document.getElementById("acc2")?.value;

    if (!acc1 || !acc2) {
        alert("Select both genomes");
        return;
    }

    fetch(`/compare?acc1=${acc1}&acc2=${acc2}`)
        .then(res => res.json())
        .then(data => {

            if (data.error) {
                alert(data.error);
                return;
            }

            const output = document.getElementById("compareResult");
            if (!output) return;

            output.innerHTML = `
                <h3>Genome Comparison</h3>
                <table border="1" style="width:100%; text-align:center;">
                    <tr>
                        <th>Feature</th>
                        <th>${data.genome1.accession}</th>
                        <th>${data.genome2.accession}</th>
                    </tr>
                    <tr><td>Species</td><td>${data.genome1.species}</td><td>${data.genome2.species}</td></tr>
                    <tr><td>Genome Size</td><td>${data.genome1.genome_size}</td><td>${data.genome2.genome_size}</td></tr>
                    <tr><td>GC %</td><td>${data.genome1.gc_content}</td><td>${data.genome2.gc_content}</td></tr>
                    <tr><td>Contigs</td><td>${data.genome1.contigs}</td><td>${data.genome2.contigs}</td></tr>
                    <tr><td>N50</td><td>${data.genome1.n50}</td><td>${data.genome2.n50}</td></tr>
                    <tr><td>Source</td><td>${data.genome1.source}</td><td>${data.genome2.source}</td></tr>
                    <tr><td>Country</td><td>${data.genome1.country}</td><td>${data.genome2.country}</td></tr>
                </table>
            `;
        });
}

// ================= LOAD ACCESSIONS =================
function loadCompareOptions() {
    console.log("Loading compare options...");

    const acc1 = document.getElementById("acc1");
    const acc2 = document.getElementById("acc2");

    if (!acc1 || !acc2) return;

    fetch('/accessions')
        .then(res => res.json())
        .then(data => {

            console.log("Accessions:", data.length);

            acc1.innerHTML = '<option value="">Select Genome 1</option>';
            acc2.innerHTML = '<option value="">Select Genome 2</option>';

            data.forEach(a => {
                const opt1 = document.createElement("option");
                opt1.value = a;
                opt1.textContent = a;

                const opt2 = opt1.cloneNode(true);

                acc1.appendChild(opt1);
                acc2.appendChild(opt2);
            });
        })
        .catch(err => console.error("Accessions error:", err));
}

// ================= KEYBOARD =================
// ================= KEYBOARD =================
document.addEventListener("keydown", function (e) {

    // ===== COMPARE PAGE =====
    const acc1 = document.getElementById("acc1");
    const acc2 = document.getElementById("acc2");

    if (acc1 && acc2) {
        if (e.key === "Enter") {
            e.preventDefault();
            compareGenomes();
        }
        return; // stop here → don't trigger search
    }

    // ===== SEARCH PAGE =====
    const box = document.getElementById("suggestions");
    if (!box) return;

    const items = box.children;

    if (box.style.display === "block") {

        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            highlight();
        }

        else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            highlight();
        }

        else if (e.key === "Enter") {
            e.preventDefault();

            if (selectedIndex > -1) {
                selectSuggestion(suggestionsData[selectedIndex]);
            } else {
                searchData();
            }
        }
    }

    else if (e.key === "Enter") {
        e.preventDefault();
        searchData();
    }
});


// ================= INIT =================
window.onload = function () {

    // ===== SEARCH PAGE =====
    const searchBox = document.getElementById("searchBox");

    if (searchBox) {
        searchBox.addEventListener("input", autocompleteSpecies);

        loadFilters();
        loadStats();

        document.getElementById("sourceFilter")?.addEventListener("change", () => searchData(1));
        document.getElementById("countryFilter")?.addEventListener("change", () => searchData(1));
        document.getElementById("speciesFilter")?.addEventListener("change", () => searchData(1));
        document.getElementById("assemblyFilter")?.addEventListener("change", () => searchData(1));
        document.getElementById("sortFilter")?.addEventListener("change", () => searchData(1));

        searchData(1);
    }

    // ===== COMPARE PAGE =====
    const acc1 = document.getElementById("acc1");
    const acc2 = document.getElementById("acc2");

    if (acc1 && acc2) {
        loadCompareOptions();
    }
};
