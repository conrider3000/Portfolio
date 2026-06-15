// ==========================================================================
// CONFIGURATION & GLOBAL STATE
// ==========================================================================
let currentLanguage = 'pt';
let currentTheme = 'light';
let activeView = 'orbit'; // 'orbit', 'cascade', or 'psicromia'

// Morphing Transition State Variable
let transitionProgress = { value: 0 }; 

// Custom Cursor & Magnifier Lens tracking
const cursor = document.getElementById('cursor');
const lens = document.getElementById('lens');
let mouseX = 0, mouseY = 0;
let activeHoveredCard = null; 
let isLensActive = false; // Toggle state for left-click zoom lens activation

// Hover scaling values for Orbit cards (smooth integration in render loop)
let hoverScales = [];

// Drag vs Click detection variables
let dragDistance = 0;
let isMouseDown = false;
let startMouseX = 0;
let startMouseY = 0;

// Orbit calculations
let orbitAngle = 0;
let targetOrbitSpeed = 0.0006;
let currentOrbitSpeed = 0.0006;
let isDraggingOrbit = false;
let startDragX = 0;
const orbitRadiusX = 580;
const orbitRadiusY = 180;
let isSpinningEasterEgg = false;
let isDraggingOrbitRight = false;
let rightDragAccumulated = 0;
let lastRightDragDelta = 0;

// Cascade calculations
let activeCascadeIndex = 0;
let lastDisplayedCascadeIndex = -1; // Track active project details card updates
let isProjectInfoPanelVisible = false; // Flag to track typographic panel visibility
let smoothCascadeIndex = 0; // Floating point variable for smooth LERP card transitions
let isDraggingCascade = false;
let startCascadeDragX = 0;

// Unified media items (6 projects + 5 photos = 11 morphing cards)
const photoGalleryItems = [
  { id: "photo-1", title: { pt: "Festival de Inverno", en: "Winter Festival", es: "Festival de Invierno", fr: "Festival d'Hiver" }, image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80", description: { pt: "Curitiba, PR", en: "Curitiba, PR", es: "Curitiba, PR", fr: "Curitiba, PR" }, tags: ["Fotografia"] },
  { id: "photo-2", title: { pt: "Show Autoral Paiol", en: "Paiol Theater Concert", es: "Concierto Teatro Paiol", fr: "Concert au Théâtre Paiol" }, image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80", description: { pt: "Teatro Paiol", en: "Paiol Theater", es: "Teatro Paiol", fr: "Théâtre Paiol" }, tags: ["Fotografia"] },
  { id: "photo-3", title: { pt: "Raízes de Ibicoara", en: "Ibicoara Roots", es: "Raíces de Ibicoara", fr: "Racines d'Ibicoara" }, image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80", description: { pt: "Ibicoara, Bahia", en: "Ibicoara, Bahia", es: "Ibicoara, Bahia", fr: "Ibicoara, Bahia" }, tags: ["Audiovisual"] },
  { id: "photo-4", title: { pt: "SURU Marcenaria", en: "SURU Workshop", es: "SURU Taller", fr: "Atelier SURU" }, image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80", description: { pt: "Fabtech Curitiba", en: "Fabtech Curitiba", es: "Fabtech Curitiba", fr: "Fabtech Curitiba" }, tags: ["Produto Físico"] },
  { id: "photo-5", title: { pt: "NASA Space Apps", en: "NASA Space Apps", es: "NASA Space Apps", fr: "NASA Space Apps" }, image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80", description: { pt: "Mentoria & Inovação", en: "Mentoring & Innovation", es: "Mentoring e Innovación", fr: "Mentorat & Innovation" }, tags: ["Inovação"] }
];
const combinedMediaItems = [...portfolioData, ...photoGalleryItems];
let morphCards = [];

// Particle background variables
const canvas = document.getElementById('particles-canvas');
const ctx = canvas.getContext('2d');
let particlesArray = [];
const numberOfParticles = 35;

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================
function mod(n, m) {
  return ((n % m) + m) % m;
}

function getWrappedOffset(index, center, M) {
  const c = mod(center, M);
  let diff = index - c;
  diff = mod(diff + M / 2, M) - M / 2;
  return diff;
}

function startLogoAlternator() {
  const logoText = document.getElementById('logo-text');
  if (!logoText) return;
  const words = ["CONRADO", "PORTFÓLIO"];
  let idx = 0;
  setInterval(() => {
    gsap.to(logoText, {
      opacity: 0,
      y: -5,
      duration: 0.4,
      onComplete: () => {
        idx = (idx + 1) % words.length;
        logoText.innerText = words[idx];
        gsap.fromTo(logoText, { y: 5, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 });
      }
    });
  }, 3000);
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLanguage();
  initParticles();

  buildMorphingCards();
  buildPsicromiaGallery();

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Position custom cursor instantly (0 delay/lag)
    cursor.style.left = `${mouseX}px`;
    cursor.style.top = `${mouseY}px`;

    // Position Magnifier Lens instantly (0 delay/lag)
    lens.style.left = `${mouseX}px`;
    lens.style.top = `${mouseY}px`;

    // If lens is active, calculate relative percentage offsets to hovered card
    if (activeHoveredCard) {
      const rect = activeHoveredCard.getBoundingClientRect();
      const relX = mouseX - rect.left;
      const relY = mouseY - rect.top;
      const pctX = (relX / rect.width) * 100;
      const pctY = (relY / rect.height) * 100;
      lens.style.backgroundPosition = `${pctX}% ${pctY}%`;
    }

    // Tilt the central planet slightly toward the cursor
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const tiltX = (e.clientX - centerX) / centerX * 15;
    const tiltY = (e.clientY - centerY) / centerY * -15;
    gsap.to('#orbit-center-text', {
      rotationY: tiltX,
      rotationX: tiltY,
      duration: 0.5,
      ease: "power2.out"
    });
  });

  // Prevent context menu on card items, in Orbit view, or during right-drag to ensure premium feel and allow Easter Egg
  document.addEventListener('contextmenu', (e) => {
    if (activeHoveredCard || activeView === 'orbit' || isDraggingOrbitRight) {
      e.preventDefault(); // Block default browser dropdown
    }
  });

  // Prevent middle-click scroll icon globally to keep custom cursor active
  document.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  }, { passive: false });

  addCursorInteractions();
  runLoader();
  startLogoAlternator();

  window.addEventListener('wheel', (e) => {
    if (activeView === 'cascade') {
      if (e.deltaY > 0) {
        navigateCascade(1);
      } else {
        navigateCascade(-1);
      }
    } else if (activeView === 'psicromia') {
      if (e.deltaY > 0) {
        navigatePsicromia(1);
      } else {
        navigatePsicromia(-1);
      }
    }
  });
});

