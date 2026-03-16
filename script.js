// 1. App State Tracker
const UI_STATE_KEY = 'myVaultUiState';

let state = {
    view: 'franchises',
    activeFranchiseId: null,
    // Legacy single-sub-branch fields are kept for backward compatibility but no longer used
    activeSubId: null,
    activeCategory: null,
    // NEW: per-game, per-category open state for sub-branches
    openSubBranches: {},
    // NEW: filters & sorting per-view
    filters: {
        globalAllGames: {
            franchise: 'All',
            platform: 'All',
            year: 'All',
            genre: 'All',
            sort: 'yearDesc'
        },
        franchiseAllGames: {}, // { [franchiseId]: { sort: 'yearAsc' | 'yearDesc' | 'scoreDesc' | 'scoreAsc' } }
        mainGames: {},         // { [franchiseId]: { sort: 'yearAsc' | 'yearDesc' | 'scoreDesc' | 'scoreAsc' } }
        wishlist: {
            sort: 'yearDesc'
        }
    },
    editingGameId: null,
    // NEW: remembers where an edited game originally lived
    editingContext: null
};

function loadUiState() {
    try {
        const raw = localStorage.getItem(UI_STATE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        // Shallow-merge, but keep default shapes for nested structures
        state = {
            ...state,
            ...saved,
            filters: {
                ...state.filters,
                ...(saved.filters || {}),
                globalAllGames: {
                    ...state.filters.globalAllGames,
                    ...(saved.filters && saved.filters.globalAllGames ? saved.filters.globalAllGames : {})
                },
                wishlist: {
                    ...state.filters.wishlist,
                    ...(saved.filters && saved.filters.wishlist ? saved.filters.wishlist : {})
                },
                franchiseAllGames: saved.filters && saved.filters.franchiseAllGames
                    ? saved.filters.franchiseAllGames
                    : state.filters.franchiseAllGames,
                mainGames: saved.filters && saved.filters.mainGames
                    ? saved.filters.mainGames
                    : state.filters.mainGames
            },
            openSubBranches: saved.openSubBranches || state.openSubBranches
        };
    } catch (e) {
        console.warn('Failed to load UI state, using defaults.', e);
    }
}

function saveUiState() {
    const snapshot = {
        view: state.view,
        activeFranchiseId: state.activeFranchiseId,
        openSubBranches: state.openSubBranches,
        filters: state.filters
    };
    try {
        localStorage.setItem(UI_STATE_KEY, JSON.stringify(snapshot));
    } catch (e) {
        console.warn('Failed to save UI state.', e);
    }
}

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
    loadUiState();
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
    } else if (state.view === 'globalAllGames') {
        renderGlobalAllGames(vaultData.franchises, container);
    }
}

