const fs = require('fs');
const lines = fs.readFileSync('index_v2.html', 'utf8').split('\n');

const extract = (str, nLines) => {
  const i = lines.findIndex(l => l.includes(str));
  if (i !== -1) {
    console.log('--- ' + str + ' ---');
    console.log(lines.slice(i, i + nLines).join('\n'));
  }
}

extract('<div class="status-dot">llama-3.1', 1);
extract('let isGenerating = false;', 1);
extract('function getSlideItems() {', 7);
extract('function validateSlideRange() {', 18);
extract('async function generate() {', 2);
extract('const res = await fetch', 6);
extract('} catch (err) {', 4);
extract('} finally {', 8);
extract('<div class="slide-content-title">', 6);
extract('function navigate(dir) {', 4);
extract('function goTo(idx) {', 1);
extract('document.addEventListener(\'keydown\',', 9);
extract('function resetView() {', 3);
