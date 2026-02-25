// 1. App State Tracker
let state = {
    view: 'franchises', 
    activeFranchiseId: null,
    activeSubId: null,
    activeCategory: null,
    editingGameId: null 
};

// --- NEW: The Visual Style Guide ---
const getStatusColor = (status) => {
    switch (status) {
        case 'Completed': return 'text-green-700 font-extrabold'; // Dark, deep green
        case 'Explored': return 'text-green-400 font-bold';       // Light green
        case 'Tried': return 'text-blue-400';                    // Blue
        case 'Paused': return 'text-orange-400';                 // Orange
        case 'Retired': return 'text-red-500';                   // Red
        default: return 'text-gray-500 opacity-70';              // Faded/Gray for Not Played
    }
};

window.onload = function() {
    loadLibrary();
    
    // NEW: Listen for changes on the Franchise dropdown
    const franchiseSelect = document.getElementById('gFranchise');
    if (franchiseSelect) {
        franchiseSelect.addEventListener('change', updateParentDropdown);
    }
};

async function loadLibrary() {
    let vaultData = JSON.parse(localStorage.getItem('myVaultData'));

    if (!vaultData) {
        const response = await fetch('games.json');
        vaultData = await response.json();
        localStorage.setItem('myVaultData', JSON.stringify(vaultData));
    }

    const container = document.getElementById('gameGrid');
    container.innerHTML = ''; 

    // --- Routing ---
    if (state.view === 'franchises') {
        renderFranchises(vaultData.franchises, container);
    } else if (state.view === 'mainGames') {
        const franchise = vaultData.franchises.find(f => f.id === state.activeFranchiseId);
        renderFranchises([franchise], container); 
        renderMainGames(franchise.mainGames, container);
    } else if (state.view === 'allGames') {
        const franchise = vaultData.franchises.find(f => f.id === state.activeFranchiseId);
        renderFranchises([franchise], container); 
        renderAllGames(franchise, container); 
    } else if (state.view === 'wishlist') {
        renderWishlist(vaultData.franchises, container); 
    }
}

// 2. Render Layer 1 (Franchise)
function renderFranchises(franchises, container) {
    franchises.forEach(franchise => {
        let realPercentage = calculateExploredPercentage(franchise);

        let buttonsHtml = state.view === 'franchises' 
            ? `<button onclick="openMainGames('${franchise.id}')" class="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded font-bold shadow transition">Main Games</button>
               <button onclick="openAllGames('${franchise.id}')" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded font-bold shadow transition">All Games</button>`
            : `<button onclick="goBack()" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded font-bold shadow transition">← Close Branch</button>`;

            container.innerHTML += `
            <div class="bg-gray-800 rounded-xl border border-gray-700 flex flex-col md:flex-row overflow-hidden shadow-lg mb-4 hover:border-gray-500 transition">
                
                <div class="p-6 flex-1 flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-4 gap-4">
                            <h2 class="text-4xl font-bold text-white break-words">${franchise.name}</h2>
                            <div class="flex gap-2 shrink-0">
                                <button onclick="deleteFranchise('${franchise.id}')" title="Delete Franchise" class="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded flex items-center justify-center transition border border-gray-600 shadow-md text-sm">🗑️</button>
                                <button onclick="openFranchiseEdit('${franchise.id}')" title="Edit Franchise" class="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded flex items-center justify-center transition border border-gray-600 shadow-md text-sm">✏️</button>
                            </div>
                        </div>

                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-14 h-14 rounded-full border-4 border-green-500 flex items-center justify-center text-lg font-bold">${realPercentage}%</div>
                            <span class="text-gray-400 font-semibold uppercase tracking-wider text-sm">Explored</span>
                        </div>
                    </div>
                    <div class="flex gap-4 mt-8">
                        ${buttonsHtml}
                    </div>
                </div>

                <div class="w-full md:w-[200px] lg:w-[240px] flex-shrink-0 bg-gray-900 border-t md:border-t-0 md:border-l border-gray-700">
                    <img src="${franchise.coverImg}" class="w-full h-full object-cover aspect-[80/107] opacity-90 hover:opacity-100 transition">
                </div>
            </div>
        `;
    });
}

