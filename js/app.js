// App State
let tokenizer = null;
let rawTextData = "";
let opinionLinesCount = 0;
let wordFrequencies = [];
let globalAnalyzedLines = []; // Cached token lists per line: [[token, token...], [token...]]
let currentAnalysisCounts = {}; // Cached counts mapping for CSV export
let currentAnalysisCoocCounts = {}; // Cached cooc counts mapping for CSV export
let currentAnalysisDocFreq = {};    // Cached document-frequency for correct Jaccard in CSV export
let currentTokenizeTaskId = 0;

// Set for standard stop words (dynamically loaded from stopwords.txt)
let defaultStopWordsSet = new Set();

// Custom Stop Words added on-screen by the user
let customStopWords = new Set();

// Network Graph State
let networkNodes = [];
let oldNetworkNodes = [];
let networkEdges = [];
let networkAnimationFrameId = null;
let kwicNetworkAnimationFrameId = null;

// PCA Scatter Plot State
let pcaPoints = [];
let pcaExplainedVar1 = '--'; // Variance explained by PC1 (%)
let pcaExplainedVar2 = '--'; // Variance explained by PC2 (%)

// LDA Topic Model State
let currentLdaResult = null;

// Initialize UI Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const sampleBtn = document.getElementById('load-sample-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const progressBar = document.getElementById('progress-bar');
const cloudCanvas = document.getElementById('cloud-canvas');
const chartContainer = document.getElementById('chart-container');
const ldaContainer = document.getElementById('lda-container');
const emptyState = document.getElementById('empty-state');
const tooltip = document.getElementById('tooltip');
const downloadBtn = document.getElementById('download-btn');
const downloadSize = document.getElementById('download-size');
const canvasContainer = document.getElementById('canvas-container');

// Settings Elements
const posNoun = document.getElementById('pos-noun');
const posVerb = document.getElementById('pos-verb');
const posAdj = document.getElementById('pos-adj');
const posAdv = document.getElementById('pos-adv');
const mergeNounsCheckbox = document.getElementById('merge-nouns-checkbox');
const minCountRange = document.getElementById('min-count-range');
const minCountVal = document.getElementById('min-count-val');
const maxWordsRange = document.getElementById('max-words-range');
const maxWordsVal = document.getElementById('max-words-val');
const networkThresholdGroup = document.getElementById('network-threshold-group');
const networkThresholdRange = document.getElementById('network-threshold-range');
const networkThresholdVal = document.getElementById('network-threshold-val');
const colorTheme = document.getElementById('color-theme');
const fontSelect = document.getElementById('font-select');
const shapeCircle = document.getElementById('shape-circle');
const rotateText = document.getElementById('rotate-text');
const displayType = document.getElementById('display-type');
const methodDescription = document.getElementById('method-description');
const clusterCountGroup = document.getElementById('cluster-count-group');
const clusterCount = document.getElementById('cluster-count');

// Compound Words Elements
const newCompoundWordInput = document.getElementById('new-compound-word');
const addCompoundWordBtn = document.getElementById('add-compound-word-btn');
const replaceFromInput = document.getElementById('replace-from');
const replaceToInput = document.getElementById('replace-to');
const addReplaceBtn = document.getElementById('add-replace-btn');
const replaceWordsList = document.getElementById('replace-words-list');
const compoundWordsList = document.getElementById('compound-words-list');
let customCompoundWords = new Set(); // User-defined compound words
let customSynonymRules = new Map(); // User-defined synonym replacements: key -> target

// Stopwords Elements
const newStopwordInput = document.getElementById('new-stopword');
const addStopwordBtn = document.getElementById('add-stopword-btn');
const stopwordsList = document.getElementById('stopwords-list');
const resetStopwordsBtn = document.getElementById('reset-stopwords-btn');

// Export & Relayout Action Buttons
const exportWordsCsvBtn = document.getElementById('export-words-csv-btn');
const exportPairsCsvBtn = document.getElementById('export-pairs-csv-btn');
const relayoutBtn = document.getElementById('relayout-btn');
const sidebarRelayoutBtn = document.getElementById('sidebar-relayout-btn');
let isForceRelayout = false;

// Input switcher Elements
const tabBtnFile = document.getElementById('tab-btn-file');
const tabBtnText = document.getElementById('tab-btn-text');
const inputPanelFile = document.getElementById('input-panel-file');
const inputPanelText = document.getElementById('input-panel-text');
const rawTextInput = document.getElementById('raw-text-input');
const analyzeRawTextBtn = document.getElementById('analyze-raw-text-btn');

// Stats Elements
function updateStatsBar(lines, totalWords, uniqueWords) {
    const elLines = document.getElementById('stat-lines');
    if (elLines) elLines.textContent = Number(lines).toLocaleString();

    const elTotalWords = document.getElementById('stat-total-words');
    if (elTotalWords) elTotalWords.textContent = Number(totalWords).toLocaleString();

    const elWords = document.getElementById('stat-words');
    if (elWords) elWords.textContent = Number(uniqueWords).toLocaleString();
}

// Sample Opinions Text (Demo Data) is now loaded dynamically from data/sample.txt

// 1. Initialize Kuromoji and Load Stop Words
function saveSettings() {
    localStorage.setItem('customStopWords', JSON.stringify(Array.from(customStopWords)));
    localStorage.setItem('customCompoundWords', JSON.stringify(Array.from(customCompoundWords)));
    localStorage.setItem('customSynonymRules', JSON.stringify(Array.from(customSynonymRules.entries())));
}

function loadSettings() {
    try {
        const storedStopWords = localStorage.getItem('customStopWords');
        if (storedStopWords) {
            customStopWords = new Set(JSON.parse(storedStopWords));
        }
        
        const storedCompoundWords = localStorage.getItem('customCompoundWords');
        if (storedCompoundWords) {
            customCompoundWords = new Set(JSON.parse(storedCompoundWords));
        }
        
        const storedSynonymRules = localStorage.getItem('customSynonymRules');
        if (storedSynonymRules) {
            customSynonymRules = new Map(JSON.parse(storedSynonymRules));
        }
    } catch (e) {
        console.error("Failed to load settings from localStorage", e);
    }
}

async function initKuromoji() {
    loadingOverlay.style.display = 'flex';
    loadingText.innerText = "日本語解析辞書と除外リストをロード中...";
    try {
        // Fetch custom stop words from server
        const response = await fetch('data/stopwords.txt');
        if (response.ok) {
            const text = await response.text();
            const words = text.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#'));
            defaultStopWordsSet = new Set(words);
        } else {
            console.warn("stopwords.txt not found. Running with empty default list.");
        }
    } catch (e) {
        console.error("Error loading stopwords.txt:", e);
    }

    progressBar.style.width = '50%';
    const dicPath = "lib/kuromoji/dict/";

    kuromoji.builder({ dicPath: dicPath }).build((err, _tokenizer) => {
        if (err) {
            console.error("Kuromoji initialization failed:", err);
            loadingText.innerHTML = "エラー: 辞書の読み込みに失敗しました。<br><small style='color: #EF4444; font-family: monospace;'>" + err.toString() + "</small>";
            loadingText.style.color = "#EF4444";
            progressBar.style.backgroundColor = "#EF4444";
            progressBar.style.width = '100%';
            return;
        }
        
        tokenizer = _tokenizer;
        progressBar.style.width = '100%';
        
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 500);
        
        loadSettings();
        
        renderStopWords();
        renderCompoundWords();
        renderSynonymRules();
    });
}

function renderStopWords() {
    stopwordsList.innerHTML = '';
    
    if (customStopWords.size === 0) {
        stopwordsList.innerHTML = '<span style="color: var(--text-muted); font-size: 11px; padding: 4px;">画面上で追加された除外ワードはありません</span>';
        return;
    }
    
    const sortedWords = Array.from(customStopWords).sort((a, b) => a.localeCompare(b, 'ja'));
    
    sortedWords.forEach(word => {
        const tag = document.createElement('span');
        tag.className = 'stopword-tag';
        tag.innerHTML = `${word} <span class="remove" data-word="${word}">&times;</span>`;
        stopwordsList.appendChild(tag);
    });

    stopwordsList.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const word = e.currentTarget.getAttribute('data-word');
            customStopWords.delete(word);
            saveSettings();
            renderStopWords();
            if (rawTextData) {
                processAndRender();
            }
        });
    });
}

function addStopWord(word) {
    word = word.trim();
    if (!word) return;
    
    const words = word.split(/[,\s，、]+/).map(w => w.trim()).filter(w => w.length > 0);
    
    let added = false;
    words.forEach(w => {
        if (!customStopWords.has(w) && !defaultStopWordsSet.has(w)) {
            customStopWords.add(w);
            added = true;
        }
    });

    if (added) {
        saveSettings();
        renderStopWords();
        if (rawTextData) {
            processAndRender();
        }
    }
}

function renderCompoundWords() {
    compoundWordsList.innerHTML = '';
    
    if (customCompoundWords.size === 0) {
        compoundWordsList.innerHTML = '<span style="color: var(--text-muted); font-size: 11px; padding: 4px;">画面上で追加された複合語はありません</span>';
        return;
    }
    
    const sortedWords = Array.from(customCompoundWords).sort((a, b) => a.localeCompare(b, 'ja'));
    
    sortedWords.forEach(word => {
        const tag = document.createElement('span');
        tag.className = 'stopword-tag';
        tag.innerHTML = `${word} <span class="remove" data-word="${word}">&times;</span>`;
        compoundWordsList.appendChild(tag);
    });

    compoundWordsList.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const word = e.currentTarget.getAttribute('data-word');
            customCompoundWords.delete(word);
            saveSettings();
            renderCompoundWords();
            if (rawTextData) {
                processAndRender();
            }
        });
    });
}

function addCompoundWord(word) {
    word = word.trim();
    if (!word) return;
    
    const words = word.split(/[,\n，、]+/).map(w => w.trim()).filter(w => w.length > 0);
    
    let added = false;
    words.forEach(w => {
        if (!customCompoundWords.has(w)) {
            customCompoundWords.add(w);
            added = true;
        }
    });

    if (added) {
        saveSettings();
        renderCompoundWords();
        if (rawTextData) {
            processAndRender();
        }
    }
}

function renderSynonymRules() {
    replaceWordsList.innerHTML = '';
    
    if (customSynonymRules.size === 0) {
        replaceWordsList.innerHTML = '<span style="color: var(--text-muted); font-size: 11px; padding: 4px;">登録された置換ルールはありません</span>';
        return;
    }
    
    const sortedRules = Array.from(customSynonymRules.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ja'));
    
    sortedRules.forEach(([fromWord, toWord]) => {
        const tag = document.createElement('span');
        tag.className = 'stopword-tag';
        tag.innerHTML = `${fromWord} → ${toWord} <span class="remove" data-word="${fromWord}">&times;</span>`;
        replaceWordsList.appendChild(tag);
    });

    replaceWordsList.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const word = e.currentTarget.getAttribute('data-word');
            customSynonymRules.delete(word);
            saveSettings();
            renderSynonymRules();
            if (rawTextData) {
                processAndRender();
            }
        });
    });
}

function addSynonymRule(fromWord, toWord) {
    fromWord = fromWord.trim();
    toWord = toWord.trim();
    if (!fromWord || !toWord) return;
    
    if (customSynonymRules.get(fromWord) !== toWord) {
        customSynonymRules.set(fromWord, toWord);
        saveSettings();
        renderSynonymRules();
        if (rawTextData) {
            processAndRender();
        }
    }
}

// 2. Input switcher listeners
tabBtnFile.addEventListener('click', () => {
    tabBtnFile.classList.add('active');
    tabBtnText.classList.remove('active');
    inputPanelFile.classList.add('active-panel');
    inputPanelText.classList.remove('active-panel');
});

tabBtnText.addEventListener('click', () => {
    tabBtnText.classList.add('active');
    tabBtnFile.classList.remove('active');
    inputPanelText.classList.add('active-panel');
    inputPanelFile.classList.remove('active-panel');
});

analyzeRawTextBtn.addEventListener('click', () => {
    const text = rawTextInput.value.trim();
    if (!text) {
        alert("テキストが入力されていません。");
        return;
    }
    fileInfo.innerText = "直接入力データ適用中";
    loadTextAndTokenize(text);
});

// Load Text, Tokenize (cached), and Trigger Render
function loadTextAndTokenize(text) {
    const taskId = ++currentTokenizeTaskId;
    if (!tokenizer) {
        alert("辞書の読み込みが完了していません。しばらくお待ちください。");
        return;
    }
    rawTextData = text;
    const lines = rawTextData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    opinionLinesCount = lines.length;

    if (lines.length === 0) {
        alert("有効なテキストデータが見つかりませんでした。");
        return;
    }

    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (loadingText) loadingText.innerText = `テキストを形態素解析中... (0 / ${lines.length} 行)`;
    if (progressBar) progressBar.style.width = '0%';

    globalAnalyzedLines = [];
    const chunkSize = 200;
    let currentIndex = 0;

    function processChunk() {
        try {
            if (taskId !== currentTokenizeTaskId) return;
            const endIndex = Math.min(currentIndex + chunkSize, lines.length);
            for (let i = currentIndex; i < endIndex; i++) {
                const lineStr = String(lines[i] || '').trim();
                if (lineStr.length > 0) {
                    globalAnalyzedLines.push(tokenizer.tokenize(lineStr));
                }
            }
            currentIndex = endIndex;

            const pct = Math.round((currentIndex / lines.length) * 100);
            if (loadingText) loadingText.innerText = `テキストを形態素解析中... (${currentIndex} / ${lines.length} 行)`;
            if (progressBar) progressBar.style.width = `${pct}%`;

            if (currentIndex < lines.length) {
                setTimeout(processChunk, 0);
            } else {
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                processAndRender();
            }
        } catch (err) {
            console.error("Tokenization error:", err);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            alert("形態素解析中にエラーが発生しました:\n" + err.message);
        }
    }

    setTimeout(processChunk, 20);
}

// Event Listeners for UI
addCompoundWordBtn.addEventListener('click', () => {
    addCompoundWord(newCompoundWordInput.value);
    newCompoundWordInput.value = '';
});

newCompoundWordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addCompoundWord(newCompoundWordInput.value);
        newCompoundWordInput.value = '';
    }
});

addReplaceBtn.addEventListener('click', () => {
    addSynonymRule(replaceFromInput.value, replaceToInput.value);
    replaceFromInput.value = '';
    replaceToInput.value = '';
});
replaceFromInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (replaceToInput.value) {
            addSynonymRule(replaceFromInput.value, replaceToInput.value);
            replaceFromInput.value = '';
            replaceToInput.value = '';
        } else {
            replaceToInput.focus();
        }
    }
});
replaceToInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (replaceFromInput.value) {
            addSynonymRule(replaceFromInput.value, replaceToInput.value);
            replaceFromInput.value = '';
            replaceToInput.value = '';
        } else {
            replaceFromInput.focus();
        }
    }
});

addStopwordBtn.addEventListener('click', () => {
    addStopWord(newStopwordInput.value);
    newStopwordInput.value = '';
});

newStopwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addStopWord(newStopwordInput.value);
        newStopwordInput.value = '';
    }
});

resetStopwordsBtn.addEventListener('click', () => {
    customStopWords.clear();
    renderStopWords();
    if (rawTextData) {
        processAndRender();
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// --- CSV PARSING & COLUMN SELECTION ---
let pendingCsvRows = [];

function cleanCSVField(str) {
    if (!str) return '';
    let s = str.trim();
    if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
        s = s.substring(1, s.length - 1).trim();
    }
    // Replace escaped double quotes "" with "
    s = s.replace(/""/g, '"');
    return s;
}

function parseCSVText(text) {
    if (!text) return [];
    // Remove UTF-8 BOM if present
    text = text.replace(/^\uFEFF/, '');
    // Normalize line endings (CR-only -> LF, CRLF -> LF)
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const lines = [];
    let curLine = [];
    let curVal = '';
    let inQuotes = false;
    
    // Robust delimiter detection: strip quoted strings first to avoid counting commas inside quotes
    const sampleText = text.substring(0, Math.min(3000, text.length));
    const sampleWithoutQuotes = sampleText.replace(/"[^"]*"/g, '');
    const commaCount = (sampleWithoutQuotes.match(/,/g) || []).length;
    const tabCount = (sampleWithoutQuotes.match(/\t/g) || []).length;
    const semiCount = (sampleWithoutQuotes.match(/;/g) || []).length;

    let delimiter = ',';
    if (tabCount > commaCount && tabCount > semiCount) {
        delimiter = '\t';
    } else if (semiCount > commaCount && semiCount > tabCount) {
        delimiter = ';';
    }

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    curVal += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                curVal += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delimiter) {
                curLine.push(cleanCSVField(curVal));
                curVal = '';
            } else if (char === '\r') {
                // ignore \r
            } else if (char === '\n') {
                curLine.push(cleanCSVField(curVal));
                if (curLine.some(cell => cell.length > 0)) {
                    lines.push(curLine);
                }
                curLine = [];
                curVal = '';
            } else {
                curVal += char;
            }
        }
    }
    if (curVal.length > 0 || curLine.length > 0) {
        curLine.push(cleanCSVField(curVal));
        if (curLine.some(cell => cell.length > 0)) {
            lines.push(curLine);
        }
    }
    return lines;
}

function showCSVColumnModal(fileName, rows) {
    pendingCsvRows = rows;
    const csvModalOverlay = document.getElementById('csv-modal-overlay');
    const csvColumnSelect = document.getElementById('csv-column-select');
    const csvColumnPreview = document.getElementById('csv-column-preview');
    const csvHasHeaderCheck = document.getElementById('csv-has-header-check');
    
    if (!csvModalOverlay || !csvColumnSelect) return;

    const colCount = rows.length > 0 ? Math.max(...rows.map(r => r.length)) : 0;
    if (colCount === 0) return;

    function findBestTextColumn() {
        let bestColIdx = 0;
        let maxScore = -1;
        const hasHeader = csvHasHeaderCheck ? csvHasHeaderCheck.checked : true;
        const startRow = hasHeader ? 1 : 0;

        for (let colIdx = 0; colIdx < colCount; colIdx++) {
            let score = 0;
            let headerName = "";
            if (hasHeader && rows[0] && rows[0][colIdx]) {
                headerName = rows[0][colIdx].trim();
            }

            if (/理由|詳細|記述|コメント|内容|意見|テキスト|本文|回答|アンケート|自由|備考/i.test(headerName)) {
                score += 2000;
            }

            let totalLen = 0;
            let count = 0;
            for (let r = startRow; r < Math.min(startRow + 20, rows.length); r++) {
                if (rows[r] && rows[r][colIdx]) {
                    const str = rows[r][colIdx].trim();
                    totalLen += str.length;
                    count++;
                }
            }
            const avgLen = count > 0 ? (totalLen / count) : 0;
            score += avgLen * 10;

            if (score > maxScore) {
                maxScore = score;
                bestColIdx = colIdx;
            }
        }
        return bestColIdx;
    }

    function populateOptions() {
        csvColumnSelect.innerHTML = '';
        const hasHeader = csvHasHeaderCheck ? csvHasHeaderCheck.checked : true;
        const startRow = hasHeader ? 1 : 0;
        const bestColIdx = findBestTextColumn();

        for (let colIdx = 0; colIdx < colCount; colIdx++) {
            let headerName = "";
            if (hasHeader && rows[0] && rows[0][colIdx]) {
                headerName = rows[0][colIdx].trim();
            }
            
            // Find sample data
            let sampleVal = "";
            for (let r = startRow; r < Math.min(startRow + 10, rows.length); r++) {
                if (rows[r] && rows[r][colIdx] !== undefined && rows[r][colIdx].trim()) {
                    sampleVal = rows[r][colIdx].trim();
                    break;
                }
            }

            const option = document.createElement('option');
            option.value = colIdx;
            if (colIdx === bestColIdx) option.selected = true;

            const shortSample = sampleVal.length > 25 ? sampleVal.substring(0, 25) + "..." : sampleVal;
            if (hasHeader && headerName) {
                option.innerText = `[ ${colIdx + 1}列目 ] "${headerName}" ${shortSample ? `(例: ${shortSample})` : '(データ空)'}`;
            } else {
                option.innerText = `[ ${colIdx + 1}列目 ] ${shortSample ? `(例: ${shortSample})` : '(データ空)'}`;
            }
            csvColumnSelect.appendChild(option);
        }
        csvColumnSelect.value = bestColIdx;
        updatePreview();
    }

    function updatePreview() {
        const selectedCol = parseInt(csvColumnSelect.value) || 0;
        const hasHeader = csvHasHeaderCheck ? csvHasHeaderCheck.checked : true;
        const startRow = hasHeader ? 1 : 0;

        let samples = [];
        for (let r = startRow; r < Math.min(startRow + 5, rows.length); r++) {
            if (rows[r] && rows[r][selectedCol] !== undefined && rows[r][selectedCol].trim()) {
                samples.push(`・行${r + 1}: "${rows[r][selectedCol].trim()}"`);
            }
        }
        if (csvColumnPreview) {
            csvColumnPreview.innerHTML = samples.join('<br>') || '（データプレビューなし）';
        }
    }

    if (csvHasHeaderCheck) {
        csvHasHeaderCheck.onchange = populateOptions;
    }
    csvColumnSelect.onchange = updatePreview;

    populateOptions();
    csvModalOverlay.style.display = 'flex';
}