// ==========================================================================
// SITE LOADER INTRO
// ==========================================================================
function runLoader() {
  const loader = document.getElementById('loader');
  const percentText = document.getElementById('loader-percent');
  const barFill = document.getElementById('loader-bar-fill');
  const loaderWord = document.getElementById('loader-word');
  
  const introWords = ["Branding.", "UX Design.", "Autonomia.", "SURU.", "Conrado."];
  let wordIdx = 0;
  
  const wordInterval = setInterval(() => {
    loaderWord.innerText = introWords[wordIdx];
    wordIdx = (wordIdx + 1) % introWords.length;
  }, 250);

  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += Math.floor(Math.random() * 10) + 3;
    if (progress >= 100) {
      progress = 100;
      clearInterval(progressInterval);
      clearInterval(wordInterval);
      
      gsap.to(loader, {
        opacity: 0,
        duration: 0.8,
        ease: "power2.out",
        onComplete: () => {
          loader.style.display = 'none';
          animateOrbitEntry();
        }
      });
    }
    percentText.innerText = `${progress}%`;
    barFill.style.width = `${progress}%`;
  }, 60);
}

// ==========================================================================
// BUILD UNIFIED MORPHING CARDS
// ==========================================================================
function buildMorphingCards() {
  const container = document.getElementById('projects-container');
  container.innerHTML = '';
  morphCards = [];
  hoverScales = Array(combinedMediaItems.length).fill(1);

  combinedMediaItems.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'morph-card';
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-index', index);
    
    const title = item.title[currentLanguage] || item.title['pt'] || item.title;
    const desc = item.description[currentLanguage] || item.description['pt'] || item.description;

    // Ensure the card never remains without an image
    const fallbackImage = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";
    let imgUrl = item.image;
    if (!imgUrl || imgUrl.trim() === "") {
      imgUrl = fallbackImage;
    }

    card.innerHTML = `
      <div class="morph-card__blur-bg" style="background-image: url('${imgUrl}');"></div>
      <img src="${imgUrl}" alt="${title}" onerror="this.src='${fallbackImage}';">
      <div class="morph-card__info">
        <h3 class="morph-card__title">${title}</h3>
        <p class="morph-card__desc">${desc}</p>
      </div>
    `;
    container.appendChild(card);
    morphCards.push(card);



    // Magnifier Lens Hover Events
    card.addEventListener('mouseenter', () => {
      targetOrbitSpeed = 0.00015;
      
      activeHoveredCard = card;
      lens.style.backgroundImage = `url(${imgUrl})`;
      
      // Keep magnifying glass cursor visible on hover, zoom lens is off initially
      if (isLensActive) {
        lens.style.display = 'block';
        cursor.style.opacity = '0';
      } else {
        lens.style.display = 'none';
        cursor.style.opacity = '1';
      }

      if (activeView === 'orbit') {
        gsap.to(hoverScales, {
          [index]: 1.08,
          duration: 0.3,
          ease: "power2.out"
        });
        gsap.to(card, { borderColor: '#c8a882', duration: 0.4, ease: "power2.out" });
      }
    });

    card.addEventListener('mouseleave', () => {
      targetOrbitSpeed = 0.0006;
      
      activeHoveredCard = null;
      lens.style.display = 'none';
      cursor.style.opacity = '1';

      isLensActive = false;

      if (activeView === 'orbit') {
        gsap.to(hoverScales, {
          [index]: 1.0,
          duration: 0.3,
          ease: "power2.out"
        });
        gsap.to(card, { borderColor: 'rgba(255,255,255,0.65)', duration: 0.4, ease: "power2.out" });
      }
    });

    card.addEventListener('click', (e) => {
      // Ignore right clicks or middle clicks
      if (e.button !== 0) return;

      if (dragDistance > 6) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const matchIdx = portfolioData.findIndex(p => p.id === item.id);
      if (activeView === 'orbit') {
        if (matchIdx !== -1) {
          activeCascadeIndex = matchIdx;
          switchView('cascade');
        }
      } else if (activeView === 'cascade') {
        if (matchIdx !== -1) {
          const M = portfolioData.length;
          const wrappedActiveIndex = mod(Math.round(activeCascadeIndex), M);
          if (wrappedActiveIndex === matchIdx) {
            // Clicked on the already active card in Cascade view
            if (item.id === 'psicromia') {
              // Go to Psicromia gallery
              hideProjectInfoPanel();
              switchView('psicromia');
            } else {
              // Toggle the typographic project info panel!
              if (isProjectInfoPanelVisible) {
                hideProjectInfoPanel();
              } else {
                showProjectInfoPanel();
              }
            }
          } else {
            // Focus on the clicked background card in Cascade using the shortest wrapped path
            const diff = getWrappedOffset(matchIdx, activeCascadeIndex, M);
            activeCascadeIndex += diff;
            hideProjectInfoPanel();
          }
        }
      }
    });

    // Right-click (contextmenu) event listener for zoom lens
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Block default browser dropdown
      
      if (activeView === 'cascade') {
        const matchIdx = portfolioData.findIndex(p => p.id === item.id);
        const M = portfolioData.length;
        const wrappedActiveIndex = mod(Math.round(activeCascadeIndex), M);
        if (matchIdx !== -1 && wrappedActiveIndex === matchIdx) {
          // Toggle zoom lens active state on right-click!
          isLensActive = !isLensActive;
          if (isLensActive) {
            lens.style.display = 'block';
            cursor.style.opacity = '0';
            lens.style.backgroundImage = `url(${item.image})`;
            
            // Calculate background position relative to cursor instantly
            const rect = card.getBoundingClientRect();
            const relX = mouseX - rect.left;
            const relY = mouseY - rect.top;
            const pctX = (relX / rect.width) * 100;
            const pctY = (relY / rect.height) * 100;
            lens.style.backgroundPosition = `${pctX}% ${pctY}%`;
          } else {
            lens.style.display = 'none';
            cursor.style.opacity = '1';
          }
        }
      }
    });
  });

  updateUnifiedLoop();
  bindSceneDrag();
}

