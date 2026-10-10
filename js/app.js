// App State
let tokenizer = null;
let rawTextData = "";
let opinionLinesCount = 0;
let wordFrequencies = [];
let globalAnalyzedLines = []; // Cached token lists per line: [[token, token...], [token...]]
let currentAnalysisCounts = {}; // Cached counts mapping for CSV export
let currentAnalysisCoocCounts = {}; // Cached cooc counts mapping for CSV export
let currentAnalysisDocFreq = {};    // Cached document-frequency for correct Jaccard in CSV export
let currentAnalysisTokenDocFreq = {}; // Cached document-frequency for all tokens in N-gram collocation
let currentTokenizeTaskId = 0;

// Set for standard stop words (dynamically loaded from stopwords.txt)
let defaultStopWordsSet = new Set();
let normalizedDefaultStopWords = new Set();

// Custom Stop Words added on-screen by the user
let customStopWords = new Set();
let normalizedCustomStopWords = new Set();

function updateNormalizedStopWords() {
    normalizedDefaultStopWords = new Set(Array.from(defaultStopWordsSet).map(w => w.normalize('NFKC').toLowerCase()));
    normalizedCustomStopWords = new Set(Array.from(customStopWords).map(w => w.normalize('NFKC').toLowerCase()));
}

function isStopWord(word) {
    if (!word) return true;
    const w = word.trim();
    if (!w) return true;

    const wLower = w.toLowerCase();
    const wNorm = w.normalize('NFKC');
    const wNormLower = wNorm.toLowerCase();

    if (defaultStopWordsSet.has(w) || defaultStopWordsSet.has(wLower) ||
        customStopWords.has(w) || customStopWords.has(wLower)) {
        return true;
    }

    if (normalizedCustomStopWords.has(wNormLower) || normalizedDefaultStopWords.has(wNormLower)) {
        return true;
    }

    return false;
}

// Network Graph State
let networkNodes = [];
let oldNetworkNodes = [];
let networkEdges = [];
let networkExcludedWords = [];
let networkAnimationFrameId = null;
let kwicNetworkAnimationFrameId = null;

// PCA Scatter Plot State
let pcaPoints = [];
let rawPcaPoints = [];
let pcaExplainedVar1 = '--'; // Variance explained by PC1 (%)
let pcaExplainedVar2 = '--'; // Variance explained by PC2 (%)
let pcaOptimalK = 3;
let pcaUserK = 3;
let pcaUserManual = false;

// UMAP Scatter Plot State
let umapPoints = [];
let rawUmapPoints = [];
let umapRandomSeed = 42;
let umapOptimalK = 3;
let umapUserK = 3;
let umapUserManual = false;

// LDA Topic Model State
let currentLdaResult = null;

// Collocation (N-gram) State
let currentNgramN = 2; // 2, 3, or 4
let currentNgramTarget = 'keywords'; // 'keywords' or 'all'
let currentNgramSort = 'count'; // 'count', 'doc', 'jaccard'
let currentNgramSearch = '';
let currentNgramList = [];
let currentAnalysisTokenWordsList = [];
let currentAnalysisLineWordsList = [];

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
const collocationContainer = document.getElementById('collocation-container');
const emptyState = document.getElementById('empty-state');
const tooltip = document.getElementById('tooltip');
const downloadBtn = document.getElementById('download-btn');
const downloadSize = document.getElementById('download-size');
const downloadSizeMenu = document.getElementById('download-size-menu');
const downloadChevron = document.getElementById('download-chevron');
const downloadSizeMediumBtn = document.getElementById('download-size-medium-btn');
const downloadSizeLargeBtn = document.getElementById('download-size-large-btn');
const downloadSizeSmallBtn = document.getElementById('download-size-small-btn');
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
const networkOptionsGroup = document.getElementById('network-options-group');
const networkMinEdgeCheck = document.getElementById('network-min-edge-check');
const diagramLabelSizeGroup = document.getElementById('diagram-label-size-group');
const networkFontSizeRange = document.getElementById('network-font-size-range');
const networkFontSizeVal = document.getElementById('network-font-size-val');
const colorTheme = document.getElementById('color-theme');
const fontSelect = document.getElementById('font-select');
const shapeCircle = document.getElementById('shape-circle');
const rotateText = document.getElementById('rotate-text');
const displayType = document.getElementById('display-type');
const methodDescription = document.getElementById('method-description');
const clusterCountGroup = document.getElementById('cluster-count-group');
const clusterCount = document.getElementById('cluster-count');
const clusterAutoBadge = document.getElementById('cluster-auto-badge');
const btnClusterReset = document.getElementById('btn-cluster-reset');

// Compound Words Elements
const newCompoundWordInput = document.getElementById('new-compound-word');
const addCompoundWordBtn = document.getElementById('add-compound-word-btn');
const clearCompoundBtn = document.getElementById('clear-compound-btn');
const replaceFromInput = document.getElementById('replace-from');
const replaceToInput = document.getElementById('replace-to');
const addReplaceBtn = document.getElementById('add-replace-btn');
const clearSynonymsBtn = document.getElementById('clear-synonyms-btn');
const replaceWordsList = document.getElementById('replace-words-list');
const compoundWordsList = document.getElementById('compound-words-list');
let customCompoundWords = new Set(); // User-defined compound words
let customSynonymRules = new Map(); // User-defined synonym replacements: key -> target

// Stopwords Elements
const newStopwordInput = document.getElementById('new-stopword');
const addStopwordBtn = document.getElementById('add-stopword-btn');
const stopwordsList = document.getElementById('stopwords-list');
const resetStopwordsBtn = document.getElementById('reset-stopwords-btn');

// Rules File I/O Elements (Plan 2: Sectioned Text Format)
const rulesIoContainer = document.getElementById('rules-io-container');
const exportRulesBtn = document.getElementById('export-rules-btn');
const importRulesBtn = document.getElementById('import-rules-btn');
const rulesFileInput = document.getElementById('rules-file-input');
const downloadTemplateBtn = document.getElementById('download-template-btn');
const reloadDefaultRulesBtn = document.getElementById('reload-default-rules-btn');
const clearAllRulesBtn = document.getElementById('clear-all-rules-btn');

// Export & Relayout Action Buttons
const exportCsvDropdownBtn = document.getElementById('export-csv-dropdown-btn');
const exportCsvMenu = document.getElementById('export-csv-menu');
const exportCsvChevron = document.getElementById('export-csv-chevron');
const exportWordsCsvBtn = document.getElementById('export-words-csv-btn');
const exportPairsCsvBtn = document.getElementById('export-pairs-csv-btn');
const exportNgramCsvBtn = document.getElementById('export-ngram-csv-btn');
const exportAllCsvBtn = document.getElementById('export-all-csv-btn');
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
        updateNormalizedStopWords();
    } catch (e) {
        console.error("Failed to load settings from localStorage", e);
    }
}

async function initKuromoji() {
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (loadingText) loadingText.innerText = "日本語解析辞書と除外リストをロード中...";
    if (progressBar) progressBar.style.width = '10%';

    let isInitialized = false;

    // 15秒タイムアウト監視（万が一辞書ロードがブロックまたはハングした場合の安全装置）
    const timeoutTimer = setTimeout(() => {
        if (!isInitialized) {
            console.warn("Kuromoji dictionary load timed out.");
            if (loadingText) {
                loadingText.innerHTML = `
                    <div style="font-weight:700; margin-bottom:8px; color:#F59E0B;">⚠️ 辞書の読み込みに時間がかかっています</div>
                    <div style="font-size:12px; color:var(--text-secondary); line-height:1.6; margin-bottom:12px;">
                        ブラウザで直接ファイル（file://）を開いている場合、セキュリティ制限（CORS）により辞書が取得できないことがあります。<br>
                        VSCodeの「Live Server」やローカルWebサーバー経由で開くか、再読み込みをお試しください。
                    </div>
                    <button type="button" onclick="location.reload()" style="padding:6px 16px; font-size:12px; border-radius:6px; background:var(--accent-blue); color:#fff; border:none; cursor:pointer;">
                        再読み込みする
                    </button>
                    <button type="button" onclick="document.getElementById('loading-overlay').style.display='none'" style="margin-left:8px; padding:6px 12px; font-size:12px; border-radius:6px; background:transparent; color:var(--text-muted); border:1px solid var(--border-color); cursor:pointer;">
                        閉じる
                    </button>
                `;
            }
        }
    }, 15000);

    try {
        // Fetch custom stop words from server with cache-busting
        const cacheBuster = `?_=${Date.now()}`;
        const response = await fetch(`data/stopwords.txt${cacheBuster}`, { cache: 'no-cache' });
        if (response.ok) {
            const text = await response.text();
            const words = text.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#'));
            defaultStopWordsSet = new Set(words);
            updateNormalizedStopWords();
        } else {
            console.warn("stopwords.txt not found. Running with empty default list.");
        }
    } catch (e) {
        console.error("Error loading stopwords.txt:", e);
    }

    let defaultCustomRulesText = null;
    try {
        // Check for workspace default custom_rules.txt with cache-busting
        const cacheBuster = `?_=${Date.now()}`;
        const rulesResp = await fetch(`data/custom_rules.txt${cacheBuster}`, { cache: 'no-cache' });
        if (rulesResp.ok) {
            defaultCustomRulesText = await rulesResp.text();
        }
    } catch (e) {
        // Optional file
    }

    if (progressBar) progressBar.style.width = '50%';
    const dicPath = "lib/kuromoji/dict/";

    try {
        kuromoji.builder({ dicPath: dicPath }).build((err, _tokenizer) => {
            isInitialized = true;
            clearTimeout(timeoutTimer);

            if (err) {
                console.error("Kuromoji initialization failed:", err);
                if (loadingText) {
                    loadingText.innerHTML = `
                        <div style="color:#EF4444; font-weight:700; margin-bottom:8px;">❌ 日本語解析辞書の読み込みに失敗しました</div>
                        <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:12px;">${err.toString()}</div>
                        <div style="font-size:12px; color:var(--text-secondary); line-height:1.5; margin-bottom:12px;">
                            ※ ローカルファイル（file://）として直接開いている場合は、ブラウザの制約により辞書ファイルが取得できません。<br>
                            ローカルサーバー（Live Serverやpython -m http.serverなど）経由で開いてください。
                        </div>
                        <button type="button" onclick="location.reload()" style="padding:6px 16px; font-size:12px; border-radius:6px; background:var(--accent-blue); color:#fff; border:none; cursor:pointer;">
                            再試行
                        </button>
                    `;
                }
                if (progressBar) {
                    progressBar.style.backgroundColor = "#EF4444";
                    progressBar.style.width = '100%';
                }
                return;
            }
            
            tokenizer = _tokenizer;
            if (progressBar) progressBar.style.width = '100%';
            
            setTimeout(() => {
                if (loadingOverlay) loadingOverlay.style.display = 'none';
            }, 300);
            
            try {
                loadSettings();

                // If local storage has no custom rules and has never been explicitly cleared, initialize from data/custom_rules.txt
                const isExplicitlyCleared = localStorage.getItem('customRulesCleared') === 'true';
                const hasExistingStorage = localStorage.getItem('customCompoundWords') !== null ||
                                           localStorage.getItem('customStopWords') !== null ||
                                           localStorage.getItem('customSynonymRules') !== null;

                if (!isExplicitlyCleared && !hasExistingStorage && defaultCustomRulesText) {
                    const parsed = parseRulesText(defaultCustomRulesText);
                    if (parsed.compoundWords.size > 0 || parsed.stopWords.size > 0 || parsed.synonymRules.size > 0) {
                        customCompoundWords = parsed.compoundWords;
                        customStopWords = parsed.stopWords;
                        customSynonymRules = parsed.synonymRules;
                        saveSettings();
                    }
                }
                
                renderStopWords();
                renderCompoundWords();
                renderSynonymRules();
            } catch (settingsErr) {
                console.error("Error setting up rules:", settingsErr);
            }
        });
    } catch (buildErr) {
        clearTimeout(timeoutTimer);
        console.error("Kuromoji builder error:", buildErr);
        if (loadingText) {
            loadingText.innerHTML = `
                <div style="color:#EF4444; font-weight:700;">❌ 辞書ビルダーの初期化に失敗しました</div>
                <div style="font-size:11.5px; color:var(--text-muted);">${buildErr.toString()}</div>
            `;
        }
    }
}

