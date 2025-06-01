document.addEventListener('DOMContentLoaded', function() {
    // --- Sélecteurs DOM
    const notesContainer = document.getElementById('notes-container');
    const createCategoryButton = document.getElementById('create-category-button');
    const createFolderButton = document.getElementById('create-folder-button');
    const newCategoryNameInput = document.getElementById('new-category-name');
    const keywordSuggestions = document.getElementById('keyword-suggestions');
    const breadcrumb = document.getElementById('breadcrumb');
    const customizationPanel = document.getElementById('customization-panel');
    const panelToggle = document.getElementById('panel-toggle');
    const panelContent = document.getElementById('panel-content');
    const backgroundColorInput = document.getElementById('background-color');
    const backgroundOpacityInput = document.getElementById('background-opacity');
    const background = document.getElementById('background');
    const searchBar = document.getElementById('search-bar'); // NOUVEAU

    let keywords = ['film', 'movie', 'rendez-vous', 'meeting', 'soirée', 'party'];

    let root = { type: "folder", name: "Racine", children: [] };
    let currentFolder = root;
    let folderStack = [];

    // Variable pour le filtre de recherche
    let currentSearch = "";

    function saveData() {
        localStorage.setItem('notesTreeV2', JSON.stringify(root));
        localStorage.setItem('backgroundColor', background.style.backgroundColor);
        localStorage.setItem('backgroundImage', background.style.backgroundImage);
        localStorage.setItem('backgroundSize', background.style.backgroundSize);
        localStorage.setItem('backgroundRepeat', background.style.backgroundRepeat);
        localStorage.setItem('backgroundOpacity', background.style.opacity);
    }
    function loadData() {
        const data = localStorage.getItem('notesTreeV2');
        if (data) {
            root = JSON.parse(data);
        }
        if (localStorage.getItem('backgroundColor')) {
            background.style.backgroundColor = localStorage.getItem('backgroundColor');
            backgroundColorInput.value = localStorage.getItem('backgroundColor');
        }
        if (localStorage.getItem('backgroundImage')) {
            background.style.backgroundImage = localStorage.getItem('backgroundImage');
        }
        if (localStorage.getItem('backgroundSize')) {
            background.style.backgroundSize = localStorage.getItem('backgroundSize');
        }
        if (localStorage.getItem('backgroundRepeat')) {
            background.style.backgroundRepeat = localStorage.getItem('backgroundRepeat');
        }
        if (localStorage.getItem('backgroundOpacity')) {
            background.style.opacity = localStorage.getItem('backgroundOpacity');
            backgroundOpacityInput.value = localStorage.getItem('backgroundOpacity');
        }
    }

    function renderBreadcrumb() {
        let parts = [];
        let stack = [...folderStack];
        if (currentFolder !== root) stack.push(currentFolder);

        parts.push(`<span data-idx="0">Racine</span>`);
        for (let i = 1; i < stack.length; i++) {
            parts.push(`<span data-idx="${i}">${stack[i].name}</span>`);
        }
        breadcrumb.innerHTML = parts.join(' &gt; ');

        breadcrumb.querySelectorAll('span').forEach(span => {
            span.addEventListener('click', function() {
                const idx = parseInt(span.getAttribute('data-idx'), 10);
                if (idx === stack.length - 1) return;
                folderStack = folderStack.slice(0, idx);
                currentFolder = idx === 0 ? root : stack[idx];
                render();
            });
        });
    }

    // --- FONCTION DE RECHERCHE RECURSIVE ---
    function searchRecursive(folder, searchTerm) {
        let results = [];

        folder.children.forEach(item => {
            if (item.type === "folder") {
                if (item.name.toLowerCase().includes(searchTerm)) {
                    results.push({ ...item, _parent: folder });
                }
                // Rechercher aussi dans les sous-dossiers
                results = results.concat(searchRecursive(item, searchTerm));
            } else if (item.type === "category") {
                // Recherche dans le nom de la catégorie, le titre, le contenu, films, etc.
                let match = false;
                if (item.categoryName && item.categoryName.toLowerCase().includes(searchTerm)) match = true;
                if (item.noteTitle && item.noteTitle.toLowerCase().includes(searchTerm)) match = true;
                if (item.noteContent && item.noteContent.toLowerCase().includes(searchTerm)) match = true;
                if (item.eventName && item.eventName.toLowerCase().includes(searchTerm)) match = true;
                if (item.eventDescription && item.eventDescription.toLowerCase().includes(searchTerm)) match = true;
                if (item.films && Array.isArray(item.films)) {
                    for (let film of item.films) {
                        if ((film.name && film.name.toLowerCase().includes(searchTerm)) ||
                            (film.date && film.date.toLowerCase().includes(searchTerm)) ) {
                            match = true;
                            break;
                        }
                    }
                }
                if (match) results.push({ ...item, _parent: folder });
            }
        });

        return results;
    }

    // --- AFFICHAGE DU CONTENU (avec filtre si recherche) ---
    function render() {
        renderBreadcrumb();
        notesContainer.innerHTML = '';

        let displayChildren = currentFolder.children;

        // Si recherche active, afficher seulement les résultats
        if (currentSearch.length > 0) {
            let searchResults = searchRecursive(root, currentSearch.toLowerCase());
            if (searchResults.length === 0) {
                notesContainer.innerHTML = "<p style='margin-top:35px;font-size:1.12em;color:#888;'>Aucun résultat trouvé.</p>";
                return;
            }
            // On affiche tous les résultats
            displayChildren = searchResults;
        }

        // 1. Affiche les dossiers
        displayChildren.forEach((item, idx) => {
            if (item.type === "folder") {
                const div = document.createElement('div');
                div.className = "folder";
                div.innerHTML = `<span class="folder-icon">📁</span><span class="item-title">${item.name}</span>`;
                div.addEventListener('click', function(e) {
                    if (e.target.classList.contains('delete-folder')) return;
                    if (currentSearch.length > 0) return; // Pas de navigation en mode recherche
                    folderStack.push(currentFolder);
                    currentFolder = item;
                    render();
                });
                // Bouton supprimer dossier
                const delBtn = document.createElement('button');
                delBtn.className = "delete-folder";
                delBtn.textContent = "Delete";
                delBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    item._parent ? item._parent.children.splice(item._parent.children.indexOf(item), 1) : currentFolder.children.splice(idx, 1);
                    saveData();
                    render();
                });
                div.appendChild(delBtn);
                notesContainer.appendChild(div);
            }
        });

        // 2. Affiche les catégories/notes
        displayChildren.forEach((item, idx) => {
            if (item.type === "category") {
                const categoryDiv = document.createElement('div');
                categoryDiv.classList.add('category');
                let categoryHTML = `<h3>${item.categoryName}</h3>`;

                if (item.categoryName.toLowerCase().includes('film') || item.categoryName.toLowerCase().includes('movie')) {
                    categoryHTML += `<button class="add-film">Add Film</button>
                        <div class="film-entries"></div>`;
                } else if (
                    item.categoryName.toLowerCase().includes('rendez-vous') ||
                    item.categoryName.toLowerCase().includes('meeting') ||
                    item.categoryName.toLowerCase().includes('soirée') ||
                    item.categoryName.toLowerCase().includes('party')
                ) {
                    categoryHTML += `
                        <div class="event-details">
                            <input type="text" placeholder="Nom" value="${item.eventName||""}">
                            <input type="text" placeholder="Date (YYYY-MM-DD)" value="${item.eventDate||""}">
                        </div>
                        <textarea placeholder="Description de l'événement">${item.eventDescription||""}</textarea>`;
                } else {
                    categoryHTML += `
                        <input type="text" placeholder="Note Title" value="${item.noteTitle||""}">
                        <textarea placeholder="Note Content">${item.noteContent||""}</textarea>
                    `;
                }
                categoryHTML += `<button class="delete-category">Delete</button>`;
                categoryDiv.innerHTML = categoryHTML;

                if (item.films && categoryDiv.querySelector('.film-entries')) {
                    const filmEntriesDiv = categoryDiv.querySelector('.film-entries');
                    item.films.forEach(film => {
                        const entryDiv = document.createElement('div');
                        entryDiv.classList.add('film-entry');
                        entryDiv.innerHTML = `
                            <input type="text" placeholder="Nom du film" value="${film.name||""}">
                            <input type="text" placeholder="Date de sortie" value="${film.date||""}">
                            <input type="number" min="0" max="10" step="1" placeholder="Note /10" value="${film.note||""}">
                        `;
                        filmEntriesDiv.appendChild(entryDiv);
                    });
                }
                categoryDiv.querySelector('.delete-category').onclick = function() {
                    item._parent ? item._parent.children.splice(item._parent.children.indexOf(item), 1) : currentFolder.children.splice(idx, 1);
                    saveData();
                    render();
                };
                const addFilmBtn = categoryDiv.querySelector('.add-film');
                if (addFilmBtn) {
                    addFilmBtn.onclick = function() {
                        if (!item.films) item.films = [];
                        item.films.push({name:"",date:"",note:""});
                        saveData();
                        render();
                    };
                }
                categoryDiv.querySelectorAll('input, textarea').forEach((el, subIdx) => {
                    el.addEventListener('input', function() {
                        if (item.categoryName.toLowerCase().includes('film') || item.categoryName.toLowerCase().includes('movie')) {
                            if (el.placeholder === "Nom du film" || el.placeholder === "Date de sortie" || el.placeholder === "Note /10") {
                                const filmIdx = Array.from(categoryDiv.querySelectorAll('.film-entry')).indexOf(el.closest('.film-entry'));
                                if (el.placeholder === "Nom du film") item.films[filmIdx].name = el.value;
                                if (el.placeholder === "Date de sortie") item.films[filmIdx].date = el.value;
                                if (el.placeholder === "Note /10") item.films[filmIdx].note = el.value;
                            }
                        } else if (
                            item.categoryName.toLowerCase().includes('rendez-vous') ||
                            item.categoryName.toLowerCase().includes('meeting') ||
                            item.categoryName.toLowerCase().includes('soirée') ||
                            item.categoryName.toLowerCase().includes('party')
                        ) {
                            if (el.placeholder === "Nom") item.eventName = el.value;
                            if (el.placeholder === "Date (YYYY-MM-DD)") item.eventDate = el.value;
                            if (el.placeholder === "Description de l'événement") item.eventDescription = el.value;
                        } else {
                            if (el.placeholder === "Note Title") item.noteTitle = el.value;
                            if (el.placeholder === "Note Content") item.noteContent = el.value;
                        }
                        saveData();
                    });
                });
                notesContainer.appendChild(categoryDiv);
            }
        });
    }

    function displayKeywordSuggestions() {
        keywordSuggestions.innerHTML = '';
        keywords.forEach(keyword => {
            const keywordSpan = document.createElement('span');
            keywordSpan.classList.add('keyword');
            keywordSpan.textContent = `#${keyword}`;
            keywordSpan.addEventListener('click', function() {
                newCategoryNameInput.value = keyword;
            });
            keywordSuggestions.appendChild(keywordSpan);
        });
    }
    newCategoryNameInput.addEventListener('input', function() {
        displayKeywordSuggestions();
        if (newCategoryNameInput.value === '') {
            keywordSuggestions.innerHTML = '';
        }
    });
    displayKeywordSuggestions();

    createCategoryButton.addEventListener('click', function() {
        const categoryName = newCategoryNameInput.value.trim();
        if (!categoryName) return;
        currentFolder.children.push({ type: "category", categoryName });
        newCategoryNameInput.value = "";
        saveData();
        render();
    });

    createFolderButton.addEventListener('click', function() {
        const name = newCategoryNameInput.value.trim();
        if (!name) return;
        currentFolder.children.push({ type: "folder", name, children: [] });
        newCategoryNameInput.value = "";
        saveData();
        render();
    });

    panelToggle.addEventListener('click', function() {
        customizationPanel.classList.toggle('expanded');
    });
    backgroundColorInput.addEventListener('input', function() {
        background.style.backgroundColor = backgroundColorInput.value;
        saveData();
    });
    backgroundOpacityInput.addEventListener('input', function() {
        background.style.opacity = backgroundOpacityInput.value;
        saveData();
    });
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
    });
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                background.style.backgroundImage = `url('${e.target.result}')`;
                background.style.backgroundSize = 'cover';
                background.style.backgroundRepeat = 'no-repeat';
                saveData();
            };
            reader.readAsDataURL(file);
        }
    });
    document.addEventListener('keydown', function(event) {
        if ((event.key === 'Delete' || event.key === 'Backspace') &&
            document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'TEXTAREA') {
            background.style.backgroundImage = 'none';
            saveData();
        }
    });

    // GESTION RECHERCHE
    if (searchBar) {
        searchBar.addEventListener('input', function(e) {
            currentSearch = e.target.value.trim();
            render();
        });
    }

    loadData();
    if (!root || !root.children) root = { type: "folder", name: "Racine", children: [] };
    currentFolder = root;
    folderStack = [];
    render();
});