// ==========================================================================
// UNIFIED MORPHING RENDER LOOP
// ==========================================================================
function updateUnifiedLoop() {
  if (!isDraggingOrbit && !isDraggingOrbitRight && !isSpinningEasterEgg) {
    currentOrbitSpeed += (targetOrbitSpeed - currentOrbitSpeed) * 0.1;
    orbitAngle += currentOrbitSpeed;
  }

  // LERP smoothCascadeIndex towards activeCascadeIndex for smooth transitions
  if (activeView === 'cascade') {
    if (!isDraggingCascade && !activeHoveredCard && !isProjectInfoPanelVisible) {
      // Slowly auto-scroll Cascade view along the diagonal path (collective motion)
      activeCascadeIndex += 0.0015;
    }
    smoothCascadeIndex += (activeCascadeIndex - smoothCascadeIndex) * 0.08;
    if (Math.abs(activeCascadeIndex - smoothCascadeIndex) < 0.005) {
      smoothCascadeIndex = activeCascadeIndex;
    }
    
    // Prevent float overflow by shifting index by multiples of M
    const M = portfolioData.length;
    if (Math.abs(activeCascadeIndex) > M * 10) {
      const shift = Math.round(activeCascadeIndex / M) * M;
      activeCascadeIndex -= shift;
      smoothCascadeIndex -= shift;
    }
  } else {
    smoothCascadeIndex = activeCascadeIndex;
  }

  const N = morphCards.length;
  const p = transitionProgress.value; 

  morphCards.forEach((card, index) => {
    // ORBIT STATE
    const theta = (index / N) * 2 * Math.PI + orbitAngle;
    const ox = Math.cos(theta) * orbitRadiusX;
    const oy = Math.sin(theta) * orbitRadiusY;
    const oz = Math.sin(theta); 
    const oScale = gsap.utils.mapRange(-1, 1, 0.42, 0.78, oz);
    const oOpacity = gsap.utils.mapRange(-1, 1, 0.25, 1.0, oz);
    const oZIndex = Math.floor(gsap.utils.mapRange(-1, 1, 10, 100, oz));
    const oRotateY = 0;

    // CASCADE STATE
    let cx, cy, cz, cScale, cOpacity, cRotateY, cZIndex;
    
    if (index < portfolioData.length) {
      const M = portfolioData.length;
      const offset = getWrappedOffset(index, smoothCascadeIndex, M);
      const absOffset = Math.abs(offset);
      const activeWeight = Math.max(0, 1 - absOffset);

      // Collective scrolling motion only, no individual float sway in Cascade view
      const swayX = 0;
      const swayY = 0;
      const swayZ = 0;

      // Diagonal Cascade: narrow in top-right background (to avoid menu), wide in bottom-left foreground
      const factorX = offset >= 0 ? (window.innerWidth * 0.07) : (window.innerWidth * 0.15);
      cx = offset * factorX + swayX;
      cy = -offset * (window.innerHeight * 0.24) - 30 + swayY;
      cz = -offset * 100 + activeWeight * 100 + swayZ;
      cScale = 1.3 - offset * 0.07;
      
      // Keep opacity fully solid at 1.0 (no fading in the horizon) as requested
      cOpacity = 1.0;

      cRotateY = offset * -30;
      cZIndex = Math.floor(200 - offset * 30);

      const roundedOffset = Math.round(offset);
      if (roundedOffset === 0) {
        card.classList.add('active-cascade');
      } else {
        card.classList.remove('active-cascade');
      }
    } else {
      cx = Math.cos(theta) * orbitRadiusX * 1.8;
      cy = Math.sin(theta) * orbitRadiusY * 1.8;
      cz = -800;
      cScale = 0.15;
      cOpacity = 0.0;
      cRotateY = 0;
      cZIndex = 5;
      card.classList.remove('active-cascade');
    }

    // LERP COORDINATES INTERPOLATION
    const finalX = ox + (cx - ox) * p;
    const finalY = oy + (cy - oy) * p;
    const finalZ = (oz * 100) + (cz - (oz * 100)) * p;
    const finalScale = (oScale + (cScale - oScale) * p) * (hoverScales[index] || 1);
    const finalOpacity = oOpacity + (cOpacity - oOpacity) * p;
    const finalRotateY = oRotateY + (cRotateY - oRotateY) * p;
    const finalZIndex = p > 0.5 ? cZIndex : oZIndex;

    card.style.transform = `translate3d(${finalX}px, ${finalY}px, ${finalZ}px) rotateY(${finalRotateY}deg) scale(${finalScale})`;
    card.style.opacity = finalOpacity;
    card.style.zIndex = finalZIndex;
  });

  requestAnimationFrame(updateUnifiedLoop);
}

