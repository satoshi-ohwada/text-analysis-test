const fs = require('fs');

const coocCounts = {
    'A|||B': 10,
    'A|||C': 5,
    'B|||C': 2,
    'D|||E': 1
};
const docFreq = {
    'A': 10, 'B': 10, 'C': 10, 'D': 1, 'E': 1
};

const rawEdges = [];
Object.entries(coocCounts).forEach(([key, fAB]) => {
    const [w1, w2] = key.split('|||');
    const cA = docFreq[w1] || 0;
    const cB = docFreq[w2] || 0;
    const jaccard = fAB / (cA + cB - fAB);
    if (jaccard > 0.05) {
        rawEdges.push({ sourceId: w1, targetId: w2, weight: jaccard });
    }
});

rawEdges.sort((a, b) => b.weight - a.weight);
console.log("Raw edges:", rawEdges);

const weights = rawEdges.map(e => e.weight);
const minWeight = weights.length > 0 ? Math.min(...weights) : 0.05;
const maxWeight = weights.length > 0 ? Math.max(...weights) : 1;

console.log("minWeight:", minWeight, "maxWeight:", maxWeight);

rawEdges.forEach(edge => {
    let thickness = 1.5;
    let opacity = 0.15;

    if (maxWeight > minWeight) {
        thickness = 1 + ((edge.weight - minWeight) / (maxWeight - minWeight)) * 6.5;
        opacity = 0.15 + ((edge.weight - minWeight) / (maxWeight - minWeight)) * 0.7;
    } else {
        thickness = 1 + (edge.weight * 6.5);
        opacity = 0.15 + (edge.weight * 0.7);
    }
    console.log(`Edge ${edge.sourceId}-${edge.targetId} (w=${edge.weight.toFixed(3)}): thickness=${thickness.toFixed(2)}, opacity=${opacity.toFixed(2)}`);
});