// 2. Render Layer 1 (Franchise Grid)
function renderFranchises(franchises, container) {
    // NEW: Wrap the franchises in a 3-column grid!
    let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 w-full mt-4">`;
    
    franchises.forEach(franchise => {
        let realPercentage = calculateExploredPercentage(franchise);

        let buttonsHtml = state.view === 'franchises' 
            ? `<button onclick="openMainGames('${franchise.id}')" class="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded font-bold shadow transition w-full">Main Games</button>
               <button onclick="openAllGames('${franchise.id}')" class="bg-gray-700 hover:bg-gray-600 text-white text-xs px-4 py-2 rounded font-bold shadow transition w-full">All Games</button>`
            : `<button onclick="goBack()" class="bg-gray-700 hover:bg-gray-600 text-white text-xs px-4 py-2 rounded font-bold shadow transition w-full">← Close Branch</button>`;

        // The new vertical, compact card layout
        html += `
            <div class="bg-gray-800 rounded-xl border border-gray-700 flex flex-col overflow-hidden shadow-lg relative hover:border-gray-500 transition">
                
                <div class="absolute top-2 left-2 flex gap-1 z-20">
                    <button onclick="deleteFranchise('${franchise.id}')" title="Delete Franchise" class="bg-gray-900/80 hover:bg-red-600 text-white w-7 h-7 rounded flex items-center justify-center transition border border-gray-600 shadow-md text-xs">🗑️</button>
                    <button onclick="openFranchiseEdit('${franchise.id}')" title="Edit Franchise" class="bg-gray-900/80 hover:bg-blue-600 text-white w-7 h-7 rounded flex items-center justify-center transition border border-gray-600 shadow-md text-xs">✏️</button>
                </div>

                <div class="h-48 w-full bg-gray-900 border-b border-gray-700 relative">
                    <img src="${franchise.coverImg}" class="w-full h-full object-cover opacity-90 hover:opacity-100 transition">
                    <div class="absolute bottom-2 right-2 bg-gray-900/90 border-2 border-green-500 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold shadow-lg text-xs">
                        ${realPercentage}%
                    </div>
                </div>

                <div class="p-4 flex flex-col flex-1 justify-between">
                    <h2 class="text-2xl font-bold text-white mb-4 text-center truncate" title="${franchise.name}">${franchise.name}</h2>
                    <div class="flex gap-2 mt-auto">
                        ${buttonsHtml}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    container.innerHTML += html;
}

// 3. Render Layer 2 (Main Games Branch)
function renderMainGames(games, container) {
    const franchiseId = state.activeFranchiseId;
    const mainFilterState = (state.filters.mainGames && state.filters.mainGames[franchiseId]) || { sort: 'yearAsc' };

    // Apply sorting to the main games list
    games = [...games]; // shallow copy so we don't mutate original
    games.sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        const personalA = parseInt(a.personalScore || a.score) || 0;
        const personalB = parseInt(b.personalScore || b.score) || 0;
        const aggA = parseInt(a.aggScore) || 0;
        const aggB = parseInt(b.aggScore) || 0;

        switch (mainFilterState.sort) {
            case 'yearDesc': return yearB - yearA;
            case 'personalDesc': return personalB - personalA;
            case 'personalAsc': return personalA - personalB;
            case 'aggDesc': return aggB - aggA;
            case 'aggAsc': return aggA - aggB;
            case 'yearAsc':
            default:
                return yearA - yearB;
        }
    });

    // Controls bar for sorting
    let controlsHTML = `
        <div class="flex justify-between items-center mt-4 ml-8 mb-2">
            <h2 class="text-lg font-bold text-purple-400">Main Games</h2>
            <div class="flex items-center gap-2 text-xs text-gray-300">
                <span class="uppercase tracking-wider font-bold text-[10px]">Sort By</span>
                <select id="mainGamesSort" onchange="onMainGamesSortChange('${franchiseId}')" class="bg-gray-900 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:border-purple-500 outline-none">
                    <option value="yearAsc" ${mainFilterState.sort === 'yearAsc' ? 'selected' : ''}>Year (Oldest First)</option>
                    <option value="yearDesc" ${mainFilterState.sort === 'yearDesc' ? 'selected' : ''}>Year (Newest First)</option>
                    <option value="personalDesc" ${mainFilterState.sort === 'personalDesc' ? 'selected' : ''}>Personal Score (Highest)</option>
                    <option value="personalAsc" ${mainFilterState.sort === 'personalAsc' ? 'selected' : ''}>Personal Score (Lowest)</option>
                    <option value="aggDesc" ${mainFilterState.sort === 'aggDesc' ? 'selected' : ''}>Aggregate Score (Highest)</option>
                    <option value="aggAsc" ${mainFilterState.sort === 'aggAsc' ? 'selected' : ''}>Aggregate Score (Lowest)</option>
                </select>
            </div>
        </div>
    `;

    let gamesHTML = `${controlsHTML}<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2 pl-4 border-l-4 border-purple-600 ml-8 mb-12">`;
    
    games.forEach(game => {
        // NEW: Smart Conditional Buttons! Only show if they exist and have length > 0
        let portsBtn = (game.ports && game.ports.length > 0) ? `<button onclick="toggleSubBranch('${game.id}', 'ports')" class="text-[10px] bg-gray-700 px-2 py-1 rounded hover:bg-green-500 text-white transition border border-gray-600">Ports (${game.ports.length})</button>` : '';
        let remakesBtn = (game.remakes && game.remakes.length > 0) ? `<button onclick="toggleSubBranch('${game.id}', 'remakes')" class="text-[10px] bg-gray-700 px-2 py-1 rounded hover:bg-blue-500 text-white transition border border-gray-600">Remakes (${game.remakes.length})</button>` : '';
        let sequelsBtn = (game.sequels && game.sequels.length > 0) ? `<button onclick="toggleSubBranch('${game.id}', 'sequels')" class="text-[10px] bg-gray-700 px-2 py-1 rounded hover:bg-yellow-500 text-white transition border border-gray-600">Sequels (${game.sequels.length})</button>` : '';

        gamesHTML += `
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow flex flex-col relative hover:border-gray-500 transition">
                
                <div class="absolute top-2 left-2 flex gap-1 z-20">
                    <button onclick="deleteGame('${game.id}')" title="Delete" class="bg-gray-800/90 hover:bg-gray-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition border border-gray-600 shadow-md text-xs">🗑️</button>
                    <button onclick="openEditModal('${game.id}')" title="Edit" class="bg-gray-800/90 hover:bg-gray-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition border border-gray-600 shadow-md text-xs">✏️</button>
                </div>

                ${hasNotes(game) ? `<div class="absolute top-2 right-2 z-20">
                    <span class="bg-gray-900/90 border border-purple-500 text-purple-300 text-[10px] px-2 py-1 rounded-full shadow-sm">📝 Notes</span>
                </div>` : ''}

                <img src="${game.coverImg}" onclick="openGameDetails('${game.id}')" class="w-full aspect-[80/107] object-cover rounded mb-3 shadow-md cursor-pointer hover:opacity-80 transition" title="Click for details">
                
                <h3 class="font-bold text-lg text-white leading-tight mb-1">${game.title}</h3>
                
                <div class="mt-auto pt-2 border-t border-gray-700 mb-3">
                    <p class="text-gray-400 text-xs mb-1">${game.year} | <span class="text-gray-300 font-semibold">${game.platform}</span></p>
                    <div class="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span class="${getStatusColor(game.status)}">${game.status || 'Not Played'}</span>
                    </div>
                </div>
                
                <div class="flex flex-wrap gap-2 mt-auto">
                    ${portsBtn}
                    ${remakesBtn}
                    ${sequelsBtn}
                </div>
            </div>
        `;

        const openConfig = state.openSubBranches && state.openSubBranches[game.id];
        if (openConfig && game.ports && openConfig.ports) {
            gamesHTML += renderSubBranch(game.ports, 'ports');
        }
        if (openConfig && game.remakes && openConfig.remakes) {
            gamesHTML += renderSubBranch(game.remakes, 'remakes');
        }
        if (openConfig && game.sequels && openConfig.sequels) {
            gamesHTML += renderSubBranch(game.sequels, 'sequels');
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
                <img src="${item.coverImg}" onclick="openGameDetails('${item.id}')" class="w-16 aspect-[80/107] object-cover rounded shadow-sm cursor-pointer hover:opacity-80 transition" title="Click for details">
                <div class="flex flex-col justify-center">
                    <h4 class="font-bold text-white text-sm mb-1">${item.title} (${item.year})</h4>
                    <p class="text-gray-300 text-xs font-bold mb-3">${item.platform}</p>
                    <div class="flex gap-2">
                        <span class="bg-gray-900 text-xs px-2 py-1 rounded text-gray-300 border border-gray-600">Status: ${item.status || 'N/A'}</span>
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

    const franchiseId = franchise.id;
    const faState = (state.filters.franchiseAllGames && state.filters.franchiseAllGames[franchiseId]) || { sort: 'yearAsc' };

    allGamesList.sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        const personalA = parseInt(a.personalScore || a.score) || 0;
        const personalB = parseInt(b.personalScore || b.score) || 0;
        const aggA = parseInt(a.aggScore) || 0;
        const aggB = parseInt(b.aggScore) || 0;

        switch (faState.sort) {
            case 'yearDesc': return yearB - yearA;
            case 'personalDesc': return personalB - personalA;
            case 'personalAsc': return personalA - personalB;
            case 'aggDesc': return aggB - aggA;
            case 'aggAsc': return aggA - aggB;
            case 'yearAsc':
            default:
                return yearA - yearB;
        }
    });

    const controlsHTML = `
        <div class="flex justify-between items-center mt-4 ml-4 mb-2">
            <h2 class="text-lg font-bold text-gray-200">All Games</h2>
            <div class="flex items-center gap-2 text-xs text-gray-300">
                <span class="uppercase tracking-wider font-bold text-[10px]">Sort By</span>
                <select id="franchiseSort" onchange="onFranchiseAllSortChange('${franchiseId}')" class="bg-gray-900 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:border-purple-500 outline-none">
                    <option value="yearAsc" ${faState.sort === 'yearAsc' ? 'selected' : ''}>Year (Oldest First)</option>
                    <option value="yearDesc" ${faState.sort === 'yearDesc' ? 'selected' : ''}>Year (Newest First)</option>
                    <option value="personalDesc" ${faState.sort === 'personalDesc' ? 'selected' : ''}>Personal Score (Highest)</option>
                    <option value="personalAsc" ${faState.sort === 'personalAsc' ? 'selected' : ''}>Personal Score (Lowest)</option>
                    <option value="aggDesc" ${faState.sort === 'aggDesc' ? 'selected' : ''}>Aggregate Score (Highest)</option>
                    <option value="aggAsc" ${faState.sort === 'aggAsc' ? 'selected' : ''}>Aggregate Score (Lowest)</option>
                </select>
            </div>
        </div>
    `;

    let html = `${controlsHTML}<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-2 mb-12">`;
    
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

                ${hasNotes(item) ? `<div class="absolute bottom-2 right-2 z-20">
                    <span class="bg-gray-900/90 border border-purple-500 text-purple-300 text-[10px] px-2 py-1 rounded-full shadow-sm">📝</span>
                </div>` : ''}

                <img src="${item.coverImg}" onclick="openGameDetails('${item.id}')" class="w-full aspect-[80/107] object-cover rounded mb-3 shadow-md cursor-pointer hover:opacity-80 transition" title="Click for details">
                
                <h3 class="font-bold text-lg text-white leading-tight mb-1">${item.title}</h3>
                
                <div class="mt-auto pt-2 border-t border-gray-700 mb-3">
                    <p class="text-gray-400 text-xs mb-1">${item.year} | <span class="text-gray-300 font-semibold">${item.platform}</span></p>
                    <div class="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span class="${getStatusColor(item.status)}">${item.status || 'Not Played'}</span>
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

    const wlState = (state.filters && state.filters.wishlist) || { sort: 'yearDesc' };

    wishlistGames.sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;

        if (wlState.sort === 'yearAsc') return yearA - yearB;
        return yearB - yearA;
    });

    let html = `
        <div class="mb-6 flex justify-between items-center mt-4">
            <h2 class="text-3xl font-bold text-yellow-500 flex items-center gap-2">⭐ My Wishlist</h2>
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 text-xs text-gray-300">
                    <span class="uppercase tracking-wider font-bold text-[10px]">Sort By</span>
                    <select id="wishlistSort" onchange="onWishlistSortChange()" class="bg-gray-900 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:border-yellow-500 outline-none">
                        <option value="yearDesc" ${wlState.sort === 'yearDesc' ? 'selected' : ''}>Year (Newest First)</option>
                        <option value="yearAsc" ${wlState.sort === 'yearAsc' ? 'selected' : ''}>Year (Oldest First)</option>
                    </select>
                </div>
                <button onclick="goHome()" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded font-bold shadow transition">← Back to Vault</button>
            </div>
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

            ${hasNotes(item) ? `<div class="absolute bottom-2 right-2 z-20">
                <span class="bg-gray-900/90 border border-purple-500 text-purple-300 text-[10px] px-2 py-1 rounded-full shadow-sm">📝</span>
            </div>` : ''}

            <img src="${item.coverImg}" onclick="openGameDetails('${item.id}')" class="w-full aspect-[80/107] object-cover rounded mb-3 shadow-md cursor-pointer hover:opacity-80 transition" title="Click for details">
            
            <h3 class="font-bold text-lg text-white leading-tight mb-1">${item.title}</h3>
            
            <div class="mt-auto pt-2 border-t border-gray-700 mb-3">
                <p class="text-gray-400 text-xs mb-1">${item.year} | <span class="text-gray-300 font-semibold">${item.platform}</span></p>
                <div class="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span class="${getStatusColor(item.status)}">${item.status || 'Not Played'}</span>
                </div>
            </div>
            
            <div class="flex flex-wrap gap-2 mt-auto">
                <button onclick="toggleSubBranch('${item.id}', 'ports')" class="text-[10px] bg-gray-700 px-2 py-1 rounded hover:bg-purple-500 text-white transition">Ports</button>
                <button onclick="toggleSubBranch('${item.id}', 'remakes')" class="text-[10px] bg-gray-700 px-2 py-1 rounded hover:bg-purple-500 text-white transition">Remakes</button>
                <button onclick="toggleSubBranch('${item.id}', 'sequels')" class="text-[10px] bg-gray-700 px-2 py-1 rounded hover:bg-purple-500 text-white transition">Sequels</button>
            </div>
        </div>
    `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// --- NEW: Handlers for sort change events ---
function onMainGamesSortChange(franchiseId) {
    const select = document.getElementById('mainGamesSort');
    if (!select) return;
    const sortVal = select.value;
    if (!state.filters.mainGames) state.filters.mainGames = {};
    state.filters.mainGames[franchiseId] = { sort: sortVal };
    saveUiState();
    loadLibrary();
}

function onFranchiseAllSortChange(franchiseId) {
    const select = document.getElementById('franchiseSort');
    if (!select) return;
    const sortVal = select.value;
    if (!state.filters.franchiseAllGames) state.filters.franchiseAllGames = {};
    state.filters.franchiseAllGames[franchiseId] = { sort: sortVal };
    saveUiState();
    loadLibrary();
}

function onWishlistSortChange() {
    const select = document.getElementById('wishlistSort');
    if (!select) return;
    const sortVal = select.value;
    if (!state.filters.wishlist) state.filters.wishlist = {};
    state.filters.wishlist.sort = sortVal;
    saveUiState();
    loadLibrary();
}
// --- NEW: Global All Games View (Dashboard & Grid) ---
function openGlobalAllGames() {
    state.view = 'globalAllGames';
    saveUiState();
    loadLibrary();
}

function renderGlobalAllGames(franchises, container) {
    // 1. Gather EVERY game in the vault and store it globally for the filter engine
    window.masterGamesList = [];
    franchises.forEach(f => {
        if (f.mainGames) {
            f.mainGames.forEach(g => {
                window.masterGamesList.push({...g, franchiseName: f.name, type: 'Main Game'});
                if (g.ports) g.ports.forEach(p => window.masterGamesList.push({...p, franchiseName: f.name, type: 'Port'}));
                if (g.remakes) g.remakes.forEach(r => window.masterGamesList.push({...r, franchiseName: f.name, type: 'Remake'}));
                if (g.sequels) g.sequels.forEach(s => window.masterGamesList.push({...s, franchiseName: f.name, type: 'Sequel'}));
            });
        }
    });

    // 2. Extract unique, sorted lists for the dropdowns automatically
    const platforms = [...new Set(window.masterGamesList.map(g => g.platform).filter(Boolean))].sort();
    const years = [...new Set(window.masterGamesList.map(g => g.year).filter(Boolean))].sort((a, b) => b - a);
    const franchiseNames = [...new Set(window.masterGamesList.map(g => g.franchiseName))].sort();
    const genres = [...new Set(window.masterGamesList.map(g => g.genre).filter(Boolean))].sort();

    // 3. Build the Header & Filter Dashboard HTML
    const globalFilterDefaults = {
        franchise: 'All',
        platform: 'All',
        year: 'All',
        genre: 'All',
        sort: 'yearDesc'
    };
    const gfStateHeader = state.filters && state.filters.globalAllGames
        ? { ...globalFilterDefaults, ...state.filters.globalAllGames }
        : globalFilterDefaults;
    let html = `
        <div class="mb-6 flex justify-between items-center mt-4 border-b border-gray-700 pb-4">
            <h2 class="text-3xl font-bold text-blue-500 flex items-center gap-2">🌍 Entire Collection <span id="gameCountBadge" class="text-gray-500 text-lg">(${window.masterGamesList.length} games)</span></h2>
            <button onclick="goHome()" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded font-bold shadow transition">← Back to Franchises</button>
        </div>
        
        <div class="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-8 shadow-lg">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                
                <div>
                    <label class="block text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-wider">Franchise</label>
                    <select id="filterFranchise" onchange="applyGlobalFilters()" class="w-full bg-gray-900 text-white rounded p-2 outline-none border border-gray-600 text-sm focus:border-blue-500 cursor-pointer">
                        <option value="All">All Franchises</option>
                        ${franchiseNames.map(f => `<option value="${f}" ${gfStateHeader.franchise === f ? 'selected' : ''}>${f}</option>`).join('')}
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-wider">Platform</label>
                    <select id="filterPlatform" onchange="applyGlobalFilters()" class="w-full bg-gray-900 text-white rounded p-2 outline-none border border-gray-600 text-sm focus:border-blue-500 cursor-pointer">
                        <option value="All">All Platforms</option>
                        ${platforms.map(p => `<option value="${p}" ${gfStateHeader.platform === p ? 'selected' : ''}>${p}</option>`).join('')}
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-wider">Release Year</label>
                    <select id="filterYear" onchange="applyGlobalFilters()" class="w-full bg-gray-900 text-white rounded p-2 outline-none border border-gray-600 text-sm focus:border-blue-500 cursor-pointer">
                        <option value="All">All Years</option>
                        ${years.map(y => `<option value="${y}" ${String(gfStateHeader.year) === String(y) ? 'selected' : ''}>${y}</option>`).join('')}
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-wider">Genre</label>
                    <select id="filterGenre" onchange="applyGlobalFilters()" class="w-full bg-gray-900 text-white rounded p-2 outline-none border border-gray-600 text-sm focus:border-blue-500 cursor-pointer">
                        <option value="All">All Genres</option>
                        ${genres.map(g => `<option value="${g}" ${gfStateHeader.genre === g ? 'selected' : ''}>${g}</option>`).join('')}
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] text-blue-400 mb-1 font-bold uppercase tracking-wider">Sort By</label>
                    <select id="sortOptions" onchange="applyGlobalFilters()" class="w-full bg-gray-900 text-blue-400 rounded p-2 outline-none border border-blue-600 text-sm focus:border-blue-400 cursor-pointer font-bold">
                        <option value="yearDesc" ${gfStateHeader.sort === 'yearDesc' ? 'selected' : ''}>Year (Newest First)</option>
                        <option value="yearAsc" ${gfStateHeader.sort === 'yearAsc' ? 'selected' : ''}>Year (Oldest First)</option>
                        <option value="personalDesc" ${gfStateHeader.sort === 'personalDesc' ? 'selected' : ''}>Personal Score (Highest)</option>
                        <option value="personalAsc" ${gfStateHeader.sort === 'personalAsc' ? 'selected' : ''}>Personal Score (Lowest)</option>
                        <option value="aggDesc" ${gfStateHeader.sort === 'aggDesc' ? 'selected' : ''}>Aggregate Score (Highest)</option>
                        <option value="aggAsc" ${gfStateHeader.sort === 'aggAsc' ? 'selected' : ''}>Aggregate Score (Lowest)</option>
                    </select>
                </div>

            </div>
        </div>

        <div id="allGamesGrid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12"></div>
    `;

    container.innerHTML = html;
    
    // 4. Trigger the first render to populate the grid
    applyGlobalFilters();
}

function applyGlobalFilters() {
    // 1. Read what the user selected in the dashboard
    const fFranchise = document.getElementById('filterFranchise').value;
    const fPlatform = document.getElementById('filterPlatform').value;
    const fYear = document.getElementById('filterYear').value;
    const fGenre = document.getElementById('filterGenre').value;
    const sortVal = document.getElementById('sortOptions').value;

    // Persist global filters/sorting
    if (state.filters && state.filters.globalAllGames) {
        state.filters.globalAllGames = {
            franchise: fFranchise,
            platform: fPlatform,
            year: fYear,
            genre: fGenre,
            sort: sortVal
        };
        saveUiState();
    }

    // 2. Filter the master list
    let filtered = window.masterGamesList.filter(g => {
        if (fFranchise !== 'All' && g.franchiseName !== fFranchise) return false;
        if (fPlatform !== 'All' && g.platform !== fPlatform) return false;
        if (fYear !== 'All' && g.year != fYear) return false; 
        if (fGenre !== 'All' && g.genre !== fGenre) return false;
        
        return true;
    });

    // 3. Sort the remaining games
    filtered.sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        const personalA = parseInt(a.personalScore || a.score) || 0;
        const personalB = parseInt(b.personalScore || b.score) || 0;
        const aggA = parseInt(a.aggScore) || 0;
        const aggB = parseInt(b.aggScore) || 0;

        if (sortVal === 'yearDesc') return yearB - yearA;
        if (sortVal === 'yearAsc') return yearA - yearB;
        if (sortVal === 'personalDesc') return personalB - personalA;
        if (sortVal === 'personalAsc') return personalA - personalB;
        if (sortVal === 'aggDesc') return aggB - aggA;
        if (sortVal === 'aggAsc') return aggA - aggB;
    });

    // 4. Update the game counter badge next to the Title
    document.getElementById('gameCountBadge').innerText = `(${filtered.length} games)`;

    // 5. Draw the filtered/sorted cards inside the Grid Container
    const grid = document.getElementById('allGamesGrid');
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center p-12 text-gray-500 font-bold border border-gray-700 rounded-lg bg-gray-800 shadow-inner">No games match these filters.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(item => {
        let badgeColor = item.type === 'Main Game' ? 'bg-purple-600' : item.type === 'Port' ? 'bg-green-600' : item.type === 'Remake' ? 'bg-blue-600' : 'bg-yellow-600';

        return `
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow flex flex-col relative hover:border-gray-500 transition">
            
            <div class="absolute top-2 left-2 flex gap-1 z-20">
                <button onclick="deleteGame('${item.id}')" title="Delete" class="bg-gray-800/90 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition border border-gray-600 shadow-md text-xs">🗑️</button>
                <button onclick="openEditModal('${item.id}')" title="Edit" class="bg-gray-800/90 hover:bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition border border-gray-600 shadow-md text-xs">✏️</button>
            </div>

            <span class="absolute top-2 right-2 ${badgeColor} text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-10">${item.type}</span>

            ${hasNotes(item) ? `<div class="absolute bottom-2 right-2 z-20">
                <span class="bg-gray-900/90 border border-purple-500 text-purple-300 text-[10px] px-2 py-1 rounded-full shadow-sm">📝</span>
            </div>` : ''}

            <img src="${item.coverImg}" onclick="openGameDetails('${item.id}')" class="w-full aspect-[80/107] object-cover rounded mb-3 shadow-md cursor-pointer hover:opacity-80 transition" title="Click for details">
            
            <h3 class="font-bold text-lg text-white leading-tight mb-1">${item.title}</h3>
            <p class="text-purple-400 text-[10px] uppercase font-bold tracking-wider mb-2 truncate" title="${item.franchiseName}">${item.franchiseName}</p>
            
            <div class="mt-auto pt-2 border-t border-gray-700 mb-3 flex flex-col justify-between">
                <p class="text-gray-400 text-xs mb-1">${item.year} | <span class="text-gray-300 font-semibold">${item.platform}</span></p>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider ${getStatusColor(item.status)}">${item.status || 'Not Played'}</span>
                    <span class="text-yellow-500 font-black text-sm">${item.score ? '★ ' + item.score : ''}</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
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
    saveUiState();
    loadLibrary();
}

function goHome() {
    state.view = 'franchises';
    state.activeFranchiseId = null;
    state.activeSubId = null;
    state.activeCategory = null;
    state.openSubBranches = {};
    saveUiState();
    loadLibrary();
}

function openMainGames(franchiseId) {
    state.view = 'mainGames';
    state.activeFranchiseId = franchiseId;
    saveUiState();
    loadLibrary();
}

function openAllGames(franchiseId) {
    state.view = 'allGames';
    state.activeFranchiseId = franchiseId;
    saveUiState();
    loadLibrary();
}

function goBack() {
    state.view = 'franchises';
    state.activeFranchiseId = null;
    state.activeSubId = null; 
    state.activeCategory = null;
    state.openSubBranches = {};
    saveUiState();
    loadLibrary();
}

function toggleSubBranch(gameId, category) {
    if (!state.openSubBranches[gameId]) {
        state.openSubBranches[gameId] = {};
    }
    state.openSubBranches[gameId][category] = !state.openSubBranches[gameId][category];
    saveUiState();
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
    state.editingContext = null;
    
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
    state.editingContext = null;
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
        // Ensure parent list is aligned with the first franchise
        updateParentDropdown();
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
const hasNotes = (game) => {
    return !!(game && typeof game.notes === 'string' && game.notes.trim().length > 0);
};

// --- NEW: Game Details Zoom View ---
function openGameDetails(gameId) {
    let vaultData = JSON.parse(localStorage.getItem('myVaultData'));
    let targetGame = null;
    let targetFranchiseName = "";

    // Hunt down the game and note its Franchise
    vaultData.franchises.forEach(f => {
        if (f.mainGames) {
            f.mainGames.forEach(g => {
                if (g.id === gameId) { targetGame = g; targetFranchiseName = f.name; }
                if (g.ports) g.ports.forEach(p => { if (p.id === gameId) { targetGame = p; targetFranchiseName = f.name; }});
                if (g.remakes) g.remakes.forEach(r => { if (r.id === gameId) { targetGame = r; targetFranchiseName = f.name; }});
                if (g.sequels) g.sequels.forEach(s => { if (s.id === gameId) { targetGame = s; targetFranchiseName = f.name; }});
            });
        }
    });

    if (!targetGame) return;

    // Fill the UI
    document.getElementById('dCover').src = targetGame.coverImg;
    document.getElementById('dFranchise').innerText = targetFranchiseName;
    document.getElementById('dTitle').innerText = targetGame.title;
    document.getElementById('dYear').innerText = targetGame.year;
    document.getElementById('dPlatform').innerText = targetGame.platform;
    document.getElementById('dGenre').innerText = targetGame.genre || 'Unknown';
    document.getElementById('dDev').innerText = targetGame.developer || 'Unknown';
    document.getElementById('dOwnership').innerText = targetGame.ownership || 'Not Owned';
    const aggScore = targetGame.aggScore || '-';
    const personalScore = targetGame.personalScore || targetGame.score || '-';
    document.getElementById('dAggScore').innerText = aggScore;
    document.getElementById('dPersonalScore').innerText = personalScore;
    document.getElementById('dNotes').innerText = targetGame.notes || '';
    
    let statusEl = document.getElementById('dStatus');
    statusEl.innerText = targetGame.status || 'Not Played';
    statusEl.className = `font-bold text-sm ${getStatusColor(targetGame.status)}`;

    // Show it!
    document.getElementById('detailsModal').classList.remove('hidden');
}

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.add('hidden');
}
// --- The Editor Function ---
function openEditModal(gameId) {
    let vaultData = JSON.parse(localStorage.getItem('myVaultData'));
    let targetGame = null;
    let sourceFranchiseId = null;
    let sourceCategory = 'mainGames';
    let sourceParentId = null;

    vaultData.franchises.forEach(f => {
        if (f.mainGames) {
            f.mainGames.forEach(g => {
                if (g.id === gameId && !targetGame) {
                    targetGame = g;
                    sourceFranchiseId = f.id;
                    sourceCategory = 'mainGames';
                    sourceParentId = null;
                }
                if (g.ports) g.ports.forEach(p => {
                    if (p.id === gameId && !targetGame) {
                        targetGame = p;
                        sourceFranchiseId = f.id;
                        sourceCategory = 'ports';
                        sourceParentId = g.id;
                    }
                });
                if (g.remakes) g.remakes.forEach(r => {
                    if (r.id === gameId && !targetGame) {
                        targetGame = r;
                        sourceFranchiseId = f.id;
                        sourceCategory = 'remakes';
                        sourceParentId = g.id;
                    }
                });
                if (g.sequels) g.sequels.forEach(s => {
                    if (s.id === gameId && !targetGame) {
                        targetGame = s;
                        sourceFranchiseId = f.id;
                        sourceCategory = 'sequels';
                        sourceParentId = g.id;
                    }
                });
            });
        }
    });

    if (!targetGame) return;

    state.editingGameId = gameId; 
    state.editingContext = {
        franchiseId: sourceFranchiseId,
        category: sourceCategory,
        parentId: sourceParentId
    };
    
    document.getElementById('addModal').classList.remove('hidden');
    document.querySelector('input[name="entryType"][value="game"]').checked = true;
    document.querySelector('input[name="entryType"][value="franchise"]').disabled = true; 
    toggleFormFields();

    // Populate franchise dropdown
    const franchiseSelect = document.getElementById('gFranchise');
    if (franchiseSelect && vaultData) {
        franchiseSelect.innerHTML = '';
        vaultData.franchises.forEach(f => {
            const selectedAttr = f.id === sourceFranchiseId ? 'selected' : '';
            franchiseSelect.innerHTML += `<option value="${f.id}" ${selectedAttr}>${f.name}</option>`;
        });
    }

    // Populate Attach To dropdown for the selected franchise
    updateParentDropdown();
    if (sourceParentId) {
        const parentSelect = document.getElementById('gParent');
        if (parentSelect) parentSelect.value = sourceParentId;
    }

    // Category
    document.getElementById('gCategory').value = sourceCategory;

    // Core fields
    document.getElementById('gTitle').value = targetGame.title;
    document.getElementById('gYear').value = targetGame.year;
    document.getElementById('gPlatform').value = targetGame.platform;
    document.getElementById('gAggScore').value = targetGame.aggScore && targetGame.aggScore !== '-' ? targetGame.aggScore : '';
    const personalForEdit = (targetGame.personalScore || targetGame.score || '');
    document.getElementById('gScore').value = personalForEdit !== '-' ? personalForEdit : '';
    document.getElementById('gDev').value = targetGame.developer !== 'Unknown' ? targetGame.developer : '';
    document.getElementById('gGenre').value = targetGame.genre || '';
    document.getElementById('gPlayStatus').value = targetGame.status || 'Not Played';
    document.getElementById('gOwnership').value = targetGame.ownership || 'Not Owned';
    document.getElementById('gNotes').value = targetGame.notes || '';
    
    let cover = targetGame.coverImg;
    document.getElementById('gCover').value = cover.includes('placehold.co') ? '' : cover;

    document.querySelector('#addModal h2').innerText = "Edit Game";
    // Keep category/franchise/parent editable for moving games
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
            const aggScore = document.getElementById('gAggScore').value || '-';
            const personalScore = document.getElementById('gScore').value || '-';
            const dev = document.getElementById('gDev').value || 'Unknown';
            const genre = document.getElementById('gGenre').value || 'Unknown'; // <-- NEW
            const parentId = document.getElementById('gParent').value;
            const playStatus = document.getElementById('gPlayStatus').value;
            const ownership = document.getElementById('gOwnership').value;
            const notes = document.getElementById('gNotes').value || '';
            
            let customCover = document.getElementById('gCover').value;
            let finalCover = customCover ? customCover : '[https://placehold.co/160x214?text=](https://placehold.co/160x214?text=)' + title.replace(/ /g, '+');

            if (state.editingGameId) {
                const ctx = state.editingContext || {};
                const oldFranchiseId = ctx.franchiseId;
                const oldCategory = ctx.category || 'mainGames';
                const oldParentId = ctx.parentId || null;

                const isLocationChanged =
                    oldFranchiseId !== tFranchiseId ||
                    oldCategory !== category ||
                    (oldCategory !== 'mainGames' && oldParentId !== parentId);

                const findFranchiseById = (id) => vaultData.franchises.find(f => f.id === id);

                const oldFranchise = findFranchiseById(oldFranchiseId) || vaultData.franchises.find(f =>
                    (f.mainGames || []).some(g =>
                        g.id === state.editingGameId ||
                        (g.ports || []).some(p => p.id === state.editingGameId) ||
                        (g.remakes || []).some(r => r.id === state.editingGameId) ||
                        (g.sequels || []).some(s => s.id === state.editingGameId)
                    )
                );
                const newFranchise = findFranchiseById(tFranchiseId) || oldFranchise;

                if (!oldFranchise || !newFranchise) {
                    alert("Could not locate franchise data for this edit.");
                    return;
                }

                let editedGame = null;

                if (oldCategory === 'mainGames') {
                    const idx = oldFranchise.mainGames.findIndex(g => g.id === state.editingGameId);
                    if (idx !== -1) {
                        editedGame = oldFranchise.mainGames[idx];
                        // Detach children if location is changing
                        if (isLocationChanged) {
                            ['ports', 'remakes', 'sequels'].forEach(key => {
                                if (editedGame[key] && editedGame[key].length > 0) {
                                    newFranchise.mainGames = newFranchise.mainGames || [];
                                    newFranchise.mainGames.push(...editedGame[key]);
                                    editedGame[key] = [];
                                }
                            });
                        }
                        // Remove from old location
                        if (isLocationChanged) {
                            oldFranchise.mainGames.splice(idx, 1);
                        }
                    }
                } else {
                    const parentGame = oldFranchise.mainGames.find(g => g.id === oldParentId);
                    if (parentGame && parentGame[oldCategory]) {
                        const arr = parentGame[oldCategory];
                        const idx = arr.findIndex(g => g.id === state.editingGameId);
                        if (idx !== -1) {
                            editedGame = arr[idx];
                            if (isLocationChanged) {
                                ['ports', 'remakes', 'sequels'].forEach(key => {
                                    if (editedGame[key] && editedGame[key].length > 0) {
                                        newFranchise.mainGames = newFranchise.mainGames || [];
                                        newFranchise.mainGames.push(...editedGame[key]);
                                        editedGame[key] = [];
                                    }
                                });
                                arr.splice(idx, 1);
                            }
                        }
                    }
                }

                if (!editedGame) {
                    alert("Could not locate the game being edited.");
                    return;
                }

                // Apply core field updates
                editedGame.title = title;
                editedGame.year = year;
                editedGame.platform = platform;
                editedGame.aggScore = aggScore;
                editedGame.personalScore = personalScore;
                editedGame.score = personalScore; // keep legacy compatibility
                editedGame.developer = dev;
                editedGame.genre = genre;
                editedGame.status = playStatus;
                editedGame.ownership = ownership;
                editedGame.notes = notes;
                editedGame.coverImg = finalCover;

                // Reinsert into new location if moved
                if (isLocationChanged) {
                    if (!newFranchise.mainGames) newFranchise.mainGames = [];

                    if (category === 'mainGames' || !parentId) {
                        newFranchise.mainGames.push(editedGame);
                    } else {
                        let newParent = newFranchise.mainGames.find(g => g.id === parentId);
                        if (!newParent) {
                            // Fallback: if parent cannot be found, make it a main game
                            newFranchise.mainGames.push(editedGame);
                        } else {
                            if (!newParent[category]) newParent[category] = [];
                            newParent[category].push(editedGame);
                        }
                    }
                }

                state.editingGameId = null;
                state.editingContext = null;

            } else {
                const newGame = {
                    id: 'game-' + Date.now(),
                    title: title,
                    year: year,
                    platform: platform,
                    developer: dev,
                    genre: genre, 
                    aggScore: aggScore,
                    personalScore: personalScore,
                    score: personalScore,   
                    status: playStatus, 
                    ownership: ownership, 
                    coverImg: finalCover,
                    notes: notes 
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
// ==========================================
// --- NEW: GLOBAL SEARCH ENGINE ---
// ==========================================
function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const resultsBox = document.getElementById('searchResults');
    
    // Only search if 3 or more characters are typed
    if (query.length < 3) {
        resultsBox.classList.add('hidden');
        return;
    }

    let vaultData = JSON.parse(localStorage.getItem('myVaultData'));
    if (!vaultData) return;

    let matches = [];
    
    // The Great Crawl: Search every franchise and every sub-branch
    vaultData.franchises.forEach(f => {
        if (f.mainGames) {
            f.mainGames.forEach(g => {
                if (g.title.toLowerCase().includes(query)) matches.push({...g, franchiseName: f.name});
                if (g.ports) g.ports.forEach(p => { if (p.title.toLowerCase().includes(query)) matches.push({...p, franchiseName: f.name}); });
                if (g.remakes) g.remakes.forEach(r => { if (r.title.toLowerCase().includes(query)) matches.push({...r, franchiseName: f.name}); });
                if (g.sequels) g.sequels.forEach(s => { if (s.title.toLowerCase().includes(query)) matches.push({...s, franchiseName: f.name}); });
            });
        }
    });

    // Draw the results
    if (matches.length === 0) {
        resultsBox.innerHTML = `<div class="p-4 text-gray-400 text-sm text-center">No games found...</div>`;
    } else {
        // Limit to top 10 results to keep it clean
        resultsBox.innerHTML = matches.slice(0, 10).map(match => `
            <div onclick="openGameDetails('${match.id}'); document.getElementById('searchResults').classList.add('hidden'); document.getElementById('searchInput').value='';" 
                 class="p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer flex items-center gap-4 transition">
                <img src="${match.coverImg}" class="w-10 h-14 object-cover rounded shadow">
                <div>
                    <div class="text-white font-bold text-sm">${match.title}</div>
                    <div class="text-purple-400 text-[10px] uppercase tracking-wider font-bold">${match.franchiseName} • ${match.year}</div>
                </div>
            </div>
        `).join('');
    }
    
    resultsBox.classList.remove('hidden');
}

// Hide the search dropdown if you click anywhere else on the screen
document.addEventListener('click', function(e) {
    if (!e.target.closest('.relative')) {
        const resultsBox = document.getElementById('searchResults');
        if(resultsBox) resultsBox.classList.add('hidden');
    }
});