function initCSVModalListeners() {
    const csvModalOverlay = document.getElementById('csv-modal-overlay');
    const csvModalCloseBtn = document.getElementById('csv-modal-close-btn');
    const csvCancelBtn = document.getElementById('csv-cancel-btn');
    const csvConfirmBtn = document.getElementById('csv-confirm-btn');
    const csvColumnSelect = document.getElementById('csv-column-select');
    const csvHasHeaderCheck = document.getElementById('csv-has-header-check');

    if (csvModalCloseBtn) {
        csvModalCloseBtn.onclick = () => { csvModalOverlay.style.display = 'none'; };
    }
    if (csvCancelBtn) {
        csvCancelBtn.onclick = () => { csvModalOverlay.style.display = 'none'; };
    }
    if (csvConfirmBtn) {
        csvConfirmBtn.onclick = () => {
            const selectedCol = parseInt(csvColumnSelect.value) || 0;
            if (!pendingCsvRows || pendingCsvRows.length === 0) return;

            const hasHeader = csvHasHeaderCheck ? csvHasHeaderCheck.checked : true;
            const startRow = hasHeader ? 1 : 0;

            const extractedTextLines = [];
            for (let r = startRow; r < pendingCsvRows.length; r++) {
                if (pendingCsvRows[r] && pendingCsvRows[r][selectedCol] !== undefined) {
                    const val = pendingCsvRows[r][selectedCol].trim();
                    if (val.length > 0) extractedTextLines.push(val);
                }
            }

            if (extractedTextLines.length === 0) {
                alert("選択された列に有効なテキストデータが見つかりませんでした。別の列をお試しください。");
                return;
            }

            csvModalOverlay.style.display = 'none';
            loadTextAndTokenize(extractedTextLines.join('\n'));
        };
    }
}
initCSVModalListeners();

function handleFile(file) {
    fileInfo.innerText = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    const reader = new FileReader();
    reader.onload = (e) => {
        const buffer = e.target.result;
        let text = "";
        try {
            // First, try decoding strictly as UTF-8
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            text = utf8Decoder.decode(buffer);
        } catch (err) {
            // If it fails (e.g., invalid byte sequence for UTF-8), fallback to Shift-JIS
            console.log("UTF-8 decoding failed, falling back to Shift-JIS");
            const sjisDecoder = new TextDecoder('shift-jis');
            text = sjisDecoder.decode(buffer);
        }

        const isCsv = file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.tsv');
        if (isCsv) {
            const rows = parseCSVText(text);
            const isMultiColumn = rows.some(r => r.length > 1);
            if (isMultiColumn) {
                showCSVColumnModal(file.name, rows);
                return;
            }
        }
        loadTextAndTokenize(text);
    };
    // Read as ArrayBuffer to allow manual byte decoding
    reader.readAsArrayBuffer(file);
}

sampleBtn.addEventListener('click', async () => {
    fileInfo.innerText = "デモデータ読み込み中...";
    try {
        const res = await fetch('data/sample.txt');
        if (!res.ok) throw new Error('Failed to load sample data');
        const text = await res.text();
        fileInfo.innerText = "デモデータ適用中";
        loadTextAndTokenize(text);
    } catch (e) {
        console.error(e);
        fileInfo.innerText = "エラー: デモデータの読み込みに失敗しました";
        alert("デモデータの読み込みに失敗しました。ローカルファイルとして開いている場合は、サーバーを立ち上げてお試しください。");
    }
});

minCountRange.addEventListener('input', (e) => {
    minCountVal.innerText = e.target.value;
    if (displayType.value === 'network' || displayType.value === 'pca') {
        if (rawTextData) processAndRender();
    } else {
        updateWordCloud();
    }
});

maxWordsRange.addEventListener('input', (e) => {
    maxWordsVal.innerText = e.target.value;
    if (displayType.value === 'network' || displayType.value === 'pca') {
        if (rawTextData) processAndRender();
    } else {
        updateWordCloud();
    }
});

if (networkThresholdRange) {
    networkThresholdRange.addEventListener('input', (e) => {
        if (networkThresholdVal) networkThresholdVal.innerText = e.target.value;
        if (displayType.value === 'network' && rawTextData) {
            processAndRender();
        }
    });
}

// Render triggers for filters
[posNoun, posVerb, posAdj, posAdv, mergeNounsCheckbox, document.getElementById('ranking-method')].forEach(elem => {
    if (!elem) return;
    elem.addEventListener('change', () => {
        if (rawTextData) {
            processAndRender();
        }
    });
});

// Settings that only require redrawing/rendering updates (no K-means recalculation)
const cloudColorModeSelect = document.getElementById('cloud-color-mode');
const redrawElements = [colorTheme, fontSelect, shapeCircle, rotateText];
if (cloudColorModeSelect) redrawElements.push(cloudColorModeSelect);

redrawElements.forEach(elem => {
    elem.addEventListener('change', () => {
        if (rawTextData) {
            updateWordCloud();
        }
    });
});

function updateClusterCountGroupVisibility() {
    if (displayType && displayType.value === 'pca') {
        clusterCountGroup.style.display = 'block';
    } else if (clusterCountGroup) {
        clusterCountGroup.style.display = 'none';
    }

    const ldaTopicCountGroup = document.getElementById('lda-topic-count-group');
    if (ldaTopicCountGroup) {
        if (displayType && displayType.value === 'topic-lda') {
            ldaTopicCountGroup.style.display = 'block';
        } else {
            ldaTopicCountGroup.style.display = 'none';
        }
    }
    
    const cloudColorGroup = document.getElementById('cloud-color-mode-group');
    if (cloudColorGroup) {
        if (displayType && displayType.value === 'cloud') {
            cloudColorGroup.style.display = 'block';
        } else {
            cloudColorGroup.style.display = 'none';
        }
    }
    if (displayType && displayType.value === 'network') {
        if (networkThresholdGroup) networkThresholdGroup.style.display = 'none'; // hidden for now as per user request
    } else {
        if (networkThresholdGroup) networkThresholdGroup.style.display = 'none';
    }

    if (methodDescription && displayType) {
        const type = displayType.value;
        let descHtml = '';

        if (type === 'cloud') {
            descHtml = `
            <div class="method-title"><span class="method-icon">☁️</span>ワードクラウド</div>
            <div class="method-purpose">頻出語を大きく表示し、回答全体でよく使われたキーワードを一目で把握します。</div>
            <div class="reading-tips">
                <div class="tips-title">📌 読み方のポイント</div>
                <ul class="tips-list">
                    <li><strong>大きい語</strong> = 出現回数が多い（重要とは限らない）</li>
                    <li><strong>気になる語</strong>をダブルクリックすると除外できます</li>
                    <li>「特徴度 (TF-IDF)順」に切り替えると、<strong>その回答集に特有の語</strong>が大きくなります</li>
                </ul>
                <div class="tips-note">💡 まずこのビューで全体の雰囲気を把握し、次に「共起ネットワーク」で語の関係を深掘りしましょう。</div>
            </div>`;

        } else if (type === 'chart') {
            descHtml = `
            <div class="method-title"><span class="method-icon">📊</span>横棒グラフ（上位語リスト）</div>
            <div class="method-purpose">単語の出現回数や特徴度を数値で正確に比較できます。</div>
            <div class="reading-tips">
                <div class="tips-title">📌 読み方のポイント</div>
                <ul class="tips-list">
                    <li><strong>棒の長さ</strong> = 出現回数（または特徴度）の大きさ</li>
                    <li>「頻出度順」→ よく出てくる語のランキング</li>
                    <li>「特徴度 (TF-IDF) 順」→ 他のデータと比べてこの回答集に<strong>特有の語</strong>のランキング</li>
                </ul>
                <div class="tips-note">💡 上位10語が全体の傾向の中心です。エクセルでも似たことができますが、TF-IDFによる「特有語」の抽出はここならではです。</div>
            </div>`;

        } else if (type === 'network') {
            descHtml = `
            <div class="method-title"><span class="method-icon">🕸️</span>共起ネットワーク</div>
            <div class="method-purpose">同じ回答の中で一緒に使われやすい言葉を線で結び、回答に含まれるテーマの構造を可視化します。</div>
            <div class="reading-tips">
                <div class="tips-title">📌 読み方のポイント</div>
                <ul class="tips-list">
                    <li><strong>同じ色のグループ</strong> = 1つのテーマ（コミュニティ）</li>
                    <li><strong>線が太い</strong> = 一緒に使われる頻度が高い（強い関連）</li>
                    <li><strong>円が大きい</strong> = 出現回数が多い中心的な語</li>
                    <li><strong>グループをまたぐ語</strong> = 複数テーマをつなぐ「橋渡し役」</li>
                    <li><strong>孤立している語</strong> = 他の主要なキーワードと一緒に使われることが少ない、独立した話題の語</li>
                </ul>
                <div class="tips-note">💡 「繋がりやすさ」の数値を<strong>小さくすると線が増え</strong>（細かい関係が見える）、<strong>大きくすると線が減り</strong>（強い結びつきだけが残る）ます。「最小出現回数」を上げるとノイズが減り、テーマがくっきりします。</div>
            </div>`;

        } else if (type === 'pca') {
            descHtml = `
            <div class="method-title"><span class="method-icon">🔭</span>多変量解析（PCA散布図）</div>
            <div class="method-purpose">使われ方が似ている語を近くに配置し、回答全体のテーマの広がりや構造を俯瞰します。</div>
            <div class="reading-tips">
                <div class="tips-title">📌 読み方のポイント</div>
                <ul class="tips-list">
                    <li><strong>近くにある語</strong> = 似た文脈・同じ話題で使われる語</li>
                    <li><strong>同じ色の塊</strong> = K平均法で自動分類されたテーマのまとまり（クラスター）</li>
                    <li><strong>寄与率の合計</strong>はこの図がデータ全体の情報をどの程度表せているかの目安です（テキスト分析では数％〜20％程度と低めに出るのが一般的です）</li>
                    <li><strong>遠く離れた語</strong> = 他の語とは全く異なる文脈で使われる語</li>
                </ul>
                <div class="tips-note">💡 「クラスター数」を変えるとグループ分けが変わります。共起ネットワークのグループと見比べると、より深い洞察が得られます。</div>
            </div>`;
        } else if (type === 'topic-lda') {
            descHtml = `
            <div class="method-title"><span class="method-icon">🧠</span>トピック分析 (LDAモデル・潜在話題)</div>
            <div class="method-purpose">文書全体に潜む潜在的な話題（トピック）を自動抽出し、各トピックを象徴する代表的なキーワードTop10を提示します。</div>
            <div class="reading-tips">
                <div class="tips-title">📌 読み方のポイント</div>
                <ul class="tips-list">
                    <li><strong>自動選出トピック</strong> = 統計的適合度（Perplexity）に基づき最適話題数が全自動決定されます</li>
                    <li><strong>ソフトクラスタリング</strong> = 単語は単一グループに固定されず、複数のトピックへの所属確率（混合比率）を持ちます</li>
                    <li><strong>単語をクリック</strong>すると、その単語の各トピックへの確率分布と元の文章（KWIC）を確認できます</li>
                </ul>
                <div class="tips-note">💡 各トピックの代表語を見ることで、テキスト全体にどのようなテーマが潜んでいるかが分かります。</div>
            </div>`;
        }

        methodDescription.innerHTML = descHtml;
    }
}

// Combined displayType change handler: update description/cluster UI AND re-render
displayType.addEventListener('change', () => {
    updateClusterCountGroupVisibility();
    if (rawTextData) {
        processAndRender();
    }
});

// clusterCount slider: only re-draw (no full NLP re-parse)
if (clusterCount) {
    clusterCount.addEventListener('change', () => {
        if (rawTextData) updateWordCloud();
    });
    clusterCount.addEventListener('input', () => {
        if (rawTextData) updateWordCloud();
    });
}

// LDA topic count: toggle manual input and re-render
const ldaTopicRadios = document.querySelectorAll('input[name="lda-topic-mode"]');
const ldaTopicCountInput = document.getElementById('lda-topic-count');
if (ldaTopicRadios.length > 0 && ldaTopicCountInput) {
    ldaTopicRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const isManual = document.querySelector('input[name="lda-topic-mode"]:checked').value === 'manual';
            ldaTopicCountInput.disabled = !isManual;
            if (rawTextData) processAndRender();
        });
    });
    ldaTopicCountInput.addEventListener('change', () => {
        if (rawTextData) processAndRender();
    });
}

window.addEventListener('resize', () => {
    if (rawTextData) {
        resizeCanvas();
        updateWordCloud();
    }
});

function resizeCanvas() {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    cloudCanvas.width = width;
    cloudCanvas.height = height;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// 3. Mouse interaction on Canvas (for Bar Chart, Co-occurrence Network, and PCA Scatter Plot)
cloudCanvas.addEventListener('mousemove', (e) => {
    if (wordFrequencies.length === 0) return;
    const currentMode = displayType.value;
    if (currentMode === 'cloud') return;

    const rect = cloudCanvas.getBoundingClientRect();
    const scaleX = cloudCanvas.width / rect.width;
    const scaleY = cloudCanvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (currentMode === 'chart') {
        const scaleFactor = cloudCanvas.width / 1024;
        const topMargin = 60 * scaleFactor;
        const bottomMargin = 40 * scaleFactor;
        const minCount = parseInt(minCountRange.value);
        const maxWords = parseInt(maxWordsRange.value);
        const filteredList = wordFrequencies
            .filter(item => item.count >= minCount)
            .slice(0, Math.min(20, maxWords));

        if (filteredList.length === 0) return;

        const availableHeight = cloudCanvas.height - topMargin - bottomMargin;
        const rowHeight = availableHeight / filteredList.length;
        const barHeight = Math.max(12 * scaleFactor, Math.min(24 * scaleFactor, rowHeight * 0.6));

        let hoveredIndex = -1;
        for (let i = 0; i < filteredList.length; i++) {
            const y = topMargin + i * rowHeight;
            if (mouseY >= y && mouseY <= y + barHeight) {
                hoveredIndex = i;
                break;
            }
        }

        if (hoveredIndex !== -1) {
            const item = filteredList[hoveredIndex];
            const rankingMethod = document.getElementById('ranking-method').value;
            const valDisplay = rankingMethod === 'tfidf'
                ? `出現回数: ${item.count}回<br>特徴度 (TF-IDF): ${item.tfidf.toFixed(2)}`
                : `出現回数: ${item.count}回`;

            tooltip.style.display = 'block';
            tooltip.style.left = `${e.clientX - canvasContainer.getBoundingClientRect().left + 15}px`;
            tooltip.style.top = `${e.clientY - canvasContainer.getBoundingClientRect().top + 15}px`;
            tooltip.innerHTML = `<strong>${item.text}</strong><br>${valDisplay}<br><small style="color: var(--text-muted)">ダブルクリックで除外</small>`;
            cloudCanvas.style.cursor = 'pointer';
        } else {
            tooltip.style.display = 'none';
            cloudCanvas.style.cursor = 'default';
        }
    } else if (currentMode === 'network') {
        const scaleFactor = cloudCanvas.width / 1024;
        let hoveredNode = null;
        for (let i = networkNodes.length - 1; i >= 0; i--) { let node = networkNodes[i];
            const dx = mouseX - node.x;
            const dy = mouseY - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= node.radius * scaleFactor) {
                hoveredNode = node;
                break;
            }
        }

        if (hoveredNode) {
            tooltip.style.display = 'block';
            tooltip.style.left = `${e.clientX - canvasContainer.getBoundingClientRect().left + 15}px`;
            tooltip.style.top = `${e.clientY - canvasContainer.getBoundingClientRect().top + 15}px`;
            
            const connections = networkEdges
                .filter(edge => edge.source.id === hoveredNode.id || edge.target.id === hoveredNode.id)
                .map(edge => edge.source.id === hoveredNode.id ? edge.target.id : edge.source.id)
                .slice(0, 5)
                .join(', ');
                
            const selectedTheme = colorTheme.value;
            let ldaTopicText = '';
            if (selectedTheme === 'topic-lda' && currentLdaResult && currentLdaResult.wordTopics[hoveredNode.id]) {
                const tInfo = currentLdaResult.wordTopics[hoveredNode.id];
                ldaTopicText = `<br><span style="color: var(--accent-blue); font-weight: 600;">所属トピック: ${tInfo.label} (${(tInfo.prob * 100).toFixed(0)}%)</span>`;
            }
            const connText = connections ? `<br>主な共起語: ${connections}` : '';
            tooltip.innerHTML = `<strong>${hoveredNode.id}</strong><br>出現回数: ${hoveredNode.count}回<br>グループ: ${hoveredNode.communityLabel}${ldaTopicText}${connText}<br><small style="color: var(--text-muted)">ダブルクリックで除外</small>`;
            cloudCanvas.style.cursor = 'pointer';
        } else {
            tooltip.style.display = 'none';
            cloudCanvas.style.cursor = 'default';
        }
    } else if (currentMode === 'pca') {
        if (pcaPoints.length === 0) return;
        
        const xs = pcaPoints.map(p => p.x);
        const ys = pcaPoints.map(p => p.y);
        const minX = Math.min(...xs, -0.01);
        const maxX = Math.max(...xs, 0.01);
        const minY = Math.min(...ys, -0.01);
        const maxY = Math.max(...ys, 0.01);
        
        const pad = 100 * (cloudCanvas.width / 1024);
        
        const getCanvasX = (x) => pad + ((x - minX) / (maxX - minX)) * (cloudCanvas.width - 2 * pad);
        const getCanvasY = (y) => pad + ((maxY - y) / (maxY - minY)) * (cloudCanvas.height - 2 * pad);

        // Cache min/max counts once outside the loop for performance
        const pcaCounts = pcaPoints.map(p => p.count);
        const pcaMinCount = Math.min(...pcaCounts);
        const pcaMaxCount = Math.max(...pcaCounts);

        let hoveredPoint = null;
        for (let i = pcaPoints.length - 1; i >= 0; i--) { let pt = pcaPoints[i];
            const px = getCanvasX(pt.x);
            const py = getCanvasY(pt.y);
            const dx = mouseX - px;
            const dy = mouseY - py;
            
            let radius = 10;
            if (pcaMaxCount !== pcaMinCount) {
                radius = 5 + ((pt.count - pcaMinCount) / (pcaMaxCount - pcaMinCount)) * 14;
            }
            
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius * (cloudCanvas.width / 1024) + 8) {
                hoveredPoint = pt;
                break;
            }
        }

        if (hoveredPoint) {
            tooltip.style.display = 'block';
            tooltip.style.left = `${e.clientX - canvasContainer.getBoundingClientRect().left + 15}px`;
            tooltip.style.top = `${e.clientY - canvasContainer.getBoundingClientRect().top + 15}px`;
            
            const selectedTheme = colorTheme.value;
            let ldaTopicText = '';
            if (selectedTheme === 'topic-lda' && currentLdaResult && currentLdaResult.wordTopics[hoveredPoint.word]) {
                const tInfo = currentLdaResult.wordTopics[hoveredPoint.word];
                ldaTopicText = `<br><span style="color: var(--accent-blue); font-weight: 600;">所属トピック: ${tInfo.label} (${(tInfo.prob * 100).toFixed(0)}%)</span>`;
            }
            tooltip.innerHTML = `<strong>${hoveredPoint.word}</strong><br>出現回数: ${hoveredPoint.count}回<br>クラスター: C${hoveredPoint.cluster + 1}${ldaTopicText}<br><small style="color: var(--text-muted)">ダブルクリックで除外</small>`;
            cloudCanvas.style.cursor = 'pointer';
        } else {
            tooltip.style.display = 'none';
            cloudCanvas.style.cursor = 'default';
        }
    }
});

