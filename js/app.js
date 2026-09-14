/* =========================================================================
 * 星愈·双盲棱镜  共享应用逻辑
 * —— 粒子层 / 公共组件 / 路由辅助 / Toast / Modal
 * ========================================================================= */

window.StarhealApp = (function () {
  'use strict';

  /* —— 公共背景注入 —— */
  function injectBackground() {
    if (document.querySelector('.cosmos-bg')) return;
    const bg = document.createElement('div');
    bg.className = 'cosmos-bg';
    document.body.appendChild(bg);

    const particles = document.createElement('div');
    particles.className = 'particles';
    const count = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 18;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      const size = Math.random() * 3 + 1;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + '%';
      p.style.bottom = '-10px';
      p.style.animationDuration = (Math.random() * 20 + 18) + 's';
      p.style.animationDelay = (-Math.random() * 20) + 's';
      p.style.opacity = (Math.random() * 0.5 + 0.3).toString();
      particles.appendChild(p);
    }
    document.body.appendChild(particles);
  }

  /* —— Toast —— */
  let toastTimer = null;
  function toast(msg, opts) {
    opts = opts || {};
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    if (opts.tone === 'danger') { t.style.borderColor = 'rgba(220,80,100,0.4)'; t.style.color = '#ffb8c2'; }
    if (opts.tone === 'success') { t.style.borderColor = 'rgba(168,216,234,0.5)'; t.style.color = '#a8d8ea'; }
    document.body.appendChild(t);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, opts.duration || 2400);
  }

  /* —— Modal —— */
  function modal(opts) {
    return new Promise(function (resolve) {
      const mask = document.createElement('div');
      mask.className = 'modal-mask';
      const card = document.createElement('div');
      card.className = 'glass-strong modal-card';
      const title = document.createElement('div');
      title.textContent = opts.title || '';
      title.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:8px;letter-spacing:0.04em;';
      const body = document.createElement('div');
      body.textContent = opts.body || '';
      body.style.cssText = 'font-size:13px;color:var(--text-glow);margin-bottom:20px;line-height:1.7;';
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
      (opts.actions || [{ label: '确定', kind: 'primary' }]).forEach(function (a) {
        const b = document.createElement('button');
        b.className = 'btn ' + (a.kind === 'danger' ? 'btn-danger' : a.kind === 'soft' ? 'btn-soft' : a.kind === 'ghost' ? 'btn-ghost' : 'btn-primary');
        b.textContent = a.label;
        b.onclick = function () { mask.remove(); resolve(a.value || a.label); };
        actions.appendChild(b);
      });
      card.appendChild(title); card.appendChild(body); card.appendChild(actions);
      mask.appendChild(card);
      mask.onclick = function (e) { if (e.target === mask && opts.dismissable !== false) { mask.remove(); resolve(null); } };
      document.body.appendChild(mask);
    });
  }

  function confirm(opts) {
    return modal({
      title: opts.title || '请确认',
      body: opts.body || '',
      actions: [
        { label: opts.cancel || '取消', kind: 'ghost', value: false },
        { label: opts.confirm || '确定', kind: opts.danger ? 'danger' : 'primary', value: true }
      ]
    });
  }

  /* —— 顶部固定导航（网页版）—— */
  function injectTopNav(active) {
    if (document.querySelector('.top-nav')) return;
    const nav = document.createElement('nav');
    nav.className = 'top-nav';
    // 品牌
    const brand = document.createElement('a');
    brand.className = 'brand';
    brand.href = 'home.html';
    brand.innerHTML = '<span class="star">✦</span><span>星愈</span>';
    nav.appendChild(brand);
    // 导航项
    const items = [
      { key: 'home', icon: '✦', label: '星系', href: 'home.html' },
      { key: 'community', icon: '◈', label: '社区', href: 'community.html' },
      { key: 'core', icon: '✧', label: '双盲棱镜', href: 'prism.html', core: true },
      { key: 'msg',  icon: '✉', label: '消息', href: 'messages.html' },
      { key: 'me',   icon: '◉', label: '我的', href: 'profile.html' }
    ];
    items.forEach(function (it) {
      const el = document.createElement('a');
      if (it.core) {
        el.className = 'nav-core';
        el.innerHTML = '<span>' + it.icon + '</span><span>' + it.label + '</span>';
        el.title = it.label;
      } else {
        el.className = 'nav-item' + (it.key === active ? ' active' : '');
        el.innerHTML = '<span class="nav-icon">' + it.icon + '</span><span>' + it.label + '</span>';
      }
      el.href = it.href;
      nav.appendChild(el);
    });
    document.body.appendChild(nav);
  }

  /* —— 底部导航（兼容旧调用，已迁移至顶部；保留别名）—— */
  function injectBottomNav(active) { injectTopNav(active); }

  /* —— 简单客户端路由辅助 —— */
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function go(page, params) {
    let url = page;
    if (params) url += '?' + new URLSearchParams(params).toString();
    location.href = url;
  }

  /* —— 时间格式化 —— */
  function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 86400000 * 7) return Math.floor(diff / 86400000) + ' 天前';
    const d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /* —— 安全 HTML 转义 —— */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* —— 错误处理（统一识别 API 错误码）—— */
  function handleError(err, fallback) {
    if (!err) { toast(fallback || '发生未知错误', { tone: 'danger' }); return; }
    const code = err.code || '';
    const map = {
      'AUTH_REQUIRED': '请先完成登录',
      'FORBIDDEN': '无权访问此内容',
      'CONTENT_BLOCKED': '内容已被安全策略拦截',
      'HIGH_RISK_ESCALATION': '检测到可能涉及高危内容，已转入专门处置通道',
      'NO_MATCH': '暂未找到合适的观点，可换题或重新提问',
      'AI_TIMEOUT': 'AI 处理超时，请稍后再试',
      'CONSENT_REQUIRED': '需要先完成本轮授权',
      'DELETION_IN_PROGRESS': '正在清理中，请稍候',
      'RATE_LIMITED': '操作过于频繁，请稍后再试'
    };
    toast(map[code] || err.message || fallback || '发生错误', { tone: 'danger' });
  }

  /* —— 初始化所有页面公共元素 —— */
  function init(opts) {
    opts = opts || {};
    injectBackground();
    if (opts.topNav) injectTopNav(opts.topNav);
    else if (opts.bottomNav) injectTopNav(opts.bottomNav); // 兼容旧调用
    // 登录守卫
    if (opts.requireLogin !== false && !window.StarhealStore.isLoggedIn()) {
      // 仅 prism / profile / community 强制登录
      if (location.pathname.indexOf('index.html') >= 0 || location.pathname === '/' || location.pathname.endsWith('/')) {
        // 登录页本身不跳
      } else {
        // 给个柔和提示，但不强制跳走（Demo 允许浏览）
      }
    }
  }

  /* —— 星球渲染：在某容器里画一个 CSS 星球 —— */
  function renderPlanet(container, opts) {
    opts = opts || {};
    const size = opts.size || 120;
    const p = document.createElement('div');
    p.className = 'planet' + (opts.rotate === false ? ' no-rotate' : '');
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    if (opts.color) {
      p.style.background = 'radial-gradient(circle at 30% 25%, #fff 0%, ' + opts.color + ' 30%, ' + (opts.colorDark || opts.color) + ' 70%, var(--bg-nebula-soft) 100%)';
    }
    const glow = document.createElement('div');
    glow.className = 'planet-glow';
    p.appendChild(glow);
    if (opts.onClick) {
      p.style.cursor = 'pointer';
      p.onclick = opts.onClick;
    }
    container.appendChild(p);
    return p;
  }

  /* —— 星空粒子背景（额外动态层，可选）—— */
  function addStarfield(container, count) {
    count = count || 30;
    const sf = document.createElement('div');
    sf.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      const sz = Math.random() * 2 + 0.5;
      s.style.cssText = 'position:absolute;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:#fff;opacity:' + (Math.random() * 0.6 + 0.2) + ';left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;';
      sf.appendChild(s);
    }
    container.appendChild(sf);
  }

  return {
    init: init,
    toast: toast,
    modal: modal,
    confirm: confirm,
    qs: qs,
    go: go,
    timeAgo: timeAgo,
    escapeHtml: escapeHtml,
    handleError: handleError,
    injectBackground: injectBackground,
    injectTopNav: injectTopNav,
    injectBottomNav: injectBottomNav,
    renderPlanet: renderPlanet,
    addStarfield: addStarfield
  };
})();

