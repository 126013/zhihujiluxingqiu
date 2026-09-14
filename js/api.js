/* =========================================================================
 * 星愈·双盲棱镜  API 接口客户端
 * --------------------------------------------------------------------------
 * 严格对齐《星愈双盲棱镜产品完整需求与技术设计总纲 · 十一 接口与请求链路》
 *
 * 约定：
 *   - DEMO_MODE = true 时，所有接口走本地 mock 实现（不调用任何真实后端）
 *   - DEMO_MODE = false 时，按 BASE_URL 发起真实 fetch 请求
 *   - 所有响应统一形如 { request_id, data, meta }
 *   - 所有错误统一形如 { request_id, code, message, retryable, user_action }
 *   - 错误码：AUTH_REQUIRED / FORBIDDEN / CONTENT_BLOCKED / HIGH_RISK_ESCALATION
 *             NO_MATCH / AI_TIMEOUT / CONSENT_REQUIRED
 *             DELETION_IN_PROGRESS / RATE_LIMITED
 * ========================================================================= */

window.StarhealAPI = (function () {
  'use strict';

  /* —— 配置：留接口的边界 —— */
  const CONFIG = {
    DEMO_MODE: true,                  // Demo 阶段：true。正式落地：false 并填 BASE_URL
    BASE_URL: '/api',                 // 正式落地：替换为真实 BFF/API Gateway 域名
    ZHIHU_OAUTH: {
      authorize: 'https://oauth.zhihu.com/authorize',  // 正式落地：知乎 OAuth 授权地址
      client_id: '',                                     // 正式落地：填入知乎开放平台 client_id
      redirect_uri: location.origin + '/index.html',    // OAuth 回调
      scope: 'profile topics feed'                       // 申请的 scope
    },
    AI: {
      // 正式落地：模型供应商端点（BFF 代理后），Demo 不直接暴露密钥
      prism_endpoint: '/v1/prism/llm',
      embedding_endpoint: '/v1/prism/embedding',
      retrieval_endpoint: '/v1/prism/retrieval',
      moderation_endpoint: '/v1/prism/moderation',
      model_version: 'prism-v1',
      prompt_version: 'system-prompt-v1',
      policy_version: 'ai-policy-v1'
    },
    TIMEOUT_MS: 12000,
    CURSOR_DEFAULT: ''
  };

  /* —— 请求 ID 生成 —— */
  function genRequestId() {
    return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* —— 模拟网络延迟 —— */
  function mockDelay(min, max) {
    return new Promise(function (r) { setTimeout(r, Math.random() * (max - min) + min); });
  }

  /* —— 统一响应包装 —— */
  function ok(data, meta) {
    return { request_id: genRequestId(), data: data, meta: meta || {} };
  }
  function fail(code, message, opts) {
    const err = new Error(message);
    err.request_id = genRequestId();
    err.code = code;
    err.retryable = !!(opts && opts.retryable);
    err.user_action = (opts && opts.user_action) || null;
    return Promise.reject(err);
  }

  /* —— 真实 fetch 封装（正式落地时启用）—— */
  async function realFetch(method, path, body, opts) {
    opts = opts || {};
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, CONFIG.TIMEOUT_MS);
    try {
      const headers = { 'Content-Type': 'application/json' };
      // 幂等键：所有写操作必须支持
      if (opts.idempotency_key) headers['Idempotency-Key'] = opts.idempotency_key;
      const res = await fetch(CONFIG.BASE_URL + path, {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        credentials: 'include'
      });
      const json = await res.json();
      if (!res.ok) {
        const e = new Error(json.message || ('HTTP ' + res.status));
        e.request_id = json.request_id || genRequestId();
        e.code = json.code || 'HTTP_' + res.status;
        e.retryable = json.retryable || res.status >= 500;
        e.user_action = json.user_action || null;
        throw e;
      }
      return json;
    } catch (e) {
      if (e.name === 'AbortError') {
        return fail('AI_TIMEOUT', '请求超时，请稍后再试', { retryable: true });
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  /* —— 路由分发：Demo 或 真实 —— */
  async function request(method, path, body, opts) {
    if (CONFIG.DEMO_MODE) {
      // Demo 路由：交给 store 处理
      return window.StarhealStore.handleMock(method, path, body, opts);
    }
    return realFetch(method, path, body, opts);
  }

  /* ====================================================================
   * 公共 API（按文档接口清单 · 留接口）
   * ==================================================================== */

  /* —— 0. 知乎 OAuth 模拟（登录页用）—— */
  // 跳转知乎授权页；正式落地用真实 OAuth URL
  function buildOAuthUrl(state) {
    const u = CONFIG.ZHIHU_OAUTH;
    const q = new URLSearchParams({
      client_id: u.client_id,
      redirect_uri: u.redirect_uri,
      response_type: 'code',
      scope: u.scope,
      state: state || genRequestId()
    });
    return u.authorize + '?' + q.toString();
  }

  // Demo 模拟 OAuth 回调，直接签发一个本地会话
  async function mockOAuthLogin(code, state) {
    return request('POST', '/v1/oauth/callback', { code: code, state: state });
  }

  async function logout() {
    return request('POST', '/v1/session/logout');
  }

  /* —— 1. GET /v1/session  当前会话与能力开关 —— */
  async function getSession() {
    return request('GET', '/v1/session');
  }

  /* —— 2. GET /v1/topics  主题星球列表与排序 —— */
  async function getTopics() {
    return request('GET', '/v1/topics');
  }

  /* —— 3. POST /v1/prism/sessions  创建双盲会话 —— */
  // body: { topic_id, visibility ('anonymous'|'real_name') }
  async function createPrismSession(body, idempotency_key) {
    return request('POST', '/v1/prism/sessions', body, { idempotency_key: idempotency_key || genRequestId() });
  }

  /* —— 4. POST /v1/prism/sessions/{id}/turns  提交问题并启动匹配 —— */
  // body: { raw_text, media_refs[], identity_mode, topic_id }
  async function submitTurn(session_id, body, idempotency_key) {
    return request('POST', '/v1/prism/sessions/' + encodeURIComponent(session_id) + '/turns', body,
      { idempotency_key: idempotency_key || genRequestId() });
  }

  /* —— 5. GET /v1/prism/sessions/{id}/turns/{turnId}  查询处理状态与结果 —— */
  async function getTurn(session_id, turn_id) {
    return request('GET', '/v1/prism/sessions/' + encodeURIComponent(session_id) + '/turns/' + encodeURIComponent(turn_id));
  }

  /* —— 6. POST /v1/prism/sessions/{id}/close  结束本轮 —— */
  async function closeSession(session_id) {
    return request('POST', '/v1/prism/sessions/' + encodeURIComponent(session_id) + '/close', {}, { idempotency_key: genRequestId() });
  }

  /* —— 7. POST /v1/decisions/publication  匿名/实名公开决定 —— */
  // body: { source_turn_id, author_mode ('anonymous'|'real_name'), topic_id }
  async function publishDecision(body) {
    return request('POST', '/v1/decisions/publication', body, { idempotency_key: genRequestId() });
  }

  /* —— 8. POST /v1/decisions/knowledge-consent  入库授权决定 —— */
  // body: { source_turn_id, consent: 'granted'|'denied' }
  async function knowledgeConsent(body) {
    return request('POST', '/v1/decisions/knowledge-consent', body, { idempotency_key: genRequestId() });
  }

  /* —— 9. GET /v1/feed  按主题分页读取公开内容 —— */
  async function getFeed(topic_slug, cursor, limit) {
    const q = new URLSearchParams({ topic: topic_slug || '', cursor: cursor || CONFIG.CURSOR_DEFAULT, limit: String(limit || 12) });
    return request('GET', '/v1/feed?' + q.toString());
  }

  /* —— 10. GET /v1/publications/{id}  帖子详情和评论摘要 —— */
  async function getPublication(id) {
    return request('GET', '/v1/publications/' + encodeURIComponent(id));
  }

  /* —— 11. POST /v1/publications/{id}/interactions  点赞、收藏、举报 —— */
  // body: { type: 'like'|'favorite'|'follow'|'report', action: 'add'|'remove' }
  async function interact(id, body) {
    return request('POST', '/v1/publications/' + encodeURIComponent(id) + '/interactions', body, { idempotency_key: genRequestId() });
  }

  /* —— 12. POST /v1/publications/{id}/comments  发表评论（文档 FR-016 衍生）—— */
  async function postComment(id, body) {
    return request('POST', '/v1/publications/' + encodeURIComponent(id) + '/comments', body, { idempotency_key: genRequestId() });
  }

  /* —— 13. GET /v1/me/knowledge-items  本人授权内容与状态 —— */
  async function getMyKnowledgeItems(cursor) {
    const q = new URLSearchParams({ cursor: cursor || CONFIG.CURSOR_DEFAULT, limit: '20' });
    return request('GET', '/v1/me/knowledge-items?' + q.toString());
  }

  /* —— 14. POST /v1/me/knowledge-items/{id}/revoke  撤回授权并触发清理 —— */
  async function revokeKnowledgeItem(id) {
    return request('POST', '/v1/me/knowledge-items/' + encodeURIComponent(id) + '/revoke', {}, { idempotency_key: genRequestId() });
  }

  /* —— 15. DELETE /v1/me/knowledge-items/{id}  彻底删除知识项 —— */
  async function deleteKnowledgeItem(id) {
    return request('DELETE', '/v1/me/knowledge-items/' + encodeURIComponent(id), {}, { idempotency_key: genRequestId() });
  }

  /* —— 16. GET /v1/me/sessions  历史会话 —— */
  async function getMySessions(cursor) {
    const q = new URLSearchParams({ cursor: cursor || CONFIG.CURSOR_DEFAULT, limit: '20' });
    return request('GET', '/v1/me/sessions?' + q.toString());
  }

  /* —— 17. GET /v1/me/interactions  我的喜欢/收藏/关注（个人星球）—— */
  async function getMyInteractions(kind, cursor) {
    const q = new URLSearchParams({ kind: kind, cursor: cursor || CONFIG.CURSOR_DEFAULT, limit: '20' });
    return request('GET', '/v1/me/interactions?' + q.toString());
  }

  /** 获取消息通知列表（category: community | prism | 不传则全部） */
  async function getMyMessages(category, cursor) {
    const q = new URLSearchParams({ cursor: cursor || CONFIG.CURSOR_DEFAULT, limit: '30' });
    if (category) q.set('category', category);
    return request('GET', '/v1/me/messages?' + q.toString());
  }

  /** 批量标记消息为已读 */
  async function markMessagesRead(ids) {
    return request('POST', '/v1/me/messages/read', { ids: ids || [] });
  }

  /* —— 错误码枚举（前端可识别）—— */
  const ERROR_CODES = {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    FORBIDDEN: 'FORBIDDEN',
    CONTENT_BLOCKED: 'CONTENT_BLOCKED',
    HIGH_RISK_ESCALATION: 'HIGH_RISK_ESCALATION',
    NO_MATCH: 'NO_MATCH',
    AI_TIMEOUT: 'AI_TIMEOUT',
    CONSENT_REQUIRED: 'CONSENT_REQUIRED',
    DELETION_IN_PROGRESS: 'DELETION_IN_PROGRESS',
    RATE_LIMITED: 'RATE_LIMITED'
  };

  return {
    CONFIG: CONFIG,
    ERROR_CODES: ERROR_CODES,
    // OAuth
    buildOAuthUrl: buildOAuthUrl,
    mockOAuthLogin: mockOAuthLogin,
    logout: logout,
    // Sessions & Topics
    getSession: getSession,
    getTopics: getTopics,
    // Prism core
    createPrismSession: createPrismSession,
    submitTurn: submitTurn,
    getTurn: getTurn,
    closeSession: closeSession,
    // Decisions
    publishDecision: publishDecision,
    knowledgeConsent: knowledgeConsent,
    // Feed & Publications
    getFeed: getFeed,
    getPublication: getPublication,
    interact: interact,
    postComment: postComment,
    // Personal
    getMyKnowledgeItems: getMyKnowledgeItems,
    revokeKnowledgeItem: revokeKnowledgeItem,
    deleteKnowledgeItem: deleteKnowledgeItem,
    getMySessions: getMySessions,
    getMyInteractions: getMyInteractions,
    getMyMessages: getMyMessages,
    markMessagesRead: markMessagesRead
  };
})();
