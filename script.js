document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.nav-tab');
  const sections = document.querySelectorAll('.tab-content');
  let activeTab = null;
  let hoverTimeout = null;

  function update(tabName) {
    sections.forEach(s => s.classList.toggle('visible', s.id === tabName));
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      clearTimeout(hoverTimeout);
      activeTab = tab.dataset.tab;
      update(activeTab);
    });
    tab.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => update(tab.dataset.tab), 200);
    });
    tab.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      update(activeTab);
    });
  });
});
