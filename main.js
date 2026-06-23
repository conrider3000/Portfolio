// ==========================================================================
// CONFIGURATION & GLOBAL STATE
// ==========================================================================
let currentLanguage = 'pt';
let currentTheme = 'light';
let activeView = 'orbit'; // 'orbit', 'cascade', or 'psicromia'

// Morphing Transition State Variable
let transitionProgress = { value: 0 }; 
let psicromiaTransitionProgress = { value: 0 };
let isTransitioningToPsicromia = false;
let isTransitioningFromPsicromia = false;
let isEntryAnimating = true;

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
let targetOrbitRadiusY = 225;
let currentOrbitRadiusY = 225;

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

// Lightbox state variables
let currentLightboxItems = [];
let currentLightboxIndex = -1;

// Unified media items (scraped projects only, no fake/placeholder items)
let combinedMediaItems = [...projectsDb];
let morphCards = [];

// Particle background variables
let canvas = null;
let ctx = null;
let particlesArray = [];
const numberOfParticles = 35;

// ==========================================================================
// EARTH GLOBE — state
// ==========================================================================
let globeActive      = false;
let globeAnimId      = null;
let globeLon0        = -46.0;   // current center longitude (°)
let globeLat0        =  15.0;   // current center latitude  (°)
let globeTargetLon   =  -46.0;
let globeTargetLat   =   15.0;
let globeUserLon     = null;
let globeUserLat     = null;
let globeCityName    = null;
let globeFoundUser   = false;
let globePinPulse    = 0;
let isCenteringGlobe = false;
let isDraggingGlobe  = false;

// Satellite Globe Textures & Offscreen Canvas State
let earthDayImg = new Image();
let earthNightImg = new Image();
let earthDayLoaded = false;
let earthNightLoaded = false;
let dayPixels = null;
let nightPixels = null;
const texWidth = 2048;
const texHeight = 1024;
let globeOffscreenCanvas = null;
let globeOffscreenCtx = null;

earthDayImg.crossOrigin = "anonymous";
earthDayImg.src = "assets/earth_daymap.jpg";
earthDayImg.onload = () => {
  const off = document.createElement('canvas');
  off.width = texWidth;
  off.height = texHeight;
  const oCtx = off.getContext('2d');
  oCtx.drawImage(earthDayImg, 0, 0, texWidth, texHeight);
  dayPixels = oCtx.getImageData(0, 0, texWidth, texHeight).data;
  earthDayLoaded = true;
};
earthDayImg.onerror = () => {
  console.warn("Could not load day globe texture. Falling back to vector.");
  earthDayLoaded = false;
};

earthNightImg.crossOrigin = "anonymous";
earthNightImg.src = "assets/earth_nightmap.jpg";
earthNightImg.onload = () => {
  const off = document.createElement('canvas');
  off.width = texWidth;
  off.height = texHeight;
  const oCtx = off.getContext('2d');
  oCtx.drawImage(earthNightImg, 0, 0, texWidth, texHeight);
  nightPixels = oCtx.getImageData(0, 0, texWidth, texHeight).data;
  earthNightLoaded = true;
};
earthNightImg.onerror = () => {
  console.warn("Could not load night globe texture. Falling back to vector.");
  earthNightLoaded = false;
};

let earthCloudsImg = new Image();
let earthCloudsLoaded = false;
let cloudsPixels = null;

earthCloudsImg.crossOrigin = "anonymous";
earthCloudsImg.src = "https://clouds.matteason.co.uk/images/2048x1024/clouds-alpha.png";
earthCloudsImg.onload = () => {
  const off = document.createElement('canvas');
  off.width = texWidth;
  off.height = texHeight;
  const oCtx = off.getContext('2d');
  oCtx.drawImage(earthCloudsImg, 0, 0, texWidth, texHeight);
  cloudsPixels = oCtx.getImageData(0, 0, texWidth, texHeight).data;
  earthCloudsLoaded = true;
  console.log("Live satellite cloud map loaded successfully.");
};
earthCloudsImg.onerror = () => {
  console.warn("Could not load live cloud map. Loading fallback static clouds.");
  earthCloudsImg = new Image();
  earthCloudsImg.crossOrigin = "anonymous";
  earthCloudsImg.src = "assets/earth_clouds.jpg";
  earthCloudsImg.onload = () => {
    const off = document.createElement('canvas');
    off.width = texWidth;
    off.height = texHeight;
    const oCtx = off.getContext('2d');
    oCtx.drawImage(earthCloudsImg, 0, 0, texWidth, texHeight);
    cloudsPixels = oCtx.getImageData(0, 0, texWidth, texHeight).data;
    earthCloudsLoaded = true;
    console.log("Fallback static clouds loaded successfully.");
  };
  earthCloudsImg.onerror = () => {
    console.warn("Could not load fallback clouds.");
    earthCloudsLoaded = false;
  };
};

