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

        const assemblyLevelSelect = document.getElementById("assemblyLevelFilter");

        if (assemblyLevelSelect) {
            assemblyLevelSelect.innerHTML = `<option value="">All Assembly Levels</option>`;

        data.assembly_levels.forEach(a => {
            assemblyLevelSelect.innerHTML += `<option value="${a}">${a}</option>`;
    });
}
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

        g.innerText = data.total;
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
    const assemblyLevel = document.getElementById("assemblyLevelFilter")?.value || "";
    const sort = document.getElementById("sortFilter")?.value || "";

    const suggestions = document.getElementById("suggestions");
    if (suggestions) suggestions.style.display = "none";

const url = `/search?query=${query}&source=${source}&country=${country}&assembly_type=${assembly}&assembly_level=${assemblyLevel}&sort=${sort}&page=${page}`;
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
    data.forEach(item => {
    table.innerHTML += `
        <tr>
            <td>
            <a href="/genome/${item.assembly_accession}">
                ${item.assembly_accession}
            </a>
            </td>
            <td>${item.species_final}</td>
            <td>${item.source_final}</td>
            <td>${item.country_final}</td>
            <td>${item.assembly_level || "unknown"}</td>
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

    const acc1 = document.getElementById("acc1").value;
    const acc2 = document.getElementById("acc2").value;

    if (!acc1 || !acc2) {
        alert("Enter both accessions");
        return;
    }

    document.getElementById("compareResult").innerHTML = "Loading...";

    fetch(`/compare?acc1=${acc1}&acc2=${acc2}`)
        .then(res => res.json())
        .then(data => {

            console.log(data);  // ✅ keep debug here

            document.getElementById("compareResult").innerHTML = `
<div class="compare-card">
    <h3>${acc1} vs ${acc2}</h3>

    <table class="compare-table">
        <tr>
            <th>Feature</th>
            <th>${acc1}</th>
            <th>${acc2}</th>
        </tr>
        <tr>
            <td>Genome Size</td>
            <td>${Number(data.genome_size_1).toLocaleString()}</td>
            <td>${Number(data.genome_size_2).toLocaleString()}</td>
        </tr>
        <tr>
            <td>GC Content</td>
            <td>${data.gc_1 || "NA"}</td>
            <td>${data.gc_2 || "NA"}</td>
        </tr>
    </table>
</div>
`;
        })
        .catch(err => {
            console.error(err);
            document.getElementById("compareResult").innerHTML = "Error loading data";
        });
}
// ================= LOAD ACCESSIONS =================
function loadCompareOptions() {
    console.log("Loading compare options...");

    const list1 = document.getElementById("accList1");
    const list2 = document.getElementById("accList2");

    if (!list1 || !list2) return;

    fetch('/accessions')
        .then(res => res.json())
        .then(data => {

            console.log("Accessions:", data.length);

            list1.innerHTML = "";
            list2.innerHTML = "";

            data.forEach(a => {
                const opt1 = document.createElement("option");
                opt1.value = a;

                const opt2 = document.createElement("option");
                opt2.value = a;

                list1.appendChild(opt1);
                list2.appendChild(opt2);
            });

            // 🔥 FORCE REATTACH FIX
            const input1 = document.getElementById("acc1");
            const input2 = document.getElementById("acc2");

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

        const val1 = acc1.value.trim();
        const val2 = acc2.value.trim();

        if (!val1 || !val2) return;  // ✅ prevent empty compare

        e.preventDefault();
        compareGenomes();
    }
    return;
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
function loadChart() {
    const ctx = document.getElementById("genomeChart");
    if (!ctx || typeof Chart === "undefined") return;

    fetch("/stats")
        .then(res => res.json())
        .then(data => {
            new Chart(ctx, {
                type: "bar",
                data: {
                    labels: ["Genomes", "Species", "Countries"],
                    datasets: [{
                        label: "Database Stats",
                        data: [data.total, data.species, data.countries]
                    }]
                }
            });
        });
}

// ================= INIT =================
window.onload = function () {

    // ===== HOME PAGE =====
    if (document.getElementById("totalGenomes")) {
        loadStats();
    }
    // ===== SEARCH PAGE =====
    const searchBox = document.getElementById("searchBox");

    if (searchBox) {
        searchBox.addEventListener("input", autocompleteSpecies);

        loadFilters();

        document.getElementById("sourceFilter")?.addEventListener("change", () => searchData(1));
        document.getElementById("countryFilter")?.addEventListener("change", () => searchData(1));
        document.getElementById("assemblyFilter")?.addEventListener("change", () => searchData(1));
        document.getElementById("assemblyLevelFilter")?.addEventListener("change", () => searchData(1));
        document.getElementById("sortFilter")?.addEventListener("change", () => searchData(1));

        searchData(1);
        loadChart();
   }

    // ===== COMPARE PAGE =====
    const acc1 = document.getElementById("acc1");
    const acc2 = document.getElementById("acc2");

    if (acc1 && acc2) {
        loadCompareOptions();
    }
};