function renderStopWords() {
    updateNormalizedStopWords();
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

// ========================================================
// 辞書・ルール設定ファイル入出力（セクション区切りテキスト方式）
// ========================================================
let pendingParsedRules = null;

function isSectionHeader(line) {
    line = line.trim();
    if (!line) return null;

    // Check if bracketed: [複合語], 【除外ワード】, etc.
    const bracketMatch = line.match(/^[#\s■●▼*+\-]*[\[【](.+?)[\]】]/);
    if (bracketMatch) {
        const textInside = bracketMatch[1];
        if (/(?:複合語|まとめ語|結合語|compound)/i.test(textInside)) return 'compound';
        if (/(?:除外|ストップワード|不要語|stopword)/i.test(textInside)) return 'stopword';
        if (/(?:表記ゆれ|表記揺れ|置換|同義語|類義語|統一|synonym|replace)/i.test(textInside)) return 'synonym';
        return null;
    }

    // If not bracketed, it MUST start with a header marker (#, ##, ■, ●, ▼, 1., 2., 3., etc.)
    const markerMatch = line.match(/^(?:#+|■|●|▼|\d+\.)\s*(.+)$/);
    if (markerMatch) {
        const afterMarker = markerMatch[1].trim();
        // Section headers are short (<= 20 chars) and do NOT contain rule arrows (->, →, =>)
        if (afterMarker.length <= 20 && !/(?:->|-->|=>|→|⇒)/.test(afterMarker)) {
            if (/^(?:複合語|まとめ語|結合語|compound words?)$/i.test(afterMarker) ||
                /(?:複合語|まとめ語|結合語)/.test(afterMarker)) return 'compound';
            if (/(?:除外|ストップワード|不要語|stopwords?)/i.test(afterMarker)) return 'stopword';
            if (/(?:表記ゆれ|表記揺れ|置換|同義語|類義語|synonyms?)/i.test(afterMarker) ||
                /(?:表記ゆれの統一|置換ルール)/.test(afterMarker)) return 'synonym';
        }
    }

    return null;
}

function parseRulesText(text) {
    const compoundWords = new Set();
    const stopWords = new Set();
    const synonymRules = new Map();
    const unclassifiedWords = [];
    let hasExplicitSection = false;

    if (!text) return { compoundWords, stopWords, synonymRules, unclassifiedWords, hasExplicitSection };

    // Remove BOM and normalize line endings
    text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n');
    let currentSection = null; // 'compound' | 'stopword' | 'synonym'

    for (let rawLine of lines) {
        let line = rawLine.trim();
        if (!line) continue;

        // Check if line is a section header
        const section = isSectionHeader(line);
        if (section) {
            currentSection = section;
            hasExplicitSection = true;
            continue;
        }

        // Ignore pure comment lines
        if (line.startsWith('#') || line.startsWith('//') || line.startsWith(';')) {
            continue;
        }

        // Strip inline comments if present (e.g. "word # comment")
        const inlineCommentIdx = line.search(/\s+(?:#|\/\/)/);
        if (inlineCommentIdx !== -1) {
            line = line.substring(0, inlineCommentIdx).trim();
        }
        if (!line) continue;

        if (currentSection === 'compound') {
            compoundWords.add(line);
        } else if (currentSection === 'stopword') {
            stopWords.add(line);
        } else if (currentSection === 'synonym') {
            // Find separator: ->, -->, =>, →, ⇒, tab, comma, colon
            const sepMatch = line.match(/\s*(?:->|-->|=>|→|⇒|\t|,|，|：|:)\s*/);
            if (sepMatch) {
                const fromWord = line.substring(0, sepMatch.index).trim();
                const toWord = line.substring(sepMatch.index + sepMatch[0].length).trim();
                if (fromWord && toWord) {
                    synonymRules.set(fromWord, toWord);
                }
            }
        } else {
            // No section header encountered yet
            const sepMatch = line.match(/\s*(?:->|-->|=>|→|⇒|\t)\s*/);
            if (sepMatch) {
                const fromWord = line.substring(0, sepMatch.index).trim();
                const toWord = line.substring(sepMatch.index + sepMatch[0].length).trim();
                if (fromWord && toWord) {
                    synonymRules.set(fromWord, toWord);
                }
            } else {
                unclassifiedWords.push(line);
            }
        }
    }

    return { compoundWords, stopWords, synonymRules, unclassifiedWords, hasExplicitSection };
}

function generateRulesText(compoundWordsSet, stopWordsSet, synonymRulesMap) {
    const lines = [];
    lines.push("# ========================================================");
    lines.push("# 簡易テキスト分析ツール - 辞書・ルール設定ファイル");
    lines.push("#");
    lines.push("# 【使い方】");
    lines.push("# ・このファイルはメモ帳などのテキストエディタで自由に編集できます。");
    lines.push("# ・行頭に「#」を付けるとその行はコメント（説明文）になります。");
    lines.push("# ・各セクション見出し（# [複合語] など）の下に設定したい単語を記述してください。");
    lines.push("# ========================================================");
    lines.push("");

    lines.push("# [複合語]");
    lines.push("# 形態素解析で分解されたくない単語を1行に1つずつ記述します。");
    lines.push("# （例: 「青森県社会経済白書」が分割されずに1単語として扱われます）");
    if (compoundWordsSet && compoundWordsSet.size > 0) {
        const sortedCompounds = Array.from(compoundWordsSet).sort((a, b) => a.localeCompare(b, 'ja'));
        sortedCompounds.forEach(word => lines.push(word));
    } else {
        lines.push("# （登録されている複合語はありません）");
    }
    lines.push("");

    lines.push("# [除外ワード]");
    lines.push("# 分析結果から除外したい不要語（ストップワード）を1行に1つずつ記述します。");
    if (stopWordsSet && stopWordsSet.size > 0) {
        const sortedStopWords = Array.from(stopWordsSet).sort((a, b) => a.localeCompare(b, 'ja'));
        sortedStopWords.forEach(word => lines.push(word));
    } else {
        lines.push("# （登録されている除外ワードはありません）");
    }
    lines.push("");

    lines.push("# [表記ゆれ]");
    lines.push("# 表記ゆれや同義語を統一するルールを「元の語 -> 統一後の語」の形式で記述します。");
    lines.push("# 矢印記号（-> や →）のほか、カンマ区切り（元の語,統一後の語）でも記述可能です。");
    if (synonymRulesMap && synonymRulesMap.size > 0) {
        const sortedSynonyms = Array.from(synonymRulesMap.entries()).sort((a, b) => a[0].localeCompare(b, 'ja'));
        sortedSynonyms.forEach(([from, to]) => lines.push(`${from} -> ${to}`));
    } else {
        lines.push("# （登録されている表記ゆれルールはありません）");
    }
    lines.push("");

    return lines.join("\n");
}

function exportRulesToFile() {
    const text = generateRulesText(customCompoundWords, customStopWords, customSynonymRules);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `analysis_rules_${yyyy}${mm}${dd}.txt`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadRulesTemplate() {
    const templateText = [
        "# ========================================================",
        "# 簡易テキスト分析ツール - 辞書・ルール設定ファイル（見本・ひな型）",
        "#",
        "# 【使い方】",
        "# 1. このファイルをメモ帳などのテキストエディタで開きます。",
        "# 2. 各セクション（# [複合語] など）の下に、登録したい言葉を記述します。",
        "# 3. ファイルを保存（文字コードはUTF-8またはShift-JIS推奨）し、",
        "#    ツールの「設定を読込」ボタンまたはドラッグ＆ドロップで読み込みます。",
        "#",
        "# ※ 行頭に「#」がある行はコメント（説明）として読み飛ばされます。",
        "# ========================================================",
        "",
        "# [複合語]",
        "# 形態素解析でバラバラに分割されたくない単語を1行に1つずつ記述します。",
        "# 例: 「青森県社会経済白書」が「青森 / 県 / 社会 / 経済 / 白書」に分かれず、",
        "#     1つのまとまったキーワードとして集計・可視化されます。",
        "青森県社会経済白書",
        "地域課題",
        "EBPM",
        "重回帰分析",
        "",
        "# [除外ワード]",
        "# 分析結果（ワードクラウドや頻出語ランキング等）から除外したい単語を1行に1つずつ記述します。",
        "# ※ 一般的な助詞や代名詞（これ、それ等）は標準で除外されていますので、",
        "#    アンケート特有の頻出語や挨拶文などを登録するのに便利です。",
        "こと",
        "もの",
        "ため",
        "よう",
        "よろしくお願いいたします",
        "",
        "# [表記ゆれ]",
        "# 表記ゆれや同義語を統一するルールを「元の語 -> 統一後の語」の形式で記述します。",
        "# 矢印記号（-> や →）のほか、カンマ区切り（元の語,統一後の語）でも記述できます。",
        "AI -> 人工知能",
        "PC -> パソコン",
        "イラン情勢 -> 中東情勢",
        "スマホ -> スマートフォン",
        ""
    ].join("\n");

    const blob = new Blob([templateText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "analysis_rules_template.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearAllRules() {
    const totalCount = customCompoundWords.size + customStopWords.size + customSynonymRules.size;
    if (totalCount === 0) {
        alert("現在登録されている設定はありません。");
        return;
    }

    if (confirm(`登録されているすべての設定（複合語 ${customCompoundWords.size}件、除外ワード ${customStopWords.size}件、表記ゆれ ${customSynonymRules.size}件）を消去しますか？\n\n※この操作は取り消せません。必要に応じて事前に「設定を出力」で保存してください。`)) {
        customCompoundWords.clear();
        customStopWords.clear();
        customSynonymRules.clear();
        localStorage.setItem('customRulesCleared', 'true');
        saveSettings();
        renderCompoundWords();
        renderStopWords();
        renderSynonymRules();
        if (rawTextData) {
            processAndRender();
        }
    }
}

async function reloadDefaultRules() {
    try {
        const cacheBuster = `?_=${Date.now()}`;
        const resp = await fetch(`data/custom_rules.txt${cacheBuster}`, { cache: 'no-cache' });
        if (!resp.ok) {
            alert("data/custom_rules.txt が見つかりませんでした。");
            return;
        }
        const text = await resp.text();
        openRulesImportProcess(text, 'data/custom_rules.txt');
    } catch (e) {
        alert("標準ルールの読み込み中にエラーが発生しました: " + (e.message || e));
    }
}

function applyParsedRules(parsed, mode) {
    if (mode === 'overwrite') {
        customCompoundWords = new Set(parsed.compoundWords);
        customStopWords = new Set(parsed.stopWords);
        customSynonymRules = new Map(parsed.synonymRules);
    } else { // 'merge'
        parsed.compoundWords.forEach(w => customCompoundWords.add(w));
        parsed.stopWords.forEach(w => customStopWords.add(w));
        parsed.synonymRules.forEach((v, k) => customSynonymRules.set(k, v));
    }

    localStorage.removeItem('customRulesCleared');
    saveSettings();
    renderCompoundWords();
    renderStopWords();
    renderSynonymRules();

    if (rawTextData) {
        processAndRender();
    }
}

function openRulesImportProcess(text, fileName) {
    const parsed = parseRulesText(text);
    const totalCount = parsed.compoundWords.size + parsed.stopWords.size + parsed.synonymRules.size;

    if (totalCount === 0) {
        if (parsed.unclassifiedWords && parsed.unclassifiedWords.length > 0) {
            const sampleWords = parsed.unclassifiedWords.slice(0, 5).join('、');
            const userChoice = confirm(
                `ファイル内にセクション見出し（# [複合語]、# [除外ワード]、# [表記ゆれ]）が見つかりませんでしたが、${parsed.unclassifiedWords.length} 個の単語が検出されました。\n（例: ${sampleWords}...）\n\n【OK】を押すとこれらを「除外ワード」として登録します。\n【キャンセル】を押すと処理を中止します。`
            );
            if (userChoice) {
                parsed.unclassifiedWords.forEach(w => parsed.stopWords.add(w));
                applyParsedRules(parsed, 'merge');
                alert(`除外ワードに ${parsed.unclassifiedWords.length} 件を追加しました。`);
            }
            return;
        }

        alert("ファイル内に有効な複合語、除外ワード、表記ゆれルールが見つかりませんでした。\n「書き方・見本ファイルをDL」を参考にファイルを作成してください。");
        return;
    }

    const currentTotalCount = customCompoundWords.size + customStopWords.size + customSynonymRules.size;
    if (currentTotalCount === 0) {
        applyParsedRules(parsed, 'overwrite');
        alert(
            `設定ファイルを読み込みました（${fileName || 'ファイル'}）。\n` +
            `・複合語: ${parsed.compoundWords.size} 件\n` +
            `・除外ワード: ${parsed.stopWords.size} 件\n` +
            `・表記ゆれの統一: ${parsed.synonymRules.size} 件`
        );
        return;
    }

    // Open modal to ask Merge or Overwrite
    pendingParsedRules = parsed;
    const rulesModalOverlay = document.getElementById('rules-modal-overlay');
    const modalCompoundCount = document.getElementById('modal-compound-count');
    const modalStopwordCount = document.getElementById('modal-stopword-count');
    const modalSynonymCount = document.getElementById('modal-synonym-count');

    if (modalCompoundCount) modalCompoundCount.textContent = parsed.compoundWords.size;
    if (modalStopwordCount) modalStopwordCount.textContent = parsed.stopWords.size;
    if (modalSynonymCount) modalSynonymCount.textContent = parsed.synonymRules.size;

    if (rulesModalOverlay) {
        rulesModalOverlay.style.display = 'flex';
    }
}

function importRulesFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const buffer = e.target.result;
        let text = "";
        try {
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            text = utf8Decoder.decode(buffer);
        } catch (err) {
            const sjisDecoder = new TextDecoder('shift-jis');
            text = sjisDecoder.decode(buffer);
        }
        openRulesImportProcess(text, file.name);
    };
    reader.readAsArrayBuffer(file);
}

function isRulesFileContent(text) {
    if (!text) return false;
    const headerPattern = /(?:^|\n)\s*(?:#|\/\/|■|\[|【)?\s*\[?(?:複合語|除外ワード|ストップワード|表記ゆれ|置換ルール)[\]】]?/i;
    return headerPattern.test(text.substring(0, 2000));
}

function initRulesFileListeners() {
    if (importRulesBtn && rulesFileInput) {
        importRulesBtn.addEventListener('click', () => {
            rulesFileInput.value = '';
            rulesFileInput.click();
        });

        rulesFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importRulesFromFile(file);
            }
        });
    }

    if (exportRulesBtn) {
        exportRulesBtn.addEventListener('click', exportRulesToFile);
    }

    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', downloadRulesTemplate);
    }

    if (reloadDefaultRulesBtn) {
        reloadDefaultRulesBtn.addEventListener('click', reloadDefaultRules);
    }

    if (clearAllRulesBtn) {
        clearAllRulesBtn.addEventListener('click', clearAllRules);
    }

    if (rulesIoContainer) {
        rulesIoContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            rulesIoContainer.style.borderColor = 'var(--accent-blue)';
            rulesIoContainer.style.background = 'rgba(59, 130, 246, 0.08)';
        });

        rulesIoContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            rulesIoContainer.style.borderColor = 'var(--border-color)';
            rulesIoContainer.style.background = 'rgba(255, 255, 255, 0.02)';
        });

        rulesIoContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            rulesIoContainer.style.borderColor = 'var(--border-color)';
            rulesIoContainer.style.background = 'rgba(255, 255, 255, 0.02)';

            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                importRulesFromFile(e.dataTransfer.files[0]);
            }
        });
    }

    // Modal listeners
    const rulesModalOverlay = document.getElementById('rules-modal-overlay');
    const rulesModalCloseBtn = document.getElementById('rules-modal-close-btn');
    const rulesModalCancelBtn = document.getElementById('rules-modal-cancel-btn');
    const rulesModalMergeBtn = document.getElementById('rules-modal-merge-btn');
    const rulesModalOverwriteBtn = document.getElementById('rules-modal-overwrite-btn');

    function closeModal() {
        if (rulesModalOverlay) rulesModalOverlay.style.display = 'none';
        pendingParsedRules = null;
    }

    if (rulesModalCloseBtn) rulesModalCloseBtn.onclick = closeModal;
    if (rulesModalCancelBtn) rulesModalCancelBtn.onclick = closeModal;
    if (rulesModalOverlay) {
        rulesModalOverlay.onclick = (e) => {
            if (e.target === rulesModalOverlay) closeModal();
        };
    }

    if (rulesModalMergeBtn) {
        rulesModalMergeBtn.onclick = () => {
            if (pendingParsedRules) {
                applyParsedRules(pendingParsedRules, 'merge');
                closeModal();
            }
        };
    }

    if (rulesModalOverwriteBtn) {
        rulesModalOverwriteBtn.onclick = () => {
            if (pendingParsedRules) {
                applyParsedRules(pendingParsedRules, 'overwrite');
                closeModal();
            }
        };
    }
}
initRulesFileListeners();

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
        alert("日本語辞書の読み込みが完了していません。画面のロード完了をお待ちいただくか、再読み込みをお試しください。");
        return;
    }
    rawTextData = text;
    pcaUserManual = false;
    umapUserManual = false;
    pcaUserK = null;
    umapUserK = null;
    const lines = rawTextData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    opinionLinesCount = lines.length;

    if (lines.length === 0) {
        alert("有効なテキストデータが見つかりませんでした。");
        if (loadingOverlay) loadingOverlay.style.display = 'none';
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
            if (taskId !== currentTokenizeTaskId) {
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                return;
            }
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
                try {
                    processAndRender();
                } catch (renderErr) {
                    console.error("Rendering error:", renderErr);
                    alert("描画処理中にエラーが発生しました:\n" + renderErr.message);
                }
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

if (clearCompoundBtn) {
    clearCompoundBtn.addEventListener('click', () => {
        if (customCompoundWords.size === 0) {
            alert("登録されている複合語はありません。");
            return;
        }
        if (confirm("登録されている複合語をすべてクリアしますか？")) {
            customCompoundWords.clear();
            saveSettings();
            renderCompoundWords();
            if (rawTextData) {
                processAndRender();
            }
        }
    });
}

if (resetStopwordsBtn) {
    resetStopwordsBtn.addEventListener('click', () => {
        if (customStopWords.size === 0) {
            alert("追加された除外ワードはありません。");
            return;
        }
        if (confirm("画面上で追加した除外ワードをすべてクリアしますか？（標準の除外リストは維持されます）")) {
            customStopWords.clear();
            saveSettings();
            renderStopWords();
            if (rawTextData) {
                processAndRender();
            }
        }
    });
}

if (clearSynonymsBtn) {
    clearSynonymsBtn.addEventListener('click', () => {
        if (customSynonymRules.size === 0) {
            alert("登録されている置換ルールはありません。");
            return;
        }
        if (confirm("登録されている置換ルールをすべてクリアしますか？")) {
            customSynonymRules.clear();
            saveSettings();
            renderSynonymRules();
            if (rawTextData) {
                processAndRender();
            }
        }
    });
}

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

let pendingCsvFileName = "";
// Excel風オートフィルタ: Map<colIndex, Set<string>>
let excelColumnFilters = new Map();
let currentFilterDropdown = null;

// テーブル全体の行ソート状態 (列インデックス, 昇順=true/降順=false)
let csvTableSortCol = null;
let csvTableSortAsc = true;

// ==========================================
// 自然順ソート判定（日付順・程度の表現順・数値順・50音順）
// ==========================================

// 程度の表現の順序辞書（アンケートや評価尺度で頻出する自然な順序）
const DEGREE_SCALE_GROUPS = [
    // 満足度尺度
    [
        ["大変満足", "非常に満足", "とても満足"],
        ["満足"],
        ["やや満足", "どちらかといえば満足", "まあ満足"],
        ["普通", "どちらともいえない", "どちらでもない", "中立"],
        ["やや不満", "どちらかといえば不満"],
        ["不満"],
        ["大変不満", "非常に不満", "とても不満", "大いに不満"]
    ],
    // 評価（良し悪し・景気現状判断・動向）尺度
    [
        ["大変良い", "非常に良い", "とても良い", "極めて良い"],
        ["良い", "よい", "良好", "優良", "良くなっている", "上向き", "改善"],
        ["やや良い", "どちらかといえば良い", "まあ良い", "やや良くなっている", "やや上向き", "やや改善", "少し良い"],
        ["普通", "ふつう", "変わらない", "横ばい", "保合", "変化なし", "前年並み", "平年並み", "同水準"],
        ["やや悪い", "どちらかといえば悪い", "少し悪い", "やや悪くなっている", "やや下向き", "やや悪化"],
        ["悪い", "わるい", "不良", "悪くなっている", "下向き", "悪化"],
        ["大変悪い", "非常に悪い", "とても悪い", "最悪", "極めて悪い"]
    ],
    // 同意度・共感度尺度
    [
        ["強くそう思う", "非常にそう思う", "大変そう思う"],
        ["そう思う"],
        ["ややそう思う", "どちらかといえばそう思う"],
        ["どちらともいえない", "どちらでもない"],
        ["あまりそう思わない", "どちらかといえばそう思わない"],
        ["そう思わない"],
        ["全くそう思わない", "決してそう思わない", "ぜんぜんそう思わない"]
    ],
    // 大小・高低・強弱・階級
    [
        ["特大"], ["大", "大きい"], ["中", "普通"], ["小", "小さい"], ["極小"]
    ],
    [
        ["最高", "極高"], ["高", "高い"], ["中", "中等度"], ["低", "低い"], ["極低", "最低"]
    ],
    [
        ["最強"], ["強", "強い"], ["中"], ["弱", "弱い"], ["最弱"]
    ],
    [
        ["上", "上位", "上級"], ["中", "中位", "中級"], ["下", "下位", "初級"]
    ],
    [
        ["松"], ["竹"], ["梅"]
    ],
    [
        ["S", "SS", "AAA"], ["A", "AA"], ["B"], ["C"], ["D"], ["E"], ["F"]
    ],
    [
        ["秀"], ["優"], ["良"], ["可"], ["不可", "不可（落第）"]
    ],
    // 頻度尺度
    [
        ["いつも", "常に", "毎日"],
        ["よくある", "しばしば", "頻繁に", "週に数回"],
        ["たまにある", "ときどき", "たまに", "月に数回"],
        ["あまりない", "めったにない", "年に数回"],
        ["まったくない", "全くない", "なし", "一度もない"]
    ],
    // 重要度・必要性尺度
    [
        ["最重要", "必須", "極めて重要", "とても必要"],
        ["重要", "必要"],
        ["普通", "どちらでもよい"],
        ["あまり重要でない", "あまり必要ない"],
        ["不要", "重要でない", "全く不要"]
    ],
    // 賛否・合否・有無
    [
        ["賛成", "大賛成"],
        ["やや賛成"],
        ["どちらともいえない"],
        ["やや反対"],
        ["反対", "大反対"]
    ],
    [
        ["はい", "可", "合格", "有", "あり", "正", "OK"],
        ["いいえ", "不可", "不合格", "無", "なし", "誤", "NG"]
    ]
];

// 単語 -> { group, rank } のマップ
const DEGREE_SCALE_MAP = new Map();
DEGREE_SCALE_GROUPS.forEach((group, gIdx) => {
    group.forEach((synonyms, rank) => {
        synonyms.forEach(word => {
            const normalized = word.trim().toLowerCase();
            if (!DEGREE_SCALE_MAP.has(normalized)) {
                DEGREE_SCALE_MAP.set(normalized, { group: gIdx, rank: rank });
            }
        });
    });
});

// 日付判定関数（タイムスタンプを返却、日付でなければ null）
function parseDateScore(val) {
    if (!val || typeof val !== 'string') return null;
    const s = val.trim();
    if (!s || s === '(空白)') return null;

    // YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD (任意で時刻付き)
    const matchYMD = s.match(/^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (matchYMD) {
        const y = parseInt(matchYMD[1], 10);
        const m = parseInt(matchYMD[2], 10) - 1;
        const d = parseInt(matchYMD[3], 10);
        const hh = matchYMD[4] ? parseInt(matchYMD[4], 10) : 0;
        const mm = matchYMD[5] ? parseInt(matchYMD[5], 10) : 0;
        const ss = matchYMD[6] ? parseInt(matchYMD[6], 10) : 0;
        return new Date(y, m, d, hh, mm, ss).getTime();
    }

    // YYYY年M月D日, YYYY年M月
    const matchJa = s.match(/^(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?$/);
    if (matchJa) {
        const y = parseInt(matchJa[1], 10);
        const m = parseInt(matchJa[2], 10) - 1;
        const d = matchJa[3] ? parseInt(matchJa[3], 10) : 1;
        return new Date(y, m, d).getTime();
    }

    // YYYY-MM, YYYY/MM
    const matchYM = s.match(/^(\d{4})[-/\.](\d{1,2})$/);
    if (matchYM) {
        const y = parseInt(matchYM[1], 10);
        const m = parseInt(matchYM[2], 10) - 1;
        return new Date(y, m, 1).getTime();
    }

    // M月D日
    const matchMD = s.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (matchMD) {
        const m = parseInt(matchMD[1], 10) - 1;
        const d = parseInt(matchMD[2], 10);
        return new Date(2000, m, d).getTime();
    }

    return null;
}

// 2つのCSVセル値の自然順比較（日付順、程度の表現順、数値順、50音自然順）
function compareCSVValues(a, b) {
    if (a === b) return 0;
    // (空白) は常に最後
    if (a === '(空白)') return 1;
    if (b === '(空白)') return -1;
    if (!a) return 1;
    if (!b) return -1;

    // 1. 日付判定
    const dateA = parseDateScore(a);
    const dateB = parseDateScore(b);
    if (dateA !== null && dateB !== null) {
        if (dateA !== dateB) return dateA - dateB;
        return a.localeCompare(b, 'ja');
    }

    // 2. 程度の表現判定（同一スケールグループ内であればランク順）
    const normA = a.trim().toLowerCase();
    const normB = b.trim().toLowerCase();
    const degA = DEGREE_SCALE_MAP.get(normA);
    const degB = DEGREE_SCALE_MAP.get(normB);
    if (degA && degB && degA.group === degB.group) {
        if (degA.rank !== degB.rank) {
            return degA.rank - degB.rank;
        }
    }

    // 3. 純粋な数値判定 (半角・全角対応)
    const numA = Number(a.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)));
    const numB = Number(b.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)));
    const isNumA = !isNaN(numA) && a.trim() !== '';
    const isNumB = !isNaN(numB) && b.trim() !== '';
    if (isNumA && isNumB) {
        if (numA !== numB) return numA - numB;
    }

    // 4. 数値混じり自然順ソート (例: 10代 vs 20代, 第1回 vs 第10回)
    return a.localeCompare(b, 'ja', { numeric: true, sensitivity: 'base' });
}

