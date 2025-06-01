function loadData() {
    const notesContainer = document.getElementById('notes-container');
    const background = document.getElementById('background');
    const backgroundColorInput = document.getElementById('background-color');

    if (localStorage.getItem('categories')) {
        notesContainer.innerHTML = localStorage.getItem('categories');
    }
    if (localStorage.getItem('backgroundColor')) {
        background.style.backgroundColor = localStorage.getItem('backgroundColor');
        backgroundColorInput.value = localStorage.getItem('backgroundColor');
    }
    if (localStorage.getItem('backgroundImage')) {
        background.style.backgroundImage = localStorage.getItem('backgroundImage');
    }
}

function saveData() {
    const notesContainer = document.getElementById('notes-container');
    const background = document.getElementById('background');

    localStorage.setItem('categories', notesContainer.innerHTML);
    localStorage.setItem('backgroundColor', background.style.backgroundColor);
    localStorage.setItem('backgroundImage', background.style.backgroundImage);
}
