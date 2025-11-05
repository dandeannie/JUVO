// Footer year
(function(){
    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
})();

(function(){
    var base = '';
    if (typeof window !== 'undefined') {
        if (window.API_BASE_URL) base = window.API_BASE_URL;
        else if (location && location.origin && location.origin.indexOf('file:') === 0) base = 'http://localhost:4000';
    }
    var orig = window.fetch ? window.fetch.bind(window) : null;
    if (orig) {
        window.fetch = function(input, init){
            if (typeof input === 'string' && input.charAt(0) === '/') {
                return orig((base || '') + input, init);
            }
            return orig(input, init);
        };
    }
})();

// Mobile nav toggle
(function(){
    var btn = document.querySelector('.hamburger-btn');
    var flyout = document.querySelector('.flyout');
    if (!btn || !flyout) return;

    btn.addEventListener('click', function(){
        var open = flyout.getAttribute('data-open') === 'true';
        flyout.style.display = open ? 'none' : 'block';
        flyout.setAttribute('data-open', open ? 'false' : 'true');
    });

    document.addEventListener('click', function(e){
        if (!flyout || !btn) return;
        if (btn.contains(e.target) || flyout.contains(e.target)) return;
        flyout.style.display = 'none';
        flyout.setAttribute('data-open', 'false');
    });
})();

// Pricing toggle, counters, contact enhancements, and card tilt
(function(){
    // Pricing toggle
    var billingBtns = Array.prototype.slice.call(document.querySelectorAll('.billing-btn'));
    var pricingGrid = document.getElementById('pricingGrid');
    function setBilling(mode){
        billingBtns.forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-billing')===mode); });
        if (!pricingGrid) return;
        Array.prototype.forEach.call(pricingGrid.querySelectorAll('.price-card'), function(card){
            var monthly = parseFloat(card.getAttribute('data-monthly')||0);
            var yearly = parseFloat(card.getAttribute('data-yearly')||Math.round(monthly*12*0.8));
            var amt = mode === 'yearly' ? yearly : monthly;
            var el = card.querySelector('.price-amount');
            if (el) {
                // animate small counter
                var start = parseInt(el.textContent.replace(/\D/g,'')) || 0;
                var end = Math.round(amt);
                var step = Math.max(1, Math.round((end - start) / 12));
                var cur = start;
                var iv = setInterval(function(){ cur += step; if ((step>0 && cur>=end) || (step<0 && cur<=end)) { cur = end; clearInterval(iv); } el.textContent = cur; }, 24);
            }
            // per label
            var per = card.querySelector('.per'); if (per) per.textContent = mode === 'yearly' ? ' / year' : ' / month';
        });
    }
    billingBtns.forEach(function(b){ b.addEventListener('click', function(){ setBilling(this.getAttribute('data-billing')); }); });
    // default
    setBilling('monthly');

    // Counters: animate when visible
    var counters = Array.prototype.slice.call(document.querySelectorAll('.counter .n'));
    if (counters.length) {
        if ('IntersectionObserver' in window) {
            var cobs = new IntersectionObserver(function(entries){
                entries.forEach(function(entry){
                    if (entry.isIntersecting) {
                        var el = entry.target; var target = parseInt(el.getAttribute('data-target')||0,10); var cur = 0; var step = Math.max(1, Math.floor(target / 40));
                        var t = setInterval(function(){ cur += step; if (cur >= target) { cur = target; clearInterval(t); } el.textContent = cur; }, 18);
                        cobs.unobserve(el);
                    }
                });
            }, { threshold: 0.3 });
            counters.forEach(function(c){ cobs.observe(c); });
        } else {
            counters.forEach(function(c){ c.textContent = c.getAttribute('data-target'); });
        }
    }

    // Contact form submit (POST to API)
    var contactForm = document.getElementById('contactForm');
    var contactMsg = document.getElementById('formMsg');
    if (contactForm && contactMsg) {
        contactForm.addEventListener('submit', async function(e){
            e.preventDefault();

            if (!contactForm.checkValidity()) {
                contactMsg.textContent = 'Please fill required fields.';
                contactMsg.style.color = 'crimson';
                contactMsg.style.opacity = '1';
                return;
            }

            var formData = new FormData(contactForm);
            var payload = {
                name: formData.get('name'),
                email: formData.get('email'),
                reason: formData.get('reason'),
                message: formData.get('message')
            };

            contactMsg.textContent = 'Sending...';
            contactMsg.style.color = '#164e63';
            contactMsg.style.opacity = '1';

            try {
                var res = await fetch('/contact/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                var json = await res.json();
                if (res.ok) {
                    contactMsg.textContent = json.message || 'Message sent — we will reach out soon!';
                    contactMsg.style.color = '#10b981';
                    contactForm.reset();
                    var map = document.getElementById('mapPlaceholder');
                    if (map) {
                        map.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)';
                        setTimeout(function(){ map.style.boxShadow = ''; }, 3200);
                    }
                    setTimeout(function(){ contactMsg.style.opacity = '0'; }, 5000);
                } else {
                    contactMsg.textContent = json.error || 'Failed to send message. Please try again.';
                    contactMsg.style.color = '#ef4444';
                }
            } catch (err) {
                console.error('Contact form error:', err);
                contactMsg.textContent = 'Network error. Please try again.';
                contactMsg.style.color = '#ef4444';
            }
        });
    }

    // Card tilt on mousemove for .roles .card
    var roleCards = Array.prototype.slice.call(document.querySelectorAll('.roles .card'));
    roleCards.forEach(function(card){
        var rect = null; function update(){ rect = card.getBoundingClientRect(); }
        update(); window.addEventListener('resize', update);
        card.addEventListener('mousemove', function(e){
            var x = (e.clientX - rect.left) / rect.width - 0.5; var y = (e.clientY - rect.top) / rect.height - 0.5;
            card.style.transform = 'translateY(-6px) rotateX(' + (-y*6) + 'deg) rotateY(' + (x*8) + 'deg)';
        });
        card.addEventListener('mouseleave', function(){ card.style.transform = ''; });
    });
})();

