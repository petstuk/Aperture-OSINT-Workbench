(function () {
  var api = typeof browser !== 'undefined' ? browser : chrome;
  var url = api.runtime.getURL('dashboard.html') + (location.hash || '#overview');
  var link = document.getElementById('link');
  if (link) link.href = url;
  location.replace(url);
})();