// Simplified continent polygon data  [lon°, lat°]
const EARTH_CONTINENTS = [
  // ── North America
  [[-168,72],[-148,70],[-138,60],[-134,56],[-130,54],[-126,50],[-124,48],
   [-124,44],[-120,38],[-118,34],[-117,32],[-110,24],[-104,20],[-90,16],
   [-84,10],[-78,8],[-76,4],[-68,12],[-62,10],[-52,4],[-52,8],[-56,20],
   [-62,26],[-70,44],[-66,44],[-60,46],[-66,48],[-70,52],[-72,60],
   [-74,64],[-80,70],[-86,72],[-100,72],[-120,70],[-140,70],[-160,72],[-168,72]],
  // ── South America
  [[-80,12],[-76,8],[-70,0],[-62,-4],[-52,-2],[-44,-2],[-36,-6],
   [-36,-10],[-38,-16],[-42,-22],[-44,-24],[-46,-30],[-52,-34],
   [-56,-38],[-64,-42],[-68,-50],[-70,-52],[-66,-56],[-60,-54],
   [-58,-40],[-52,-28],[-46,-18],[-38,-8],[-34,-4],[-42,0],
   [-50,2],[-60,4],[-62,8],[-66,4],[-72,12],[-80,12]],
  // ── Europe
  [[-10,36],[-8,38],[-6,40],[-8,44],[-4,44],[0,44],[4,44],[8,44],
   [14,42],[16,40],[18,40],[22,38],[24,40],[28,42],[30,46],[28,50],
   [26,54],[22,56],[18,58],[14,58],[10,58],[6,56],[4,52],[0,52],
   [-4,52],[-8,48],[-10,44],[-8,36],[-10,36]],
  // ── Africa
  [[-18,16],[-16,12],[-16,8],[-14,4],[-10,4],[-6,4],[-2,4],[2,4],
   [6,4],[10,4],[14,2],[16,-2],[18,-4],[20,-8],[24,-18],[26,-34],
   [28,-34],[32,-28],[34,-22],[36,-16],[38,-10],[40,-8],[42,-12],
   [44,-10],[44,-4],[42,0],[44,4],[44,10],[42,12],[40,14],[36,14],
   [32,18],[28,20],[24,20],[20,16],[16,14],[12,14],[8,14],[4,14],
   [0,14],[-4,14],[-8,14],[-12,14],[-16,14],[-18,16]],
  // ── Asia (main)
  [[28,72],[36,70],[46,68],[56,68],[66,66],[76,68],[86,70],[96,70],
   [106,68],[114,70],[124,68],[130,62],[140,60],[142,48],[138,40],
   [132,34],[126,24],[120,20],[114,18],[108,14],[104,6],[100,4],
   [96,8],[90,10],[82,14],[76,18],[72,22],[68,24],[64,24],
   [60,20],[54,18],[50,24],[46,28],[42,32],[38,28],[34,30],
   [30,36],[26,36],[24,40],[24,44],[26,48],[26,54],[24,66],[28,72]],
  // ── Indian peninsula
  [[72,22],[80,14],[80,8],[78,8],[72,10],[68,20],[72,22]],
  // ── Indochina
  [[100,20],[104,14],[106,10],[104,2],[100,4],[98,10],[100,20]],
  // ── Australia
  [[114,-22],[118,-20],[122,-18],[126,-14],[130,-12],[136,-12],
   [142,-10],[148,-14],[152,-22],[154,-28],[150,-34],[146,-38],
   [140,-36],[134,-34],[126,-34],[120,-28],[116,-22],[114,-22]],
  // ── Greenland
  [[-56,76],[-50,70],[-44,66],[-40,64],[-22,64],[-18,68],
   [-20,74],[-28,78],[-40,82],[-52,82],[-56,80],[-56,76]],
  // ── Japan (Honshu rough)
  [[130,32],[132,34],[134,36],[136,36],[138,38],[140,40],[142,42],
   [142,44],[140,44],[138,40],[136,38],[134,34],[130,32]],
  // ── UK / Ireland (rough)
  [[-8,52],[-6,54],[-4,56],[-2,58],[0,58],[2,56],[2,52],[0,50],
   [-4,50],[-6,50],[-8,52]],
  // ── New Zealand (rough)
  [[172,-44],[174,-46],[172,-46],[168,-44],[168,-40],[172,-38],
   [174,-36],[176,-36],[178,-36],[176,-40],[174,-44],[172,-44]],
];


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
  const words = ["Conrado", "Portfólio"];
  const bgColors = ["#e03a3a", "#2e7d32", "#4169e1", "#ffab00"]; // Vermelho Oficial, Verde Floresta, Azul Royal, Amarelo Alaranjado
  let wordIdx = 0;
  let colorIdx = 0;
  
  // Set initial styles
  logoText.style.color = "#ffffff";
  logoText.style.backgroundColor = bgColors[0];
  logoText.style.borderColor = bgColors[0];

  setInterval(() => {
    gsap.to(logoText, {
      opacity: 0,
      y: -5,
      duration: 0.4,
      onComplete: () => {
        wordIdx = (wordIdx + 1) % words.length;
        colorIdx = (colorIdx + 1) % bgColors.length;
        logoText.innerText = words[wordIdx];
        logoText.style.color = "#ffffff";
        logoText.style.backgroundColor = bgColors[colorIdx];
        logoText.style.borderColor = bgColors[colorIdx];
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
  initSaveExitDialog();
  initGlobeInfo();

  buildMorphingCards();
  buildPsicromiaGallery();

  // Bind click to central text to open globe focused on Curitiba
  const centerTextEl = document.getElementById('orbit-center-text');
  if (centerTextEl) {
    centerTextEl.addEventListener('click', (e) => {
      if (isEntryAnimating || isSpinningMomentum || isSpinningEasterEgg) return;
      e.stopPropagation();
      activateGlobe('curitiba');
    });
  }

  // If the loader finished its fadeout before main.js initialized, play entry anims now
  if (window.loaderFinished) {
    animateOrbitEntry();
  }

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (isEntryAnimating) return;

    // Rotate compass needle toward cursor
    const compass = document.getElementById('compass-icon');
    if (compass) {
      const rect = compass.getBoundingClientRect();
      const compassX = rect.left + rect.width / 2;
      const compassY = rect.top + rect.height / 2;
      const angle = Math.atan2(mouseY - compassY, mouseX - compassX) * (180 / Math.PI) + 90;
      gsap.to(compass, { rotation: angle, duration: 0.5, overwrite: "auto" });
    }

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
    if (isEntryAnimating) {
      e.preventDefault();
      return;
    }
    if (activeHoveredCard || activeView === 'orbit' || isDraggingOrbitRight) {
      e.preventDefault(); // Block default browser dropdown
    }
  });

  // Prevent middle-click scroll icon globally to keep custom cursor active
  document.addEventListener('mousedown', (e) => {
    if (isEntryAnimating) {
      e.preventDefault();
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
    }
  }, { passive: false });

  updateUnifiedLoop();
  bindSceneDrag();
  startLogoAlternator();
  animateCursor();
  addCursorInteractions();
  initWidgetGeo();
  startWidgetClock();

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
    if (isEntryAnimating) {
      e.preventDefault();
      return;
    }
    if (activeView === 'cascade') {
      if (e.deltaY > 0) {
        navigateCascade(1);
      } else {
        navigateCascade(-1);
      }
    } else if (activeView === 'psicromia') {
      const track = document.getElementById('psicromia-track');
      if (track) {
        track.scrollLeft += e.deltaY;
      }
    }
  });

  // Arrow keys navigate gallery + ESC closes all overlays in cascade order
  document.addEventListener('keydown', (e) => {
    if (isEntryAnimating) {
      e.preventDefault();
      return;
    }
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

    if (e.key === 'Escape') {
      // 0. Earth globe (highest priority)
      if (globeActive) {
        deactivateGlobe();
        return;
      }

      // Priority order: innermost overlay first → outermost last

      // 1. Lightbox (image zoom)
      const lightbox = document.getElementById('lightbox-overlay');
      if (lightbox && lightbox.classList.contains('active')) {
        closeLightbox();
        return;
      }

      // 2. Admin form modal — ask to save if dirty
      const adminForm = document.getElementById('admin-form-modal');
      if (adminForm && adminForm.classList.contains('active')) {
        if (formIsDirty) {
          showSaveExitDialog('form');
        } else {
          closeProjectForm();
        }
        return;
      }

      // 3. Admin panel — ask to save if form is open and dirty
      const adminPanel = document.getElementById('admin-panel');
      if (adminPanel && adminPanel.classList.contains('active')) {
        if (formIsDirty) {
          showSaveExitDialog('panel');
        } else {
          adminPanel.classList.remove('active');
        }
        return;
      }

      // 4. Side panels (sobre / contato)
      const panelOverlay = document.getElementById('panel-overlay');
      if (panelOverlay && panelOverlay.classList.contains('active')) {
        closeAllPanels();
        return;
      }

      // 5. Project info panel (cascade focused)
      if (activeView === 'cascade' && isCascadeFocused) {
        isCascadeFocused = false;
        hideProjectInfoPanel();
        return;
      }

      // 6. Psicromia view (detail gallery) -> Cascade view
      if (activeView === 'psicromia') {
        exitPsicromia();
        return;
      }

      // 7. Cascade view -> Orbit view
      if (activeView === 'cascade') {
        switchView('orbit');
        return;
      }
    }
  });
});

// ==========================================================================
// SITE LOADER INTRO
// ==========================================================================
//// (runLoader function removed and placed inline in index.html to load instantly)

// ==========================================================================
// EARTH GLOBE — functions
// ==========================================================================
function activateGlobe(focusOn = 'curitiba') {
  // Only in orbit view
  if (activeView !== 'orbit') return;

  const globeCanvas = document.getElementById('earth-globe');
  if (!globeCanvas) return;

  const firstActivation = !globeActive;
  globeActive      = true;
  isCenteringGlobe = true;
  globeFoundUser   = true; // immediately LERP to focus coordinates
  globePinPulse    = 0;

  if (focusOn === 'curitiba') {
    // Focus Curitiba (permanent pin)
    globeTargetLat = -25.4284;
    globeTargetLon = -49.2733;
    if (firstActivation) {
      // Start slightly rotated to create a smooth centering spin animation
      globeLon0 = -49.2733 - 55;
      globeLat0 = -25.4284 - 15;
    }
  } else {
    // Focus User Location (requires geolocation query)
    if (globeUserLat !== null && globeUserLon !== null) {
      globeTargetLat = globeUserLat;
      globeTargetLon = globeUserLon;
      if (firstActivation) {
        globeLon0 = globeUserLon - 55;
        globeLat0 = globeUserLat - 15;
      }
    } else {
      // Default to Curitiba rotation initially while querying
      globeTargetLat = -25.4284;
      globeTargetLon = -49.2733;
      if (firstActivation) {
        globeLon0 = -49.2733 - 55;
        globeLat0 = -25.4284 - 15;
      }
      getAndUpdatePosition(true);
    }
  }

  if (firstActivation) {
    const centerText  = document.getElementById('orbit-center-text');

    // Set canvas resolution (HiDPI)
    const dpr  = window.devicePixelRatio || 1;
    const SIZE = 270; // Decreased by an additional 5% (total 10% from original 300px)
    globeCanvas.style.width  = SIZE + 'px';
    globeCanvas.style.height = SIZE + 'px';
    globeCanvas.width  = SIZE * dpr;
    globeCanvas.height = SIZE * dpr;
    const gCtx = globeCanvas.getContext('2d');
    gCtx.scale(dpr, dpr);

    // Fade orbit-center text out
    gsap.to(centerText, { scale: 0.35, opacity: 0, duration: 0.32, ease: 'power2.in' });

    // Show globe canvas and animate in
    globeCanvas.style.display = 'block';
    globeCanvas.classList.add('globe-active');
    gsap.fromTo(globeCanvas,
      { opacity: 0, scale: 0.25, xPercent: -50, yPercent: -50, z: 120, y: -25 },
      { opacity: 1, scale: 1, xPercent: -50, yPercent: -50, z: 120, y: -25, duration: 0.55, delay: 0.2, ease: 'back.out(1.7)',
        onStart: () => startGlobeLoop(gCtx, SIZE) }
    );

    // Show globe info button container
    const infoContainer = document.getElementById('globe-info-container');
    if (infoContainer) {
      infoContainer.classList.add('active');
    }
  }

  // Implement interactive click-and-drag rotation
  let startPointerX = 0;
  let startPointerY = 0;
  let startLon0 = 0;
  let startLat0 = 0;
  let startOrbitAngle = 0;
  let dragDistance = 0;

  globeCanvas.onpointerdown = (e) => {
    e.stopPropagation();
    isDraggingGlobe = true;
    isCenteringGlobe = false; // Stop LERP immediately when manual drag begins!
    globeCanvas.setPointerCapture(e.pointerId);
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startLon0 = globeLon0;
    startLat0 = globeLat0;
    startOrbitAngle = orbitAngle;
    dragDistance = 0;
  };

  globeCanvas.onpointermove = (e) => {
    if (!isDraggingGlobe) return;
    e.stopPropagation();
    const dx = e.clientX - startPointerX;
    const dy = e.clientY - startPointerY;
    dragDistance = Math.sqrt(dx * dx + dy * dy);
    
    // Rotate the globe (adjust signs for natural dragging with South pole on top)
    globeLon0 = startLon0 + dx * 0.45;
    globeLat0 = startLat0 - dy * 0.45;
    
    if (globeLat0 > 85) globeLat0 = 85;
    if (globeLat0 < -85) globeLat0 = -85;
    
    globeTargetLon = globeLon0;
    globeTargetLat = globeLat0;

    // Rotate orbit in the INVERSE direction of the planet rotation
    orbitAngle = startOrbitAngle - dx * 0.005;
  };

  globeCanvas.onpointerup = (e) => {
    if (!isDraggingGlobe) return;
    e.stopPropagation();
    isDraggingGlobe = false;
    globeCanvas.releasePointerCapture(e.pointerId);
    
    // If pointer travels very little, treat as click and close the globe
    if (dragDistance < 6) {
      deactivateGlobe();
    }
  };
}