// Small performant parallax + 3D enhancements for hero and slogan
(function(){
    var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
    if (!scenes.length) return;

    // state for RAF
    var raf = null;
    var pointers = [];

    scenes.forEach(function(scene){
        var rect = null;
        var layers = Array.prototype.slice.call(scene.querySelectorAll('.parallax-layer, .slogan-word'));
        var mouse = { x: 0, y: 0, cx: 0, cy: 0 };

        function updateRect(){ rect = scene.getBoundingClientRect(); mouse.cx = rect.left + rect.width/2; mouse.cy = rect.top + rect.height/2; }
        updateRect();
        window.addEventListener('resize', updateRect);

        // pointer move
        function onMove(e){
            var x = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || mouse.cx;
            var y = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || mouse.cy;
            mouse.x = x; mouse.y = y;
            schedule();
        }

        scene.addEventListener('mousemove', onMove);
        scene.addEventListener('touchmove', onMove, { passive: true });

        // simple RAF scheduler
        var ticking = false;
        function schedule(){ if (!ticking) { ticking = true; raf = requestAnimationFrame(render); } }

        function render(){
            ticking = false;
            if (!rect) updateRect();
            var dx = (mouse.x - mouse.cx) / (rect.width||1);
            var dy = (mouse.y - mouse.cy) / (rect.height||1);

            layers.forEach(function(layer){
                var depth = parseFloat(layer.getAttribute('data-depth') || 0.12);
                // subtle x/y movement, and a small Z push via translateZ
                var tx = (dx * 40 * depth).toFixed(2);
                var ty = (dy * 30 * depth).toFixed(2);
                var tz = (depth * 40).toFixed(2);
                layer.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px, ' + tz + 'px)';
            });
        }

        // initial render
        render();

        // add scroll depth effect for layers inside this scene
        window.addEventListener('scroll', function(){
            var top = rect.top - window.innerHeight;
            layers.forEach(function(layer){
                var depth = parseFloat(layer.getAttribute('data-depth') || 0.12);
                var shift = (window.scrollY - rect.top) * -0.06 * depth;
                // combine translateY with existing transform (we'll set translate3d again)
                var baseX = 0, baseZ = (depth * 40);
                var tx = baseX, ty = shift.toFixed(2), tz = baseZ.toFixed(2);
                layer.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,' + tz + 'px)';
            });
        }, { passive: true });

        // Observe cards to add .visible class for 3D pop
        if ('IntersectionObserver' in window) {
            var cardObserver = new IntersectionObserver(function(entries){
                entries.forEach(function(entry){
                    if (entry.isIntersecting) entry.target.classList.add('visible');
                    else entry.target.classList.remove('visible');
                });
            }, { threshold: 0.14 });
            Array.prototype.forEach.call(document.querySelectorAll('.cardx, .card'), function(c){ cardObserver.observe(c); });
        }
    });
})();

