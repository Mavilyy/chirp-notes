// Global değişkenler
let notes = [];
let currentNote = null;
let userDataPath = null;

// DOM elementleri
const searchInput = document.getElementById('searchInput');
const notesList = document.getElementById('notesList');
const noteEditor = document.getElementById('noteEditor');
const welcomeScreen = document.getElementById('welcomeScreen');
const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');
const noteDate = document.getElementById('noteDate');
const noteCount = document.getElementById('noteCount');
const wordCount = document.getElementById('wordCount');
const saveStatus = document.getElementById('saveStatus');
const notification = document.getElementById('notification');
const notificationContent = document.getElementById('notificationContent');

// Electron IPC
const { ipcRenderer } = require('electron');

// Uygulama başlatma
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// IPC ile kullanıcı veri yolunu al
ipcRenderer.on('user-data-path', (event, path) => {
    userDataPath = path;
    loadNotes();
});

// Uygulama başlatma
function initializeApp() {
    updateUI();
    showNotification('Chirp Notes\'a hoşgeldiniz! 🐦');
}

// Event listener'ları kur
function setupEventListeners() {
    // Yeni not butonları
    document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
    document.getElementById('welcomeNewNote').addEventListener('click', createNewNote);
    
    // Güncelleme butonu
    document.getElementById('updateBtn').addEventListener('click', checkForUpdates);
    
    // Arama
    searchInput.addEventListener('input', searchNotes);
    
    // Not editor event'leri
    noteTitle.addEventListener('input', debounce(saveNote, 500));
    noteContent.addEventListener('input', debounce(saveNote, 500));
    
    // Silme butonu
    document.getElementById('deleteBtn').addEventListener('click', deleteNote);
    
    // Klavye kısayolları
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Güncelleme kontrolü
async function checkForUpdates() {
    showNotification('Güncellemeler kontrol ediliyor... 🔍');
    
    try {
        const result = await ipcRenderer.invoke('check-for-updates');
        if (result.available) {
            showNotification(`Yeni sürüm mevcut: v${result.version} 🎉`);
            // Kullanıcıya güncelleme seçeneği sun
            if (confirm(`Yeni sürüm mevcut (v${result.version}). Güncellemek ister misiniz?`)) {
                showNotification('Güncelleme indiriliyor... ⬇️');
                // Burada gerçek güncelleme mantığı eklenebilir
            }
        } else {
            showNotification('En son sürüm kullanılıyor ✅');
        }
    } catch (error) {
        showNotification('Güncelleme kontrolü başarısız oldu ❌');
    }
}

// Klavye kısayolları
function handleKeyboardShortcuts(e) {
    // Ctrl+N - Yeni not
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        createNewNote();
    }
    
    // Ctrl+U - Güncelleme kontrolü
    if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        checkForUpdates();
    }
    
    // ESC - Editörden çık
    if (e.key === 'Escape' && currentNote) {
        clearEditor();
    }
}

// Not oluşturma
function createNewNote() {
    const newNote = {
        id: Date.now().toString(),
        title: 'Yeni Not',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    notes.unshift(newNote);
    currentNote = newNote;
    openNote(newNote.id);
    updateUI();
    showNotification('Yeni not oluşturuldu ✨');
}

// Not açma
function openNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        currentNote = note;
        
        // Editor'ü göster
        welcomeScreen.style.display = 'none';
        noteEditor.style.display = 'flex';
        
        // Not verilerini yükle
        noteTitle.value = note.title;
        noteContent.value = note.content;
        noteDate.textContent = formatDate(note.createdAt);
        
        // Kelime sayısını güncelle
        updateWordCount();
        
        // Aktif notu işaretle
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.toggle('active', item.dataset.noteId === noteId);
        });
    }
}

// Not kaydetme
async function saveNote() {
    if (!currentNote) return;
    
    // Kaydediliyor durumu
    saveStatus.textContent = 'Kaydediliyor...';
    saveStatus.classList.add('saving');
    
    try {
        currentNote.title = noteTitle.value || 'Adsız Not';
        currentNote.content = noteContent.value;
        currentNote.updatedAt = new Date().toISOString();
        
        const result = await ipcRenderer.invoke('save-note', currentNote);
        if (result.success) {
            saveStatus.textContent = 'Kaydedildi ✓';
            saveStatus.classList.remove('saving');
            updateUI();
        }
    } catch (error) {
        saveStatus.textContent = 'Kayıt hatası ✗';
        saveStatus.classList.remove('saving');
        showNotification('Kayıt sırasında hata oluştu');
    }
}

// Not silme
async function deleteNote() {
    if (!currentNote || !confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    
    try {
        const result = await ipcRenderer.invoke('delete-note', currentNote.id);
        if (result.success) {
            notes = notes.filter(note => note.id !== currentNote.id);
            clearEditor();
            updateUI();
            showNotification('Not silindi 🗑️');
        }
    } catch (error) {
        showNotification('Silme sırasında hata oluştu');
    }
}

// Notları yükleme
async function loadNotes() {
    try {
        const result = await ipcRenderer.invoke('load-notes');
        if (result.success) {
            notes = result.notes || [];
            notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            updateUI();
        }
    } catch (error) {
        showNotification('Notlar yüklenirken hata oluştu');
    }
}

// Notları arama
function searchNotes() {
    const searchTerm = searchInput.value.toLowerCase();
    renderNotesList(searchTerm);
}

// UI güncelleme
function updateUI() {
    updateNoteCounts();
    renderNotesList();
    updateWordCount();
}

// Not sayılarını güncelleme
function updateNoteCounts() {
    noteCount.textContent = `${notes.length} not`;
}

// Not listesini render etme
function renderNotesList(searchTerm = '') {
    let filteredNotes = notes;
    
    // Arama filtresi
    if (searchTerm) {
        filteredNotes = filteredNotes.filter(note => 
            note.title.toLowerCase().includes(searchTerm) ||
            note.content.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filteredNotes.length === 0) {
        notesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-text">Not bulunamadı</div>
                <div class="empty-subtext">Farklı bir arama deneyin</div>
            </div>
        `;
        return;
    }
    
    notesList.innerHTML = '';
    filteredNotes.forEach(note => {
        const noteElement = createNoteElement(note);
        notesList.appendChild(noteElement);
    });
}

// Not elementi oluşturma
function createNoteElement(note) {
    const noteElement = document.createElement('div');
    noteElement.className = 'note-item';
    noteElement.dataset.noteId = note.id;
    
    const preview = note.content.substring(0, 80) + (note.content.length > 80 ? '...' : '');
    
    noteElement.innerHTML = `
        <div class="note-title">${note.title}</div>
        <div class="note-preview">${preview}</div>
        <div class="note-date">${formatDate(note.updatedAt)}</div>
    `;
    
    noteElement.addEventListener('click', () => openNote(note.id));
    
    return noteElement;
}

// Kelime sayısını güncelleme
function updateWordCount() {
    if (noteContent) {
        const text = noteContent.value || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        wordCount.textContent = `${words} kelime`;
    }
}

// Bildirim gösterme
function showNotification(message, type = 'info') {
    notificationContent.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Yardımcı fonksiyonlar
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function clearEditor() {
    currentNote = null;
    noteEditor.style.display = 'none';
    welcomeScreen.style.display = 'block';
    noteTitle.value = '';
    noteContent.value = '';
    
    // Aktif not işaretlerini kaldır
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
}

// Debounce fonksiyonu
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debug fonksiyonları
window.debugApp = function() {
    return { notes, currentNote };
};