function deactivateGlobe(onCompleteCallback = null) {
  if (!globeActive) {
    if (onCompleteCallback) onCompleteCallback();
    return;
  }
  globeActive = false;

  // Hide info button container and popover
  const infoContainer = document.getElementById('globe-info-container');
  const popover = document.getElementById('globe-info-popover');
  if (infoContainer) infoContainer.classList.remove('active');
  if (popover) popover.classList.remove('open');

  const globeCanvas = document.getElementById('earth-globe');
  const centerText  = document.getElementById('orbit-center-text');

  gsap.to(globeCanvas, {
    opacity: 0, scale: 0, xPercent: -50, yPercent: -50, z: 120, y: -25, duration: 0.35, ease: 'power2.in',
    onComplete: () => {
      globeCanvas.style.display = 'none';
      globeCanvas.classList.remove('globe-active');
      if (globeAnimId) { cancelAnimationFrame(globeAnimId); globeAnimId = null; }
      
      if (onCompleteCallback) {
        onCompleteCallback();
      } else {
        if (activeView === 'orbit') {
          if (centerText) {
            if (activeHoveredCard) {
              const cardIdx = parseInt(activeHoveredCard.getAttribute('data-index'));
              const item = combinedMediaItems[cardIdx];
              if (item) {
                setCenterText(getLocalizedValue(item.title));
              } else {
                setCenterText("CONRADO.");
              }
            } else {
              setCenterText("CONRADO.");
            }
            gsap.to(centerText, { scale: 1, opacity: 0.95, duration: 0.4, delay: 0.15, ease: 'power2.out' });
          }
        }
      }
    }
  });
}

function onGlobeGeoSuccess(pos) {
  globeUserLon   = pos.coords.longitude;
  globeUserLat   = pos.coords.latitude;
  globeTargetLon = pos.coords.longitude;
  globeTargetLat = pos.coords.latitude;
  globeFoundUser = true;

  // Reverse geocode — Nominatim (free, no key)
  fetch(`https://nominatim.openstreetmap.org/reverse?lat=${globeUserLat}&lon=${globeUserLon}&format=json&accept-language=pt`)
    .then(r => r.json())
    .then(data => {
      globeCityName = data.address?.city
        || data.address?.town
        || data.address?.village
        || data.address?.county
        || null;
    })
    .catch(() => {});
}

function startGlobeLoop(gCtx, SIZE) {
  if (globeAnimId) cancelAnimationFrame(globeAnimId);
  function loop() {
    if (!globeActive) return;
    renderGlobe(gCtx, SIZE);
    globeAnimId = requestAnimationFrame(loop);
  }
  loop();
}