// Theme toggle with persistence
(function(){
    var root = document.documentElement;
    var toggle = document.getElementById('themeToggle');
    var saved = localStorage.getItem('theme');
    if (saved === 'dark') { root.setAttribute('data-theme','dark'); }
    if (toggle) {
        function updateThemeUI(){
            var isDark = root.getAttribute('data-theme') === 'dark';
            toggle.innerHTML = '<span class="dot" style="background:' + (isDark ? '#111' : '#fff') + '"></span>' + (isDark ? 'Dark' : 'Light');
        }
        // initialize label
        updateThemeUI();
        toggle.addEventListener('click', function(){
            if (root.getAttribute('data-theme') === 'dark') {
                root.removeAttribute('data-theme');
                localStorage.setItem('theme','light');
            } else {
                root.setAttribute('data-theme','dark');
                localStorage.setItem('theme','dark');
            }
            updateThemeUI();
        });
    }
})();

// Tabs behavior
(function(){
    var tabs = document.querySelectorAll('.tab-btn');
    if (!tabs.length) return;
    var panels = {};
    document.querySelectorAll('.tab-panel').forEach(function(p){ panels[p.id.replace('panel-','')] = p; });
    function activate(id){
        tabs.forEach(function(t){ t.setAttribute('aria-selected', t.id === 'tab-' + id ? 'true' : 'false'); });
        Object.keys(panels).forEach(function(k){ panels[k].classList.toggle('active', k === id); });
    }
    tabs.forEach(function(btn){ btn.addEventListener('click', function(){ activate(this.id.replace('tab-','')); }); });
})();

// Generic reveal on scroll (excludes slogan words)
(function(){
    var elements = document.querySelectorAll('.reveal:not(.slogan-word)');
    if (!elements.length) return;
    if (!('IntersectionObserver' in window)) {
        elements.forEach(function(el){ el.classList.add('visible'); });
        return;
    }
    var observer = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
            if (entry.isIntersecting) entry.target.classList.add('visible');
            else entry.target.classList.remove('visible');
        });
    }, { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.2 });
    elements.forEach(function(el){ observer.observe(el); });
})();

// Slogan sequential show on scroll down, hide in reverse on scroll up
(function(){
    var section = document.getElementById('slogan');
    if (!section) return;
    var words = Array.prototype.slice.call(document.querySelectorAll('.slogan-word'));
    var lastY = window.scrollY;
    var direction = 'down';
    window.addEventListener('scroll', function(){
        var y = window.scrollY;
        direction = y > lastY ? 'down' : 'up';
        lastY = y;
    }, { passive: true });
    function showSequential(){
        words.forEach(function(w, i){ setTimeout(function(){ w.classList.add('visible'); }, i * 120); });
    }
    function hideSequentialReverse(){
        words.slice().reverse().forEach(function(w, i){ setTimeout(function(){ w.classList.remove('visible'); }, i * 120); });
    }
    words.forEach(function(w){ w.classList.remove('visible'); });
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function(entries){
            entries.forEach(function(entry){
                if (entry.isIntersecting && direction === 'down') { showSequential(); }
                if (!entry.isIntersecting && direction === 'up') { hideSequentialReverse(); }
            });
        }, { root: null, threshold: 0.15 });
        io.observe(section);
    } else { setTimeout(showSequential, 200); }
})();