// ==========================================================================
// UPDATE TYPOGRAPHIC PROJECT INFO PANEL (MOMENT 2 - CASCADE 3D)
// ==========================================================================
function updateProjectInfoPanel() {
  if (activeView !== 'cascade') return;

  const M = portfolioData.length;
  const wrappedActiveIndex = mod(Math.round(activeCascadeIndex), M);
  const item = portfolioData[wrappedActiveIndex];
  if (!item) return;

  const year = item.year || '';
  const tags = (item.tags || []).join(' / ');
  const title = item.title[currentLanguage] || item.title['pt'] || item.title;
  const subtitle = item.subtitle[currentLanguage] || item.subtitle['pt'] || item.subtitle || '';
  const desc = item.description[currentLanguage] || item.description['pt'] || item.description;

  const yearEl = document.getElementById('info-panel-year');
  const tagsEl = document.getElementById('info-panel-tags');
  const titleEl = document.getElementById('info-panel-title');
  const subtitleEl = document.getElementById('info-panel-subtitle');
  const descEl = document.getElementById('info-panel-desc');

  yearEl.innerText = year;
  tagsEl.innerText = tags;
  titleEl.innerText = title;
  subtitleEl.innerText = subtitle;
  descEl.innerText = desc;
  
  subtitleEl.style.display = subtitle ? 'block' : 'none';
  lastDisplayedCascadeIndex = wrappedActiveIndex;
}