function renderGlobe(gCtx, SIZE) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R  = SIZE / 2 - 3;

  // — Rotation logic —
  if (isCenteringGlobe) {
    let dLon = globeTargetLon - globeLon0;
    while (dLon >  180) dLon -= 360;
    while (dLon < -180) dLon += 360;
    const dLat = globeTargetLat - globeLat0;
    globeLon0 += dLon * 0.045; // Snappier LERP focus
    globeLat0 += dLat * 0.045;
    
    // When close enough, release centering lock to allow free spin
    if (Math.abs(dLon) < 0.25 && Math.abs(dLat) < 0.25) {
      isCenteringGlobe = false;
    }
  } else if (!isDraggingGlobe) {
    // Smooth auto-spin from current position when not centering and not dragging
    globeLon0 += 0.12; 
  }

  const lon0 = globeLon0 * Math.PI / 180;
  const lat0 = globeLat0 * Math.PI / 180;

  // Force illuminated Day Earth theme for both Day and Night modes as requested (too dark in Night Earth mode)
  const activeGlobeTheme = 'day';
  const pixels = dayPixels;
  const useTexture = earthDayLoaded;

  gCtx.clearRect(0, 0, SIZE, SIZE);

  if (useTexture && pixels) {
    // Render pixel-by-pixel texture mapping on an offscreen canvas
    if (!globeOffscreenCanvas) {
      globeOffscreenCanvas = document.createElement('canvas');
      globeOffscreenCtx = globeOffscreenCanvas.getContext('2d');
    }
    if (globeOffscreenCanvas.width !== SIZE || globeOffscreenCanvas.height !== SIZE) {
      globeOffscreenCanvas.width = SIZE;
      globeOffscreenCanvas.height = SIZE;
    }
    
    const imgData = globeOffscreenCtx.createImageData(SIZE, SIZE);
    const data = imgData.data;
    const R2 = R * R;
    const cosLon = Math.cos(lon0);
    const sinLon = Math.sin(lon0);
    const cosLat = Math.cos(lat0);
    const sinLat = Math.sin(lat0);

    for (let y = 0; y < SIZE; y++) {
      const dy = y - cy;
      const dy2 = dy * dy;
      for (let x = 0; x < SIZE; x++) {
        const dx = x - cx;
        const dx2 = dx * dx;
        const dist2 = dx2 + dy2;
        const destIndex = (y * SIZE + x) * 4;

        if (dist2 <= R2) {
          const dz = Math.sqrt(R2 - dist2);
          
          const X = -dx / R;
          const Y = dy / R; // Invert canvas Y coordinate and rotate 180 deg to show South on top
          const Z = dz / R;

          // Rotate around X axis by lat0
          const X1 = X;
          const Y1 = Y * cosLat + Z * sinLat;
          const Z1 = -Y * sinLat + Z * cosLat;

          // Rotate around Y axis by lon0
          const rx = X1 * cosLon + Z1 * sinLon;
          const ry = Y1;
          const rz = -X1 * sinLon + Z1 * cosLon;

          const lat = Math.asin(ry);
          const lon = Math.atan2(rx, rz);

          const tx = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * texWidth) % texWidth;
          const ty = Math.floor(((Math.PI / 2 - lat) / Math.PI) * texHeight) % texHeight;

          const texIndex = (ty * texWidth + tx) * 4;

          let r = pixels[texIndex];
          let g = pixels[texIndex + 1];
          let b = pixels[texIndex + 2];

          // 1. Slightly increase brightness
          r *= 1.14;
          g *= 1.14;
          b *= 1.14;

          // 2. More slightly increase saturation
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const satFactor = 1.08;
          r = gray + (r - gray) * satFactor;
          g = gray + (g - gray) * satFactor;
          b = gray + (b - gray) * satFactor;

          // 3. Dynamic Ocean Shading & Glossy Specular Highlight (Sun Reflection)
          const isOcean = (b > r * 1.12) && (b > g * 0.98);
          if (isOcean) {
            // Blend with a rich, deep blue-cyan gradient based on depth Z (Z goes 0 at edges to 1 at center)
            const oceanBlend = 0.45; // 45% custom color blend
            const targetR = 10 * (1 - Z) + 15 * Z;
            const targetG = 45 * (1 - Z) + 75 * Z;
            const targetB = 100 * (1 - Z) + 160 * Z;

            r = r * (1 - oceanBlend) + targetR * oceanBlend;
            g = g * (1 - oceanBlend) + targetG * oceanBlend;
            b = b * (1 - oceanBlend) + targetB * oceanBlend;

            // Specular Phong highlight (glossy sun reflection off the water)
            const Hx = -0.25;
            const Hy = -0.25;
            const Hz = 0.93;
            const dot = X * Hx + Y * Hy + Z * Hz;
            if (dot > 0) {
              const spec = Math.pow(dot, 22) * 110;
              r += spec;
              g += spec;
              b += spec;
            }
          }

          // 4. Blend Clouds on top!
          if (earthCloudsLoaded && cloudsPixels) {
            let cloudIntensity = 0;
            if (cloudsPixels[texIndex + 3] < 255) {
              cloudIntensity = cloudsPixels[texIndex + 3] / 255;
            } else {
              cloudIntensity = cloudsPixels[texIndex] / 255;
            }

            // Shade clouds slightly with depth Z to give a 3D feel
            const cloudBrightness = 232 + Z * 23; // 232 to 255
            
            r = r * (1 - cloudIntensity) + cloudBrightness * cloudIntensity;
            g = g * (1 - cloudIntensity) + cloudBrightness * cloudIntensity;
            b = b * (1 - cloudIntensity) + cloudBrightness * cloudIntensity;
          }

          data[destIndex]     = Math.min(255, Math.max(0, r));
          data[destIndex + 1] = Math.min(255, Math.max(0, g));
          data[destIndex + 2] = Math.min(255, Math.max(0, b));
          data[destIndex + 3] = 255;
        } else {
          data[destIndex + 3] = 0;
        }
      }
    }
    globeOffscreenCtx.putImageData(imgData, 0, 0);
    
    // Draw the textured globe offscreen canvas to main canvas, clipped to prevent subpixel white halo
    gCtx.save();
    gCtx.beginPath();
    gCtx.arc(cx, cy, R - 1.0, 0, Math.PI * 2);
    gCtx.clip();
    
    gCtx.drawImage(globeOffscreenCanvas, 0, 0);
    
    // Spherical vignette shadow for realistic 3D volume (clipped) - lightened to prevent darkening too much
    const shadowGrad = gCtx.createRadialGradient(
      cx - R * 0.15, cy - R * 0.15, R * 0.1,
      cx, cy, R
    );
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
    shadowGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.02)');
    shadowGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.22)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.52)');

    gCtx.beginPath();
    gCtx.arc(cx, cy, R, 0, Math.PI * 2);
    gCtx.fillStyle = shadowGrad;
    gCtx.fill();
    
    gCtx.restore();
  } else {
    // Vector Fallback Mode (original code)
    gCtx.save();
    gCtx.beginPath();
    gCtx.arc(cx, cy, R - 1.0, 0, Math.PI * 2); // Clip fallback to prevent subpixel issues
    gCtx.clip();

    gCtx.beginPath();
    gCtx.arc(cx, cy, R, 0, Math.PI * 2);
    const oceanGrad = gCtx.createRadialGradient(cx - R * 0.25, cy - R * 0.28, 0, cx, cy, R);
    if (activeGlobeTheme === 'day') {
      oceanGrad.addColorStop(0,   '#1e6db5');
      oceanGrad.addColorStop(0.5, '#0d3a6e');
      oceanGrad.addColorStop(1,   '#071e42');
    } else {
      oceanGrad.addColorStop(0,   '#080b12');
      oceanGrad.addColorStop(0.6, '#04060a');
      oceanGrad.addColorStop(1,   '#010204');
    }
    gCtx.fillStyle = oceanGrad;
    gCtx.fill();
    gCtx.clip();

    // Graticule
    if (activeGlobeTheme === 'day') {
      gCtx.strokeStyle = 'rgba(255,255,255,0.065)';
    } else {
      gCtx.strokeStyle = 'rgba(255,255,255,0.02)';
    }
    gCtx.lineWidth   = 0.5;
    globeGraticule(gCtx, cx, cy, R, lon0, lat0);

    // Continents
    for (const poly of EARTH_CONTINENTS) {
      globeDrawContinent(gCtx, cx, cy, R, lon0, lat0, poly, activeGlobeTheme);
    }

    // Spherical vignette shadow for realistic 3D volume (inside fallback clip) - lightened
    const shadowGrad = gCtx.createRadialGradient(
      cx - R * 0.15, cy - R * 0.15, R * 0.1,
      cx, cy, R
    );
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
    shadowGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.02)');
    shadowGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.22)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.52)');

    gCtx.beginPath();
    gCtx.arc(cx, cy, R, 0, Math.PI * 2);
    gCtx.fillStyle = shadowGrad;
    gCtx.fill();

    gCtx.restore();
  }

  // Draw Pins
  globePinPulse += 0.045;

  // 1. Permanent Curitiba Pin
  const cLon = -49.2733 * Math.PI / 180;
  const cLat = -25.4284 * Math.PI / 180;
  const cProj = globeProject(cLon, cLat, lon0, lat0, R);
  if (cProj.visible) {
    globeDrawPin(gCtx, cx + cProj.x, cy - cProj.y, globePinPulse, "Conrado");
  }

  // 2. Optional User Location Pin
  if (globeUserLon !== null && globeUserLat !== null) {
    const uLon = globeUserLon * Math.PI / 180;
    const uLat = globeUserLat * Math.PI / 180;
    const uProj = globeProject(uLon, uLat, lon0, lat0, R);
    if (uProj.visible) {
      const uLabel = globeCityName || (currentLanguage === 'pt' ? "Sua Localização" : "Your Location");
      globeDrawPin(gCtx, cx + uProj.x, cy - uProj.y, globePinPulse, uLabel, true);
    }
  }


}

/** Orthographic projection: returns {x, y, visible} */
function globeProject(lonRad, latRad, lon0, lat0, R) {
  const dLon   = lonRad - lon0;
  const cosLat = Math.cos(latRad),   sinLat = Math.sin(latRad);
  const cosL0  = Math.cos(lat0),     sinL0  = Math.sin(lat0);
  const cosDL  = Math.cos(dLon);
  return {
    x: -R * cosLat * Math.sin(dLon),
    y: -R * (sinLat * cosL0 - cosLat * sinL0 * cosDL),
    visible: (sinLat * sinL0 + cosLat * cosL0 * cosDL) > 0
  };
}

function globeGraticule(gCtx, cx, cy, R, lon0, lat0) {
  // Longitude lines every 30°
  for (let lon = -180; lon < 180; lon += 30) {
    const lonR = lon * Math.PI / 180;
    gCtx.beginPath();
    let pen = false;
    for (let lat = -88; lat <= 88; lat += 3) {
      const p = globeProject(lonR, lat * Math.PI / 180, lon0, lat0, R);
      if (p.visible) {
        pen ? gCtx.lineTo(cx + p.x, cy - p.y) : gCtx.moveTo(cx + p.x, cy - p.y);
        pen = true;
      } else pen = false;
    }
    gCtx.stroke();
  }
  // Latitude lines every 30°
  for (let lat = -60; lat <= 60; lat += 30) {
    const latR = lat * Math.PI / 180;
    gCtx.beginPath();
    let pen = false;
    for (let lon = -180; lon <= 180; lon += 3) {
      const p = globeProject(lon * Math.PI / 180, latR, lon0, lat0, R);
      if (p.visible) {
        pen ? gCtx.lineTo(cx + p.x, cy - p.y) : gCtx.moveTo(cx + p.x, cy - p.y);
        pen = true;
      } else pen = false;
    }
    gCtx.stroke();
  }
}

function globeDrawContinent(gCtx, cx, cy, R, lon0, lat0, points, activeGlobeTheme) {
  gCtx.beginPath();
  let pen = false, prevVis = false;
  for (let i = 0; i < points.length; i++) {
    const [lon, lat] = points[i];
    const p = globeProject(lon * Math.PI / 180, lat * Math.PI / 180, lon0, lat0, R);
    if (p.visible) {
      (!pen || !prevVis) ? gCtx.moveTo(cx + p.x, cy - p.y) : gCtx.lineTo(cx + p.x, cy - p.y);
      pen = true;
    }
    prevVis = p.visible;
  }
  gCtx.closePath();
  // Land gradient
  const lg = gCtx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  if (activeGlobeTheme === 'day') {
    lg.addColorStop(0, '#3d9a62');
    lg.addColorStop(1, '#2a6644');
    gCtx.strokeStyle = 'rgba(255,255,255,0.13)';
  } else {
    lg.addColorStop(0, '#151c28');
    lg.addColorStop(1, '#0f1520');
    gCtx.strokeStyle = 'rgba(255,255,255,0.05)';
  }
  gCtx.fillStyle = lg;
  gCtx.fill();
  gCtx.lineWidth   = 0.6;
  gCtx.stroke();
}

