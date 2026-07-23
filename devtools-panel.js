document.getElementById('go').addEventListener('click', () => {
  const raw = document.getElementById('raw').value;
  let text = raw;
  try {
    const har = JSON.parse(raw);
    const urls = [];
    const entries = (har.log && har.log.entries) || [];
    entries.forEach((e) => {
      if (e.request && e.request.url) urls.push(e.request.url);
      if (e.response && e.response.url) urls.push(e.response.url);
    });
    text = urls.join('\n');
  } catch (_) {
    /* treat as plain text */
  }
  const parsed = IOCUtils.parse(text);
  document.getElementById('out').textContent = JSON.stringify(parsed, null, 2);
});