function showProjectInfoPanel() {
  updateProjectInfoPanel();
  const panel = document.getElementById('project-info-panel');
  gsap.to(panel, {
    opacity: 1,
    y: 0,
    duration: 0.5,
    ease: "power2.out",
    pointerEvents: 'auto'
  });
  isProjectInfoPanelVisible = true;
}

function hideProjectInfoPanel() {
  const panel = document.getElementById('project-info-panel');
  gsap.to(panel, {
    opacity: 0,
    y: 10,
    duration: 0.3,
    ease: "power2.in",
    pointerEvents: 'none'
  });
  isProjectInfoPanelVisible = false;
}

// ==========================================================================
// DRAG LISTENERS
// ==========================================================================
function bindSceneDrag() {
  const container = document.getElementById('projects-scene');
  const psicromiaContainer = document.getElementById('psicromia-scene');
  
  const onMouseDown = (e) => {
    if (e.button === 1) {
      e.preventDefault(); // Block middle-click auto-scroll icon
      return;
    }
    
    // Right-click drag Easter Egg in Orbit view
    if (activeView === 'orbit' && e.button === 2) {
      if (isSpinningEasterEgg) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      isMouseDown = true;
      startMouseX = e.clientX;
      startMouseY = e.clientY;
      dragDistance = 0;
      isDraggingOrbitRight = true;
      startDragX = e.clientX;
      rightDragAccumulated = 0;
      lastRightDragDelta = 0;
      return;
    }

    if (e.button !== 0) return; // Only allow left-clicks for other dragging

    if (activeView === 'orbit' && isSpinningEasterEgg) {
      // Disable left-drag interaction during spin animation
      return;
    }

    isMouseDown = true;
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    dragDistance = 0;

    if (activeView === 'orbit') {
      isDraggingOrbit = true;
      startDragX = e.clientX;
    } else if (activeView === 'cascade') {
      isDraggingCascade = true;
      startCascadeDragX = e.clientX;
      hideProjectInfoPanel(); // Hide immediately on click/drag start!
    } else if (activeView === 'psicromia') {
      isDraggingPsicromia = true;
      startPsicromiaDragX = e.clientX;
    }
  };

  container.addEventListener('mousedown', onMouseDown);
  if (psicromiaContainer) {
    psicromiaContainer.addEventListener('mousedown', onMouseDown);
  }

  document.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      dragDistance = Math.sqrt(dx * dx + dy * dy);

      // If we are active-dragging, show native grabbing cursor and hide custom magnifier cursor
      if (dragDistance > 3 && (isDraggingOrbit || isDraggingOrbitRight || isDraggingCascade || isDraggingPsicromia)) {
        document.body.style.cursor = 'grabbing';
        if (cursor) cursor.style.opacity = '0';
        if (lens) lens.style.display = 'none'; // Keep lens hidden when dragging
      }
    }

    if (isDraggingOrbit && activeView === 'orbit') {
      const deltaX = e.clientX - startDragX;
      orbitAngle -= deltaX * 0.005;
      startDragX = e.clientX;
    } else if (isDraggingOrbitRight && activeView === 'orbit') {
      const deltaX = e.clientX - startDragX;
      orbitAngle -= deltaX * 0.005;
      startDragX = e.clientX;
      rightDragAccumulated += Math.abs(deltaX);
      lastRightDragDelta = deltaX;
    } else if (isDraggingCascade && activeView === 'cascade') {
      const deltaX = e.clientX - startCascadeDragX;
      if (Math.abs(deltaX) > 80) {
        navigateCascade(deltaX > 0 ? -1 : 1);
        startCascadeDragX = e.clientX;
      }
    } else if (isDraggingPsicromia && activeView === 'psicromia') {
      const deltaX = e.clientX - startPsicromiaDragX;
      if (Math.abs(deltaX) > 80) {
        navigatePsicromia(deltaX > 0 ? -1 : 1);
        startPsicromiaDragX = e.clientX;
      }
    }
  });

  document.addEventListener('mouseup', () => {
    isMouseDown = false;
    isDraggingOrbit = false;
    isDraggingCascade = false;
    isDraggingPsicromia = false;

    if (isDraggingOrbitRight && activeView === 'orbit') {
      isDraggingOrbitRight = false;
      if (rightDragAccumulated > 150 && !isSpinningEasterEgg) {
        triggerEasterEggSpin();
      }
    }
    isDraggingOrbitRight = false;

    // Restore custom cursor
    document.body.style.cursor = 'none';
    if (cursor) cursor.style.opacity = '1';
  });
}

function navigateCascade(dir) {
  activeCascadeIndex += dir;
  hideProjectInfoPanel();
}

