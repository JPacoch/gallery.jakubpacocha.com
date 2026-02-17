(function () {
    'use strict';

    const CONFIG = {
        photosPath: './data/photos.json',
        configPath: './data/config.json',
        cloudName: 'den0uvu8n',
    };





    function getCloudinaryURL(publicId, width) {
        if (!CONFIG.cloudName || !publicId) return '';

        const cleanId = String(publicId).replace(/^\/+/, '');
        const transforms = `f_auto,q_auto:good,w_${width || 'auto'},c_limit,dpr_auto`;
        return `https://res.cloudinary.com/${CONFIG.cloudName}/image/upload/${transforms}/${cleanId}`;
    }

    function getPhotoSrc(photo, width) {
        const directSrc = (photo && (photo.src || photo.url || photo.image)) || '';

        if (directSrc) {
            return directSrc;
        }

        const publicId = (photo && photo.publicId) || '';
        if (
            publicId &&
            (/^https?:\/\//.test(publicId) ||
                publicId.startsWith('data:') ||
                publicId.startsWith('./') ||
                publicId.startsWith('/') ||
                /\.(avif|webp|jpe?g|png|gif|svg)$/i.test(publicId))
        ) {
            return publicId;
        }

        const cloudinarySrc = getCloudinaryURL(publicId, width);
        if (cloudinarySrc) {
            return cloudinarySrc;
        }

        return '';
    }



    function escapeHTML(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function initShader() {
        const canvas = document.getElementById('shaderCanvas');
        if (!canvas) return;

        const gl = canvas.getContext('webgl', { antialias: true, alpha: false }) || canvas.getContext('experimental-webgl');
        if (!gl) {
            console.warn('WebGL not supported, using fallback');
            canvas.style.background = 'radial-gradient(circle at 20% 20%, rgba(103, 182, 255, 0.18), transparent 45%), radial-gradient(circle at 80% 90%, rgba(128, 244, 210, 0.15), transparent 42%), #0b0b0b';
            return;
        }

        function resizeCanvas() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(canvas.clientWidth * dpr);
            canvas.height = Math.floor(canvas.clientHeight * dpr);
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const pointer = { x: 0.5, y: 0.5 };
        const smoothPointer = { x: 0.5, y: 0.5 };
        let scrollProgress = 0;

        window.addEventListener('pointermove', (event) => {
            pointer.x = event.clientX / window.innerWidth;
            pointer.y = 1 - event.clientY / window.innerHeight;
        });

        window.addEventListener(
            'scroll',
            () => {
                const viewport = Math.max(window.innerHeight, 1);
                scrollProgress = Math.min(window.scrollY / viewport, 1.4);
            },
            { passive: true }
        );

        const vertexShaderSource = `
            attribute vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            precision highp float;
            uniform float time;
            uniform vec2 resolution;
            uniform vec2 mouse;
            uniform float scroll;
            uniform float theme;

            // --- Simplex-style noise ---
            vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
            vec2 mod289v2(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
            vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }

            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405, 0.366025403784, -0.577350269189, 0.024390243902);
                vec2 i  = floor(v + dot(v, C.yy));
                vec2 x0 = v - i + dot(i, C.xx);
                vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod289v2(i);
                vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m * m; m = m * m;
                vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x_) - 0.5;
                vec3 ox = floor(x_ + 0.5);
                vec3 a0 = x_ - ox;
                m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                vec3 g;
                g.x = a0.x * x0.x + h.x * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }

            // Domain-warped FBM for organic flow
            float warpedFbm(vec2 p, float t) {
                // First warp layer
                vec2 q = vec2(
                    snoise(p + vec2(0.0, 0.0) + t * 0.15),
                    snoise(p + vec2(5.2, 1.3) - t * 0.12)
                );
                // Second warp layer
                vec2 r = vec2(
                    snoise(p + 3.8 * q + vec2(1.7, 9.2) + t * 0.08),
                    snoise(p + 3.8 * q + vec2(8.3, 2.8) - t * 0.1)
                );
                return snoise(p + 3.2 * r);
            }

            // Soft metaball SDF
            float metaball(vec2 p, vec2 center, float radius) {
                float d = length(p - center);
                return radius * radius / (d * d + 0.001);
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                float aspect = resolution.x / resolution.y;
                vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

                float t = time * 0.18;

                // Cursor influence — smooth organic pull
                vec2 mPos = (mouse - 0.5) * vec2(aspect, 1.0);

                // --- Metaballs that follow cursor ---
                float meta = 0.0;
                // Primary blob tracks cursor
                meta += metaball(p, mPos * 0.6, 0.22 + 0.04 * sin(t * 1.2));
                // Orbiting blobs
                meta += metaball(p, mPos * 0.3 + 0.35 * vec2(cos(t * 0.7), sin(t * 0.9)), 0.18);
                meta += metaball(p, mPos * 0.2 + 0.4 * vec2(sin(t * 0.5 + 1.5), cos(t * 0.6 + 2.0)), 0.16);
                meta += metaball(p, vec2(sin(t * 0.3) * 0.5, cos(t * 0.4) * 0.35), 0.14);
                meta += metaball(p, vec2(cos(t * 0.25 + 3.0) * 0.6, sin(t * 0.35 + 1.0) * 0.4), 0.12);

                // Threshold the metaballs for smooth blob shapes
                float blobField = smoothstep(0.9, 2.2, meta);

                // --- Domain-warped background texture ---
                vec2 warpP = p * 1.8 + scroll * 0.15;
                float warp1 = warpedFbm(warpP, t);
                float warp2 = warpedFbm(warpP * 0.7 + vec2(3.0), t * 0.8);
                float flow = warp1 * 0.6 + warp2 * 0.4;
                flow = flow * 0.5 + 0.5; // remap to 0..1

                // --- Aurora streaks ---
                float aurora = 0.0;
                for (int i = 0; i < 3; i++) {
                    float fi = float(i);
                    float offset = fi * 0.4 + scroll * 0.1;
                    float wave = sin(p.x * (2.5 + fi * 0.8) + t * (0.4 + fi * 0.15) + snoise(p * 1.5 + t * 0.1) * 1.5);
                    float streak = smoothstep(0.12, 0.0, abs(p.y - wave * 0.25 - offset + 0.1));
                    aurora += streak * (0.3 - fi * 0.08);
                }
                aurora *= smoothstep(0.0, 0.3, 1.0 - abs(p.y));

                // --- Color palettes ---
                // Dark mode: deep navy → teal → electric blue highlights
                vec3 dCol1 = vec3(0.02, 0.03, 0.06);   // deep void
                vec3 dCol2 = vec3(0.06, 0.10, 0.16);   // dark navy
                vec3 dCol3 = vec3(0.10, 0.22, 0.30);   // teal depth
                vec3 dCol4 = vec3(0.20, 0.42, 0.55);   // electric teal
                vec3 dCol5 = vec3(0.35, 0.55, 0.70);   // bright accent

                // Light mode: warm cream → sky → soft lilac
                vec3 lCol1 = vec3(0.96, 0.97, 0.98);
                vec3 lCol2 = vec3(0.92, 0.94, 0.97);
                vec3 lCol3 = vec3(0.82, 0.87, 0.94);
                vec3 lCol4 = vec3(0.68, 0.78, 0.88);
                vec3 lCol5 = vec3(0.55, 0.68, 0.82);

                vec3 col1 = mix(dCol1, lCol1, theme);
                vec3 col2 = mix(dCol2, lCol2, theme);
                vec3 col3 = mix(dCol3, lCol3, theme);
                vec3 col4 = mix(dCol4, lCol4, theme);
                vec3 col5 = mix(dCol5, lCol5, theme);

                // --- Compose final color ---
                // Base gradient from flow
                vec3 color = mix(col1, col2, flow);
                color = mix(color, col3, smoothstep(0.3, 0.7, flow + blobField * 0.3));

                // Metaball glow
                color = mix(color, col4, blobField * 0.55);
                color = mix(color, col5, blobField * blobField * 0.3);

                // Aurora overlay
                vec3 auroraColor = mix(col4, col5, 0.5 + 0.5 * sin(t * 0.3));
                color += auroraColor * aurora * (0.25 + blobField * 0.15);

                // Cursor proximity glow
                float cursorGlow = smoothstep(0.6, 0.0, length(p - mPos * 0.6));
                color = mix(color, col5, cursorGlow * 0.12);

                // Subtle grain for texture
                float grain = (snoise(gl_FragCoord.xy * 0.8) * 0.5 + 0.5) * 0.025;
                color += grain - 0.0125;

                // Vignette
                float vig = smoothstep(1.3, 0.25, length(p));
                color *= vig;

                // Scroll fade
                color *= 1.0 - scroll * 0.18;

                gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
            }
        `;

        function createShader(type, source) {
            const shader = gl.createShader(type);
            if (!shader) return null;

            gl.shaderSource(shader, source);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        if (!vertexShader || !fragmentShader) return;

        const program = gl.createProgram();
        if (!program) return;

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return;
        }

        gl.useProgram(program);

        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const timeLocation = gl.getUniformLocation(program, 'time');
        const resolutionLocation = gl.getUniformLocation(program, 'resolution');
        const mouseLocation = gl.getUniformLocation(program, 'mouse');
        const scrollLocation = gl.getUniformLocation(program, 'scroll');
        const themeLocation = gl.getUniformLocation(program, 'theme');

        const startTime = performance.now();
        function renderFrame(now) {
            const elapsed = (now - startTime) * 0.001;
            const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 1.0 : 0.0;

            smoothPointer.x += (pointer.x - smoothPointer.x) * 0.08;
            smoothPointer.y += (pointer.y - smoothPointer.y) * 0.08;

            gl.uniform1f(timeLocation, elapsed);
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
            gl.uniform2f(mouseLocation, smoothPointer.x, smoothPointer.y);
            gl.uniform1f(scrollLocation, scrollProgress);
            gl.uniform1f(themeLocation, theme);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            requestAnimationFrame(renderFrame);
        }

        requestAnimationFrame(renderFrame);
    }

    function initTheme() {
        const saved = localStorage.getItem('neb-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
        }

        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;

        toggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('neb-theme', next);
        });
    }

    function initLenis() {
        const lenis = new Lenis({
            duration: 1.3,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: true,
            smoothTouch: false,
        });

        lenis.on('scroll', ScrollTrigger.update);

        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });

        gsap.ticker.lagSmoothing(0);

        return lenis;
    }

    function splitTextIntoChars(element) {
        const lines = element.querySelectorAll('.hero__line');
        lines.forEach((line) => {
            const text = line.innerHTML;
            let result = '';
            let inTag = false;
            let currentTag = '';

            for (let i = 0; i < text.length; i++) {
                const char = text[i];

                if (char === '<') {
                    inTag = true;
                    currentTag += char;
                    continue;
                }

                if (inTag) {
                    currentTag += char;
                    if (char === '>') {
                        inTag = false;
                        result += currentTag;
                        currentTag = '';
                    }
                    continue;
                }

                if (char === ' ') {
                    result += `<span class="hero__char">&nbsp;</span>`;
                } else {
                    result += `<span class="hero__char">${char}</span>`;
                }
            }

            line.innerHTML = result;
        });
    }

    function initHero() {
        const hero = document.querySelector('.hero');
        const heroTitle = document.querySelector('.hero__title');
        if (!hero || !heroTitle) return;

        splitTextIntoChars(heroTitle);

        const chars = heroTitle.querySelectorAll('.hero__char');

        const intro = gsap.timeline({
            delay: 0.65,
            defaults: { ease: 'power3.out' },
        });

        intro
            .from('.hero__eyebrow', {
                opacity: 0,
                y: 16,
                duration: 0.7,
            })
            .to(
                chars,
                {
                    y: 0,
                    duration: 1.15,
                    stagger: 0.018,
                    ease: 'power4.out',
                },
                '-=0.2'
            )
            .to(
                '.hero__subtitle',
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.9,
                },
                '-=0.62'
            )
            ;

        const heroScrollTl = gsap.timeline({
            scrollTrigger: {
                trigger: hero,
                start: 'top top',
                end: 'bottom top',
                scrub: 1.15,
            },
        });

        heroScrollTl
            .to(
                '.hero__content',
                {
                    y: -130,
                    opacity: 0.28,
                    ease: 'none',
                },
                0
            )
            .to(
                '.hero__canvas',
                {
                    y: 70,
                    scale: 1.08,
                    ease: 'none',
                },
                0
            );
    }

    function initParallax() {
        const layers = gsap.utils.toArray('[data-parallax]');

        layers.forEach((layer) => {
            const speed = parseFloat(layer.getAttribute('data-speed') || '0.2');
            if (Number.isNaN(speed)) return;

            gsap.to(layer, {
                yPercent: speed * 26,
                ease: 'none',
                scrollTrigger: {
                    trigger: '.hero',
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                },
            });
        });
    }

    // ── 8. LOADER ──
    function initLoader() {
        const loader = document.querySelector('.loader');
        if (!loader) return;

        const loaderText = loader.querySelector('.loader__text');

        const tl = gsap.timeline();

        tl.to(loaderText, {
            opacity: 1,
            duration: 0.6,
            ease: 'power2.out',
        })
            .to(loaderText, {
                opacity: 0,
                duration: 0.4,
                delay: 0.3,
                ease: 'power2.in',
            })
            .to(loader, {
                yPercent: -100,
                duration: 0.8,
                ease: 'power4.inOut',
                onComplete: () => {
                    loader.style.display = 'none';
                },
            });
    }

    async function loadJson(path) {
        try {
            const res = await fetch(path, { cache: 'no-store' });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            return await res.json();
        } catch (e) {
            return new Promise((resolve) => {
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', path, true);
                    xhr.onreadystatechange = () => {
                        if (xhr.readyState !== 4) return;

                        const validStatus = xhr.status === 200 || xhr.status === 0;
                        if (!validStatus || !xhr.responseText) {
                            resolve(null);
                            return;
                        }

                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch (parseError) {
                            resolve(null);
                        }
                    };
                    xhr.onerror = () => resolve(null);
                    xhr.send();
                } catch (xhrError) {
                    resolve(null);
                }
            });
        }
    }



    async function loadConfig() {
        const fileConfig = await loadJson(CONFIG.configPath);
        if (fileConfig && fileConfig.cloudName) {
            CONFIG.cloudName = String(fileConfig.cloudName).trim();
        }
    }

    function normalizePhoto(photo, index) {
        const source = photo || {};
        return {
            id: source.id || `photo-${index + 1}`,
            title: source.title || `Untitled ${index + 1}`,
            category: source.category || 'Portfolio',
            year: source.year || '',
            publicId: source.publicId || source.cloudinaryPublicId || '',
            src: source.src || source.url || source.image || source.path || '',
            exif: source.exif || {},
        };
    }

    async function loadPhotos() {
        const fileData = await loadJson(CONFIG.photosPath);
        const rawPhotos = (fileData && fileData.photos) || [];

        if (!rawPhotos.length) {
            console.warn('No photo data found from data/photos.json');
            return [];
        }

        return rawPhotos.map(normalizePhoto);
    }

    function renderGallery(photos) {
        const grid = document.querySelector('.masonry-grid');
        const countEl = document.querySelector('.section-header__count');
        if (!grid) return [];

        grid.innerHTML = '';

        if (!Array.isArray(photos) || !photos.length) {
            grid.innerHTML = '<p class="gallery-empty">No images available. Update <code>data/photos.json</code> and reload.</p>';
            if (countEl) countEl.textContent = '0 Works';
            return [];
        }

        // Sort photos by numeric ID descending (highest first)
        const sortedPhotos = [...photos].sort((a, b) => {
            const idA = parseInt(a.id, 10);
            const idB = parseInt(b.id, 10);
            if (Number.isNaN(idA)) return 1;
            if (Number.isNaN(idB)) return -1;
            return idB - idA;
        });

        sortedPhotos.forEach((photo, idx) => {
            const num = String(parseInt(photo.id, 10) || idx + 1).padStart(2, '0');
            const src = getPhotoSrc(photo, 1200);

            const item = document.createElement('div');
            item.className = 'gallery-item';
            // FIX: Store the index in the sorted array, not the original array
            item.dataset.index = idx;
            item.innerHTML = `
                <div class="gallery-item__wrapper">
                    <img
                        src="${src}"
                        alt="${escapeHTML(photo.title)}"
                        loading="lazy"
                    />
                    <div class="gallery-item__meta">
                        <span class="gallery-item__title">${num}. ${escapeHTML(photo.title)}</span>
                        <span class="gallery-item__category">${escapeHTML(photo.category)}</span>
                    </div>
                </div>
            `;

            const img = item.querySelector('img');

            grid.appendChild(item);
        });

        if (countEl) {
            countEl.textContent = `${photos.length} Works`;
        }

        // FIX: Return the sorted array since that's what's displayed
        return sortedPhotos;
    }

    function initGalleryAnimations() {
        const items = document.querySelectorAll('.gallery-item');

        gsap.from('.section-header__title', {
            y: 42,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.section-header',
                start: 'top 85%',
            },
        });

        gsap.from('.section-header__count', {
            y: 20,
            opacity: 0,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.section-header',
                start: 'top 82%',
            },
        });

        items.forEach((item, idx) => {
            gsap.to(item, {
                clipPath: 'inset(0 0 0% 0)',
                opacity: 1,
                y: 0,
                duration: 1.05,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: item,
                    start: 'top 88%',
                    toggleActions: 'play none none none',
                },
            });

        });
    }

    let currentPhotos = [];
    let focusActive = false;
    let gridClickHandler = null;
    let overlayClickHandler = null;
    let keydownHandler = null;
    let closeClickHandler = null;

    function initFocusMode(photos) {
        currentPhotos = photos;
        const overlay = document.querySelector('.focus-overlay');
        const grid = document.querySelector('.masonry-grid');
        if (!overlay || !grid) return;

        const imgContainer = overlay.querySelector('.focus-overlay__image-container');
        if (!imgContainer) return;

        const overlayImg = imgContainer.querySelector('img');
        const closeBtn = overlay.querySelector('.focus-overlay__close');
        const exifPanel = overlay.querySelector('.focus-overlay__exif');
        if (!overlayImg || !closeBtn || !exifPanel) return;

        // Remove old event listeners if they exist
        if (gridClickHandler) {
            grid.removeEventListener('click', gridClickHandler);
        }
        if (closeClickHandler) {
            closeBtn.removeEventListener('click', closeClickHandler);
        }
        if (overlayClickHandler) {
            overlay.removeEventListener('click', overlayClickHandler);
        }
        if (keydownHandler) {
            document.removeEventListener('keydown', keydownHandler);
        }

        // Create new event handlers with current photos closure
        gridClickHandler = (e) => {
            const item = e.target.closest('.gallery-item');
            if (!item) return;

            const idx = parseInt(item.dataset.index || '-1', 10);
            if (Number.isNaN(idx) || idx < 0) return;

            const photo = currentPhotos[idx];
            if (!photo) return;

            openFocus(photo, item, overlay, overlayImg, exifPanel);
        };

        closeClickHandler = () => closeFocus(overlay);

        overlayClickHandler = (e) => {
            if (e.target === overlay) closeFocus(overlay);
        };

        keydownHandler = (e) => {
            if (e.key === 'Escape' && focusActive) closeFocus(overlay);
        };

        // Add new event listeners
        grid.addEventListener('click', gridClickHandler);
        closeBtn.addEventListener('click', closeClickHandler);
        overlay.addEventListener('click', overlayClickHandler);
        document.addEventListener('keydown', keydownHandler);
    }

    function openFocus(photo, sourceEl, overlay, overlayImg, exifPanel) {
        focusActive = true;
        const src = getPhotoSrc(photo, 2400);

        overlayImg.src = src;
        overlayImg.alt = photo.title || 'Photo';

        if (photo.exif) {
            exifPanel.innerHTML = '';
            const fields = [
                { label: 'Camera', value: photo.exif.camera },
                { label: 'Lens', value: photo.exif.lens },
                { label: 'Aperture', value: photo.exif.aperture },
                { label: 'Shutter', value: photo.exif.shutter },
                { label: 'ISO', value: photo.exif.iso },
            ];
            fields.forEach((f) => {
                if (!f.value) return;
                const el = document.createElement('div');
                el.className = 'exif-item';
                el.innerHTML = `
                    <div class="exif-item__label">${escapeHTML(f.label)}</div>
                    <div class="exif-item__value">${escapeHTML(f.value)}</div>
                `;
                exifPanel.appendChild(el);
            });
        } else {
            exifPanel.innerHTML = '';
        }

        const container = overlay.querySelector('.focus-overlay__image-container');

        gsap.set(container, {
            clearProps: 'top,left,xPercent,yPercent,x,y',
            opacity: 0,
            scale: 0.92,
        });

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        gsap.to(container, {
            opacity: 1,
            scale: 1,
            duration: 0.55,
            ease: 'power3.out',
        });
    }

    function closeFocus(overlay) {
        focusActive = false;
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function initFooter() {
        const cta = document.querySelector('.footer__cta');
        if (cta) {
            gsap.from(cta, {
                y: 60,
                opacity: 0,
                duration: 1.2,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: '.footer',
                    start: 'top 80%',
                },
            });
        }
    }

    async function init() {
        gsap.registerPlugin(ScrollTrigger);

        initTheme();
        initLoader();
        initShader();
        initLenis();
        initHero();
        initParallax();

        await loadConfig();
        const photos = await loadPhotos();
        const renderedPhotos = renderGallery(photos);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                initGalleryAnimations();
                initFocusMode(renderedPhotos);
                initFooter();
                ScrollTrigger.refresh();
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