/* —— 页面过渡：淡入淡出遮罩，让多页切换像单页应用 —— */
(function () {
  function pageTransition() {
    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.className = 'page-transition';
    document.body.appendChild(overlay);

    // 淡出遮罩（处理 load 事件可能已触发的情况）
    function fadeOut() {
      requestAnimationFrame(function () {
        overlay.classList.add('hide');
        setTimeout(function () { overlay.remove(); }, 400);
      });
    }
    if (document.readyState === 'complete') {
      fadeOut();
    } else {
      window.addEventListener('load', fadeOut);
    }

    // 内容淡入
    const main = document.querySelector('.page, .page-wrapper, .login-wrap, main, body > *:not(.page-transition):not(.cosmos-bg):not(.particles):not(.top-nav):not(.loading)');
    if (main) main.classList.add('page-enter');

    // 拦截站内链接点击，淡入遮罩后跳转
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || link.target === '_blank') return;
      if (href.endsWith('.html') || href === '/' || href === '' || href.startsWith('?')) {
        e.preventDefault();
        const o = document.createElement('div');
        o.className = 'page-transition';
        document.body.appendChild(o);
        requestAnimationFrame(function () {
          o.style.opacity = '1';
        });
        setTimeout(function () {
          location.href = href;
        }, 300);
      }
    });
  }

  // 自动执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pageTransition);
  } else {
    pageTransition();
  }
})();

// —— 页面加载完成后自动注入背景层 ——
document.addEventListener('DOMContentLoaded', function () {
  if (window.StarhealApp) window.StarhealApp.injectBackground();
});
