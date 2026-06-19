// ==========================================================================
// CONFIGURATION & GLOBAL STATE
// ==========================================================================
let currentLanguage = 'pt';
let currentTheme = 'light';
let activeView = 'orbit'; // 'orbit', 'cascade', or 'psicromia'

// Morphing Transition State Variable
let transitionProgress = { value: 0 }; 

// Load portfolio data from localStorage if available, otherwise use default portfolioData
// Version flag so we can force re-sync when portfolio.js is updated
const DATA_VERSION = '3';
let projectsDb = [];
try {
  const cachedVersion = localStorage.getItem('portfolio_data_version');
  const localData = localStorage.getItem('portfolio_projects');
  if (localData && cachedVersion === DATA_VERSION) {
    projectsDb = JSON.parse(localData);
  } else {
    projectsDb = typeof portfolioData !== 'undefined' ? [...portfolioData] : [];
    localStorage.setItem('portfolio_projects', JSON.stringify(projectsDb));
    localStorage.setItem('portfolio_data_version', DATA_VERSION);
  }
} catch (e) {
  console.error("Error loading portfolio projects", e);
  projectsDb = typeof portfolioData !== 'undefined' ? [...portfolioData] : [];
}

// Mouse tracking
let mouseX = 0, mouseY = 0;
let activeHoveredCard = null;

// Hover scaling values for Orbit cards (smooth integration in render loop)
let hoverScales = [];

// Drag vs Click detection variables
let dragDistance = 0;
let isMouseDown = false;
let startMouseX = 0;
let startMouseY = 0;

// Orbit calculations
let orbitAngle = 0;
let targetOrbitSpeed = 0.0012; // Faster default speed
let currentOrbitSpeed = 0.0012;
let isHoveringCard = false; // Tracks card hover for Cascade slow motion
let isDraggingOrbit = false;
let startDragX = 0;
let startDragY = 0; // Added for vertical tilt drag tracking
const orbitRadiusX = 620; // Increased to spread cards horizontally

// Vertical orbit tilt states
let targetOrbitRadiusY = 220;
let currentOrbitRadiusY = 220;

// Drag momentum (wheel of fortune) states
let lastDragTime = 0;
let dragVelocity = 0;
let isSpinningMomentum = false;

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
let isCascadeFocused = false; // Flag for paused and focused card state in Cascade
let focusScaleProgress = 0; // LERPed scale boost factor for focused card
let cascadePanX = 0; // Global left shift of cascade stack when focused (-150)
let isAnimatingFocus = false; // Prevents LERP from fighting GSAP during card switch
let focusGsapTween = null; // GSAP tween handle for card-to-card focus animation

// Unified media items (scraped projects only, no fake/placeholder items)
let combinedMediaItems = [...projectsDb];
let morphCards = [];

// Particle background variables
let canvas = null;
let ctx = null;
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

function getLocalizedValue(field, fallback = '') {
  if (!field) return fallback;
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    return field[currentLanguage] || field['pt'] || field['en'] || fallback;
  }
  return fallback;
}

function startLogoAlternator() {
  const logoText = document.getElementById('logo-text');
  if (!logoText) return;
  const words = ["CONRADO", "PORTFÓLIO"];
  const colors = ["#388E3C", "#DA291C", "#C8A415", "#1565C0"];
  let wordIdx = 0;
  let colorIdx = 0;
  logoText.style.color = colors[0];
  setInterval(() => {
    gsap.to(logoText, {
      opacity: 0,
      y: -5,
      duration: 0.4,
      onComplete: () => {
        wordIdx = (wordIdx + 1) % words.length;
        colorIdx = (colorIdx + 1) % colors.length;
        logoText.innerText = words[wordIdx];
        logoText.style.color = colors[colorIdx];
        gsap.fromTo(logoText, { y: 5, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 });
      }
    });
  }, 3000);
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  runLoader();
  initTheme();
  initLanguage();
  initParticles();

  buildMorphingCards();
  buildPsicromiaGallery();

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Tilt the central planet slightly toward the cursor (only in Orbit view)
    if (activeView === 'orbit') {
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
    }
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

  updateUnifiedLoop();
  bindSceneDrag();
  startLogoAlternator();
  animateCursor();
  addCursorInteractions();

  // Live Cover Preview & Local Upload
  const coverInput = document.getElementById('form-project-cover');
  if (coverInput) {
    coverInput.addEventListener('input', () => {
      updateCoverPreview(coverInput.value);
    });
  }

  const coverFileInput = document.getElementById('form-cover-file');
  if (coverFileInput) {
    coverFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          if (coverInput) {
            coverInput.value = "Comprimindo imagem...";
            coverInput.disabled = true;
          }
          const compressedBase64 = await compressImage(file, 1600, 0.75);
          if (coverInput) {
            coverInput.value = compressedBase64;
            coverInput.disabled = false;
            updateCoverPreview(compressedBase64);
          }
        } catch (error) {
          console.error("Erro ao comprimir capa:", error);
          alert("Falha ao processar e comprimir imagem.");
          if (coverInput) {
            coverInput.value = "";
            coverInput.disabled = false;
          }
        }
      }
    });
  }

  // Auto-Translation blur listeners
  const titlePtInput = document.getElementById('form-title-pt');
  if (titlePtInput) {
    titlePtInput.addEventListener('blur', () => {
      triggerAutoTranslation('form-title-pt', 'title');
    });
  }

  const subtitlePtInput = document.getElementById('form-subtitle-pt');
  if (subtitlePtInput) {
    subtitlePtInput.addEventListener('blur', () => {
      triggerAutoTranslation('form-subtitle-pt', 'subtitle');
    });
  }

  const descPtInput = document.getElementById('form-desc-pt');
  if (descPtInput) {
    descPtInput.addEventListener('blur', () => {
      triggerAutoTranslation('form-desc-pt', 'desc');
    });
  }

  window.addEventListener('wheel', (e) => {
    if (activeView === 'cascade') {
      if (e.deltaY > 0) {
        navigateCascade(1);
      } else {
        navigateCascade(-1);
      }
    } else if (activeView === 'psicromia') {
      const space = document.querySelector('.psicromia-space');
      if (space) {
        space.scrollLeft += e.deltaY;
      }
    }
  });

  // Arrow keys navigate gallery scroll
  document.addEventListener('keydown', (e) => {
    if (activeView === 'psicromia') {
      const track = document.getElementById('psicromia-track');
      if (!track) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        track.scrollBy({ left: 400, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        track.scrollBy({ left: -400, behavior: 'smooth' });
      }
    }
  });
});