let canvasLastClickedWord = null;
let canvasLastClickedTime = 0;

// Single click handler for KWIC Popup
cloudCanvas.addEventListener('click', (e) => {
    if (wordFrequencies.length === 0) return;
    const currentMode = displayType.value;
    if (currentMode === 'cloud') return; // Handled separately by WordCloud library

    const rect = cloudCanvas.getBoundingClientRect();
    const scaleX = cloudCanvas.width / rect.width;
    const scaleY = cloudCanvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    let clickedWord = null;
    let clickedCount = 0;

    if (currentMode === 'chart') {
        const scaleFactor = cloudCanvas.width / 1024;
        const topMargin = 60 * scaleFactor;
        const bottomMargin = 40 * scaleFactor;
        const minCount = parseInt(minCountRange.value);
        const maxWords = parseInt(maxWordsRange.value);
        const filteredList = wordFrequencies
            .filter(item => item.count >= minCount)
            .slice(0, Math.min(20, maxWords));

        if (filteredList.length === 0) return;

        const availableHeight = cloudCanvas.height - topMargin - bottomMargin;
        const rowHeight = availableHeight / filteredList.length;
        const barHeight = Math.max(12 * scaleFactor, Math.min(24 * scaleFactor, rowHeight * 0.6));

        for (let i = 0; i < filteredList.length; i++) {
            const y = topMargin + i * rowHeight;
            if (mouseY >= y && mouseY <= y + barHeight) {
                clickedWord = filteredList[i].text;
                clickedCount = filteredList[i].count;
                break;
            }
        }
    } else if (currentMode === 'network') {
        const scaleFactor = cloudCanvas.width / 1024;
        for (let i = networkNodes.length - 1; i >= 0; i--) { let node = networkNodes[i];
            const dx = mouseX - node.x;
            const dy = mouseY - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= node.radius * scaleFactor) {
                clickedWord = node.id;
                clickedCount = node.count;
                break;
            }
        }
    } else if (currentMode === 'pca') {
        if (pcaPoints.length === 0) return;
        
        const xs = pcaPoints.map(p => p.x);
        const ys = pcaPoints.map(p => p.y);
        const minX = Math.min(...xs, -0.01);
        const maxX = Math.max(...xs, 0.01);
        const minY = Math.min(...ys, -0.01);
        const maxY = Math.max(...ys, 0.01);
        
        const pad = 100 * (cloudCanvas.width / 1024);
        const getCanvasX = (x) => pad + ((x - minX) / (maxX - minX)) * (cloudCanvas.width - 2 * pad);
        const getCanvasY = (y) => pad + ((maxY - y) / (maxY - minY)) * (cloudCanvas.height - 2 * pad);

        const pcaClickCounts = pcaPoints.map(p => p.count);
        const pcaClickMinCount = Math.min(...pcaClickCounts);
        const pcaClickMaxCount = Math.max(...pcaClickCounts);

        for (let i = pcaPoints.length - 1; i >= 0; i--) { let pt = pcaPoints[i];
            const px = getCanvasX(pt.x);
            const py = getCanvasY(pt.y);
            const dx = mouseX - px;
            const dy = mouseY - py;
            
            let radius = 10;
            if (pcaClickMaxCount !== pcaClickMinCount) {
                radius = 5 + ((pt.count - pcaClickMinCount) / (pcaClickMaxCount - pcaClickMinCount)) * 14;
            }
            
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius * (cloudCanvas.width / 1024) + 8) {
                clickedWord = pt.word;
                clickedCount = pt.count;
                break;
            }
        }
    }

    if (clickedWord) {
        const now = Date.now();
        canvasLastClickedWord = clickedWord;
        canvasLastClickedTime = now;
        
        setTimeout(() => {
            if (canvasLastClickedWord === clickedWord && Date.now() - canvasLastClickedTime >= 300) {
                openKWICModal(clickedWord, clickedCount);
            }
        }, 350);
    }
});

// Exclude words strictly on DOUBLE CLICK to avoid accidental exclusions
cloudCanvas.addEventListener('dblclick', (e) => {
    if (wordFrequencies.length === 0) return;
    const currentMode = displayType.value;
    if (currentMode === 'cloud') return;

    const rect = cloudCanvas.getBoundingClientRect();
    const scaleX = cloudCanvas.width / rect.width;
    const scaleY = cloudCanvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (currentMode === 'chart') {
        const scaleFactor = cloudCanvas.width / 1024;
        const topMargin = 60 * scaleFactor;
        const bottomMargin = 40 * scaleFactor;
        const minCount = parseInt(minCountRange.value);
        const maxWords = parseInt(maxWordsRange.value);
        const filteredList = wordFrequencies
            .filter(item => item.count >= minCount)
            .slice(0, Math.min(20, maxWords));

        if (filteredList.length === 0) return;

        const availableHeight = cloudCanvas.height - topMargin - bottomMargin;
        const rowHeight = availableHeight / filteredList.length;
        const barHeight = Math.max(12 * scaleFactor, Math.min(24 * scaleFactor, rowHeight * 0.6));

        for (let i = 0; i < filteredList.length; i++) {
            const y = topMargin + i * rowHeight;
            if (mouseY >= y && mouseY <= y + barHeight) {
                canvasLastClickedWord = null;
                addStopWord(filteredList[i].text);
                tooltip.style.display = 'none';
                break;
            }
        }
    } else if (currentMode === 'network') {
        const scaleFactor = cloudCanvas.width / 1024;
        for (let i = networkNodes.length - 1; i >= 0; i--) { let node = networkNodes[i];
            const dx = mouseX - node.x;
            const dy = mouseY - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= node.radius * scaleFactor) {
                canvasLastClickedWord = null;
                addStopWord(node.id);
                tooltip.style.display = 'none';
                break;
            }
        }
    } else if (currentMode === 'pca') {
        if (pcaPoints.length === 0) return;
        
        const xs = pcaPoints.map(p => p.x);
        const ys = pcaPoints.map(p => p.y);
        const minX = Math.min(...xs, -0.01);
        const maxX = Math.max(...xs, 0.01);
        const minY = Math.min(...ys, -0.01);
        const maxY = Math.max(...ys, 0.01);
        
        const pad = 100 * (cloudCanvas.width / 1024);
        
        const getCanvasX = (x) => pad + ((x - minX) / (maxX - minX)) * (cloudCanvas.width - 2 * pad);
        const getCanvasY = (y) => pad + ((maxY - y) / (maxY - minY)) * (cloudCanvas.height - 2 * pad);

        // Cache min/max counts once outside the loop for performance
        const dblPcaCounts = pcaPoints.map(p => p.count);
        const dblPcaMinCount = Math.min(...dblPcaCounts);
        const dblPcaMaxCount = Math.max(...dblPcaCounts);

        for (let i = pcaPoints.length - 1; i >= 0; i--) { let pt = pcaPoints[i];
            const px = getCanvasX(pt.x);
            const py = getCanvasY(pt.y);
            const dx = mouseX - px;
            const dy = mouseY - py;
            
            let radius = 10;
            if (dblPcaMaxCount !== dblPcaMinCount) {
                radius = 5 + ((pt.count - dblPcaMinCount) / (dblPcaMaxCount - dblPcaMinCount)) * 14;
            }
            
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius * (cloudCanvas.width / 1024) + 8) {
                canvasLastClickedWord = null;
                addStopWord(pt.word);
                tooltip.style.display = 'none';
                break;
            }
        }
    }
});

// K-means Clustering Helper
// Uses K-means++ initialization for better starting centroids,
// and runs nRuns times, returning the trial with the lowest inertia (most stable result).
function runKMeans(points, k, nRuns = 5) {
    const n = points.length;
    if (n <= k) {
        return points.map((_, i) => i);
    }

    let bestAssignments = null;
    let bestInertia = Infinity;

    for (let run = 0; run < nRuns; run++) {
        // --- K-means++ Initialization ---
        const centroids = [];
        // 1. Pick first centroid uniformly at random
        centroids.push({ x: points[Math.floor(Math.random() * n)].x,
                         y: points[Math.floor(Math.random() * n)].y });

        // 2. Pick remaining centroids with probability proportional to squared distance
        for (let c = 1; c < k; c++) {
            const dists = points.map(p => {
                let minDist = Infinity;
                for (const cent of centroids) {
                    const dx = p.x - cent.x;
                    const dy = p.y - cent.y;
                    const d = dx * dx + dy * dy;
                    if (d < minDist) minDist = d;
                }
                return minDist;
            });
            const total = dists.reduce((a, b) => a + b, 0);
            if (total === 0) {
                centroids.push({ x: points[0].x, y: points[0].y });
                continue;
            }
            let r = Math.random() * total;
            let chosen = n - 1;
            for (let i = 0; i < n; i++) {
                r -= dists[i];
                if (r <= 0) { chosen = i; break; }
            }
            centroids.push({ x: points[chosen].x, y: points[chosen].y });
        }

        // --- Standard K-means iterations ---
        let assignments = new Int32Array(n);
        let changed = true;
        let maxLoop = 100;

        while (changed && maxLoop-- > 0) {
            changed = false;
            for (let i = 0; i < n; i++) {
                let minDist = Infinity;
                let bestCluster = 0;
                for (let c = 0; c < k; c++) {
                    const dx = points[i].x - centroids[c].x;
                    const dy = points[i].y - centroids[c].y;
                    const dist = dx * dx + dy * dy;
                    if (dist < minDist) { minDist = dist; bestCluster = c; }
                }
                if (assignments[i] !== bestCluster) {
                    assignments[i] = bestCluster;
                    changed = true;
                }
            }
            const sumsX = new Float64Array(k);
            const sumsY = new Float64Array(k);
            const clusterSizes = new Int32Array(k);
            for (let i = 0; i < n; i++) {
                const c = assignments[i];
                sumsX[c] += points[i].x;
                sumsY[c] += points[i].y;
                clusterSizes[c]++;
            }
            for (let c = 0; c < k; c++) {
                if (clusterSizes[c] > 0) {
                    centroids[c].x = sumsX[c] / clusterSizes[c];
                    centroids[c].y = sumsY[c] / clusterSizes[c];
                }
            }
        }

        // --- Compute inertia and keep best run ---
        let inertia = 0;
        for (let i = 0; i < n; i++) {
            const c = assignments[i];
            const dx = points[i].x - centroids[c].x;
            const dy = points[i].y - centroids[c].y;
            inertia += dx * dx + dy * dy;
        }
        if (inertia < bestInertia) {
            bestInertia = inertia;
            bestAssignments = Array.from(assignments);
        }
    }

    return bestAssignments;
}

