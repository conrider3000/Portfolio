let currentLanguage = 'pt';
let currentTheme = 'light';

const cursor = document.getElementById('cursor');
let mouseX = 0, mouseY = 0;
let cursorX = 0, cursorY = 0;

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLanguage();

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  animateCursor();
  addCursorInteractions();
});

function initLanguage() {
  const savedLang = localStorage.getItem('language');
  currentLanguage = (savedLang && ['pt', 'en', 'es', 'fr'].includes(savedLang)) ? savedLang : 'pt';
  updateLanguageUI();
}

function switchLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('language', lang);
  updateLanguageUI();
}

function updateLanguageUI() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.getAttribute('onclick').includes(currentLanguage)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLanguage] && translations[currentLanguage][key]) {
      el.innerText = translations[currentLanguage][key];
    }
  });
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  currentTheme = savedTheme ? savedTheme : 'light';
  document.body.setAttribute('data-theme', currentTheme);
  updateThemeToggleIcon();

  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeToggleIcon();
  });
}

function updateThemeToggleIcon() {
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerText = currentTheme === 'dark' ? '☀️' : '🌙';
  }
}

function animateCursor() {
  if (!cursor) return;
  cursorX += (mouseX - cursorX) * 0.15;
  cursorY += (mouseY - cursorY) * 0.15;
  cursor.style.left = `${cursorX}px`;
  cursor.style.top = `${cursorY}px`;
  requestAnimationFrame(animateCursor);
}

function addCursorInteractions() {
  document.querySelectorAll('a, button, .gallery-item').forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (cursor) {
        if (el.classList.contains('gallery-item')) {
          cursor.classList.add('project-hover');
          cursor.innerText = '📷';
        } else {
          cursor.classList.add('hovered');
        }
      }
    });
    el.addEventListener('mouseleave', () => {
      if (cursor) {
        cursor.classList.remove('hovered');
        cursor.classList.remove('project-hover');
        cursor.innerText = '';
      }
    });
  });
}