function globeDrawPin(gCtx, x, y, pulse, city, isUser = false) {
  const px = Math.round(x);
  const py = Math.round(y);
  
  if (isUser) {
    // Apple HIG User Location: Pulsing blue dot with white border
    const radius = 5.5;
    const bounce = Math.sin(pulse * 1.5) * 0.8; // subtle bounce/float
    const cy = py - bounce;

    // Shadow
    gCtx.save();
    gCtx.shadowColor   = 'rgba(0,0,0,0.3)';
    gCtx.shadowBlur    = 6;
    gCtx.shadowOffsetY = 2;

    // White border outer circle
    gCtx.beginPath();
    gCtx.arc(px, cy, radius + 1.5, 0, Math.PI * 2);
    gCtx.fillStyle = '#ffffff';
    gCtx.fill();
    gCtx.restore();

    // Vibrant blue inner circle
    gCtx.beginPath();
    gCtx.arc(px, cy, radius, 0, Math.PI * 2);
    gCtx.fillStyle = '#007aff'; // Apple System Blue
    gCtx.fill();

    // Pulsing halo
    const pulseScale = (pulse % 3) / 3; // 0 to 1 loop
    const haloRadius = radius + 2 + pulseScale * 14;
    const haloOpacity = 0.45 * (1 - pulseScale);
    if (haloOpacity > 0) {
      gCtx.beginPath();
      gCtx.arc(px, cy, haloRadius, 0, Math.PI * 2);
      gCtx.strokeStyle = `rgba(0, 122, 255, ${haloOpacity.toFixed(2)})`;
      gCtx.lineWidth   = 1.5;
      gCtx.stroke();
    }

    // City name tooltip bubble
    if (city) {
      globeDrawTooltip(gCtx, px, cy - radius - 5, city);
    }
  } else {
    // Apple HIG POI Teardrop Marker (Creator Location)
    const PR  = 7;   // pin head radius
    const TIP = 18;  // distance from head center to tip
    const bounce = Math.sin(pulse * 1.8) * 1.5;
    const cy = py - bounce;
    const hy = cy - TIP;   // head center y

    // Shadow
    gCtx.save();
    gCtx.shadowColor   = 'rgba(0,0,0,0.35)';
    gCtx.shadowBlur    = 8;
    gCtx.shadowOffsetY = 3;

    // Teardrop body
    gCtx.beginPath();
    gCtx.arc(px, hy, PR, Math.PI, 0);
    gCtx.bezierCurveTo(px + PR, hy + PR * 1.4, px + PR * 0.4, cy - 1, px, cy);
    gCtx.bezierCurveTo(px - PR * 0.4, cy - 1, px - PR, hy + PR * 1.4, px - PR, hy);
    gCtx.closePath();
    
    // Fill with accent color or Apple Red
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#ff3b30';
    gCtx.fillStyle = accent;
    gCtx.fill();

    // Fine white border
    gCtx.strokeStyle = '#ffffff';
    gCtx.lineWidth = 1;
    gCtx.stroke();
    gCtx.restore();

    // Inner white circle (badge)
    gCtx.beginPath();
    gCtx.arc(px, hy, PR * 0.55, 0, Math.PI * 2);
    gCtx.fillStyle = '#ffffff';
    gCtx.fill();

    // Tiny glyph center (a small pinhead/star or just a colored dot)
    gCtx.beginPath();
    gCtx.arc(px, hy, PR * 0.25, 0, Math.PI * 2);
    gCtx.fillStyle = accent;
    gCtx.fill();

    // Soft halo
    const pulseScale = (pulse % 3) / 3;
    const haloRadius = PR + 1.5 + pulseScale * 10;
    const haloOpacity = 0.35 * (1 - pulseScale);
    if (haloOpacity > 0) {
      gCtx.beginPath();
      gCtx.arc(px, hy, haloRadius, 0, Math.PI * 2);
      gCtx.strokeStyle = `rgba(255, 59, 48, ${haloOpacity.toFixed(2)})`; // Apple System Red
      gCtx.lineWidth   = 1.2;
      gCtx.stroke();
    }

    // City name tooltip bubble
    if (city) {
      globeDrawTooltip(gCtx, px, hy - PR - 4, city);
    }
  }
}

function globeDrawTooltip(gCtx, px, yBottom, city) {
  gCtx.font = '500 10px -apple-system, SF Pro Text, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const tw  = gCtx.measureText(city).width;
  const bw  = tw + 14;
  const bh  = 18;
  const r   = 5; // rounded corner radius
  const bx  = px - bw / 2;
  const by  = yBottom - bh;

  // Draw tooltip background
  gCtx.save();
  gCtx.shadowColor   = 'rgba(0,0,0,0.18)';
  gCtx.shadowBlur    = 6;
  gCtx.shadowOffsetY = 2.5;
  
  // Apple styling: translucent white or sleek dark tooltip
  const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
  if (theme === 'light') {
    gCtx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  } else {
    gCtx.fillStyle = 'rgba(28, 28, 30, 0.94)'; // Apple systemDarkGray
  }
  
  globeRoundRect(gCtx, bx, by, bw, bh, r);
  gCtx.fill();

  // Subtle border
  gCtx.strokeStyle = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  gCtx.lineWidth   = 0.5;
  gCtx.stroke();
  gCtx.restore();

  // Draw text
  gCtx.fillStyle    = theme === 'light' ? '#1c1c1e' : '#ffffff';
  gCtx.textAlign    = 'center';
  gCtx.textBaseline = 'middle';
  gCtx.fillText(city, px, by + bh / 2 + 0.5);
}