// CSV Exporter Helper
function downloadCSV(filename, csvContent) {
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // BOM UTF-8 for Excel
    const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Instantly download words list using cached counts (fixed POS filter bug)
exportWordsCsvBtn.addEventListener('click', () => {
    if (wordFrequencies.length === 0) return;
    
    let csv = "単語,出現回数,特徴度 (TF-IDF),クラスターID\n";
    wordFrequencies.forEach(item => {
        const pcaPoint = pcaPoints.find(p => p.word === item.text);
        const clusterId = pcaPoint ? `C${pcaPoint.cluster + 1}` : "-";
        const escapedWord = item.text.includes('"') ? item.text.replace(/"/g, '""') : item.text;
        csv += `"${escapedWord}",${item.count},${item.tfidf.toFixed(4)},${clusterId}\n`;
    });
    
    downloadCSV("word_frequency_metrics.csv", csv);
});

// Instantly download co-occurrence pairs matching user checkboxes (no redundant tokenizing)
exportPairsCsvBtn.addEventListener('click', () => {
    if (wordFrequencies.length === 0) return;
    
    let csv = "単語A,単語B,共起回数,共起の強さ (Jaccard係数)\n";
    const pairs = [];
    
    Object.entries(currentAnalysisCoocCounts).forEach(([key, fAB]) => {
        const [w1, w2] = key.split('|||');
        // Use document frequency (not raw count) for correct Jaccard denominator
        const cA = currentAnalysisDocFreq[w1] || 1;
        const cB = currentAnalysisDocFreq[w2] || 1;
        const denom = cA + cB - fAB;
        const jaccard = denom > 0 ? fAB / denom : 0;
        if (jaccard > 0.01) {
            pairs.push({ w1, w2, fAB, jaccard });
        }
    });
    
    pairs.sort((a, b) => b.jaccard - a.jaccard);
    pairs.forEach(p => {
        const escapedW1 = p.w1.includes('"') ? p.w1.replace(/"/g, '""') : p.w1;
        const escapedW2 = p.w2.includes('"') ? p.w2.replace(/"/g, '""') : p.w2;
        csv += `"${escapedW1}","${escapedW2}",${p.fAB},${p.jaccard.toFixed(4)}\n`;
    });
    
    downloadCSV("co_occurrence_pairs_metrics.csv", csv);
});

// Merge tokens that match custom compound words and apply synonym replacements
function mergeCompoundsAndSynonyms(tokens, compoundWordsSet, synonymRulesMap) {
    if (!tokens || tokens.length === 0) return tokens || [];
    if (compoundWordsSet.size === 0 && synonymRulesMap.size === 0) return tokens;
    
    // Create a combined list of search strings (compounds + synonym sources)
    const searchKeys = Array.from(new Set([...compoundWordsSet, ...synonymRulesMap.keys()]));
    
    // Sort search strings by length descending so longer phrases match first
    const searchStrings = searchKeys.sort((a, b) => b.length - a.length);
    
    let mergedTokens = [];
    let i = 0;
    while (i < tokens.length) {
        let matched = false;
        for (const cw of searchStrings) {
            let combinedStr = "";
            let j = i;
            while (j < tokens.length) {
                combinedStr += tokens[j].surface_form;
                j++;
                if (combinedStr === cw) {
                    break;
                }
                if (!cw.startsWith(combinedStr)) {
                    break;
                }
            }
            if (combinedStr === cw || combinedStr.replace(/\s+/g, '') === cw.replace(/\s+/g, '')) {
                // If it's a synonym rule, replace the word with the target. Otherwise keep the compound word.
                const targetWord = synonymRulesMap.has(cw) ? synonymRulesMap.get(cw) : cw;
                
                mergedTokens.push({
                    surface_form: targetWord,
                    pos: '名詞', // Force to Noun
                    pos_detail_1: synonymRulesMap.has(cw) ? '同義語' : '複合語',
                    basic_form: targetWord
                });
                i = j;
                matched = true;
                break;
            }
        }
        if (!matched) {
            mergedTokens.push(tokens[i]);
            i++;
        }
    }
    return mergedTokens;
}

// 4. Text Processing (Morphological Analysis, Network, and PCA)

// Automatically merge consecutive nouns into a single compound noun
function mergeConsecutiveNouns(tokens) {
    if (!tokens || tokens.length === 0) return tokens;
    let merged = [];
    let i = 0;
    
    const isNounForMerge = (t) => {
        if (!t) return false;
        // Don't merge over user-defined compound words (act as boundaries)
        if (t.pos_detail_1 === '複合語') return false;
        
        // Include Nouns and Prefixes. Exclude non-independent and pronouns.
        if (t.pos === '名詞' || t.pos === '接頭詞') {
            if (t.pos_detail_1 === '非自立' || t.pos_detail_1 === '代名詞' || t.pos_detail_1 === '数' || t.pos_detail_1 === '接尾') {
                return false;
            }
            return true;
        }
        return false;
    };

    while (i < tokens.length) {
        let t = tokens[i];
        if (isNounForMerge(t)) {
            let j = i + 1;
            let combinedSurface = t.surface_form;
            
            while (j < tokens.length && isNounForMerge(tokens[j])) {
                combinedSurface += tokens[j].surface_form;
                j++;
            }
            
            if (j > i + 1) {
                merged.push({
                    surface_form: combinedSurface,
                    pos: '名詞',
                    pos_detail_1: '複合名詞', 
                    basic_form: combinedSurface
                });
            } else {
                merged.push(t);
            }
            i = j;
        } else {
            merged.push(t);
            i++;
        }
    }
    return merged;
}

function processAndRender() {
    if (!tokenizer || !rawTextData || globalAnalyzedLines.length === 0) return;

    oldNetworkNodes = [...networkNodes];

    if (emptyState) emptyState.style.display = 'none';

    const allowedPOS = [];
    if (posNoun.checked) allowedPOS.push('名詞');
    if (posVerb.checked) allowedPOS.push('動詞');
    if (posAdj.checked) allowedPOS.push('形容詞');
    if (posAdv.checked) allowedPOS.push('副詞');

    const counts = {};
    const docFreq = {};
    const coocCounts = {};
    const uniqueWordsPerLine = [];
    const lineWordsList = [];

    globalAnalyzedLines.forEach(originalTokens => {
        let tokens = mergeCompoundsAndSynonyms(originalTokens, customCompoundWords, customSynonymRules);
        if (mergeNounsCheckbox && mergeNounsCheckbox.checked) {
            tokens = mergeConsecutiveNouns(tokens);
        }
        
        const uniqueWordsInLine = new Set();
        const lineWords = [];
        
        tokens.forEach(token => {
            const pos = token.pos;
            const posDetail1 = token.pos_detail_1;
            
            if (!allowedPOS.includes(pos)) return;

            if (pos === '名詞') {
                if (posDetail1 === '数' || posDetail1 === '非自立' || posDetail1 === '接尾' || posDetail1 === '代名詞') {
                    return;
                }
            }

            let word = (pos === '動詞' || pos === '形容詞' || pos === '副詞') && token.basic_form !== '*' 
                ? token.basic_form 
                : token.surface_form;

            word = word.trim();
            if (!word) return;

            if (word.length === 1 && /^[ぁ-んァ-ヶ]$/.test(word)) return;
            if (/^[0-9０-９\s\.\,\-\_]+$/.test(word)) return;
            if (defaultStopWordsSet.has(word) || defaultStopWordsSet.has(word.toLowerCase())) return;
            if (customStopWords.has(word) || customStopWords.has(word.toLowerCase())) return;

            counts[word] = (counts[word] || 0) + 1;
            uniqueWordsInLine.add(word);
            lineWords.push(word);
        });

        uniqueWordsPerLine.push(uniqueWordsInLine);
        lineWordsList.push(lineWords);

        const wordsArr = Array.from(uniqueWordsInLine);
        for (let i = 0; i < wordsArr.length; i++) {
            docFreq[wordsArr[i]] = (docFreq[wordsArr[i]] || 0) + 1;
            for (let j = i + 1; j < wordsArr.length; j++) {
                const w1 = wordsArr[i];
                const w2 = wordsArr[j];
                const key = w1 < w2 ? `${w1}|||${w2}` : `${w2}|||${w1}`;
                coocCounts[key] = (coocCounts[key] || 0) + 1;
            }
        }
    });

    // Cache final calculations for synchronous instant CSV export
    currentAnalysisCounts = counts;
    currentAnalysisCoocCounts = coocCounts;
    currentAnalysisDocFreq = docFreq; // Needed for correct Jaccard in CSV export

    const rankingMethod = document.getElementById('ranking-method').value;

    wordFrequencies = Object.entries(counts)
        .map(([text, count]) => {
            const df = docFreq[text] || 1;
            const idf = Math.log(opinionLinesCount / df) + 1;
            const tfidf = count * idf;
            return { text, count, tfidf };
        });

    if (rankingMethod === 'tfidf') {
        wordFrequencies.sort((a, b) => b.tfidf - a.tfidf);
    } else {
        wordFrequencies.sort((a, b) => b.count - a.count);
    }

    if (wordFrequencies.length > 0) {
        const maxDataCount = Math.max(...wordFrequencies.map(w => w.count));
        minCountRange.max = maxDataCount;
        if (parseInt(minCountRange.value) > maxDataCount) {
            minCountRange.value = maxDataCount;
            minCountVal.innerText = maxDataCount;
        }
    }

    const totalWords = wordFrequencies.reduce((sum, item) => sum + item.count, 0);
    updateStatsBar(opinionLinesCount, totalWords, wordFrequencies.length);

    // --- MINIMUM DATA WARNING (②) ---
    const dataWarningEl = document.getElementById('data-warning');
    if (dataWarningEl) {
        if (opinionLinesCount < 5) {
            dataWarningEl.textContent = `⚠️ データが少なすぎます（${opinionLinesCount}件）。信頼できる分析には30件以上を推奨します。`;
            dataWarningEl.style.display = 'inline';
            dataWarningEl.style.color = '#EF4444';
        } else if (opinionLinesCount < 15) {
            dataWarningEl.textContent = `⚠️ データが少ない（${opinionLinesCount}件）。ネットワーク・LDAは参考程度にしてください（30件以上推奨）。`;
            dataWarningEl.style.display = 'inline';
            dataWarningEl.style.color = '#F59E0B';
        } else if (opinionLinesCount < 30) {
            dataWarningEl.textContent = `💡 ${opinionLinesCount}件のデータです。30件以上になるとより安定した分析結果が得られます。`;
            dataWarningEl.style.display = 'inline';
            dataWarningEl.style.color = 'var(--text-muted)';
        } else {
            dataWarningEl.style.display = 'none';
        }
    }

    // --- CO-OCCURRENCE NETWORK PREPARATION ---
    const minCount = parseInt(minCountRange.value);
    const maxWords = parseInt(maxWordsRange.value);
    const filteredList = wordFrequencies.filter(item => item.count >= minCount).slice(0, maxWords);
    const allowedWordsSet = new Set(filteredList.map(item => item.text));

    const rawEdges = [];
    Object.entries(coocCounts).forEach(([key, fAB]) => {
        const [w1, w2] = key.split('|||');
        
        // Only consider edges between the frequent words
        if (!allowedWordsSet.has(w1) || !allowedWordsSet.has(w2)) return;

        // BUG FIX: use document frequency (how many lines contain the word),
        // not total occurrence count, for a mathematically correct Jaccard coefficient.
        const cA = docFreq[w1] || 0;
        const cB = docFreq[w2] || 0;
        const denom = cA + cB - fAB;
        const jaccard = denom > 0 ? fAB / denom : 0;
        
        if (jaccard > 0.04) {
            rawEdges.push({ sourceId: w1, targetId: w2, weight: jaccard });
        }
    });
    
    rawEdges.sort((a, b) => b.weight - a.weight);
    
    // Filter to only meaningfully strong connections based on UI
    const finalThreshold = 0.05;
    const strictEdges = rawEdges.filter(e => e.weight >= finalThreshold);
    
    // Limit to exactly 1.0 * maxWords to naturally separate the graph into disjoint communities
    const topEdges = strictEdges.slice(0, Math.round(maxWords * 1.0));

    const networkNodesSet = new Set();
    topEdges.forEach(e => {
        if (networkNodesSet.size < maxWords) networkNodesSet.add(e.sourceId);
        if (networkNodesSet.size < maxWords) networkNodesSet.add(e.targetId);
    });

    // NOTE: We intentionally DO NOT add isolated nodes. 
    // If a word has no strong connections, it is hidden to keep the network clean.

    const tempNodes = Array.from(networkNodesSet).map(word => {
        return {
            id: word,
            count: counts[word] || 1,
            community: word,
            x: cloudCanvas.width / 2 + (Math.random() - 0.5) * 200,
            y: cloudCanvas.height / 2 + (Math.random() - 0.5) * 200,
            vx: 0,
            vy: 0
        };
    });

    const maxNodeCount = tempNodes.length > 0 ? Math.max(...tempNodes.map(n => n.count)) : 1;
    const minNodeCount = tempNodes.length > 0 ? Math.min(...tempNodes.map(n => n.count)) : 1;

    const nodesList = tempNodes.map(node => {
        let radius = 12;
        if (maxNodeCount !== minNodeCount) {
            radius = 6 + ((node.count - minNodeCount) / (maxNodeCount - minNodeCount)) * 18;
        }
        node.radius = radius;
        return node;
    });

    const nodeIds = new Set(nodesList.map(n => n.id));
    const edgesList = topEdges
        .filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
        .map(e => {
            const srcNode = nodesList.find(n => n.id === e.sourceId);
            const tgtNode = nodesList.find(n => n.id === e.targetId);
            return { source: srcNode, target: tgtNode, weight: e.weight };
        });

    for (let iter = 0; iter < 15; iter++) {
        // Fisher-Yates shuffle for uniform distribution
        for (let si = nodesList.length - 1; si > 0; si--) {
            const sj = Math.floor(Math.random() * (si + 1));
            [nodesList[si], nodesList[sj]] = [nodesList[sj], nodesList[si]];
        }
        nodesList.forEach(node => {
            const neighborLabels = {};
            edgesList.forEach(edge => {
                if (edge.source.id === node.id) {
                    neighborLabels[edge.target.community] = (neighborLabels[edge.target.community] || 0) + edge.weight;
                } else if (edge.target.id === node.id) {
                    neighborLabels[edge.source.community] = (neighborLabels[edge.source.community] || 0) + edge.weight;
                }
            });
            let maxLabel = node.community;
            let maxWeight = 0;
            Object.entries(neighborLabels).forEach(([lbl, wt]) => {
                if (wt > maxWeight) {
                    maxWeight = wt;
                    maxLabel = lbl;
                }
            });
            node.community = maxLabel;
        });
    }

    const communityCounts = {};
    nodesList.forEach(node => {
        communityCounts[node.community] = (communityCounts[node.community] || 0) + 1;
    });

    const sortedCommunities = Object.keys(communityCounts).sort((a, b) => communityCounts[b] - communityCounts[a]);
    
    nodesList.forEach(node => {
        const commIndex = sortedCommunities.indexOf(node.community);
        node.communityIndex = commIndex >= 0 ? commIndex : 0;
        node.communityLabel = `グループ ${String.fromCharCode(65 + (node.communityIndex % 26))}`;
    });

    networkNodes = nodesList;
    networkEdges = edgesList;

    // --- PCA ANALYSIS & K-MEANS CLUSTERING ---
    const pcaWords = filteredList.map(w => w.text);
    if (pcaWords.length > 0 && uniqueWordsPerLine.length > 0) {
        const V = pcaWords.length;
        const M = uniqueWordsPerLine.length;
        
        const X = [];
        for (let i = 0; i < V; i++) {
            const word = pcaWords[i];
            X[i] = new Float64Array(M);
            for (let j = 0; j < M; j++) {
                X[i][j] = uniqueWordsPerLine[j].has(word) ? 1.0 : 0.0;
            }
        }
        
        const rowMeans = new Float64Array(V);
        for (let i = 0; i < V; i++) {
            let sum = 0;
            for (let j = 0; j < M; j++) sum += X[i][j];
            rowMeans[i] = sum / M;
            for (let j = 0; j < M; j++) X[i][j] -= rowMeans[i];
        }
        
        const cov = Array.from({ length: V }, () => new Float64Array(V));
        for (let i = 0; i < V; i++) {
            for (let j = 0; j < V; j++) {
                let sum = 0;
                for (let k = 0; k < M; k++) {
                    sum += X[i][k] * X[j][k];
                }
                cov[i][j] = sum / (M > 1 ? M - 1 : 1);
            }
        }
        
        // Compute trace of covariance matrix = total variance (used for explained variance ratio)
        let traceOfCov = 0;
        for (let i = 0; i < V; i++) traceOfCov += cov[i][i];

        function powerIteration(A, maxIter = 200) {
            const n = A.length;
            // Use deterministic all-ones initial vector instead of random,
            // so PCA results are reproducible for the same dataset.
            let b = new Float64Array(n).fill(1.0);
            
            let norm = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0)) || 1;
            for (let i = 0; i < n; i++) b[i] /= norm;
            
            for (let iter = 0; iter < maxIter; iter++) {
                const nextB = new Float64Array(n);
                for (let i = 0; i < n; i++) {
                    let sum = 0;
                    for (let j = 0; j < n; j++) {
                        sum += A[i][j] * b[j];
                    }
                    nextB[i] = sum;
                }
                
                const nextNorm = Math.sqrt(nextB.reduce((sum, val) => sum + val * val, 0)) || 1;
                
                let diff = 0;
                for (let i = 0; i < n; i++) {
                    const val = nextB[i] / nextNorm;
                    diff += Math.abs(val - b[i]);
                    b[i] = val;
                }
                
                if (diff < 1e-7) break;
            }
            
            let eigenvalue = 0;
            for (let i = 0; i < n; i++) {
                let sum = 0;
                for (let j = 0; j < n; j++) {
                    sum += A[i][j] * b[j];
                }
                eigenvalue += b[i] * sum;
            }
            
            return { eigenvector: b, eigenvalue: eigenvalue };
        }
        
        const pc1Result = powerIteration(cov);
        const v1 = pc1Result.eigenvector;
        const l1 = Math.max(0, pc1Result.eigenvalue);
        
        const cov2 = Array.from({ length: V }, () => new Float64Array(V));
        for (let i = 0; i < V; i++) {
            for (let j = 0; j < V; j++) {
                cov2[i][j] = cov[i][j] - l1 * v1[i] * v1[j];
            }
        }
        
        const pc2Result = powerIteration(cov2);
        const v2 = pc2Result.eigenvector;
        const l2 = Math.max(0, pc2Result.eigenvalue);

        // Compute and store explained variance ratios for display on PCA axis labels
        pcaExplainedVar1 = traceOfCov > 0 ? (l1 / traceOfCov * 100).toFixed(1) : '--';
        pcaExplainedVar2 = traceOfCov > 0 ? (l2 / traceOfCov * 100).toFixed(1) : '--';
        
        const rawPoints = [];
        for (let i = 0; i < V; i++) {
            const word = pcaWords[i];
            rawPoints.push({
                word: word,
                x: v1[i] * Math.sqrt(l1),
                y: v2[i] * Math.sqrt(l2),
                count: counts[word] || 1
            });
        }
        
        const k = parseInt(clusterCount?.value) || 3;
        const assignments = runKMeans(rawPoints, k);
        
        pcaPoints = rawPoints.map((pt, i) => {
            pt.cluster = assignments[i];
            return pt;
        });
    } else {
        pcaPoints = [];
    }

    // --- LDA TOPIC MODELING & AUTOMATIC TOPIC NUMBER SELECTION ---
    runLDAAnalysis(lineWordsList, filteredList.map(w => w.text));

    resizeCanvas();
    updateWordCloud();
}

// LDA Topic Modeling with Automatic Optimal K Selection (Ultra-Optimized)
function runLDAAnalysis(lineWordsList, allowedWordsList) {
    if (!allowedWordsList || allowedWordsList.length === 0 || !lineWordsList || lineWordsList.length === 0) {
        currentLdaResult = null;
        return;
    }

    // Limit LDA processing vocabulary to top 100 words for sub-10ms performance on large datasets
    const vocab = allowedWordsList.slice(0, 100);
    const vocabSet = new Set(vocab);
    const vocabIndexMap = new Map();
    vocab.forEach((word, idx) => vocabIndexMap.set(word, idx));

    const V = vocab.length;
    
    // Super fast document token indexing (no duplicate tokenization!)
    const docTokens = [];
    lineWordsList.forEach(wordsInLine => {
        const docWords = [];
        wordsInLine.forEach(word => {
            if (vocabSet.has(word)) {
                docWords.push(vocabIndexMap.get(word));
            }
        });
        if (docWords.length > 0) {
            docTokens.push(docWords);
        }
    });

    if (docTokens.length === 0) {
        currentLdaResult = null;
        return;
    }

    const D = docTokens.length;

    // Check if user manually specified topic count
    const modeRadio = document.querySelector('input[name="lda-topic-mode"]:checked');
    const isManualK = modeRadio && modeRadio.value === 'manual';
    const ldaTopicCountEl = document.getElementById('lda-topic-count');
    const manualK = ldaTopicCountEl ? parseInt(ldaTopicCountEl.value) : 3;

    let bestK;
    if (isManualK && manualK >= 2 && manualK <= 10) {
        // Use the manually specified K directly — skip perplexity evaluation
        bestK = Math.min(manualK, Math.min(D, V));
    } else {
        // Evaluate Candidate Topic Numbers K in [2..6]
        const candidateK = [2, 3, 4, 5, 6].filter(k => k <= Math.min(D, V));
        if (candidateK.length === 0) candidateK.push(2);

        bestK = 3;
        let minPerplexity = Infinity;

    candidateK.forEach(K => {
        const alpha = 50 / K;
        const beta = 0.1;

        const n_dk = Array.from({ length: D }, () => new Int32Array(K));
        const n_kw = Array.from({ length: K }, () => new Int32Array(V));
        const n_k = new Int32Array(K);
        const z_di = docTokens.map(doc => new Int32Array(doc.length));

        // Initialization
        docTokens.forEach((doc, d) => {
            doc.forEach((w, i) => {
                const k = Math.floor(Math.random() * K);
                z_di[d][i] = k;
                n_dk[d][k]++;
                n_kw[k][w]++;
                n_k[k]++;
            });
        });

        // Fast Gibbs Sampling (15 iterations)
        for (let iter = 0; iter < 15; iter++) {
            docTokens.forEach((doc, d) => {
                doc.forEach((w, i) => {
                    let oldK = z_di[d][i];
                    n_dk[d][oldK]--;
                    n_kw[oldK][w]--;
                    n_k[oldK]--;

                    const probs = new Float64Array(K);
                    let sumP = 0;
                    for (let k = 0; k < K; k++) {
                        const p = (n_dk[d][k] + alpha) * (n_kw[k][w] + beta) / (n_k[k] + V * beta);
                        probs[k] = p;
                        sumP += p;
                    }

                    let r = Math.random() * sumP;
                    let newK = 0;
                    for (let k = 0; k < K; k++) {
                        r -= probs[k];
                        if (r <= 0) {
                            newK = k;
                            break;
                        }
                    }

                    z_di[d][i] = newK;
                    n_dk[d][newK]++;
                    n_kw[newK][w]++;
                    n_k[newK]++;
                });
            });
        }

        // Evaluate Log-Likelihood / Perplexity
        let logP = 0;
        let totalWords = 0;
        docTokens.forEach((doc, d) => {
            const docLen = doc.length;
            totalWords += docLen;
            doc.forEach(w => {
                let pW = 0;
                for (let k = 0; k < K; k++) {
                    const pTheta = (n_dk[d][k] + alpha) / (docLen + K * alpha);
                    const pPhi = (n_kw[k][w] + beta) / (n_k[k] + V * beta);
                    pW += pTheta * pPhi;
                }
                logP += Math.log(pW || 1e-10);
            });
        });

        const perplexity = Math.exp(-logP / (totalWords || 1));
        if (perplexity < minPerplexity) {
                minPerplexity = perplexity;
                bestK = K;
            }
        });

        if (D >= 12 && V >= 15 && bestK < 3) bestK = 3;
    } // end of auto K selection

    // --- Final Sampling for Best K ---
    const K = bestK;
    const alpha = 50 / K;
    const beta = 0.1;

    const n_dk = Array.from({ length: D }, () => new Int32Array(K));
    const n_kw = Array.from({ length: K }, () => new Int32Array(V));
    const n_k = new Int32Array(K);
    const z_di = docTokens.map(doc => new Int32Array(doc.length));

    docTokens.forEach((doc, d) => {
        doc.forEach((w, i) => {
            const k = Math.floor(Math.random() * K);
            z_di[d][i] = k;
            n_dk[d][k]++;
            n_kw[k][w]++;
            n_k[k]++;
        });
    });

    for (let iter = 0; iter < 50; iter++) {
        docTokens.forEach((doc, d) => {
            doc.forEach((w, i) => {
                let oldK = z_di[d][i];
                n_dk[d][oldK]--;
                n_kw[oldK][w]--;
                n_k[oldK]--;

                const probs = new Float64Array(K);
                let sumP = 0;
                for (let k = 0; k < K; k++) {
                    const p = (n_dk[d][k] + alpha) * (n_kw[k][w] + beta) / (n_k[k] + V * beta);
                    probs[k] = p;
                    sumP += p;
                }

                let r = Math.random() * sumP;
                let newK = 0;
                for (let k = 0; k < K; k++) {
                    r -= probs[k];
                    if (r <= 0) {
                        newK = k;
                        break;
                    }
                }

                z_di[d][i] = newK;
                n_dk[d][newK]++;
                n_kw[newK][w]++;
                n_k[newK]++;
            });
        });
    }

    const lightPalette = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
    const darkPalette  = ['#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];

    // Overall topic proportions
    let totalAllWords = 0;
    for (let k = 0; k < K; k++) totalAllWords += n_k[k];

    const topicsData = [];
    for (let k = 0; k < K; k++) {
        const topicLetter = String.fromCharCode(65 + (k % 26));
        const share = totalAllWords > 0 ? (n_k[k] / totalAllWords) : (1 / K);
        
        // Find top 10 words for topic k
        const wordProbs = [];
        vocab.forEach((word, wIdx) => {
            const count = n_kw[k][wIdx];
            const prob = (count + beta) / (n_k[k] + V * beta);
            if (count > 0) {
                wordProbs.push({ word, count, prob });
            }
        });

        wordProbs.sort((a, b) => b.prob - a.prob);
        const topWords = wordProbs.slice(0, 10);

        topicsData.push({
            topicIndex: k,
            label: `トピック ${topicLetter}`,
            share: share,
            totalWords: n_k[k],
            lightColor: lightPalette[k % lightPalette.length],
            darkColor: darkPalette[k % darkPalette.length],
            topWords: topWords
        });
    }

    const wordTopics = {};
    vocab.forEach((word, wIdx) => {
        let maxTopic = 0;
        let maxCount = -1;
        let totalW = 0;

        for (let k = 0; k < K; k++) {
            const cnt = n_kw[k][wIdx];
            totalW += cnt;
            if (cnt > maxCount) {
                maxCount = cnt;
                maxTopic = k;
            }
        }

        const topicDist = [];
        for (let k = 0; k < K; k++) {
            const cnt = n_kw[k][wIdx];
            const p = totalW > 0 ? (cnt / totalW) : (1 / K);
            topicDist.push({
                topicIndex: k,
                label: `トピック ${String.fromCharCode(65 + (k % 26))}`,
                prob: p,
                lightColor: lightPalette[k % lightPalette.length],
                darkColor: darkPalette[k % darkPalette.length]
            });
        }
        topicDist.sort((a, b) => b.prob - a.prob);

        const prob = totalW > 0 ? (maxCount / totalW) : (1 / K);
        const topicLetter = String.fromCharCode(65 + (maxTopic % 26));
        wordTopics[word] = {
            topicIndex: maxTopic,
            label: `トピック ${topicLetter}`,
            prob: prob,
            topicDist: topicDist,
            lightColor: lightPalette[maxTopic % lightPalette.length],
            darkColor: darkPalette[maxTopic % darkPalette.length]
        };
    });

    currentLdaResult = {
        k: K,
        wordTopics: wordTopics,
        topicsData: topicsData,
        lightPalette: lightPalette,
        darkPalette: darkPalette
    };
}

// Render LDA Topic View (Topic Cards Grid)
function renderLDATopicView() {
    if (!ldaContainer) return;
    
    if (!currentLdaResult || !currentLdaResult.topicsData || currentLdaResult.topicsData.length === 0) {
        ldaContainer.style.display = 'block';
        ldaContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px;">データまたはトピック結果がありません。「最小出現回数」を調整してください。</div>`;
        return;
    }

    const { k, topicsData } = currentLdaResult;
    const selectedTheme = colorTheme.value;
    const isDarkTheme = selectedTheme === 'aurora-dark' || selectedTheme === 'monochrome-dark';

    let cardsHtml = topicsData.map(topic => {
        const sharePct = (topic.share * 100).toFixed(1);
        // Always use light color for the white-background report style
        const color = isDarkTheme ? topic.darkColor : topic.lightColor;

        const maxProbInTopic = topic.topWords.length > 0 ? topic.topWords[0].prob : 1;

        const wordsRows = topic.topWords.map((wItem, idx) => {
            const relBarWidth = Math.max(10, Math.min(100, Math.round((wItem.prob / maxProbInTopic) * 100)));
            const probPct = (wItem.prob * 100).toFixed(1);
            const globalCount = wordFrequencies.find(item => item.text === wItem.word)?.count || 0;

            return `
                <div class="lda-word-row" onclick="openWordTopicDetail('${wItem.word}')" title="クリックでこの単語のソフトクラスタリング割合（トピック分布）を表示">
                    <div class="lda-word-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">
                        <span style="font-size: 11px; font-weight: 700; color: #9CA3AF; width: 16px;">${idx + 1}.</span>
                        <span>${wItem.word}</span>
                        <span style="font-size: 10px; color: #6B7280; margin-left: 4px; font-weight: normal;">(${globalCount}回)</span>
                    </div>
                    <div class="lda-word-bar-container" title="トピック内での単語の出現確率（重要度）">
                        <span style="font-size: 10px; color: #6B7280; margin-right: 2px; white-space: nowrap;">重要度</span>
                        <div style="flex-grow: 1; height: 6px; background: #E5E7EB; border-radius: 3px; overflow: hidden; display: flex;">
                            <div class="lda-word-bar" style="background: ${color}; width: ${relBarWidth}%; height: 100%;"></div>
                        </div>
                        <div class="lda-word-pct" style="width: 32px; text-align: right;">${probPct}%</div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="lda-topic-card">
                <div class="lda-topic-header">
                    <div class="lda-topic-name">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                        ${topic.label}
                    </div>
                    <div class="lda-topic-badge" style="background: ${color}20; color: ${color};">
                        構成比 ${sharePct}%
                    </div>
                </div>
                <div class="lda-word-list">
                    ${wordsRows || '<div style="font-size:12px; color:#6B7280; padding:8px;">該当単語なし</div>'}
                </div>
            </div>
        `;
    }).join('');

    ldaContainer.innerHTML = `
        <div class="lda-header-card">
            <div>
                <div class="lda-header-title">🧠 潜在話題の自動分類結果 （判定トピック数: ${k} 個）</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                    Perplexity（モデル適合度）に基づき最適なトピック数を自動決定しました。単語をクリックすると、各トピックへの所属割合（ソフトクラスタリング）を確認できます。
                </div>
            </div>
        </div>
        <div class="lda-grid">
            ${cardsHtml}
        </div>
    `;
}

// Open Word Soft-Clustering Detail & KWIC Entry
function openWordTopicDetail(word) {
    if (!currentLdaResult || !currentLdaResult.wordTopics[word]) {
        const count = wordFrequencies.find(item => item.text === word)?.count || 1;
        openKWICModal(word, count);
        return;
    }
    const tInfo = currentLdaResult.wordTopics[word];
    const isDarkTheme = colorTheme.value === 'aurora-dark' || colorTheme.value === 'monochrome-dark';

    let distHtml = tInfo.topicDist.map(td => {
        const pct = (td.prob * 100).toFixed(1);
        const color = isDarkTheme ? td.darkColor : td.lightColor;
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text-primary);">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                    ${td.label}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; width: 140px;">
                    <div style="flex-grow: 1; height: 8px; border-radius: 4px; background: var(--border-color); overflow: hidden;">
                        <div style="height: 100%; width: ${pct}%; background: ${color}; font-size: 0;"></div>
                    </div>
                    <span style="font-size: 12px; font-family: monospace; color: var(--text-muted); width: 38px; text-align: right;">${pct}%</span>
                </div>
            </div>
        `;
    }).join('');

    const count = wordFrequencies.find(item => item.text === word)?.count || 1;

    const extraHeaderHtml = `
        <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--accent-blue); margin-bottom: 8px;">📊 単語「${word}」のトピック混合分布 (ソフトクラスタリング):</div>
            <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 16px;">
                ${distHtml}
            </div>
        </div>
    `;

    openKWICModal(word, count, extraHeaderHtml);
}

// Get color schemes (supports topic-lda)
function getColorScheme(theme, isDarkTheme = false) {
    if (theme === 'topic-lda' && currentLdaResult) {
        return function(itemOrIndex) {
            let word = '';
            if (typeof itemOrIndex === 'string') {
                word = itemOrIndex;
            } else if (Array.isArray(itemOrIndex)) {
                word = itemOrIndex[0];
            } else if (itemOrIndex && typeof itemOrIndex === 'object' && itemOrIndex.text) {
                word = itemOrIndex.text;
            }
            
            if (word && currentLdaResult.wordTopics[word]) {
                const topicInfo = currentLdaResult.wordTopics[word];
                return isDarkTheme ? topicInfo.darkColor : topicInfo.lightColor;
            }
            
            const palette = isDarkTheme ? currentLdaResult.darkPalette : currentLdaResult.lightPalette;
            const idx = typeof itemOrIndex === 'number' ? itemOrIndex : Math.floor(Math.random() * palette.length);
            return palette[idx % palette.length];
        };
    }

    const themes = {
        'aurora-light': ['#1D4ED8', '#6D28D9', '#BE185D', '#0F766E', '#4338CA', '#B91C1C'],
        'cool-light': ['#0891B2', '#0284C7', '#1D4ED8', '#2563EB', '#059669', '#0369A1'],
        'warm-light': ['#EA580C', '#DC2626', '#C026D3', '#DB2777', '#D97706', '#B91C1C'],
        'pastel-light': ['#DB2777', '#2563EB', '#059669', '#D97706', '#7C3AED'],
        'pure-bw': ['#000000'],
        'aurora-dark': ['#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1', '#A78BFA'],
        'monochrome-dark': ['#F3F4F6', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280']
    };
    
    const palette = themes[theme] || themes['aurora-light'];
    return function(index) {
        const idx = typeof index === 'number' ? index : Math.floor(Math.random() * palette.length);
        return palette[idx % palette.length];
    };
}

// Helper to draw the bar chart on any canvas
function drawBarChartOnCanvas(canvas, list, rankingMethod, selectedTheme, selectedFont, isDarkTheme) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (list.length === 0) return;
    
    const getValue = item => rankingMethod === 'tfidf' ? item.tfidf : item.count;
    const maxVal = Math.max(...list.map(getValue), 0.00001);
    
    const scaleFactor = canvas.width / 1024;
    
    const topMargin = 60 * scaleFactor;
    const bottomMargin = 40 * scaleFactor;
    const leftMargin = 180 * scaleFactor;
    const rightMargin = 140 * scaleFactor;
    
    const availableHeight = canvas.height - topMargin - bottomMargin;
    const rowHeight = availableHeight / list.length;
    const barHeight = Math.max(12 * scaleFactor, Math.min(24 * scaleFactor, rowHeight * 0.6));
    
    const barWidthArea = canvas.width - leftMargin - rightMargin;
    const colorGenerator = getColorScheme(selectedTheme, isDarkTheme);
    
    list.forEach((item, index) => {
        const val = getValue(item);
        const barWidth = maxVal > 0 ? (val / maxVal) * barWidthArea : 0;
        const color = colorGenerator(item.text || index);
        
        const y = topMargin + index * rowHeight;
        
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isDarkTheme ? '#F3F4F6' : '#000000';
        ctx.font = `bold ${Math.round(13 * scaleFactor)}px ${selectedFont}`;
        ctx.fillText(item.text, leftMargin - 15 * scaleFactor, y + barHeight / 2);
        
        ctx.fillStyle = color;
        drawRoundedRect(ctx, leftMargin, y, barWidth, barHeight, 4 * scaleFactor);
        ctx.fill();
        
        const valDisplay = rankingMethod === 'tfidf'
            ? `${item.count}回 (TF-IDF: ${item.tfidf.toFixed(2)})`
            : `${item.count}回`;
            
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isDarkTheme ? '#9CA3AF' : '#4B5563';
        ctx.font = `${Math.round(12 * scaleFactor)}px ${selectedFont}`;
        ctx.fillText(valDisplay, leftMargin + barWidth + 12 * scaleFactor, y + barHeight / 2);
    });
}

// Helper to get qualitative high-contrast community colors (KH Coder style)
function getNetworkNodeColor(theme, indexOrNode, isDarkTheme) {
    if (theme === 'topic-lda' && currentLdaResult) {
        let word = typeof indexOrNode === 'string' ? indexOrNode : (indexOrNode?.id || indexOrNode?.word || indexOrNode?.text || '');
        if (word && currentLdaResult.wordTopics[word]) {
            const topicInfo = currentLdaResult.wordTopics[word];
            return isDarkTheme ? topicInfo.darkColor : topicInfo.lightColor;
        }
    }

    const index = typeof indexOrNode === 'number' ? indexOrNode : (indexOrNode?.communityIndex ?? indexOrNode?.cluster ?? 0);

    if (theme === 'pure-bw') {
        // Use dark gray so nodes are visible on white background
        return '#333333';
    }
    if (theme === 'monochrome-dark') {
        const grays = ['#FFFFFF', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563'];
        return grays[index % grays.length];
    }
    
    const category20 = [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
        '#8c564b', '#e377c2', '#bcbd22', '#17becf', '#aec7e8', 
        '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94', 
        '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
    ];
    
    if (isDarkTheme) {
        const darkThemeColors = [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
            '#EC4899', '#06B6D4', '#F43F5E', '#14B8A6', '#6366F1'
        ];
        return darkThemeColors[index % darkThemeColors.length];
    }
    
    return category20[index % category20.length];
}

// Helper to draw a clean, professional legend matching KH Coder outputs
function drawNetworkLegend(ctx, canvasWidth, canvasHeight, isDarkTheme, minCount, maxCount, selectedFont) {
    const scaleFactor = canvasWidth / 1024;
    const w = 265 * scaleFactor;
    const h = 56 * scaleFactor;
    const x = canvasWidth - w - 15 * scaleFactor; // 画面右下に配置
    const y = canvasHeight - h - 15 * scaleFactor;
    
    ctx.save();
    
    // 半透明の背景でグラフの邪魔になりにくくする
    ctx.fillStyle = isDarkTheme ? 'rgba(22, 31, 48, 0.75)' : 'rgba(255, 255, 255, 0.85)';
    ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1 * scaleFactor;
    
    ctx.beginPath();
    const r = 6 * scaleFactor;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(11 * scaleFactor)}px ${selectedFont}`;
    
    // 1行目: 円の大きさ
    const row1Y = y + 18 * scaleFactor;
    ctx.fillStyle = isDarkTheme ? '#E5E7EB' : '#374151';
    ctx.fillText("円の大きさ (出現回数):", x + 12 * scaleFactor, row1Y);
    
    const rSmall = 4 * scaleFactor;
    const rLarge = 9 * scaleFactor;
    
    ctx.beginPath();
    ctx.arc(x + 145 * scaleFactor, row1Y, rSmall, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkTheme ? '#9CA3AF' : '#6B7280';
    ctx.fill();
    ctx.fillText(`${minCount}`, x + 155 * scaleFactor, row1Y);
    
    ctx.fillText("〜", x + 180 * scaleFactor, row1Y);
    
    ctx.beginPath();
    ctx.arc(x + 205 * scaleFactor, row1Y, rLarge, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkTheme ? '#9CA3AF' : '#6B7280';
    ctx.fill();
    ctx.fillText(`${maxCount}`, x + 220 * scaleFactor, row1Y);

    // 2行目: 線の太さ
    const row2Y = y + 38 * scaleFactor;
    ctx.fillStyle = isDarkTheme ? '#E5E7EB' : '#374151';
    ctx.fillText("線の太さ (共起の強さ):", x + 12 * scaleFactor, row2Y);
    
    ctx.beginPath();
    ctx.moveTo(x + 135 * scaleFactor, row2Y);
    ctx.lineTo(x + 155 * scaleFactor, row2Y);
    ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1 * scaleFactor;
    ctx.stroke();
    
    ctx.fillText("弱", x + 160 * scaleFactor, row2Y);
    ctx.fillText("〜", x + 180 * scaleFactor, row2Y);
    
    ctx.beginPath();
    ctx.moveTo(x + 195 * scaleFactor, row2Y);
    ctx.lineTo(x + 215 * scaleFactor, row2Y);
    ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 4 * scaleFactor;
    ctx.stroke();
    ctx.fillText("強", x + 220 * scaleFactor, row2Y);
    
    ctx.restore();
}

// Helper to draw the Co-occurrence Network on any canvas
function drawNetworkOnCanvas(canvas, nodes, edges, selectedTheme, selectedFont, isDarkTheme, customScale = null, showLegend = true) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (nodes.length === 0) return;

    const scaleFactor = customScale !== null ? customScale : (canvas.width / 1024);

    const weights = edges.map(e => e.weight);
    const minWeight = weights.length > 0 ? Math.min(...weights) : 0.05;
    const maxWeight = weights.length > 0 ? Math.max(...weights) : 1;

    // 1. Draw connections (Edges)
    edges.forEach(edge => {
        ctx.beginPath();
        ctx.moveTo(edge.source.x, edge.source.y);
        ctx.lineTo(edge.target.x, edge.target.y);
        
        const strokeColor = isDarkTheme ? 'rgba(255, 255, 255,' : 'rgba(0, 0, 0,';
        
        let thickness = 1.5;
        let opacity = 0.15;

        if (maxWeight > minWeight) {
            // Relative scaling
            thickness = 1 + ((edge.weight - minWeight) / (maxWeight - minWeight)) * 6.5;
            opacity = 0.15 + ((edge.weight - minWeight) / (maxWeight - minWeight)) * 0.7;
        } else {
            // Absolute scaling fallback for identical weights (0 to 1 range for Jaccard)
            thickness = 1 + (edge.weight * 6.5);
            opacity = 0.15 + (edge.weight * 0.7);
        }
        
        ctx.strokeStyle = `${strokeColor}${opacity})`;
        ctx.lineWidth = thickness * scaleFactor;
        ctx.stroke();
    });

    // 2. Draw word nodes
    nodes.forEach(node => {
        const color = getNetworkNodeColor(selectedTheme, node, isDarkTheme);
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * scaleFactor, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        
        ctx.strokeStyle = selectedTheme === 'pure-bw' 
            ? '#000000' 
            : (isDarkTheme ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.3)');
        ctx.lineWidth = (selectedTheme === 'pure-bw' ? 2 : 1.5) * scaleFactor;
        ctx.stroke();
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = `bold ${Math.round(11 * scaleFactor)}px ${selectedFont}`;
        
        const labelY = node.y - (node.radius * scaleFactor + 4 * scaleFactor);
        
        ctx.strokeStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
        ctx.lineWidth = 3.5 * scaleFactor;
        ctx.lineJoin = 'round';
        ctx.strokeText(node.id, node.x, labelY);
        
        ctx.fillStyle = isDarkTheme ? '#F3F4F6' : '#111111';
        ctx.fillText(node.id, node.x, labelY);
    });

    // 4. Draw Legend card in bottom-left corner
    if (showLegend) {
        const counts = nodes.map(n => n.count);
        const minCount = counts.length > 0 ? Math.min(...counts) : 1;
        const maxCount = counts.length > 0 ? Math.max(...counts) : 1;
        drawNetworkLegend(ctx, canvas.width, canvas.height, isDarkTheme, minCount, maxCount, selectedFont);
    }
}

// Helper to draw PCA Legend on any canvas
function drawPCALegend(ctx, canvasWidth, canvasHeight, isDarkTheme, minCount, maxCount, k, selectedTheme, selectedFont) {
    const scaleFactor = canvasWidth / 1024;
    const x = 20 * scaleFactor;
    const y = canvasHeight - 75 * scaleFactor;
    
    ctx.save();
    
    ctx.fillStyle = isDarkTheme ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.65)';
    ctx.strokeStyle = isDarkTheme ? 'rgba(15, 23, 42, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1 * scaleFactor;
    
    const w = 210 * scaleFactor;
    const h = 56 * scaleFactor;
    const r = 4 * scaleFactor;
    
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isDarkTheme ? '#9CA3AF' : '#4B5563';
    ctx.font = `bold ${Math.round(9.5 * scaleFactor)}px ${selectedFont}`;
    ctx.fillText("凡例 (PCA Legend)", x + 10 * scaleFactor, y + 6 * scaleFactor);
    
    ctx.font = `${Math.round(8.5 * scaleFactor)}px ${selectedFont}`;
    ctx.fillStyle = isDarkTheme ? '#9CA3AF' : '#4B5563';
    
    const cY = y + 24 * scaleFactor;
    ctx.fillText("円:出現回数", x + 10 * scaleFactor, cY - 4 * scaleFactor);
    
    const rSmall = 3 * scaleFactor;
    const rLarge = 7 * scaleFactor;
    
    ctx.beginPath();
    ctx.arc(x + 72 * scaleFactor, cY, rSmall, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkTheme ? '#4B5563' : '#9CA3AF';
    ctx.fill();
    ctx.fillText(`${minCount}`, x + 79 * scaleFactor, cY - 4 * scaleFactor);
    
    ctx.beginPath();
    ctx.arc(x + 104 * scaleFactor, cY, rLarge, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkTheme ? '#4B5563' : '#9CA3AF';
    ctx.fill();
    ctx.fillText(`${maxCount}回`, x + 115 * scaleFactor, cY - 4 * scaleFactor);
    
    const dY = y + 42 * scaleFactor;
    ctx.fillText("色:クラスター (C1-C8)", x + 10 * scaleFactor, dY - 4 * scaleFactor);
    
    const spacing = 10 * scaleFactor;
    for (let i = 0; i < Math.min(k, 8); i++) {
        const color = getNetworkNodeColor(selectedTheme, i, isDarkTheme);
        const dotX = x + 115 * scaleFactor + i * spacing;
        
        ctx.beginPath();
        ctx.arc(dotX, dY, 3 * scaleFactor, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }
    
    ctx.restore();
}

// Helper to draw PCA Scatter Plot on any canvas
function drawPCAOnCanvas(canvas, points, selectedTheme, selectedFont, isDarkTheme) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (points.length === 0) return;
    
    const scaleFactor = canvas.width / 1024;
    const padding = 100 * scaleFactor;
    
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs, -0.01);
    const maxX = Math.max(...xs, 0.01);
    const minY = Math.min(...ys, -0.01);
    const maxY = Math.max(...ys, 0.01);
    
    const scaleX = (x) => padding + ((x - minX) / (maxX - minX)) * (canvas.width - 2 * padding);
    const scaleY = (y) => padding + ((maxY - y) / (maxY - minY)) * (canvas.height - 2 * padding);
    
    const zeroX = scaleX(0);
    const zeroY = scaleY(0);
    
    ctx.save();
    ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1 * scaleFactor;
    
    // Grid lines
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
        const gridX = padding + (i / gridSteps) * (canvas.width - 2 * padding);
        const gridY = padding + (i / gridSteps) * (canvas.height - 2 * padding);
        
        ctx.beginPath();
        ctx.moveTo(gridX, padding);
        ctx.lineTo(gridX, canvas.height - padding);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(padding, gridY);
        ctx.lineTo(canvas.width - padding, gridY);
        ctx.stroke();
    }
    
    // Principal axes (PC1, PC2)
    ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 2 * scaleFactor;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding - 20 * scaleFactor, zeroY);
    ctx.lineTo(canvas.width - padding + 20 * scaleFactor, zeroY);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(zeroX, padding - 20 * scaleFactor);
    ctx.lineTo(zeroX, canvas.height - padding + 20 * scaleFactor);
    ctx.stroke();
    
    // Axis labels
    ctx.fillStyle = isDarkTheme ? '#9CA3AF' : '#4B5563';
    ctx.font = `bold ${Math.round(11 * scaleFactor)}px ${selectedFont}`;
    ctx.textAlign = 'right';
    const pc1Label = pcaExplainedVar1 !== '--'
        ? `第1主成分 (PC1)  寄与率 ${pcaExplainedVar1}%`
        : '第1主成分 (PC1)';
    ctx.fillText(pc1Label, canvas.width - padding + 15 * scaleFactor, zeroY + 16 * scaleFactor);
    ctx.textAlign = 'left';
    const pc2Label = pcaExplainedVar2 !== '--'
        ? `第2主成分 (PC2)  寄与率 ${pcaExplainedVar2}%`
        : '第2主成分 (PC2)';
    ctx.fillText(pc2Label, zeroX + 8 * scaleFactor, padding - 8 * scaleFactor);
    
    ctx.restore();
    
    const counts = points.map(p => p.count);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    
    const k = parseInt(clusterCount?.value) || 3;
    const clusterPoints = Array.from({ length: k }, () => []);
    points.forEach(p => {
        if (p.cluster >= 0 && p.cluster < k) {
            clusterPoints[p.cluster].push(p);
        }
    });
    
    // Draw shaded cluster background boundaries
    ctx.save();
    clusterPoints.forEach((cPts, cIdx) => {
        if (cPts.length === 0) return;
        const color = getNetworkNodeColor(selectedTheme, cIdx, isDarkTheme);
        
        const sumX = cPts.reduce((sum, p) => sum + p.x, 0);
        const sumY = cPts.reduce((sum, p) => sum + p.y, 0);
        const avgX = sumX / cPts.length;
        const avgY = sumY / cPts.length;
        
        const canvasAvgX = scaleX(avgX);
        const canvasAvgY = scaleY(avgY);
        
        let maxDist = 20 * scaleFactor;
        cPts.forEach(p => {
            const dx = scaleX(p.x) - canvasAvgX;
            const dy = scaleY(p.y) - canvasAvgY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist) maxDist = dist;
        });
        
        ctx.beginPath();
        ctx.arc(canvasAvgX, canvasAvgY, maxDist + 22 * scaleFactor, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.08;
        ctx.fill();
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 * scaleFactor;
        ctx.globalAlpha = 0.18;
        ctx.stroke();
    });
    ctx.restore();
    
    // Draw single word points and labels
    points.forEach(p => {
        const px = scaleX(p.x);
        const py = scaleY(p.y);
        
        let radius = 10;
        if (maxCount !== minCount) {
            radius = 5 + ((p.count - minCount) / (maxCount - minCount)) * 14;
        }
        
        const color = getNetworkNodeColor(selectedTheme, p.cluster, isDarkTheme);
        
        ctx.beginPath();
        ctx.arc(px, py, radius * scaleFactor, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        
        ctx.strokeStyle = selectedTheme === 'pure-bw' 
            ? '#000000' 
            : (isDarkTheme ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.3)');
        ctx.lineWidth = 1.5 * scaleFactor;
        ctx.stroke();
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = `bold ${Math.round(11 * scaleFactor)}px ${selectedFont}`;
        
        const labelY = py - (radius * scaleFactor + 4 * scaleFactor);
        
        ctx.strokeStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
        ctx.lineWidth = 3.5 * scaleFactor;
        ctx.lineJoin = 'round';
        ctx.strokeText(p.word, px, labelY);
        
        ctx.fillStyle = isDarkTheme ? '#F3F4F6' : '#111111';
        ctx.fillText(p.word, px, labelY);
    });

    drawPCALegend(ctx, canvas.width, canvas.height, isDarkTheme, minCount, maxCount, k, selectedTheme, selectedFont);
}

// 5. Draw Word Cloud, Canvas Bar Chart, Co-occurrence Network, or PCA Scatter Plot
function updateWordCloud() {
    if (typeof tooltip !== 'undefined' && tooltip) {
        tooltip.style.display = 'none';
    }

    if (networkAnimationFrameId) {
        cancelAnimationFrame(networkAnimationFrameId);
        networkAnimationFrameId = null;
    }

    if (wordFrequencies.length === 0) {
        emptyState.style.display = 'flex';
        downloadBtn.disabled = true;
        exportWordsCsvBtn.disabled = true;
        exportPairsCsvBtn.disabled = true;
        if (relayoutBtn) relayoutBtn.disabled = true;
        if (sidebarRelayoutBtn) sidebarRelayoutBtn.disabled = true;
        return;
    }

    emptyState.style.display = 'none';
    downloadBtn.disabled = false;
    exportWordsCsvBtn.disabled = false;
    exportPairsCsvBtn.disabled = false;
    if (relayoutBtn) relayoutBtn.disabled = false;
    if (sidebarRelayoutBtn) sidebarRelayoutBtn.disabled = false;

    const minCount = parseInt(minCountRange.value);
    const maxWords = parseInt(maxWordsRange.value);
    const rankingMethod = document.getElementById('ranking-method').value;
    const currentDisplayType = displayType.value;
    
    const selectedTheme = colorTheme.value;
    const isDarkTheme = selectedTheme === 'aurora-dark' || selectedTheme === 'monochrome-dark';

    cloudCanvas.style.backgroundColor = isDarkTheme ? '#0B0F19' : '#FFFFFF';
    
    const filteredList = wordFrequencies
        .filter(item => item.count >= minCount)
        .slice(0, maxWords);

    if (filteredList.length === 0) {
        const ctx = cloudCanvas.getContext('2d');
        ctx.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);
        emptyState.style.display = 'flex';
        emptyState.querySelector('h2').innerText = "条件に合う単語がありません";
        emptyState.querySelector('p').innerText = "「最小出現回数」を下げるか、より多くのデータを読み込んでください。";
        downloadBtn.disabled = true;
        exportWordsCsvBtn.disabled = true;
        exportPairsCsvBtn.disabled = true;
        if (relayoutBtn) relayoutBtn.disabled = true;
        if (sidebarRelayoutBtn) sidebarRelayoutBtn.disabled = true;
        return;
    }

    if (currentDisplayType === 'cloud') {
        cloudCanvas.style.display = 'block';
        chartContainer.style.display = 'none';
        if (ldaContainer) ldaContainer.style.display = 'none';
        
        const getValue = item => rankingMethod === 'tfidf' ? item.tfidf : item.count;
        const maxVal = getValue(filteredList[0]);
        const minVal = getValue(filteredList[filteredList.length - 1]);
        
        const list = filteredList.map(item => {
            let weight = 12;
            const val = getValue(item);
            if (maxVal !== minVal) {
                weight = 14 + Math.round(((val - minVal) / (maxVal - minVal)) * 60);
            } else {
                weight = 32;
            }
            return [item.text, weight, item.count, item.tfidf];
        });

        const selectedFont = fontSelect.value;
        const drawShape = shapeCircle.checked ? 'circle' : 'square';
        const isRotate = rotateText.checked;

        // Custom double-click check in cloud click callback
        let lastClickedWord = null;
        let lastClickedTime = 0;

        // Setup Coloring
        const cloudColorMode = document.getElementById('cloud-color-mode') ? document.getElementById('cloud-color-mode').value : 'random';
        let wordColorFunc = getColorScheme(selectedTheme, isDarkTheme);
        
        // HCA Clustering info for the UI
        let autoClusterLegend = "";

        if (cloudColorMode === 'cluster') {
            try {
                const topWordsForCluster = filteredList.map(item => item.text);
                const clusterResult = findOptimalWordClusters(topWordsForCluster, currentAnalysisCoocCounts || {}, 10);
                
                autoClusterLegend = `(シルエット法最適K: ${clusterResult.k})`;
                
                // Update or create the cluster info box
                let clusterInfoBox = methodDescription.querySelector('#cluster-info-box');
                if (!clusterInfoBox) {
                    clusterInfoBox = document.createElement('div');
                    clusterInfoBox.id = 'cluster-info-box';
                    clusterInfoBox.style.cssText = 'margin-top: 8px; padding: 6px 10px; background: rgba(59, 130, 246, 0.1); border-left: 3px solid var(--accent-blue); border-radius: 4px; font-size: 11px;';
                    methodDescription.appendChild(clusterInfoBox);
                }
                clusterInfoBox.innerHTML = `<strong>🤖 自動クラスタリング適用中</strong>: 単語間の共起距離を計算し、階層的クラスタリング(Ward法)を実施。<br>シルエット分析による最適なクラスター数は <strong>${clusterResult.k}個</strong> と判定され、色分けに反映しました。`;

                wordColorFunc = function(itemOrWord) {
                    let wordStr = '';
                    if (typeof itemOrWord === 'string') wordStr = itemOrWord;
                    else if (Array.isArray(itemOrWord)) wordStr = itemOrWord[0];
                    else if (itemOrWord && itemOrWord.text) wordStr = itemOrWord.text;
                    
                    const idx = topWordsForCluster.indexOf(wordStr);
                    if (idx !== -1) {
                        const clusterId = clusterResult.assignments[idx];
                        return getNetworkNodeColor(selectedTheme, clusterId, isDarkTheme);
                    }
                    return '#999999';
                };
            } catch (err) {
                console.error("Clustering error:", err);
                alert("自動クラスタリング中にエラーが発生しました: " + err.message);
                wordColorFunc = getColorScheme(selectedTheme, isDarkTheme);
            }
        } else {
            // Remove cluster info box if switching away from cluster mode
            if (methodDescription) {
                const clusterInfoBox = methodDescription.querySelector('#cluster-info-box');
                if (clusterInfoBox) clusterInfoBox.remove();
            }
        }

        WordCloud(cloudCanvas, {
            list: list,
            gridSize: Math.round(16 * cloudCanvas.width / 1024),
            weightFactor: 1,
            fontFamily: selectedFont,
            color: wordColorFunc,
            rotateRatio: isRotate ? 0.35 : 0,
            rotationSteps: 2,
            backgroundColor: 'transparent',
            shape: drawShape,
            ellipticity: 0.65,
            shuffle: false,
            drawOutOfBound: false,
            hover: function(item, dimension, event) {
                if (displayType.value !== 'cloud') return;
                if (!item) {
                    tooltip.style.display = 'none';
                    return;
                }
                
                const [word, , count, tfidf] = item;
                tooltip.style.display = 'block';
                tooltip.style.left = `${event.clientX - canvasContainer.getBoundingClientRect().left + 15}px`;
                tooltip.style.top = `${event.clientY - canvasContainer.getBoundingClientRect().top + 15}px`;
                
                const tfidfFormatted = tfidf.toFixed(2);
                let topicHtml = '';
                if (selectedTheme === 'topic-lda' && currentLdaResult && currentLdaResult.wordTopics[word]) {
                    const tInfo = currentLdaResult.wordTopics[word];
                    topicHtml = `<br><span style="color: var(--accent-blue); font-weight: 600;">所属トピック: ${tInfo.label} (${(tInfo.prob * 100).toFixed(0)}%)</span>`;
                }
                tooltip.innerHTML = `<strong>${word}</strong><br>出現回数: ${count}回<br>特徴度 (TF-IDF): ${tfidfFormatted}${topicHtml}<br><small style="color: var(--text-muted)">ダブルクリックで除外</small>`;
            },
            click: function(item) {
                if (displayType.value !== 'cloud') return;
                if (!item) return;
                const [word, , count] = item;
                const now = Date.now();
                if (lastClickedWord === word && now - lastClickedTime < 350) {
                    addStopWord(word);
                    lastClickedWord = null;
                    tooltip.style.display = 'none';
                } else {
                    lastClickedWord = word;
                    lastClickedTime = now;
                    setTimeout(() => {
                        if (lastClickedWord === word && Date.now() - lastClickedTime >= 300) {
                            openKWICModal(word, count);
                        }
                    }, 350);
                }
            }
        });
    } else if (currentDisplayType === 'chart') {
        cloudCanvas.style.display = 'block';
        chartContainer.style.display = 'none';
        if (ldaContainer) ldaContainer.style.display = 'none';
        
        const chartList = filteredList.slice(0, 20);
        const selectedFont = fontSelect.value;
        
        drawBarChartOnCanvas(cloudCanvas, chartList, rankingMethod, selectedTheme, selectedFont, isDarkTheme);
    } else if (currentDisplayType === 'network') {
        cloudCanvas.style.display = 'block';
        chartContainer.style.display = 'none';
        if (ldaContainer) ldaContainer.style.display = 'none';

        const selectedFont = fontSelect.value;
        
        if (isForceRelayout) {
            const cx = cloudCanvas.width / 2;
            const cy = cloudCanvas.height / 2;
            networkNodes.forEach(node => {
                node.x = cx + (Math.random() - 0.5) * 300;
                node.y = cy + (Math.random() - 0.5) * 300;
                node.vx = 0;
                node.vy = 0;
            });
            isForceRelayout = false;
        } else {
            const prevNodeMap = new Map();
            oldNetworkNodes.forEach(n => prevNodeMap.set(n.id, { x: n.x, y: n.y }));
            
            networkNodes.forEach(node => {
                if (prevNodeMap.has(node.id)) {
                    const prev = prevNodeMap.get(node.id);
                    node.x = prev.x;
                    node.y = prev.y;
                } else {
                    node.x = cloudCanvas.width / 2 + (Math.random() - 0.5) * 100;
                    node.y = cloudCanvas.height / 2 + (Math.random() - 0.5) * 100;
                }
                node.vx = 0;
                node.vy = 0;
            });
        }

        const maxTicks = 220;
        let ticks = 0;
        
        function simulationTick() {
            // 物理演算を1フレームにつき複数回進めて、見た目上の安定化を早める
            const stepsPerFrame = 4;
            
            for (let step = 0; step < stepsPerFrame; step++) {
                if (ticks >= maxTicks) break;

                const repulsion = 300;
                for (let i = 0; i < networkNodes.length; i++) {
                    const n1 = networkNodes[i];
                    for (let j = i + 1; j < networkNodes.length; j++) {
                        const n2 = networkNodes[j];
                        let dx = n2.x - n1.x;
                        let dy = n2.y - n1.y;
                        if (dx === 0 && dy === 0) {
                            dx = (Math.random() - 0.5) * 5;
                            dy = (Math.random() - 0.5) * 5;
                        }
                        // 重なり合っているときの爆発（無限大の力）を防ぐために距離の下限を設ける
                        const dist = Math.max(15, Math.sqrt(dx * dx + dy * dy));
                        
                        if (dist < 300) {
                            const force = repulsion / (dist * dist);
                            const fx = force * (dx / dist);
                            const fy = force * (dy / dist);
                            
                            n1.vx -= fx * 25;
                            n1.vy -= fy * 25;
                            n2.vx += fx * 25;
                            n2.vy += fy * 25;
                        }
                    }
                }

                const springStrength = 0.15;
                const restLength = 60;
                networkEdges.forEach(edge => {
                    let dx = edge.target.x - edge.source.x;
                    let dy = edge.target.y - edge.source.y;
                    if (dx === 0 && dy === 0) {
                        dx = (Math.random() - 0.5) * 5;
                        dy = (Math.random() - 0.5) * 5;
                    }
                    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                    
                    const force = springStrength * (dist - restLength) * (edge.weight * 2.5);
                    const fx = force * (dx / dist);
                    const fy = force * (dy / dist);
                    
                    edge.source.vx += fx;
                    edge.source.vy += fy;
                    edge.target.vx -= fx;
                    edge.target.vy -= fy;
                });

                const gravity = 0.02;
                const cx = cloudCanvas.width / 2;
                const cy = cloudCanvas.height / 2;
                networkNodes.forEach(node => {
                    const dx = cx - node.x;
                    const dy = cy - node.y;
                    node.vx += dx * gravity;
                    node.vy += dy * gravity;

                    node.x += node.vx;
                    node.y += node.vy;
                    node.vx *= 0.82;
                    node.vy *= 0.82;

                    node.x = Math.max(node.radius + 15, Math.min(cloudCanvas.width - node.radius - 15, node.x));
                    node.y = Math.max(node.radius + 15, Math.min(cloudCanvas.height - node.radius - 15, node.y));
                });
                
                ticks++;
            }

            drawNetworkOnCanvas(cloudCanvas, networkNodes, networkEdges, selectedTheme, selectedFont, isDarkTheme);
            
            if (ticks >= maxTicks) {
                cancelAnimationFrame(networkAnimationFrameId);
                networkAnimationFrameId = null;
                return;
            }
            
            networkAnimationFrameId = requestAnimationFrame(simulationTick);
        }

        simulationTick();
    } else if (currentDisplayType === 'pca') {
        cloudCanvas.style.display = 'block';
        chartContainer.style.display = 'none';
        if (ldaContainer) ldaContainer.style.display = 'none';
        
        const selectedFont = fontSelect.value;
        drawPCAOnCanvas(cloudCanvas, pcaPoints, selectedTheme, selectedFont, isDarkTheme);
    } else if (currentDisplayType === 'topic-lda') {
        cloudCanvas.style.display = 'none';
        chartContainer.style.display = 'none';
        if (ldaContainer) ldaContainer.style.display = 'block';
        renderLDATopicView();
    }

    // ① 自動コメント + ③ 次のステップ提案
    renderAnalysisSummary(currentDisplayType, filteredList);
}

// =====================================================================
// ① ② ③  分析サマリーパネル（自動コメント・警告・次のステップ）
// =====================================================================
function renderAnalysisSummary(mode, filteredList) {
    const panel = document.getElementById('analysis-summary');
    if (!panel) return;

    const lines = opinionLinesCount;
    const uniqueW = wordFrequencies.length;
    const top1 = filteredList[0];
    const top2 = filteredList[1];
    const top3 = filteredList[2];

    // ② データ量に応じた注意文
    let dataNote = '';
    if (lines < 5) {
        dataNote = `<span style="color:#EF4444;font-weight:600;">⚠️ データが${lines}件と非常に少ないため、以下の分析結果はあくまで参考値です。</span>`;
    } else if (lines < 15) {
        dataNote = `<span style="color:#F59E0B;font-weight:600;">⚠️ データが${lines}件です。30件以上あると分析の信頼性が高まります。</span>`;
    } else if (lines < 30) {
        dataNote = `<span style="color:var(--text-muted);">💡 ${lines}件のデータです。件数が増えるほど安定した結果が得られます。</span>`;
    }

    const rankingMethod = document.getElementById('ranking-method') ? document.getElementById('ranking-method').value : 'count';
    const isTfidf = rankingMethod === 'tfidf';

    let commentHtml = '';
    let nextHtml = '';

    if (mode === 'cloud') {
        // ① ワードクラウド用コメント
        if (top1) {
            if (isTfidf) {
                commentHtml = `
                    <b>📊 この結果から読み取れること：</b><br>
                    最も<b>特徴度が高い語</b>は <b>「${top1.text}」</b> です。
                    ${top2 ? `次いで「${top2.text}」` : ''}${top3 ? `、「${top3.text}」` : ''}が続きます。<br>
                    全体で <b>${uniqueW}種類</b> の語が使われており、${lines}件の回答から抽出しました。<br>
                    語の大きさは特徴度（TF-IDF）に比例します。大きい語は、一般的な文章ではあまり使われないが、<b>この回答集には特有に登場する重要なキーワード</b>です。
                    <br><span style="color:var(--text-muted);">💡 ヒント：「頻出度順」に戻すと、単純に一番多く出現した語が大きく表示されます。</span>`;
            } else {
                commentHtml = `
                    <b>📊 この結果から読み取れること：</b><br>
                    最も多く出現した語は <b>「${top1.text}」（${top1.count}回）</b> です。
                    ${top2 ? `次いで「${top2.text}」（${top2.count}回）` : ''}${top3 ? `、「${top3.text}」（${top3.count}回）` : ''}が続きます。<br>
                    全体で <b>${uniqueW}種類</b> の語が使われており、${lines}件の回答から抽出しました。<br>
                    語の大きさは出現回数に比例します。大きい語が回答全体のキーワードです。
                    ${filteredList.length > 10 ? `<br><span style="color:var(--text-muted);">💡 ヒント：「特徴度(TF-IDF)順」に切り替えると、この回答集に特有の語が大きく表示されます。</span>` : ''}`;
            }
        }
        // ③ 次のステップ
        nextHtml = `
            <b>👉 次のステップ：</b>
            全体のキーワードが把握できたら、
            <span style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('display-type').value='chart';document.getElementById('display-type').dispatchEvent(new Event('change'));">横棒グラフ</span>
            で頻出語を数値で確認するか、
            <span style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('display-type').value='network';document.getElementById('display-type').dispatchEvent(new Event('change'));">共起ネットワーク</span>
            で語の関係・テーマを探ってみましょう。`;

    } else if (mode === 'chart') {
        // ① 棒グラフ用コメント
        if (top1) {
            if (isTfidf) {
                commentHtml = `
                    <b>📊 この結果から読み取れること：</b><br>
                    最も<b>特徴度が高い語</b>は <b>「${top1.text}」</b> です。
                    上位語を見ることで、単なる頻出語ではなく<b>この回答集ならではの特徴的なテーマ</b>が分かります。<br>
                    <span style="color:var(--text-muted);">💡 「頻出度順」に戻すと、単純に出現回数が多い順のランキングになります。</span>`;
            } else {
                commentHtml = `
                    <b>📊 この結果から読み取れること：</b><br>
                    最頻出語は <b>「${top1.text}」（${top1.count}回）</b> です。
                    上位語を見ることで、回答者の関心が集中しているテーマが分かります。<br>
                    <span style="color:var(--text-muted);">💡 「特徴度(TF-IDF)順」に切り替えると、単なる高頻度語ではなく<b>この回答集ならではの特徴語</b>が上位に来ます。他のデータと比較したいときに有効です。</span>`;
            }
        }
        // ③ 次のステップ
        nextHtml = `
            <b>👉 次のステップ：</b>
            「どの語が一緒に使われているか」を見るには
            <span style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('display-type').value='network';document.getElementById('display-type').dispatchEvent(new Event('change'));">共起ネットワーク</span>
            が有効です。語の<b>関係・文脈・テーマ</b>が浮かび上がります。`;

    } else if (mode === 'network') {
        // ① 共起ネットワーク用コメント
        const nodeCount = networkNodes.length;
        const edgeCount = networkEdges.length;
        const communities = new Set(networkNodes.map(n => n.community)).size;
        commentHtml = `
            <b>📊 この結果から読み取れること：</b><br>
            <b>${nodeCount}語・${edgeCount}本</b>の関係線が描かれています。
            色の異なるグループが <b>${communities}つ</b> 検出されました（自動コミュニティ分割）。<br>
            同じ色の語は同じ回答の中でよく一緒に使われており、<b>1つのテーマ・話題</b>を形成している可能性があります。<br>
            <span style="color:var(--text-muted);">💡 「最小出現回数」を上げると主要な語だけが残り、テーマがより明確になります。語をクリックするとKWIC（用例）を確認できます。</span>`;
        // ③ 次のステップ
        nextHtml = `
            <b>👉 次のステップ：</b>
            グループのテーマを確認したら、
            <span style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('display-type').value='topic-lda';document.getElementById('display-type').dispatchEvent(new Event('change'));">トピック分析(LDA)</span>
            で、各回答がどのテーマに属するか統計的に確認できます。`;

    } else if (mode === 'pca') {
        // ① PCA用コメント
        const k = parseInt(clusterCount?.value) || 3;
        commentHtml = `
            <b>📊 この結果から読み取れること：</b><br>
            近くに配置された語ほど<b>似た文脈で使われる語</b>です。
            ${k}色のグループに自動分類されています。<br>
            横軸(PC1)・縦軸(PC2)はそれぞれ回答全体の傾向をまとめた「主な方向性」を表します
            （寄与率が低くても、テキスト分析では正常です）。<br>
            <span style="color:var(--text-muted);">💡 点が離れているほど、他と違う文脈で使われる語です。共起ネットワークと合わせて見ると理解が深まります。</span>`;
        nextHtml = `
            <b>👉 次のステップ：</b>
            <span style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('display-type').value='topic-lda';document.getElementById('display-type').dispatchEvent(new Event('change'));">トピック分析(LDA)</span>
            で、文書単位のテーマ分布を確認できます。`;

    } else if (mode === 'topic-lda') {
        // ① LDA用コメント
        if (currentLdaResult) {
            const k = currentLdaResult.topics ? currentLdaResult.topics.length : '?';
            const modeRadio = document.querySelector('input[name="lda-topic-mode"]:checked');
            const isManual = modeRadio && modeRadio.value === 'manual';
            commentHtml = `
                <b>📊 この結果から読み取れること：</b><br>
                ${lines}件の回答から <b>${k}つのトピック（潜在的テーマ）</b> が抽出されました
                （${isManual ? '手動指定' : 'パープレキシティによる自動選択'}）。<br>
                各カードに表示された上位語がそのトピックを特徴づける語です。<b>代表語を見てテーマに名前をつけてみましょう。</b><br>
                <span style="color:var(--text-muted);">⚠️ LDAは確率的モデルのため、実行のたびに結果が若干変わることがあります。傾向の把握に活用してください。<br>
                💡 トピック数を変えたい場合は「表示形式」の下の「トピック数(LDA)」設定から手動指定できます。</span>`;
        }
        nextHtml = `
            <b>👉 各トピックの語をクリック</b>するとKWIC（文中の使われ方）を確認できます。
            共起ネットワークで見たグループと照らし合わせると、テーマの解釈が深まります。`;
    }

    // パネルを組み立てて表示（折りたたみバー）
    const bar = document.getElementById('analysis-summary-bar');
    const toggle = document.getElementById('analysis-summary-toggle');
    const parts = [dataNote, commentHtml, nextHtml].filter(p => p);
    if (parts.length === 0 || !bar) {
        if (bar) bar.style.display = 'none';
        return;
    }

    panel.innerHTML = parts.map((p, i) =>
        `<div style="${i < parts.length - 1 ? 'margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border-color);' : ''}">${p}</div>`
    ).join('');

    // データ警告があればバッジをトグルボタンに付ける
    let badgeHtml = '';
    if (lines < 5) {
        badgeHtml = `<span style="margin-left:6px;background:#EF4444;color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;">⚠️ データ不足</span>`;
    } else if (lines < 15) {
        badgeHtml = `<span style="margin-left:6px;background:#F59E0B;color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;">⚠️ データ少</span>`;
    }
    if (toggle) {
        toggle.innerHTML = `<span id="analysis-summary-arrow">▶</span><span>📊 分析サマリーを見る（読み方・次のステップ）</span>${badgeHtml}`;
    }

    bar.style.display = 'block';
    // 内容はデフォルト非表示のまま（折りたたみ状態を維持）
    // ※警告がある場合は自動展開
    if (lines < 15 && panel.style.display === 'none') {
        panel.style.display = 'block';
        const arrow = document.getElementById('analysis-summary-arrow');
        if (arrow) arrow.textContent = '▼';
    }
}

function toggleAnalysisSummary() {
    const panel = document.getElementById('analysis-summary');
    const arrow = document.getElementById('analysis-summary-arrow');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
    
    // パネル開閉によってキャンバスの領域が変わるため、リサイズを発火して再描画
    if (typeof rawTextData !== 'undefined' && rawTextData) {
        // setTimeoutで少し遅らせてDOM更新後にリサイズを確実に処理
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    }
}

// 6. Download Word Cloud, Bar Chart, Network Diagram, or PCA Scatter Plot as Image
downloadBtn.addEventListener('click', async () => {
    try {
        const sizes = {
            small: { w: 800, h: 600 },
            medium: { w: 1200, h: 900 },
            large: { w: 1920, h: 1080 }
        };
        const targetSize = sizes[downloadSize.value] || sizes.medium;
        
        const selectedTheme = colorTheme.value;
        const isDarkTheme = selectedTheme === 'aurora-dark' || selectedTheme === 'monochrome-dark';
        const rankingMethod = document.getElementById('ranking-method').value;
        const currentMode = displayType.value;
        
        let defaultFilename = 'wordcloud.png';
        if (currentMode === 'chart') defaultFilename = 'barchart.png';
        else if (currentMode === 'network') defaultFilename = 'network_diagram.png';
        else if (currentMode === 'pca') defaultFilename = 'pca_scatter.png';
        else if (currentMode === 'topic-lda') defaultFilename = 'topic_lda.png';

        let fileHandle = null;
        if (window.showSaveFilePicker) {
            try {
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: defaultFilename,
                    types: [{ description: 'PNG Image', accept: {'image/png': ['.png']} }]
                });
            } catch (err) {
                if (err.name === 'AbortError') {
                    return;
                }
                console.error("SavePicker error:", err);
                // Continue without fileHandle to use the fallback download method
            }
        }
        
        const saveImageFile = async (dataUrl, filename) => {
            if (fileHandle) {
                try {
                    const response = await fetch(dataUrl);
                    const blob = await response.blob();
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch(e) {
                    console.error("Write error:", e);
                }
            } else {
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataUrl;
                link.click();
            }
        };

        const minCount = parseInt(minCountRange.value);
        const maxWords = parseInt(maxWordsRange.value);
        const filteredList = wordFrequencies
            .filter(item => item.count >= minCount)
            .slice(0, maxWords);

        if (filteredList.length === 0) return;

        if (currentMode === 'cloud') {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetSize.w;
            exportCanvas.height = targetSize.h;
            
            const ctx = exportCanvas.getContext('2d');
            ctx.fillStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
            ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            
            const originalText = downloadBtn.innerHTML;
            downloadBtn.disabled = true;
            downloadBtn.innerText = "書き出し中...";
            
            const exportTimeout = setTimeout(() => {
                downloadBtn.disabled = false;
                downloadBtn.innerText = '📷 PNG保存';
            }, 8000);
            
            const selectedFont = fontSelect.value;
            const drawShape = shapeCircle.checked ? 'circle' : 'square';
            const isRotate = rotateText.checked;
            
            const scaleFactor = targetSize.w / cloudCanvas.width;
            const getValue = item => rankingMethod === 'tfidf' ? item.tfidf : item.count;
            const maxVal = getValue(filteredList[0]);
            const minVal = getValue(filteredList[filteredList.length - 1]);
            
            const list = filteredList.map(item => {
                let weight = 12;
                const val = getValue(item);
                if (maxVal !== minVal) {
                    weight = 14 + Math.round(((val - minVal) / (maxVal - minVal)) * 60);
                } else {
                    weight = 32;
                }
                return [item.text, weight * scaleFactor, item.count, item.tfidf];
            });

            const cloudColorMode = document.getElementById('cloud-color-mode') ? document.getElementById('cloud-color-mode').value : 'random';
            let wordColorFunc = getColorScheme(selectedTheme, isDarkTheme);
            
            if (cloudColorMode === 'cluster') {
                const topWordsForCluster = filteredList.map(item => item.text);
                try {
                    const clusterResult = findOptimalWordClusters(topWordsForCluster, currentAnalysisCoocCounts, 10);
                    wordColorFunc = function(itemOrWord) {
                        let wordStr = '';
                        if (typeof itemOrWord === 'string') wordStr = itemOrWord;
                        else if (Array.isArray(itemOrWord)) wordStr = itemOrWord[0];
                        else if (itemOrWord && itemOrWord.text) wordStr = itemOrWord.text;
                        
                        const idx = topWordsForCluster.indexOf(wordStr);
                        if (idx !== -1) {
                            const clusterId = clusterResult.assignments[idx];
                            return getNetworkNodeColor(selectedTheme, clusterId, isDarkTheme);
                        }
                        return '#999999';
                    };
                } catch(e) {
                    console.error("Clustering error during export:", e);
                }
            }

            WordCloud(exportCanvas, {
                list: list,
                gridSize: Math.round(16 * exportCanvas.width / 1024),
                weightFactor: 1,
                fontFamily: selectedFont,
                color: wordColorFunc,
                rotateRatio: isRotate ? 0.35 : 0,
                rotationSteps: 2,
                backgroundColor: isDarkTheme ? '#0B0F19' : '#FFFFFF',
                shape: drawShape,
                ellipticity: 0.65,
                shuffle: false,
                drawOutOfBound: false
            });

            exportCanvas.addEventListener('wordcloudstop', () => {
                clearTimeout(exportTimeout);
                const image = exportCanvas.toDataURL("image/png");
                saveImageFile(image, 'wordcloud.png');
                
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = originalText;
            });
        } else if (currentMode === 'chart') {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetSize.w;
            exportCanvas.height = targetSize.h;
            
            const chartList = filteredList.slice(0, 20);
            const selectedFont = fontSelect.value;
            
            drawBarChartOnCanvas(exportCanvas, chartList, rankingMethod, selectedTheme, selectedFont, isDarkTheme);
            
            const image = exportCanvas.toDataURL("image/png");
            saveImageFile(image, 'barchart.png');
        } else if (currentMode === 'network') {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetSize.w;
            exportCanvas.height = targetSize.h;

            const scaleFactor = Math.min(targetSize.w / cloudCanvas.width, targetSize.h / cloudCanvas.height);
            
            // Calculate offsets to center the network in the rectangular export canvas
            const offsetX = (targetSize.w - (cloudCanvas.width * scaleFactor)) / 2;
            const offsetY = (targetSize.h - (cloudCanvas.height * scaleFactor)) / 2;
            
            const clonedNodes = networkNodes.map(node => {
                return {
                    id: node.id,
                    count: node.count,
                    communityIndex: node.communityIndex,
                    communityLabel: node.communityLabel,
                    x: (node.x * scaleFactor) + offsetX,
                    y: (node.y * scaleFactor) + offsetY,
                    radius: node.radius
                };
            });

            const clonedEdges = [];
            networkEdges.forEach(edge => {
                if (edge && edge.source && edge.target) {
                    const srcNode = clonedNodes.find(n => n.id === edge.source.id);
                    const tgtNode = clonedNodes.find(n => n.id === edge.target.id);
                    if (srcNode && tgtNode) {
                        clonedEdges.push({ source: srcNode, target: tgtNode, weight: edge.weight });
                    }
                }
            });

            const selectedFont = fontSelect.value;
            const customScale = (cloudCanvas.width / 1024) * scaleFactor;
            drawNetworkOnCanvas(exportCanvas, clonedNodes, clonedEdges, selectedTheme, selectedFont, isDarkTheme, customScale);

            const image = exportCanvas.toDataURL("image/png");
            saveImageFile(image, 'network_diagram.png');
        } else if (currentMode === 'pca') {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetSize.w;
            exportCanvas.height = targetSize.h;

            const selectedFont = fontSelect.value;
            drawPCAOnCanvas(exportCanvas, pcaPoints, selectedTheme, selectedFont, isDarkTheme);

            const image = exportCanvas.toDataURL("image/png");
            saveImageFile(image, 'pca_scatter.png');
        } else if (currentMode === 'topic-lda') {
            if (!ldaContainer) return;
            
            const originalText = downloadBtn.innerHTML;
            downloadBtn.disabled = true;
            downloadBtn.innerText = "書き出し中...";

            const exportLDA = () => {
                // Temporarily expand container to capture full scrolling content
                const originalHeight = ldaContainer.style.height;
                const originalOverflow = ldaContainer.style.overflowY;
                const originalPosition = ldaContainer.style.position;
                
                ldaContainer.style.height = 'auto';
                ldaContainer.style.overflowY = 'visible';
                ldaContainer.style.position = 'relative';

                html2canvas(ldaContainer, {
                    backgroundColor: isDarkTheme ? '#0B0F19' : '#FFFFFF',
                    scale: 2,
                    windowHeight: ldaContainer.scrollHeight
                }).then(canvas => {
                    // Restore original styles
                    ldaContainer.style.height = originalHeight;
                    ldaContainer.style.overflowY = originalOverflow;
                    ldaContainer.style.position = originalPosition;

                    const image = canvas.toDataURL("image/png");
                    saveImageFile(image, 'topic_lda.png');
                    
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = originalText;
                }).catch(error => {
                    // Restore original styles on error
                    ldaContainer.style.height = originalHeight;
                    ldaContainer.style.overflowY = originalOverflow;
                    ldaContainer.style.position = originalPosition;

                    console.error("html2canvas error:", error);
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = originalText;
                    alert("画像の書き出しに失敗しました。\nエラー内容: " + error.message);
                });
            };

            if (typeof html2canvas === 'undefined') {
                const script = document.createElement('script');
                script.src = "lib/html2canvas/html2canvas.min.js";
                script.onload = exportLDA;
                script.onerror = () => {
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = originalText;
                    alert("画像化ライブラリが見つかりません。\\nlib/html2canvas/html2canvas.min.js が存在するか確認してください。");
                };
                document.head.appendChild(script);
            } else {
                exportLDA();
            }
        }
    } catch (error) {
        console.error("PNG export failed:", error);
        alert("画像の書き出しに失敗しました。\nエラー内容: " + error.message);
    }
});

function triggerRelayout() {
    if (wordFrequencies.length === 0) return;
    isForceRelayout = true;
    if (displayType.value === 'pca') {
        if (rawTextData) processAndRender();
    } else {
        updateWordCloud();
    }
    isForceRelayout = false;
}

if (relayoutBtn) {
    relayoutBtn.addEventListener('click', triggerRelayout);
}
if (sidebarRelayoutBtn) {
    sidebarRelayoutBtn.addEventListener('click', triggerRelayout);
}

// Run Initialization on Load
window.addEventListener('DOMContentLoaded', () => {
    initKuromoji();
    updateClusterCountGroupVisibility();
    initCSVModalListeners();
});

// ==========================================
// KWIC (Key Word In Context) Functionality
// ==========================================

const kwicOverlay = document.getElementById('kwic-modal-overlay');
const kwicCloseBtn = document.getElementById('kwic-close-btn');
const kwicWordTitle = document.getElementById('kwic-word-title');
const kwicWordCount = document.getElementById('kwic-word-count');
const kwicTbody = document.getElementById('kwic-tbody');
const kwicLimitWarning = document.getElementById('kwic-limit-warning');
const kwicExtraHeader = document.getElementById('kwic-extra-header');

function openKWICModal(word, count, extraHeaderHtml = null) {
    if (!word) return;
    kwicWordTitle.textContent = word;
    kwicWordCount.textContent = count || "-";
    
    if (extraHeaderHtml && kwicExtraHeader) {
        kwicExtraHeader.style.display = 'block';
        kwicExtraHeader.innerHTML = extraHeaderHtml;
    } else if (kwicExtraHeader) {
        kwicExtraHeader.style.display = 'none';
        kwicExtraHeader.innerHTML = '';
    }

    kwicTbody.innerHTML = '';
    
    let matchCount = 0;
    const maxDisplay = 1000;
    
    // Variables for KWIC Mini Network
    const kwicCoocCounts = {};
    const matchingSentences = [];
    const allowedPOS = [];
    if (posNoun && posNoun.checked) allowedPOS.push('名詞');
    if (posVerb && posVerb.checked) allowedPOS.push('動詞');
    if (posAdj && posAdj.checked) allowedPOS.push('形容詞');
    if (posAdv && posAdv.checked) allowedPOS.push('副詞');
    
    for (let i = 0; i < globalAnalyzedLines.length; i++) {
        // Merge compound words just like we do in processAndRender
        const originalTokens = globalAnalyzedLines[i];
        if (!originalTokens || originalTokens.length === 0) continue;
        
        let tokens = mergeCompoundsAndSynonyms(originalTokens, customCompoundWords, customSynonymRules);
        if (mergeNounsCheckbox && mergeNounsCheckbox.checked) {
            tokens = mergeConsecutiveNouns(tokens);
        }
        
        let wordIndices = [];
        for (let j = 0; j < tokens.length; j++) {
            const token = tokens[j];
            const pos = token.pos;
            let wordStr = (pos === '動詞' || pos === '形容詞' || pos === '副詞') && token.basic_form !== '*' 
                ? token.basic_form 
                : token.surface_form;
            
            if (wordStr.trim() === word) {
                wordIndices.push(j);
            }
        }
        
        if (wordIndices.length > 0) {
            matchingSentences.push(tokens);
            // Count local co-occurrences for ego network
            const uniqueWordsInSentence = new Set();
            tokens.forEach(t => {
                const p = t.pos;
                let tStr = (p === '動詞' || p === '形容詞' || p === '副詞') && t.basic_form !== '*' ? t.basic_form : t.surface_form;
                // Exclude the target word itself, stopwords, and punctuation
                if (allowedPOS.includes(p) && tStr !== word && !customStopWords.has(tStr) && !defaultStopWordsSet.has(tStr) && !/[!-/:-@[-`{-~、。，．・]/.test(tStr)) {
                    uniqueWordsInSentence.add(tStr);
                }
            });
            uniqueWordsInSentence.forEach(w => {
                kwicCoocCounts[w] = (kwicCoocCounts[w] || 0) + 1;
            });
        }
        
        for (const wordIndex of wordIndices) {
            matchCount++;
            if (matchCount > maxDisplay) {
                kwicLimitWarning.style.display = 'inline-block';
                break;
            }
            
            let leftContext = "";
            for (let j = 0; j < wordIndex; j++) {
                leftContext += tokens[j].surface_form;
            }
            
            let rightContext = "";
            for (let j = wordIndex + 1; j < tokens.length; j++) {
                rightContext += tokens[j].surface_form;
            }
            
            const maxContextLen = 40;
            if (leftContext.length > maxContextLen) {
                leftContext = "…" + leftContext.slice(-maxContextLen);
            }
            if (rightContext.length > maxContextLen) {
                rightContext = rightContext.slice(0, maxContextLen) + "…";
            }
            
            const tr = document.createElement('tr');
            
            const tdLine = document.createElement('td');
            tdLine.className = 'kwic-line-num';
            tdLine.textContent = (i + 1).toString();
            tdLine.style.textAlign = 'center';
            
            const tdLeft = document.createElement('td');
            tdLeft.className = 'kwic-context-left';
            tdLeft.textContent = leftContext;
            tdLeft.style.textAlign = 'right';
            
            const tdWord = document.createElement('td');
            tdWord.style.textAlign = 'center';
            tdWord.style.whiteSpace = 'nowrap';
            const spanWord = document.createElement('span');
            spanWord.className = 'kwic-keyword';
            spanWord.textContent = word;
            tdWord.appendChild(spanWord);
            
            const tdRight = document.createElement('td');
            tdRight.className = 'kwic-context-right';
            tdRight.textContent = rightContext;
            tdRight.style.textAlign = 'left';
            
            tr.appendChild(tdLine);
            tr.appendChild(tdLeft);
            tr.appendChild(tdWord);
            tr.appendChild(tdRight);
            
            kwicTbody.appendChild(tr);
        }
        
        if (matchCount > maxDisplay) {
            break;
        }
    }
    
    if (matchCount <= maxDisplay) {
        kwicLimitWarning.style.display = 'none';
    } else {
        kwicLimitWarning.style.display = 'inline-block';
    }
    
    // BUILD MINI NETWORK
    if (kwicNetworkAnimationFrameId) {
        cancelAnimationFrame(kwicNetworkAnimationFrameId);
        kwicNetworkAnimationFrameId = null;
    }
    
    const kwicNetworkCanvas = document.getElementById('kwic-network-canvas');
    if (kwicNetworkCanvas && matchingSentences.length > 0) {
        // Find top co-occurring words (e.g. top 15)
        const sortedCooc = Object.keys(kwicCoocCounts).sort((a, b) => kwicCoocCounts[b] - kwicCoocCounts[a]).slice(0, 15);
        if (sortedCooc.length > 0) {
            const canvasContainer = kwicNetworkCanvas.parentElement;
            canvasContainer.style.display = 'flex';
            kwicNetworkCanvas.width = canvasContainer.clientWidth || 520;
            kwicNetworkCanvas.height = canvasContainer.clientHeight || 250;
            
            const selectedTheme = document.getElementById('color-theme') ? document.getElementById('color-theme').value : 'default';
            const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
            const selectedFont = document.getElementById('font-family') ? document.getElementById('font-family').value : 'sans-serif';
            
            // Build Nodes
            let miniNodes = [{
                id: word,
                count: matchingSentences.length,
                community: 'Center',
                communityLabel: 'Target Word',
                x: kwicNetworkCanvas.width / 2,
                y: kwicNetworkCanvas.height / 2,
                vx: 0, vy: 0,
                radius: 18,
                isCenter: true
            }];
            
            const maxCooc = kwicCoocCounts[sortedCooc[0]];
            const minCooc = kwicCoocCounts[sortedCooc[sortedCooc.length - 1]] || 1;
            
            sortedCooc.forEach(w => {
                let r = 8;
                if (maxCooc !== minCooc) {
                    r = 6 + ((kwicCoocCounts[w] - minCooc) / (maxCooc - minCooc)) * 6;
                }
                miniNodes.push({
                    id: w,
                    count: kwicCoocCounts[w],
                    community: 'Neighbor',
                    communityLabel: 'Co-occurring Word',
                    x: kwicNetworkCanvas.width / 2 + (Math.random() - 0.5) * 100,
                    y: kwicNetworkCanvas.height / 2 + (Math.random() - 0.5) * 100,
                    vx: 0, vy: 0,
                    radius: r
                });
            });
            
            // Build Edges
            let miniEdges = [];
            const nodeIds = new Set(miniNodes.map(n => n.id));
            
            // Connect target word to others based on global cooc Counts in these sentences
            sortedCooc.forEach(w => {
                const tgtNode = miniNodes.find(n => n.id === w);
                miniEdges.push({ source: miniNodes[0], target: tgtNode, weight: kwicCoocCounts[w] / matchingSentences.length });
            });
            
            // Connect neighbors to each other if they co-occur together in matching sentences
            for (let i = 0; i < sortedCooc.length; i++) {
                for (let j = i + 1; j < sortedCooc.length; j++) {
                    const w1 = sortedCooc[i];
                    const w2 = sortedCooc[j];
                    let pairCooc = 0;
                    matchingSentences.forEach(sentenceTokens => {
                        const sWords = sentenceTokens.map(t => {
                            const p = t.pos;
                            return (p === '動詞' || p === '形容詞' || p === '副詞') && t.basic_form !== '*' ? t.basic_form : t.surface_form;
                        });
                        if (sWords.includes(w1) && sWords.includes(w2)) pairCooc++;
                    });
                    if (pairCooc > 0) {
                        const srcNode = miniNodes.find(n => n.id === w1);
                        const tgtNode = miniNodes.find(n => n.id === w2);
                        miniEdges.push({ source: srcNode, target: tgtNode, weight: pairCooc / matchingSentences.length });
                    }
                }
            }
            
            // Physics simulation loop
            let frameCount = 0;
            function renderMiniNetwork() {
                frameCount++;
                // Apply simple force-directed layout
                // Using a constant optimal distance to ensure nodes spread out
                const optimalDist = 120;
                
                // Repulsion
                for (let i = 0; i < miniNodes.length; i++) {
                    for (let j = i + 1; j < miniNodes.length; j++) {
                        const n1 = miniNodes[i];
                        const n2 = miniNodes[j];
                        const dx = n1.x - n2.x;
                        const dy = n1.y - n2.y;
                        let dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist === 0) { dist = 1; n1.x += Math.random(); n2.x -= Math.random(); }
                        
                        // Inverse-square repulsion
                        if (dist < optimalDist * 2) {
                            const force = (optimalDist * optimalDist) / dist;
                            const fx = (dx / dist) * force * 0.05;
                            const fy = (dy / dist) * force * 0.05;
                            if (!n1.isCenter) { n1.vx += fx; n1.vy += fy; }
                            if (!n2.isCenter) { n2.vx -= fx; n2.vy -= fy; }
                        }
                    }
                }
                
                // Attraction (Edges)
                miniEdges.forEach(edge => {
                    const dx = edge.source.x - edge.target.x;
                    const dy = edge.source.y - edge.target.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist === 0) dist = 1;
                    
                    // Spring-like attraction based on weight
                    const force = (dist * dist) / optimalDist;
                    const fx = (dx / dist) * force * edge.weight * 0.002;
                    const fy = (dy / dist) * force * edge.weight * 0.002;
                    
                    if (!edge.source.isCenter) { edge.source.vx -= fx; edge.source.vy -= fy; }
                    if (!edge.target.isCenter) { edge.target.vx += fx; edge.target.vy += fy; }
                });
                
                // Keep center node pinned to middle
                miniNodes[0].x = kwicNetworkCanvas.width / 2;
                miniNodes[0].y = kwicNetworkCanvas.height / 2;
                miniNodes[0].vx = 0;
                miniNodes[0].vy = 0;
                
                // Apply velocity & bounds
                miniNodes.forEach(node => {
                    if (!node.isCenter) {
                        node.x += node.vx * 0.1;
                        node.y += node.vy * 0.1;
                        // Damping
                        node.vx *= 0.85;
                        node.vy *= 0.85;
                        // Bounds (increase padding so labels aren't cut off)
                        const padX = 40;
                        const padYTop = 40;
                        const padYBottom = 20;
                        node.x = Math.max(padX, Math.min(kwicNetworkCanvas.width - padX, node.x));
                        node.y = Math.max(padYTop, Math.min(kwicNetworkCanvas.height - padYBottom, node.y));
                    }
                });
                
                drawNetworkOnCanvas(kwicNetworkCanvas, miniNodes, miniEdges, selectedTheme, selectedFont, isDarkTheme, 1.0, false);
                
                // Draw special center highlight
                const ctx = kwicNetworkCanvas.getContext('2d');
                ctx.beginPath();
                ctx.arc(miniNodes[0].x, miniNodes[0].y, miniNodes[0].radius + 4, 0, 2 * Math.PI, false);
                ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Calculate total velocity (kinetic energy) to see if we can stop
                let totalVelocity = 0;
                miniNodes.forEach(n => { totalVelocity += Math.abs(n.vx) + Math.abs(n.vy); });
                
                if (totalVelocity > 0.5 && frameCount < 300) {
                    kwicNetworkAnimationFrameId = requestAnimationFrame(renderMiniNetwork);
                } else {
                    kwicNetworkAnimationFrameId = null;
                }
            }
            
            renderMiniNetwork();
            
        } else {
            kwicNetworkCanvas.parentElement.style.display = 'none';
        }
    } else if (kwicNetworkCanvas) {
        kwicNetworkCanvas.parentElement.style.display = 'none';
    }
    
    kwicOverlay.style.display = 'flex';
}

function closeKWICModal() {
    kwicOverlay.style.display = 'none';
    if (kwicNetworkAnimationFrameId) {
        cancelAnimationFrame(kwicNetworkAnimationFrameId);
        kwicNetworkAnimationFrameId = null;
    }
}

if (kwicCloseBtn) {
    kwicCloseBtn.addEventListener('click', closeKWICModal);
}

if (kwicOverlay) {
    kwicOverlay.addEventListener('click', (e) => {
        if (e.target === kwicOverlay) {
            closeKWICModal();
        }
    });
}

// Close KWIC modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && kwicOverlay && kwicOverlay.style.display !== 'none') {
        closeKWICModal();
    }
});

// =========================================================================
// 8. HIERARCHICAL CLUSTERING & SILHOUETTE OPTIMAL K
// =========================================================================
function computeHCADistanceMatrix(words, coocCounts) {
    const n = words.length;
    const dist = Array(n).fill(0).map(() => Array(n).fill(1));
    const wordToIndex = new Map(words.map((w, i) => [w, i]));
    
    // Diagonal is 0
    for(let i = 0; i < n; i++) dist[i][i] = 0;
    
    // Fill from co-occurrences
    let maxWeight = 0;
    Object.values(coocCounts).forEach(weight => { if (weight > maxWeight) maxWeight = weight; });
    if (maxWeight === 0) maxWeight = 1;

    Object.entries(coocCounts).forEach(([key, weight]) => {
        const parts = key.split('|||');
        if (parts.length === 2) {
            const i = wordToIndex.get(parts[0]);
            const j = wordToIndex.get(parts[1]);
            if (i !== undefined && j !== undefined) {
                // Distance = 1 - (weight / maxWeight)
                const d = 1 - (weight / maxWeight);
                dist[i][j] = d;
                dist[j][i] = d;
            }
        }
    });
    return dist;
}

function runWardHCA(distMatrix) {
    const n = distMatrix.length;
    let active = Array(n).fill(true);
    let history = [];
    let sizes = Array(n).fill(1);
    
    let D = [];
    for (let i = 0; i < n; i++) D.push(distMatrix[i].slice());

    let clusterIdxCount = n;

    for (let step = 0; step < n - 1; step++) {
        let minD = Infinity;
        let c1 = -1, c2 = -1;

        for (let i = 0; i < n; i++) {
            if (!active[i]) continue;
            for (let j = i + 1; j < n; j++) {
                if (!active[j]) continue;
                if (D[i][j] < minD) {
                    minD = D[i][j];
                    c1 = i;
                    c2 = j;
                }
            }
        }
        
        if (c1 === -1 || c2 === -1) break;

        history.push({c1, c2, dist: minD});
        
        const newSize = sizes[c1] + sizes[c2];
        
        for (let k = 0; k < n; k++) {
            if (k === c1 || k === c2 || !active[k]) continue;
            const sizeK = sizes[k];
            const sumSize = newSize + sizeK;
            const w1 = (sizes[c1] + sizeK) / sumSize;
            const w2 = (sizes[c2] + sizeK) / sumSize;
            const w3 = -sizeK / sumSize;
            
            D[c1][k] = Math.max(0, w1 * D[c1][k] + w2 * D[c2][k] + w3 * D[c1][c2]);
            D[k][c1] = D[c1][k];
        }

        sizes[c1] = newSize;
        active[c2] = false;
        clusterIdxCount++;
    }
    return history;
}

function getClustersFromHistory(n, history, k) {
    if (k >= n) return Array.from({length: n}, (_, i) => i);
    if (k === 1) return Array(n).fill(0);
    
    let activeSets = Array.from({length: n}, (_, i) => [i]);
    let active = Array(n).fill(true);
    
    const numMerges = Math.min(n - k, history.length);
    for (let i = 0; i < numMerges; i++) {
        let merge = history[i];
        activeSets[merge.c1] = activeSets[merge.c1].concat(activeSets[merge.c2]);
        active[merge.c2] = false;
    }
    
    let assignment = Array(n).fill(-1);
    let currentClusterId = 0;
    for (let i = 0; i < n; i++) {
        if (active[i]) {
            for (let item of activeSets[i]) {
                assignment[item] = currentClusterId;
            }
            currentClusterId++;
        }
    }
    return assignment;
}

function computeSilhouetteScore(distMatrix, assignments, k) {
    const n = distMatrix.length;
    let clusterSizes = Array(k).fill(0);
    for (let i = 0; i < n; i++) clusterSizes[assignments[i]]++;

    let sum = 0;
    for (let i = 0; i < n; i++) {
        let c_i = assignments[i];
        if (clusterSizes[c_i] <= 1) continue;

        let distsToClusters = Array(k).fill(0);
        for (let j = 0; j < n; j++) {
            if (i === j) continue;
            distsToClusters[assignments[j]] += distMatrix[i][j];
        }

        let a_i = distsToClusters[c_i] / (clusterSizes[c_i] - 1);
        let b_i = Infinity;
        
        for (let c = 0; c < k; c++) {
            if (c === c_i || clusterSizes[c] === 0) continue;
            let meanDist = distsToClusters[c] / clusterSizes[c];
            if (meanDist < b_i) b_i = meanDist;
        }

        if (b_i !== Infinity) {
            const maxDist = Math.max(a_i, b_i);
            sum += maxDist === 0 ? 0 : (b_i - a_i) / maxDist;
        }
    }
    return sum / n;
}

function findOptimalWordClusters(words, coocCounts, maxK=10) {
    const n = words.length;
    if (n < 3) return { k: 1, assignments: Array(n).fill(0), bestScore: 0 };
    
    const distMatrix = computeHCADistanceMatrix(words, coocCounts);
    const maxTestedK = Math.min(maxK, n - 1);
    const history = runWardHCA(distMatrix);
    
    let bestK = 2;
    let bestScore = -Infinity;
    
    for (let k = 2; k <= maxTestedK; k++) {
        let assignments = getClustersFromHistory(n, history, k);
        let score = computeSilhouetteScore(distMatrix, assignments, k);
        if (score > bestScore) {
            bestScore = score;
            bestK = k;
        }
    }
    
    return {
        k: bestK,
        assignments: getClustersFromHistory(n, history, bestK),
        bestScore
    };
}
