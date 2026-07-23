const fs = require('fs');

// Read app.js and try to run the calculation logic on a dummy text
const appjs = fs.readFileSync('app.js', 'utf8');

console.log("Checking if minWeight and maxWeight can be the same...");

// Mock variables
let docFreq = {
    'A': 1, 'B': 1, 'C': 1
};
let fAB = 1;

let cA = docFreq['A'] || 0;
let cB = docFreq['B'] || 0;
let jaccard = fAB / (cA + cB - fAB);
console.log("Jaccard:", jaccard);