// ==========================================================================
// SITE LOADER INTRO
// ==========================================================================
function runLoader() {
  const loader = document.getElementById('loader');

  const pts = [
    document.getElementById('geo-p0'),
    document.getElementById('geo-p1'),
    document.getElementById('geo-p2'),
    document.getElementById('geo-p3')
  ];
  const lines = [
    document.getElementById('geo-l01'),
    document.getElementById('geo-l02'),
    document.getElementById('geo-l12'),
    document.getElementById('geo-l03'),
    document.getElementById('geo-l13'),
    document.getElementById('geo-l23')
  ];
  const lineConnections = [[0,1],[0,2],[1,2],[0,3],[1,3],[2,3]];

  pts.forEach((p) => p.setAttribute('fill', '#ffffff'));

  const stages = [
    { pts: [[120,120], null, null, null],      lines: [0,0,0,0,0,0] },
    { pts: [[30,120], [210,120], null, null],   lines: [1,0,0,0,0,0] }, // Adjusted length to 180px
    { pts: [[120,30], [30,195], [210,195], null], lines: [1,1,1,0,0,0] }
  ];

  const NS = 'http://www.w3.org/2000/svg';
  const dyn = document.getElementById('geo-dynamic');
  let animLoop = null;
  let tetraOpacity = 1.0; // Control variable to fade out the tetrahedron as it spins

  function killAnim() { if (animLoop) { cancelAnimationFrame(animLoop); animLoop = null; } }

  function easeOut(t) { return 1 - Math.pow(1 - t, 2); }

  function tweenAttr(el, target, dur, cb) {
    const start = {};
    for (const k in target) start[k] = parseFloat(el.getAttribute(k) || el.style[k] || 0);
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const e = easeOut(p);
      for (const k in target) el.setAttribute(k, start[k] + (target[k] - start[k]) * e);
      if (p < 1) requestAnimationFrame(tick);
      else if (cb) cb();
    }
    requestAnimationFrame(tick);
  }

  function tweenOpacity(el, to, dur, cb) {
    const from = parseFloat(el.getAttribute('opacity') || 1);
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      el.setAttribute('opacity', from + (to - from) * easeOut(p));
      if (p < 1) requestAnimationFrame(tick);
      else if (cb) cb();
    }
    requestAnimationFrame(tick);
  }

  function animToStage(idx) {
    killAnim();
    dyn.innerHTML = '';
    const s = stages[idx];
    s.pts.forEach((pos, i) => {
      if (pos) tweenAttr(pts[i], { cx: pos[0], cy: pos[1], opacity: 1 }, 400);
      else tweenOpacity(pts[i], 0, 250);
    });
    lineConnections.forEach((c, i) => {
      const pa = s.pts[c[0]], pb = s.pts[c[1]];
      if (pa && pb && s.lines[i]) tweenAttr(lines[i], { x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1], opacity: 0.5 }, 400);
      else tweenOpacity(lines[i], 0, 250);
    });
  }

  function startTetrahedron() {
    killAnim();
    dyn.innerHTML = '';
    for (let i = 0; i < 6; i++) tweenOpacity(lines[i], 1, 200);

    // Perfect regular tetrahedron: vertices (±1, ±1, ±1) where product of signs = +1
    // All 6 edges have exactly the same length = 2*sqrt(2) ≈ 2.828 units
    // Scale so edge ≈ 192px (matching/evolving from the 180px triangle) → scale = 192 / (2*sqrt(2)) ≈ 67.8
    const scale = 68;
    const raw = [
      { x:  1, y:  1, z:  1 },
      { x:  1, y: -1, z: -1 },
      { x: -1, y:  1, z: -1 },
      { x: -1, y: -1, z:  1 }
    ];

    // Fixed tilt on X axis so we see the shape in 3D from a nice angle
    const tiltX = 0.42;
    const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);

    let angle = 0;
    function frame() {
      angle += 0.018;
      const cosA = Math.cos(angle), sinA = Math.sin(angle);

      const projected = raw.map(v => {
        // Rotate around Y axis
        const rx = v.x * cosA + v.z * sinA;
        const rz = -v.x * sinA + v.z * cosA;
        const ry = v.y;
        // Apply fixed tilt around X axis
        const ry2 = ry * cosX - rz * sinX;
        const rz2 = ry * sinX + rz * cosX;
        // Depth for pseudo-3D shading (rz2 ranges ~ -1.73 to 1.73)
        const depth = (rz2 + 2) / 4;
        return { x: 120 + rx * scale, y: 120 + ry2 * scale, depth };
      });

      projected.forEach((p, i) => {
        pts[i].setAttribute('cx', p.x);
        pts[i].setAttribute('cy', p.y);
        pts[i].setAttribute('r', '' + (2 + p.depth * 3));
        pts[i].setAttribute('opacity', '' + (0.4 + p.depth * 0.6) * tetraOpacity);
      });

      lineConnections.forEach((c, i) => {
        const pa = projected[c[0]], pb = projected[c[1]];
        const depth = (pa.depth + pb.depth) / 2;
        lines[i].setAttribute('x1', pa.x);
        lines[i].setAttribute('y1', pa.y);
        lines[i].setAttribute('x2', pb.x);
        lines[i].setAttribute('y2', pb.y);
        lines[i].setAttribute('opacity', '' + (0.15 + depth * 0.55) * tetraOpacity);
      });

      animLoop = requestAnimationFrame(frame);
    }
    frame();
  }

  // Track whether the site has fully loaded and whether the circle phase started
  let siteReady = false;
  let circlePhaseStarted = false;
  let minCircleTimePassed = false;

  // If already loaded (e.g. cached page) set flag immediately
  if (document.readyState === 'complete') {
    siteReady = true;
  } else {
    window.addEventListener('load', () => {
      siteReady = true;
      tryFadeOut();
    }, { once: true });
  }

  function tryFadeOut() {
    // Only fade when: circle is visible + site loaded + minimum display time passed
    if (circlePhaseStarted && siteReady && minCircleTimePassed) {
      fadeOutLoader();
    }
  }

  function fadeOutLoader() {
    killAnim();
    let op = 1;
    function fade() {
      op -= 0.025;
      if (op <= 0) {
        loader.style.opacity = 0;
        loader.style.display = 'none';
        animateOrbitEntry();
        return;
      }
      loader.style.opacity = op;
      requestAnimationFrame(fade);
    }
    requestAnimationFrame(fade);
  }

  function startCircle() {
    // Note: Do NOT call killAnim() here because we want the rotating tetrahedron loop to keep running as it fades out!
    dyn.innerHTML = '';

    // Animate the fading of the tetrahedron opacity from 1 to 0 over 800ms
    const t0 = performance.now();
    function fadeTetra(now) {
      const p = Math.min((now - t0) / 800, 1);
      tetraOpacity = 1.0 - easeOut(p);
      if (p < 1) requestAnimationFrame(fadeTetra);
    }
    requestAnimationFrame(fadeTetra);

    // Create a continuous outline circle (radius 96 described by the rotation)
    const R = 96;
    const outline = document.createElementNS(NS, 'circle');
    outline.setAttribute('cx', '120');
    outline.setAttribute('cy', '120');
    outline.setAttribute('r', '' + R);
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#ffffff');
    outline.setAttribute('stroke-opacity', '0.9');
    outline.setAttribute('stroke-width', '1.5');
    
    const circ = Math.PI * 2 * R;
    outline.setAttribute('stroke-dasharray', '' + circ);
    outline.setAttribute('stroke-dashoffset', '' + circ);
    dyn.appendChild(outline);
    
    // Draw the continuous circle outline over 800ms
    tweenAttr(outline, { 'stroke-dashoffset': 0 }, 800, () => {
      // Once fully drawn and tetrahedron faded, clean up the tetrahedron loop
      killAnim();
      pts.forEach(p => p.setAttribute('opacity', '0'));
      lines.forEach(l => l.setAttribute('opacity', '0'));
    });

    circlePhaseStarted = true;

    // Minimum 800ms in circle phase so it doesn't flash away instantly
    setTimeout(() => {
      minCircleTimePassed = true;
      tryFadeOut();
    }, 800);
  }

  pts[1].setAttribute('opacity', '0');
  pts[2].setAttribute('opacity', '0');
  pts[3].setAttribute('opacity', '0');
  for (let i = 0; i < 6; i++) lines[i].setAttribute('opacity', '0');

  animToStage(0);
  setTimeout(() => animToStage(1), 1000);
  setTimeout(() => animToStage(2), 2000);
  setTimeout(() => { startTetrahedron(); }, 3000);
  setTimeout(() => { startCircle(); }, 4500);
}

