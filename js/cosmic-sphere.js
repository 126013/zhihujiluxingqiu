/* =========================================================================
 * Cosmic Sphere — 可交互发光 3D 星球模块
 * 基于 Three.js，使用程序化 ShaderMaterial 生成云雾与色带
 * ========================================================================= */

(function (global) {
  'use strict';

  // —— 质量配置 ——
  const QUALITY_PRESETS = {
    high:   { segments: 96, rings: 64, starCount: 800,  pixelRatio: 2 },
    medium: { segments: 64, rings: 48, starCount: 500,  pixelRatio: 1.5 },
    low:    { segments: 48, rings: 32, starCount: 250,  pixelRatio: 1 }
  };

  function detectQuality() {
    if (typeof window === 'undefined') return 'medium';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) return 'low';
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    if (cores >= 8 && mem >= 8) return 'high';
    if (cores >= 4 && mem >= 4) return 'medium';
    return 'low';
  }

  // —— 默认配置 ——
  const DEFAULTS = {
    radius: 5.2,
    quality: 'auto',
    colors: {
      colorA: '#ff8c5a',   // 橙色（亮面主色）
      colorB: '#ffb388',   // 珊瑚色
      colorC: '#e89ab8',   // 粉色
      colorD: '#9d70c0',   // 紫色（暗面）
      rimColor: '#ffc88c', // 边缘辉光
      cloudColor: '#fff0dc' // 云层亮色
    },
    light: {
      direction: { x: -0.7, y: 0.5, z: 0.5 }
    },
    rotation: {
      autoSpeed: 0.15,      // rad/s
      dragSpeed: 0.8,
      dampFactor: 0.06
    },
    interaction: {
      enableDrag: true,
      enableZoom: true,
      minDistance: 10,
      maxDistance: 60
    },
    atmosphere: {
      enabled: true,
      scale: 1.07,
      intensity: 0.9
    },
    glow: {
      enabled: true,
      layers: 3,
      baseScale: 2.6
    },
    stars: {
      enabled: true,
      count: 'auto'
    },
    reducedMotion: 'auto',  // auto | force-on | force-off
    tilt: 0.26              // 球体倾斜角（弧度），约 15°
  };

  // —— Shader 代码 ——
  const VERTEX_SHADER = `
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec2 vUv;
    void main(){
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      vec4 mvPos = viewMatrix * modelMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const FRAGMENT_SHADER = `
    uniform float uTime;
    uniform vec3 uLightDir;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;
    uniform vec3 uColorD;
    uniform vec3 uRimColor;
    uniform vec3 uCloudColor;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec2 vUv;

    // —— 3D 哈希噪声 ——
    vec3 hash3(vec3 p){
      p = vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
      );
      return fract(sin(p) * 43758.5453123);
    }

    float noise3(vec3 p){
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float n000 = dot(hash3(i + vec3(0,0,0)) - 0.5, f - vec3(0,0,0));
      float n100 = dot(hash3(i + vec3(1,0,0)) - 0.5, f - vec3(1,0,0));
      float n010 = dot(hash3(i + vec3(0,1,0)) - 0.5, f - vec3(0,1,0));
      float n110 = dot(hash3(i + vec3(1,1,0)) - 0.5, f - vec3(1,1,0));
      float n001 = dot(hash3(i + vec3(0,0,1)) - 0.5, f - vec3(0,0,1));
      float n101 = dot(hash3(i + vec3(1,0,1)) - 0.5, f - vec3(1,0,1));
      float n011 = dot(hash3(i + vec3(0,1,1)) - 0.5, f - vec3(0,1,1));
      float n111 = dot(hash3(i + vec3(1,1,1)) - 0.5, f - vec3(1,1,1));
      float nx00 = mix(n000, n100, f.x);
      float nx10 = mix(n010, n110, f.x);
      float nx01 = mix(n001, n101, f.x);
      float nx11 = mix(n011, n111, f.x);
      float nxy0 = mix(nx00, nx10, f.y);
      float nxy1 = mix(nx01, nx11, f.y);
      return mix(nxy0, nxy1, f.z) * 2.0;
    }

    float fbm(vec3 p){
      float v = 0.0, a = 0.5;
      for(int i = 0; i < 5; i++){
        v += a * noise3(p);
        p *= 2.02;
        a *= 0.5;
      }
      return v;
    }

    void main(){
      vec3 N = normalize(vNormal);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(vViewDir);
      vec3 pos = normalize(vWorldPos);

      // —— 多层噪声 ——
      float cloudLow  = fbm(pos * 1.4 + vec3(0.0, 0.0, uTime * 0.015));
      float cloudMid  = fbm(pos * 2.8 - vec3(uTime * 0.012, 0.0, 0.0));
      float cloudHigh = fbm(pos * 5.6 + vec3(0.0, uTime * 0.01, 0.0));

      // —— 基于光照方向的颜色过渡（而非简单 x 坐标）——
      float lightFactor = dot(pos, L) * 0.5 + 0.5; // 0(暗) ~ 1(亮)
      lightFactor += cloudLow * 0.25;
      lightFactor = clamp(lightFactor, 0.0, 1.0);

      // 四色渐变：橙 → 珊瑚 → 粉 → 紫
      vec3 baseCol;
      if(lightFactor < 0.3){
        baseCol = mix(uColorD, uColorC, lightFactor / 0.3);
      } else if(lightFactor < 0.6){
        baseCol = mix(uColorC, uColorB, (lightFactor - 0.3) / 0.3);
      } else {
        baseCol = mix(uColorB, uColorA, (lightFactor - 0.6) / 0.4);
      }

      // —— 云层：亮云 + 暗云，形成体积感 ——
      float cloudBrightMask = smoothstep(0.1, 0.55, cloudLow);
      vec3 brightCloudCol = mix(uCloudColor, uColorB, cloudMid * 0.5 + 0.5);
      baseCol = mix(baseCol, brightCloudCol, cloudBrightMask * 0.55);

      float cloudDarkMask = smoothstep(0.0, -0.35, cloudMid * 1.3);
      baseCol = mix(baseCol, baseCol * 0.35, cloudDarkMask * 0.5);

      // 大型云团结构
      float bigCloud = fbm(pos * 0.7 + vec3(3.0, 1.0, 2.0));
      float bigCloudMask = smoothstep(0.25, 0.6, bigCloud);
      baseCol = mix(baseCol, baseCol * 0.5, bigCloudMask * 0.35);

      // —— 星尘 / 城市光点 ——
      float dustNoise = fbm(pos * 10.0);
      float dustMask = smoothstep(0.52, 0.68, dustNoise);
      // 光点偏向明暗交界区域
      float dustBias = smoothstep(0.1, 0.55, lightFactor) * (1.0 - smoothstep(0.55, 0.9, lightFactor));
      dustMask *= dustBias * 1.5;
      vec3 dustColor = mix(vec3(1.0, 0.95, 0.7), vec3(1.0, 0.78, 0.45), dustNoise);
      baseCol += dustColor * dustMask * 2.0;

      // 额外的微小亮点
      float sparkleNoise = noise3(pos * 30.0 + vec3(uTime * 0.1));
      float sparkleMask = smoothstep(0.82, 0.92, sparkleNoise);
      baseCol += vec3(1.0, 0.92, 0.75) * sparkleMask * 0.6 * dustBias;

      // —— 漫反射光照（半兰伯特，柔和）——
      float diff = max(dot(N, L), 0.0);
      diff = diff * 0.5 + 0.5;
      baseCol *= 0.55 + diff * 0.65;

      // —— Fresnel 边缘辉光 ——
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);
      vec3 rimCol = mix(uRimColor, uColorA, fresnel * 0.5);
      baseCol += rimCol * fresnel * 1.0;

      // —— 轻微颗粒感 ——
      float grain = noise3(pos * 70.0 + uTime * 0.01) * 0.02;
      baseCol += grain;

      gl_FragColor = vec4(baseCol, 1.0);
    }
  `;

  const ATMOSPHERE_VERT = `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main(){
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPos = viewMatrix * modelMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const ATMOSPHERE_FRAG = `
    uniform vec3 uRimColor;
    uniform vec3 uColorA;
    uniform float uIntensity;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main(){
      float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 3.2);
      vec3 col = mix(uRimColor, uColorA, fresnel);
      gl_FragColor = vec4(col, fresnel * uIntensity);
    }
  `;

  // —— WebGL 检测 ——
  function hasWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  // —— 减少动效检测 ——
  function prefersReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // —— 创建辉光 Sprite 纹理 ——
  function makeGlowTexture(colorStr) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    const c = hexToRgb(colorStr);
    grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.95)`);
    grad.addColorStop(0.25, `rgba(${c.r},${c.g},${c.b},0.55)`);
    grad.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},0.22)`);
    grad.addColorStop(0.75, `rgba(${c.r},${c.g},${c.b},0.07)`);
    grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 200, b: 140 };
  }

  // —— 主函数 ——
  function createCosmicSphere(container, options) {
    // 合并配置
    const opts = deepMerge({}, DEFAULTS, options || {});

    // 质量档位
    let qualityKey = opts.quality;
    if (qualityKey === 'auto') qualityKey = detectQuality();
    const quality = QUALITY_PRESETS[qualityKey] || QUALITY_PRESETS.medium;

    // 减少动效
    const reducedMotion = opts.reducedMotion === 'force-on'
      ? true
      : opts.reducedMotion === 'force-off'
        ? false
        : prefersReducedMotion();

    // WebGL 检测
    if (!hasWebGL() || typeof THREE === 'undefined') {
      return createFallback(container, opts);
    }

    // —— 场景基础 ——
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
    camera.position.set(0, 0, 22);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    // ARIA 标签
    if (!container.getAttribute('aria-label')) {
      container.setAttribute('aria-label', '交互式 3D 星球，可拖拽旋转，滚轮缩放');
    }
    container.setAttribute('role', 'application');

    // —— 星球组 ——
    const planetGroup = new THREE.Group();
    planetGroup.rotation.z = opts.tilt;
    scene.add(planetGroup);

    // —— 辉光层（Sprite）——
    const glowSprites = [];
    if (opts.glow.enabled) {
      const glowTex = makeGlowTexture(opts.colors.rimColor);
      for (let i = 0; i < opts.glow.layers; i++) {
        const scale = opts.radius * opts.glow.baseScale * (1 + i * 0.4);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 1 - i * 0.3
        }));
        sprite.scale.set(scale, scale, 1);
        planetGroup.add(sprite);
        glowSprites.push(sprite);
      }
    }

    // —— 星球主体 ——
    const uniforms = {
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(
        opts.light.direction.x,
        opts.light.direction.y,
        opts.light.direction.z
      ).normalize() },
      uColorA: { value: new THREE.Color(opts.colors.colorA) },
      uColorB: { value: new THREE.Color(opts.colors.colorB) },
      uColorC: { value: new THREE.Color(opts.colors.colorC) },
      uColorD: { value: new THREE.Color(opts.colors.colorD) },
      uRimColor: { value: new THREE.Color(opts.colors.rimColor) },
      uCloudColor: { value: new THREE.Color(opts.colors.cloudColor) }
    };

    const planetMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER
    });

    const planetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(opts.radius, quality.segments, quality.rings),
      planetMaterial
    );
    planetGroup.add(planetMesh);

    // —— 大气层辉光 ——
    let atmosphereMesh = null;
    if (opts.atmosphere.enabled) {
      atmosphereMesh = new THREE.Mesh(
        new THREE.SphereGeometry(
          opts.radius * opts.atmosphere.scale,
          Math.floor(quality.segments * 0.7),
          Math.floor(quality.rings * 0.7)
        ),
        new THREE.ShaderMaterial({
          uniforms: {
            uRimColor: { value: new THREE.Color(opts.colors.rimColor) },
            uColorA: { value: new THREE.Color(opts.colors.colorA) },
            uIntensity: { value: opts.atmosphere.intensity }
          },
          vertexShader: ATMOSPHERE_VERT,
          fragmentShader: ATMOSPHERE_FRAG,
          transparent: true,
          side: THREE.BackSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      planetGroup.add(atmosphereMesh);
    }

    // —— 星空粒子 ——
    let starPoints = null;
    if (opts.stars.enabled) {
      const starCount = opts.stars.count === 'auto' ? quality.starCount : opts.stars.count;
      const positions = new Float32Array(starCount * 3);
      const colors = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 30 + Math.random() * 60;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        const c = Math.random();
        if (c < 0.6) {
          colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0.85 + Math.random() * 0.15;
        } else if (c < 0.8) {
          colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1.0;
        } else {
          colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 0.7;
        }
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const starMat = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      starPoints = new THREE.Points(starGeo, starMat);
      scene.add(starPoints);
    }

    // —— 交互控制 ——
    const state = {
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      rotationY: 0,
      rotationX: 0,
      targetRotationY: 0,
      targetRotationX: 0,
      velocityY: 0,
      velocityX: 0,
      autoRotationSpeed: reducedMotion ? 0 : opts.rotation.autoSpeed,
      cameraDistance: 22,
      targetCameraDistance: 22,
      pinchStartDist: 0,
      pinchStartZoom: 22
    };

    function onPointerDown(e) {
      if (!opts.interaction.enableDrag) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      state.isDragging = true;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      state.velocityY = 0;
      state.velocityX = 0;
      container.classList.add('cs-dragging');
      container.setPointerCapture?.(e.pointerId);
    }

    function onPointerMove(e) {
      if (!state.isDragging) return;
      const dx = e.clientX - state.dragStartX;
      const dy = e.clientY - state.dragStartY;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;

      const el = renderer.domElement;
      const rotSpeed = opts.rotation.dragSpeed;
      state.targetRotationY -= (2 * Math.PI * dx / el.clientWidth) * rotSpeed;
      state.targetRotationX -= (2 * Math.PI * dy / el.clientHeight) * rotSpeed;
      // 限制垂直旋转
      const maxTilt = Math.PI / 3;
      state.targetRotationX = Math.max(-maxTilt, Math.min(maxTilt, state.targetRotationX));

      state.velocityY = -dx * rotSpeed * 0.02;
      state.velocityX = -dy * rotSpeed * 0.02;
    }

    function onPointerUp(e) {
      if (!state.isDragging) return;
      state.isDragging = false;
      container.classList.remove('cs-dragging');
      try { container.releasePointerCapture?.(e.pointerId); } catch (_) {}
    }

    function onWheel(e) {
      if (!opts.interaction.enableZoom) return;
      // 仅在悬停时响应
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      state.targetCameraDistance *= delta;
      state.targetCameraDistance = Math.max(
        opts.interaction.minDistance,
        Math.min(opts.interaction.maxDistance, state.targetCameraDistance)
      );
    }

    // 触摸双指缩放
    let activePointers = new Map();
    function onTouchStart(e) {
      if (e.touches && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        state.pinchStartDist = Math.sqrt(dx * dx + dy * dy);
        state.pinchStartZoom = state.targetCameraDistance;
      }
    }
    function onTouchMove(e) {
      if (e.touches && e.touches.length === 2 && opts.interaction.enableZoom) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ratio = state.pinchStartDist / dist;
        state.targetCameraDistance = Math.max(
          opts.interaction.minDistance,
          Math.min(opts.interaction.maxDistance, state.pinchStartZoom * ratio)
        );
      }
    }

    if (opts.interaction.enableDrag) {
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }
    if (opts.interaction.enableZoom) {
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
      renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
      renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    }

    // —— Resize 观察 ——
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(function () {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w <= 0 || h <= 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      ro.observe(container);
    }

    // —— 页面可见性 ——
    let isVisible = true;
    function onVisibilityChange() {
      isVisible = !document.hidden;
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // —— 动画循环 ——
    let animId = null;
    let lastTime = performance.now();

    function animate(now) {
      animId = requestAnimationFrame(animate);
      if (!isVisible) { lastTime = now; return; }

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const t = now / 1000;

      // 自动旋转
      if (!reducedMotion && !state.isDragging) {
        state.targetRotationY += state.autoRotationSpeed * dt;
      }

      // 阻尼平滑
      const damp = opts.rotation.dampFactor;
      state.rotationY += (state.targetRotationY - state.rotationY) * damp;
      state.rotationX += (state.targetRotationX - state.rotationX) * damp;

      // 松手后恢复自动旋转动量
      if (!state.isDragging && !reducedMotion) {
        state.velocityY *= (1 - damp * 2);
        state.velocityX *= (1 - damp * 2);
        state.targetRotationY += state.velocityY * dt;
        state.targetRotationX += state.velocityX * dt;
      }

      planetMesh.rotation.y = state.rotationY;
      planetMesh.rotation.x = state.rotationX;
      if (atmosphereMesh) {
        atmosphereMesh.rotation.y = state.rotationY;
        atmosphereMesh.rotation.x = state.rotationX;
      }

      // 相机缩放
      state.cameraDistance += (state.targetCameraDistance - state.cameraDistance) * 0.1;
      camera.position.z = state.cameraDistance;

      // Shader 时间
      uniforms.uTime.value = reducedMotion ? 0 : t;

      // 辉光呼吸
      if (!reducedMotion && glowSprites.length > 0) {
        const pulse = 0.75 + Math.sin(t * 0.6) * 0.15;
        glowSprites.forEach(function (sp, idx) {
          sp.material.opacity = (1 - idx * 0.3) * pulse;
        });
      }

      // 星空缓慢旋转
      if (!reducedMotion && starPoints) {
        starPoints.rotation.y -= dt * 0.015;
        starPoints.rotation.x += dt * 0.005;
      }

      renderer.render(scene, camera);
    }

    animId = requestAnimationFrame(animate);

    // —— 公共 API ——
    return {
      scene: scene,
      camera: camera,
      renderer: renderer,
      planetMesh: planetMesh,
      planetGroup: planetGroup,
      uniforms: uniforms,

      setColors: function (colors) {
        if (colors.colorA) uniforms.uColorA.value.set(colors.colorA);
        if (colors.colorB) uniforms.uColorB.value.set(colors.colorB);
        if (colors.colorC) uniforms.uColorC.value.set(colors.colorC);
        if (colors.colorD) uniforms.uColorD.value.set(colors.colorD);
        if (colors.rimColor) uniforms.uRimColor.value.set(colors.rimColor);
        if (colors.cloudColor) uniforms.uCloudColor.value.set(colors.cloudColor);
      },

      setRotationSpeed: function (speed) {
        state.autoRotationSpeed = reducedMotion ? 0 : speed;
      },

      setDistance: function (dist) {
        state.targetCameraDistance = Math.max(
          opts.interaction.minDistance,
          Math.min(opts.interaction.maxDistance, dist)
        );
      },

      dispose: function () {
        if (animId) cancelAnimationFrame(animId);
        if (ro) ro.disconnect();
        document.removeEventListener('visibilitychange', onVisibilityChange);

        if (opts.interaction.enableDrag) {
          renderer.domElement.removeEventListener('pointerdown', onPointerDown);
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
        }
        if (opts.interaction.enableZoom) {
          renderer.domElement.removeEventListener('wheel', onWheel);
          renderer.domElement.removeEventListener('touchstart', onTouchStart);
          renderer.domElement.removeEventListener('touchmove', onTouchMove);
        }

        // 释放资源
        scene.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(function (m) { m.dispose(); });
            } else {
              obj.material.dispose();
            }
          }
          if (obj.material && obj.material.map) obj.material.map.dispose();
        });

        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }

  // —— 静态回退 ——
  function createFallback(container, opts) {
    container.classList.add('is-fallback');
    const sphere = document.createElement('div');
    sphere.style.cssText = [
      'position:absolute',
      'top:50%', 'left:50%',
      'width:70%', 'height:70%',
      'transform:translate(-50%,-50%)',
      'border-radius:50%',
      'background:radial-gradient(circle at 30% 30%, ' + opts.colors.colorB + ' 0%, ' +
        opts.colors.colorA + ' 25%, ' +
        opts.colors.colorC + ' 55%, ' +
        opts.colors.colorD + ' 85%)',
      'box-shadow:0 0 60px ' + opts.colors.rimColor + '60, 0 0 120px ' + opts.colors.colorA + '30',
      'pointer-events:none'
    ].join(';');
    container.appendChild(sphere);
    container.setAttribute('aria-label', '星球视觉图');

    return {
      dispose: function () {
        container.classList.remove('is-fallback');
        if (sphere.parentNode) sphere.parentNode.removeChild(sphere);
      }
    };
  }

  // —— 工具：深度合并 ——
  function deepMerge(target) {
    for (let i = 1; i < arguments.length; i++) {
      const source = arguments[i];
      if (!source) continue;
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = target[key] || {};
            deepMerge(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      }
    }
    return target;
  }

  // —— 导出 ——
  global.createCosmicSphere = createCosmicSphere;

})(typeof window !== 'undefined' ? window : this);