function getCSVColCount(rows) {
    return rows && rows.length > 0 ? Math.max(...rows.map(r => r.length)) : 0;
}

function getCSVColumnName(colIdx, rows, hasHeader) {
    if (hasHeader && rows && rows[0] && rows[0][colIdx]) {
        return rows[0][colIdx].trim();
    }
    return `${colIdx + 1}列目`;
}

function rowMatchesExcelFilters(row, filtersMap) {
    if (!filtersMap || filtersMap.size === 0) return true;
    for (const [colIdx, allowedSet] of filtersMap.entries()) {
        const raw = (row && row[colIdx] !== undefined && row[colIdx] !== null) ? String(row[colIdx]).trim() : '';
        const cellVal = raw === '' ? '(空白)' : raw;
        if (!allowedSet.has(cellVal)) {
            return false;
        }
    }
    return true;
}

function getCSVColumnValueCounts(colIdx, rows, hasHeader) {
    if (!rows || rows.length === 0) return [];
    const startRow = hasHeader ? 1 : 0;
    const counts = new Map();

    for (let r = startRow; r < rows.length; r++) {
        if (!rows[r]) continue;
        let val = rows[r][colIdx];
        val = (val !== undefined && val !== null) ? String(val).trim() : '';
        if (val === '') {
            val = '(空白)';
        }
        counts.set(val, (counts.get(val) || 0) + 1);
    }

    // 自然な順序（日付順、程度の表現順、数値順、50音自然順）でソート
    return Array.from(counts.entries()).sort((a, b) => {
        return compareCSVValues(a[0], b[0]);
    });
}

function closeExcelFilterDropdown() {
    if (currentFilterDropdown) {
        if (currentFilterDropdown.parentNode) {
            currentFilterDropdown.parentNode.removeChild(currentFilterDropdown);
        }
        currentFilterDropdown = null;
    }
}

function openExcelFilterDropdown(colIdx, buttonElem) {
    closeExcelFilterDropdown();
    if (!pendingCsvRows || pendingCsvRows.length === 0) return;

    const hasHeader = document.getElementById('csv-has-header-check')?.checked ?? true;
    const colName = getCSVColumnName(colIdx, pendingCsvRows, hasHeader);
    const valueCounts = getCSVColumnValueCounts(colIdx, pendingCsvRows, hasHeader);
    const allValues = valueCounts.map(vc => vc[0]);

    // 作業用テンポラリSet（未設定なら全選択）
    const tempSelected = excelColumnFilters.has(colIdx)
        ? new Set(excelColumnFilters.get(colIdx))
        : new Set(allValues);

    const dropdown = document.createElement('div');
    dropdown.className = 'excel-filter-dropdown';

    // ヘッダー
    const header = document.createElement('div');
    header.className = 'excel-filter-dropdown-header';
    const title = document.createElement('div');
    title.className = 'excel-filter-dropdown-title';
    title.textContent = `フィルタ: ${colName}`;
    title.title = colName;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-subtle';
    closeBtn.style.cssText = 'border:none; background:none; cursor:pointer; color:var(--text-muted); font-size:12px; padding:2px 6px;';
    closeBtn.textContent = '✕';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeExcelFilterDropdown();
    };
    header.appendChild(title);
    header.appendChild(closeBtn);
    dropdown.appendChild(header);

    // ソートボタンバー（昇順・降順で並べ替え）
    const sortBar = document.createElement('div');
    sortBar.className = 'excel-filter-sort-bar';

    // この列の現在のソート状態（未ソートの場合はデフォルト昇順）
    let dropdownSortAsc = (csvTableSortCol === colIdx) ? csvTableSortAsc : true;

    const sortAscBtn = document.createElement('button');
    sortAscBtn.type = 'button';
    sortAscBtn.className = `excel-sort-btn${(csvTableSortCol === colIdx && csvTableSortAsc) ? ' active' : ''}`;
    sortAscBtn.innerHTML = `<span>↑</span> 昇順で並べ替え`;
    sortAscBtn.title = `${colName} の値で表と候補を昇順（日付順・数値順・自然順）に並べ替えます`;

    const sortDescBtn = document.createElement('button');
    sortDescBtn.type = 'button';
    sortDescBtn.className = `excel-sort-btn${(csvTableSortCol === colIdx && !csvTableSortAsc) ? ' active' : ''}`;
    sortDescBtn.innerHTML = `<span>↓</span> 降順で並べ替え`;
    sortDescBtn.title = `${colName} の値で表と候補を降順に並べ替えます`;

    function applyColumnSort(asc) {
        dropdownSortAsc = asc;
        csvTableSortCol = colIdx;
        csvTableSortAsc = asc;

        // ボタンのアクティブ状態を切り替え
        sortAscBtn.className = `excel-sort-btn${asc ? ' active' : ''}`;
        sortDescBtn.className = `excel-sort-btn${!asc ? ' active' : ''}`;

        // 候補リスト（valueCounts）自体を昇順/降順で並べ替えて即座に再描画
        valueCounts.sort((a, b) => {
            const cmp = compareCSVValues(a[0], b[0]);
            return asc ? cmp : -cmp;
        });
        renderListItems();

        // 背後のデータテーブルも即座に再描画（ソート結果を即座に確認可能）
        renderCSVDataTable();
    }

    sortAscBtn.onclick = (e) => {
        e.stopPropagation();
        applyColumnSort(true);
    };

    sortDescBtn.onclick = (e) => {
        e.stopPropagation();
        applyColumnSort(false);
    };

    // 初期表示時：もし現在この列が降順ソート中なら、候補リストも降順で表示
    if (csvTableSortCol === colIdx && !csvTableSortAsc) {
        valueCounts.sort((a, b) => {
            const cmp = compareCSVValues(a[0], b[0]);
            return -cmp;
        });
    }

    sortBar.appendChild(sortAscBtn);
    sortBar.appendChild(sortDescBtn);
    dropdown.appendChild(sortBar);

    // 検索窓
    const searchBox = document.createElement('div');
    searchBox.className = 'excel-filter-search-box';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'excel-filter-search-input';
    searchInput.placeholder = '候補を検索...';
    searchInput.autocomplete = 'off';
    searchBox.appendChild(searchInput);
    dropdown.appendChild(searchBox);

    // 一括アクションバー
    const actionsBar = document.createElement('div');
    actionsBar.className = 'excel-filter-actions-bar';
    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.textContent = 'すべて選択';
    const clearAllBtn = document.createElement('button');
    clearAllBtn.type = 'button';
    clearAllBtn.textContent = 'すべてクリア';
    actionsBar.appendChild(selectAllBtn);
    actionsBar.appendChild(clearAllBtn);
    dropdown.appendChild(actionsBar);

    // チェックリストエリア
    const listContainer = document.createElement('div');
    listContainer.className = 'excel-filter-list';
    dropdown.appendChild(listContainer);

    function renderListItems() {
        listContainer.innerHTML = '';
        const query = (searchInput.value || '').trim().toLowerCase();
        let renderedCount = 0;

        valueCounts.forEach(([val, count]) => {
            if (query && !val.toLowerCase().includes(query)) {
                return;
            }
            renderedCount++;

            const item = document.createElement('label');
            item.className = 'excel-filter-item';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = tempSelected.has(val);
            chk.onchange = () => {
                if (chk.checked) {
                    tempSelected.add(val);
                } else {
                    tempSelected.delete(val);
                }
            };

            const labelSpan = document.createElement('span');
            labelSpan.className = 'item-label';
            labelSpan.textContent = val;
            labelSpan.title = val;

            const countSpan = document.createElement('span');
            countSpan.className = 'item-count';
            countSpan.textContent = `(${count.toLocaleString()})`;

            item.appendChild(chk);
            item.appendChild(labelSpan);
            item.appendChild(countSpan);
            listContainer.appendChild(item);
        });

        if (renderedCount === 0) {
            const emptyNotice = document.createElement('div');
            emptyNotice.style.cssText = 'padding: 10px; color: var(--text-muted); font-size: 11px; text-align: center;';
            emptyNotice.textContent = '一致する候補がありません';
            listContainer.appendChild(emptyNotice);
        }
    }

    renderListItems();

    searchInput.oninput = () => {
        renderListItems();
    };

    selectAllBtn.onclick = (e) => {
        e.stopPropagation();
        const query = (searchInput.value || '').trim().toLowerCase();
        valueCounts.forEach(([val]) => {
            if (!query || val.toLowerCase().includes(query)) {
                tempSelected.add(val);
            }
        });
        renderListItems();
    };

    clearAllBtn.onclick = (e) => {
        e.stopPropagation();
        const query = (searchInput.value || '').trim().toLowerCase();
        if (query) {
            valueCounts.forEach(([val]) => {
                if (val.toLowerCase().includes(query)) {
                    tempSelected.delete(val);
                }
            });
        } else {
            tempSelected.clear();
        }
        renderListItems();
    };

    // フッター
    const footer = document.createElement('div');
    footer.className = 'excel-filter-footer';

    const clearFilterBtn = document.createElement('button');
    clearFilterBtn.type = 'button';
    clearFilterBtn.className = 'excel-filter-btn-clear';
    clearFilterBtn.textContent = 'フィルタ解除';
    clearFilterBtn.title = 'この列の絞り込みを解除して全表示にします';
    clearFilterBtn.onclick = (e) => {
        e.stopPropagation();
        excelColumnFilters.delete(colIdx);
        closeExcelFilterDropdown();
        updateCSVModalPreview();
    };

    const footerRight = document.createElement('div');
    footerRight.className = 'excel-filter-footer-right';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'excel-filter-btn-cancel';
    cancelBtn.textContent = 'キャンセル';
    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        closeExcelFilterDropdown();
    };

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'excel-filter-btn-ok';
    okBtn.textContent = 'OK';
    okBtn.onclick = (e) => {
        e.stopPropagation();
        if (tempSelected.size === allValues.length) {
            // 全て選択されている場合はフィルタ解除扱い（Mapから削除）
            excelColumnFilters.delete(colIdx);
        } else {
            excelColumnFilters.set(colIdx, new Set(tempSelected));
        }
        closeExcelFilterDropdown();
        updateCSVModalPreview();
    };

    footerRight.appendChild(cancelBtn);
    footerRight.appendChild(okBtn);
    footer.appendChild(clearFilterBtn);
    footer.appendChild(footerRight);
    dropdown.appendChild(footer);

    // ポジショニング
    document.body.appendChild(dropdown);
    currentFilterDropdown = dropdown;

    const btnRect = buttonElem.getBoundingClientRect();
    const dropdownWidth = 280;
    const dropdownHeight = 320;

    let top = btnRect.bottom + 4;
    if (top + dropdownHeight > window.innerHeight - 10) {
        top = Math.max(10, btnRect.top - dropdownHeight - 4);
    }

    let left = btnRect.left - 120;
    if (left + dropdownWidth > window.innerWidth - 10) {
        left = window.innerWidth - dropdownWidth - 10;
    }
    if (left < 10) left = 10;

    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;

    // 検索入力欄に自動フォーカス
    setTimeout(() => {
        searchInput.focus();
    }, 50);

    // 外側クリックで閉じるハンドラー
    const outsideClickListener = (e) => {
        if (!dropdown.contains(e.target) && e.target !== buttonElem && !buttonElem.contains(e.target)) {
            closeExcelFilterDropdown();
            document.removeEventListener('mousedown', outsideClickListener);
        }
    };
    setTimeout(() => {
        document.addEventListener('mousedown', outsideClickListener);
    }, 10);
}

function renderExcelActiveFiltersBar() {
    const bar = document.getElementById('csv-active-filters-bar');
    const list = document.getElementById('csv-active-filters-list');
    if (!bar || !list) return;

    if (excelColumnFilters.size === 0) {
        bar.style.display = 'none';
        list.innerHTML = '';
        return;
    }

    bar.style.display = 'flex';
    list.innerHTML = '';

    const hasHeader = document.getElementById('csv-has-header-check')?.checked ?? true;

    for (const [colIdx, selectedSet] of excelColumnFilters.entries()) {
        const colName = getCSVColumnName(colIdx, pendingCsvRows, hasHeader);
        const chip = document.createElement('div');
        chip.className = 'excel-active-chip';

        const title = document.createElement('span');
        title.className = 'excel-active-chip-title';
        title.textContent = `${colName}:`;

        const values = Array.from(selectedSet);
        const valText = values.length === 0
            ? '(なし)'
            : values.slice(0, 2).join(', ') + (values.length > 2 ? ` (+${values.length - 2})` : '');

        const valsSpan = document.createElement('span');
        valsSpan.className = 'excel-active-chip-values';
        valsSpan.textContent = valText;
        valsSpan.title = values.join(', ');

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'excel-active-chip-remove';
        removeBtn.textContent = '✕';
        removeBtn.title = `${colName} のフィルタを解除`;
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            excelColumnFilters.delete(colIdx);
            updateCSVModalPreview();
        };

        chip.appendChild(title);
        chip.appendChild(valsSpan);
        chip.appendChild(removeBtn);
        list.appendChild(chip);
    }
}

