document.addEventListener('DOMContentLoaded', () => {
  const navigateButtons = document.querySelectorAll('[data-navigate]');

  navigateButtons.forEach(button => {
    button.addEventListener('click', () => {
      const page = button.dataset.navigate;
      if (window.electronAPI && window.electronAPI.navigateTo) {
        window.electronAPI.navigateTo(page);
      } else {
        console.error('Electron API not available or navigateTo function missing.');
      }
    });
  });
});