// 3. Render Layer 2 (Main Games Branch)
function renderMainGames(games, container) {
    let gamesHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pl-4 border-l-4 border-purple-600 ml-8 mb-12">`;
    
    games.forEach(game => {
        gamesHTML += `
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow flex flex-col relative hover:border-gray-500 transition">
                
                <div class="absolute top-2 left-2 flex gap-1 z-20">
                    <button onclick="deleteGame('${game.id}')" title="Delete" class="bg-gray-800/90 hover:bg-gray-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition border border-gray-600 shadow-md text-xs">🗑️</button>
                    <button onclick="openEditModal('${game.id}')" title="Edit" class="bg-gray-800/90 hover:bg-gray-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition border border-gray-600 shadow-md text-xs">✏️</button>
                </div>

                <img src="${game.coverImg}" class="w-full aspect-[80/107] object-cover rounded mb-3 shadow-md">
                <h3 class="font-bold text-lg text-white leading-tight mb-1">${game.title}</h3>
                
                <div class="mt-auto pt-2 border-t border-gray-700 mb-3">
                    <p class="text-gray-400 text-xs mb-1">${game.year} | <span class="text-gray-300 font-semibold">${game.platform}</span></p>
                    <div class="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span class="${getStatusColor(game.status)}">${game.status || 'Not Played'}</span>
                        <span class="text-yellow-500">Score: ${game.score || '-'}</span>
                    </div>
                </div>
                
                <div class="flex flex-wrap gap-2 mt-auto">
                    <button onclick="toggleSubBranch('${game.id}', 'ports')" class="text-[10px] bg-gray-700 px-2 py-1 rounded hover:bg-purple-500 text-white transition">Ports</button>
                    <button onclick="toggleSubBranch('${game.id}', 'remakes')" class="text-[10px] bg-gray-700 px-2 py-1 rounded hover:bg-purple-500 text-white transition">Remakes</button>
                    <button onclick="toggleSubBranch('${game.id}', 'sequels')" class="text-[10px] bg-gray-700 px-2 py-1 rounded hover:bg-purple-500 text-white transition">Sequels</button>
                </div>
            </div>
        `;

        if (state.activeSubId === game.id && game[state.activeCategory]) {
            gamesHTML += renderSubBranch(game[state.activeCategory], state.activeCategory);
        }
    });
    
    gamesHTML += `</div>`;
    container.innerHTML += gamesHTML;
}

