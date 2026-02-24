document.getElementById('gameForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // 1. Grab values from the form
    const newEntry = {
        franchise: document.getElementById('franchiseName').value,
        title: document.getElementById('gameTitle').value,
        year: document.getElementById('releaseYear').value,
        status: document.getElementById('status').value,
        timestamp: new Date().toISOString()
    };

    // 2. In a real app, this sends to a database. 
    // For now, we will log it to the console so you can see it working!
    console.log("New Game Data Prepared:", newEntry);

    // 3. Show success message
    const msg = document.getElementById('statusMessage');
    msg.classList.remove('hidden');
    
    // Clear form
    this.reset();
    
    setTimeout(() => msg.classList.add('hidden'), 3000);
});