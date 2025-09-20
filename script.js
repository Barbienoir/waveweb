// --- Variables Globales et Initialisation ---

let solde = parseFloat(localStorage.getItem('solde')) || 120000;
const userId = "USER123";

let isSoldeVisible = true;

let displayedItemsCount = 0; 
const itemsPerPage = 3; // Pagination par 3 éléments

let qrcodeRefreshInterval;

// --- Récupération des Éléments du DOM ---

const soldeElement = document.getElementById("solde");
const eyeIcon = document.getElementById("eye");
const qrcodeElement = document.getElementById("qrcode");
const historiqueList = document.getElementById('historiqueList');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchIcon = document.getElementById('searchIcon'); // Icône de recherche maintenant dans l'historique
const searchContainer = document.querySelector('.search-container');
const historySearchInput = document.getElementById('historySearchInput');

// Modals d'alerte
const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));
const alertModalLabel = document.getElementById('alertModalLabel');
const alertModalBody = document.getElementById('alertModalBody');

// Nouveau modal "Montant insuffisant"
const insufficientFundsModal = new bootstrap.Modal(document.getElementById('insufficientFundsModal'));


// Formulaires et éléments spécifiques aux modals de Transfert
const transfertForm = document.getElementById('transfertForm');
const montantTransfertInput = document.getElementById('montantTransfert');
const fraisTransfertSpan = document.getElementById('fraisTransfert');
const totalTransfertSpan = document.getElementById('totalTransfert');
const destinataireNomInput = document.getElementById('destinataireNom');
const destinatairePrenomInput = document.getElementById('destinatairePrenom');

// Formulaires et éléments spécifiques aux modals de Retrait
const retraitForm = document.getElementById('retraitForm');
const montantRetraitInput = document.getElementById('montantRetrait');

// Formulaires et éléments spécifiques aux modals de Dépôt
const depotForm = document.getElementById('depotForm');
const montantDepotInput = document.getElementById('montantDepot');


// --- Fonctions Utilitaires ---

/**
 * Affiche un modal d'alerte Bootstrap personnalisé.
 * @param {string} title - Titre du modal.
 * @param {string} message - Corps du message.
 */
function showAlertModal(title, message) {
    alertModalLabel.textContent = title;
    alertModalBody.innerHTML = `<p>${message}</p>`;
    alertModal.show();
}

/**
 * Met à jour l'affichage du solde sur l'interface utilisateur.
 * Affiche le solde formaté ou des astérisques selon `isSoldeVisible`.
 * Sauvegarde également le solde dans `localStorage`.
 */
function updateSoldeDisplay() {
    soldeElement.textContent = isSoldeVisible ? solde.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' }) : "********";
    localStorage.setItem('solde', solde);
}

/**
 * Met à jour le QR code avec les informations actuelles du solde et de l'utilisateur.
 * Vide l'ancien QR code avant d'en générer un nouveau.
 */
