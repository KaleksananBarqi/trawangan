/**
 * trawangan: Landing Page Interactive Engine
 * Mendeteksi OS pengunjung, mengatur navigasi mobile, galeri showcase, dan akordion FAQ.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Deteksi Sistem Operasi Pengunjung
  const ctaLabel = document.getElementById('cta-target-os');
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

  // 2. Navigasi Mobile Responsif (R-03, R-32, R-39)
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.contains('nav-open');
      if (isOpen) {
        navMenu.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      } else {
        navMenu.classList.add('nav-open');
        navToggle.setAttribute('aria-expanded', 'true');
      }
    });

    // Tutup menu saat pengguna mengklik link navigasi
    navMenu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Tutup menu saat menekan tombol Escape (R-32)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('nav-open')) {
        navMenu.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }

  // 3. Tab Galeri Showcase dengan Dukungan Keyboard WAI-ARIA (R-32, R-39)
  const tabButtons = Array.from(document.querySelectorAll('.gallery-tab-btn'));
  const panels = Array.from(document.querySelectorAll('.gallery-panel'));

  function activateTab(index) {
    const btn = tabButtons[index];
    if (!btn) return;
    const targetId = btn.getAttribute('data-target');

    tabButtons.forEach((b, i) => {
      const isActive = i === index;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      b.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach((panel) => {
      const isActive = panel.id === `panel-${targetId}`;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });

    btn.focus();
  }

  tabButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      activateTab(index);
    });

    btn.addEventListener('keydown', (e) => {
      let targetIndex = index;

      if (e.key === 'ArrowRight') {
        targetIndex = (index + 1) % tabButtons.length;
        e.preventDefault();
        activateTab(targetIndex);
      } else if (e.key === 'ArrowLeft') {
        targetIndex = (index - 1 + tabButtons.length) % tabButtons.length;
        e.preventDefault();
        activateTab(targetIndex);
      } else if (e.key === 'Home') {
        e.preventDefault();
        activateTab(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        activateTab(tabButtons.length - 1);
      }
    });
  });

  // 4. Smooth Scroll Enhancement untuk Anchor Navigasi
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

  // 5. Interaktivitas Akordion FAQ (R-32, R-39)
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector('.faq-question');
    if (!questionBtn) return;

    questionBtn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      faqItems.forEach((other) => {
        if (other !== item) {
          other.classList.remove('active');
          const otherBtn = other.querySelector('.faq-question');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      if (isActive) {
        item.classList.remove('active');
        questionBtn.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('active');
        questionBtn.setAttribute('aria-expanded', 'true');
      }
    });
  });
});