function globeRoundRect(gCtx, x, y, w, h, r) {
  gCtx.beginPath();
  gCtx.moveTo(x + r, y);
  gCtx.lineTo(x + w - r, y);
  gCtx.quadraticCurveTo(x + w, y, x + w, y + r);
  gCtx.lineTo(x + w, y + h - r);
  gCtx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  gCtx.lineTo(x + r, y + h);
  gCtx.quadraticCurveTo(x, y + h, x, y + h - r);
  gCtx.lineTo(x, y + r);
  gCtx.quadraticCurveTo(x, y, x + r, y);
  gCtx.closePath();
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
  // Preserve the globe canvas and info container before wiping the container
  const globeCanvas = document.getElementById('earth-globe');
  const globeInfoContainer = document.getElementById('globe-info-container');
  container.innerHTML = '';
  // Reinsert elements
  if (globeCanvas) container.appendChild(globeCanvas);
  if (globeInfoContainer) container.appendChild(globeInfoContainer);
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
      if (isEntryAnimating) return;
      // Ignore hover interactions during active spins so "ESTOU COM SORTE." text is preserved
      if (isSpinningMomentum || isSpinningEasterEgg) return;

      isHoveringCard = true;
      targetOrbitSpeed = 0.0002; // Slow motion speed on hover
      activeHoveredCard = card;

      if (cursorEl) {
        cursorEl.classList.add('card-hover');
        cursorEl.classList.add('hovered');
      }

      if (activeView === 'orbit') {
        if (!globeActive) {
          const title = getLocalizedValue(item.title);
          setCenterText(title);
        }

        gsap.to(hoverScales, {
          [index]: 1.4, // Increased pop scale
          duration: 0.3,
          ease: "power2.out"
        });
        gsap.to(card, { borderColor: 'var(--accent-color)', duration: 0.4, ease: "power2.out" });
      }
    });

    card.addEventListener('mouseleave', () => {
      if (isEntryAnimating) return;
      // Ignore mouseleave logic if the hover was ignored during a spin
      if (isSpinningMomentum || isSpinningEasterEgg) return;

      isHoveringCard = false;
      targetOrbitSpeed = 0.0012; // Restore faster speed
      activeHoveredCard = null;

      if (cursorEl) {
        cursorEl.classList.remove('card-hover');
        cursorEl.classList.remove('hovered');
      }

      if (activeView === 'orbit') {
        if (!globeActive) {
          setCenterText("CONRADO.");
        }

        gsap.to(hoverScales, {
          [index]: 1.0,
          duration: 0.3,
          ease: "power2.out"
        });
        gsap.to(card, { borderColor: 'var(--glass-border)', duration: 0.4, ease: "power2.out" });
      }
    });

    card.addEventListener('click', (e) => {
      if (isEntryAnimating) return;
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
            hideProjectInfoPanel();
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
  document.querySelectorAll('a, button, .nav__link, .vis-btn, .morph-card, .mosaic-card, .filter-btn, .filter-dropdown-item, .info-panel-more-btn, .psicromia-back-btn, .cascade-back-btn, .status-widget, #earth-globe, #orbit-center-text').forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (isEntryAnimating) return;
      if (cursorEl) cursorEl.classList.add('hovered');
    });
    el.addEventListener('mouseleave', () => {
      if (isEntryAnimating) return;
      if (cursorEl) {
        cursorEl.classList.remove('hovered');
        cursorEl.classList.remove('project-hover');
      }
    });
  });
  document.querySelectorAll('.mosaic-card, .gallery-item').forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (isEntryAnimating) return;
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
    const oy = Math.sin(theta) * currentOrbitRadiusY - 25; // Uses the dynamic pitch tilt radius with translateY offset
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
    let finalX = ox + (cx - ox) * p;
    let finalY = oy + (cy - oy) * p;
    let finalZ = (oz * 100 + 120) + (cz - (oz * 100 + 120)) * p;
    let finalScale = (oScale + (cScale - oScale) * p) * (hoverScales[index] || 1);
    let finalOpacity = oOpacity + (cOpacity - oOpacity) * p;
    let finalRotateY = oRotateY + (cRotateY - oRotateY) * p;
    let finalZIndex;
    if (activeHoveredCard === card && activeView !== 'cascade') {
      finalZIndex = 999;
    } else {
      // Always use z-index in orbit mode — globe has z-index 155 (midpoint)
      // so front cards (>155) go in front, back cards (<155) go behind
      finalZIndex = p > 0.5 ? cZIndex : oZIndex;
    }

    // Apply Psicromia transition overlay
    const tp = psicromiaTransitionProgress.value;
    if (tp > 0) {
      const M = projectsDb.length;
      const wrappedActiveIndex = mod(Math.round(activeCascadeIndex), M);
      if (index === wrappedActiveIndex) {
        // Zoom and shift active card
        finalX = finalX + 380 * tp;
        finalZ = finalZ + 150 * tp;
        finalScale = finalScale * (1 + 0.85 * tp);
        finalOpacity = finalOpacity * (1 - tp);
      } else {
        // Fade other cards out twice as fast
        finalOpacity = finalOpacity * Math.max(0, 1 - tp * 2);
      }
    }

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
    if (isEntryAnimating) return;
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

    if (e.target.id === 'earth-globe') {
      return;
    }

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
    if (isEntryAnimating) return;
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
    if (isEntryAnimating) return;
    const wasDraggingOrbit = isDraggingOrbit;

    isMouseDown = false;
    isDraggingOrbit = false;
    isDraggingCascade = false;
    isDraggingPsicromia = false;

    // Return the orbit vertical tilt/pitch to its initial default (225) on release
    if (activeView === 'orbit') {
      targetOrbitRadiusY = 225;
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

  const wasGlobeActive = globeActive;
  isSpinningMomentum = true;

  // Spin animation of the orbit starts immediately
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
      smoothCascadeIndex = targetIdx;
      isCascadeFocused = true;
      
      // Auto transition to Cascade view and open the card focado
      switchView('cascade', true);
    }
  });

  if (wasGlobeActive) {
    // Globe close animation runs in parallel.
    // The lucky phrase will only be displayed and faded in once the globe has completed closing.
    deactivateGlobe(() => {
      const lucky = translations[currentLanguage]?.["misc.lucky"] || "ESTOU COM SORTE.";
      const centerText = document.getElementById('orbit-center-text');
      if (centerText) {
        centerText.innerText = lucky;
        gsap.killTweensOf(centerText);
        gsap.fromTo(centerText, 
          { scale: 0.35, opacity: 0 },
          { scale: 1, opacity: 0.95, duration: 0.4, ease: 'power2.out' }
        );
      }
    });
  } else {
    // If globe was not active, display and fade in the lucky phrase immediately
    const lucky = translations[currentLanguage]?.["misc.lucky"] || "ESTOU COM SORTE.";
    const centerText = document.getElementById('orbit-center-text');
    if (centerText) {
      centerText.innerText = lucky;
      gsap.killTweensOf(centerText);
      gsap.fromTo(centerText, 
        { scale: 0.35, opacity: 0 },
        { scale: 1, opacity: 0.95, duration: 0.3, ease: 'power2.out' }
      );
    }
  }
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

  const languages = ["ESTOU COM SORTE.", "I'M FEELING LUCKY.", "ESTOY CON SUERTE.", "J'AI DE LA CHANCE."];
  const wasGlobeActive = globeActive;
  isSpinningEasterEgg = true;

  let spinObj = { angle: orbitAngle };
  const startTickerTime = gsap.ticker.time;
  const centerText = document.getElementById('orbit-center-text');

  if (centerText) {
    gsap.killTweensOf(centerText);
    if (wasGlobeActive) {
      gsap.set(centerText, { scale: 0.35, opacity: 0 });
    } else {
      gsap.set(centerText, { scale: 1, opacity: 0.95 });
    }
  }

  let showPhrase = !wasGlobeActive;

  // Orbit spin starts immediately
  gsap.to(spinObj, {
    angle: finalTargetAngle,
    duration: 3.5,
    ease: "power4.out",
    onUpdate: () => {
      orbitAngle = spinObj.angle;
      // Cycle center text languages directly on innerText
      const elapsed = (gsap.ticker.time - startTickerTime) * 1000;
      const langIdx = Math.floor(elapsed / 250) % languages.length;
      if (centerText) {
        centerText.innerText = languages[langIdx];
        if (showPhrase) {
          centerText.style.opacity = 0.95;
        } else {
          centerText.style.opacity = 0;
        }
      }
    },
    onComplete: () => {
      isSpinningEasterEgg = false;
      
      // Select the project and switch view
      activeCascadeIndex = randomIdx;
      smoothCascadeIndex = randomIdx;
      isCascadeFocused = true;
      switchView('cascade', true);
    }
  });

  if (wasGlobeActive) {
    // Globe close animation runs in parallel.
    deactivateGlobe(() => {
      showPhrase = true;
      if (centerText) {
        gsap.killTweensOf(centerText);
        gsap.fromTo(centerText,
          { scale: 0.35, opacity: 0 },
          { scale: 1, opacity: 0.95, duration: 0.4, ease: 'power2.out' }
        );
      }
    });
  }
}