// Three.js particles for About section (optional)
(function(){
    var canvas = document.getElementById('aboutParticles');
    if (!canvas || !window.THREE) return;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.z = 60;
    var geometry = new THREE.BufferGeometry();
    var count = 300;
    var positions = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
        positions[i*3] = (Math.random() - 0.5) * 160;
        positions[i*3+1] = (Math.random() - 0.5) * 90;
        positions[i*3+2] = (Math.random() - 0.5) * 60;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var material = new THREE.PointsMaterial({ color: 0x2a6e4d, size: 1.8, sizeAttenuation: true, transparent: true, opacity: 0.7 });
    var points = new THREE.Points(geometry, material);
    scene.add(points);
    function resize(){
        var holder = canvas.parentElement;
        var w = holder.clientWidth; var h = holder.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();
    function animate(){ requestAnimationFrame(animate); points.rotation.y += 0.0008; points.rotation.x += 0.0004; renderer.render(scene, camera); }
    animate();
})();

(function(){
    // Page fade-in on load
    document.body.classList.add('page-fade-enter');
    requestAnimationFrame(function(){
        document.body.classList.add('page-fade-active');
        document.body.classList.add('page-fade-enter');
        // Activate transition end state shortly after frame
        setTimeout(function(){ document.body.classList.remove('page-fade-enter'); }, 0);
    });

    // Intercept auth tab navigations for smooth fade-out
    function smoothNavigate(anchor){
        anchor.addEventListener('click', function(e){
            var href = anchor.getAttribute('href');
            if (!href) return;
            if (href.indexOf('login.html') !== -1 || href.indexOf('signup.html') !== -1) {
                e.preventDefault();
                document.body.classList.remove('page-fade-active');
                document.body.classList.add('page-fade-exit');
                // trigger transition
                requestAnimationFrame(function(){
                    document.body.classList.add('page-fade-active');
                    setTimeout(function(){ window.location.href = href; }, 240);
                });
            }
        });
    }
    document.querySelectorAll('.auth-tabs a').forEach(smoothNavigate);
})();

// Auth helpers: support refresh-token flow and graceful loading placeholders
(function(){
    // Try to get current user; if access token expired, attempt to refresh using stored refreshToken
    async function getCurrentUser(){
        const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        const isMemberPage = path === 'member.html';
        const isWorkerPage = path === 'worker.html';
        // helper to fetch /auth/me with current token
        async function fetchMe(){
            const token = localStorage.getItem('token');
            if (!token) throw new Error('no_token');
            const res = await fetch('/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) {
                const body = await res.json().catch(()=>({}));
                const err = body && body.error ? body.error : 'unauthorized';
                const e = new Error(err); e.status = res.status; throw e;
            }
            return res.json();
        }

        try {
            // first attempt with existing access token
            const user = await fetchMe();
            return user;
        } catch (err) {
            // try server-side refresh via httpOnly cookie
            try {
                const r = await fetch('/auth/refresh', { method: 'POST', credentials: 'include' });
                if (!r.ok) throw new Error('refresh_failed');
                const j = await r.json();
                if (j && j.token) {
                    localStorage.setItem('token', j.token);
                    if (j.id) localStorage.setItem('userId', j.id);
                    if (j.accountType) localStorage.setItem('accountType', j.accountType);
                }
                // retry /auth/me
                const user2 = await fetchMe();
                return user2;
            } catch (e2) {
                // refresh failed — clear tokens and rethrow
                localStorage.removeItem('token'); localStorage.removeItem('userId'); localStorage.removeItem('accountType');
                throw e2;
            }
        }
    }

    // Expose global helper
    window.getCurrentUser = getCurrentUser;

    // If we're on a protected page, attempt to fetch and redirect accordingly; show a loading placeholder by adding .auth-loading to body
    (async function ensure(){
        const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        const isMemberPage = path === 'member.html';
        const isWorkerPage = path === 'worker.html';
        if (!(isMemberPage || isWorkerPage)) return;
        try {
            document.body.classList.add('auth-loading');
            const user = await getCurrentUser();
            // redirect if wrong page
            if (isMemberPage && user.accountType !== 'member') { window.location.replace('worker.html'); return; }
            if (isWorkerPage && user.accountType === 'member') { window.location.replace('member.html'); return; }
        } catch (e) {
            // Not authenticated — go to login
            window.location.replace('login.html');
        } finally {
            document.body.classList.remove('auth-loading');
        }
    })();
})();

// Global logout wiring so it works from any page
(function(){
    function wireLogout(el){
        if (!el) return;
        el.addEventListener('click', function(e){
            e.preventDefault();
            try { localStorage.removeItem('userId'); localStorage.removeItem('token'); localStorage.removeItem('accountType'); } catch (e) {}
            document.body.classList.remove('page-fade-active');
            document.body.classList.add('page-fade-exit');
            requestAnimationFrame(function(){
                document.body.classList.add('page-fade-active');
                setTimeout(function(){ window.location.href = 'login.html'; }, 240);
            });
        });
    }
    wireLogout(document.getElementById('logoutTop'));
    wireLogout(document.getElementById('logoutMenu'));
})();

(function(){
    // Login form: post credentials to /auth/login
    var form = document.getElementById('loginForm');
    if (!form) return;
    var optionBtns = form.querySelectorAll('.option-btn');
    var emailInput = form.querySelector('input[name="email"]');
    var phoneInput = form.querySelector('input[name="phone"]');
    var passwordInput = form.querySelector('input[name="password"]');
    var msg = document.getElementById('loginMsg');

    function setMode(mode){
        var isEmail = mode === 'email';
        optionBtns.forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-mode') === mode); });
        emailInput.style.display = isEmail ? '' : 'none';
        phoneInput.style.display = isEmail ? 'none' : '';
        emailInput.required = isEmail;
        phoneInput.required = !isEmail;
        if (isEmail) { phoneInput.value = ''; } else { emailInput.value = ''; }
    }

    optionBtns.forEach(function(b){ b.addEventListener('click', function(){ setMode(this.getAttribute('data-mode')); }); });
    setMode('email');

    form.addEventListener('submit', function(e){
        e.preventDefault();
        msg.textContent = '';
        var usingEmail = emailInput.style.display !== 'none';
        if (!form.checkValidity()) { msg.textContent = 'Please enter ' + (usingEmail ? 'email' : 'phone') + ' and password.'; msg.style.color = 'crimson'; return; }
        var payload = { password: passwordInput.value };
        if (usingEmail) payload.email = emailInput.value.trim(); else payload.phone = phoneInput.value.trim();

        msg.textContent = 'Logging in...'; msg.style.color = 'green';

        fetch('/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }).then(function(res){
            if (!res.ok) return res.json().then(function(j){ throw new Error(j && j.error ? j.error : 'Login failed'); });
            return res.json();
        }).then(function(json){
            if (json && json.id && json.token) {
                try {
                    localStorage.setItem('userId', json.id);
                    localStorage.setItem('token', json.token);
                    localStorage.setItem('accountType', json.accountType || 'member');

                    if (json.username) localStorage.setItem('username', json.username);
                    else localStorage.removeItem('username');

                    if (json.email) localStorage.setItem('email', json.email);
                    else localStorage.removeItem('email');

                    if (json.phone) localStorage.setItem('phone', json.phone);
                    else localStorage.removeItem('phone');

                    if (json.refreshToken) localStorage.setItem('refreshToken', json.refreshToken);
                    else localStorage.removeItem('refreshToken');
                } catch (e) {}
                // Redirect based on account type
                var dest = (json.accountType === 'member') ? 'member.html' : 'worker.html';
                document.body.classList.remove('page-fade-active');
                document.body.classList.add('page-fade-exit');
                requestAnimationFrame(function(){
                    document.body.classList.add('page-fade-active');
                    setTimeout(function(){ window.location.href = dest; }, 220);
                });
            } else {
                throw new Error('invalid_response');
            }
        }).catch(function(err){
            msg.textContent = err.message || 'Login failed'; msg.style.color = 'crimson';
        });
    });
})();


