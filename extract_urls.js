const fs = require('fs');
const path = require('path');

const filePath = 'd:\\works\\code\\nestjs\\google-maps-resolver\\html\\response-2026-02-12T01-55-00-352Z.html';
const content = fs.readFileSync(filePath, 'utf8');

// Regex for URLs
const urlRegex = /(https?:\/\/[^\s\"\'\<\>]+|\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}[^\s\"\'\<\>]*|(?<=\")\/maps\/[^\s\"\'\<\>]*)/g;

const matches = content.match(urlRegex) || [];
const uniqueUrls = [...new Set(matches.map(u => u.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&')))];

console.log('--- List of URLs found ---');
uniqueUrls.sort().forEach(url => {
    console.log(url);
});