function triggerRandomProjectCascade() {
  if (projectsDb.length === 0) return;
  const M = projectsDb.length;
  let randomIdx = Math.floor(Math.random() * M);
  const currentActiveIdx = mod(Math.round(smoothCascadeIndex), M);
  if (M > 1 && randomIdx === currentActiveIdx) {
    randomIdx = (randomIdx + 1) % M;
  }
  if (isCascadeFocused) {
    hideProjectInfoPanel();
  }
  if (focusGsapTween) focusGsapTween.kill();
  const startIdx = smoothCascadeIndex;
  let diff = randomIdx - (startIdx % M);
  diff = mod(diff + M / 2, M) - M / 2;
  const targetIdx = startIdx + diff;
  const dist = Math.abs(diff);
  const dur = gsap.utils.clamp(0.4, 0.9, dist * 0.15 + 0.25);
  isCascadeFocused = false;
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

function animateOrbitEntry() {
  document.body.style.pointerEvents = 'none';
  isEntryAnimating = true;

  const tl = gsap.timeline({
    onComplete: () => {
      document.body.style.pointerEvents = 'auto';
      isEntryAnimating = false;
      console.log('Entrance animation complete, pointer events enabled.');
    }
  });

  tl.from('.logo', { y: -20, opacity: 0, duration: 1, ease: "power2.out" }, 0)
    .from('.nav', { y: -20, opacity: 0, duration: 1, ease: "power2.out" }, 0.2)
    .from('.visualizer-select', { y: 20, opacity: 0, duration: 1, ease: "power2.out" }, 0.4)
    .from('.orbit-center', { scale: 0.8, opacity: 0, duration: 1.2, ease: "power3.out" }, 0);
}
window.animateOrbitEntry = animateOrbitEntry;

// ==========================================================================
// CIRCLE MODE TOGGLE (Orbit view)
// ==========================================================================
let isCircleMode = false;

function toggleCircles() {
  if (isEntryAnimating) return;
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
  if (isEntryAnimating) return;
  if (activeView === viewName) return;

  // Intercept Orbit -> Cascade transition to slide the status-widget first
  if (activeView === 'orbit' && viewName === 'cascade') {
    const statusWidget = document.getElementById('status-widget');
    if (statusWidget) {
      gsap.to(statusWidget, {
        left: "50%",
        xPercent: -50,
        duration: 0.5,
        ease: "power2.out",
        onComplete: () => {
          proceedWithSwitchView(viewName, keepFocus);
        }
      });
      return;
    }
  }

  proceedWithSwitchView(viewName, keepFocus);
}

function proceedWithSwitchView(viewName, keepFocus = false) {
  if (activeView === viewName) return;
  if (viewName !== 'orbit' && isCircleMode) {
    isCircleMode = false;
    document.body.classList.remove('circle-mode');
    const btn = document.getElementById('btn-circles');
    if (btn) btn.classList.remove('active');
  }
  
  const prevActiveView = activeView;
  activeView = viewName;

  if (prevActiveView === 'orbit' && viewName !== 'orbit' && globeActive) {
    deactivateGlobe();
  }

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
    isTransitioningToPsicromia = true;
    // Keep projects-scene active during transition, show psicromia-scene
    document.getElementById('projects-scene').classList.add('active');
    document.getElementById('psicromia-scene').classList.add('active');
    
    gsap.to('.visualizer-select', { opacity: 0, y: 20, duration: 0.5, pointerEvents: 'none' });
    gsap.to('#orbit-center-text', { opacity: 0, duration: 0.3 });

    // Animate transition progress
    gsap.killTweensOf(psicromiaTransitionProgress);
    gsap.fromTo(psicromiaTransitionProgress, 
      { value: 0 },
      {
        value: 1,
        duration: 0.8,
        ease: "power2.out",
        onComplete: () => {
          isTransitioningToPsicromia = false;
          // Only remove active if view did not change during animation
          if (activeView === 'psicromia') {
            document.getElementById('projects-scene').classList.remove('active');
          }
        }
      }
    );

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
    // Exiting Psicromia (or switching to another view)
    if (prevActiveView === 'psicromia') {
      isTransitioningFromPsicromia = true;
      document.getElementById('projects-scene').classList.add('active');
      
      const psicCards = document.querySelectorAll('.mosaic-card');
      const psicHeader = document.getElementById('project-detail-header');
      if (psicCards.length > 0) {
        gsap.to(psicCards, { x: 60, opacity: 0, duration: 0.4, stagger: 0.02, ease: "power2.in" });
      }
      if (psicHeader) gsap.to(psicHeader, { x: 60, opacity: 0, duration: 0.4, ease: "power2.in" });

      gsap.killTweensOf(psicromiaTransitionProgress);
      gsap.fromTo(psicromiaTransitionProgress,
        { value: 1 },
        {
          value: 0,
          duration: 0.6,
          ease: "power2.out",
          onComplete: () => {
            isTransitioningFromPsicromia = false;
            if (activeView !== 'psicromia') {
              document.getElementById('psicromia-scene').classList.remove('active');
            }
            if (psicCards.length > 0) gsap.set(psicCards, { x: 0, opacity: 0 });
            if (psicHeader) gsap.set(psicHeader, { x: 0, opacity: 1, clearProps: "transform" });
          }
        }
      );
    } else {
      document.getElementById('psicromia-scene').classList.remove('active');
    }

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
      } else {
        isCascadeFocused = true;
      }
      gsap.to(transitionProgress, {
        value: 1,
        duration: 1.2,
        ease: "power3.inOut"
      });

      // Slide and return animation
      const tl = gsap.timeline();
      tl.to('.orbit-ring', {
        x: -300,
        rotationY: -10,
        transformOrigin: "center center",
        duration: 0.6,
        ease: "power2.inOut"
      }).to('.orbit-ring', {
        x: 0,
        rotationY: 0,
        transformOrigin: "center center",
        duration: 0.6,
        ease: "power2.inOut"
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

      // Slide and return animation
      const tl = gsap.timeline();
      tl.to('.orbit-ring', {
        x: 300,
        rotationY: 10,
        transformOrigin: "center center",
        duration: 0.6,
        ease: "power2.inOut"
      }).to('.orbit-ring', {
        x: 0,
        rotationY: 0,
        transformOrigin: "center center",
        duration: 0.6,
        ease: "power2.inOut"
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

      // Slide status-widget back to left corner
      const statusWidget = document.getElementById('status-widget');
      if (statusWidget) {
        gsap.to(statusWidget, {
          left: "2rem",
          xPercent: 0,
          duration: 0.5,
          delay: 0.7,
          ease: "power2.out"
        });
      }
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
      openLightbox(item, index, galleryItems);
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
function openLightbox(item, index = -1, items = []) {
  currentLightboxItems = items;
  currentLightboxIndex = index;

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
  
  if (cursorEl) {
    cursorEl.classList.add('lightbox-active');
  }

  document.addEventListener('keydown', onLightboxKeydown);
}

function onLightboxKeydown(e) {
  if (e.key === 'Escape') {
    closeLightbox();
  } else if (e.key === 'ArrowRight' || e.key === 'Right') {
    navigateLightbox(1);
  } else if (e.key === 'ArrowLeft' || e.key === 'Left') {
    navigateLightbox(-1);
  }
}

function navigateLightbox(direction) {
  if (!currentLightboxItems || currentLightboxItems.length === 0) return;
  
  let newIdx = currentLightboxIndex + direction;
  const len = currentLightboxItems.length;
  newIdx = (newIdx % len + len) % len;
  
  currentLightboxIndex = newIdx;
  const item = currentLightboxItems[newIdx];
  
  const overlay = document.getElementById('lightbox-overlay');
  const content = overlay.querySelector('.lightbox-content');
  
  gsap.to(content, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => {
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
      gsap.to(content, { opacity: 1, duration: 0.25 });
    }
  });
}

function closeLightbox() {
  const overlay = document.getElementById('lightbox-overlay');
  overlay.classList.remove('active');
  
  const content = overlay.querySelector('.lightbox-content');
  content.innerHTML = '';
  
  if (cursorEl) {
    cursorEl.classList.remove('lightbox-active');
  }
  
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
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) adminPanel.classList.remove('active');
}

function resetToHome(event) {
  if (event) event.preventDefault();
  closeAllPanels();
  
  if (activeView === 'orbit') {
    triggerEasterEggSpin();
  } else if (activeView === 'cascade') {
    triggerRandomProjectCascade();
  } else {
    switchView('orbit');
    setTimeout(() => {
      triggerEasterEggSpin();
    }, 100);
  }
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
    if (isEntryAnimating) return;
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeToggleIcon();
  });
}

function updateThemeToggleIcon() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  btn.style.backgroundColor = 'transparent';
  btn.style.border = 'none';
  btn.style.boxShadow = 'none';
  
  if (currentTheme === 'dark') {
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="27" height="27" fill="#ffffff" stroke="none">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    `;
  } else {
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="27" height="27" fill="#ffd200" stroke="#ffd200" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5" fill="#ffd200"/>
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

// ==========================================================================
// GLOBE INFO POPOVER
// ==========================================================================
function initGlobeInfo() {
  const btn = document.getElementById('globe-info-btn');
  const popover = document.getElementById('globe-info-popover');
  const closeBtn = document.getElementById('globe-info-popover-close');
  
  if (!btn || !popover || !closeBtn) return;
  
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.classList.toggle('open');
  });
  
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.classList.remove('open');
  });
  
  document.addEventListener('click', (e) => {
    const container = document.getElementById('globe-info-container');
    if (container && !container.contains(e.target)) {
      popover.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      popover.classList.remove('open');
    }
  });
}

// ==========================================================================
// SAVE-BEFORE-EXIT DIALOG
// ==========================================================================
let formIsDirty = false;  // true when the admin form has unsaved changes
let _saveExitTarget = null; // 'form' | 'panel'

function initSaveExitDialog() {
  const btnSave    = document.getElementById('save-exit-save');
  const btnDiscard = document.getElementById('save-exit-discard');
  const btnCancel  = document.getElementById('save-exit-cancel');
  if (!btnSave) return;

  btnSave.addEventListener('click', () => {
    // Trigger form submit programmatically
    const form = document.getElementById('admin-project-form');
    if (form) {
      // Create and dispatch a submit event so saveProject() runs
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
    hideSaveExitDialog();
    if (_saveExitTarget === 'panel') {
      document.getElementById('admin-panel')?.classList.remove('active');
    }
  });

  btnDiscard.addEventListener('click', () => {
    hideSaveExitDialog();
    formIsDirty = false;
    if (_saveExitTarget === 'panel') {
      closeProjectForm();
      document.getElementById('admin-panel')?.classList.remove('active');
    } else {
      closeProjectForm();
    }
  });

  btnCancel.addEventListener('click', () => {
    hideSaveExitDialog();
  });

  // Close on backdrop click
  document.getElementById('save-exit-dialog').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideSaveExitDialog();
  });
}

function showSaveExitDialog(target) {
  _saveExitTarget = target;
  const dialog = document.getElementById('save-exit-dialog');
  if (dialog) dialog.classList.add('visible');
}

function hideSaveExitDialog() {
  const dialog = document.getElementById('save-exit-dialog');
  if (dialog) dialog.classList.remove('visible');
  _saveExitTarget = null;
}

function markFormDirty() {
  formIsDirty = true;
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
  formIsDirty = false; // reset dirty flag when form opens

  // Track changes to mark form as dirty (avoid duplicate listeners)
  if (form && !form.dataset.dirtyListenersAdded) {
    form.querySelectorAll('input, textarea, select').forEach(el => {
      el.addEventListener('input', markFormDirty);
      el.addEventListener('change', markFormDirty);
    });
    form.dataset.dirtyListenersAdded = 'true';
  }
}

function closeProjectForm() {
  const formModal = document.getElementById('admin-form-modal');
  const form = document.getElementById('admin-project-form');
  if (formModal) {
    formModal.classList.remove('active');
  }
  if (form && form.dataset.dirtyListenersAdded) {
    form.querySelectorAll('input, textarea, select').forEach(el => {
      el.removeEventListener('input', markFormDirty);
      el.removeEventListener('change', markFormDirty);
    });
    form.dataset.dirtyListenersAdded = 'false';
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

// ==========================================================================
// DYNAMIC LEFT CORNER STATUS WIDGET LOGIC
// ==========================================================================
function initWidgetGeo() {
  const locEl = document.getElementById('widget-loc');
  const coordsEl = document.getElementById('widget-coords');
  const tempEl = document.getElementById('widget-temp');
  const extraEl = document.getElementById('widget-extra');
  const compassIcon = document.getElementById('compass-icon');

  if (!locEl || !coordsEl || !tempEl || !extraEl) return;

  // Simulated weather variation based on hour (fallback defaults)
  const hour = new Date().getHours();
  let baseTemp = 21;
  let weatherDesc = "Parcialmente Nublado";
  
  if (hour >= 12 && hour < 17) {
    baseTemp = 24;
    weatherDesc = "Ensolarado";
  } else if (hour >= 18 || hour < 6) {
    baseTemp = 18;
    weatherDesc = "Céu Limpo";
  }
  
  tempEl.innerText = `${baseTemp}°C`;
  extraEl.innerText = `${weatherDesc} • NW 14km/h`;

  // Helper to fetch details from Nominatim and Open-Meteo
  function updateLocationAndWeather(lat, lon) {
    const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
    coordsEl.innerText = `${latStr}, ${lonStr}`;

    // Reverse geocoding (OpenStreetMap Nominatim API, no key required)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const geocodePromise = fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data && data.address) {
          const city = data.address.city || data.address.town || data.address.village || data.address.municipality || data.address.suburb || "São Paulo";
          const state = data.address.state || "SP";
          locEl.innerText = `${city}, ${state}`;
        }
      })
      .catch(err => console.log("Geocoding failed:", err));

    // Real temperature (Open-Meteo Weather API, no key required)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const weatherPromise = fetch(weatherUrl)
      .then(res => res.json())
      .then(data => {
        if (data && data.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          tempEl.innerText = `${temp}°C`;
          const code = data.current_weather.weathercode;
          
          let desc = currentLanguage === 'pt' ? "Limpo" : "Clear";
          if (code >= 1 && code <= 3) desc = currentLanguage === 'pt' ? "Parcialmente Nublado" : "Partly Cloudy";
          else if (code >= 51 && code <= 67) desc = currentLanguage === 'pt' ? "Chuva Leve" : "Light Rain";
          else if (code >= 71 && code <= 86) desc = currentLanguage === 'pt' ? "Neve" : "Snow";
          else if (code >= 95) desc = currentLanguage === 'pt' ? "Tempestade" : "Thunderstorm";

          const windDir = data.current_weather.winddirection;
          let windText = "NW";
          if (windDir >= 337.5 || windDir < 22.5) windText = "N";
          else if (windDir >= 22.5 && windDir < 67.5) windText = "NE";
          else if (windDir >= 67.5 && windDir < 112.5) windText = "E";
          else if (windDir >= 112.5 && windDir < 157.5) windText = "SE";
          else if (windDir >= 157.5 && windDir < 202.5) windText = "S";
          else if (windDir >= 202.5 && windDir < 247.5) windText = "SW";
          else if (windDir >= 247.5 && windDir < 292.5) windText = "W";
          else if (windDir >= 292.5 && windDir < 337.5) windText = "NW";

          extraEl.innerText = `${desc} • ${windText} ${Math.round(data.current_weather.windspeed)}km/h`;
        }
      })
      .catch(err => console.log("Weather API failed:", err));

    Promise.allSettled([geocodePromise, weatherPromise]).then(() => {
      if (compassIcon) {
        compassIcon.classList.remove('is-spinning');
      }
    });
  }

  // Helper to request browser's Geolocation
  function getAndUpdatePosition(showError = false) {
    if (!navigator.geolocation) {
      if (showError) {
        alert(currentLanguage === 'pt' 
          ? "Geolocalização não é suportada pelo seu navegador." 
          : "Geolocation is not supported by your browser.");
      }
      return;
    }

    if (compassIcon) {
      compassIcon.classList.add('is-spinning');
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        updateLocationAndWeather(lat, lon);
        
        // Update user location on the globe
        globeUserLat = lat;
        globeUserLon = lon;
        if (globeActive) {
          globeTargetLat = lat;
          globeTargetLon = lon;
          isCenteringGlobe = true;
        }

        // Reverse geocoding for globe pin
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt`)
          .then(r => r.json())
          .then(data => {
            globeCityName = data.address?.city
              || data.address?.town
              || data.address?.village
              || data.address?.county
              || null;
          })
          .catch(() => {});
      },
      (error) => {
        console.log("Geolocation error:", error);
        if (compassIcon) {
          compassIcon.classList.remove('is-spinning');
        }
        if (showError) {
          if (error.code === error.PERMISSION_DENIED) {
            alert(currentLanguage === 'pt' 
              ? "Acesso à localização negado. Por favor, redefina a permissão de localização nas configurações do navegador (geralmente no ícone de cadeado na barra de endereços) para podermos localizar você no globo." 
              : "Location access denied. Please reset location permissions in your browser settings (usually by clicking the padlock icon in the address bar) to locate yourself on the globe.");
          } else {
            alert(currentLanguage === 'pt' 
              ? "Não foi possível obter sua localização. Por favor, tente novamente." 
              : "Could not obtain your location. Please try again.");
          }
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  // Automatic geolocate on load ONLY if permission is already granted
  if (navigator.geolocation && navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (status.state === 'granted') {
        getAndUpdatePosition(false);
      }
    }).catch(err => {
      console.log("Permissions API query failed:", err);
    });
  }

  // Bind compass click listener
  const compassBtn = document.querySelector('.status-widget__compass');
  if (compassBtn) {
    compassBtn.addEventListener('click', (e) => {
      if (isEntryAnimating || isSpinningMomentum || isSpinningEasterEgg) return;
      e.stopPropagation();
      activateGlobe('user');
    });
  }

  // Bind status widget toggle listener
  const statusWidget = document.getElementById('status-widget');
  if (statusWidget) {
    statusWidget.addEventListener('click', (e) => {
      if (isEntryAnimating || isSpinningMomentum || isSpinningEasterEgg) return;
      if (globeActive) {
        deactivateGlobe();
      } else {
        activateGlobe('curitiba');
      }
    });
  }
}

