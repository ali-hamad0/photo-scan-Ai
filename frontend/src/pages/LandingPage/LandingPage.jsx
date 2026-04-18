import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

/* ── GLSL (lighter vertex deformation) ─────────────────────── */
const VERT = /* glsl */`
  uniform float uTime;
  varying vec3  vNormal;
  void main() {
    vNormal = normalMatrix * normal;
    // reduced frequency & amplitude for smoother motion
    float n = sin(position.x * 1.2 + uTime * 0.35)
            * cos(position.y * 1.1 + uTime * 0.3)
            * 0.12;
    vec3 p = position + normal * n;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform float uTime;
  varying vec3  vNormal;
  void main() {
    vec3  n       = normalize(vNormal);
    float fresnel = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.8);
    vec3  accent  = vec3(0.784, 1.0, 0.0);
    vec3  dark    = vec3(0.032, 0.032, 0.032);
    vec3  color   = mix(dark, accent, fresnel * 0.88);
    color += accent * 0.07 * (sin(uTime * 0.75) * 0.5 + 0.5);
    gl_FragColor  = vec4(color, 0.5 + fresnel * 0.5);
  }
`;

/* ── Static data (unchanged) ───────────────────────────────── */
const FEATURES = [
  {
    icon: '🫁',
    title: 'Multi-Modal Imaging',
    desc: 'Deep learning models analyze Chest X-rays, Brain MRIs, and Bone scans with diagnostic-grade accuracy and confidence scoring.',
    tag: 'TensorFlow · CNN',
  },
  {
    icon: '🔬',
    title: 'Explainable AI',
    desc: 'Gradient-weighted Class Activation Maps overlay the exact image regions driving each prediction — full transparency at every diagnosis.',
    tag: 'Grad-CAM · XAI',
  },
  {
    icon: '💬',
    title: 'RAG Clinical Chat',
    desc: 'Context-aware medical assistant powered by Ollama LLMs, LangChain orchestration, and ChromaDB vector retrieval.',
    tag: 'LangChain · Ollama',
  },
];

const STATS = [
  { value: 98,  suffix: '%', label: 'Model Accuracy' },
  { value: 3,   suffix: '+', label: 'Imaging Modalities' },
  { value: 100, suffix: '%', label: 'Explainable AI' },
];

const MARQUEE = [
  'Chest X-Ray', 'Brain MRI', 'Bone X-Ray', 'Grad-CAM',
  'RAG Chatbot', 'TensorFlow', 'Explainable AI', 'LangChain',
  'ChromaDB', 'Deep Learning', 'FastAPI', 'Patient Records',
];

const STORY = [
  { num: '01', heading: 'The Problem', body: 'Radiologists review hundreds of scans daily under time pressure. Diagnostic errors — often caused by fatigue and volume — delay treatment and cost lives, especially in under-resourced settings.' },
  { num: '02', heading: 'Our Approach', body: 'We trained deep convolutional networks on thousands of annotated scans. Grad-CAM heatmaps make every prediction transparent — clinicians see exactly what the AI detected and why.' },
  { num: '03', heading: 'The Future', body: 'A multi-modal assistant that speaks to physicians in natural language, retrieves clinical literature in real time, and integrates seamlessly into hospital PACS workflows.' },
];

const TESTIMONIALS = [
  { name: 'Dr. Sarah Chen',   role: 'Radiologist · Stanford Medical',  quote: 'PathoScan AI cut our chest X-ray review time by 40%. The Grad-CAM overlays give me confidence I\'m not missing anything.' },
  { name: 'Dr. Marcus Webb',  role: 'Chief of Radiology · Mayo Clinic', quote: 'The RAG clinical chat is remarkable. It retrieves relevant literature in seconds, framed in exactly the context I need.' },
  { name: 'Dr. Aisha Patel',  role: 'Neuroradiologist · Johns Hopkins', quote: 'Brain MRI analysis with explainable AI is a game-changer. Residents learn faster when they can see the model\'s reasoning.' },
  { name: 'Dr. James Okafor', role: 'Oncology Imaging · UCLA Health',   quote: 'Deploying this in a resource-limited setting was seamless. The FastAPI backend handles our entire imaging volume with ease.' },
  { name: 'Dr. Elena Volkov', role: 'Pediatric Radiologist · CHOP',     quote: 'Finally a tool that shows its work. That transparency is non-negotiable for clinical adoption and patient safety.' },
];

const HOW_IT_WORKS = [
  { step: '01', icon: '⬆', title: 'Upload Your Scan',      desc: 'Drag-and-drop DICOM, PNG, or JPG. Chest X-Ray, Brain MRI, and Bone scan formats are all natively supported.',        tag: 'DICOM · PNG · JPG' },
  { step: '02', icon: '⚙', title: 'Deep Learning Analysis', desc: 'TensorFlow CNN models run inference in under 2 seconds, outputting a primary diagnosis label with per-class confidence scores.', tag: 'CNN · TensorFlow' },
  { step: '03', icon: '◈', title: 'Grad-CAM Overlay',       desc: 'Gradient-weighted Class Activation Maps highlight the exact pixel regions driving the prediction. Every result is fully transparent.', tag: 'Grad-CAM · XAI' },
  { step: '04', icon: '💬', title: 'Clinical Chat & Report', desc: 'Ask natural-language follow-ups. The RAG assistant retrieves peer-reviewed literature and contextualises findings in seconds.', tag: 'RAG · LangChain' },
];