// Signup handler: if the signup form exists, handle submission and POST to /auth/signup
(function(){
    var form = document.getElementById('signupForm');
    if (!form) return;
    var msg = document.getElementById('signupMsg');
    form.addEventListener('submit', function(e){
        e.preventDefault();
        msg.textContent = '';
        if (!form.checkValidity()) { msg.textContent = 'Please complete all required fields.'; msg.style.color = 'crimson'; return; }
        var pw = form.querySelector('input[name="password"]').value;
        var cf = form.querySelector('input[name="confirm"]').value;
        if (pw !== cf) { msg.textContent = 'Passwords do not match.'; msg.style.color = 'crimson'; return; }

    var email = (form.querySelector('input[name="email"]') || {}).value || null;
    var phone = (form.querySelector('input[name="phone"]') || {}).value || null;
    var accountType = (form.querySelector('select[name="accountType"]') || {}).value || null;
    var username = (form.querySelector('input[name="username"]') || {}).value || null;
    var address = (form.querySelector('input[name="address"]') || {}).value || null;
    var dob = (form.querySelector('input[name="dob"]') || {}).value || null;
    var city = (form.querySelector('input[name="city"]') || {}).value || null;

    var payload = { password: pw };
    if (email) payload.email = email.trim();
    if (phone) payload.phone = phone.trim();
    if (accountType) payload.accountType = accountType;
    if (username) payload.username = username.trim();
    if (address) payload.address = address.trim();
    if (dob) payload.dob = dob;
    if (city) payload.city = city.trim();

        msg.textContent = 'Creating account...'; msg.style.color = 'green';

        fetch('/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function(res){
            if (res.status === 201) return res.json();
            return res.json().then(function(j){ throw new Error(j && j.error ? j.error : 'Signup failed'); });
        }).then(function(json){
            if (json && json.id && json.token) {
                try {
                    localStorage.setItem('userId', json.id);
                    localStorage.setItem('token', json.token);
                    localStorage.setItem('accountType', json.accountType || 'member');
                    if (json.username) localStorage.setItem('username', json.username);
                    else localStorage.removeItem('username');

                    if (json.email) localStorage.setItem('email', json.email);
                    else localStorage.removeItem('email');

                    if (json.phone) localStorage.setItem('phone', json.phone);
                    else localStorage.removeItem('phone');

                    if (json.address) localStorage.setItem('address', json.address);
                    else localStorage.removeItem('address');

                    if (json.homeAddress) localStorage.setItem('homeAddress', json.homeAddress);
                    else localStorage.removeItem('homeAddress');

                    if (json.workAddress) localStorage.setItem('workAddress', json.workAddress);
                    else localStorage.removeItem('workAddress');

                    if (json.location) localStorage.setItem('location', json.location);
                    else localStorage.removeItem('location');

                    if (json.refreshToken) localStorage.setItem('refreshToken', json.refreshToken);
                    else localStorage.removeItem('refreshToken');
                } catch (e) {}
                // Redirect based on accountType
                var dest = (json.accountType === 'member') ? 'member.html' : 'worker.html';
                document.body.classList.remove('page-fade-active');
                document.body.classList.add('page-fade-exit');
                requestAnimationFrame(function(){
                    document.body.classList.add('page-fade-active');
                    setTimeout(function(){ window.location.href = dest; }, 220);
                });
            } else {
                throw new Error('invalid_response');
            }
        }).catch(function(err){
            msg.textContent = err.message || 'Signup failed'; msg.style.color = 'crimson';
        });
    });
})();

