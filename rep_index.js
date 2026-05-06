const fs = require('fs');
let content = fs.readFileSync('index_v2.html', 'utf8');

const reps = [
  ['<div class="status-dot">llama-3.1 · live</div>', '<div class="status-dot" id="status-dot">llama-3.1 · live</div>'],
  ['let isGenerating = false; // in-flight guard', 'let isGenerating = false; // in-flight guard\nlet currentAbortController = null;'],
  ['function getSlideItems() {\n  return Array.from(document.querySelectorAll(\'#slides-list .slide-item\')).map((item, i) => ({\n    title: item.querySelector(\'.s-title-inp\')?.value.trim() || `Slide ${i + 1}`,\n    needs_visual: item.querySelector(\'input[type="checkbox"]\')?.checked ?? true,\n    visual_type: item.querySelector(\'select\')?.value || \'auto\'\n  }));\n}', 'function getSlideItems() {\n  return Array.from(document.querySelectorAll(\'#slides-list .slide-item\')).map((item, i) => {\n    const rawVal = item.querySelector(\'.s-title-inp\')?.value.trim();\n    return {\n      title: rawVal || "",\n      needs_visual: item.querySelector(\'input[type="checkbox"]\')?.checked ?? true,\n      visual_type: item.querySelector(\'select\')?.value || \'auto\'\n    };\n  });\n}'],
  ['function validateSlideRange() {\n  const minEl = document.getElementById(\'min-slides\');\n  const maxEl = document.getElementById(\'max-slides\');\n  const genBtn = document.getElementById(\'generate-btn\');\n  const min = parseInt(minEl.value, 10) || 3;\n  const max = parseInt(maxEl.value, 10) || 32;\n  if (min > max) {\n    minEl.style.borderColor = \'var(--signal)\';\n    maxEl.style.borderColor = \'var(--signal)\';\n    genBtn.disabled = true;\n    showError(\'Min slides cannot be greater than max slides.\');\n  } else {\n    minEl.style.borderColor = \'\';\n    maxEl.style.borderColor = \'\';\n    genBtn.disabled = false;\n    clearError();\n  }\n}', 'function validateSlideRange() {\n  const minEl = document.getElementById(\'min-slides\');\n  const maxEl = document.getElementById(\'max-slides\');\n  const genBtn = document.getElementById(\'generate-btn\');\n  const min = parseInt(minEl.value, 10) || 3;\n  const max = parseInt(maxEl.value, 10) || 32;\n  let errorMsg = null;\n\n  if (min > max) errorMsg = \'Min slides cannot be greater than max slides.\';\n  else if (min < 3 || max < 3) errorMsg = \'Minimum slides allowed is 3.\';\n  else if (min > 32 || max > 32) errorMsg = \'Maximum slides allowed is 32.\';\n\n  if (errorMsg) {\n    minEl.style.borderColor = \'var(--signal)\';\n    maxEl.style.borderColor = \'var(--signal)\';\n    genBtn.disabled = true;\n    showError(errorMsg);\n  } else {\n    minEl.style.borderColor = \'\';\n    maxEl.style.borderColor = \'\';\n    genBtn.disabled = false;\n    clearError();\n  }\n}'],
  ['    const res = await fetch(\'/api/generate\', {\n      method: \'POST\',\n      headers: { \'Content-Type\': \'application/json\' },\n      body: JSON.stringify(payload)\n    });\n    const data = await res.json();', '    currentAbortController = new AbortController();\n    const res = await fetch(\'/api/generate\', {\n      method: \'POST\',\n      headers: { \'Content-Type\': \'application/json\' },\n      body: JSON.stringify(payload),\n      signal: currentAbortController.signal\n    });\n    const data = await res.json();'],
  ['  } catch (err) {\n    clearInterval(progInterval);\n    showError(err.message);\n  } finally {', '  } catch (err) {\n    clearInterval(progInterval);\n    if (err.name === \'AbortError\') {\n      console.log(\'Generation aborted by user.\');\n    } else {\n      showError(err.message);\n    }\n  } finally {'],
  ['  } finally {\n    isGenerating = false;\n    setLoading(false);\n    bar.style.width = \'0%\';\n    btn.disabled = false;\n    genLabel.textContent = \'Generate presentation\';\n    document.getElementById(\'status-dot\').innerHTML = \'System · Ready\';\n  }', '  } finally {\n    currentAbortController = null;\n    isGenerating = false;\n    setLoading(false);\n    bar.style.width = \'0%\';\n    btn.disabled = false;\n    genLabel.textContent = \'Generate presentation\';\n    document.getElementById(\'status-dot\').innerHTML = \'System · Ready\';\n  }'],
  ['    <div class="slide-content-title">${escapeHTML(slide.title)}</div>\n    <div class="${gridClass}">\n      <ul class="slide-bullets">${bullets}</ul>\n      ${visualHTML}\n    </div>`;\n}', '    <div class="slide-content-title">${escapeHTML(slide.title)}</div>\n    ${slide.subtitle && !isTitleSlide ? `<div class="slide-subtitle" style="margin-top:calc(-1 * var(--s2)); margin-bottom:var(--s4); opacity:0.8;">${escapeHTML(slide.subtitle)}</div>` : \'\'}\n    <div class="${gridClass}">\n      <ul class="slide-bullets">${bullets}</ul>\n      ${visualHTML}\n    </div>`;\n}'],
  ['function navigate(dir) {\n  const next = currentIdx + dir;\n  if (next >= 0 && next < slides.length) renderSlide(next);\n}', 'function navigate(dir) {\n  if (isExporting) return;\n  const next = currentIdx + dir;\n  if (next >= 0 && next < slides.length) renderSlide(next);\n}'],
  ['function goTo(idx) { renderSlide(idx); }', 'function goTo(idx) { if (isExporting) return; renderSlide(idx); }'],
  ['document.addEventListener(\'keydown\', e => {\n  // Only fire keyboard nav when NOT focused inside a text input or textarea\n  const tag = document.activeElement?.tagName;\n  if (tag === \'INPUT\' || tag === \'TEXTAREA\' || tag === \'SELECT\') return;\n  if (!presentationData || !slides || !slides.length) return;\n  if (e.key === \'ArrowRight\' || e.key === \'ArrowDown\') navigate(1);\n  if (e.key === \'ArrowLeft\'  || e.key === \'ArrowUp\')   navigate(-1);\n});\n</script>', 'document.addEventListener(\'keydown\', e => {\n  if (isExporting) return;\n  // Only fire keyboard nav when NOT focused inside a text input or textarea\n  const tag = document.activeElement?.tagName;\n  if (tag === \'INPUT\' || tag === \'TEXTAREA\' || tag === \'SELECT\') return;\n  if (!presentationData || !slides || !slides.length) return;\n  if (e.key === \'ArrowRight\' || e.key === \'ArrowDown\') navigate(1);\n  if (e.key === \'ArrowLeft\'  || e.key === \'ArrowUp\')   navigate(-1);\n});\n</script>'],
  ['function resetView() {\n  window.scrollTo({ top: 0, behavior: \'smooth\' });\n  slides          = [];', 'function resetView() {\n  if (currentAbortController) {\n    currentAbortController.abort();\n    currentAbortController = null;\n  }\n  window.scrollTo({ top: 0, behavior: \'smooth\' });\n  slides          = [];']
];

reps.forEach((r, i) => {
  // exact check
  let found = content.includes(r[0]);
  if (!found) {
    // try to fix `System · Ready` parsing issue if needed
    if (r[0].includes('System · Ready')) {
      const alt = r[0].replace('·', '');
      if (content.includes(alt)) {
         r[0] = alt;
         found = true;
      }
    }
  }

  if (found) {
    content = content.replace(r[0], r[1]);
  } else {
    console.log("MISSING Chunk " + (i+1) + ": " + r[0].substring(0, 40));
  }
});

fs.writeFileSync('index_v2.html', content);
console.log('done index');
