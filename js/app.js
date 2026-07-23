// App State
let tokenizer = null;
let rawTextData = "";
let opinionLinesCount = 0;
let wordFrequencies = [];
let globalAnalyzedLines = []; // Cached token lists per line: [[token, token...], [token...]]
let currentAnalysisCounts = {}; // Cached counts mapping for CSV export
let currentAnalysisCoocCounts = {}; // Cached cooc counts mapping for CSV export
let currentAnalysisDocFreq = {};    // Cached document-frequency for correct Jaccard in CSV export

// Set for standard stop words (dynamically loaded from stopwords.txt)
let defaultStopWordsSet = new Set();

// Custom Stop Words added on-screen by the user
let customStopWords = new Set();

// Network Graph State
let networkNodes = [];
let networkEdges = [];
let networkAnimationFrameId = null;

// PCA Scatter Plot State
let pcaPoints = [];
let pcaExplainedVar1 = '--'; // Variance explained by PC1 (%)
let pcaExplainedVar2 = '--'; // Variance explained by PC2 (%)

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
const minCountRange = document.getElementById('min-count-range');
const minCountVal = document.getElementById('min-count-val');
const maxWordsRange = document.getElementById('max-words-range');
const maxWordsVal = document.getElementById('max-words-val');
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
const compoundWordsList = document.getElementById('compound-words-list');
let customCompoundWords = new Set(); // User-defined compound words

// Stopwords Elements
const newStopwordInput = document.getElementById('new-stopword');
const addStopwordBtn = document.getElementById('add-stopword-btn');
const stopwordsList = document.getElementById('stopwords-list');
const resetStopwordsBtn = document.getElementById('reset-stopwords-btn');

// Export CSV Buttons
const exportWordsCsvBtn = document.getElementById('export-words-csv-btn');
const exportPairsCsvBtn = document.getElementById('export-pairs-csv-btn');

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

// Sample Opinions Text (Demo Data)
const SAMPLE_TEXT = `AIアシスタントを使うとコーディングの速度が劇的に向上する。
リモートワークのおかげで通勤時間がなくなり、家族と過ごす時間が増えた。
オンライン会議が多すぎて、集中して作業する時間が削られるのが課題だ。
新しいプログラミング言語の学習にAIを活用すると、非常に分かりやすく解説してくれる。
オフィスの対面コミュニケーションも偶発的なアイデア創出には重要だと思う。
自宅の作業環境を整えるために、エルゴノミクスチェアと外部モニターを購入した。
快適なホームオフィス環境が整うと、集中力と生産性が大幅に改善された。
AIが生成するコードには時折バグが含まれているため、人間のレビューが不可欠だ。
週に数回出社し、残りはリモートというハイブリッドワークが最も働きやすい。
ペーパーレス化が進み、電子契約やオンライン共有が日常化して業務が効率化された。
AIツールはドキュメントの要約や作成において非常に強力なアシスタントになる。
家だと集中しにくい日もあるので、近所のコワーキングスペースをたまに利用する。
プログラミング教育にAIを導入することで、初心者の挫折率が下がることを期待している。
運動不足になりがちなので、スタンディングデスクを導入したり散歩を取り入れたりしている。
チャットツールでの連絡が多く、非同期コミュニケーションのスキルが求められる。
自動化できる作業はすべてAIやスクリプトで自動化し、クリエイティブな仕事に注力したい。
新規事業の立ち上げにおいて、市場調査のスピードがAIによって圧倒的に早くなった。
オンライン教育の普及により、地方からでも最先端のIT技術を学べる機会が増えた。
睡眠の質を高めるため、スマートウォッチでデータをトラッキングして改善を図っている。
プロジェクト管理ツールを移行したら、タスクの進捗が可視化されてチームの摩擦が減った。
プログラミング初心者はエラーメッセージを読むのが苦手なので、AIによる翻訳が役立つ。
オフィスでコーヒーを飲みながら行う雑談から、面白いサービス開発のアイデアが生まれた。
通勤電車の中での読書時間が減ってしまったので、音声学習アプリを歩きながら聞いている。
セキュリティ対策が強化され、VPNや生体認証の導入で社外からの作業も安全になった。
クラウドファンディングを利用して、新しい開発ガジェットをいち早く手に入れた。
動画編集や3Dグラフィックスの作業には、高性能なGPUを搭載したデスクトップPCが必要だ。
オンラインセミナーへの参加が容易になり、自己啓発に費やす週末の時間が増加した。
ノーコードツールを使えば、アイデアを数時間でWebアプリの形にして検証できる。
チームメンバーが異なる国に住んでいるため、時差を意識したテキストコミュニケーションが必須だ。
デザイン制作に画像生成AIを取り入れることで、コンセプト案の提案速度が劇的に向上した。
毎朝のスタンドアップミーティングが短縮され、個人の集中作業に充てる時間が増えた。`;