function updateQRCode() {
    qrcodeElement.innerHTML = '';
    const qrData = `WaveWeb|Solde:${solde.toFixed(2)}|ID:${userId}|${Date.now()}`;
    new QRCode(qrcodeElement, {
        text: qrData,
        width: 128,
        height: 128,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

/**
 * Démarre le rafraîchissement automatique du QR code.
 */
function startQRCodeRefresh() {
    if (qrcodeRefreshInterval) {
        clearInterval(qrcodeRefreshInterval);
    }
    updateQRCode(); 
    qrcodeRefreshInterval = setInterval(updateQRCode, 30000);
}

/**
 * Ajoute une nouvelle opération à l'historique et la sauvegarde dans `localStorage`.
 * @param {string} type - Le type de l'opération (Dépôt, Retrait, Transfert).
 * @param {number} montant - Le montant concerné par l'opération.
 * @param {number} [frais=0] - Les frais éventuels (par défaut 0).
 * @param {string} [nomDestinataire=''] - Le nom du destinataire (pour les transferts).
 * @param {string} [prenomDestinataire=''] - Le prénom du destinataire (pour les transferts).
 */
function addToHistory(type, montant, frais = 0, nomDestinataire = '', prenomDestinataire = '') {
    const historique = JSON.parse(localStorage.getItem('historique')) || [];
    const now = new Date(); 

    historique.unshift({ 
        type: type,
        montant: montant,
        frais: frais,
        destinataireNom: nomDestinataire,
        destinatairePrenom: prenomDestinataire,
        date: now.toLocaleString('en-US', { // Format anglais pour ressembler au modèle
            month: 'long', 
            day: 'numeric', 
            year: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
        })
    });
    localStorage.setItem('historique', JSON.stringify(historique));
    // Réinitialise le nombre d'éléments affichés pour recharger l'historique correctement
    displayedItemsCount = 0; 
    historiqueList.innerHTML = ''; // Vide l'ancienne liste
    loadMoreHistory(); // Charge les premiers éléments
}

/**
 * Charge plus d'éléments de l'historique (pagination "Voir plus").
 * @param {string} [searchTerm=''] - Terme de recherche optionnel pour filtrer les transferts.
 */
function loadMoreHistory(searchTerm = '') {
    const historique = JSON.parse(localStorage.getItem('historique')) || [];
    
    // Filtrer si un terme de recherche est fourni
    const filteredHistory = searchTerm 
        ? historique.filter(op => 
            op.type === 'Transfert' && 
            (op.destinataireNom.toLowerCase().includes(searchTerm.toLowerCase()) || 
             op.destinatairePrenom.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        : historique;

    const remainingItems = filteredHistory.length - displayedItemsCount;
    const itemsToLoad = Math.min(itemsPerPage, remainingItems);

    if (itemsToLoad <= 0) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Fin de l'historique"; // Message mis à jour
        return;
    }

    const startIndex = displayedItemsCount;
    const endIndex = startIndex + itemsToLoad;
    const itemsToDisplay = filteredHistory.slice(startIndex, endIndex);

    itemsToDisplay.forEach(op => {
        const li = document.createElement('li');
        li.classList.add('list-group-item', 'custom-history-item');

        let amountDisplay = op.montant.toLocaleString('fr-FR') + 'F';
        let amountClass = '';
        let transactionText = '';

        if (op.type === 'Dépôt') {
            amountClass = 'deposit';
            transactionText = 'Dépôt';
            amountDisplay = '+' + amountDisplay;
        } else if (op.type === 'Retrait') {
            amountClass = 'withdrawal';
            amountDisplay = '-' + amountDisplay; 
            transactionText = 'Retrait';
        } else if (op.type === 'Transfert') {
            amountClass = 'transfer';
            amountDisplay = '-' + amountDisplay; 
            const destinataireComplet = (op.destinataireNom || '') + ' ' + (op.destinatairePrenom || '');
            transactionText = `À ${destinataireComplet.trim() || 'un destinataire inconnu'}`;
        }

        li.innerHTML = `
            <div class="transaction-details">
                <div class="transaction-type">${transactionText}</div>
                <div class="transaction-date">${op.date}</div>
            </div>
            <div class="transaction-amount ${amountClass}">${amountDisplay}</div>
        `;
        historiqueList.appendChild(li);
    });

    displayedItemsCount += itemsToLoad;

    if (displayedItemsCount >= filteredHistory.length) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Fin de l'historique"; // Message mis à jour
    } else {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = "Voir plus";
    }

    if (filteredHistory.length === 0 && searchTerm) { // S'il n'y a pas de résultats pour la recherche
        historiqueList.innerHTML = '<li class="list-group-item text-center text-muted">Aucun transfert trouvé pour cette recherche.</li>';
        loadMoreBtn.style.display = 'none';
    } else if (filteredHistory.length === 0) { // Si l'historique est complètement vide
        historiqueList.innerHTML = '<li class="list-group-item text-center text-muted">Aucune opération effectuée.</li>';
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'block';
    }
}


// --- Logique des Fonctionnalités Principales ---

/**
 * Bascule l'affichage du solde (visible/masqué) et met à jour l'icône de l'œil.
 */
function changer() {
    isSoldeVisible = !isSoldeVisible;
    updateSoldeDisplay();
    eyeIcon.classList.toggle("fa-eye");
    eyeIcon.classList.toggle("fa-eye-slash");
}

// Écouteur d'événement pour le calcul des frais de transfert en temps réel.
montantTransfertInput.addEventListener('input', () => {
    const montant = parseFloat(montantTransfertInput.value);
    if (!isNaN(montant) && montant > 0) {
        const frais = montant * 0.01;
        const total = montant + frais;
        fraisTransfertSpan.textContent = frais.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' FCFA';
        totalTransfertSpan.textContent = total.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' FCFA';
    } else {
        fraisTransfertSpan.textContent = '0.00 FCFA';
        totalTransfertSpan.textContent = '0.00 FCFA';
    }
});

// Gère la soumission du formulaire de Transfert.
transfertForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const destinataireNom = destinataireNomInput.value.trim();
    const destinatairePrenom = destinatairePrenomInput.value.trim();
    const montant = parseFloat(montantTransfertInput.value);

    if (isNaN(montant) || montant <= 0) {
        showAlertModal('Erreur de transfert', 'Veuillez saisir un montant de transfert valide.');
        return;
    }
    if (!destinataireNom && !destinatairePrenom) {
        showAlertModal('Erreur de transfert', 'Veuillez saisir au moins le nom ou le prénom du destinataire.');
        return;
    }

    const frais = montant * 0.01;
    const totalADebiter = montant + frais;

    if (solde >= totalADebiter) {
        solde -= totalADebiter;
        updateSoldeDisplay();
        startQRCodeRefresh();
        addToHistory('Transfert', montant, frais, destinataireNom, destinatairePrenom);
        
        showAlertModal('Transfert réussi', `Transfert de ${montant.toLocaleString('fr-FR')} FCFA vers ${destinataireNom} ${destinatairePrenom} (Frais: ${frais.toLocaleString('fr-FR')} FCFA) effectué avec succès. Solde actuel: ${solde.toLocaleString('fr-FR')} FCFA.`);
        
        const transfertModal = bootstrap.Modal.getInstance(document.getElementById('transfertModal'));
        if (transfertModal) transfertModal.hide();
        
        transfertForm.reset();
        fraisTransfertSpan.textContent = '0.00 FCFA';
        totalTransfertSpan.textContent = '0.00 FCFA';
    } else {
        insufficientFundsModal.show(); // Utilise le nouveau modal spécifique
    }
});

// Gère la soumission du formulaire de Retrait.
retraitForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const montant = parseFloat(montantRetraitInput.value);

    if (isNaN(montant) || montant <= 0) {
        showAlertModal('Erreur de retrait', 'Veuillez saisir un montant de retrait valide.');
        return;
    }

    if (solde >= montant) {
        solde -= montant;
        updateSoldeDisplay();
        startQRCodeRefresh();
        addToHistory('Retrait', montant);
        
        showAlertModal('Retrait réussi', `Retrait de ${montant.toLocaleString('fr-FR')} FCFA effectué avec succès. Solde actuel: ${solde.toLocaleString('fr-FR')} FCFA.`);
        
        const retraitModal = bootstrap.Modal.getInstance(document.getElementById('retraitModal'));
        if (retraitModal) retraitModal.hide();
        
        retraitForm.reset();
    } else {
        insufficientFundsModal.show(); // Utilise le nouveau modal spécifique
    }
});