// Global JUVO+ modal wiring (resilient, works if inline script fails)
(function(){
    var modal = document.getElementById('plusModal');
    var openBtn = document.getElementById('openPlus');
    if (!modal || !openBtn) return;

    var closeBtn = document.getElementById('closePlus');
    var priceShow = document.getElementById('priceShow');
    var buyBtn = document.getElementById('buyBtn');

    function openPlus(){
        modal.classList.add('open');
        modal.setAttribute('aria-hidden','false');
    }
    function closePlus(){
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden','true');
    }

    openBtn.addEventListener('click', function(e){ e.preventDefault(); openPlus(); });
    if (closeBtn) closeBtn.addEventListener('click', function(e){ e.preventDefault(); closePlus(); });
    modal.addEventListener('click', function(e){ if (e.target === modal) closePlus(); });

    // Plan selection
    Array.prototype.forEach.call(modal.querySelectorAll('.plan'), function(p){
        p.addEventListener('click', function(){
            Array.prototype.forEach.call(modal.querySelectorAll('.plan'), function(x){ x.classList.remove('active'); });
            p.classList.add('active');
            if (priceShow) priceShow.textContent = '₹' + p.getAttribute('data-price');
        });
    });

    if (buyBtn) buyBtn.addEventListener('click', function(){
        // Find selected plan (element with .plan.active) or first plan
        var selected = modal.querySelector('.plan.active') || modal.querySelector('.plan');
        var plan = selected ? (selected.getAttribute('data-plan') || 'monthly') : 'monthly';
        closePlus();
        var toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = 'Preparing payment...';
            toast.classList.add('show');
            clearTimeout(window.__tTo);
            window.__tTo = setTimeout(function(){ toast.classList.remove('show'); }, 1600);
        }

        // Call payments API to create a checkout session
        fetch('/payments/create-checkout-session', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: plan })
        }).then(function(res){
            return res.json().then(function(j){ if (!res.ok) throw j; return j; });
        }).then(function(json){
            if (json && json.url) {
                // redirect the browser to hosted checkout
                window.location.href = json.url;
            } else if (json && json.id) {
                // fallback: if Stripe client is available we could redirect
                window.location.href = '/member.html?plus=started';
            } else {
                throw new Error('unable_to_start_payment');
            }
        }).catch(function(err){
            var t = document.getElementById('toast');
            if (t) {
                t.textContent = 'Payment error: ' + (err && err.error ? err.error : (err.message || 'unknown'));
                t.classList.add('show');
                clearTimeout(window.__tTo);
                window.__tTo = setTimeout(function(){ t.classList.remove('show'); }, 2600);
            }
            console.error('[payments] error', err);
        });
        
    });
    
})();