// 1. Initialize Kuromoji and Load Stop Words
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
        
        renderStopWords();
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
            const word = e.target.getAttribute('data-word');
            customStopWords.delete(word);
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
            const word = e.target.getAttribute('data-word');
            customCompoundWords.delete(word);
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
    
    const words = word.split(/[,\s，、]+/).map(w => w.trim()).filter(w => w.length > 0);
    
    let added = false;
    words.forEach(w => {
        if (!customCompoundWords.has(w)) {
            customCompoundWords.add(w);
            added = true;
        }
    });

    if (added) {
        renderCompoundWords();
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
    // Guard: if tokenizer is not yet ready, warn and abort
    if (!tokenizer) {
        alert("辞書の読み込みが完了していません。しばらくお待ちください。");
        return;
    }
    rawTextData = text;
    const lines = rawTextData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    opinionLinesCount = lines.length;
    
    // Process heavy tokenization only ONCE when loading raw text
    globalAnalyzedLines = lines.map(line => tokenizer.tokenize(line));
    
    processAndRender();
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

function parseCSVText(text) {
    const lines = [];
    let curLine = [];
    let curVal = '';
    let inQuotes = false;
    
    // Detect delimiter (comma vs tab vs semicolon)
    const firstLineEnd = text.indexOf('\n');
    const sampleLine = firstLineEnd !== -1 ? text.substring(0, firstLineEnd) : text;
    let delimiter = ',';
    if ((sampleLine.match(/\t/g) || []).length > (sampleLine.match(/,/g) || []).length) {
        delimiter = '\t';
    } else if ((sampleLine.match(/;/g) || []).length > (sampleLine.match(/,/g) || []).length) {
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
                curLine.push(curVal.trim());
                curVal = '';
            } else if (char === '\r') {
                // ignore \r
            } else if (char === '\n') {
                curLine.push(curVal.trim());
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
        curLine.push(curVal.trim());
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
    
    if (!csvModalOverlay || !csvColumnSelect) return;

    csvColumnSelect.innerHTML = '';
    const colCount = rows[0].length;
    
    for (let colIdx = 0; colIdx < colCount; colIdx++) {
        const headerName = rows[0][colIdx] || `列 ${colIdx + 1}`;
        let sampleVal = "";
        for (let r = 1; r < Math.min(10, rows.length); r++) {
            if (rows[r] && rows[r][colIdx] && rows[r][colIdx].trim()) {
                sampleVal = rows[r][colIdx].trim();
                break;
            }
        }
        if (!sampleVal && rows[0][colIdx]) sampleVal = rows[0][colIdx];
        
        const option = document.createElement('option');
        option.value = colIdx;
        const shortSample = sampleVal.length > 25 ? sampleVal.substring(0, 25) + "..." : sampleVal;
        option.innerText = `列 ${colIdx + 1}: ${headerName} (例: ${shortSample || '空'})`;
        csvColumnSelect.appendChild(option);
    }

    function updatePreview() {
        const selectedCol = parseInt(csvColumnSelect.value) || 0;
        let samples = [];
        for (let r = 1; r < Math.min(6, rows.length); r++) {
            if (rows[r] && rows[r][selectedCol] && rows[r][selectedCol].trim()) {
                samples.push(`・${rows[r][selectedCol].trim()}`);
            }
        }
        if (samples.length === 0 && rows[0] && rows[0][selectedCol]) {
            samples.push(`・${rows[0][selectedCol].trim()}`);
        }
        csvColumnPreview.innerHTML = samples.join('<br>') || '（プレビューなし）';
    }

    csvColumnSelect.onchange = updatePreview;
    updatePreview();

    csvModalOverlay.style.display = 'flex';
}

function initCSVModalListeners() {
    const csvModalOverlay = document.getElementById('csv-modal-overlay');
    const csvModalCloseBtn = document.getElementById('csv-modal-close-btn');
    const csvCancelBtn = document.getElementById('csv-cancel-btn');
    const csvConfirmBtn = document.getElementById('csv-confirm-btn');
    const csvColumnSelect = document.getElementById('csv-column-select');

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

            const extractedTextLines = [];
            for (let r = 1; r < pendingCsvRows.length; r++) {
                if (pendingCsvRows[r] && pendingCsvRows[r][selectedCol] !== undefined) {
                    const val = pendingCsvRows[r][selectedCol].trim();
                    if (val.length > 0) extractedTextLines.push(val);
                }
            }

            if (extractedTextLines.length === 0) {
                for (let r = 0; r < pendingCsvRows.length; r++) {
                    if (pendingCsvRows[r] && pendingCsvRows[r][selectedCol] !== undefined) {
                        const val = pendingCsvRows[r][selectedCol].trim();
                        if (val.length > 0) extractedTextLines.push(val);
                    }
                }
            }

            csvModalOverlay.style.display = 'none';
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

        const isCsv = file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.tsv');
        if (isCsv) {
            const rows = parseCSVText(text);
            if (rows.length > 0 && rows[0].length > 1) {
                showCSVColumnModal(file.name, rows);
                return;
            }
        }
        loadTextAndTokenize(text);
    };
    // Read as ArrayBuffer to allow manual byte decoding
    reader.readAsArrayBuffer(file);
}

sampleBtn.addEventListener('click', () => {
    fileInfo.innerText = "デモデータ適用中";
    loadTextAndTokenize(SAMPLE_TEXT);
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

// Settings that require complete NLP reprocessing and clustering recalculation
// Note: displayType is intentionally excluded here; its change handler is defined
// separately below to also call updateClusterCountGroupVisibility().
[posNoun, posVerb, posAdj, posAdv, document.getElementById('ranking-method')].forEach(elem => {
    elem.addEventListener('change', () => {
        if (rawTextData) {
            processAndRender();
        }
    });
});

// Settings that only require redrawing/rendering updates (no K-means recalculation)
[colorTheme, fontSelect, shapeCircle, rotateText].forEach(elem => {
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
                <div class="tips-note">💡 「最小出現回数」を上げるとノイズが減り、テーマがくっきりします。「最大表示単語数」を絞ると主要な関係だけが残ります。</div>
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

[clusterCount].forEach(elem => {
    elem.addEventListener('change', () => {
        if (rawTextData) {
            processAndRender();
        }
    });
    elem.addEventListener('input', () => {
        if (rawTextData) {
            processAndRender();
        }
    });
});

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
        let hoveredNode = null;
        for (let i = networkNodes.length - 1; i >= 0; i--) { let node = networkNodes[i];
            const dx = mouseX - node.x;
            const dy = mouseY - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= node.radius) {
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
                
            const connText = connections ? `<br>主な共起語: ${connections}` : '';
            tooltip.innerHTML = `<strong>${hoveredNode.id}</strong><br>出現回数: ${hoveredNode.count}回<br>グループ: ${hoveredNode.communityLabel}${connText}<br><small style="color: var(--text-muted)">ダブルクリックで除外</small>`;
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
            
            tooltip.innerHTML = `<strong>${hoveredPoint.word}</strong><br>出現回数: ${hoveredPoint.count}回<br>クラスター: C${hoveredPoint.cluster + 1}<br><small style="color: var(--text-muted)">ダブルクリックで除外</small>`;
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
        const jaccard = fAB / (cA + cB - fAB);
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

// Merge tokens that match custom compound words
function mergeCompoundWords(tokens, compoundWordsSet) {
    if (compoundWordsSet.size === 0) return tokens;
    
    // Sort compound words by length descending so longer phrases match first
    const compounds = Array.from(compoundWordsSet).sort((a, b) => b.length - a.length);
    
    let mergedTokens = [];
    let i = 0;
    while (i < tokens.length) {
        let matched = false;
        for (const cw of compounds) {
            let combinedStr = "";
            let j = i;
            while (j < tokens.length && combinedStr.length < cw.length) {
                combinedStr += tokens[j].surface_form;
                j++;
            }
            if (combinedStr === cw) {
                mergedTokens.push({
                    surface_form: cw,
                    pos: '名詞', // Force to Noun
                    pos_detail_1: '複合語',
                    basic_form: cw
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
function processAndRender() {
    if (!tokenizer || !rawTextData || globalAnalyzedLines.length === 0) return;

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

    globalAnalyzedLines.forEach(originalTokens => {
        const tokens = mergeCompoundWords(originalTokens, customCompoundWords);
        const uniqueWordsInLine = new Set();
        
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

            if (word.length === 1 && /^[ぁ-んァ-ヶ]$/.test(word)) return;
            if (/^[0-9０-９\s\.\,\-\_]+$/.test(word)) return;
            if (defaultStopWordsSet.has(word) || defaultStopWordsSet.has(word.toLowerCase())) return;
            if (customStopWords.has(word) || customStopWords.has(word.toLowerCase())) return;

            counts[word] = (counts[word] || 0) + 1;
            uniqueWordsInLine.add(word);
        });

        uniqueWordsPerLine.push(uniqueWordsInLine);

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

    // --- MINIMUM DATA WARNING ---
    const dataWarningEl = document.getElementById('data-warning');
    if (dataWarningEl) {
        if (opinionLinesCount < 10) {
            dataWarningEl.textContent = `⚠️ データが少なすぎます (${opinionLinesCount}行)。共起・PCA分析には20行以上を推奨します。`;
            dataWarningEl.style.display = 'inline';
            dataWarningEl.style.color = '#EF4444';
        } else if (opinionLinesCount < 20) {
            dataWarningEl.textContent = `⚠️ 分析精度向上のため20行以上を推奨 (現在${opinionLinesCount}行)`;
            dataWarningEl.style.display = 'inline';
            dataWarningEl.style.color = '#F59E0B';
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
        const jaccard = fAB / (cA + cB - fAB);
        if (jaccard > 0.04) {
            rawEdges.push({ sourceId: w1, targetId: w2, weight: jaccard });
        }
    });
    
    rawEdges.sort((a, b) => b.weight - a.weight);
    
    // Filter to only meaningfully strong connections
    const strictEdges = rawEdges.filter(e => e.weight > 0.05);
    
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
        nodesList.sort(() => Math.random() - 0.5);
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
        
        const k = parseInt(clusterCount.value) || 3;
        const assignments = runKMeans(rawPoints, k);
        
        pcaPoints = rawPoints.map((pt, i) => {
            pt.cluster = assignments[i];
            return pt;
        });
    } else {
        pcaPoints = [];
    }

    resizeCanvas();
    updateWordCloud();
}

// Get color schemes
function getColorScheme(theme) {
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
    const maxVal = getValue(list[0]);
    
    const scaleFactor = canvas.width / 1024;
    
    const topMargin = 60 * scaleFactor;
    const bottomMargin = 40 * scaleFactor;
    const leftMargin = 180 * scaleFactor;
    const rightMargin = 140 * scaleFactor;
    
    const availableHeight = canvas.height - topMargin - bottomMargin;
    const rowHeight = availableHeight / list.length;
    const barHeight = Math.max(12 * scaleFactor, Math.min(24 * scaleFactor, rowHeight * 0.6));
    
    const barWidthArea = canvas.width - leftMargin - rightMargin;
    const colorGenerator = getColorScheme(selectedTheme);
    
    list.forEach((item, index) => {
        const val = getValue(item);
        const barWidth = maxVal > 0 ? (val / maxVal) * barWidthArea : 0;
        const color = colorGenerator(index);
        
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
function getNetworkNodeColor(theme, index, isDarkTheme) {
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
    const x = 25 * scaleFactor;
    const y = canvasHeight - 110 * scaleFactor;
    
    ctx.save();
    
    ctx.fillStyle = isDarkTheme ? 'rgba(22, 31, 48, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1 * scaleFactor;
    
    ctx.beginPath();
    const w = 240 * scaleFactor;
    const h = 85 * scaleFactor;
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
    ctx.textBaseline = 'top';
    ctx.fillStyle = isDarkTheme ? '#F3F4F6' : '#111111';
    ctx.font = `bold ${Math.round(11 * scaleFactor)}px ${selectedFont}`;
    ctx.fillText("凡例 (Legend)", x + 12 * scaleFactor, y + 8 * scaleFactor);
    
    ctx.font = `${Math.round(9.5 * scaleFactor)}px ${selectedFont}`;
    ctx.fillStyle = isDarkTheme ? '#9CA3AF' : '#4B5563';
    ctx.fillText("円の大きさ: 出現回数", x + 12 * scaleFactor, y + 25 * scaleFactor);
    
    const cY = y + 44 * scaleFactor;
    const rSmall = 5 * scaleFactor;
    const rLarge = 12 * scaleFactor;
    
    ctx.beginPath();
    ctx.arc(x + 22 * scaleFactor, cY, rSmall, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkTheme ? '#6B7280' : '#9CA3AF';
    ctx.fill();
    ctx.fillText(`${minCount}回`, x + 34 * scaleFactor, cY - 4 * scaleFactor);
    
    ctx.beginPath();
    ctx.arc(x + 85 * scaleFactor, cY, rLarge, 0, 2 * Math.PI);
    ctx.fillStyle = isDarkTheme ? '#6B7280' : '#9CA3AF';
    ctx.fill();
    ctx.fillText(`${maxCount}回`, x + 104 * scaleFactor, cY - 4 * scaleFactor);
    
    ctx.fillText("線の太さ: 共起の強さ (Jaccard係数)", x + 12 * scaleFactor, y + 64 * scaleFactor);
    
    const lY = y + 75 * scaleFactor;
    ctx.beginPath();
    ctx.moveTo(x + 20 * scaleFactor, lY);
    ctx.lineTo(x + 55 * scaleFactor, lY);
    ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1 * scaleFactor;
    ctx.stroke();
    ctx.fillText("弱い", x + 60 * scaleFactor, lY - 4 * scaleFactor);
    
    ctx.beginPath();
    ctx.moveTo(x + 110 * scaleFactor, lY);
    ctx.lineTo(x + 145 * scaleFactor, lY);
    ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 5 * scaleFactor;
    ctx.stroke();
    ctx.fillText("強い", x + 150 * scaleFactor, lY - 4 * scaleFactor);
    
    ctx.restore();
}

// Helper to draw the Co-occurrence Network on any canvas
function drawNetworkOnCanvas(canvas, nodes, edges, selectedTheme, selectedFont, isDarkTheme, customScale = null) {
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
        const color = getNetworkNodeColor(selectedTheme, node.communityIndex, isDarkTheme);
        
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
    const counts = nodes.map(n => n.count);
    const minCount = counts.length > 0 ? Math.min(...counts) : 1;
    const maxCount = counts.length > 0 ? Math.max(...counts) : 1;
    drawNetworkLegend(ctx, canvas.width, canvas.height, isDarkTheme, minCount, maxCount, selectedFont);
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
    
    const k = parseInt(clusterCount.value) || 3;
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
    if (networkAnimationFrameId) {
        cancelAnimationFrame(networkAnimationFrameId);
        networkAnimationFrameId = null;
    }

    if (wordFrequencies.length === 0) {
        emptyState.style.display = 'flex';
        downloadBtn.disabled = true;
        exportWordsCsvBtn.disabled = true;
        exportPairsCsvBtn.disabled = true;
        return;
    }

    emptyState.style.display = 'none';
    downloadBtn.disabled = false;
    exportWordsCsvBtn.disabled = false;
    exportPairsCsvBtn.disabled = false;

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
        return;
    }

    if (currentDisplayType === 'cloud') {
        cloudCanvas.style.display = 'block';
        chartContainer.style.display = 'none';
        
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

        WordCloud(cloudCanvas, {
            list: list,
            gridSize: Math.round(16 * cloudCanvas.width / 1024),
            weightFactor: 1,
            fontFamily: selectedFont,
            color: getColorScheme(selectedTheme),
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
                tooltip.innerHTML = `<strong>${word}</strong><br>出現回数: ${count}回<br>特徴度 (TF-IDF): ${tfidfFormatted}<br><small style="color: var(--text-muted)">ダブルクリックで除外</small>`;
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
        
        const chartList = filteredList.slice(0, 20);
        const selectedFont = fontSelect.value;
        
        drawBarChartOnCanvas(cloudCanvas, chartList, rankingMethod, selectedTheme, selectedFont, isDarkTheme);
    } else if (currentDisplayType === 'network') {
        cloudCanvas.style.display = 'block';
        chartContainer.style.display = 'none';

        const selectedFont = fontSelect.value;
        
        const prevNodeMap = new Map();
        networkNodes.forEach(n => prevNodeMap.set(n.id, { x: n.x, y: n.y }));
        
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

        const maxTicks = 220;
        let ticks = 0;
        
        function simulationTick() {
            if (ticks >= maxTicks) {
                cancelAnimationFrame(networkAnimationFrameId);
                networkAnimationFrameId = null;
                return;
            }

            const repulsion = 300;
            for (let i = 0; i < networkNodes.length; i++) {
                const n1 = networkNodes[i];
                for (let j = i + 1; j < networkNodes.length; j++) {
                    const n2 = networkNodes[j];
                    const dx = n2.x - n1.x;
                    const dy = n2.y - n1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    
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
                const dx = edge.target.x - edge.source.x;
                const dy = edge.target.y - edge.source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                
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

            drawNetworkOnCanvas(cloudCanvas, networkNodes, networkEdges, selectedTheme, selectedFont, isDarkTheme);
            
            ticks++;
            networkAnimationFrameId = requestAnimationFrame(simulationTick);
        }

        simulationTick();
    } else if (currentDisplayType === 'pca') {
        cloudCanvas.style.display = 'block';
        chartContainer.style.display = 'none';
        
        const selectedFont = fontSelect.value;
        drawPCAOnCanvas(cloudCanvas, pcaPoints, selectedTheme, selectedFont, isDarkTheme);
    }
}

// 6. Download Word Cloud, Bar Chart, Network Diagram, or PCA Scatter Plot as Image
downloadBtn.addEventListener('click', () => {
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

            WordCloud(exportCanvas, {
                list: list,
                gridSize: Math.round(16 * exportCanvas.width / 1024),
                weightFactor: 1,
                fontFamily: selectedFont,
                color: getColorScheme(selectedTheme),
                rotateRatio: isRotate ? 0.35 : 0,
                rotationSteps: 2,
                backgroundColor: isDarkTheme ? '#0B0F19' : '#FFFFFF',
                shape: drawShape,
                ellipticity: 0.65,
                shuffle: false,
                drawOutOfBound: false
            });

            exportCanvas.addEventListener('wordcloudstop', () => {
                const image = exportCanvas.toDataURL("image/png");
                const link = document.createElement('a');
                link.download = 'wordcloud.png';
                link.href = image;
                link.click();
                
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
            const link = document.createElement('a');
            link.download = 'barchart.png';
            link.href = image;
            link.click();
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
            const link = document.createElement('a');
            link.download = 'network_diagram.png';
            link.href = image;
            link.click();
        } else if (currentMode === 'pca') {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetSize.w;
            exportCanvas.height = targetSize.h;

            const selectedFont = fontSelect.value;
            drawPCAOnCanvas(exportCanvas, pcaPoints, selectedTheme, selectedFont, isDarkTheme);

            const image = exportCanvas.toDataURL("image/png");
            const link = document.createElement('a');
            link.download = 'pca_scatter.png';
            link.href = image;
            link.click();
        }
    } catch (error) {
        console.error("PNG export failed:", error);
        alert("画像の書き出しに失敗しました。\nエラー内容: " + error.message);
    }
});

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

function openKWICModal(word, count) {
    if (!word) return;
    kwicWordTitle.textContent = word;
    kwicWordCount.textContent = count || "-";
    
    kwicTbody.innerHTML = '';
    
    let matchCount = 0;
    const maxDisplay = 1000;
    
    for (let i = 0; i < globalAnalyzedLines.length; i++) {
        // Merge compound words just like we do in processAndRender
        const originalTokens = globalAnalyzedLines[i];
        if (!originalTokens || originalTokens.length === 0) continue;
        const tokens = mergeCompoundWords(originalTokens, customCompoundWords);
        
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
    
    kwicOverlay.style.display = 'flex';
}

function closeKWICModal() {
    kwicOverlay.style.display = 'none';
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
