/**
 * trawangan: Logika Interaktif Etalase Web (v0.44.0)
 * Mengatur deteksi OS pengunjung, menu drawer mobile, tab galeri WAI-ARIA,
 * akordion FAQ, salin perintah build, serta smooth-scroll sadar prefers-reduced-motion.
 */

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 1. Deteksi Sistem Operasi untuk label tombol download utama
  const ctaLabel = document.getElementById('cta-target-os');
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform =
    window.navigator?.userAgentData?.platform?.toLowerCase() ||
    window.navigator.platform?.toLowerCase() ||
    '';

  let detectedOs = 'windows';
  if (platform.includes('mac') || userAgent.includes('macintosh') || userAgent.includes('mac os')) {
    detectedOs = 'macos';
  } else if (platform.includes('linux') || userAgent.includes('linux') || userAgent.includes('x11')) {
    detectedOs = 'linux';
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

  // 2. Menu Drawer Mobile dengan dukungan Escape & klik di luar (R-03, R-32, R-39)
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  function setMenuState(open) {
    if (!navToggle || !navMenu) return;
    navMenu.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.contains('nav-open');
      setMenuState(!isOpen);
    });

    navMenu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        setMenuState(false);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('nav-open')) {
        setMenuState(false);
        navToggle.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (
        navMenu.classList.contains('nav-open') &&
        !navMenu.contains(e.target) &&
        !navToggle.contains(e.target)
      ) {
        setMenuState(false);
      }
    });
  }

  // 3. Tab Galeri Showcase WAI-ARIA Lengkap dengan Arrow Navigation (R-32, R-39)
  const tabButtons = Array.from(document.querySelectorAll('.gallery-tab-btn'));
  const panels = Array.from(document.querySelectorAll('.gallery-panel'));

  function activateTab(index, moveFocus = false) {
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
      if (isActive) {
        const panelImg = panel.querySelector('img[loading="lazy"]');
        if (panelImg) {
          panelImg.loading = 'eager';
        }
      }
    });

    if (moveFocus) {
      btn.focus();
    }
  }

  tabButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      activateTab(index, false);
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        activateTab((index + 1) % tabButtons.length, true);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        activateTab((index - 1 + tabButtons.length) % tabButtons.length, true);
      } else if (e.key === 'Home') {
        e.preventDefault();
        activateTab(0, true);
      } else if (e.key === 'End') {
        e.preventDefault();
        activateTab(tabButtons.length - 1, true);
      }
    });
  });

  // 4. Smooth Scroll Anchor yang Menghormati prefers-reduced-motion (R-39)
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetHref = this.getAttribute('href');
      if (!targetHref || targetHref === '#') return;

      const targetEl = document.querySelector(targetHref);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({
          behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
          block: 'start'
        });
      }
    });
  });

  // 5. Akordion FAQ (R-32, R-39)
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

  // 6. Tombol Salin Perintah Build Sumber (R-26)
  const copyBtn = document.getElementById('copy-build-cmd');
  const buildCmdEl = document.getElementById('build-cmd-text');
  const copyStatusEl = document.getElementById('copy-status-msg');
  let copyResetTimer = null;

  if (copyBtn && buildCmdEl) {
    copyBtn.addEventListener('click', async () => {
      const commandText = buildCmdEl.textContent?.trim() || '';
      if (!commandText) return;

      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(commandText);
          copied = true;
        }
      } catch {
        copied = false;
      }

      if (!copied) {
        // Fallback aman dengan memilih teks perintah agar siap Ctrl+C
        const range = document.createRange();
        range.selectNodeContents(buildCmdEl);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        try {
          copied = document.execCommand('copy');
        } catch {
          copied = false;
        }
      }

      if (copyResetTimer) {
        clearTimeout(copyResetTimer);
      }

      if (copied) {
        copyBtn.textContent = 'Tersalin';
        copyBtn.classList.add('copied');
        if (copyStatusEl) {
          copyStatusEl.textContent = 'Perintah build berhasil disalin ke clipboard.';
        }
      } else {
        copyBtn.textContent = 'Teks Dipilih';
        if (copyStatusEl) {
          copyStatusEl.textContent = 'Teks perintah dipilih. Tekan Ctrl+C untuk menyalin.';
        }
      }

      copyResetTimer = setTimeout(() => {
        copyBtn.textContent = 'Salin Perintah';
        copyBtn.classList.remove('copied');
        if (copyStatusEl) {
          copyStatusEl.textContent = '';
        }
      }, 2400);
    });
  }
});
