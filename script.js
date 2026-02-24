// This function runs every time the page loads
window.onload = function() {
    displayLibrary();
};

document.getElementById('gameForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // 1. Create the new game object
    const newEntry = {
        franchise: document.getElementById('franchiseName').value,
        title: document.getElementById('gameTitle').value,
        year: document.getElementById('releaseYear').value,
        status: document.getElementById('status').value,
        id: Date.now() // Unique ID based on time
    };

    // 2. Get existing games from "Memory" or start fresh
    let library = JSON.parse(localStorage.getItem('myGameLibrary')) || [];

    // 3. Add the new game to our list
    library.push(newEntry);

    // 4. Save the updated list back to "Memory"
    localStorage.setItem('myGameLibrary', JSON.stringify(library));

    // 5. Success feedback
    document.getElementById('statusMessage').classList.remove('hidden');
    this.reset();
    setTimeout(() => document.getElementById('statusMessage').classList.add('hidden'), 3000);
    
    // Refresh the visual list
    displayLibrary();
});

// Simple function to show what's in our memory
function displayLibrary() {
    let library = JSON.parse(localStorage.getItem('myGameLibrary')) || [];
    console.log("Current Library in Memory:", library);
    // (We will add the code to draw the cards on screen in the next step!)
}