// 4. Render Layer 3 (The Sub-Branch)
function renderSubBranch(itemsList, categoryName) {
    let borderColor = categoryName === 'ports' ? 'border-green-500' : categoryName === 'remakes' ? 'border-blue-500' : 'border-yellow-500';
    let subHTML = `<div class="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 ${borderColor} ml-4 mt-2 mb-4">`;
    
    itemsList.forEach(item => {
        subHTML += `
            <div class="bg-gray-700 p-3 rounded-lg flex gap-4 border border-gray-600 shadow-inner">
                <img src="${item.coverImg}" class="w-16 aspect-[80/107] object-cover rounded shadow-sm">
                <div class="flex flex-col justify-center">
                    <h4 class="font-bold text-white text-sm mb-1">${item.title} (${item.year})</h4>
                    <p class="text-gray-300 text-xs font-bold mb-3">${item.platform}</p>
                    <div class="flex gap-2">
                        <span class="bg-gray-900 text-xs px-2 py-1 rounded text-gray-300 border border-gray-600">Status: ${item.status || 'N/A'}</span>
                        <span class="bg-gray-900 text-xs px-2 py-1 rounded text-white font-bold border border-gray-600">Score: ${item.score || '-'}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    subHTML += `</div>`;
    return subHTML;
}

// --- NEW: Render the Flat "All Games" Grid ---
function renderAllGames(franchise, container) {
    let allGamesList = [];

    if (franchise.mainGames) {
        franchise.mainGames.forEach(game => {
            allGamesList.push({ ...game, type: 'Main Game' });
            if (game.ports) game.ports.forEach(p => allGamesList.push({ ...p, type: 'Port' }));
            if (game.remakes) game.remakes.forEach(r => allGamesList.push({ ...r, type: 'Remake' }));
            if (game.sequels) game.sequels.forEach(s => allGamesList.push({ ...s, type: 'Sequel' }));
        });
    }

    allGamesList.sort((a, b) => a.year - b.year);

    let html = `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6 mb-12">`;
    
    allGamesList.forEach(item => {
        let badgeColor = 'bg-gray-600';
        if (item.type === 'Main Game') badgeColor = 'bg-purple-600';
        if (item.type === 'Port') badgeColor = 'bg-green-600';
        if (item.type === 'Remake') badgeColor = 'bg-blue-600';
        if (item.type === 'Sequel') badgeColor = 'bg-yellow-600';

        html += `
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow flex flex-col relative hover:border-gray-500 transition">
                
                <div class="absolute top-2 left-2 flex gap-1 z-20">
                    <button onclick="deleteGame('${item.id}')" title="Delete" class="bg-gray-800/90 hover:bg-gray-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition border border-gray-600 shadow-md text-xs">🗑️</button>
                    <button onclick="openEditModal('${item.id}')" title="Edit" class="bg-gray-800/90 hover:bg-gray-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition border border-gray-600 shadow-md text-xs">✏️</button>
                </div>
<span class="absolute top-2 right-2 ${badgeColor} text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-10">${item.type}</span>
                <img src="${item.coverImg}" class="w-full aspect-[80/107] object-cover rounded mb-3 shadow-md">
                <h3 class="font-bold text-lg text-white leading-tight mb-1">${item.title}</h3>
                
                <div class="mt-auto pt-2 border-t border-gray-700 mb-3">
                    <p class="text-gray-400 text-xs mb-1">${item.year} | <span class="text-gray-300 font-semibold">${item.platform}</span></p>
                    <div class="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span class="${getStatusColor(item.status)}">${item.status || 'Not Played'}</span>
                        <span class="text-yellow-500">Score: ${item.score || '-'}</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML += html;
}

// --- NEW: The Math Accountant ---
function calculateExploredPercentage(franchise) {
    let totalGames = 0;
    let exploredGames = 0;

    if (!franchise.mainGames) return 0;

    const checkStatus = (game) => {
        totalGames++;
        if (game.status === 'Explored' || game.status === 'Completed') {
            exploredGames++;
        }
    };

    franchise.mainGames.forEach(game => {
        checkStatus(game);
        if (game.ports) game.ports.forEach(checkStatus);
        if (game.remakes) game.remakes.forEach(checkStatus);
        if (game.sequels) game.sequels.forEach(checkStatus);
    });

    if (totalGames === 0) return 0;

    return Math.round((exploredGames / totalGames) * 100);
}

// --- NEW: Render the Global Wishlist ---
function renderWishlist(franchises, container) {
    let wishlistGames = [];

    franchises.forEach(f => {
        if (f.mainGames) {
            f.mainGames.forEach(g => {
                if (g.ownership === 'Wishlisted') wishlistGames.push({...g, franchiseName: f.name, type: 'Main Game'});
                if (g.ports) g.ports.forEach(p => { if (p.ownership === 'Wishlisted') wishlistGames.push({...p, franchiseName: f.name, type: 'Port'}); });
                if (g.remakes) g.remakes.forEach(r => { if (r.ownership === 'Wishlisted') wishlistGames.push({...r, franchiseName: f.name, type: 'Remake'}); });
                if (g.sequels) g.sequels.forEach(s => { if (s.ownership === 'Wishlisted') wishlistGames.push({...s, franchiseName: f.name, type: 'Sequel'}); });
            });
        }
    });

    if (wishlistGames.length === 0) {
        container.innerHTML = `
            <div class="text-center py-20 bg-gray-800 rounded-xl border border-gray-700 mt-8">
                <h2 class="text-3xl text-gray-300 font-bold mb-4">Your wishlist is empty!</h2>
                <p class="text-gray-500">Games marked with the "Wishlisted" ownership status will appear here.</p>
            </div>
        `;
        return;
    }

    wishlistGames.sort((a, b) => a.year - b.year);

    let html = `
        <div class="mb-6 flex justify-between items-center mt-4">
            <h2 class="text-3xl font-bold text-yellow-500 flex items-center gap-2">⭐ My Wishlist</h2>
            <button onclick="goHome()" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded font-bold shadow transition">← Back to Vault</button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
    `;

    wishlistGames.forEach(item => {
        html += `
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow flex flex-col relative hover:border-gray-500 transition">
            
            <div class="absolute top-2 left-2 flex gap-1 z-20">
                <button onclick="deleteGame('${item.id}')" title="Delete" class="bg-gray-800/90 hover:bg-gray-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition border border-gray-600 shadow-md text-xs">🗑️</button>
                <button onclick="openEditModal('${item.id}')" title="Edit" class="bg-gray-800/90 hover:bg-gray-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition border border-gray-600 shadow-md text-xs">✏️</button>
            </div>

            <img src="${item.coverImg}" class="w-full aspect-[80/107] object-cover rounded mb-3 shadow-md">
            <h3 class="font-bold text-lg text-white leading-tight mb-1">${item.title}</h3>
            
            <div class="mt-auto pt-2 border-t border-gray-700 mb-3">
                <p class="text-gray-400 text-xs mb-1">${item.year} | <span class="text-gray-300 font-semibold">${item.platform}</span></p>
                <div class="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span class="${getStatusColor(item.status)}">${item.status || 'Not Played'}</span>
                    <span class="text-yellow-500">Score: ${item.score || '-'}</span>
                </div>
            </div>
        </div>
    `;
    });

    html += `</div>`;
    container.innerHTML = html;
}
// --- NEW: DATA MANAGEMENT (EXPORT / IMPORT) ---
function exportVault() {
    // 1. Grab the data from the browser
    const vaultData = localStorage.getItem('myVaultData');
    if (!vaultData) {
        alert("Your vault is empty!");
        return;
    }

    // 2. Turn it into a downloadable text file (Blob)
    const blob = new Blob([vaultData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // 3. Create a fake link, click it automatically, and destroy it
    const a = document.createElement('a');
    a.href = url;
    // Names the file "GameVault_Backup_2024-XX-XX.json"
    a.download = `GameVault_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importVault(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 1. Confirm with the user because this overwrites existing data
    if (!confirm("⚠️ This will overwrite your current vault with the imported backup. Continue?")) {
        event.target.value = ''; // Reset the file input
        return;
    }

    // 2. Read the file
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // 3. Do a quick check to make sure it's actually a Game Vault file
            if (importedData && importedData.franchises) {
                localStorage.setItem('myVaultData', JSON.stringify(importedData));
                alert("Vault imported successfully!");
                loadLibrary(); // Redraw the screen!
            } else {
                alert("Error: Invalid backup file. It doesn't look like Game Vault data.");
            }
        } catch (err) {
            alert("Error reading file. Make sure it's a valid JSON backup.");
        }
        event.target.value = ''; // Reset the file input so you can import the same file again later if needed
    };
    reader.readAsText(file);
}
// --- Navigation Helpers ---
function openWishlist() {
    state.view = 'wishlist';
    loadLibrary();
}

function goHome() {
    state.view = 'franchises';
    state.activeFranchiseId = null;
    state.activeSubId = null;
    state.activeCategory = null;
    loadLibrary();
}

function openMainGames(franchiseId) {
    state.view = 'mainGames';
    state.activeFranchiseId = franchiseId;
    loadLibrary();
}

function openAllGames(franchiseId) {
    state.view = 'allGames';
    state.activeFranchiseId = franchiseId;
    loadLibrary();
}

function goBack() {
    state.view = 'franchises';
    state.activeFranchiseId = null;
    state.activeSubId = null; 
    state.activeCategory = null;
    loadLibrary();
}

function toggleSubBranch(gameId, category) {
    if (state.activeSubId === gameId && state.activeCategory === category) {
        state.activeSubId = null;
        state.activeCategory = null;
    } else {
        state.activeSubId = gameId;
        state.activeCategory = category;
    }
    loadLibrary();
}

// --- The Delete Function ---
function deleteGame(gameId) {
    if (!confirm("Are you sure you want to delete this game from the vault?")) {
        return; 
    }

    let vaultData = JSON.parse(localStorage.getItem('myVaultData'));

    vaultData.franchises.forEach(franchise => {
        if (franchise.mainGames) {
            franchise.mainGames = franchise.mainGames.filter(g => g.id !== gameId);
            
            franchise.mainGames.forEach(game => {
                if (game.ports) game.ports = game.ports.filter(p => p.id !== gameId);
                if (game.remakes) game.remakes = game.remakes.filter(r => r.id !== gameId);
                if (game.sequels) game.sequels = game.sequels.filter(s => s.id !== gameId);
            });
        }
    });

    localStorage.setItem('myVaultData', JSON.stringify(vaultData));
    loadLibrary();
}

// --- FRANCHISE ADMIN ACTIONS ---
function deleteFranchise(id) {
    if (!confirm("⚠️ WARNING: This will delete the entire Franchise and ALL its games. Are you 100% sure?")) return;
    let vaultData = JSON.parse(localStorage.getItem('myVaultData'));
    vaultData.franchises = vaultData.franchises.filter(f => f.id !== id);
    localStorage.setItem('myVaultData', JSON.stringify(vaultData));
    loadLibrary();
}

function openFranchiseEdit(id) {
    let vaultData = JSON.parse(localStorage.getItem('myVaultData'));
    let f = vaultData.franchises.find(item => item.id === id);
    if (!f) return;

    state.editingGameId = id; 
    
    document.getElementById('addModal').classList.remove('hidden');
    document.querySelector('input[name="entryType"][value="franchise"]').checked = true;
    document.querySelector('input[name="entryType"][value="game"]').disabled = true; 
    toggleFormFields();

    document.querySelector('#addModal h2').innerText = "Edit Franchise";
    document.getElementById('fTitle').value = f.name;
    document.getElementById('fCover').value = f.coverImg.includes('placehold.co') ? '' : f.coverImg;
}

// ==========================================
// --- MODAL & DYNAMIC FORM LOGIC ---
// ==========================================
// --- NEW: Dynamic Dropdown Linker ---
function updateParentDropdown() {
    let vaultData = JSON.parse(localStorage.getItem('myVaultData'));
    const franchiseId = document.getElementById('gFranchise').value;
    const parentSelect = document.getElementById('gParent');
    
    parentSelect.innerHTML = ''; // Clear the old static list!
    
    if (!vaultData || !franchiseId) return;
    
    // Find the currently selected franchise
    const franchise = vaultData.franchises.find(f => f.id === franchiseId);
    
    // Populate the dropdown with its Main Games
    if (franchise && franchise.mainGames) {
        franchise.mainGames.forEach(game => {
            parentSelect.innerHTML += `<option value="${game.id}">${game.title}</option>`;
        });
    }
}
function openModal() {
    state.editingGameId = null; 
    document.querySelector('#addModal h2').innerText = "Add New Entry";
    
    document.getElementById('gFranchise').disabled = false;
    document.getElementById('gCategory').disabled = false;
    document.getElementById('gParent').disabled = false;
    document.querySelector('input[name="entryType"][value="franchise"]').disabled = false;

    document.getElementById('addModal').classList.remove('hidden');
    
    let vaultData = JSON.parse(localStorage.getItem('myVaultData'));
    const franchiseSelect = document.getElementById('gFranchise');
    if (franchiseSelect && vaultData) {
        franchiseSelect.innerHTML = ''; 
        vaultData.franchises.forEach(f => {
            franchiseSelect.innerHTML += `<option value="${f.id}">${f.name}</option>`;
        });
    }
}
// ... inside openModal() ...
let vaultData = JSON.parse(localStorage.getItem('myVaultData'));
const franchiseSelect = document.getElementById('gFranchise');
if (franchiseSelect && vaultData) {
    franchiseSelect.innerHTML = ''; 
    vaultData.franchises.forEach(f => {
        franchiseSelect.innerHTML += `<option value="${f.id}">${f.name}</option>`;
    });
    
    // NEW: Populate the 'Attach to' list for the first franchise!
    updateParentDropdown(); 
}

function closeModal() {
    document.getElementById('addModal').classList.add('hidden');
    document.getElementById('universalForm').reset(); 
    toggleFormFields(); 
}

function toggleFormFields() {
    const isGame = document.querySelector('input[name="entryType"]:checked').value === 'game';
    const gameFields = document.getElementById('gameFields');
    const franchiseFields = document.getElementById('franchiseFields');

    if (isGame) {
        gameFields.classList.remove('hidden');
        franchiseFields.classList.add('hidden');
    } else {
        gameFields.classList.add('hidden');
        franchiseFields.classList.remove('hidden');
    }
}

// --- The Editor Function ---
function openEditModal(gameId) {
    let vaultData = JSON.parse(localStorage.getItem('myVaultData'));
    let targetGame = null;

    vaultData.franchises.forEach(f => {
        if (f.mainGames) {
            f.mainGames.forEach(g => {
                if (g.id === gameId) targetGame = g;
                if (g.ports) g.ports.forEach(p => { if (p.id === gameId) targetGame = p; });
                if (g.remakes) g.remakes.forEach(r => { if (r.id === gameId) targetGame = r; });
                if (g.sequels) g.sequels.forEach(s => { if (s.id === gameId) targetGame = s; });
            });
        }
    });

    if (!targetGame) return;

    state.editingGameId = gameId; 
    
    document.getElementById('addModal').classList.remove('hidden');
    document.querySelector('input[name="entryType"][value="game"]').checked = true;
    document.querySelector('input[name="entryType"][value="franchise"]').disabled = true; 
    toggleFormFields();

    document.getElementById('gTitle').value = targetGame.title;
    document.getElementById('gYear').value = targetGame.year;
    document.getElementById('gPlatform').value = targetGame.platform;
    document.getElementById('gScore').value = targetGame.score !== '-' ? targetGame.score : '';
    document.getElementById('gDev').value = targetGame.developer !== 'Unknown' ? targetGame.developer : '';
    document.getElementById('gPlayStatus').value = targetGame.status || 'Not Played';
    document.getElementById('gOwnership').value = targetGame.ownership || 'Not Owned';
    
    let cover = targetGame.coverImg;
    document.getElementById('gCover').value = cover.includes('placehold.co') ? '' : cover;

    document.querySelector('#addModal h2').innerText = "Edit Game";
    document.getElementById('gFranchise').disabled = true;
    document.getElementById('gCategory').disabled = true;
    document.getElementById('gParent').disabled = true;
}

// Handling the Save / Update Click
const universalForm = document.getElementById('universalForm');
if (universalForm) {
    universalForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const type = document.querySelector('input[name="entryType"]:checked').value;
        let vaultData = JSON.parse(localStorage.getItem('myVaultData'));

        if (type === 'franchise') {
            const name = document.getElementById('fTitle').value;
            let cover = document.getElementById('fCover').value;
            if (!cover) cover = '[https://placehold.co/400x600?text=](https://placehold.co/400x600?text=)' + name.replace(/ /g, '+');

            if (state.editingGameId && state.editingGameId.startsWith('franchise-')) {
                let f = vaultData.franchises.find(item => item.id === state.editingGameId);
                f.name = name;
                f.coverImg = cover;
            } else {
                const newFranchise = {
                    id: 'franchise-' + Date.now(),
                    name: name,
                    coverImg: cover,
                    mainGames: []
                };
                vaultData.franchises.push(newFranchise);
            }
        } else {
            const tFranchiseId = document.getElementById('gFranchise').value;
            const category = document.getElementById('gCategory').value;
            const title = document.getElementById('gTitle').value;
            const year = parseInt(document.getElementById('gYear').value) || 0;
            const platform = document.getElementById('gPlatform').value;
            const score = document.getElementById('gScore').value || '-';
            const dev = document.getElementById('gDev').value || 'Unknown';
            const parentId = document.getElementById('gParent').value;
            const playStatus = document.getElementById('gPlayStatus').value;
            const ownership = document.getElementById('gOwnership').value;
            
            let customCover = document.getElementById('gCover').value;
            let finalCover = customCover ? customCover : '[https://placehold.co/160x214?text=](https://placehold.co/160x214?text=)' + title.replace(/ /g, '+');

            if (state.editingGameId) {
                const updateGameObject = (game) => {
                    game.title = title;
                    game.year = year;
                    game.platform = platform;
                    game.score = score;
                    game.developer = dev;
                    game.status = playStatus;
                    game.ownership = ownership;
                    game.coverImg = finalCover;
                };

                vaultData.franchises.forEach(f => {
                    if (f.mainGames) {
                        f.mainGames.forEach(g => {
                            if (g.id === state.editingGameId) updateGameObject(g);
                            if (g.ports) g.ports.forEach(p => { if (p.id === state.editingGameId) updateGameObject(p); });
                            if (g.remakes) g.remakes.forEach(r => { if (r.id === state.editingGameId) updateGameObject(r); });
                            if (g.sequels) g.sequels.forEach(s => { if (s.id === state.editingGameId) updateGameObject(s); });
                        });
                    }
                });

            } else {
                const newGame = {
                    id: 'game-' + Date.now(),
                    title: title,
                    year: year,
                    platform: platform,
                    developer: dev, 
                    score: score,   
                    status: playStatus, 
                    ownership: ownership, 
                    coverImg: finalCover 
                };

                let franchise = vaultData.franchises.find(f => f.id === tFranchiseId);

                if (category === 'mainGames') {
                    franchise.mainGames.push(newGame);
                } else {
                    let parentGame = franchise.mainGames.find(g => g.id === parentId);
                    if (parentGame) {
                        if (!parentGame[category]) parentGame[category] = [];
                        parentGame[category].push(newGame);
                    } else {
                        alert("Please select an 'Attach To' parent game!");
                        return;
                    }
                }
            }
        }

        localStorage.setItem('myVaultData', JSON.stringify(vaultData));
        closeModal();
        loadLibrary();
    });
}