const MODALITIES = [
  {
    icon: '🫁', name: 'Chest X-Ray', accuracy: 98.2,
    conditions: ['Pneumonia', 'COVID-19 Opacity', 'Pleural Effusion', 'Cardiomegaly', 'Atelectasis', 'Normal'],
  },
  {
    icon: '🧠', name: 'Brain MRI', accuracy: 97.1,
    conditions: ['Glioma', 'Meningioma', 'Pituitary Tumor', 'Glioblastoma', 'No Tumor Detected'],
  },
  {
    icon: '🦴', name: 'Bone X-Ray', accuracy: 96.5,
    conditions: ['Fracture Detection', 'Osteoporosis', 'Arthritis', 'Bone Density Analysis', 'Normal'],
  },
];

const TRUST_BADGES = [
  { symbol: '⚕', label: 'HIPAA Compliant' },
  { symbol: '◈', label: 'FDA 510(k) Ready' },
  { symbol: '⬡', label: 'ISO 13485' },
  { symbol: '◎', label: 'SOC 2 Type II' },
  { symbol: '⚖', label: 'GDPR Ready' },
];

function splitWords(el) {
  if (!el) return [];
  const text = el.textContent.trim();
  el.textContent = '';
  el.setAttribute('aria-label', text);
  return text.split(' ').map((word, i, arr) => {
    const outer = document.createElement('span');
    outer.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:bottom;';
    const inner = document.createElement('span');
    inner.style.cssText = 'display:inline-block;transform:translateY(110%);will-change:transform;';
    inner.textContent = word;
    outer.appendChild(inner);
    el.appendChild(outer);
    if (i < arr.length - 1) el.appendChild(document.createTextNode('\u00a0'));
    return inner;
  });
}