function triggerEasterEggSpin() {
  if (portfolioData.length === 0) return;
  const randomIdx = Math.floor(Math.random() * portfolioData.length);
  const N = combinedMediaItems.length;
  const targetAngle = Math.PI / 2 - (randomIdx / N) * 2 * Math.PI;

  const spinDir = lastRightDragDelta < 0 ? 1 : -1;

  let diff = (targetAngle - orbitAngle) % (2 * Math.PI);
  if (spinDir > 0) {
    if (diff < 0) diff += 2 * Math.PI;
  } else {
    if (diff > 0) diff -= 2 * Math.PI;
  }

  const finalTargetAngle = orbitAngle + spinDir * (4 * 2 * Math.PI) + diff;

  isSpinningEasterEgg = true;
  let spinObj = { angle: orbitAngle };

  // Play a cool GSAP spin effect
  gsap.to(spinObj, {
    angle: finalTargetAngle,
    duration: 3.5,
    ease: "power4.out",
    onUpdate: () => {
      orbitAngle = spinObj.angle;
    },
    onComplete: () => {
      isSpinningEasterEgg = false;
      
      // Select the project and switch view
      activeCascadeIndex = randomIdx;
      switchView('cascade');
      
      // Wait a tiny bit and show the typographic project panel
      setTimeout(() => {
        showProjectInfoPanel();
      }, 300);
    }
  });
}

function animateOrbitEntry() {
  gsap.from('.logo', { y: -20, opacity: 0, duration: 1, ease: "power2.out" });
  gsap.from('.nav', { y: -20, opacity: 0, duration: 1, ease: "power2.out", delay: 0.2 });
  gsap.from('.visualizer-select', { y: 20, opacity: 0, duration: 1, ease: "power2.out", delay: 0.4 });
  gsap.from('.orbit-center', { scale: 0.8, opacity: 0, duration: 1.2, ease: "power3.out" });
}

