/**
 * trawangan — Landing Page Interactive Engine
 * Mendeteksi OS pengunjung secara otomatis dan mengatur interaksi galeri showcase.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Deteksi Sistem Operasi Pengunjung
  const ctaLabel = document.getElementById('cta-target-os');
  const mainCta = document.getElementById('dynamic-download-cta');

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator?.userAgentData?.platform?.toLowerCase() || window.navigator.platform?.toLowerCase() || '';

  let detectedOs = 'windows';

  if (platform.includes('mac') || userAgent.includes('macintosh') || userAgent.includes('mac os')) {
    detectedOs = 'macos';
  } else if (platform.includes('linux') || userAgent.includes('linux') || userAgent.includes('x11')) {
    detectedOs = 'linux';
  } else if (platform.includes('win') || userAgent.includes('windows')) {
    detectedOs = 'windows';
  }

  if (ctaLabel) {
    if (detectedOs === 'macos') {
      ctaLabel.textContent = 'Unduh untuk macOS (.dmg)';
    } else if (detectedOs === 'linux') {
      ctaLabel.textContent = 'Unduh untuk Linux (.AppImage)';
    } else {
      ctaLabel.textContent = 'Unduh untuk Windows (.exe)';
    }
  }

  // 2. Interaktivitas Tab Galeri Showcase
  const tabButtons = document.querySelectorAll('.gallery-tab-btn');
  const panels = document.querySelectorAll('.gallery-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');

      // Update button active state
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Update panel visibility
      panels.forEach((panel) => {
        panel.classList.remove('active');
        if (panel.id === `panel-${targetId}`) {
          panel.classList.add('active');
        }
      });
    });
  });

  // 3. Smooth Scroll Enhancement untuk Anchor Navigasi
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetHref = this.getAttribute('href');
      if (targetHref === '#' || targetHref.length <= 1) return;

      const targetEl = document.querySelector(targetHref);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});
