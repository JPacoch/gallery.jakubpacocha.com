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

    let lenisInstance = null;

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

        lenisInstance = lenis;
        return lenis;
    }

    function initSmoothAnchorLinks() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();

                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);

                if (targetElement && lenisInstance) {
                    gsap.to(this, {
                        scale: 0.95,
                        duration: 0.15,
                        yoyo: true,
                        repeat: 1,
                        ease: 'power2.inOut'
                    });

                    lenisInstance.scrollTo(targetElement, {
                        offset: -20,
                        duration: 1.8,
                        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                    });
                }
            });
        });
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

        grid.addEventListener('click', gridClickHandler);
        closeBtn.addEventListener('click', closeClickHandler);
        overlay.addEventListener('click', overlayClickHandler);
        document.addEventListener('keydown', keydownHandler);
    }

    function openFocus(photo, sourceEl, overlay, overlayImg, exifPanel) {
        focusActive = true;
        const targetSrc = getPhotoSrc(photo, 2400);

        const thumbImg = sourceEl.querySelector('img');
        if (thumbImg && thumbImg.src && thumbImg.naturalWidth) {
            overlayImg.src = thumbImg.src;

            const aspect = thumbImg.naturalWidth / thumbImg.naturalHeight;
            const screenAspect = window.innerWidth / window.innerHeight;

            if (aspect > screenAspect) {
                overlayImg.style.width = '85vw';
                overlayImg.style.height = 'auto';
            } else {
                overlayImg.style.width = 'auto';
                overlayImg.style.height = '85vh';
            }
        } else {
            overlayImg.removeAttribute('src');
            overlayImg.style.width = '';
            overlayImg.style.height = '';
        }

        overlayImg.alt = photo.title || 'Photo';

        const currentPhotoId = photo.id;
        overlayImg.dataset.currentId = currentPhotoId;

        if (targetSrc) {
            const highResImg = new Image();
            highResImg.onload = () => {
                if (overlayImg.dataset.currentId === currentPhotoId) {
                    overlayImg.src = targetSrc;
                    overlayImg.style.width = '';
                    overlayImg.style.height = '';
                }
            };
            highResImg.src = targetSrc;
        }

        if (photo.exif) {
            exifPanel.innerHTML = '';
            const is35mm = photo.category === '35mm';
            const fields = is35mm
                ? [
                    { label: 'Camera', value: photo.exif.camera },
                    { label: 'Lens', value: photo.exif.lens },
                    { label: 'Film', value: photo.exif.filmStock },
                ]
                : [
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

    function initAboutPage() {
        const aboutHero = document.querySelector('.about-hero');
        if (!aboutHero) return;

        const eyebrow = document.querySelector('.about-hero__eyebrow');
        const title = document.querySelector('.about-hero__title');
        const subtitle = document.querySelector('.about-hero__subtitle');
        const quote = document.querySelector('.about-content__quote');
        const body = document.querySelector('.about-content__body');
        const dividers = document.querySelectorAll('.about-divider');
        const socialLinks = document.querySelectorAll('.social-link');

        const tl = gsap.timeline({
            delay: 0.6,
            defaults: { ease: 'power3.out' },
        });

        if (eyebrow) {
            tl.to(eyebrow, {
                opacity: 1,
                y: 0,
                duration: 0.8,
            });
        }

        if (title) {
            splitTextIntoChars(title);
            const chars = title.querySelectorAll('.hero__char');
            tl.to(
                chars,
                {
                    y: 0,
                    duration: 1.15,
                    stagger: 0.018,
                    ease: 'power4.out',
                },
                '-=0.4'
            );
        }

        if (subtitle) {
            tl.to(
                subtitle,
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.9,
                },
                '-=0.6'
            );
        }

        if (quote) {
            gsap.to(quote, {
                opacity: 1,
                y: 0,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: quote,
                    start: 'top 75%',
                },
            });
        }

        if (body) {
            gsap.to(body, {
                opacity: 1,
                y: 0,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: body,
                    start: 'top 75%',
                },
            });
        }

        dividers.forEach((divider, idx) => {
            gsap.to(divider, {
                opacity: 0.5,
                scaleX: 1,
                duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: divider,
                    start: 'top 80%',
                },
            });
        });

        socialLinks.forEach((link, idx) => {
            gsap.from(link, {
                opacity: 0,
                y: 20,
                duration: 0.6,
                delay: idx * 0.1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: link,
                    start: 'top 85%',
                },
            });
        });
    }

    async function init() {
        gsap.registerPlugin(ScrollTrigger);

        initTheme();
        initLoader();
        initLenis();
        initSmoothAnchorLinks();

        const isAboutPage = document.querySelector('.about-hero');
        const isIndexPage = document.querySelector('.hero');

        if (isAboutPage) {
            initAboutPage();
            initFooter();
        } else if (isIndexPage) {
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