// ==========================================================================
// CENTRAL TEXT ANIMATION HELPER
// ==========================================================================
function setCenterText(newText) {
  const centerText = document.getElementById('orbit-center-text');
  if (!centerText || centerText.innerText === newText) return;
  
  gsap.killTweensOf(centerText);
  gsap.to(centerText, {
    opacity: 0,
    scale: 0.9,
    duration: 0.15,
    ease: "power1.in",
    onComplete: () => {
      centerText.innerText = newText;
      gsap.to(centerText, {
        opacity: 0.95,
        scale: 1,
        duration: 0.25,
        ease: "power1.out"
      });
    }
  });
}

// ==========================================================================
// BUILD UNIFIED MORPHING CARDS
// ==========================================================================
function buildMorphingCards() {
  const container = document.getElementById('projects-container');
  container.innerHTML = '';
  morphCards = [];
  combinedMediaItems = [...projectsDb]; // Re-initialize in case data was updated in the admin panel
  hoverScales = Array(combinedMediaItems.length).fill(1);

  combinedMediaItems.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'morph-card';
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-index', index);
    
    const title = getLocalizedValue(item.title);
    const desc = getLocalizedValue(item.description);

    // Ensure the card never remains without an image
    const fallbackImage = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";
    let imgUrl = item.image;
    if (!imgUrl || imgUrl.trim() === "") {
      imgUrl = fallbackImage;
    }

    card.innerHTML = `
      <img src="${imgUrl}" alt="${title}" onerror="this.src='${fallbackImage}';">
      <div class="morph-card__info">
        <h3 class="morph-card__title">${title}</h3>
        <p class="morph-card__desc">${desc}</p>
      </div>
    `;
    container.appendChild(card);
    morphCards.push(card);



    // Hover Events
    card.addEventListener('mouseenter', () => {
      // Ignore hover interactions during active spins so "ESTOU COM SORTE." text is preserved
      if (isSpinningMomentum || isSpinningEasterEgg) return;

      isHoveringCard = true;
      targetOrbitSpeed = 0.0002; // Slow motion speed on hover
      activeHoveredCard = card;

      if (activeView === 'orbit') {
        const title = getLocalizedValue(item.title);
        setCenterText(title);

        gsap.to(hoverScales, {
          [index]: 1.4, // Increased pop scale
          duration: 0.3,
          ease: "power2.out"
        });
        gsap.to(card, { borderColor: 'var(--accent-color)', duration: 0.4, ease: "power2.out" });
      }
    });

    card.addEventListener('mouseleave', () => {
      // Ignore mouseleave logic if the hover was ignored during a spin
      if (isSpinningMomentum || isSpinningEasterEgg) return;

      isHoveringCard = false;
      targetOrbitSpeed = 0.0012; // Restore faster speed
      activeHoveredCard = null;

      if (activeView === 'orbit') {
        setCenterText("CONRADO.");

        gsap.to(hoverScales, {
          [index]: 1.0,
          duration: 0.3,
          ease: "power2.out"
        });
        gsap.to(card, { borderColor: 'var(--glass-border)', duration: 0.4, ease: "power2.out" });
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

      // Stop propagation to prevent background click from resetting focus
      e.stopPropagation();

      const matchIdx = projectsDb.findIndex(p => p.id === item.id);
      if (activeView === 'orbit') {
        if (matchIdx !== -1) {
          smoothCascadeIndex = matchIdx;
          activeCascadeIndex = matchIdx;
          isCascadeFocused = true;
          switchView('cascade', true);
        }
      } else if (activeView === 'cascade') {
        if (matchIdx !== -1) {
          const M = projectsDb.length;
          const wrappedActiveIndex = mod(Math.round(smoothCascadeIndex), M);
          if (wrappedActiveIndex === matchIdx && isCascadeFocused) {
            isCascadeFocused = false;
            hideProjectInfoPanel();
            switchView('psicromia');
          } else if (isCascadeFocused) {
            // Animate: old card shrinks, cascade moves right, then slides to new card and grows
            isCascadeFocused = false;
            if (focusGsapTween) focusGsapTween.kill();
            const startIdx = smoothCascadeIndex;
            const targetIdx = matchIdx;
            const diff = targetIdx - startIdx;
            const dist = Math.abs(diff);
            const dur = gsap.utils.clamp(0.2, 0.6, dist * 0.15);
            isAnimatingFocus = true;
            focusGsapTween = gsap.to({}, {
              duration: dur,
              ease: "power2.inOut",
              onUpdate: function() {
                const p = this.progress();
                smoothCascadeIndex = startIdx + diff * p;
              },
              onComplete: () => {
                activeCascadeIndex = targetIdx;
                smoothCascadeIndex = targetIdx;
                isCascadeFocused = true;
                isAnimatingFocus = false;
                focusGsapTween = null;
                showProjectInfoPanel();
              }
            });
          } else {
            if (focusGsapTween) focusGsapTween.kill();
            const startIdx = smoothCascadeIndex;
            const targetIdx = matchIdx;
            const diff = targetIdx - startIdx;
            const dist = Math.abs(diff);
            const dur = gsap.utils.clamp(0.3, 0.7, dist * 0.15 + 0.2);
            isAnimatingFocus = true;
            focusGsapTween = gsap.to({}, {
              duration: dur,
              ease: "power2.inOut",
              onUpdate: function() {
                const p = this.progress();
                smoothCascadeIndex = startIdx + diff * p;
              },
              onComplete: () => {
                activeCascadeIndex = targetIdx;
                smoothCascadeIndex = targetIdx;
                isCascadeFocused = true;
                isAnimatingFocus = false;
                focusGsapTween = null;
                showProjectInfoPanel();
              }
            });
          }
        }
      }
    });

    // Right-click (contextmenu) event listener for zoom lens
  });
}

// ==========================================================================
// CURSOR ANIMATION & INTERACTIONS
// ==========================================================================
const cursorEl = document.getElementById('cursor');

function animateCursor() {
  if (!cursorEl) return;
  cursorEl.style.left = `${mouseX}px`;
  cursorEl.style.top = `${mouseY}px`;
  requestAnimationFrame(animateCursor);
}