// ==========================================================================
// MORPH VIEW SWITCHER
// ==========================================================================
function switchView(viewName) {
  if (activeView === viewName) return;
  activeView = viewName;

  const cascadeBackBtn = document.getElementById('cascade-back-btn');
  if (cascadeBackBtn) {
    if (viewName === 'cascade') {
      gsap.fromTo(cascadeBackBtn, 
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", pointerEvents: 'auto' }
      );
    } else {
      gsap.to(cascadeBackBtn, { opacity: 0, y: -10, duration: 0.3, ease: "power2.in", pointerEvents: 'none' });
    }
  }

  if (viewName === 'psicromia') {
    // Hide projects scene and visualizer selects
    document.getElementById('projects-scene').classList.remove('active');
    document.getElementById('psicromia-scene').classList.add('active');
    gsap.to('.visualizer-select', { opacity: 0, y: 20, duration: 0.5, pointerEvents: 'none' });
    
    // Hide central orbit text just in case
    gsap.to('#orbit-center-text', { opacity: 0, duration: 0.3 });

    // Hide typographic panel
    gsap.to('#project-info-panel', {
      opacity: 0,
      y: 20,
      duration: 0.5,
      ease: "power2.in",
      pointerEvents: 'none'
    });

    // Build and animate entry of gallery
    activePhotoIndex = 0;
    buildPsicromiaGallery();
    animatePsicromiaEntry();
  } else {
    // Hide psicromia scene and show projects scene
    document.getElementById('psicromia-scene').classList.remove('active');
    document.getElementById('projects-scene').classList.add('active');
    gsap.to('.visualizer-select', { opacity: 1, y: 0, duration: 0.5, pointerEvents: 'auto' });

    // Update active button indicators
    document.querySelectorAll('.vis-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const btn = document.getElementById(`btn-${viewName}`);
    if (btn) btn.classList.add('active');

    if (viewName === 'cascade') {
      gsap.to(transitionProgress, {
        value: 1,
        duration: 1.2,
        ease: "power3.inOut"
      });

      gsap.to('#orbit-center-text', {
        scale: 0.5,
        opacity: 0,
        duration: 0.8,
        ease: "power2.out"
      });

      // Update text values in the background but keep the panel hidden by default
      updateProjectInfoPanel(true);
      gsap.to('#project-info-panel', {
        opacity: 0,
        y: 10,
        duration: 0.3,
        pointerEvents: 'none'
      });
    } else {
      // viewName === 'orbit'
      gsap.to(transitionProgress, {
        value: 0,
        duration: 1.2,
        ease: "power3.inOut"
      });

      gsap.to('#orbit-center-text', {
        scale: 1,
        opacity: 0.95,
        duration: 0.8,
        ease: "power2.out"
      });

      // Hide typographic panel
      gsap.to('#project-info-panel', {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: "power2.in",
        pointerEvents: 'none'
      });
    }
  }
}

// ==========================================================================
// PSICROMIA PHOTO GALLERY (VIEW 3)
// ==========================================================================
const psicromiaPhotos = [
  "assets/psicromia/_MG_1636.JPG",
  "assets/psicromia/_MG_1644.JPG",
  "assets/psicromia/_MG_5098.JPG",
  "assets/psicromia/_MG_5101.JPG",
  "assets/psicromia/_MG_5116.JPG",
  "assets/psicromia/_MG_5372.JPG",
  "assets/psicromia/_MG_5386.JPG",
  "assets/psicromia/_MG_5431.JPG",
  "assets/psicromia/_MG_5450.JPG",
  "assets/psicromia/_MG_5451.JPG",
  "assets/psicromia/_MG_5460.JPG",
  "assets/psicromia/_MG_5464.JPG"
];
let psicromiaCards = [];
let activePhotoIndex = 0;
let isDraggingPsicromia = false;
let startPsicromiaDragX = 0;

function buildPsicromiaGallery() {
  const track = document.getElementById('psicromia-track');
  if (!track) return;
  track.innerHTML = '';
  psicromiaCards = [];

  psicromiaPhotos.forEach((imgSrc, index) => {
    const card = document.createElement('div');
    card.className = 'psicromia-photo-card';
    card.setAttribute('data-index', index);
    
    card.innerHTML = `
      <div class="psicromia-photo-card__blur" style="background-image: url('${imgSrc}');"></div>
      <img src="${imgSrc}" alt="Psicromia Photo ${index + 1}">
    `;
    
    track.appendChild(card);
    psicromiaCards.push(card);

    // Magnifier Lens Hover Events
    card.addEventListener('mouseenter', () => {
      activeHoveredCard = card;
      lens.style.backgroundImage = `url(${imgSrc})`;
      
      if (isLensActive) {
        lens.style.display = 'block';
        cursor.style.opacity = '0';
      } else {
        lens.style.display = 'none';
        cursor.style.opacity = '1';
      }
    });

    card.addEventListener('mouseleave', () => {
      activeHoveredCard = null;
      lens.style.display = 'none';
      cursor.style.opacity = '1';
      
      isLensActive = false;
    });

    // Click side card to transition to it
    card.addEventListener('click', (e) => {
      if (e.button !== 0) return; // Only allow left-clicks

      if (dragDistance > 6) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (activePhotoIndex !== index) {
        isLensActive = false;
        lens.style.display = 'none';
        cursor.style.opacity = '1';
        activePhotoIndex = index;
        updatePsicromiaGalleryPositions();
      }
    });

    // Right-click (contextmenu) event listener for zoom lens in Psicromia
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Block default browser dropdown
      
      if (activeView === 'psicromia' && activePhotoIndex === index) {
        // Toggle zoom lens active state on right-click!
        isLensActive = !isLensActive;
        if (isLensActive) {
          lens.style.display = 'block';
          cursor.style.opacity = '0';
          lens.style.backgroundImage = `url(${imgSrc})`;
          
          // Calculate background position relative to cursor instantly
          const rect = card.getBoundingClientRect();
          const relX = mouseX - rect.left;
          const relY = mouseY - rect.top;
          const pctX = (relX / rect.width) * 100;
          const pctY = (relY / rect.height) * 100;
          lens.style.backgroundPosition = `${pctX}% ${pctY}%`;
        } else {
          lens.style.display = 'none';
          cursor.style.opacity = '1';
        }
      }
    });
  });

  updatePsicromiaGalleryPositions();
}

function updatePsicromiaGalleryPositions() {
  psicromiaCards.forEach((card, index) => {
    const offset = index - activePhotoIndex;
    const absOffset = Math.abs(offset);
    
    let tx = offset * window.innerWidth * 0.82;
    let ty = 0;
    let tz = -absOffset * 120;
    let rotateY = offset * -15;
    let opacity = Math.max(0, 1.0 - absOffset * 0.75);
    let zIndex = 100 - absOffset;
    let scale = offset === 0 ? 1.0 : 0.95;

    gsap.to(card, {
      xPercent: -50,
      yPercent: -50,
      x: tx,
      y: ty,
      z: tz,
      rotationY: rotateY,
      scale: scale,
      opacity: opacity,
      zIndex: zIndex,
      duration: 0.8,
      ease: "power2.out"
    });
  });
}

function navigatePsicromia(dir) {
  activePhotoIndex += dir;
  if (activePhotoIndex < 0) activePhotoIndex = 0;
  if (activePhotoIndex >= psicromiaPhotos.length) activePhotoIndex = psicromiaPhotos.length - 1;
  updatePsicromiaGalleryPositions();
}

function exitPsicromia() {
  switchView('cascade');
}

