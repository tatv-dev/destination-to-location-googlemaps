const fs = require('fs');
const path = require('path');

const filePath = 'd:\\works\\code\\nestjs\\google-maps-resolver\\html\\67_50____Nguy_n_V_n_C___T__7__Long_Bi_n__H__N_i__V_2026-02-12T03-24-34-533Z.html';
const content = fs.readFileSync(filePath, 'utf8');

// Regex for URLs
const urlRegex = /(https?:\/\/[^\s\"\'\<\>]+|\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}[^\s\"\'\<\>]*|(?<=\")\/maps\/[^\s\"\'\<\>]*)/g;

const matches = content.match(urlRegex) || [];
const uniqueUrls = [...new Set(matches.map(u => u.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&')))];

console.log('--- List of URLs found ---');
uniqueUrls.sort().forEach(url => {
    console.log(url);
});