function startWidgetClock() {
  const timeEl = document.getElementById('widget-time');
  const dateEl = document.getElementById('widget-date');
  
  function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString(currentLanguage === 'pt' ? 'pt-BR' : 'en-US', { hour12: false });
    const dateStr = now.toLocaleDateString(currentLanguage === 'pt' ? 'pt-BR' : 'en-US');
    if (timeEl) timeEl.innerText = timeStr;
    if (dateEl) dateEl.innerText = dateStr;
  }
  
  updateTime();
  setInterval(updateTime, 1000);
}

function copyContactEmail(btn) {
  const email = "falaconrado@gmail.com";
  navigator.clipboard.writeText(email).then(() => {
    const textEl = document.getElementById('btn-email-text');
    if (!textEl) return;
    
    // Determine translation for "Copiado!" based on current language
    let feedback = "Copiado!";
    if (currentLanguage === 'en') feedback = "Copied!";
    else if (currentLanguage === 'es') feedback = "¡Copiado!";
    else if (currentLanguage === 'fr') feedback = "Copié !";
    
    textEl.innerText = feedback;
    btn.classList.add('copied');
    
    setTimeout(() => {
      // Restore original translation text
      const key = "contact.copyEmail";
      textEl.innerText = translations[currentLanguage]?.[key] || "Copiar E-mail";
      btn.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error("Failed to copy email:", err);
  });
}
