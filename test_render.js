const fs = require('fs');

// Simple DOM Mock
class Element {
    constructor(id) {
        this.id = id;
        this.style = {};
        this.classList = {
            toggle: () => {},
            add: () => {},
            remove: () => {}
        };
        this.innerHTML = '';
        this.children = [];
        this.value = '10'; // dummy input value
    }
    appendChild(el) {
        this.children.push(el);
    }
}

const mockDOM = {
    'dekad': new Element('dekad'),
    'rain-anomaly': new Element('rain-anomaly'),
    'pivots_active': new Element('pivots_active'),
    'rf_cumul': new Element('rf_cumul'),
    'sm_rel': new Element('sm_rel'),
    'analysis-grid': new Element('analysis-grid'),
    'export-grid': new Element('export-grid'),
    'ledger-body': new Element('ledger-body'),
    'shap-summary': new Element('shap-summary'),
    't-light': new Element('t-light'),
    't-white': new Element('t-white'),
    't-dark': new Element('t-dark'),
    't-black': new Element('t-black')
};

global.document = {
    getElementById: (id) => mockDOM[id] || null,
    createElement: (tag) => new Element('none'),
    querySelector: () => new Element('hero')
};

global.window = {
    onload: null
};

global.localStorage = {
    store: {},
    getItem: function(k) { return this.store[k] || null; },
    setItem: function(k, v) { this.store[k] = v; }
};

// Load the file
const code = fs.readFileSync('script.js', 'utf8');
eval(code);

// Run onload
if (window.onload) window.onload();

console.log("GLOBAL_MEMBERS length:", GLOBAL_MEMBERS.length);

tab('analysis');
console.log("Analysis grid children:", mockDOM['analysis-grid'].children.length);

tab('export');
console.log("Export grid children:", mockDOM['export-grid'].children.length);

tab('model');
console.log("SHAP innerHTML length:", mockDOM['shap-summary'].innerHTML.length);