function addCursorInteractions() {
  document.querySelectorAll('a, button, .nav__link, .vis-btn, .morph-card, .mosaic-card, .filter-btn, .filter-dropdown-item, .info-panel-more-btn, .psicromia-back-btn, .cascade-back-btn').forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (cursorEl) cursorEl.classList.add('hovered');
    });
    el.addEventListener('mouseleave', () => {
      if (cursorEl) {
        cursorEl.classList.remove('hovered');
        cursorEl.classList.remove('project-hover');
      }
    });
  });
  document.querySelectorAll('.mosaic-card, .gallery-item').forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (cursorEl) {
        cursorEl.classList.add('project-hover');
        cursorEl.classList.remove('hovered');
      }
    });
  });
}

// ==========================================================================
// UNIFIED MORPHING RENDER LOOP
// ==========================================================================
function updateUnifiedLoop() {
  // Smoothly LERP the vertical radius of the orbit (pitch tilt)
  currentOrbitRadiusY += (targetOrbitRadiusY - currentOrbitRadiusY) * 0.15;

  if (!isDraggingOrbit && !isDraggingOrbitRight && !isSpinningEasterEgg && !isSpinningMomentum) {
    currentOrbitSpeed += (targetOrbitSpeed - currentOrbitSpeed) * 0.1;
    orbitAngle += currentOrbitSpeed;
  }

  const N = morphCards.length;

  // LERP smoothCascadeIndex towards activeCascadeIndex for smooth transitions
  if (activeView === 'cascade') {
    if (!isDraggingCascade && !isCascadeFocused) {
      // Slowly auto-scroll File view if not focused
      if (isHoveringCard || isProjectInfoPanelVisible) {
        activeCascadeIndex += 0.001; // Slow motion speed
      } else {
        activeCascadeIndex += 0.003;  // File browsing speed
      }
    }
    
    // LERP the focus scale factor boost
    focusScaleProgress += ((isCascadeFocused ? 1 : 0) - focusScaleProgress) * 0.08;
    cascadePanX += ((isCascadeFocused ? -150 : 0) - cascadePanX) * 0.08;

    if (!isAnimatingFocus) {
      smoothCascadeIndex += (activeCascadeIndex - smoothCascadeIndex) * 0.05;
      if (Math.abs(activeCascadeIndex - smoothCascadeIndex) < 0.005) {
        smoothCascadeIndex = activeCascadeIndex;
      }
    }
    if (Math.abs(activeCascadeIndex - smoothCascadeIndex) < 0.005) {
      smoothCascadeIndex = activeCascadeIndex;
    }
    
    // Prevent float overflow by shifting index by multiples of M
    const M = projectsDb.length;
    if (M > 0 && Math.abs(activeCascadeIndex) > M * 10) {
      const shift = Math.round(activeCascadeIndex / M) * M;
      activeCascadeIndex -= shift;
      smoothCascadeIndex -= shift;
    }
  } else {
    smoothCascadeIndex = activeCascadeIndex;
    focusScaleProgress += (0 - focusScaleProgress) * 0.08;
    cascadePanX += (0 - cascadePanX) * 0.08;
  }

  const p = transitionProgress.value; 

  morphCards.forEach((card, index) => {
    // ORBIT STATE
    const theta = (index / N) * 2 * Math.PI + orbitAngle;
    const ox = Math.cos(theta) * orbitRadiusX;
    const oy = Math.sin(theta) * currentOrbitRadiusY; // Uses the dynamic pitch tilt radius
    const oz = Math.sin(theta); 
    const oScale = gsap.utils.mapRange(-1, 1, 0.42, 0.58, oz); // Aumentada escala mínima para preencher o espaço atrás
    const oOpacity = 1.0;
    const oZIndex = Math.floor(gsap.utils.mapRange(-1, 1, 110, 200, oz));
    const oRotateY = 0;

    // FILE MODE (formerly Cascade)
    let cx, cy, cz, cScale, cOpacity, cRotateY, cZIndex;

    if (index < projectsDb.length) {
      const M = projectsDb.length;
      const offset = getWrappedOffset(index, smoothCascadeIndex, M);
      const absOffset = Math.abs(offset);
      const roundedOffset = Math.round(offset);
      const isCenter = roundedOffset === 0;

      // Equal diagonal spacing like files in a folder
      const spacingX = 110;
      const spacingY = 130;
      const isActive = isCenter && isCascadeFocused;

      cx = offset * spacingX + (isActive ? 0 : cascadePanX);
      cy = -offset * spacingY;
      cz = isActive ? 80 : 0;

      // All cards same scale; only focused card gets larger
      cScale = isActive ? 1.35 : 1.0;

      cOpacity = 1.0;
      cRotateY = 0;

      // Bottom cards overlap top cards (inverted stacking)
      cZIndex = isActive ? 999 : Math.floor(100 - offset * 8);

      if (isCenter) {
        card.classList.add('active-cascade');
      } else {
        card.classList.remove('active-cascade');
      }
    } else {
      cx = Math.cos(theta) * orbitRadiusX * 1.8;
      cy = Math.sin(theta) * currentOrbitRadiusY * 1.8;
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
    const finalZ = (oz * 100 + 120) + (cz - (oz * 100 + 120)) * p;
    const finalScale = (oScale + (cScale - oScale) * p) * (hoverScales[index] || 1);
    const finalOpacity = oOpacity + (cOpacity - oOpacity) * p;
    const finalRotateY = oRotateY + (cRotateY - oRotateY) * p;
    const finalZIndex = (activeHoveredCard === card && activeView !== 'cascade') ? 999 : (p > 0.5 ? cZIndex : oZIndex);

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

  const M = projectsDb.length;
  if (M === 0) return;
  const wrappedActiveIndex = mod(Math.round(activeCascadeIndex), M);
  const item = projectsDb[wrappedActiveIndex];
  if (!item) return;

  const year = item.year || '';
  const tags = (item.tags || []).join(' / ');
  const title = getLocalizedValue(item.title);
  const subtitle = getLocalizedValue(item.subtitle);
  const desc = getLocalizedValue(item.description);

  const yearEl = document.getElementById('info-panel-year');
  const tagsEl = document.getElementById('info-panel-tags');
  const titleEl = document.getElementById('info-panel-title');
  const subtitleEl = document.getElementById('info-panel-subtitle');
  const descEl = document.getElementById('info-panel-desc');

  if (yearEl) yearEl.innerText = year;
  if (tagsEl) tagsEl.innerText = tags;
  if (titleEl) titleEl.innerText = title;
  if (subtitleEl) {
    subtitleEl.innerText = subtitle;
    subtitleEl.style.display = subtitle ? 'block' : 'none';
  }
  if (descEl) descEl.innerText = desc;
  
  lastDisplayedCascadeIndex = wrappedActiveIndex;
}

function showProjectInfoPanel() {
  updateProjectInfoPanel();
  const panel = document.getElementById('project-info-panel');
  gsap.to(panel, {
    opacity: 1,
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
      if (isSpinningEasterEgg || isSpinningMomentum) {
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

    if (activeView === 'orbit' && (isSpinningEasterEgg || isSpinningMomentum)) {
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
      startDragY = e.clientY;
      lastDragTime = Date.now();
      dragVelocity = 0;
    } else if (activeView === 'cascade') {
      isDraggingCascade = true;
      startCascadeDragX = e.clientX;
      hideProjectInfoPanel(); // Hide immediately on click/drag start!
    }
  };

  container.addEventListener('mousedown', onMouseDown);
  container.addEventListener('click', (e) => {
    if (activeView === 'cascade' && isCascadeFocused) {
      if (dragDistance <= 6) {
        isCascadeFocused = false;
        focusScaleProgress = 0;
        cascadePanX = 0;
        if (focusGsapTween) { focusGsapTween.kill(); focusGsapTween = null; }
        isAnimatingFocus = false;
        hideProjectInfoPanel();
      }
    }
  });
  if (psicromiaContainer) {
    psicromiaContainer.addEventListener('mousedown', onMouseDown);
  }

  document.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      dragDistance = Math.sqrt(dx * dx + dy * dy);

      // If we are active-dragging, show native grabbing cursor
      if (dragDistance > 3 && (isDraggingOrbit || isDraggingOrbitRight || isDraggingCascade || isDraggingPsicromia)) {
        document.body.style.cursor = 'grabbing';
      }
    }

    if (isDraggingOrbit && activeView === 'orbit') {
      const now = Date.now();
      const dt = Math.max(1, now - lastDragTime);
      const deltaX = e.clientX - startDragX;
      const deltaY = e.clientY - startDragY; // Vertical shift

      // Calculate angular movement delta
      const deltaAngle = -deltaX * 0.005;
      const instantVelocity = deltaAngle / dt;
      // Exponential moving average filter for velocity smoothing
      dragVelocity = dragVelocity * 0.35 + instantVelocity * 0.65;

      orbitAngle += deltaAngle;

      // Adjust orbit vertical tilt (pitch) based on vertical drag delta
      targetOrbitRadiusY = Math.max(60, Math.min(380, targetOrbitRadiusY - deltaY * 0.8));

      startDragX = e.clientX;
      startDragY = e.clientY;
      lastDragTime = now;
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
    }
  });

  document.addEventListener('mouseup', () => {
    const wasDraggingOrbit = isDraggingOrbit;

    isMouseDown = false;
    isDraggingOrbit = false;
    isDraggingCascade = false;
    isDraggingPsicromia = false;

    // Return the orbit vertical tilt/pitch to its initial default (220) on release
    if (activeView === 'orbit') {
      targetOrbitRadiusY = 220;
    }

    if (isDraggingOrbitRight && activeView === 'orbit') {
      isDraggingOrbitRight = false;
      if (rightDragAccumulated > 150 && !isSpinningEasterEgg) {
        triggerEasterEggSpin();
      }
    }
    isDraggingOrbitRight = false;

    // Restore default cursor
    document.body.style.cursor = 'default';

    // Trigger Momentum Spin (Wheel of Fortune physics) on release if flicked fast enough
    if (activeView === 'orbit' && wasDraggingOrbit && Math.abs(dragVelocity) > 0.001) {
      triggerMomentumSpin(dragVelocity);
    }
  });
}

function navigateCascade(dir) {
  isAnimatingFocus = false;
  if (focusGsapTween) { focusGsapTween.kill(); focusGsapTween = null; }
  activeCascadeIndex += dir;
  isCascadeFocused = false; // Reset focus state on manual navigation
  hideProjectInfoPanel();
}

function triggerMomentumSpin(velocity) {
  if (projectsDb.length === 0 || isSpinningEasterEgg || isSpinningMomentum) return;

  const N = combinedMediaItems.length;
  // Estimate final projected angle based on velocity.
  // Spin duration: proportional to velocity, e.g. from 2.0 to 4.5s.
  const duration = Math.min(4.5, Math.max(2.0, Math.abs(velocity) * 1200));
  
  // Total angle rotation estimate: velocity * duration * 800
  const spinDistance = velocity * duration * 800;
  const projectedAngle = orbitAngle + spinDistance;
  
  // Snap index calculation (frontmost index at end of spin)
  const targetIdx = mod(Math.round(((Math.PI / 2 - projectedAngle) / (2 * Math.PI)) * N), N);
  const snapAngle = Math.PI / 2 - (targetIdx / N) * 2 * Math.PI;
  
  // Align snap angle to the spin direction
  let diff = (snapAngle - projectedAngle) % (2 * Math.PI);
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  
  let finalTargetAngle = projectedAngle + diff;
  
  // Ensure it rotates in the correct direction of the flick speed
  if (velocity > 0 && finalTargetAngle < orbitAngle) {
    finalTargetAngle += 2 * Math.PI;
  } else if (velocity < 0 && finalTargetAngle > orbitAngle) {
    finalTargetAngle -= 2 * Math.PI;
  }

  // Change center text while the wheel of fortune is spinning
  const lucky = translations[currentLanguage]?.["misc.lucky"] || "ESTOU COM SORTE.";
  setCenterText(lucky);

  isSpinningMomentum = true;
  let spinObj = { angle: orbitAngle };

  gsap.to(spinObj, {
    angle: finalTargetAngle,
    duration: duration,
    ease: "power4.out",
    onUpdate: () => {
      orbitAngle = spinObj.angle;
    },
    onComplete: () => {
      isSpinningMomentum = false;
      dragVelocity = 0;

      // Select the snapped project
      activeCascadeIndex = targetIdx;
      
      // Auto transition to Cascade view
      switchView('cascade');
      
      // Open the card focused and show the project info panel immediately
      isCascadeFocused = true;
      showProjectInfoPanel();
    }
  });
}

function triggerEasterEggSpin() {
  if (projectsDb.length === 0) return;
  const randomIdx = Math.floor(Math.random() * projectsDb.length);
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
      isCascadeFocused = true;
      
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
// CIRCLE MODE TOGGLE (Orbit view)
// ==========================================================================
let isCircleMode = false;

function toggleCircles() {
  isCircleMode = !isCircleMode;
  const btn = document.getElementById('btn-circles');
  if (isCircleMode) {
    document.body.classList.add('circle-mode');
    if (btn) btn.classList.add('active');
  } else {
    document.body.classList.remove('circle-mode');
    if (btn) btn.classList.remove('active');
  }
}

// ==========================================================================
// MORPH VIEW SWITCHER
// ==========================================================================
function switchView(viewName, keepFocus = false) {
  if (activeView === viewName) return;
  if (viewName !== 'orbit' && isCircleMode) {
    isCircleMode = false;
    document.body.classList.remove('circle-mode');
    const btn = document.getElementById('btn-circles');
    if (btn) btn.classList.remove('active');
  }
  activeView = viewName;

  if (viewName !== 'cascade') {
    isCascadeFocused = false;
    isAnimatingFocus = false;
    if (focusGsapTween) { focusGsapTween.kill(); focusGsapTween = null; }
  } else {
    gsap.killTweensOf(hoverScales);
    hoverScales.fill(1);
    morphCards.forEach(card => {
      card.style.borderColor = '';
    });
  }

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
    gsap.to('#orbit-center-text', { opacity: 0, duration: 0.3 });

    // Capture info panel position for text morph animation
    const infoPanel = document.getElementById('project-info-panel');
    let infoRect = null;
    if (infoPanel) {
      infoRect = infoPanel.getBoundingClientRect();
    }

    // Fade out info panel
    gsap.to('#project-info-panel', {
      opacity: 0, yPercent: -50, y: 20, duration: 0.5, ease: "power2.in", pointerEvents: 'none'
    });

    // Build gallery (populates header text)
    activePhotoIndex = 0;
    buildPsicromiaGallery();

    // Animate header morphing from info panel position
    const header = document.getElementById('project-detail-header');
    if (infoRect && header) {
      const hRect = header.getBoundingClientRect();
      const dx = infoRect.left - hRect.left;
      const dy = (infoRect.top + infoRect.height / 2) - (hRect.top + hRect.height / 2);
      if (isFinite(dx) && isFinite(dy)) {
        gsap.fromTo(header,
          { x: dx, y: dy, opacity: 0 },
          { x: 0, y: 0, opacity: 1, duration: 0.9, ease: "power3.out", clearProps: "transform" }
        );
      } else {
        gsap.fromTo(header, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" });
      }
    } else {
      gsap.fromTo(header, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" });
    }

    animatePsicromiaEntry();
  } else {
    // Animate gallery exit before switching scenes
    const psicCards = document.querySelectorAll('.mosaic-card');
    const psicHeader = document.getElementById('project-detail-header');
    if (psicCards.length > 0) {
      gsap.to(psicCards, { x: 60, opacity: 0, duration: 0.3, stagger: 0.02, ease: "power2.in" });
    }
    if (psicHeader) gsap.to(psicHeader, { x: 60, opacity: 0, duration: 0.3, ease: "power2.in" });
    gsap.delayedCall(0.4, () => {
      document.getElementById('psicromia-scene').classList.remove('active');
      document.getElementById('projects-scene').classList.add('active');
      if (psicCards.length > 0) gsap.set(psicCards, { x: 0, opacity: 0 });
      if (psicHeader) gsap.set(psicHeader, { x: 0, opacity: 1, clearProps: "transform" });
    });

    gsap.to('.visualizer-select', { opacity: 1, y: 0, duration: 0.5, pointerEvents: 'auto' });

    // Update active button indicators
    document.querySelectorAll('.vis-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const btn = document.getElementById(`btn-${viewName}`);
    if (btn) btn.classList.add('active');

    if (viewName === 'cascade') {
      if (!keepFocus) {
        isCascadeFocused = false; // reset when entered via switchView
      }
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

      if (!keepFocus) {
        // Update text values in the background but keep the panel hidden by default
        updateProjectInfoPanel(true);
        gsap.to('#project-info-panel', {
          opacity: 0,
          duration: 0.3,
          pointerEvents: 'none'
        });
      } else {
        showProjectInfoPanel();
      }
    } else {
      // viewName === 'orbit'
      const centerText = document.getElementById('orbit-center-text');
      if (centerText) centerText.innerText = "CONRADO.";

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
function generatePlaceholderSVG(w, h, index, projectName) {
  const hue = (index * 47) % 360;
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'%3E%3Crect width='${w}' height='${h}' fill='hsl(${hue},40%25,55%25)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle' fill='white' font-family='sans-serif' font-size='${Math.round(Math.min(w, h) * 0.06)}'%3E${encodeURIComponent(projectName)}%3C/text%3E%3Ctext x='50%25' y='${Math.round(h * 0.6)}' text-anchor='middle' dominant-baseline='middle' fill='rgba(255,255,255,0.6)' font-family='sans-serif' font-size='${Math.round(Math.min(w, h) * 0.035)}'%3EImagem ${index + 1}%3C/text%3E%3C/svg%3E`;
}

function buildPsicromiaGallery() {
  const track = document.getElementById('psicromia-track');
  const bannerContainer = document.getElementById('gallery-banner');
  if (!track) return;
  track.innerHTML = '';
  if (bannerContainer) bannerContainer.innerHTML = '';

  const M = projectsDb.length;
  if (M === 0) return;
  const wrappedActiveIndex = mod(Math.round(activeCascadeIndex), M);
  const project = projectsDb[wrappedActiveIndex];
  if (!project) return;

  document.getElementById('detail-header-year').innerText = project.year || '';
  document.getElementById('detail-header-tags').innerText = (project.tags || []).join(' / ');
  document.getElementById('detail-header-title').innerText = getLocalizedValue(project.title);
  document.getElementById('detail-header-desc').innerText = getLocalizedValue(project.description);

  const mediaItems = project.media || [];
  const finalMedia = mediaItems.length > 0 ? mediaItems : [{ type: "image", url: project.image }];

  // Separate banners from gallery items
  const galleryItems = finalMedia.filter(item => !item.banner);
  const banners = finalMedia.filter(item => item.banner);

  const loadPromises = [];

  // Render gallery cards (non-banner)
  galleryItems.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'mosaic-card';

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.className = 'mosaic-media';
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.onerror = function() {
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'height:100%;min-width:200px;display:flex;align-items:center;justify-content:center;background:hsl(0,0%,85%);border-radius:10px;font-family:sans-serif;font-size:0.85rem;color:#666;padding:20px;box-sizing:border-box;';
        placeholder.textContent = 'Vídeo indisponível';
        this.parentElement.replaceChild(placeholder, this);
      };
      video.src = item.url;
      card.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.className = 'mosaic-media';
      img.alt = getLocalizedValue(project.title);

      const p = new Promise(resolve => {
        const onLoad = () => resolve();
        img.addEventListener('load', onLoad);
        img.addEventListener('error', () => {
          img.src = generatePlaceholderSVG(800, 600, index, getLocalizedValue(project.title));
          if (img.complete) { onLoad(); }
          else { img.addEventListener('load', onLoad); }
        });
      });
      loadPromises.push(p);

      img.src = item.url;
      card.appendChild(img);
    }

    track.appendChild(card);

    card.addEventListener('click', () => {
      openLightbox(item);
    });
  });

  if (loadPromises.length > 0) {
    Promise.allSettled(loadPromises).then(() => {
      requestAnimationFrame(() => {
        const t = document.getElementById('psicromia-track');
        if (t) {
          t.style.overflowX = 'hidden';
          requestAnimationFrame(() => {
            t.style.overflowX = 'scroll';
          });
        }
      });
    });
  }

  // Render banners
  if (bannerContainer) {
    banners.forEach((item) => {
      if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = getLocalizedValue(project.title);
        img.onerror = function() {
          this.style.display = 'none';
        };
        bannerContainer.appendChild(img);
      }
    });
  }
}

function updatePsicromiaGalleryPositions() {
  // No-op for the new grid layout (prevents runtime call errors)
}

function navigatePsicromia(dir) {
  // No-op for the new grid layout (prevents runtime call errors)
}

function exitPsicromia() {
  switchView('cascade');
}

function animatePsicromiaEntry() {
  const track = document.getElementById('psicromia-track');
  if (track) track.scrollLeft = 0;

  // Reset any transforms from previous exit animation
  const header = document.getElementById('project-detail-header');
  if (header) gsap.set(header, { x: 0, opacity: 1, clearProps: "transform" });

  gsap.fromTo('.psicromia-back-btn', { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power2.out" });

  const cards = document.querySelectorAll('.mosaic-card');
  if (cards.length > 0) {
    gsap.set(cards, { clearProps: "transform" });
    gsap.fromTo(cards, 
      { x: -30, opacity: 0 },
      { 
        x: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.05,
        ease: "power3.out" 
      }
    );
  }
}

// Lightbox controller functions
function openLightbox(item) {
  const overlay = document.getElementById('lightbox-overlay');
  const content = overlay.querySelector('.lightbox-content');
  content.innerHTML = '';
  
  if (item.type === 'video') {
    const video = document.createElement('video');
    video.src = item.url;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    content.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = 'Zoomed project media';
    content.appendChild(img);
  }
  
  overlay.classList.add('active');
  document.addEventListener('keydown', onLightboxKeydown);
}

function onLightboxKeydown(e) {
  if (e.key === 'Escape') closeLightbox();
}

function closeLightbox() {
  const overlay = document.getElementById('lightbox-overlay');
  overlay.classList.remove('active');
  
  // Stop any playing video
  const content = overlay.querySelector('.lightbox-content');
  content.innerHTML = '';
  
  document.removeEventListener('keydown', onLightboxKeydown);
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
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr && onclickAttr.includes(currentLanguage)) {
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
  if (savedTheme) {
    currentTheme = savedTheme;
  } else {
    const hour = new Date().getHours();
    currentTheme = (hour >= 6 && hour < 18) ? 'light' : 'dark';
  }
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
  if (!btn) return;
  if (currentTheme === 'dark') {
    btn.style.backgroundColor = '#ffffff';
    btn.style.border = 'none';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="#000000" stroke="none">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    `;
  } else {
    btn.style.backgroundColor = '#f5a623';
    btn.style.border = 'none';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5" fill="#ffffff"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    `;
  }
}



// ==========================================================================
// SPACE PARTICLES SYSTEM
// ==========================================================================
function initParticles() {
  canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  if (!ctx) return;

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
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
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
    
    if (canvas) {
      if (this.x < 0) this.x = canvas.width;
      if (this.x > canvas.width) this.x = 0;
      if (this.y < 0) this.y = canvas.height;
      if (this.y > canvas.height) this.y = 0;
    }
  }
  
  draw() {
    if (!ctx) return;
    ctx.fillStyle = currentTheme === 'dark' ? 'rgba(245, 243, 239, 0.35)' : 'rgba(26, 24, 20, 0.15)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function animateParticles() {
  if (!ctx || !canvas) return;
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
  const name = form.querySelector('input[type="text"]')?.value || '';
  const email = form.querySelector('input[type="email"]')?.value || '';
  const message = form.querySelector('textarea')?.value || '';
  const lang = translations[currentLanguage] || translations['pt'];

  const subject = encodeURIComponent(`Contato do Portfólio — ${name}`);
  const body = encodeURIComponent(
    `Nome: ${name}\nE-mail: ${email}\n\nMensagem:\n${message}`
  );

  window.open(`mailto:falaconrado@gmail.com?subject=${subject}&body=${body}`, '_blank');

  const successMsg = lang["contact.success"] || "Message sent!";
  alert(successMsg);
  form.reset();
  closeAllPanels();
}

// ==========================================================================
// ADMIN PANEL FUNCTIONS
// ==========================================================================
function openAdminPanel() {
  closeAllPanels();
  const panel = document.getElementById('admin-panel');
  if (panel) {
    panel.classList.add('active');
    renderAdminProjectsList();
  }
}

function closeAdminPanel() {
  const panel = document.getElementById('admin-panel');
  if (panel) {
    panel.classList.remove('active');
  }
  closeProjectForm();
}

function renderAdminProjectsList() {
  const listContainer = document.getElementById('admin-projects-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  projectsDb.forEach((project, idx) => {
    const item = document.createElement('div');
    item.className = 'admin-project-item';
    
    const title = project.title['pt'] || project.title;
    const imgUrl = project.image || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80";

    item.innerHTML = `
      <img src="${imgUrl}" alt="${title}" class="admin-project-thumb">
      <div class="admin-project-info">
        <span class="admin-project-title">${title}</span>
        <span class="admin-project-meta">${project.year} — ID: ${project.id}</span>
      </div>
      <div class="admin-project-actions">
        <button class="admin-btn admin-btn--edit" onclick="openProjectForm('${project.id}')">Editar</button>
        <button class="admin-btn admin-btn--delete" onclick="deleteProject('${project.id}')">Excluir</button>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

let activeEditingProjectId = null;

function openProjectForm(projectId = null) {
  activeEditingProjectId = projectId;
  const formModal = document.getElementById('admin-form-modal');
  const modalTitle = document.getElementById('admin-form-title');
  const form = document.getElementById('admin-project-form');
  
  if (!formModal || !form) return;

  // Clear media container
  const mediaContainer = document.getElementById('admin-form-media-rows');
  if (mediaContainer) mediaContainer.innerHTML = '';

  if (projectId) {
    modalTitle.innerText = "Editar Projeto";
    const project = projectsDb.find(p => p.id === projectId);
    if (project) {
      document.getElementById('form-project-id').value = project.id;
      document.getElementById('form-project-id').disabled = true; // disable changing ID on edit
      
      // Multilingual fields
      document.getElementById('form-title-pt').value = project.title['pt'] || '';
      document.getElementById('form-title-en').value = project.title['en'] || '';
      document.getElementById('form-title-es').value = project.title['es'] || '';
      document.getElementById('form-title-fr').value = project.title['fr'] || '';

      document.getElementById('form-subtitle-pt').value = project.subtitle ? (project.subtitle['pt'] || '') : '';
      document.getElementById('form-subtitle-en').value = project.subtitle ? (project.subtitle['en'] || '') : '';
      document.getElementById('form-subtitle-es').value = project.subtitle ? (project.subtitle['es'] || '') : '';
      document.getElementById('form-subtitle-fr').value = project.subtitle ? (project.subtitle['fr'] || '') : '';

      document.getElementById('form-desc-pt').value = project.description['pt'] || '';
      document.getElementById('form-desc-en').value = project.description['en'] || '';
      document.getElementById('form-desc-es').value = project.description['es'] || '';
      document.getElementById('form-desc-fr').value = project.description['fr'] || '';

      document.getElementById('form-project-year').value = project.year || '';
      document.getElementById('form-project-tags').value = (project.tags || []).join(', ');
      document.getElementById('form-project-cover').value = project.image || '';
      updateCoverPreview(project.image || '');
      document.getElementById('form-project-columns').value = project.columns || '1';

      // Populate media items
      const media = project.media || [];
      media.forEach(m => {
        addGalleryMediaRow(m.url, m.type, m.banner);
      });
    }
  } else {
    modalTitle.innerText = "Novo Projeto";
    form.reset();
      document.getElementById('form-project-id').value = '';
      document.getElementById('form-project-id').disabled = false;
      document.getElementById('form-project-columns').value = '1';
      updateCoverPreview('');
    // Add one default media row
    addGalleryMediaRow();
  }

  formModal.classList.add('active');
}

function closeProjectForm() {
  const formModal = document.getElementById('admin-form-modal');
  if (formModal) {
    formModal.classList.remove('active');
  }
}

function addGalleryMediaRow(url = '', type = 'image', banner = false) {
  const container = document.getElementById('admin-form-media-rows');
  if (!container) return;

  const rowId = 'gallery-media-row-' + Math.random().toString(36).substr(2, 9);
  const row = document.createElement('div');
  row.className = 'admin-media-row';
  row.id = rowId;
  row.style = 'display: flex; gap: 8px; align-items: center;';
  
  row.innerHTML = `
    <select class="admin-input form-media-type" style="width: 90px; padding: 4px;">
      <option value="image" ${type === 'image' ? 'selected' : ''}>Imagem</option>
      <option value="video" ${type === 'video' ? 'selected' : ''}>Vídeo</option>
    </select>
    <input type="text" class="admin-input form-media-url" placeholder="URL ou Base64" value="${url}" style="flex: 1; min-width: 0; padding: 6px;" required>
    <label style="font-size: 11px; display: flex; align-items: center; gap: 2px; white-space: nowrap;">
      <input type="checkbox" class="form-media-banner" ${banner ? 'checked' : ''}> Banner
    </label>
    <label class="admin-upload-btn" title="Upload Local">
      📁
      <input type="file" class="form-media-file" accept="image/*,video/*" style="display: none;">
    </label>
    <button type="button" class="admin-btn admin-btn--delete" onclick="this.parentElement.remove()" style="padding: 0 10px; font-size: 16px;">×</button>
  `;
  container.appendChild(row);

  // Setup upload change listener
  const fileInput = row.querySelector('.form-media-file');
  const urlInput = row.querySelector('.form-media-url');
  const typeSelect = row.querySelector('.form-media-type');

  if (fileInput && urlInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        const isVideo = file.type.startsWith('video/');
        typeSelect.value = isVideo ? 'video' : 'image';
        
        urlInput.value = "Carregando...";
        urlInput.disabled = true;

        try {
          if (isVideo) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
              urlInput.value = reader.result;
              urlInput.disabled = false;
            };
          } else {
            const compressed = await compressImage(file, 1600, 0.75);
            urlInput.value = compressed;
            urlInput.disabled = false;
          }
        } catch (err) {
          console.error("Erro ao carregar mídia local:", err);
          alert("Erro ao ler arquivo local.");
          urlInput.value = "";
          urlInput.disabled = false;
        }
      }
    });
  }
}

function saveProject(event) {
  event.preventDefault();

  const id = document.getElementById('form-project-id').value.trim();
  if (!id) return;

  const titlePt = document.getElementById('form-title-pt').value.trim();
  const year = document.getElementById('form-project-year').value.trim();
  const tagsStr = document.getElementById('form-project-tags').value.trim();
  const coverUrl = document.getElementById('form-project-cover').value.trim();

  // Parse tags
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

  // Parse media rows
  const mediaRows = document.querySelectorAll('.admin-media-row');
  const media = [];
  mediaRows.forEach(row => {
    const type = row.querySelector('.form-media-type').value;
    const url = row.querySelector('.form-media-url').value.trim();
    const banner = row.querySelector('.form-media-banner') ? row.querySelector('.form-media-banner').checked : false;
    if (url) {
      media.push({ type, url, banner });
    }
  });

  const projectObject = {
    id,
    tags,
    year,
    title: {
      pt: titlePt,
      en: document.getElementById('form-title-en').value.trim() || titlePt,
      es: document.getElementById('form-title-es').value.trim() || titlePt,
      fr: document.getElementById('form-title-fr').value.trim() || titlePt
    },
    subtitle: {
      pt: document.getElementById('form-subtitle-pt').value.trim(),
      en: document.getElementById('form-subtitle-en').value.trim(),
      es: document.getElementById('form-subtitle-es').value.trim(),
      fr: document.getElementById('form-subtitle-fr').value.trim()
    },
    description: {
      pt: document.getElementById('form-desc-pt').value.trim(),
      en: document.getElementById('form-desc-en').value.trim() || document.getElementById('form-desc-pt').value.trim(),
      es: document.getElementById('form-desc-es').value.trim() || document.getElementById('form-desc-pt').value.trim(),
      fr: document.getElementById('form-desc-fr').value.trim() || document.getElementById('form-desc-pt').value.trim()
    },
    image: coverUrl,
    media: media,
    columns: document.getElementById('form-project-columns').value || '1'
  };

  if (activeEditingProjectId) {
    // Edit mode
    const idx = projectsDb.findIndex(p => p.id === activeEditingProjectId);
    if (idx !== -1) {
      projectsDb[idx] = projectObject;
    }
  } else {
    // New project mode
    // Check duplication
    if (projectsDb.some(p => p.id === id)) {
      alert("Erro: Já existe um projeto com este ID!");
      return;
    }
    projectsDb.push(projectObject);
  }

  // Save and rebuild
  localStorage.setItem('portfolio_projects', JSON.stringify(projectsDb));
  buildMorphingCards();
  renderAdminProjectsList();
  closeProjectForm();
}

function deleteProject(projectId) {
  if (!confirm(`Tem certeza que deseja excluir o projeto "${projectId}"?`)) return;

  projectsDb = projectsDb.filter(p => p.id !== projectId);
  localStorage.setItem('portfolio_projects', JSON.stringify(projectsDb));
  
  buildMorphingCards();
  renderAdminProjectsList();
}

function exportPortfolioData() {
  const headerText = `// Copy and replace this content in data/portfolio.js to save permanently\nconst portfolioData = `;
  const dataString = JSON.stringify(projectsDb, null, 2);
  const fullContent = headerText + dataString + ";\n";

  const blob = new Blob([fullContent], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'portfolio.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Request Admin access prompting for password
function requestAdminAccess() {
  const password = prompt("Digite a senha de administrador:");
  if (password === 'Jc11286400*') {
    openAdminPanel();
  } else if (password !== null) {
    alert("Senha incorreta.");
  }
}

// Update the live cover image preview inside the project form
function updateCoverPreview(url) {
  const previewImg = document.getElementById('form-cover-preview');
  const placeholder = document.getElementById('form-cover-placeholder');
  if (previewImg && placeholder) {
    if (url && url.trim() !== '') {
      previewImg.src = url;
      previewImg.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      previewImg.src = '';
      previewImg.style.display = 'none';
      placeholder.style.display = 'block';
    }
  }
}

// Translate text using free MyMemory Translation API
async function translateText(text, targetLang) {
  if (!text || text.trim() === '') return '';
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=pt|${targetLang}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Translation request failed");
    const data = await response.json();
    if (data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    return text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

// Trigger automatic translation for all non-PT fields based on PT field value
async function triggerAutoTranslation(sourceFieldId, fieldType) {
  const sourceInput = document.getElementById(sourceFieldId);
  if (!sourceInput) return;
  const text = sourceInput.value.trim();
  if (!text) return;

  const targetLangs = ['en', 'es', 'fr'];
  
  // Set placeholders/values to "Traduzindo..." to show status
  targetLangs.forEach(lang => {
    const targetInput = document.getElementById(`form-${fieldType}-${lang}`);
    if (targetInput) {
      targetInput.value = "Traduzindo...";
      targetInput.disabled = true;
    }
  });

  // Fetch translations and update inputs
  for (const lang of targetLangs) {
    const targetInput = document.getElementById(`form-${fieldType}-${lang}`);
    if (targetInput) {
      const translated = await translateText(text, lang);
      targetInput.value = translated;
      targetInput.disabled = false;
    }
  }
}

// Compress image client-side using Canvas API
function compressImage(file, maxDimension = 1600, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize if it exceeds max dimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 jpeg
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