function animatePsicromiaEntry() {
  gsap.fromTo('.psicromia-back-btn', { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power2.out" });
  
  // Set horizontal coordinates prior to entry transition to prevent visual jump
  psicromiaCards.forEach((card, index) => {
    const offset = index - activePhotoIndex;
    gsap.set(card, {
      xPercent: -50,
      yPercent: -50,
      x: offset * window.innerWidth * 0.82
    });
  });

  gsap.fromTo(psicromiaCards, 
    { scale: 0.7, opacity: 0, z: -500 },
    { 
      scale: (i) => (i === activePhotoIndex ? 1.0 : 0.95),
      opacity: (i) => Math.max(0, 1.0 - Math.abs(i - activePhotoIndex) * 0.75),
      z: (i) => -Math.abs(i - activePhotoIndex) * 120,
      duration: 1.2, 
      stagger: 0.05,
      ease: "power3.out",
      onComplete: updatePsicromiaGalleryPositions
    }
  );
}

// ==========================================================================
// OVERLAY SLIDING PANELS
// ==========================================================================
function openPanel(panelId, event) {
  if (event) event.preventDefault();
  closeAllPanels();

  document.getElementById('panel-overlay').classList.add('active');
  const panel = document.getElementById(`panel-${panelId}`);
  panel.classList.add('active');

  cursor.classList.remove('hovered');
}

function closeAllPanels() {
  document.getElementById('panel-overlay').classList.remove('active');
  document.getElementById('panel-sobre').classList.remove('active');
  document.getElementById('panel-contato').classList.remove('active');
}

function resetToHome(event) {
  if (event) event.preventDefault();
  closeAllPanels();
  switchView('orbit');
}

// ==========================================================================
// MULTI-LANGUAGE TRANSLATION SYSTEM
// ==========================================================================
function initLanguage() {
  const savedLang = localStorage.getItem('language');
  currentLanguage = (savedLang && ['pt', 'en', 'es', 'fr'].includes(savedLang)) ? savedLang : 'pt';
  updateLanguageUI();
}

function switchLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('language', lang);
  updateLanguageUI();
  
  buildMorphingCards();
  updateProjectInfoPanel(true); // force update translated values instantly
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

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[currentLanguage] && translations[currentLanguage][key]) {
      el.setAttribute('placeholder', translations[currentLanguage][key]);
    }
  });
}

// ==========================================================================
// VISUAL THEME CONTROLS
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  currentTheme = savedTheme ? savedTheme : 'light';
  document.body.setAttribute('data-theme', currentTheme);
  document.getElementById('theme-toggle-btn').innerText = currentTheme === 'dark' ? '☀️' : '🌙';
  
  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    document.getElementById('theme-toggle-btn').innerText = currentTheme === 'dark' ? '☀️' : '🌙';
  });
}

// ==========================================================================
// CUSTOM CURSOR HOVER INTERACTIONS
// ==========================================================================
function addCursorInteractions() {
  document.querySelectorAll('a, button, [onclick], .lang-btn, .vis-btn, .morph-card, .psicromia-photo-card').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.classList.add('hovered');
    });

    el.addEventListener('mouseleave', () => {
      cursor.classList.remove('hovered');
    });
  });
}

// ==========================================================================
// SPACE PARTICLES SYSTEM
// ==========================================================================
function initParticles() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  particlesArray = [];
  for (let i = 0; i < numberOfParticles; i++) {
    const size = Math.random() * 2 + 0.5;
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const speedX = Math.random() * 0.15 - 0.075;
    const speedY = Math.random() * 0.15 - 0.075;
    particlesArray.push(new Particle(x, y, speedX, speedY, size));
  }
  
  animateParticles();
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

class Particle {
  constructor(x, y, speedX, speedY, size) {
    this.x = x;
    this.y = y;
    this.speedX = speedX;
    this.speedY = speedY;
    this.size = size;
  }
  
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    
    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;
    if (this.y < 0) this.y = canvas.height;
    if (this.y > canvas.height) this.y = 0;
  }
  
  draw() {
    ctx.fillStyle = currentTheme === 'dark' ? 'rgba(245, 243, 239, 0.35)' : 'rgba(26, 24, 20, 0.15)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particlesArray.forEach(p => {
    p.update();
    p.draw();
  });
  requestAnimationFrame(animateParticles);
}

// ==========================================================================
// CONTACT SUBMISSION
// ==========================================================================
function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const successMsg = translations[currentLanguage]["contact.success"] || "Message sent!";
  alert(successMsg);
  form.reset();
  closeAllPanels();
}
// Wait, there is a minor typo on line 301, let's look:
// "navigateCascade(dir => navigateCascade(deltaX > 0 ? -1 : 1));" - double navigation, let's fix it:
// "navigateCascade(deltaX > 0 ? -1 : 1);"