// Gère la soumission du formulaire de Dépôt.
depotForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const montant = parseFloat(montantDepotInput.value);

    if (isNaN(montant) || montant <= 0) {
        showAlertModal('Erreur de dépôt', 'Veuillez saisir un montant de dépôt valide.');
        return;
    }

    solde += montant;
    updateSoldeDisplay();
    startQRCodeRefresh();
    addToHistory('Dépôt', montant);
    
    showAlertModal('Dépôt réussi', `Dépôt de ${montant.toLocaleString('fr-FR')} FCFA effectué avec succès. Solde actuel: ${solde.toLocaleString('fr-FR')} FCFA.`);
    
    const depotModal = bootstrap.Modal.getInstance(document.getElementById('depotModal'));
    if (depotModal) depotModal.hide();
    
    depotForm.reset();
});

// --- Gestion de l'icône de recherche ---
searchIcon.addEventListener('click', () => {
    searchContainer.style.display = searchContainer.style.display === 'none' ? 'block' : 'none';
    if (searchContainer.style.display === 'block') {
        historySearchInput.focus();
    } else {
        historySearchInput.value = '';
        displayedItemsCount = 0;
        historiqueList.innerHTML = '';
        loadMoreHistory(); // Recharger l'historique sans filtre
    }
});

// Écouteur pour la recherche en temps réel
historySearchInput.addEventListener('input', () => {
    displayedItemsCount = 0;
    historiqueList.innerHTML = '';
    loadMoreHistory(historySearchInput.value.trim());
});


// --- Gestion du bouton "Voir plus" ---
loadMoreBtn.addEventListener('click', () => {
    loadMoreHistory(historySearchInput.value.trim());
});


// --- Initialisation au Chargement de la Page ---
document.addEventListener('DOMContentLoaded', () => {
    updateSoldeDisplay();
    startQRCodeRefresh();
    loadMoreHistory();
});