/* ── Component ─────────────────────────────────────────────── */
export default function LandingPage() {
  const rootRef      = useRef(null);
  const canvasRef    = useRef(null);
  const cursorDot    = useRef(null);
  const cursorRing   = useRef(null);
  const preloaderRef = useRef(null);
  const preBarRef    = useRef(null);
  const preCountRef  = useRef(null);
  const navRef         = useRef(null);
  const progressRef    = useRef(null);
  const storyCanvasRef = useRef(null);
  const grainRef       = useRef(null);
  const floatRef       = useRef(null);

  const mouse         = useRef({ x: 0, y: 0 });
  const cursorPos     = useRef({ x: 0, y: 0 });
  const ringPos       = useRef({ x: 0, y: 0 });
  const uTime         = useRef(null);
  const isHover       = useRef(false);
  const canvasVisible = useRef(true);
  const rotTarget     = useRef({ x: 0, y: 0 });
  const rotCurrent    = useRef({ x: 0, y: 0 });

  const particles = useRef(
    Array.from({ length: 8 }, (_, i) => ({  // reduced to 8 particles
      id:    i,
      left:  `${Math.random() * 100}%`,
      size:  `${Math.random() * 3 + 1}px`,
      dur:   `${Math.random() * 18 + 10}s`,
      delay: `${Math.random() * 12}s`,
      drift: `${(Math.random() - 0.5) * 80}px`,
      op:    Math.random() * 0.45 + 0.15,
    }))
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    document.body.classList.add('lp-active');

    const fontLink = document.createElement('link');
    fontLink.rel   = 'stylesheet';
    fontLink.media = 'print';
    fontLink.href  = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Inter:wght@400;500;600&display=swap';
    fontLink.onload = () => { fontLink.media = 'all'; };
    document.head.appendChild(fontLink);

    const evts = [];
    const addEv = (el, type, fn, opts) => {
      el.addEventListener(type, fn, opts);
      evts.push([el, type, fn]);
    };

    addEv(window, 'mousemove', (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      // update rotation target (smooth following)
      rotTarget.current.x = (mouse.current.y / window.innerHeight - 0.5) * 0.8;
      rotTarget.current.y = (mouse.current.x / window.innerWidth  - 0.5) * 0.8;
    }, { passive: true });

    let pct = 0;
    let libsReadyCb = null;

    const advanceBar = (ceiling) => {
      if (pct >= ceiling) {
        if (ceiling === 70 && libsReadyCb) { libsReadyCb(); libsReadyCb = null; }
        return;
      }
      pct = Math.min(pct + Math.random() * 13 + 4, ceiling);
      if (preCountRef.current) preCountRef.current.textContent = `${Math.floor(pct)}%`;
      if (preBarRef.current)   preBarRef.current.style.width   = `${pct}%`;
      setTimeout(() => advanceBar(ceiling), Math.random() * 150 + 40);
    };
    advanceBar(70);

    const finishPreloader = (gsap) => {
      const done = () => {
        pct = 100;
        if (preCountRef.current) preCountRef.current.textContent = '100%';
        if (preBarRef.current)   preBarRef.current.style.width   = '100%';
        gsap.to(preloaderRef.current, {
          opacity: 0, duration: 0.8, delay: 0.3, ease: 'power2.inOut',
          onComplete: () => {
            if (preloaderRef.current) preloaderRef.current.style.display = 'none';
          },
        });
      };
      if (pct >= 70) done();
      else libsReadyCb = done;
    };

    /* ── Grain texture (no deps needed) ──────────────────── */
    const grainEl = grainRef.current;
    if (grainEl) {
      const gc = document.createElement('canvas');
      gc.width = gc.height = 200;
      const gx = gc.getContext('2d');
      const id = gx.createImageData(200, 200);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
      gx.putImageData(id, 0, 0);
      grainEl.style.backgroundImage = `url(${gc.toDataURL()})`;
    }

    const cleanupAsync = [];

    Promise.all([
      import('three'),
      import('gsap').then(m => m.gsap),
      import('gsap/ScrollTrigger').then(m => m.ScrollTrigger),
    ]).then(([THREE, gsap, ScrollTrigger]) => {

      gsap.registerPlugin(ScrollTrigger);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const wrap = canvas.parentElement;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
        powerPreference: 'low-power',  // better for integrated GPUs
      });
      // lower pixel ratio for performance
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
      renderer.setSize(wrap.clientWidth, wrap.clientHeight);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 100);
      camera.position.set(0, 0, 4.8);

      // LOWER POLY COUNT: subdivision 2 (was 4)
      const geo = new THREE.IcosahedronGeometry(1.5, 2);
      const uni = { uTime: { value: 0 } };
      uTime.current = uni.uTime;

      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG,
        uniforms: uni, transparent: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      // Wireframe removed – saves one full draw call
      // (optional: keep if design absolutely needs it, but it's costly)

      addEv(window, 'resize', () => {
        const w = wrap.clientWidth, h = wrap.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });

      const canvasIO = new IntersectionObserver(
        ([e]) => { canvasVisible.current = e.isIntersecting; },
        { threshold: 0.01 }
      );
      canvasIO.observe(canvas);

      const dot  = cursorDot.current;
      const ring = cursorRing.current;

      root.querySelectorAll('a, button').forEach(el => {
        const enter = () => { isHover.current = true;  ring?.classList.add('lp-cursor-hover'); };
        const leave = () => { isHover.current = false; ring?.classList.remove('lp-cursor-hover'); };
        el.addEventListener('mouseenter', enter);
        el.addEventListener('mouseleave', leave);
        evts.push([el, 'mouseenter', enter], [el, 'mouseleave', leave]);
      });

      root.querySelectorAll('[data-magnetic]').forEach(btn => {
        const onMove = (e) => {
          const r  = btn.getBoundingClientRect();
          const dx = (e.clientX - r.left - r.width  / 2) * 0.28;
          const dy = (e.clientY - r.top  - r.height / 2) * 0.28;
          gsap.to(btn, { x: dx, y: dy, duration: 0.45, ease: 'power2.out' });
        };
        const onLeave = () => gsap.to(btn, { x: 0, y: 0, duration: 0.65, ease: 'elastic.out(1,0.5)' });
        btn.addEventListener('mousemove', onMove);
        btn.addEventListener('mouseleave', onLeave);
        evts.push([btn, 'mousemove', onMove], [btn, 'mouseleave', onLeave]);
      });

      const onNativeScroll = () => {
        const scrollY = window.scrollY;
        const limit   = document.documentElement.scrollHeight - window.innerHeight;
        if (progressRef.current)
          progressRef.current.style.transform = `scaleX(${limit > 0 ? scrollY / limit : 0})`;
        if (navRef.current)
          navRef.current.classList.toggle('lp-nav-scrolled', scrollY > 60);
        if (floatRef.current)
          floatRef.current.classList.toggle('lp-float-visible', scrollY > window.innerHeight * 0.75);
        ScrollTrigger.update();
      };
      addEv(window, 'scroll', onNativeScroll, { passive: true });

      gsap.ticker.lagSmoothing(500, 33);

      const unifiedTick = (time) => {

        if (canvasVisible.current) {
          if (uTime.current) uTime.current.value = time;

          // smooth rotation lerp
          rotCurrent.current.x += (rotTarget.current.x - rotCurrent.current.x) * 0.08;
          rotCurrent.current.y += (rotTarget.current.y - rotCurrent.current.y) * 0.08;
          mesh.rotation.x = rotCurrent.current.x;
          mesh.rotation.y = rotCurrent.current.y;

          renderer.render(scene, camera);
        }

        const cp = cursorPos.current, rp = ringPos.current;
        cp.x += (mouse.current.x - cp.x) * 0.9;
        cp.y += (mouse.current.y - cp.y) * 0.9;
        rp.x += (mouse.current.x - rp.x) * 0.12;
        rp.y += (mouse.current.y - rp.y) * 0.12;
        if (dot)  dot.style.transform  = `translate(${cp.x - 4}px,${cp.y - 4}px)`;
        if (ring) ring.style.transform = `translate(${rp.x - (isHover.current ? 28 : 14)}px,${rp.y - (isHover.current ? 28 : 14)}px)`;
      };

      gsap.ticker.add(unifiedTick);

      /* ── Story morphing canvas ──────────────────────────── */
      let storyMesh = null, storyGeos = [], storyMat = null;
      const sCanvas = storyCanvasRef.current;
      if (sCanvas) {
        const sWrap = sCanvas.parentElement;
        const sR = new THREE.WebGLRenderer({ canvas: sCanvas, antialias: false, alpha: true, powerPreference: 'low-power' });
        sR.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
        sR.setSize(sWrap.clientWidth, sWrap.clientHeight);
        const sSc = new THREE.Scene();
        const sCam = new THREE.PerspectiveCamera(50, sWrap.clientWidth / sWrap.clientHeight, 0.1, 100);
        sCam.position.set(0, 0, 5);
        storyGeos = [
          new THREE.IcosahedronGeometry(1.6, 2),
          new THREE.TorusKnotGeometry(1.0, 0.3, 80, 16),
          new THREE.OctahedronGeometry(1.8, 2),
        ];
        storyMat  = new THREE.MeshBasicMaterial({ color: 0xc8ff00, wireframe: true, transparent: true, opacity: 0 });
        storyMesh = new THREE.Mesh(storyGeos[0], storyMat);
        sSc.add(storyMesh);
        gsap.to(storyMat, { opacity: 0.32, duration: 0.6, delay: 0.3 });
        const sTick = () => {
          if (storyMesh) { storyMesh.rotation.x += 0.004; storyMesh.rotation.y += 0.006; }
          sR.render(sSc, sCam);
        };
        gsap.ticker.add(sTick);
        cleanupAsync.push(
          () => gsap.ticker.remove(sTick),
          () => { storyGeos.forEach(g => g.dispose()); storyMat?.dispose(); sR.dispose(); },
        );
      }

      finishPreloader(gsap);

      const heroWords = [];
      root.querySelectorAll('.lp-hero-line').forEach(line => {
        heroWords.push(...splitWords(line));
      });

      const ctx = gsap.context(() => {
        gsap.timeline({ delay: 1.6 })
          .to('.lp-eyebrow',      { opacity: 1, y: 0, duration: 1.0, ease: 'power4.out' })
          .to(heroWords,          { y: '0%',          duration: 1.0, stagger: 0.07, ease: 'power4.out' }, '-=0.55')
          .to('.lp-hero-sub',     { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.4')
          .to('.lp-hero-actions', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.6')
          .to('.lp-scroll-hint',  { opacity: 1,        duration: 0.6 }, '-=0.2');

        const featureCards = [...root.querySelectorAll('.lp-feat-card')];
        featureCards.forEach((card, i) => {
          gsap.fromTo(card,
            { clipPath: 'inset(0 100% 0 0)' },
            {
              clipPath: 'inset(0 0% 0 0)',
              duration: 0.85,
              delay: i * 0.12,
              ease: 'cubic-bezier(0.76,0,0.24,1)',
              scrollTrigger: {
                trigger: card,
                start: 'top 88%',
                once: true,
              },
            }
          );
        });

        const statItems = [...root.querySelectorAll('.lp-stat-item')];
        const statIO = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const i = statItems.indexOf(entry.target);
            const numEl = entry.target.querySelector('.lp-stat-val');
            if (!numEl) return;
            entry.target.classList.add('lp-stat-lit');
            gsap.to({ n: 0 }, {
              n: STATS[i]?.value ?? 0, duration: 2.2, ease: 'power2.out',
              onUpdate() { numEl.textContent = Math.round(this.targets()[0].n); },
            });
            statIO.unobserve(entry.target);
          });
        }, { threshold: 0.3 });
        statItems.forEach(el => statIO.observe(el));

        const ctaEl = root.querySelector('.lp-cta-inner');
        const ctaIO = new IntersectionObserver((entries) => {
          if (!entries[0].isIntersecting) return;
          gsap.from('.lp-cta-inner > *', {
            y: 48, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out',
          });
          ctaIO.disconnect();
        }, { threshold: 0.2 });
        if (ctaEl) ctaIO.observe(ctaEl);

        /* ── Section title word-reveals on scroll ────────── */
        root.querySelectorAll('.lp-reveal-title').forEach(title => {
          const words = splitWords(title);
          gsap.fromTo(words,
            { y: '110%' },
            { y: '0%', duration: 0.9, stagger: 0.055, ease: 'power4.out',
              scrollTrigger: { trigger: title, start: 'top 88%', once: true } }
          );
        });

        /* ── Mockup frame tilt-in ─────────────────────────── */
        const mockupFrame = root.querySelector('.lp-mockup-frame');
        if (mockupFrame) {
          gsap.fromTo(mockupFrame,
            { rotateX: 14, scale: 0.9, opacity: 0, y: 60 },
            { rotateX: 4,  scale: 1,   opacity: 1, y: 0,
              duration: 1.2, ease: 'power3.out',
              scrollTrigger: { trigger: mockupFrame, start: 'top 82%', once: true } }
          );
        }

        /* ── How It Works step stagger ───────────────────── */
        const howSteps = [...root.querySelectorAll('.lp-how-step')];
        if (howSteps.length) {
          gsap.from(howSteps, {
            y: 48, opacity: 0, duration: 0.85, stagger: 0.13, ease: 'power3.out',
            scrollTrigger: { trigger: howSteps[0].closest('.lp-how'), start: 'top 82%', once: true },
          });
        }

        /* ── Modality accuracy bars ───────────────────────── */
        root.querySelectorAll('.lp-mod-card').forEach(card => {
          ScrollTrigger.create({
            trigger: card, start: 'top 85%', once: true,
            onEnter: () => card.classList.add('lp-mod-lit'),
          });
        });

        /* ── Chat window slide-in ─────────────────────────── */
        const chatWin = root.querySelector('.lp-chat-window');
        if (chatWin) {
          gsap.from(chatWin, {
            x: 56, opacity: 0, duration: 1.0, ease: 'power3.out',
            scrollTrigger: { trigger: chatWin, start: 'top 82%', once: true },
          });
        }

        /* ── Story horizontal scroll ──────────────────────── */
        const storyInner = root.querySelector('.lp-story-inner');
        const storyTrack = root.querySelector('.lp-story-track');
        if (storyInner && storyTrack) {
          let sIdx = 0;
          gsap.to(storyTrack, {
            x: () => -(storyTrack.offsetWidth - window.innerWidth),
            ease: 'none',
            scrollTrigger: {
              trigger: storyInner,
              start: 'top top',
              end: () => `+=${storyTrack.offsetWidth - window.innerWidth}`,
              pin: true,
              scrub: 1.2,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate: ({ progress }) => {
                const idx = Math.min(Math.floor(progress * 3), 2);
                root.querySelectorAll('.lp-story-dot').forEach((d, i) =>
                  d.classList.toggle('lp-story-dot-active', i === idx));
                if (storyMesh && storyGeos.length && storyMat && idx !== sIdx) {
                  gsap.to(storyMat, { opacity: 0, duration: 0.25, onComplete: () => {
                    storyMesh.geometry = storyGeos[idx];
                    gsap.to(storyMat, { opacity: 0.32, duration: 0.35 });
                  }});
                  sIdx = idx;
                }
              },
            },
          });
        }

        /* ── Testimonials carousel ────────────────────────── */
        const testiCards = [...root.querySelectorAll('.lp-testi-card')];
        const testiDots  = [...root.querySelectorAll('.lp-testi-dot')];
        const TCOUNT = testiCards.length;
        let testiIdx = 0;
        const TSPACING = 530;

        const renderTesti = (active) => {
          testiCards.forEach((card, i) => {
            const raw = ((i - active) % TCOUNT + TCOUNT) % TCOUNT;
            const pos = raw > Math.floor(TCOUNT / 2) ? raw - TCOUNT : raw;
            gsap.to(card, {
              x: pos * TSPACING,
              scale: Math.max(0.75, 1 - Math.abs(pos) * 0.1),
              opacity: Math.max(0.15, 1 - Math.abs(pos) * 0.3),
              filter: `blur(${(Math.abs(pos) * 2.2).toFixed(1)}px)`,
              zIndex: 10 - Math.abs(pos),
              duration: 0.85, ease: 'power3.out',
            });
          });
          testiDots.forEach((d, i) => d.classList.toggle('lp-testi-dot-active', i === active));
        };

        if (TCOUNT) {
          renderTesti(0);
          const goTo = (n) => { testiIdx = ((n % TCOUNT) + TCOUNT) % TCOUNT; renderTesti(testiIdx); };
          const prev = root.querySelector('.lp-testi-prev');
          const next = root.querySelector('.lp-testi-next');
          if (prev) addEv(prev, 'click', () => goTo(testiIdx - 1));
          if (next) addEv(next, 'click', () => goTo(testiIdx + 1));
          testiDots.forEach((d, i) => addEv(d, 'click', () => goTo(i)));
          const timerT = setInterval(() => goTo(testiIdx + 1), 4200);
          cleanupAsync.push(() => clearInterval(timerT));
        }

        cleanupAsync.push(
          () => statIO.disconnect(),
          () => ctaIO.disconnect(),
        );
      }, root);

      cleanupAsync.push(
        () => gsap.ticker.remove(unifiedTick),
        () => ctx.revert(),
        () => ScrollTrigger.getAll().forEach(st => st.kill()),
        () => renderer.dispose(),
        () => mat.dispose(),
        () => geo.dispose(),
        () => canvasIO.disconnect(),
      );

    }).catch(err => console.error('[PathoScan] lib load failed:', err));

    return () => {
      document.body.classList.remove('lp-active');
      try { document.head.removeChild(fontLink); } catch {}
      evts.forEach(([el, t, fn]) => el.removeEventListener(t, fn));
      cleanupAsync.forEach(fn => fn());
    };
  }, []);

  return (
    <div className="lp-root" ref={rootRef}>
      <div className="lp-grain" ref={grainRef} aria-hidden="true" />
      <div className="lp-progress" ref={progressRef} aria-hidden="true" />
      <div className="lp-cursor-dot"  ref={cursorDot}  aria-hidden="true" />
      <div className="lp-cursor-ring" ref={cursorRing} aria-hidden="true" />

      <div className="lp-preloader" ref={preloaderRef} aria-hidden="true">
        <span className="lp-pre-logo">Patho<em>Scan</em>&thinsp;AI</span>
        <div className="lp-pre-track">
          <div className="lp-pre-fill" ref={preBarRef} />
        </div>
        <span className="lp-pre-count" ref={preCountRef}>0%</span>
      </div>

      <nav className="lp-nav" ref={navRef} aria-label="Main navigation">
        <Link to="/" className="lp-nav-logo">
          <span className="lp-nav-pulse" aria-hidden="true" />
          PathоScan<em>AI</em>
        </Link>
        <ul className="lp-nav-links" role="list">
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#modalities">Conditions</a></li>
          <li><a href="#chat-preview">AI Chat</a></li>
          <li><a href="#testimonials">Reviews</a></li>
        </ul>
        <div className="lp-nav-actions">
          <Link to="/login" className="lp-ghost"      data-magnetic>Sign In</Link>
          <Link to="/chat"  className="lp-accent-btn" data-magnetic>Open Chat</Link>
        </div>
      </nav>

      <section className="lp-hero" aria-label="Hero">
        <div className="lp-canvas-wrap" aria-hidden="true">
          <canvas ref={canvasRef} />
        </div>

        <div className="lp-hero-particles" aria-hidden="true">
          {particles.current.map(p => (
            <span key={p.id} className="lp-particle" style={{
              left: p.left, width: p.size, height: p.size,
              animationDuration: p.dur, animationDelay: p.delay,
              '--drift': p.drift, opacity: p.op,
            }} />
          ))}
        </div>

        <div className="lp-hero-content">
          <span className="lp-eyebrow">AI-Powered Medical Imaging Platform</span>
          <h1 className="lp-hero-title" aria-label="Medical Imaging Reimagined">
            <span className="lp-hero-line">Medical</span>
            <span className="lp-hero-line lp-hero-line-em">Imaging</span>
            <span className="lp-hero-line">Reimagined</span>
          </h1>
          <p className="lp-hero-sub">
            TensorFlow-powered diagnostics for Chest X-rays, Brain MRIs, and Bone scans —
            with Grad-CAM explainability, RAG clinical chat, and patient record management.
          </p>
          <div className="lp-hero-actions">
            <Link to="/chat"   className="lp-cta-primary" data-magnetic>Try Clinical Chat</Link>
            <Link to="/signup" className="lp-cta-outline" data-magnetic>Get Started</Link>
          </div>
        </div>

        <div className="lp-scroll-hint" aria-hidden="true">
          <span>Scroll</span>
          <div className="lp-scroll-line" />
        </div>
      </section>

      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="lp-mq-item">
              {item}<span className="lp-mq-sep">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Trust badges ──────────────────────────────────── */}
      <div className="lp-trust" aria-label="Compliance certifications">
        {TRUST_BADGES.map((b, i) => (
          <div key={i} className="lp-trust-badge">
            <span className="lp-trust-symbol" aria-hidden="true">{b.symbol}</span>
            <span className="lp-trust-label">{b.label}</span>
          </div>
        ))}
      </div>

      {/* ── How It Works ──────────────────────────────────── */}
      <section className="lp-how lp-lazy-section" id="how-it-works" aria-labelledby="how-heading">
        <div className="lp-container">
          <header className="lp-section-head">
            <span className="lp-label">Simple 4-Step Workflow</span>
            <h2 className="lp-section-title lp-reveal-title" id="how-heading">From scan to insight in seconds</h2>
            <p className="lp-section-sub">No setup, no training required — upload a scan and receive a fully explainable AI diagnosis with clinical context in under 5 seconds.</p>
          </header>
          <div className="lp-how-steps" role="list">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={i} className="lp-how-step" role="listitem">
                <div className="lp-how-num" aria-hidden="true">{s.step}</div>
                <span className="lp-how-icon" aria-hidden="true">{s.icon}</span>
                <h3 className="lp-how-title">{s.title}</h3>
                <p className="lp-how-desc">{s.desc}</p>
                <span className="lp-how-tag">{s.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-features" id="features" aria-labelledby="feat-heading">
        <div className="lp-container">
          <header className="lp-section-head">
            <span className="lp-label">Core Capabilities</span>
            <h2 className="lp-section-title lp-reveal-title" id="feat-heading">
              Every tool a radiologist needs
            </h2>
            <p className="lp-section-sub">
              Three production-ready AI modules delivering diagnostic-grade
              analysis across the most common imaging modalities.
            </p>
          </header>
          <div className="lp-feat-grid" role="list">
            {FEATURES.map((f, i) => (
              <article key={i} className="lp-feat-card" role="listitem">
                <div className="lp-feat-glow" aria-hidden="true" />
                <span className="lp-feat-icon" aria-hidden="true">{f.icon}</span>
                <h3 className="lp-feat-title">{f.title}</h3>
                <p className="lp-feat-desc">{f.desc}</p>
                <span className="lp-feat-tag">{f.tag}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Detection Capabilities ────────────────────────── */}
      <section className="lp-modalities lp-lazy-section" id="modalities" aria-labelledby="mod-heading">
        <div className="lp-container">
          <header className="lp-section-head">
            <span className="lp-label">Detection Capabilities</span>
            <h2 className="lp-section-title lp-reveal-title" id="mod-heading">What PathoScan AI detects</h2>
            <p className="lp-section-sub">Three specialised CNN models, each fine-tuned on modality-specific datasets and validated against radiologist ground truth.</p>
          </header>
          <div className="lp-mod-grid">
            {MODALITIES.map((m, i) => (
              <div key={i} className="lp-mod-card">
                <span className="lp-mod-icon" aria-hidden="true">{m.icon}</span>
                <h3 className="lp-mod-name">{m.name}</h3>
                <div className="lp-mod-accuracy">{m.accuracy}% Accuracy</div>
                <div className="lp-mod-bar-track" aria-hidden="true">
                  <div className="lp-mod-bar-fill" style={{ '--bar-w': `${m.accuracy}%` }} />
                </div>
                <div className="lp-mod-conditions" role="list">
                  {m.conditions.map((c, j) => (
                    <span key={j} className="lp-mod-condition" role="listitem">{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── App Mockup ────────────────────────────────────── */}
      <section className="lp-mockup lp-lazy-section" aria-label="Product preview">
        <div className="lp-container">
          <header className="lp-section-head" style={{ textAlign: 'center' }}>
            <span className="lp-label">Product Preview</span>
            <h2 className="lp-section-title lp-reveal-title">See PathoScan AI in action</h2>
          </header>
          <div className="lp-mockup-wrap" aria-hidden="true">
            <div className="lp-mockup-glow" />
            <div className="lp-mockup-frame">
              <div className="lp-mockup-chrome">
                <div className="lp-mockup-dots">
                  <span /><span /><span />
                </div>
                <div className="lp-mockup-url">patho-scan.ai / dashboard</div>
              </div>
              <div className="lp-mockup-body">
                <aside className="lp-mockup-sidebar">
                  <div className="lp-mockup-logo-sm">P<em>S</em></div>
                  {['Dashboard','Upload Scan','Analysis','AI Chat','Records','Settings'].map((item, i) => (
                    <div key={i} className={`lp-mockup-nav-item${i === 0 ? ' lp-mockup-nav-active' : ''}`}>
                      {item}
                    </div>
                  ))}
                </aside>
                <div className="lp-mockup-main">
                  <div className="lp-mockup-topbar">
                    <span className="lp-mockup-page-title">Dashboard</span>
                    <div className="lp-mockup-upload-btn">+ Upload Scan</div>
                  </div>
                  <div className="lp-mockup-grid">
                    <div className="lp-mockup-upload-zone">
                      <div className="lp-mockup-up-icon">↑</div>
                      <span>Drop X-Ray, MRI, or Bone scan</span>
                      <span className="lp-mockup-up-sub">PNG · JPG · DICOM</span>
                    </div>
                    <div className="lp-mockup-scan-card">
                      <div className="lp-mockup-scan-img lp-mockup-scan-xray" />
                      <div className="lp-mockup-scan-meta">
                        <span className="lp-mockup-scan-type">Chest X-Ray</span>
                        <span className="lp-mockup-scan-conf">98.2% confidence</span>
                      </div>
                      <span className="lp-mockup-badge-ok">Normal</span>
                    </div>
                    <div className="lp-mockup-scan-card">
                      <div className="lp-mockup-scan-img lp-mockup-scan-mri" />
                      <div className="lp-mockup-scan-meta">
                        <span className="lp-mockup-scan-type">Brain MRI</span>
                        <span className="lp-mockup-scan-conf">96.7% confidence</span>
                      </div>
                      <span className="lp-mockup-badge-warn">Review</span>
                    </div>
                    <div className="lp-mockup-heatmap-card">
                      <div className="lp-mockup-heatmap-vis" />
                      <span className="lp-mockup-heatmap-lbl">Grad-CAM · Active Region</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Clinical Chat Preview ─────────────────────────── */}
      <section className="lp-chat-preview lp-lazy-section" id="chat-preview" aria-labelledby="chat-heading">
        <div className="lp-container">
          <div className="lp-chat-wrap">
            <div className="lp-chat-left">
              <span className="lp-label">RAG Clinical Assistant</span>
              <h2 className="lp-chat-heading lp-reveal-title" id="chat-heading">Ask anything about your scan</h2>
              <p className="lp-chat-sub">
                Powered by Ollama LLMs and a ChromaDB vector store of peer-reviewed radiology literature —
                our assistant retrieves relevant evidence and contextualises it for your specific scan in real time.
              </p>
              <ul className="lp-chat-features" aria-label="Chat capabilities">
                {[
                  'References peer-reviewed clinical literature',
                  'Contextualises findings to the uploaded scan',
                  'Suggests differential diagnoses',
                  'Recommends follow-up imaging or labs',
                  'Supports full conversation history',
                ].map((f, i) => <li key={i} className="lp-chat-feature-item">{f}</li>)}
              </ul>
            </div>
            <div className="lp-chat-right">
              <div className="lp-chat-window" aria-label="Chat preview">
                <div className="lp-chat-window-header">
                  <span className="lp-chat-pulse" aria-hidden="true" />
                  <span className="lp-chat-window-title">PathoScan Clinical Assistant</span>
                </div>
                <div className="lp-chat-messages">
                  <div className="lp-chat-msg-user">What does this chest X-ray indicate? Patient has mild dyspnea.</div>
                  <div className="lp-chat-msg-ai">
                    <strong>Findings:</strong> The model detected bilateral lower-lobe opacification consistent with <strong>Community-Acquired Pneumonia</strong> (confidence 97.4%). The Grad-CAM overlay highlights the right lower lobe as the primary region of interest.
                    <br /><br />
                    <strong>Recommendation:</strong> Consider sputum culture and CBC. Empirical antibiotic therapy may be warranted pending further workup. Lateral view X-ray advised for confirmation.
                    <div className="lp-chat-sources">
                      <span className="lp-chat-source">NEJM 2019</span>
                      <span className="lp-chat-source">Radiology 2022</span>
                      <span className="lp-chat-source">ATS Guidelines</span>
                    </div>
                  </div>
                  <div className="lp-chat-msg-user">Is a CT scan necessary?</div>
                  <div className="lp-chat-msg-ai">
                    <strong>CT is not immediately necessary</strong> in uncomplicated CAP presenting with classic X-ray findings. Reserve CT for atypical patterns, immunocompromised patients, or lack of improvement after 72h of therapy.
                    <div className="lp-chat-sources">
                      <span className="lp-chat-source">BTS Guidelines</span>
                      <span className="lp-chat-source">IDSA 2021</span>
                    </div>
                  </div>
                </div>
                <div className="lp-chat-input-row">
                  <div className="lp-chat-input-mock">Ask a clinical question…</div>
                  <div className="lp-chat-send-btn" aria-hidden="true">↑</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-stats lp-lazy-section" id="stats" aria-label="Statistics">
        <div className="lp-container">
          <div className="lp-stats-grid">
            {STATS.map((s, i) => (
              <div key={i} className="lp-stat-item">
                <span className="lp-stat-num">
                  <span className="lp-stat-val">0</span>
                  <span className="lp-stat-sfx">{s.suffix}</span>
                </span>
                <span className="lp-stat-lbl">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Story ─────────────────────────────────────────── */}
      <section className="lp-story" id="story" aria-label="Our Story">
        <div className="lp-story-inner">
          <div className="lp-story-track">
            {STORY.map((s, i) => (
              <div key={i} className="lp-story-panel">
                <div className="lp-story-panel-content">
                  <span className="lp-story-num">{s.num}</span>
                  <h3 className="lp-story-heading">{s.heading}</h3>
                  <p className="lp-story-body">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="lp-story-vis" aria-hidden="true">
            <canvas ref={storyCanvasRef} />
          </div>
          <div className="lp-story-progress" aria-hidden="true">
            {STORY.map((_, i) => (
              <span key={i} className={`lp-story-dot${i === 0 ? ' lp-story-dot-active' : ''}`} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────── */}
      <section className="lp-testi lp-lazy-section" id="testimonials" aria-label="Testimonials">
        <div className="lp-container">
          <header className="lp-section-head" style={{ textAlign: 'center' }}>
            <span className="lp-label">Trusted by Clinicians</span>
            <h2 className="lp-section-title lp-reveal-title">What physicians are saying</h2>
          </header>
          <div className="lp-testi-stage">
            <div className="lp-testi-carousel">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="lp-testi-card">
                  <span className="lp-testi-stars" aria-hidden="true">★★★★★</span>
                  <p className="lp-testi-quote">"{t.quote}"</p>
                  <div className="lp-testi-author">
                    <span className="lp-testi-avatar" aria-hidden="true">
                      {t.name.split(' ').map(w => w[0]).join('')}
                    </span>
                    <div>
                      <strong className="lp-testi-name">{t.name}</strong>
                      <span className="lp-testi-role">{t.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-testi-controls">
            <button className="lp-testi-prev" aria-label="Previous testimonial">←</button>
            <div className="lp-testi-dots" role="tablist">
              {TESTIMONIALS.map((_, i) => (
                <button key={i} className="lp-testi-dot" role="tab" aria-label={`Testimonial ${i + 1}`} />
              ))}
            </div>
            <button className="lp-testi-next" aria-label="Next testimonial">→</button>
          </div>
        </div>
      </section>

      <section className="lp-cta lp-lazy-section" aria-labelledby="cta-heading">
        <div className="lp-cta-bg" aria-hidden="true" />
        <div className="lp-container">
          <div className="lp-cta-inner">
            <span className="lp-label">Start Today — Free</span>
            <h2 className="lp-cta-title" id="cta-heading">
              Diagnose with<br />
              <em className="lp-cta-em">confidence</em>
            </h2>
            <p className="lp-cta-sub">
              Join clinicians already using PathоScan AI to accelerate
              radiology workflows and deliver explainable AI diagnoses.
            </p>
            <div className="lp-cta-actions">
              <Link to="/chat"   className="lp-cta-primary" data-magnetic>Try Clinical Chat</Link>
              <Link to="/signup" className="lp-cta-outline" data-magnetic>Get Started</Link>
            </div>
            <p className="lp-cta-note">No credit card required · Instant access</p>
          </div>
        </div>
      </section>

      <footer className="lp-footer lp-lazy-section" role="contentinfo">
        <div className="lp-container">
          <div className="lp-footer-row">
            <Link to="/" className="lp-footer-logo">
              <span className="lp-footer-logo-text">PathоScan</span>
              <em>AI</em>
              <span className="lp-footer-logo-dot" aria-hidden="true" />
            </Link>
            <ul className="lp-footer-links" role="list">
              <li><Link to="/chat">Chat</Link></li>
              <li><Link to="/signup">Sign Up</Link></li>
              <li><Link to="/login">Sign In</Link></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#story">Story</a></li>
            </ul>
            <div className="lp-footer-socials" aria-label="Social links">
              {[
                { label: 'GitHub',   href: '#', icon: '⌥' },
                { label: 'LinkedIn', href: '#', icon: 'in' },
                { label: 'Twitter',  href: '#', icon: '𝕏' },
              ].map(s => (
                <a key={s.label} href={s.href} className="lp-footer-social" aria-label={s.label} target="_blank" rel="noopener noreferrer">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
          <div className="lp-footer-divider" aria-hidden="true" />
          <div className="lp-footer-bottom">
            <p className="lp-footer-copy">© {new Date().getFullYear()} PathоScan AI. All rights reserved.</p>
            <p className="lp-footer-tagline">Built with TensorFlow · FastAPI · React</p>
          </div>
        </div>
      </footer>
      {/* ── Floating CTA ──────────────────────────────────── */}
      <div className="lp-float-cta" ref={floatRef} aria-label="Quick access">
        <Link to="/chat" className="lp-float-btn" data-magnetic>
          <span>Try Demo</span>
          <span className="lp-float-arrow" aria-hidden="true">→</span>
        </Link>
      </div>

    </div>
  );
}