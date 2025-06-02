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
    const searchBar = document.getElementById('search-bar');

    let keywords = ['film', 'movie', 'rendez-vous', 'meeting', 'soirée', 'party'];

    let root = { type: "folder", name: "Racine", children: [] };
    let currentFolder = root;
    let folderStack = [];

    // Variable pour le filtre de recherche
    let currentSearch = "";

    // Fonction pour garantir la propriété favorite partout (y compris après connexion Google)
    function addFavoriteFieldRecursively(folderOrCategory) {
        if (!folderOrCategory) return;
        if (folderOrCategory.type === "folder") {
            if (folderOrCategory.favorite === undefined) folderOrCategory.favorite = false;
            if (Array.isArray(folderOrCategory.children)) {
                folderOrCategory.children.forEach(addFavoriteFieldRecursively);
            }
        }
        if (folderOrCategory.type === "category") {
            if (folderOrCategory.favorite === undefined) folderOrCategory.favorite = false;
        }
    }

    function saveData(pushCloud = true) {
        localStorage.setItem('notesTreeV2', JSON.stringify(root));
        localStorage.setItem('backgroundColor', background.style.backgroundColor);
        localStorage.setItem('backgroundImage', background.style.backgroundImage);
        localStorage.setItem('backgroundSize', background.style.backgroundSize);
        localStorage.setItem('backgroundRepeat', background.style.backgroundRepeat);
        localStorage.setItem('backgroundOpacity', background.style.opacity);
        if (pushCloud && window._userLoggedIn) {
            pushNotesToCloud();
        }
    }
    function loadData() {
        const data = localStorage.getItem('notesTreeV2');
        if (data) {
            root = JSON.parse(data);
        }
        addFavoriteFieldRecursively(root);
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

    // Synchronisation cloud => local après login Google
    function syncWithCloudAndRender() {
        fetch('/api/notes')
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.tree) {
                    root = data.tree;
                    addFavoriteFieldRecursively(root); // Pour garantir la clé partout
                    saveData(false); // Mets à jour le localStorage sans POST tout de suite
                }
                if (!root || !root.children) root = { type: "folder", name: "Racine", children: [] };
                currentFolder = root;
                folderStack = [];
                render();
            });
    }
    function pushNotesToCloud() {
        fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tree: root })
        });
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

    // --- GESTION FAVORI (étoile SVG animée) ---
    function createStarIcon(isFavorite) {
        const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        star.setAttribute("viewBox", "0 0 24 24");
        star.setAttribute("width", "24");
        star.setAttribute("height", "24");
        star.classList.add("favorite-star");
        if (isFavorite) star.classList.add("active");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z");
        star.appendChild(path);
        return star;
    }

    function searchRecursive(folder, searchTerm) {
        let results = [];
        folder.children.forEach(item => {
            if (item.type === "folder") {
                if (item.name && item.name.toLowerCase().includes(searchTerm)) {
                    results.push({ ...item, _parent: folder });
                }
                results = results.concat(searchRecursive(item, searchTerm));
            } else if (item.type === "category") {
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

    function render() {
        renderBreadcrumb();
        notesContainer.innerHTML = '';

        let displayChildren = currentFolder.children;

        if (currentSearch.length > 0) {
            let searchResults = searchRecursive(root, currentSearch.toLowerCase());
            if (searchResults.length === 0) {
                notesContainer.innerHTML = "<p style='margin-top:35px;font-size:1.12em;color:#888;'>Aucun résultat trouvé.</p>";
                return;
            }
            displayChildren = searchResults;
        }

        // Affiche les dossiers
        displayChildren.forEach((item, idx) => {
            if (item.type === "folder") {
                const div = document.createElement('div');
                div.className = "folder";
                if (item.favorite === undefined) item.favorite = false;
                const star = createStarIcon(item.favorite);
                star.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.favorite = !item.favorite;
                    star.classList.toggle('active', item.favorite);
                    star.classList.add('pulse');
                    setTimeout(() => star.classList.remove('pulse'), 350);
                    saveData();
                });
                div.innerHTML = `<span class="folder-icon">📁</span><span class="item-title">${item.name}</span>`;
                div.prepend(star);
                div.addEventListener('click', function(e) {
                    if (e.target.classList.contains('delete-folder') || e.target.classList.contains('favorite-star')) return;
                    if (currentSearch.length > 0) return;
                    folderStack.push(currentFolder);
                    currentFolder = item;
                    render();
                });
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

        // Affiche les catégories/notes
        displayChildren.forEach((item, idx) => {
            if (item.type === "category") {
                const categoryDiv = document.createElement('div');
                categoryDiv.classList.add('category');
                if (item.favorite === undefined) item.favorite = false;
                const star = createStarIcon(item.favorite);
                star.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.favorite = !item.favorite;
                    star.classList.toggle('active', item.favorite);
                    star.classList.add('pulse');
                    setTimeout(() => star.classList.remove('pulse'), 350);
                    saveData();
                });
                categoryDiv.appendChild(star);

                let categoryHTML = `<h3>${item.categoryName || ''}</h3>`;

                if (item.categoryName && (item.categoryName.toLowerCase().includes('film') || item.categoryName.toLowerCase().includes('movie'))) {
                    categoryHTML += `<button class="add-film">Add Film</button>
                        <div class="film-entries"></div>`;
                } else if (
                    item.categoryName &&
                    (item.categoryName.toLowerCase().includes('rendez-vous') ||
                    item.categoryName.toLowerCase().includes('meeting') ||
                    item.categoryName.toLowerCase().includes('soirée') ||
                    item.categoryName.toLowerCase().includes('party'))
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
                categoryDiv.innerHTML += categoryHTML;

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
                        if (item.categoryName && (item.categoryName.toLowerCase().includes('film') || item.categoryName.toLowerCase().includes('movie'))) {
                            if (el.placeholder === "Nom du film" || el.placeholder === "Date de sortie" || el.placeholder === "Note /10") {
                                const filmIdx = Array.from(categoryDiv.querySelectorAll('.film-entry')).indexOf(el.closest('.film-entry'));
                                if (el.placeholder === "Nom du film") item.films[filmIdx].name = el.value;
                                if (el.placeholder === "Date de sortie") item.films[filmIdx].date = el.value;
                                if (el.placeholder === "Note /10") item.films[filmIdx].note = el.value;
                            }
                        } else if (
                            item.categoryName &&
                            (item.categoryName.toLowerCase().includes('rendez-vous') ||
                            item.categoryName.toLowerCase().includes('meeting') ||
                            item.categoryName.toLowerCase().includes('soirée') ||
                            item.categoryName.toLowerCase().includes('party'))
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
        currentFolder.children.push({ type: "category", categoryName, favorite: false });
        newCategoryNameInput.value = "";
        saveData();
        render();
    });

    createFolderButton.addEventListener('click', function() {
        const name = newCategoryNameInput.value.trim();
        if (!name) return;
        currentFolder.children.push({ type: "folder", name, children: [], favorite: false });
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

    if (searchBar) {
        searchBar.addEventListener('input', function(e) {
            currentSearch = e.target.value.trim();
            render();
        });
    }

    // Chargement initial (en mode local par défaut, cloud si connecté)
    window._userLoggedIn = false;
    window.checkLoginAndLoad = function() {
        fetch('/me')
            .then(res => res.json())
            .then(data => {
                window._userLoggedIn = !!data.loggedIn;
                if (data.loggedIn) {
                    document.getElementById('login-modal').classList.add('hidden');
                    syncWithCloudAndRender();
                } else {
                    document.getElementById('login-modal').classList.remove('hidden');
                    loadData();
                    currentFolder = root;
                    folderStack = [];
                    render();
                }
            });
    };

    window.checkLoginAndLoad();
});