function showCSVColumnModal(fileName, rows, isReopen = false) {
    if (rows) pendingCsvRows = rows;
    if (fileName) pendingCsvFileName = fileName;

    const csvModalOverlay = document.getElementById('csv-modal-overlay');
    const csvColumnSelect = document.getElementById('csv-column-select');
    const csvHasHeaderCheck = document.getElementById('csv-has-header-check');
    const csvModalFilename = document.getElementById('csv-modal-filename');
    const openCsvViewerBtn = document.getElementById('open-csv-viewer-btn');

    if (!csvModalOverlay || !csvColumnSelect || !pendingCsvRows) return;

    const colCount = getCSVColCount(pendingCsvRows);
    if (colCount === 0) return;

    if (csvModalFilename) {
        csvModalFilename.textContent = pendingCsvFileName || 'CSVデータ';
    }

    if (openCsvViewerBtn) {
        openCsvViewerBtn.style.display = 'inline-flex';
    }

    if (!isReopen) {
        excelColumnFilters.clear();
        closeExcelFilterDropdown();
        csvTableSortCol = null;
        csvTableSortAsc = true;
    }

    function findBestTextColumn() {
        let bestColIdx = 0;
        let maxScore = -1;
        const hasHeader = csvHasHeaderCheck ? csvHasHeaderCheck.checked : true;
        const startRow = hasHeader ? 1 : 0;

        for (let colIdx = 0; colIdx < colCount; colIdx++) {
            let score = 0;
            let headerName = "";
            if (hasHeader && pendingCsvRows[0] && pendingCsvRows[0][colIdx]) {
                headerName = pendingCsvRows[0][colIdx].trim();
            }

            if (/理由|詳細|記述|コメント|内容|意見|テキスト|本文|回答|アンケート|自由|備考/i.test(headerName)) {
                score += 2000;
            }

            let totalLen = 0;
            let count = 0;
            for (let r = startRow; r < Math.min(startRow + 20, pendingCsvRows.length); r++) {
                if (pendingCsvRows[r] && pendingCsvRows[r][colIdx]) {
                    const str = pendingCsvRows[r][colIdx].trim();
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

    function populateColumnOptions() {
        const currentSelectedVal = isReopen ? parseInt(csvColumnSelect.value) : -1;
        csvColumnSelect.innerHTML = '';
        const hasHeader = csvHasHeaderCheck ? csvHasHeaderCheck.checked : true;
        const startRow = hasHeader ? 1 : 0;
        const bestColIdx = findBestTextColumn();
        const targetColToSelect = currentSelectedVal >= 0 ? currentSelectedVal : bestColIdx;

        for (let colIdx = 0; colIdx < colCount; colIdx++) {
            let headerName = "";
            if (hasHeader && pendingCsvRows[0] && pendingCsvRows[0][colIdx]) {
                headerName = pendingCsvRows[0][colIdx].trim();
            }

            let sampleVal = "";
            for (let r = startRow; r < Math.min(startRow + 10, pendingCsvRows.length); r++) {
                if (pendingCsvRows[r] && pendingCsvRows[r][colIdx] !== undefined && pendingCsvRows[r][colIdx].trim()) {
                    sampleVal = pendingCsvRows[r][colIdx].trim();
                    break;
                }
            }

            const option = document.createElement('option');
            option.value = colIdx;
            if (colIdx === targetColToSelect) option.selected = true;

            const shortSample = sampleVal.length > 25 ? sampleVal.substring(0, 25) + "..." : sampleVal;
            if (hasHeader && headerName) {
                option.innerText = `[ ${colIdx + 1}列目 ] "${headerName}" ${shortSample ? `(例: ${shortSample})` : '(データ空)'}`;
            } else {
                option.innerText = `[ ${colIdx + 1}列目 ] ${shortSample ? `(例: ${shortSample})` : '(データ空)'}`;
            }
            csvColumnSelect.appendChild(option);
        }
        csvColumnSelect.value = targetColToSelect;
        updateCSVModalPreview();
    }

    if (csvHasHeaderCheck) {
        csvHasHeaderCheck.onchange = () => {
            populateColumnOptions();
        };
    }
    csvColumnSelect.onchange = () => {
        updateCSVModalPreview();
    };

    csvModalOverlay.style.display = 'flex';
    populateColumnOptions();
}

function renderCSVDataTable() {
    const tableHead = document.getElementById('csv-data-table-head');
    const tableBody = document.getElementById('csv-data-table-body');
    if (!tableHead || !tableBody || !pendingCsvRows || pendingCsvRows.length === 0) return;

    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    const hasHeader = document.getElementById('csv-has-header-check')?.checked ?? true;
    const onlyMatched = document.getElementById('csv-table-only-matched-check')?.checked ?? true;
    const selectedCol = parseInt(document.getElementById('csv-column-select')?.value) || 0;
    const colCount = getCSVColCount(pendingCsvRows);
    const startRow = hasHeader ? 1 : 0;

    // テーブルヘッダーの生成
    const trHead = document.createElement('tr');
    const thIdx = document.createElement('th');
    thIdx.style.width = '45px';
    thIdx.style.textAlign = 'center';
    thIdx.textContent = '#';
    trHead.appendChild(thIdx);

    for (let c = 0; c < colCount; c++) {
        const th = document.createElement('th');
        const colName = getCSVColumnName(c, pendingCsvRows, hasHeader);
        const isTarget = c === selectedCol;
        const isFilter = excelColumnFilters.has(c);

        if (isTarget) th.classList.add('target-col');
        if (isFilter) th.classList.add('filter-col');

        const thContent = document.createElement('div');
        thContent.className = 'th-content';

        const labelGroup = document.createElement('div');
        labelGroup.style.cssText = 'display:flex; align-items:center; gap:4px; overflow:hidden; text-overflow:ellipsis; cursor:pointer;';
        labelGroup.title = `${colName}: クリックで並べ替え（昇順/降順）`;
        labelGroup.onclick = (e) => {
            e.stopPropagation();
            if (csvTableSortCol === c) {
                csvTableSortAsc = !csvTableSortAsc;
            } else {
                csvTableSortCol = c;
                csvTableSortAsc = true;
            }
            renderCSVDataTable();
        };

        const nameSpan = document.createElement('span');
        nameSpan.textContent = colName;
        nameSpan.style.cssText = 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        labelGroup.appendChild(nameSpan);

        // ソート中インジケーター（▲ / ▼）
        if (csvTableSortCol === c) {
            const sortBadge = document.createElement('span');
            sortBadge.style.cssText = 'font-size:10px; color:var(--accent-blue); font-weight:700; margin-left:2px; flex-shrink:0;';
            sortBadge.textContent = csvTableSortAsc ? '▲' : '▼';
            sortBadge.title = csvTableSortAsc ? '昇順で並べ替え中' : '降順で並べ替え中';
            labelGroup.appendChild(sortBadge);
        }

        if (isTarget) {
            const targetBadge = document.createElement('span');
            targetBadge.style.cssText = 'display:inline-block; font-size:9.5px; background:var(--accent-blue); color:#ffffff; padding:1px 5px; border-radius:3px; font-weight:700; white-space:nowrap; flex-shrink:0;';
            targetBadge.textContent = '分析対象';
            labelGroup.appendChild(targetBadge);
        }

        thContent.appendChild(labelGroup);

        // Excel風オートフィルタ ボタン（▼）
        const filterBtn = document.createElement('button');
        filterBtn.type = 'button';
        filterBtn.className = `excel-filter-btn${isFilter ? ' has-filter' : ''}`;
        filterBtn.title = isFilter
            ? `フィルタ適用中 (${colName}): クリックして変更または解除`
            : `オートフィルタ (${colName}): クリックして絞り込み・並べ替え`;
        filterBtn.innerHTML = isFilter ? '▼' : '▼';

        filterBtn.onclick = (e) => {
            e.stopPropagation();
            openExcelFilterDropdown(c, filterBtn);
        };

        thContent.appendChild(filterBtn);
        th.appendChild(thContent);
        trHead.appendChild(th);
    }
    tableHead.appendChild(trHead);

    // テーブルボディの生成（最大100行表示）
    // 表示用に行インデックスのリストを作成
    const rowIndices = [];
    for (let r = startRow; r < pendingCsvRows.length; r++) {
        rowIndices.push(r);
    }

    // 列ソートが指定されている場合は、自然順でソート
    if (csvTableSortCol !== null) {
        rowIndices.sort((idxA, idxB) => {
            const rawA = pendingCsvRows[idxA] ? pendingCsvRows[idxA][csvTableSortCol] : '';
            const rawB = pendingCsvRows[idxB] ? pendingCsvRows[idxB][csvTableSortCol] : '';
            const cmp = compareCSVValues(String(rawA || '').trim(), String(rawB || '').trim());
            return csvTableSortAsc ? cmp : -cmp;
        });
    }

    let displayedRows = 0;
    const maxDisplayRows = 100;
    let totalMatchedRows = 0;

    for (let i = 0; i < rowIndices.length; i++) {
        const r = rowIndices[i];
        const row = pendingCsvRows[r];
        const isMatched = rowMatchesExcelFilters(row, excelColumnFilters);
        if (isMatched) totalMatchedRows++;

        if (onlyMatched && !isMatched) {
            continue;
        }

        displayedRows++;
        if (displayedRows > maxDisplayRows) {
            continue;
        }

        const tr = document.createElement('tr');
        tr.className = isMatched ? 'matched-row' : 'unmatched-row';

        const tdIdx = document.createElement('td');
        tdIdx.style.textAlign = 'center';
        tdIdx.style.color = 'var(--text-muted)';
        tdIdx.style.fontSize = '10.5px';
        tdIdx.textContent = r + 1; // 元のCSV行番号
        tr.appendChild(tdIdx);

        for (let c = 0; c < colCount; c++) {
            const td = document.createElement('td');
            if (c === selectedCol) {
                td.classList.add('target-cell');
            }
            const val = (row && row[c] !== undefined && row[c] !== null) ? String(row[c]).trim() : '';
            td.textContent = val || '(空)';
            if (!val) {
                td.style.color = 'var(--text-muted)';
                td.style.fontStyle = 'italic';
            }
            td.title = val; // ツールチップで全文確認可能
            tr.appendChild(td);
        }
        tableBody.appendChild(tr);
    }

    if (displayedRows > maxDisplayRows) {
        const trMore = document.createElement('tr');
        const tdMore = document.createElement('td');
        tdMore.colSpan = colCount + 1;
        tdMore.style.textAlign = 'center';
        tdMore.style.padding = '8px';
        tdMore.style.color = 'var(--text-muted)';
        tdMore.style.fontSize = '11px';
        tdMore.style.background = 'rgba(0,0,0,0.1)';
        tdMore.textContent = `※ パフォーマンス保護のため先頭 ${maxDisplayRows} 行を表示中（該当 ${totalMatchedRows.toLocaleString()} 行）`;
        trMore.appendChild(tdMore);
        tableBody.appendChild(trMore);
    }

    if (displayedRows === 0) {
        const trEmpty = document.createElement('tr');
        const tdEmpty = document.createElement('td');
        tdEmpty.colSpan = colCount + 1;
        tdEmpty.style.textAlign = 'center';
        tdEmpty.style.padding = '24px 16px';
        tdEmpty.style.color = '#EF4444';
        tdEmpty.style.fontWeight = '600';
        tdEmpty.innerHTML = '⚠️ 条件に一致する行がありません。列ヘッダーの▼ボタンからフィルタ条件を解除・変更してください。';
        trEmpty.appendChild(tdEmpty);
        tableBody.appendChild(trEmpty);
    }
}

function updateCSVModalPreview() {
    if (!pendingCsvRows || pendingCsvRows.length === 0) return;

    const csvColumnSelect = document.getElementById('csv-column-select');
    const csvHasHeaderCheck = document.getElementById('csv-has-header-check');
    const csvConfirmBtn = document.getElementById('csv-confirm-btn');
    const csvConfirmBtnText = document.getElementById('csv-confirm-btn-text');
    const csvMatchingCount = document.getElementById('csv-matching-count');
    const csvTotalCount = document.getElementById('csv-total-count');
    const csvMatchingPercent = document.getElementById('csv-matching-percent');
    const csvFooterTotal = document.getElementById('csv-footer-total');
    const csvFooterMatched = document.getElementById('csv-footer-matched');

    const hasHeader = csvHasHeaderCheck ? csvHasHeaderCheck.checked : true;
    const startRow = hasHeader ? 1 : 0;
    const totalDataRows = Math.max(0, pendingCsvRows.length - startRow);

    const isFiltered = excelColumnFilters.size > 0;
    let matchedCount = 0;
    for (let r = startRow; r < pendingCsvRows.length; r++) {
        if (rowMatchesExcelFilters(pendingCsvRows[r], excelColumnFilters)) {
            matchedCount++;
        }
    }

    const percent = totalDataRows > 0 ? Math.round((matchedCount / totalDataRows) * 100) : 0;

    if (csvMatchingCount) csvMatchingCount.textContent = matchedCount.toLocaleString();
    if (csvTotalCount) csvTotalCount.textContent = totalDataRows.toLocaleString();
    if (csvMatchingPercent) csvMatchingPercent.textContent = `${percent}%`;

    if (csvFooterTotal) csvFooterTotal.textContent = totalDataRows.toLocaleString();
    if (csvFooterMatched) csvFooterMatched.textContent = matchedCount.toLocaleString();

    if (matchedCount === 0) {
        if (csvConfirmBtn) csvConfirmBtn.disabled = true;
        if (csvConfirmBtnText) csvConfirmBtnText.textContent = '一致する行がありません';
    } else {
        if (csvConfirmBtn) csvConfirmBtn.disabled = false;
        if (csvConfirmBtnText) {
            csvConfirmBtnText.textContent = isFiltered
                ? `絞り込んだ ${matchedCount.toLocaleString()} 行で分析を実行`
                : `選択した列 (${totalDataRows.toLocaleString()} 行) で分析を実行`;
        }
    }

    // 上部アクティブフィルタバーの更新
    renderExcelActiveFiltersBar();

    // テーブルの再描画
    renderCSVDataTable();
}

function initCSVModalListeners() {
    const csvModalOverlay = document.getElementById('csv-modal-overlay');
    const csvModalCloseBtn = document.getElementById('csv-modal-close-btn');
    const csvCancelBtn = document.getElementById('csv-cancel-btn');
    const csvConfirmBtn = document.getElementById('csv-confirm-btn');
    const csvColumnSelect = document.getElementById('csv-column-select');
    const csvHasHeaderCheck = document.getElementById('csv-has-header-check');
    const csvClearAllFiltersBtn = document.getElementById('csv-clear-all-filters-btn');
    const csvTableOnlyMatchedCheck = document.getElementById('csv-table-only-matched-check');
    const openCsvViewerBtn = document.getElementById('open-csv-viewer-btn');

    function closeModal() {
        closeExcelFilterDropdown();
        if (csvModalOverlay) csvModalOverlay.style.display = 'none';
    }

    if (csvModalCloseBtn) csvModalCloseBtn.onclick = closeModal;
    if (csvCancelBtn) csvCancelBtn.onclick = closeModal;

    if (openCsvViewerBtn) {
        openCsvViewerBtn.onclick = () => {
            if (pendingCsvRows && pendingCsvRows.length > 0) {
                showCSVColumnModal(pendingCsvFileName, pendingCsvRows, true);
            }
        };
    }

    if (csvClearAllFiltersBtn) {
        csvClearAllFiltersBtn.onclick = () => {
            excelColumnFilters.clear();
            closeExcelFilterDropdown();
            updateCSVModalPreview();
        };
    }

    if (csvTableOnlyMatchedCheck) {
        csvTableOnlyMatchedCheck.onchange = () => {
            renderCSVDataTable();
        };
    }

    if (csvConfirmBtn) {
        csvConfirmBtn.onclick = () => {
            const selectedCol = parseInt(csvColumnSelect?.value) || 0;
            if (!pendingCsvRows || pendingCsvRows.length === 0) return;

            const hasHeader = csvHasHeaderCheck ? csvHasHeaderCheck.checked : true;
            const startRow = hasHeader ? 1 : 0;
            const isFiltered = excelColumnFilters.size > 0;

            const extractedTextLines = [];
            let totalDataRows = 0;
            let matchedRows = 0;

            const rowIndices = [];
            for (let r = startRow; r < pendingCsvRows.length; r++) {
                totalDataRows++;
                if (rowMatchesExcelFilters(pendingCsvRows[r], excelColumnFilters)) {
                    matchedRows++;
                    rowIndices.push(r);
                }
            }

            // テーブルで列ソートが適用されている場合は、そのソート順（自然順）に従って抽出
            if (csvTableSortCol !== null) {
                rowIndices.sort((idxA, idxB) => {
                    const rawA = pendingCsvRows[idxA] ? pendingCsvRows[idxA][csvTableSortCol] : '';
                    const rawB = pendingCsvRows[idxB] ? pendingCsvRows[idxB][csvTableSortCol] : '';
                    const cmp = compareCSVValues(String(rawA || '').trim(), String(rawB || '').trim());
                    return csvTableSortAsc ? cmp : -cmp;
                });
            }

            for (let i = 0; i < rowIndices.length; i++) {
                const r = rowIndices[i];
                const rawCell = pendingCsvRows[r] ? pendingCsvRows[r][selectedCol] : '';
                const val = (rawCell !== undefined && rawCell !== null) ? String(rawCell).trim() : '';
                if (val.length > 0) extractedTextLines.push(val);
            }

            if (extractedTextLines.length === 0) {
                alert("指定した条件に見合う行に、有効なテキストデータが見つかりませんでした。別のフィルタ条件や列をお試しください。");
                return;
            }

            closeModal();

            if (fileInfo) {
                if (isFiltered) {
                    fileInfo.innerText = `${pendingCsvFileName || 'CSVファイル'} [オートフィルタ: ${matchedRows.toLocaleString()}/${totalDataRows.toLocaleString()}行]`;
                } else {
                    fileInfo.innerText = `${pendingCsvFileName || 'CSVファイル'} [全${totalDataRows.toLocaleString()}行]`;
                }
            }

            if (openCsvViewerBtn) {
                openCsvViewerBtn.style.display = 'inline-flex';
            }

            loadTextAndTokenize(extractedTextLines.join('\n'));
        };
    }
}

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

        // Check if file is a rules/dictionary file
        if (isRulesFileContent(text)) {
            const shouldImportRules = confirm(
                `読み込まれたファイル「${file.name}」には、辞書・ルールのセクション見出し（# [複合語] など）が含まれています。\n\n` +
                `【OK】: 設定ファイルとして読み込み（辞書・除外・表記ゆれに適用）\n` +
                `【キャンセル】: 通常の分析対象テキストとして読み込み`
            );
            if (shouldImportRules) {
                openRulesImportProcess(text, file.name);
                return;
            }
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
    if (displayType.value === 'network' || displayType.value === 'pca' || displayType.value === 'umap') {
        if (rawTextData) processAndRender();
    } else {
        updateWordCloud();
    }
});

maxWordsRange.addEventListener('input', (e) => {
    maxWordsVal.innerText = e.target.value;
    if (displayType.value === 'network' || displayType.value === 'pca' || displayType.value === 'umap') {
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

if (networkFontSizeRange) {
    networkFontSizeRange.addEventListener('input', (e) => {
        if (networkFontSizeVal) networkFontSizeVal.innerText = `${e.target.value}px`;
        if (['network', 'pca', 'umap'].includes(displayType.value) && rawTextData) {
            updateWordCloud();
        }
    });
}

// Plus / Minus Step Buttons for Sliders (Click and Long-press support)
function initSliderStepButtons() {
    const stepButtons = document.querySelectorAll('.slider-step-btn');
    if (stepButtons.length === 0) return;

    stepButtons.forEach(btn => {
        const sliderId = btn.getAttribute('data-slider-id');
        const dir = parseFloat(btn.getAttribute('data-step-dir') || '1');
        const slider = document.getElementById(sliderId);
        if (!slider) return;

        function stepSlider() {
            const min = slider.min !== '' ? parseFloat(slider.min) : 0;
            const max = slider.max !== '' ? parseFloat(slider.max) : 100;
            const step = slider.step && slider.step !== 'any' ? parseFloat(slider.step) : 1;
            let current = parseFloat(slider.value);
            if (isNaN(current)) current = min;

            const stepDecimals = (step.toString().split('.')[1] || '').length;
            let nextVal = current + dir * step;
            nextVal = Math.min(max, Math.max(min, nextVal));
            nextVal = parseFloat(nextVal.toFixed(stepDecimals));

            if (nextVal !== current) {
                slider.value = nextVal;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                slider.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        let pressTimer = null;
        let repeatInterval = null;

        function startPress(e) {
            if (e.button !== undefined && e.button !== 0) return; // Only primary mouse button
            e.preventDefault();
            stepSlider();

            clearTimeout(pressTimer);
            clearInterval(repeatInterval);

            // Start repeating after 320ms hold, step every 60ms
            pressTimer = setTimeout(() => {
                repeatInterval = setInterval(() => {
                    stepSlider();
                }, 60);
            }, 320);
        }

        function endPress() {
            clearTimeout(pressTimer);
            clearInterval(repeatInterval);
            pressTimer = null;
            repeatInterval = null;
        }

        btn.addEventListener('mousedown', startPress);
        btn.addEventListener('mouseup', endPress);
        btn.addEventListener('mouseleave', endPress);

        btn.addEventListener('touchstart', startPress, { passive: false });
        btn.addEventListener('touchend', endPress);
        btn.addEventListener('touchcancel', endPress);
    });
}

initSliderStepButtons();

// Render triggers for filters
[posNoun, posVerb, posAdj, posAdv, mergeNounsCheckbox, document.getElementById('ranking-method'), networkMinEdgeCheck].forEach(elem => {
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

function syncClusterUIForActiveView() {
    if (!clusterCount) return;
    const mode = displayType ? displayType.value : '';
    let optimalK = 3;
    let currentK = 3;

    if (mode === 'pca') {
        optimalK = pcaOptimalK || 3;
        currentK = (pcaUserManual && pcaUserK) ? pcaUserK : optimalK;
    } else if (mode === 'umap') {
        optimalK = umapOptimalK || 3;
        currentK = (umapUserManual && umapUserK) ? umapUserK : optimalK;
    }

    clusterCount.value = currentK;
    if (clusterAutoBadge) {
        clusterAutoBadge.textContent = `自動推奨: ${optimalK}`;
        clusterAutoBadge.title = `${mode.toUpperCase()}のデータ分布形状（シルエット値・分散比等）から自動算出した初期推奨値です`;
    }
}

function updateClusterCountGroupVisibility() {
    if (displayType && (displayType.value === 'pca' || displayType.value === 'umap')) {
        if (clusterCountGroup) clusterCountGroup.style.display = 'block';
        syncClusterUIForActiveView();
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
        if (networkOptionsGroup) networkOptionsGroup.style.display = 'block';
    } else {
        if (networkThresholdGroup) networkThresholdGroup.style.display = 'none';
        if (networkOptionsGroup) networkOptionsGroup.style.display = 'none';
    }

    if (diagramLabelSizeGroup) {
        if (displayType && ['network', 'pca', 'umap'].includes(displayType.value)) {
            diagramLabelSizeGroup.style.display = 'block';
        } else {
            diagramLabelSizeGroup.style.display = 'none';
        }
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
        } else if (type === 'umap') {
            descHtml = `
            <div class="method-title"><span class="method-icon">🌌</span>非線形次元削減（UMAP散布図）</div>
            <div class="method-purpose">高次元の共起関係を非線形に圧縮し、類似した文脈の単語をギュッと集め、異なるテーマのまとまり（クラスター）を綺麗に分離して可視化します。</div>
            <div class="reading-tips">
                <div class="tips-title">📌 読み方のポイント</div>
                <ul class="tips-list">
                    <li><strong>ぎゅっと集まった塊</strong> = 非常に強く結びついた具体的なテーマ（文脈のまとまり）</li>
                    <li><strong>PCAとの違い</strong> = PCAが大まかな全体方向（分散）を見るのに対し、UMAPは「局所的な近さ」をより強力に強調し、クラスタ間の隙間を明確にします</li>
                    <li><strong>同じ色の塊</strong> = K平均法で自動分類されたクラスター（K=2〜8）</li>
                    <li><strong>単語をクリック</strong>するとKWIC（実際の用例）を確認できます</li>
                </ul>
                <div class="tips-note">💡 「クラスター数」を変更するとグループ分けを調整できます。「再計算」ボタンで配置の微調整も可能です。</div>
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
        } else if (type === 'collocation') {
            descHtml = `
            <div class="method-title"><span class="method-icon">🔗</span>コロケーション (N-gram連語分析)</div>
            <div class="method-purpose">テキスト内で連続して使われる単語の組み合わせ（連語・定型フレーズ）を抽出し、具体的な表現や言及パターンを分析します。</div>
            <div class="reading-tips">
                <div class="tips-title">📌 読み方のポイント</div>
                <ul class="tips-list">
                    <li><strong>2-gram / 3-gram / 4-gram</strong> = 連続する語数（2連語・3連語・4連語）を切り替えられます</li>
                    <li><strong>出現回数バー</strong> = その連語が使われた頻度（長いほど定型表現として多用されている）</li>
                    <li><strong>Jaccard係数</strong> = 2語の結びつきの強さ（単なる頻出語同士の偶然の隣接でなく、セットで使われやすい関係）</li>
                    <li><strong>「用例(KWIC)」ボタン</strong> = 実際の文中でその連語がどのように使われているか文脈を確認できます</li>
                </ul>
                <div class="tips-note">💡 単語単体の分析（ワードクラウド）では見えない、「具体的な言い回し」や「課題の詳細」を発見するのに最適です。</div>
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

function updateClusterAssignments(k, targetMode = null) {
    if ((!targetMode || targetMode === 'pca') && rawPcaPoints && rawPcaPoints.length > 0) {
        const assignments = runKMeans(rawPcaPoints, k);
        pcaPoints = rawPcaPoints.map((pt, i) => ({ ...pt, cluster: assignments[i] }));
    }
    if ((!targetMode || targetMode === 'umap') && rawUmapPoints && rawUmapPoints.length > 0) {
        const assignments = runKMeans(rawUmapPoints, k);
        umapPoints = rawUmapPoints.map((pt, i) => ({ ...pt, cluster: assignments[i] }));
    }
}

function handleClusterCountChange() {
    if (!clusterCount || !rawTextData) return;
    const newK = Math.max(2, Math.min(8, parseInt(clusterCount.value) || 3));
    clusterCount.value = newK;

    const mode = displayType ? displayType.value : '';
    if (mode === 'pca') {
        pcaUserK = newK;
        pcaUserManual = true;
        updateClusterAssignments(newK, 'pca');
    } else if (mode === 'umap') {
        umapUserK = newK;
        umapUserManual = true;
        updateClusterAssignments(newK, 'umap');
    } else {
        updateClusterAssignments(newK);
    }
    updateWordCloud();
}

// clusterCount slider: only re-draw (no full NLP re-parse)
if (clusterCount) {
    clusterCount.addEventListener('change', handleClusterCountChange);
    clusterCount.addEventListener('input', handleClusterCountChange);
}

if (btnClusterReset) {
    btnClusterReset.addEventListener('click', () => {
        const mode = displayType ? displayType.value : '';
        if (mode === 'pca') {
            pcaUserManual = false;
            pcaUserK = pcaOptimalK;
            clusterCount.value = pcaOptimalK;
            updateClusterAssignments(pcaOptimalK, 'pca');
        } else if (mode === 'umap') {
            umapUserManual = false;
            umapUserK = umapOptimalK;
            clusterCount.value = umapOptimalK;
            updateClusterAssignments(umapOptimalK, 'umap');
        }
        updateWordCloud();
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
            const connText = connections 
                ? `<br>主な共起語: ${connections}` 
                : `<br><span style="color: #F59E0B; font-weight: 500;">(共起関係のない孤立語)</span>`;
            tooltip.innerHTML = `<strong>${hoveredNode.id}</strong><br>出現回数: ${hoveredNode.count}回<br>グループ: ${hoveredNode.communityLabel}${ldaTopicText}${connText}<br><small style="color: var(--text-muted)">ダブルクリックで除外</small>`;
            cloudCanvas.style.cursor = 'pointer';
        } else {
            tooltip.style.display = 'none';
            cloudCanvas.style.cursor = 'default';
        }
    } else if (currentMode === 'pca' || currentMode === 'umap') {
        const currentPoints = currentMode === 'umap' ? umapPoints : pcaPoints;
        if (currentPoints.length === 0) return;
        
        const xs = currentPoints.map(p => p.x);
        const ys = currentPoints.map(p => p.y);
        const minX = Math.min(...xs, -0.01);
        const maxX = Math.max(...xs, 0.01);
        const minY = Math.min(...ys, -0.01);
        const maxY = Math.max(...ys, 0.01);
        
        const pad = 100 * (cloudCanvas.width / 1024);
        
        const getCanvasX = (x) => pad + ((x - minX) / (maxX - minX)) * (cloudCanvas.width - 2 * pad);
        const getCanvasY = (y) => pad + ((maxY - y) / (maxY - minY)) * (cloudCanvas.height - 2 * pad);

        // Cache min/max counts once outside the loop for performance
        const currentCounts = currentPoints.map(p => p.count);
        const currentMinCount = Math.min(...currentCounts);
        const currentMaxCount = Math.max(...currentCounts);

        let hoveredPoint = null;
        for (let i = currentPoints.length - 1; i >= 0; i--) {
            let pt = currentPoints[i];
            const px = getCanvasX(pt.x);
            const py = getCanvasY(pt.y);
            const dx = mouseX - px;
            const dy = mouseY - py;
            
            let radius = 10;
            if (currentMaxCount !== currentMinCount) {
                radius = 5 + ((pt.count - currentMinCount) / (currentMaxCount - currentMinCount)) * 14;
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
    } else if (currentMode === 'pca' || currentMode === 'umap') {
        const currentPoints = currentMode === 'umap' ? umapPoints : pcaPoints;
        if (currentPoints.length === 0) return;
        
        const xs = currentPoints.map(p => p.x);
        const ys = currentPoints.map(p => p.y);
        const minX = Math.min(...xs, -0.01);
        const maxX = Math.max(...xs, 0.01);
        const minY = Math.min(...ys, -0.01);
        const maxY = Math.max(...ys, 0.01);
        
        const pad = 100 * (cloudCanvas.width / 1024);
        const getCanvasX = (x) => pad + ((x - minX) / (maxX - minX)) * (cloudCanvas.width - 2 * pad);
        const getCanvasY = (y) => pad + ((maxY - y) / (maxY - minY)) * (cloudCanvas.height - 2 * pad);

        const currentClickCounts = currentPoints.map(p => p.count);
        const currentClickMinCount = Math.min(...currentClickCounts);
        const currentClickMaxCount = Math.max(...currentClickCounts);

        for (let i = currentPoints.length - 1; i >= 0; i--) {
            let pt = currentPoints[i];
            const px = getCanvasX(pt.x);
            const py = getCanvasY(pt.y);
            const dx = mouseX - px;
            const dy = mouseY - py;
            
            let radius = 10;
            if (currentClickMaxCount !== currentClickMinCount) {
                radius = 5 + ((pt.count - currentClickMinCount) / (currentClickMaxCount - currentClickMinCount)) * 14;
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
    } else if (currentMode === 'pca' || currentMode === 'umap') {
        const currentPoints = currentMode === 'umap' ? umapPoints : pcaPoints;
        if (currentPoints.length === 0) return;
        
        const xs = currentPoints.map(p => p.x);
        const ys = currentPoints.map(p => p.y);
        const minX = Math.min(...xs, -0.01);
        const maxX = Math.max(...xs, 0.01);
        const minY = Math.min(...ys, -0.01);
        const maxY = Math.max(...ys, 0.01);
        
        const pad = 100 * (cloudCanvas.width / 1024);
        
        const getCanvasX = (x) => pad + ((x - minX) / (maxX - minX)) * (cloudCanvas.width - 2 * pad);
        const getCanvasY = (y) => pad + ((maxY - y) / (maxY - minY)) * (cloudCanvas.height - 2 * pad);

        // Cache min/max counts once outside the loop for performance
        const currentDblCounts = currentPoints.map(p => p.count);
        const currentDblMinCount = Math.min(...currentDblCounts);
        const currentDblMaxCount = Math.max(...currentDblCounts);

        for (let i = currentPoints.length - 1; i >= 0; i--) {
            let pt = currentPoints[i];
            const px = getCanvasX(pt.x);
            const py = getCanvasY(pt.y);
            const dx = mouseX - px;
            const dy = mouseY - py;
            
            let radius = 10;
            if (currentDblMaxCount !== currentDblMinCount) {
                radius = 5 + ((pt.count - currentDblMinCount) / (currentDblMaxCount - currentDblMinCount)) * 14;
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
function runKMeans(points, k, nRuns = 5, returnDetails = false) {
    const n = points.length;
    if (n <= k) {
        const assign = points.map((_, i) => i);
        if (returnDetails) {
            return {
                assignments: assign,
                inertia: 0,
                centroids: points.map(p => ({ x: p.x, y: p.y }))
            };
        }
        return assign;
    }

    let bestAssignments = null;
    let bestCentroids = null;
    let bestInertia = Infinity;

    for (let run = 0; run < nRuns; run++) {
        // --- K-means++ Initialization ---
        const centroids = [];
        // 1. Pick first centroid uniformly at random
        const firstIdx = Math.floor(Math.random() * n);
        centroids.push({ x: points[firstIdx].x, y: points[firstIdx].y });

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
            bestCentroids = centroids.map(c => ({ x: c.x, y: c.y }));
        }
    }

    if (returnDetails) {
        return {
            assignments: bestAssignments,
            inertia: bestInertia,
            centroids: bestCentroids
        };
    }
    return bestAssignments;
}

// Automatic 2D Cluster Count Optimizer (PCA & UMAP)
// Uses multi-criteria consensus: Silhouette analysis, Calinski-Harabasz index, and Davies-Bouldin index.
function findOptimal2DClusterK(points, minK = 2, maxK = 6) {
    const n = points.length;
    if (n < 4) {
        const fallbackK = Math.max(2, Math.min(n, minK));
        return {
            optimalK: fallbackK,
            assignments: points.map((_, i) => i % fallbackK),
            details: {}
        };
    }

    const upperK = Math.min(maxK, Math.max(minK, Math.min(6, n - 1)));
    const testedK = [];
    for (let k = minK; k <= upperK; k++) testedK.push(k);

    // Precompute pairwise 2D Euclidean distances
    const distMatrix = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dx = points[i].x - points[j].x;
            const dy = points[i].y - points[j].y;
            const d = Math.hypot(dx, dy);
            distMatrix[i * n + j] = d;
            distMatrix[j * n + i] = d;
        }
    }

    const results = {};
    let bestSilK = minK, maxSil = -Infinity;
    let bestChK = minK, maxCh = -Infinity;
    let bestDbK = minK, minDb = Infinity;

    for (const k of testedK) {
        const km = runKMeans(points, k, 5, true);
        const assignments = km.assignments;
        const centroids = km.centroids;
        const inertia = km.inertia;

        // 1. Silhouette score
        const clusterSizes = new Int32Array(k);
        for (let i = 0; i < n; i++) clusterSizes[assignments[i]]++;

        let silSum = 0;
        let silCount = 0;
        for (let i = 0; i < n; i++) {
            const ci = assignments[i];
            if (clusterSizes[ci] <= 1) continue;

            const distsToClusters = new Float64Array(k);
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                distsToClusters[assignments[j]] += distMatrix[i * n + j];
            }

            const ai = distsToClusters[ci] / (clusterSizes[ci] - 1);
            let bi = Infinity;
            for (let c = 0; c < k; c++) {
                if (c === ci || clusterSizes[c] === 0) continue;
                const meanDist = distsToClusters[c] / clusterSizes[c];
                if (meanDist < bi) bi = meanDist;
            }

            if (bi !== Infinity) {
                const maxDist = Math.max(ai, bi);
                silSum += maxDist === 0 ? 0 : (bi - ai) / maxDist;
                silCount++;
            }
        }
        const silScore = silCount > 0 ? silSum / silCount : 0;

        // 2. Calinski-Harabasz Index
        let overallX = 0, overallY = 0;
        for (let i = 0; i < n; i++) {
            overallX += points[i].x;
            overallY += points[i].y;
        }
        overallX /= n;
        overallY /= n;

        let ssb = 0;
        for (let c = 0; c < k; c++) {
            if (clusterSizes[c] > 0) {
                const dx = centroids[c].x - overallX;
                const dy = centroids[c].y - overallY;
                ssb += clusterSizes[c] * (dx * dx + dy * dy);
            }
        }
        const ssw = Math.max(1e-10, inertia);
        const chScore = (ssb / (k - 1)) / (ssw / (n - k));

        // 3. Davies-Bouldin Index
        const dispersions = new Float64Array(k);
        for (let i = 0; i < n; i++) {
            const c = assignments[i];
            const dx = points[i].x - centroids[c].x;
            const dy = points[i].y - centroids[c].y;
            dispersions[c] += Math.hypot(dx, dy);
        }
        for (let c = 0; c < k; c++) {
            if (clusterSizes[c] > 0) dispersions[c] /= clusterSizes[c];
        }

        let dbSum = 0;
        let activeClusters = 0;
        for (let i = 0; i < k; i++) {
            if (clusterSizes[i] === 0) continue;
            let maxR = -Infinity;
            for (let j = 0; j < k; j++) {
                if (i === j || clusterSizes[j] === 0) continue;
                const dx = centroids[i].x - centroids[j].x;
                const dy = centroids[i].y - centroids[j].y;
                const dist = Math.hypot(dx, dy);
                if (dist > 1e-10) {
                    const r = (dispersions[i] + dispersions[j]) / dist;
                    if (r > maxR) maxR = r;
                }
            }
            if (maxR !== -Infinity) {
                dbSum += maxR;
                activeClusters++;
            }
        }
        const dbScore = activeClusters > 0 ? dbSum / activeClusters : Infinity;

        results[k] = { k, sil: silScore, ch: chScore, db: dbScore, inertia, assignments };

        if (silScore > maxSil) { maxSil = silScore; bestSilK = k; }
        if (chScore > maxCh) { maxCh = chScore; bestChK = k; }
        if (dbScore < minDb) { minDb = dbScore; bestDbK = k; }
    }

    // Voting among Silhouette, Calinski-Harabasz, and Davies-Bouldin
    const votes = {};
    [bestSilK, bestChK, bestDbK].forEach(k => {
        votes[k] = (votes[k] || 0) + 1;
    });

    let bestK = minK;
    let maxVotes = 0;
    for (const [kStr, count] of Object.entries(votes)) {
        const k = parseInt(kStr);
        if (count > maxVotes) {
            maxVotes = count;
            bestK = k;
        } else if (count === maxVotes) {
            if (k === bestSilK) bestK = k; // Tie-break with Silhouette
        }
    }

    return {
        optimalK: bestK,
        assignments: results[bestK].assignments,
        details: { bestSilK, bestChK, bestDbK, results }
    };
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

// --- CSV & Image Export Dropdown Toggle & Close Logic ---
function closeCsvDropdown() {
    if (exportCsvMenu) exportCsvMenu.style.display = 'none';
    if (exportCsvChevron) exportCsvChevron.style.transform = 'rotate(0deg)';
}

function toggleCsvDropdown(e) {
    if (e) e.stopPropagation();
    if (!exportCsvMenu || (exportCsvDropdownBtn && exportCsvDropdownBtn.disabled)) return;
    closeImageDropdown();
    const isShowing = exportCsvMenu.style.display === 'block';
    if (isShowing) {
        closeCsvDropdown();
    } else {
        exportCsvMenu.style.display = 'block';
        if (exportCsvChevron) exportCsvChevron.style.transform = 'rotate(180deg)';
    }
}

if (exportCsvDropdownBtn) {
    exportCsvDropdownBtn.addEventListener('click', toggleCsvDropdown);
}

function closeImageDropdown() {
    if (downloadSizeMenu) downloadSizeMenu.style.display = 'none';
    if (downloadChevron) downloadChevron.style.transform = 'rotate(0deg)';
}

function toggleImageDropdown(e) {
    if (e) e.stopPropagation();
    if (!downloadSizeMenu || (downloadBtn && downloadBtn.disabled)) return;
    closeCsvDropdown();
    const isShowing = downloadSizeMenu.style.display === 'block';
    if (isShowing) {
        closeImageDropdown();
    } else {
        downloadSizeMenu.style.display = 'block';
        if (downloadChevron) downloadChevron.style.transform = 'rotate(180deg)';
    }
}

if (downloadBtn) {
    downloadBtn.addEventListener('click', toggleImageDropdown);
}

document.addEventListener('click', (e) => {
    if (exportCsvMenu && exportCsvMenu.style.display === 'block') {
        const wrapper = document.querySelector('.csv-dropdown-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            closeCsvDropdown();
        }
    }
    if (downloadSizeMenu && downloadSizeMenu.style.display === 'block') {
        const wrapper = document.querySelector('.image-dropdown-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            closeImageDropdown();
        }
    }
});

// Instantly download words list using cached counts (fixed POS filter bug)
if (exportWordsCsvBtn) {
    exportWordsCsvBtn.addEventListener('click', () => {
        closeCsvDropdown();
        if (wordFrequencies.length === 0) return;
        
        const isUmapMode = displayType && displayType.value === 'umap';
        const activePoints = isUmapMode ? umapPoints : pcaPoints;

        let csv = "単語,出現回数,特徴度 (TF-IDF),クラスターID\n";
        wordFrequencies.forEach(item => {
            const pt = activePoints.find(p => p.word === item.text);
            const clusterId = (pt && pt.cluster !== undefined && pt.cluster >= 0) ? `C${pt.cluster + 1}` : "-";
            const escapedWord = item.text.includes('"') ? item.text.replace(/"/g, '""') : item.text;
            csv += `"${escapedWord}",${item.count},${item.tfidf.toFixed(4)},${clusterId}\n`;
        });
        
        downloadCSV("word_frequency_metrics.csv", csv);
    });
}

// Instantly download co-occurrence pairs matching user checkboxes (no redundant tokenizing)
if (exportPairsCsvBtn) {
    exportPairsCsvBtn.addEventListener('click', () => {
        closeCsvDropdown();
        if (wordFrequencies.length === 0) return;
        
        let csv = "単語A,単語B,共起回数,共起の強さ (Jaccard係数)\n";
        const pairs = [];
        
        Object.entries(currentAnalysisCoocCounts).forEach(([key, fAB]) => {
            const [w1, w2] = key.split('|||');
            // Use document frequency (not raw count) for correct Jaccard denominator
            const cA = Math.max(currentAnalysisDocFreq[w1] || 0, fAB);
            const cB = Math.max(currentAnalysisDocFreq[w2] || 0, fAB);
            const denom = cA + cB - fAB;
            const jaccard = denom > 0 ? Math.max(0, Math.min(1.0, fAB / denom)) : 0;
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
}

// Instantly download N-gram collocation list
if (exportNgramCsvBtn) {
    exportNgramCsvBtn.addEventListener('click', () => {
        closeCsvDropdown();
        if (!wordFrequencies || wordFrequencies.length === 0) return;
        const list = getFilteredAndSortedNgrams();
        if (!list || list.length === 0) {
            alert("エクスポート可能なコロケーションデータがありません。");
            return;
        }

        let wordsHeader = '';
        for (let i = 1; i <= currentNgramN; i++) {
            wordsHeader += `構成単語${i},`;
        }

        let csv = `順位,コロケーション,${wordsHeader}出現回数,文書数 (DF),Jaccard係数\n`;
        list.forEach((item, idx) => {
            const rank = idx + 1;
            const escapedPhrase = item.phrase.replace(/"/g, '""');
            let wordsCols = '';
            for (let i = 0; i < currentNgramN; i++) {
                const w = item.words[i] || '';
                wordsCols += `"${w.replace(/"/g, '""')}",`;
            }
            csv += `${rank},"${escapedPhrase}",${wordsCols}${item.count},${item.docCount},${item.jaccard > 0 ? item.jaccard.toFixed(4) : '-'}\n`;
        });

        downloadCSV(`collocation_${currentNgramN}gram_metrics.csv`, csv);
    });
}

// Download all 3 CSVs sequentially
if (exportAllCsvBtn) {
    exportAllCsvBtn.addEventListener('click', () => {
        if (!wordFrequencies || wordFrequencies.length === 0) return;
        closeCsvDropdown();
        if (exportWordsCsvBtn) exportWordsCsvBtn.click();
        setTimeout(() => {
            if (exportPairsCsvBtn) exportPairsCsvBtn.click();
        }, 250);
        setTimeout(() => {
            if (exportNgramCsvBtn) exportNgramCsvBtn.click();
        }, 500);
    });
}

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
    
    const isPunctuationOrSymbol = (str) => {
        return /^[\p{P}\p{S}\s]+$/u.test(str);
    };

    const isNounForMerge = (t) => {
        if (!t) return false;
        // Don't merge over user-defined compound words or synonym replaced words (act as boundaries)
        if (t.pos_detail_1 === '複合語' || t.pos_detail_1 === '同義語') return false;
        
        // Punctuation, symbols, slashes, or brackets must NOT be merged as part of a compound noun
        if (isPunctuationOrSymbol(t.surface_form) || /[()（）/／\\|~^・]/.test(t.surface_form)) {
            return false;
        }

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
    const tokenDocFreq = {};
    const coocCounts = {};
    const uniqueWordsPerLine = [];
    const lineWordsList = [];
    const tokenWordsList = [];

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

            // Strip leading / trailing brackets, slashes, quotes, and symbols if attached
            word = word.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '').trim();
            if (!word) return;

            if (word.length === 1 && /^[ぁ-んァ-ヶ]$/.test(word)) return;
            // Exclude tokens consisting purely of punctuation, symbols, whitespace, or numbers
            if (/^[\p{P}\p{S}\s0-9０-９]+$/u.test(word)) return;
            // Stopword check (exact + lower-case + NFKC normalization)
            if (isStopWord(word)) return;

            counts[word] = (counts[word] || 0) + 1;
            uniqueWordsInLine.add(word);
            lineWords.push(word);
        });

        uniqueWordsPerLine.push(uniqueWordsInLine);
        lineWordsList.push(lineWords);

        const lineTokens = tokens
            .map(t => {
                const p = t.pos;
                let w = (p === '動詞' || p === '形容詞' || p === '副詞') && t.basic_form !== '*' ? t.basic_form : t.surface_form;
                return w.trim().replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '').trim();
            })
            .filter(w => w && !/^[\p{P}\p{S}\s]+$/u.test(w) && !isStopWord(w));
        tokenWordsList.push(lineTokens);

        const uniqueTokensInLine = new Set(lineTokens);
        uniqueTokensInLine.forEach(w => {
            tokenDocFreq[w] = (tokenDocFreq[w] || 0) + 1;
        });

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
    currentAnalysisTokenDocFreq = tokenDocFreq; // Needed for correct N-gram Jaccard
    currentAnalysisLineWordsList = lineWordsList;
    currentAnalysisTokenWordsList = tokenWordsList;

    const rankingMethod = document.getElementById('ranking-method').value;

    wordFrequencies = Object.entries(counts)
        .map(([text, count]) => {
            const df = docFreq[text] || 1;
            const idf = Math.log(opinionLinesCount / df) + 1;
            const tfidf = count * idf;
            return { text, count, tfidf };
        });

    if (rankingMethod === 'tfidf') {
        wordFrequencies.sort((a, b) => {
            if (b.tfidf !== a.tfidf) return b.tfidf - a.tfidf; // 1. TF-IDF値
            if (b.count !== a.count) return b.count - a.count; // 2. 出現回数（同点の場合）
            return a.text.localeCompare(b.text, 'ja');         // 3. 五十音順（それでも同点の場合）
        });
    } else {
        wordFrequencies.sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count; // 1. 出現回数
            if (b.tfidf !== a.tfidf) return b.tfidf - a.tfidf; // 2. TF-IDF値（同点で特徴的な単語を優先）
            return a.text.localeCompare(b.text, 'ja');         // 3. 五十音順
        });
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

    const finalThreshold = networkThresholdRange ? parseFloat(networkThresholdRange.value) : 0.05;
    const rawEdges = [];
    Object.entries(coocCounts).forEach(([key, fAB]) => {
        const [w1, w2] = key.split('|||');
        
        // Only consider edges between the frequent words
        if (!allowedWordsSet.has(w1) || !allowedWordsSet.has(w2)) return;

        // BUG FIX: use document frequency (how many lines contain the word),
        // not total occurrence count, for a mathematically correct Jaccard coefficient.
        const cA = Math.max(docFreq[w1] || 0, fAB);
        const cB = Math.max(docFreq[w2] || 0, fAB);
        const denom = cA + cB - fAB;
        const jaccard = denom > 0 ? Math.max(0, Math.min(1.0, fAB / denom)) : 0;
        
        if (jaccard >= finalThreshold) {
            rawEdges.push({ sourceId: w1, targetId: w2, weight: jaccard });
        }
    });
    
    rawEdges.sort((a, b) => b.weight - a.weight);
    
    // Limit to exactly 1.0 * maxWords to naturally separate the graph into disjoint communities
    const topEdges = rawEdges.slice(0, Math.round(maxWords * 1.0));

    // [Proposal 1: 最低1本エッジ保証（救済リンク）]
    const ensureMinEdge = networkMinEdgeCheck ? networkMinEdgeCheck.checked : true;
    const connectedWordIds = new Set();
    topEdges.forEach(e => {
        connectedWordIds.add(e.sourceId);
        connectedWordIds.add(e.targetId);
    });

    if (ensureMinEdge) {
        filteredList.forEach(item => {
            const w = item.text;
            if (!connectedWordIds.has(w)) {
                // Find strongest co-occurring partner among allowed frequent words
                let bestPartner = null;
                let bestJaccard = -1;
                let bestCooc = 0;

                filteredList.forEach(otherItem => {
                    const otherW = otherItem.text;
                    if (w === otherW) return;
                    const key1 = `${w}|||${otherW}`;
                    const key2 = `${otherW}|||${w}`;
                    const fAB = coocCounts[key1] || coocCounts[key2] || 0;
                    if (fAB > 0) {
                        const cA = Math.max(docFreq[w] || 0, fAB);
                        const cB = Math.max(docFreq[otherW] || 0, fAB);
                        const denom = cA + cB - fAB;
                        const jaccard = denom > 0 ? fAB / denom : 0;
                        if (jaccard > bestJaccard || (jaccard === bestJaccard && fAB > bestCooc)) {
                            bestJaccard = jaccard;
                            bestCooc = fAB;
                            bestPartner = otherW;
                        }
                    }
                });

                if (bestPartner && bestJaccard > 0) {
                    topEdges.push({
                        sourceId: w,
                        targetId: bestPartner,
                        weight: Math.max(0.01, bestJaccard),
                        isRescueEdge: true
                    });
                    connectedWordIds.add(w);
                    connectedWordIds.add(bestPartner);
                }
            }
        });
    }

    const networkNodesSet = new Set();
    topEdges.forEach(e => {
        if (networkNodesSet.size < maxWords) networkNodesSet.add(e.sourceId);
        if (networkNodesSet.size < maxWords) networkNodesSet.add(e.targetId);
    });

    networkExcludedWords = filteredList.filter(item => !networkNodesSet.has(item.text));

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
            return {
                source: srcNode,
                target: tgtNode,
                weight: e.weight,
                isRescueEdge: !!e.isRescueEdge
            };
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
        
        rawPcaPoints = rawPoints;
        const pcaOpt = findOptimal2DClusterK(rawPoints, 2, 6);
        pcaOptimalK = pcaOpt.optimalK;
        const activePcaK = (pcaUserManual && pcaUserK) ? pcaUserK : pcaOptimalK;
        pcaUserK = activePcaK;
        
        if (activePcaK === pcaOptimalK && pcaOpt.assignments) {
            pcaPoints = rawPoints.map((pt, i) => ({ ...pt, cluster: pcaOpt.assignments[i] }));
        } else {
            const assignments = runKMeans(rawPoints, activePcaK);
            pcaPoints = rawPoints.map((pt, i) => ({ ...pt, cluster: assignments[i] }));
        }

        // --- UMAP ANALYSIS & K-MEANS CLUSTERING ---
        runUMAPAnalysis(pcaWords, coocCounts, docFreq, uniqueWordsPerLine, counts, rawPoints);
        syncClusterUIForActiveView();
    } else {
        rawPcaPoints = [];
        pcaPoints = [];
        rawUmapPoints = [];
        umapPoints = [];
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

// ==========================================
// Collocation (N-gram) Analysis Engine
// ==========================================

function extractNgrams(n = 2, target = 'keywords', minCount = 1) {
    const sourceLines = target === 'keywords' ? currentAnalysisLineWordsList : currentAnalysisTokenWordsList;
    if (!sourceLines || sourceLines.length === 0) return [];

    const ngramCounts = {};
    const ngramDocFreq = {};

    sourceLines.forEach(words => {
        if (!words || words.length < n) return;
        const seenInDoc = new Set();

        for (let i = 0; i <= words.length - n; i++) {
            const gram = words.slice(i, i + n);
            const key = gram.join(' ');

            ngramCounts[key] = (ngramCounts[key] || 0) + 1;
            if (!seenInDoc.has(key)) {
                ngramDocFreq[key] = (ngramDocFreq[key] || 0) + 1;
                seenInDoc.add(key);
            }
        }
    });

    const list = Object.entries(ngramCounts)
        .filter(([key, count]) => count >= minCount)
        .map(([key, count]) => {
            const words = key.split(' ');
            const docCount = ngramDocFreq[key] || 1;
            let jaccard = 0;

            if (n === 2) {
                const [w1, w2] = words;
                const docFreqSource = target === 'keywords' ? currentAnalysisDocFreq : currentAnalysisTokenDocFreq;
                if (docFreqSource) {
                    const cA = Math.max(docFreqSource[w1] || 0, docCount);
                    const cB = Math.max(docFreqSource[w2] || 0, docCount);
                    const denom = cA + cB - docCount;
                    jaccard = denom > 0 ? Math.max(0, Math.min(1.0, docCount / denom)) : 0;
                }
            }

            return {
                phrase: key,
                words,
                count,
                docCount,
                jaccard
            };
        });

    return list;
}

function getFilteredAndSortedNgrams() {
    const minCount = parseInt(minCountRange?.value || 1);
    
    let list = extractNgrams(currentNgramN, currentNgramTarget, minCount);

    if (currentNgramSearch && currentNgramSearch.trim() !== '') {
        const query = currentNgramSearch.trim().toLowerCase();
        list = list.filter(item => item.phrase.toLowerCase().includes(query));
    }

    if (currentNgramSort === 'count') {
        list.sort((a, b) => b.count - a.count || b.docCount - a.docCount || a.phrase.localeCompare(b.phrase, 'ja'));
    } else if (currentNgramSort === 'doc') {
        list.sort((a, b) => b.docCount - a.docCount || b.count - a.count || a.phrase.localeCompare(b.phrase, 'ja'));
    } else if (currentNgramSort === 'jaccard') {
        list.sort((a, b) => b.jaccard - a.jaccard || b.count - a.count || a.phrase.localeCompare(b.phrase, 'ja'));
    }

    currentNgramList = list;
    return list;
}

function renderCollocationView() {
    if (!collocationContainer) return;
    collocationContainer.style.display = 'block';

    const list = getFilteredAndSortedNgrams();
    const maxCount = list.length > 0 ? Math.max(...list.map(item => item.count)) : 1;
    const maxDisplay = 100;
    const displayList = list.slice(0, maxDisplay);

    let rowsHtml = '';
    if (displayList.length === 0) {
        rowsHtml = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    条件に一致するコロケーションがありません。「最小出現回数」を下げるか、検索キーワードを変更してください。
                </td>
            </tr>
        `;
    } else {
        rowsHtml = displayList.map((item, idx) => {
            const rank = idx + 1;
            let rankClass = 'collocation-rank-badge';
            if (rank === 1) rankClass += ' collocation-rank-1';
            else if (rank === 2) rankClass += ' collocation-rank-2';
            else if (rank === 3) rankClass += ' collocation-rank-3';

            const barPct = Math.max(8, Math.min(100, Math.round((item.count / maxCount) * 100)));
            const wordsBadges = item.words.map(w => `<span class="collocation-word-badge">${w}</span>`).join('<span style="color: var(--text-muted); font-size: 11px;">+</span>');
            const jaccardStr = item.jaccard > 0 ? item.jaccard.toFixed(3) : '-';

            const safePhrase = item.phrase.replace(/'/g, "\\'");

            return `
                <tr>
                    <td style="text-align: center;"><span class="${rankClass}">${rank}</span></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                            ${wordsBadges}
                        </div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="collocation-bar-bg">
                                <div class="collocation-bar-fill" style="width: ${barPct}%;"></div>
                            </div>
                            <span style="font-weight: 600; min-width: 45px; text-align: right; color: var(--text-primary); font-size: 12.5px;">${item.count}回</span>
                        </div>
                    </td>
                    <td style="text-align: center; color: var(--text-secondary); font-size: 12.5px;">${item.docCount}件</td>
                    <td style="text-align: center; color: ${item.jaccard > 0 ? 'var(--text-primary)' : 'var(--text-muted)'}; font-size: 12px; font-family: monospace;">${jaccardStr}</td>
                    <td style="text-align: center;">
                        <button type="button" class="collocation-kwic-btn" onclick="openKWICModal('${safePhrase}', ${item.count})" title="このフレーズの用例(KWIC)を表示">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <span>用例</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    collocationContainer.innerHTML = `
        <div class="collocation-header">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                <div>
                    <h2 style="font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px 0; display: flex; align-items: center; gap: 8px;">
                        <span>🔗</span> コロケーション分析 (${currentNgramN}-gram連語)
                    </h2>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        連続して出現する単語の組み合わせ（フレーズ）を抽出し、具体的な表現や言及パターンを分析します。
                    </div>
                </div>
                <div style="font-size: 11.5px; padding: 4px 12px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; color: var(--text-secondary);">
                    表示: <strong style="color: var(--text-primary);">${displayList.length}</strong> / 全${list.length}件
                </div>
            </div>

            <!-- Toolbar Controls -->
            <div class="collocation-toolbar">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">連語長:</span>
                    <div class="collocation-btn-group">
                        <button type="button" class="collocation-ngram-btn ${currentNgramN === 2 ? 'active' : ''}" data-n="2">2-gram (2連語)</button>
                        <button type="button" class="collocation-ngram-btn ${currentNgramN === 3 ? 'active' : ''}" data-n="3">3-gram (3連語)</button>
                        <button type="button" class="collocation-ngram-btn ${currentNgramN === 4 ? 'active' : ''}" data-n="4">4-gram (4連語)</button>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">抽出対象:</span>
                    <select id="collocation-target-select" class="select-control" style="width: auto; height: 32px; padding: 0 8px; font-size: 12px; margin: 0; background: var(--bg-base); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                        <option value="keywords" ${currentNgramTarget === 'keywords' ? 'selected' : ''}>主要語のみ (名詞・動詞等)</option>
                        <option value="all" ${currentNgramTarget === 'all' ? 'selected' : ''}>全単語 (助詞等を含むフレーズ)</option>
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">並び順:</span>
                    <select id="collocation-sort-select" class="select-control" style="width: auto; height: 32px; padding: 0 8px; font-size: 12px; margin: 0; background: var(--bg-base); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                        <option value="count" ${currentNgramSort === 'count' ? 'selected' : ''}>出現回数順</option>
                        <option value="doc" ${currentNgramSort === 'doc' ? 'selected' : ''}>文書数 (DF) 順</option>
                        <option value="jaccard" ${currentNgramSort === 'jaccard' ? 'selected' : ''}>Jaccard係数順 (共起度)</option>
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; flex-grow: 1; min-width: 170px;">
                    <input type="text" id="collocation-search-input" value="${currentNgramSearch}" placeholder="🔍 単語で絞り込み..." style="width: 100%; height: 32px; padding: 0 10px; font-size: 12px; background: var(--bg-base); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); box-sizing: border-box;">
                </div>
            </div>
        </div>

        <div style="margin-top: 14px; overflow-x: auto;">
            <table class="collocation-table">
                <thead>
                    <tr>
                        <th style="width: 52px; text-align: center;">順位</th>
                        <th style="text-align: left;">コロケーション (連語フレーズ)</th>
                        <th style="width: 200px; text-align: left;">出現回数</th>
                        <th style="width: 90px; text-align: center;">文書数</th>
                        <th style="width: 95px; text-align: center;">Jaccard</th>
                        <th style="width: 80px; text-align: center;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;

    // Bind events inside collocation container
    const nBtns = collocationContainer.querySelectorAll('.collocation-ngram-btn');
    nBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentNgramN = parseInt(e.currentTarget.getAttribute('data-n'));
            renderCollocationView();
        });
    });

    const targetSelect = document.getElementById('collocation-target-select');
    if (targetSelect) {
        targetSelect.addEventListener('change', (e) => {
            currentNgramTarget = e.target.value;
            renderCollocationView();
        });
    }

    const sortSelect = document.getElementById('collocation-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentNgramSort = e.target.value;
            renderCollocationView();
        });
    }

    const searchInput = document.getElementById('collocation-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentNgramSearch = e.target.value;
            renderCollocationView();
            const updatedInput = document.getElementById('collocation-search-input');
            if (updatedInput) {
                updatedInput.focus();
                updatedInput.selectionStart = updatedInput.selectionEnd = updatedInput.value.length;
            }
        });
    }
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
function drawNetworkLegend(ctx, canvasWidth, canvasHeight, isDarkTheme, minCount, maxCount, selectedFont, excludedWords = []) {
    const scaleFactor = canvasWidth / 1024;
    const hasExcluded = excludedWords && excludedWords.length > 0;
    const w = (hasExcluded ? 310 : 265) * scaleFactor;
    const h = (hasExcluded ? 76 : 56) * scaleFactor;
    const x = canvasWidth - w - 15 * scaleFactor; // 画面右下に配置
    const y = canvasHeight - h - 15 * scaleFactor;
    
    ctx.save();
    
    // 半透明の背景でグラフの邪魔になりにくくする
    ctx.fillStyle = isDarkTheme ? 'rgba(22, 31, 48, 0.85)' : 'rgba(255, 255, 255, 0.9)';
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

    // 3行目: 未採用・非表示の語（共起の結びつきが不足）
    if (hasExcluded) {
        const row3Y = y + 58 * scaleFactor;
        ctx.fillStyle = isDarkTheme ? '#9CA3AF' : '#6B7280';
        ctx.font = `${Math.round(9.5 * scaleFactor)}px ${selectedFont}`;
        
        const names = excludedWords.map(w => w.text);
        let noteText = "";
        if (names.length <= 3) {
            noteText = `※ 非表示の語: ${names.join(', ')}`;
        } else {
            noteText = `※ 非表示の語: ${names.slice(0, 3).join(', ')} (他${names.length - 3}語)`;
        }
        const maxTextW = w - 24 * scaleFactor;
        if (ctx.measureText(noteText).width > maxTextW) {
            if (names.length > 2) {
                noteText = `※ 非表示の語: ${names.slice(0, 2).join(', ')} (他${names.length - 2}語)`;
            }
            if (ctx.measureText(noteText).width > maxTextW) {
                noteText = `※ 非表示の語: ${names[0]} (他${names.length - 1}語)`;
            }
        }
        ctx.fillText(noteText, x + 12 * scaleFactor, row3Y);
    }
    
    ctx.restore();
}

// Helper to draw the Co-occurrence Network on any canvas
function drawNetworkOnCanvas(canvas, nodes, edges, selectedTheme, selectedFont, isDarkTheme, customScale = null, showLegend = true, excludedWords = null) {
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
        
        if (edge.isRescueEdge) {
            ctx.setLineDash([4 * scaleFactor, 3 * scaleFactor]);
            opacity = Math.max(0.25, opacity * 0.75);
        } else {
            ctx.setLineDash([]);
        }

        ctx.strokeStyle = `${strokeColor}${opacity})`;
        ctx.lineWidth = thickness * scaleFactor;
        ctx.stroke();
    });
    ctx.setLineDash([]);

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
        
        const baseFontSize = (networkFontSizeRange && networkFontSizeRange.value) ? parseInt(networkFontSizeRange.value, 10) : 15;
        const fontSizePx = Math.round(baseFontSize * scaleFactor);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = `bold ${fontSizePx}px ${selectedFont}`;
        
        const labelY = node.y - (node.radius * scaleFactor + 4 * scaleFactor);
        
        ctx.strokeStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
        ctx.lineWidth = Math.max(3, Math.round(baseFontSize * 0.28)) * scaleFactor;
        ctx.lineJoin = 'round';
        ctx.strokeText(node.id, node.x, labelY);
        
        ctx.fillStyle = isDarkTheme ? '#F3F4F6' : '#111111';
        ctx.fillText(node.id, node.x, labelY);
    });

    // 4. Draw Legend card in bottom-right corner
    if (showLegend) {
        const counts = nodes.map(n => n.count);
        const minCount = counts.length > 0 ? Math.min(...counts) : 1;
        const maxCount = counts.length > 0 ? Math.max(...counts) : 1;
        const wordsToPass = excludedWords !== null ? excludedWords : networkExcludedWords;
        drawNetworkLegend(ctx, canvas.width, canvas.height, isDarkTheme, minCount, maxCount, selectedFont, wordsToPass);
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
    
    const k = (pcaUserManual && pcaUserK) ? pcaUserK : (pcaOptimalK || parseInt(clusterCount?.value) || 3);
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
        
        const baseFontSize = (networkFontSizeRange && networkFontSizeRange.value) ? parseInt(networkFontSizeRange.value, 10) : 15;
        const fontSizePx = Math.round(baseFontSize * scaleFactor);
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = `bold ${fontSizePx}px ${selectedFont}`;
        
        const labelY = py - (radius * scaleFactor + 4 * scaleFactor);
        
        ctx.strokeStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
        ctx.lineWidth = Math.max(3, Math.round(baseFontSize * 0.28)) * scaleFactor;
        ctx.lineJoin = 'round';
        ctx.strokeText(p.word, px, labelY);
        
        ctx.fillStyle = isDarkTheme ? '#F3F4F6' : '#111111';
        ctx.fillText(p.word, px, labelY);
    });

    drawPCALegend(ctx, canvas.width, canvas.height, isDarkTheme, minCount, maxCount, k, selectedTheme, selectedFont);
}

// ==========================================
// UMAP (Uniform Manifold Approximation and Projection) Engine
// ==========================================

function createPRNG(seed) {
    let s = (seed >>> 0) || 123456789;
    return function() {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return (s >>> 0) / 4294967296;
    };
}

function runUMAPAnalysis(words, coocCounts, docFreq, uniqueWordsPerLine, counts, initPoints, k) {
    if (!words || words.length === 0) {
        rawUmapPoints = [];
        umapPoints = [];
        return;
    }
    const V = words.length;

    if (V === 1) {
        const singlePt = [{ word: words[0], x: 0, y: 0, count: counts[words[0]] || 1, cluster: 0 }];
        rawUmapPoints = singlePt;
        umapPoints = singlePt;
        return;
    }

    if (V === 2) {
        const twoPts = [
            { word: words[0], x: -1, y: 0, count: counts[words[0]] || 1, cluster: 0 },
            { word: words[1], x: 1, y: 0, count: counts[words[1]] || 1, cluster: Math.min(1, k - 1) }
        ];
        rawUmapPoints = twoPts;
        umapPoints = twoPts;
        return;
    }

    // 1. Build word profile similarity vectors & distance matrix
    const sim = Array.from({ length: V }, () => new Float64Array(V));
    for (let i = 0; i < V; i++) {
        sim[i][i] = 1.0;
        const w1 = words[i];
        const df1 = docFreq[w1] || 1;
        for (let j = i + 1; j < V; j++) {
            const w2 = words[j];
            const df2 = docFreq[w2] || 1;
            const key = w1 < w2 ? `${w1}|||${w2}` : `${w2}|||${w1}`;
            const fAB = coocCounts[key] || 0;
            if (fAB > 0) {
                const denom = Math.sqrt(df1 * df2);
                const s = denom > 0 ? fAB / denom : 0;
                sim[i][j] = s;
                sim[j][i] = s;
            }
        }
    }

    const dist = Array.from({ length: V }, () => new Float64Array(V));
    for (let i = 0; i < V; i++) {
        for (let j = i + 1; j < V; j++) {
            let dot = 0, n1 = 0, n2 = 0;
            for (let m = 0; m < V; m++) {
                dot += sim[i][m] * sim[j][m];
                n1 += sim[i][m] * sim[i][m];
                n2 += sim[j][m] * sim[j][m];
            }
            const denom = Math.sqrt(n1) * Math.sqrt(n2);
            const cos = denom > 0 ? dot / denom : 0;
            const d = Math.max(0, Math.min(1.0, 1.0 - cos));
            dist[i][j] = d;
            dist[j][i] = d;
        }
    }

    // 2. High-dimensional KNN fuzzy simplicial set (rho and sigma)
    const nNeighbors = Math.max(2, Math.min(15, V - 1));
    const target = Math.log2(nNeighbors);
    const P = Array.from({ length: V }, () => new Float64Array(V));

    for (let i = 0; i < V; i++) {
        const neighbors = [];
        for (let j = 0; j < V; j++) {
            if (i !== j) neighbors.push({ j, d: dist[i][j] });
        }
        neighbors.sort((a, b) => a.d - b.d);
        const knn = neighbors.slice(0, nNeighbors);
        const rho = knn[0].d;

        let lo = 1e-4, hi = 100.0, sigma = 1.0;
        for (let iter = 0; iter < 16; iter++) {
            const mid = (lo + hi) / 2;
            let sum = 0;
            for (let m = 0; m < knn.length; m++) {
                const diff = Math.max(0, knn[m].d - rho);
                sum += Math.exp(-diff / mid);
            }
            if (sum > target) hi = mid;
            else lo = mid;
            sigma = mid;
        }

        for (let m = 0; m < knn.length; m++) {
            const diff = Math.max(0, knn[m].d - rho);
            P[i][knn[m].j] = Math.exp(-diff / sigma);
        }
    }

    // 3. Symmetrize edges
    const edges = [];
    for (let i = 0; i < V; i++) {
        for (let j = i + 1; j < V; j++) {
            const p_ij = P[i][j] + P[j][i] - P[i][j] * P[j][i];
            if (p_ij > 1e-4) {
                edges.push({ i, j, weight: p_ij });
            }
        }
    }

    // 4. Coordinates Y initialized with PCA or seeded PRNG
    const rng = createPRNG(umapRandomSeed);
    const Y = [];
    if (initPoints && initPoints.length === V) {
        const xs = initPoints.map(p => p.x);
        const ys = initPoints.map(p => p.y);
        const meanX = xs.reduce((a, b) => a + b, 0) / V;
        const meanY = ys.reduce((a, b) => a + b, 0) / V;
        const stdX = Math.sqrt(xs.reduce((s, x) => s + (x - meanX) ** 2, 0) / V) || 1;
        const stdY = Math.sqrt(ys.reduce((s, y) => s + (y - meanY) ** 2, 0) / V) || 1;
        for (let i = 0; i < V; i++) {
            const jx = (rng() - 0.5) * 0.1;
            const jy = (rng() - 0.5) * 0.1;
            Y.push([
                (initPoints[i].x - meanX) / stdX + jx,
                (initPoints[i].y - meanY) / stdY + jy
            ]);
        }
    } else {
        for (let i = 0; i < V; i++) {
            Y.push([(rng() - 0.5) * 4, (rng() - 0.5) * 4]);
        }
    }

    // 5. SGD optimization
    const a = 1.5769434, b = 0.8950619;
    const nEpochs = 250;

    for (let epoch = 0; epoch < nEpochs; epoch++) {
        const alpha = 1.0 * (1.0 - epoch / nEpochs);
        if (alpha <= 0) break;

        for (let eIdx = 0; eIdx < edges.length; eIdx++) {
            const edge = edges[eIdx];
            const i = edge.i, j = edge.j, w = edge.weight;
            const dx = Y[i][0] - Y[j][0];
            const dy = Y[i][1] - Y[j][1];
            const d2 = dx * dx + dy * dy;

            if (d2 > 1e-6) {
                const gradAttr = (-2 * a * b * Math.pow(d2, b - 1) / (1 + a * Math.pow(d2, b))) * w;
                const moveX = Math.max(-4, Math.min(4, gradAttr * dx));
                const moveY = Math.max(-4, Math.min(4, gradAttr * dy));
                Y[i][0] += alpha * moveX;
                Y[i][1] += alpha * moveY;
                Y[j][0] -= alpha * moveX;
                Y[j][1] -= alpha * moveY;
            }

            // Negative sampling (push apart from 2 random points)
            for (let s = 0; s < 2; s++) {
                const kSample = Math.floor(rng() * V);
                if (kSample === i) continue;
                const rdx = Y[i][0] - Y[kSample][0];
                const rdy = Y[i][1] - Y[kSample][1];
                const rd2 = rdx * rdx + rdy * rdy;
                const gradRep = (2 * b / ((0.001 + rd2) * (1 + a * Math.pow(rd2, b))));
                const rmoveX = Math.max(-4, Math.min(4, gradRep * rdx));
                const rmoveY = Math.max(-4, Math.min(4, gradRep * rdy));
                Y[i][0] += alpha * rmoveX;
                Y[i][1] += alpha * rmoveY;
            }
        }
    }

    // Center coordinates
    const avgY0 = Y.reduce((sum, pt) => sum + pt[0], 0) / V;
    const avgY1 = Y.reduce((sum, pt) => sum + pt[1], 0) / V;
    for (let i = 0; i < V; i++) {
        Y[i][0] -= avgY0;
        Y[i][1] -= avgY1;
    }

    const rawPoints = [];
    for (let i = 0; i < V; i++) {
        const word = words[i];
        rawPoints.push({
            word: word,
            x: Y[i][0],
            y: Y[i][1],
            count: counts[word] || 1
        });
    }

    rawUmapPoints = rawPoints;
    const umapOpt = findOptimal2DClusterK(rawPoints, 2, 6);
    umapOptimalK = umapOpt.optimalK;
    const activeUmapK = (umapUserManual && umapUserK) ? umapUserK : umapOptimalK;
    umapUserK = activeUmapK;

    if (activeUmapK === umapOptimalK && umapOpt.assignments) {
        umapPoints = rawPoints.map((pt, i) => ({ ...pt, cluster: umapOpt.assignments[i] }));
    } else {
        const assignments = runKMeans(rawPoints, activeUmapK);
        umapPoints = rawPoints.map((pt, i) => ({ ...pt, cluster: assignments[i] }));
    }
}

// Helper to draw UMAP Legend on any canvas
function drawUMAPLegend(ctx, canvasWidth, canvasHeight, isDarkTheme, minCount, maxCount, k, selectedTheme, selectedFont) {
    const scaleFactor = canvasWidth / 1024;
    const x = 20 * scaleFactor;
    const y = canvasHeight - 75 * scaleFactor;
    
    ctx.save();
    
    ctx.fillStyle = isDarkTheme ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.65)';
    ctx.strokeStyle = isDarkTheme ? 'rgba(15, 23, 42, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1 * scaleFactor;
    
    const w = 220 * scaleFactor;
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
    ctx.fillText("凡例 (UMAP Legend・非線形多様体)", x + 10 * scaleFactor, y + 6 * scaleFactor);
    
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

// Helper to draw UMAP Scatter Plot on any canvas
function drawUMAPOnCanvas(canvas, points, selectedTheme, selectedFont, isDarkTheme) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!points || points.length === 0) return;
    
    const scaleFactor = canvas.width / 1024;
    const padding = 100 * scaleFactor;
    
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs, -0.01);
    const maxX = Math.max(...xs, 0.01);
    const minY = Math.min(...ys, -0.01);
    const maxY = Math.max(...ys, 0.01);
    
    const spanX = Math.max(0.001, maxX - minX);
    const spanY = Math.max(0.001, maxY - minY);

    const scaleX = (x) => padding + ((x - minX) / spanX) * (canvas.width - 2 * padding);
    const scaleY = (y) => padding + ((maxY - y) / spanY) * (canvas.height - 2 * padding);
    
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
    
    // Principal axes (UMAP-1, UMAP-2)
    ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1.5 * scaleFactor;
    
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
    ctx.fillText('第1成分 (UMAP-1)', canvas.width - padding + 15 * scaleFactor, zeroY + 16 * scaleFactor);
    ctx.textAlign = 'left';
    ctx.fillText('第2成分 (UMAP-2)', zeroX + 8 * scaleFactor, padding - 8 * scaleFactor);
    
    ctx.restore();
    
    const counts = points.map(p => p.count);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    
    const k = (umapUserManual && umapUserK) ? umapUserK : (umapOptimalK || parseInt(clusterCount?.value) || 3);
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
        ctx.globalAlpha = 0.09;
        ctx.fill();
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 * scaleFactor;
        ctx.globalAlpha = 0.22;
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
        
        const baseFontSize = (networkFontSizeRange && networkFontSizeRange.value) ? parseInt(networkFontSizeRange.value, 10) : 15;
        const fontSizePx = Math.round(baseFontSize * scaleFactor);
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = `bold ${fontSizePx}px ${selectedFont}`;
        
        const labelY = py - (radius * scaleFactor + 4 * scaleFactor);
        
        ctx.strokeStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
        ctx.lineWidth = Math.max(3, Math.round(baseFontSize * 0.28)) * scaleFactor;
        ctx.lineJoin = 'round';
        ctx.strokeText(p.word, px, labelY);
        
        ctx.fillStyle = isDarkTheme ? '#F3F4F6' : '#111111';
        ctx.fillText(p.word, px, labelY);
    });

    drawUMAPLegend(ctx, canvas.width, canvas.height, isDarkTheme, minCount, maxCount, k, selectedTheme, selectedFont);
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

    const networkExcludedBar = document.getElementById('network-excluded-bar');

    if (wordFrequencies.length === 0) {
        emptyState.style.display = 'flex';
        downloadBtn.disabled = true;
        if (exportCsvDropdownBtn) exportCsvDropdownBtn.disabled = true;
        exportWordsCsvBtn.disabled = true;
        exportPairsCsvBtn.disabled = true;
        if (exportNgramCsvBtn) exportNgramCsvBtn.disabled = true;
        if (exportAllCsvBtn) exportAllCsvBtn.disabled = true;
        if (relayoutBtn) relayoutBtn.disabled = true;
        if (sidebarRelayoutBtn) sidebarRelayoutBtn.disabled = true;
        if (networkExcludedBar) networkExcludedBar.style.display = 'none';
        if (collocationContainer) collocationContainer.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    downloadBtn.disabled = false;
    if (exportCsvDropdownBtn) exportCsvDropdownBtn.disabled = false;
    exportWordsCsvBtn.disabled = false;
    exportPairsCsvBtn.disabled = false;
    if (exportNgramCsvBtn) exportNgramCsvBtn.disabled = false;
    if (exportAllCsvBtn) exportAllCsvBtn.disabled = false;
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
        if (exportCsvDropdownBtn) exportCsvDropdownBtn.disabled = true;
        exportWordsCsvBtn.disabled = true;
        exportPairsCsvBtn.disabled = true;
        if (exportNgramCsvBtn) exportNgramCsvBtn.disabled = true;
        if (exportAllCsvBtn) exportAllCsvBtn.disabled = true;
        if (relayoutBtn) relayoutBtn.disabled = true;
        if (sidebarRelayoutBtn) sidebarRelayoutBtn.disabled = true;
        if (networkExcludedBar) networkExcludedBar.style.display = 'none';
        if (collocationContainer) collocationContainer.style.display = 'none';
        return;
    }

    if (currentDisplayType === 'cloud') {
        cloudCanvas.style.display = 'block';
        chartContainer.style.display = 'none';
        if (ldaContainer) ldaContainer.style.display = 'none';
        if (collocationContainer) collocationContainer.style.display = 'none';
        
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
                        return getNetworkNodeColor(selectedTheme, { word: wordStr, cluster: clusterId }, isDarkTheme);
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
        if (collocationContainer) collocationContainer.style.display = 'none';
        
        const chartList = filteredList.slice(0, 20);
        const selectedFont = fontSelect.value;
        
        drawBarChartOnCanvas(cloudCanvas, chartList, rankingMethod, selectedTheme, selectedFont, isDarkTheme);
    } else if (currentDisplayType === 'network') {
        cloudCanvas.style.display = 'block';
        chartContainer.style.display = 'none';
        if (ldaContainer) ldaContainer.style.display = 'none';
        if (collocationContainer) collocationContainer.style.display = 'none';

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
        if (collocationContainer) collocationContainer.style.display = 'none';
        
        const selectedFont = fontSelect.value;
        drawPCAOnCanvas(cloudCanvas, pcaPoints, selectedTheme, selectedFont, isDarkTheme);
    } else if (currentDisplayType === 'umap') {
        cloudCanvas.style.display = 'block';
        chartContainer.style.display = 'none';
        if (ldaContainer) ldaContainer.style.display = 'none';
        if (collocationContainer) collocationContainer.style.display = 'none';
        
        const selectedFont = fontSelect.value;
        drawUMAPOnCanvas(cloudCanvas, umapPoints, selectedTheme, selectedFont, isDarkTheme);
    } else if (currentDisplayType === 'topic-lda') {
        cloudCanvas.style.display = 'none';
        chartContainer.style.display = 'none';
        if (ldaContainer) ldaContainer.style.display = 'block';
        if (collocationContainer) collocationContainer.style.display = 'none';
        renderLDATopicView();
    } else if (currentDisplayType === 'collocation') {
        cloudCanvas.style.display = 'none';
        chartContainer.style.display = 'none';
        if (ldaContainer) ldaContainer.style.display = 'none';
        if (collocationContainer) {
            collocationContainer.style.display = 'block';
            renderCollocationView();
        }
    }

    // Update Network Excluded Words Bar
    if (networkExcludedBar) {
        if (currentDisplayType === 'network' && networkExcludedWords && networkExcludedWords.length > 0) {
            networkExcludedBar.style.display = 'block';
            const countEl = document.getElementById('network-excluded-count');
            const tagsEl = document.getElementById('network-excluded-tags');
            if (countEl) countEl.innerText = networkExcludedWords.length;
            if (tagsEl) {
                tagsEl.innerHTML = '';
                networkExcludedWords.forEach(item => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'excluded-word-tag';
                    btn.title = 'クリックして用例(KWIC)を表示';
                    const safeWord = item.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    btn.innerHTML = `<span>${safeWord}</span><span style="color: var(--text-muted); font-size: 10px;">${item.count}回</span>`;
                    btn.addEventListener('click', () => openKWICModal(item.text, item.count));
                    tagsEl.appendChild(btn);
                });
            }
        } else {
            networkExcludedBar.style.display = 'none';
        }
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
        let excludedSummaryHtml = '';
        if (networkExcludedWords && networkExcludedWords.length > 0) {
            const exNames = networkExcludedWords.map(w => `<span style="text-decoration:underline;cursor:pointer;color:var(--text-primary);" onclick="openKWICModal('${w.text.replace(/'/g, "\\'")}', ${w.count})"><b>${w.text}</b>(${w.count}回)</span>`).join('、');
            excludedSummaryHtml = `<br><span style="color:#F59E0B;font-weight:600;">⚠️ 共起が弱く未表示となった語（${networkExcludedWords.length}語）：</span> ${exNames} <span style="color:var(--text-muted);font-size:11px;">（※単独で使われる傾向が強い話題です）</span><br>`;
        }
        commentHtml = `
            <b>📊 この結果から読み取れること：</b><br>
            <b>${nodeCount}語・${edgeCount}本</b>の関係線が描かれています。
            色の異なるグループが <b>${communities}つ</b> 検出されました（自動コミュニティ分割）。<br>
            同じ色の語は同じ回答の中でよく一緒に使われており、<b>1つのテーマ・話題</b>を形成している可能性があります。<br>
            ${excludedSummaryHtml}
            <span style="color:var(--text-muted);">💡 「最小出現回数」を上げると主要な語だけが残り、テーマがより明確になります。語をクリックするとKWIC（用例）を確認できます。</span>`;
        // ③ 次のステップ
        nextHtml = `
            <b>👉 次のステップ：</b>
            グループのテーマを確認したら、
            <span style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('display-type').value='topic-lda';document.getElementById('display-type').dispatchEvent(new Event('change'));">トピック分析(LDA)</span>
            で、各回答がどのテーマに属するか統計的に確認できます。`;

    } else if (mode === 'pca') {
        // ① PCA用コメント
        const currentK = (pcaUserManual && pcaUserK) ? pcaUserK : (pcaOptimalK || parseInt(clusterCount?.value) || 3);
        const optK = pcaOptimalK || 3;
        const recText = pcaUserManual && pcaUserK !== optK ? `（手動調整中 / 初期推奨値: ${optK}）` : `（分布から自動算出した推奨値: ${optK}）`;
        commentHtml = `
            <b>📊 この結果から読み取れること：</b><br>
            近くに配置された語ほど<b>似た文脈で使われる語</b>です。
            ${currentK}色のグループに分類されています${recText}。<br>
            横軸(PC1)・縦軸(PC2)はそれぞれ回答全体の傾向をまとめた「主な方向性」を表します
            （寄与率が低くても、テキスト分析では正常です）。<br>
            <span style="color:var(--text-muted);">💡 点が離れているほど、他と違う文脈で使われる語です。共起ネットワークと合わせて見ると理解が深まります。</span>`;
        nextHtml = `
            <b>👉 次のステップ：</b>
            <span style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('display-type').value='topic-lda';document.getElementById('display-type').dispatchEvent(new Event('change'));">トピック分析(LDA)</span>
            で、文書単位のテーマ分布を確認できます。`;

    } else if (mode === 'umap') {
        // ① UMAP用コメント
        const currentK = (umapUserManual && umapUserK) ? umapUserK : (umapOptimalK || parseInt(clusterCount?.value) || 3);
        const optK = umapOptimalK || 3;
        const recText = umapUserManual && umapUserK !== optK ? `（手動調整中 / 初期推奨値: ${optK}）` : `（分布から自動算出した推奨値: ${optK}）`;
        commentHtml = `
            <b>📊 この結果から読み取れること：</b><br>
            非線形多様体学習（UMAP）により、高次元の単語共起関係を圧縮して可視化しています。<br>
            ぎゅっと集まっている塊は<b>同じ文脈・話題で高頻度に結びつく単語群（テーマの核）</b>です。
            ${currentK}色のグループに分類されています${recText}。<br>
            <span style="color:var(--text-muted);">💡 PCA（主成分分析）に比べ、局所的な類似度が強調され、クラスター同士の「隙間・分離」が明確になります。語をクリックすると用例(KWIC)を確認できます。</span>`;
        nextHtml = `
            <b>👉 次のステップ：</b>
            クラスターのテーマが把握できたら、
            <span style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('display-type').value='collocation';document.getElementById('display-type').dispatchEvent(new Event('change'));">コロケーション(連語)</span>
            で具体的な言い回しを確認するか、
            <span style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('display-type').value='topic-lda';document.getElementById('display-type').dispatchEvent(new Event('change'));">トピック分析(LDA)</span>
            で文書単位のテーマ確率分布を調べてみましょう。`;

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
    } else if (mode === 'collocation') {
        // ① コロケーション用コメント
        const n = currentNgramN;
        const targetDesc = currentNgramTarget === 'keywords' ? '重要語のみ' : '助詞・全語を含む';
        const topNgrams = (currentNgramList || []).slice(0, 5);
        
        let topPhrasesHtml = '';
        if (topNgrams.length > 0) {
            topPhrasesHtml = topNgrams.map(item => {
                const safePhrase = item.phrase.replace(/'/g, "\\'");
                return `<span style="text-decoration:underline;cursor:pointer;color:var(--accent-blue);font-weight:600;" onclick="openKWICModal('${safePhrase}', ${item.count})">「${item.phrase}」</span>（${item.count}回/出現${item.docCount}件）`;
            }).join('、');
        }

        commentHtml = `
            <b>📊 この結果から読み取れること：</b><br>
            <b>${n}-gram（${n}連語）</b>によるフレーズパターンが <b>${(currentNgramList || []).length}件</b> 抽出されました（抽出対象: ${targetDesc}）。<br>
            ${topPhrasesHtml ? `代表的な頻出連語： ${topPhrasesHtml}<br>` : ''}
            単語単体（1語）では分かりにくい「具体的にどのような表現や組み合わせで語られているか」という<b>言及パターンや文脈</b>を把握できます。<br>
            <span style="color:var(--text-muted);">💡 上位の連語をクリックするとKWIC（実際の用例）を確認できます。Jaccard係数が高い組み合わせは、単独ではなく常にセットで使われる強い結びつきを示します。</span>`;

        nextHtml = `
            <b>👉 次のステップ：</b>
            特定の連語に注目したい場合は、右上の<b>「連語内検索」</b>や<b>「助詞・全語を含む」</b>への切り替え、または
            <span style="color:var(--accent-blue);cursor:pointer;text-decoration:underline;" onclick="document.getElementById('display-type').value='network';document.getElementById('display-type').dispatchEvent(new Event('change'));">共起ネットワーク</span>
            で全体的な語と語の繋がりを俯瞰してみましょう。`;
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

// 6. Download Word Cloud, Bar Chart, Network Diagram, PCA/UMAP, LDA, or Collocation as Image
async function executeImageDownload(sizeKey = 'medium') {
    if (downloadSize) downloadSize.value = sizeKey;
    try {
        const sizes = {
            small: { w: 800, h: 600 },
            medium: { w: 1200, h: 900 },
            large: { w: 1920, h: 1080 }
        };
        const targetSize = sizes[sizeKey] || sizes.medium;
        
        const selectedTheme = colorTheme.value;
        const isDarkTheme = selectedTheme === 'aurora-dark' || selectedTheme === 'monochrome-dark';
        const rankingMethod = document.getElementById('ranking-method').value;
        const currentMode = displayType.value;
        
        let defaultFilename = 'wordcloud.png';
        if (currentMode === 'chart') defaultFilename = 'barchart.png';
        else if (currentMode === 'network') defaultFilename = 'network_diagram.png';
        else if (currentMode === 'pca') defaultFilename = 'pca_scatter.png';
        else if (currentMode === 'umap') defaultFilename = 'umap_scatter.png';
        else if (currentMode === 'topic-lda') defaultFilename = 'topic_lda.png';
        else if (currentMode === 'collocation') defaultFilename = 'collocation_ngram.png';

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

        const originalBtnHtml = downloadBtn ? downloadBtn.innerHTML : '';
        const setBtnExporting = () => {
            if (downloadBtn) {
                downloadBtn.disabled = true;
                downloadBtn.innerText = "書き出し中...";
            }
        };
        const restoreBtn = () => {
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = originalBtnHtml;
            }
        };

        if (currentMode === 'cloud') {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetSize.w;
            exportCanvas.height = targetSize.h;
            
            const ctx = exportCanvas.getContext('2d');
            ctx.fillStyle = isDarkTheme ? '#0B0F19' : '#FFFFFF';
            ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            
            setBtnExporting();
            
            const exportTimeout = setTimeout(() => {
                restoreBtn();
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
                            return getNetworkNodeColor(selectedTheme, { word: wordStr, cluster: clusterId }, isDarkTheme);
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
                restoreBtn();
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
        } else if (currentMode === 'umap') {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetSize.w;
            exportCanvas.height = targetSize.h;

            const selectedFont = fontSelect.value;
            drawUMAPOnCanvas(exportCanvas, umapPoints, selectedTheme, selectedFont, isDarkTheme);

            const image = exportCanvas.toDataURL("image/png");
            saveImageFile(image, 'umap_scatter.png');
        } else if (currentMode === 'topic-lda' || currentMode === 'collocation') {
            const targetContainer = currentMode === 'collocation' ? collocationContainer : ldaContainer;
            if (!targetContainer) return;
            const targetFilename = currentMode === 'collocation' ? 'collocation_ngram.png' : 'topic_lda.png';
            
            setBtnExporting();

            const exportHTMLContent = () => {
                // Temporarily expand container to capture full scrolling content
                const originalHeight = targetContainer.style.height;
                const originalOverflow = targetContainer.style.overflowY;
                const originalPosition = targetContainer.style.position;
                
                targetContainer.style.height = 'auto';
                targetContainer.style.overflowY = 'visible';
                targetContainer.style.position = 'relative';

                html2canvas(targetContainer, {
                    backgroundColor: isDarkTheme ? '#0B0F19' : '#FFFFFF',
                    scale: 2,
                    windowHeight: targetContainer.scrollHeight
                }).then(canvas => {
                    // Restore original styles
                    targetContainer.style.height = originalHeight;
                    targetContainer.style.overflowY = originalOverflow;
                    targetContainer.style.position = originalPosition;

                    const image = canvas.toDataURL("image/png");
                    saveImageFile(image, targetFilename);
                    
                    restoreBtn();
                }).catch(error => {
                    // Restore original styles on error
                    targetContainer.style.height = originalHeight;
                    targetContainer.style.overflowY = originalOverflow;
                    targetContainer.style.position = originalPosition;

                    console.error("html2canvas error:", error);
                    restoreBtn();
                    alert("画像の書き出しに失敗しました。\nエラー内容: " + error.message);
                });
            };

            if (typeof html2canvas === 'undefined') {
                const script = document.createElement('script');
                script.src = "lib/html2canvas/html2canvas.min.js";
                script.onload = exportHTMLContent;
                script.onerror = () => {
                    restoreBtn();
                    alert("画像化ライブラリが見つかりません。\nlib/html2canvas/html2canvas.min.js が存在するか確認してください。");
                };
                document.head.appendChild(script);
            } else {
                exportHTMLContent();
            }
        }
    } catch (error) {
        console.error("PNG export failed:", error);
        alert("画像の書き出しに失敗しました。\nエラー内容: " + error.message);
    }
}

// Bind image size dropdown menu items
if (downloadSizeMediumBtn) {
    downloadSizeMediumBtn.addEventListener('click', () => {
        closeImageDropdown();
        executeImageDownload('medium');
    });
}
if (downloadSizeLargeBtn) {
    downloadSizeLargeBtn.addEventListener('click', () => {
        closeImageDropdown();
        executeImageDownload('large');
    });
}
if (downloadSizeSmallBtn) {
    downloadSizeSmallBtn.addEventListener('click', () => {
        closeImageDropdown();
        executeImageDownload('small');
    });
}

function triggerRelayout() {
    if (wordFrequencies.length === 0) return;
    isForceRelayout = true;
    if (displayType.value === 'pca' || displayType.value === 'umap') {
        if (displayType.value === 'umap') {
            umapRandomSeed = Date.now();
        }
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

// Run Initialization on Load (Guaranteed to execute even if DOMContentLoaded already fired)
function startApp() {
    initKuromoji();
    updateClusterCountGroupVisibility();
    initCSVModalListeners();
    if (networkFontSizeRange && networkFontSizeVal) {
        networkFontSizeVal.innerText = `${networkFontSizeRange.value}px`;
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

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
    
    const queryWords = word.trim().split(/\s+/).filter(w => w.length > 0);
    const isMultiWord = queryWords.length > 1;

    const tokenMatches = (token, target) => {
        if (!token || !target) return false;
        const pos = token.pos;
        const norm = (pos === '動詞' || pos === '形容詞' || pos === '副詞') && token.basic_form !== '*' 
            ? token.basic_form 
            : token.surface_form;
        return norm === target || token.surface_form === target || (token.basic_form && token.basic_form !== '*' && token.basic_form === target);
    };

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
        
        let matchedSpans = [];

        if (!isMultiWord) {
            for (let j = 0; j < tokens.length; j++) {
                if (tokenMatches(tokens[j], word)) {
                    matchedSpans.push({
                        start: j,
                        end: j,
                        matchedText: tokens[j].surface_form || word
                    });
                }
            }
        } else {
            // 1. Contiguous match
            for (let j = 0; j <= tokens.length - queryWords.length; j++) {
                let matches = true;
                for (let k = 0; k < queryWords.length; k++) {
                    if (!tokenMatches(tokens[j + k], queryWords[k])) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    const start = j;
                    const end = j + queryWords.length - 1;
                    const matchedText = tokens.slice(start, end + 1).map(t => t.surface_form).join('');
                    matchedSpans.push({ start, end, matchedText });
                }
            }

            // 2. Interleaved match (for keyword-only extractions separated by particles)
            if (matchedSpans.length === 0) {
                for (let j = 0; j < tokens.length; j++) {
                    if (!tokenMatches(tokens[j], queryWords[0])) continue;

                    let currentTokenIdx = j;
                    let matchedAll = true;
                    let lastMatchedIdx = j;

                    for (let k = 1; k < queryWords.length; k++) {
                        let foundNext = false;
                        const maxLookahead = Math.min(tokens.length - 1, currentTokenIdx + 4);
                        for (let nextIdx = currentTokenIdx + 1; nextIdx <= maxLookahead; nextIdx++) {
                            if (tokenMatches(tokens[nextIdx], queryWords[k])) {
                                foundNext = true;
                                currentTokenIdx = nextIdx;
                                lastMatchedIdx = nextIdx;
                                break;
                            }
                        }
                        if (!foundNext) {
                            matchedAll = false;
                            break;
                        }
                    }

                    if (matchedAll) {
                        const start = j;
                        const end = lastMatchedIdx;
                        const matchedText = tokens.slice(start, end + 1).map(t => t.surface_form).join('');
                        matchedSpans.push({ start, end, matchedText });
                        j = end;
                    }
                }
            }
        }
        
        if (matchedSpans.length > 0) {
            matchingSentences.push(tokens);
            // Count local co-occurrences for ego network
            const uniqueWordsInSentence = new Set();
            tokens.forEach(t => {
                const p = t.pos;
                let tStr = (p === '動詞' || p === '形容詞' || p === '副詞') && t.basic_form !== '*' ? t.basic_form : t.surface_form;
                let tClean = tStr.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '').trim();
                // Exclude the target word(s) itself, stopwords, and punctuation
                const isTargetPart = isMultiWord ? (queryWords.includes(tStr) || queryWords.includes(tClean)) : (tStr === word || tClean === word);
                if (allowedPOS.includes(p) && tClean && !isTargetPart && !isStopWord(tClean) && !/^[\p{P}\p{S}\s]+$/u.test(tClean)) {
                    uniqueWordsInSentence.add(tClean);
                }
            });
            uniqueWordsInSentence.forEach(w => {
                kwicCoocCounts[w] = (kwicCoocCounts[w] || 0) + 1;
            });
        }
        
        for (const span of matchedSpans) {
            matchCount++;
            if (matchCount > maxDisplay) {
                kwicLimitWarning.style.display = 'inline-block';
                break;
            }
            
            let leftContext = "";
            for (let j = 0; j < span.start; j++) {
                leftContext += tokens[j].surface_form;
            }
            
            let rightContext = "";
            for (let j = span.end + 1; j < tokens.length; j++) {
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
            spanWord.textContent = span.matchedText || word;
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
            const selectedFont = fontSelect ? fontSelect.value : "'BIZ UDP Gothic', sans-serif";
            
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
