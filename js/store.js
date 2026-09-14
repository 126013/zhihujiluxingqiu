/* =========================================================================
 * 星愈·双盲棱镜  Demo 状态管理 + 模拟数据 + Mock 接口实现
 * --------------------------------------------------------------------------
 * 文档约束（《豆包大纲详细版 · 9. 后端功能清单（Demo 约束）》）：
 *   - 不接入 zhihu cli，不调用知乎真实 API
 *   - 知识库全部使用预制模拟样例数据
 *   - OAuth 仅 UI 模拟
 *   - 语义相似度匹配 Demo 层支持模拟返回结果
 *   - Demo 无法向真实知乎社区写入帖子；发布功能仅为本系统内部模拟展示
 * ========================================================================= */

window.StarhealStore = (function () {
  'use strict';

  const LS_KEY = 'starheal_state_v1';

  /* —— 默认状态 —— */
  function defaultState() {
    return {
      user: {
        zhihu_user_id_hash: 'demo_' + Math.random().toString(36).slice(2, 8),
        nickname: '星海漫游者',
        avatar_seed: Math.floor(Math.random() * 360),
        logged_in: false,
        anonymous_default: true
      },
      // 知识库（仅存储用户授权入库的问答）
      knowledgeItems: [],
      // 历史会话
      sessions: [],
      // 提问轮次（Demo 内存中保留，便于轮询查询）
      turns: [],
      // 公开发布的帖子（Demo 内部社区）
      publications: [],
      // 互动记录（点赞/收藏/关注/评论/举报）
      interactions: { likes: [], favorites: [], follows: [] },
      // 删除任务（处理中状态）
      deletionJobs: {}
    };
  }

  /* —— 读写 localStorage —— */
  let state = null;
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { state = JSON.parse(raw); return; }
    } catch (e) {}
    state = defaultState();
    save();
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function reset() { state = defaultState(); save(); }

  /* ====================================================================
   * 主题星球列表（对应 home 页星环）
   * ==================================================================== */
  const TOPICS = [
    { id: 't_pets',     slug: 'pets',     name: '萌宠星球',     desc: '猫狗饲养 · 宠物生活',     color: '#f4c2c2', topic_class: 'topic-pets' },
    { id: 't_travel',   slug: 'travel',   name: '旅行星球',     desc: '游玩 · 穷游 · 打卡 · 生活体验', color: '#a8d8ea', topic_class: 'topic-travel' },
    { id: 't_work',     slug: 'work',     name: '办公职场星球', desc: '职场关系 · 工作成长',     color: '#b8b8d0', topic_class: 'topic-work' },
    { id: 't_design',   slug: 'design',   name: '设计创意星球', desc: '设计灵感 · 创作思辨',     color: '#c8b8e8', topic_class: 'topic-design' },
    { id: 't_news',     slug: 'news',     name: '时事观点星球', desc: '时事观察 · 多元视角',     color: '#88c8b8', topic_class: 'topic-news' },
    { id: 't_emotion',  slug: 'emotion',  name: '生活情绪星球', desc: '情绪倾诉 · 生活感悟',     color: '#f4b8c8', topic_class: 'topic-emotion' },
    { id: 't_study',    slug: 'study',    name: '学习成长星球', desc: '学习方法 · 自我成长',     color: '#b8d8f4', topic_class: 'topic-study' }
  ];

  /* ====================================================================
   * 预制知识库样例（Demo 模拟素材）
   * —— 不是知乎真实用户回答；正式落地需通过开放平台授权
   * ==================================================================== */
  const PRESET_KNOWLEDGE = [
    {
      id: 'k_preset_1', topic_id: 't_emotion',
      canonical_question: '最近总觉得自己被生活推着走，怎么找回自己的节奏？',
      canonical_answer: '试着把"我应该"换成"我选择"——哪怕只是选择今晚吃什么。被推着走的感觉，往往来自被动接受，而不是事件本身。每天给自己留一段只属于你的时间，哪怕只有十分钟，做一件不需要回报的事，节奏会慢慢长回来。',
      embedding_hint: '生活节奏 自主感 选择 被动 焦虑',
      author_mode: 'anonymous'
    },
    {
      id: 'k_preset_2', topic_id: 't_pets',
      canonical_question: '养猫之后，你对陪伴的理解有没有变化？',
      canonical_answer: '猫教会我的是"沉默的同在"。它不需要回应你，但它在那里。这种不被打扰的陪伴，反而是更纯粹的——没有期待，也就没有失望。人和人之间很难做到，但养猫之后，我开始试着给身边的人这种"沉默的同在"。',
      embedding_hint: '猫 陪伴 沉默 关系 期待',
      author_mode: 'anonymous'
    },
    {
      id: 'k_preset_3', topic_id: 't_work',
      canonical_question: '职场里"努力但不被看见"怎么办？',
      canonical_answer: '先区分两件事：努力的方向是不是被需要的，以及不被看见是你的问题还是结构的问题。前者靠沟通，后者靠换位置。很多努力没被看见，是因为别人不知道你在做什么——主动汇报不是邀功，是让对方有机会选择你。',
      embedding_hint: '职场 努力 认可 沟通 汇报',
      author_mode: 'anonymous'
    },
    {
      id: 'k_preset_4', topic_id: 't_travel',
      canonical_question: '一个人旅行和结伴旅行，哪个更值得？',
      canonical_answer: '不是哪个更值得，是它们在解决不同的问题。一个人旅行是在和自己对话，结伴旅行是在和别人对话。前者修补独处的能力，后者修补关系的能力。如果你最近很在意"我是谁"，一个人去；如果你最近很在意"我们"，带人去。',
      embedding_hint: '旅行 一个人 结伴 自我 关系',
      author_mode: 'anonymous'
    },
    {
      id: 'k_preset_5', topic_id: 't_design',
      canonical_question: '设计里的"少即是多"怎么理解才不空洞？',
      canonical_answer: '"少"不是数量的少，是冗余的少。少即是多，本质是"每个留下的东西都必须有用"。如果删掉一个元素，体验没变差，那它就是冗余。真正的极简不是空，是被反复确认过的"必要"。',
      embedding_hint: '设计 极简 必要 冗余 元素',
      author_mode: 'anonymous'
    },
    {
      id: 'k_preset_6', topic_id: 't_study',
      canonical_question: '为什么我看了很多书但记不住？',
      canonical_answer: '因为阅读本身不产生记忆，思考才产生记忆。看完一章合上书，问自己三个问题：作者解决了什么问题？用什么方式？我同意吗？能回答这三个问题的章节，你十年后都记得。不能回答的，等于没读。',
      embedding_hint: '阅读 记忆 思考 提问 理解',
      author_mode: 'anonymous'
    },
    {
      id: 'k_preset_7', topic_id: 't_news',
      canonical_question: '面对海量信息怎么保持自己的判断？',
      canonical_answer: '先问来源，再问立场，最后问利益。来源决定事实可信度，立场决定叙事角度，利益决定为何这样说。三者都看清，你才能分清"发生了什么"和"别人想让你以为发生了什么"。',
      embedding_hint: '信息 判断 来源 立场 利益',
      author_mode: 'anonymous'
    },
    {
      id: 'k_preset_8', topic_id: 't_emotion',
      canonical_question: '怎样区分是"累了"还是"不爱了"？',
      canonical_answer: '累是暂时性的，不爱是结构性。给自己两周的真正休息——不是不做事，而是不强迫自己回应。如果休息之后看到对方仍然有想靠近的念头，是累了；如果休息之后反而觉得轻松，是不爱了。别在累的时候做爱的决定。',
      embedding_hint: '累 不爱 关系 休息 决定',
      author_mode: 'anonymous'
    }
  ];

  /* ====================================================================
   * 预制消息通知（社区互动 + 双盲棱镜 两类）
   * ==================================================================== */
  const PRESET_MESSAGES = [
    // —— 社区互动类 ——
    {
      id: 'm_c1', category: 'community', type: 'like', read: false,
      actor_name: '星河漫游者', actor_mode: 'anonymous',
      target_title: '养猫之后，你对陪伴的理解有没有变化？',
      created_at: Date.now() - 1000 * 60 * 12
    },
    {
      id: 'm_c2', category: 'community', type: 'comment', read: false,
      actor_name: '匿名星客', actor_mode: 'anonymous',
      target_title: '一个人旅行和结伴旅行，哪个更值得？',
      content: '最近在想"我是谁"，决定一个人去趟海边，谢谢你的观点。',
      created_at: Date.now() - 1000 * 60 * 45
    },
    {
      id: 'm_c3', category: 'community', type: 'favorite', read: true,
      actor_name: '月夜旅人', actor_mode: 'anonymous',
      target_title: '设计里的"少即是多"怎么理解才不空洞？',
      created_at: Date.now() - 1000 * 60 * 60 * 3
    },
    {
      id: 'm_c4', category: 'community', type: 'follow', read: true,
      actor_name: '晨光设计', actor_mode: 'real_name',
      created_at: Date.now() - 1000 * 60 * 60 * 26
    },
    {
      id: 'm_c5', category: 'community', type: 'comment', read: true,
      actor_name: '匿名星客', actor_mode: 'anonymous',
      target_title: '为什么我看了很多书但记不住？',
      content: '三问法试过了，真的有用，合上书能复述出来。',
      created_at: Date.now() - 1000 * 60 * 60 * 50
    },
    // —— 双盲棱镜类 ——
    {
      id: 'm_p1', category: 'prism', type: 'matched', read: false,
      knowledge_title: '最近总觉得自己被生活推着走，怎么找回自己的节奏？',
      matched_by: '匿名星客',
      matched_topic: '生活情绪',
      created_at: Date.now() - 1000 * 60 * 20
    },
    {
      id: 'm_p2', category: 'prism', type: 'cited', read: false,
      knowledge_title: '职场里"努力但不被看见"怎么办？',
      cited_by: '匿名星客',
      cited_in: '「向上管理到底在管什么」公开帖',
      created_at: Date.now() - 1000 * 60 * 60 * 5
    },
    {
      id: 'm_p3', category: 'prism', type: 'reused', read: true,
      knowledge_title: '一个人旅行和结伴旅行，哪个更值得？',
      reused_by: '匿名星客',
      created_at: Date.now() - 1000 * 60 * 60 * 28
    },
    {
      id: 'm_p4', category: 'prism', type: 'consent', read: true,
      knowledge_title: '面对海量信息怎么保持自己的判断？',
      action: '入库授权已确认',
      created_at: Date.now() - 1000 * 60 * 60 * 72
    }
  ];

  /* ====================================================================
   * 预制社区帖子（已公开发布的样例）
   * ==================================================================== */
  const PRESET_PUBLICATIONS = [
    {
      id: 'pub_preset_1', topic_id: 't_emotion', author_mode: 'anonymous',
      question: '最近总觉得自己被生活推着走，怎么找回自己的节奏？',
      original_answer: '试着把"我应该"换成"我选择"——哪怕只是选择今晚吃什么。被推着走的感觉，往往来自被动接受，而不是事件本身。每天给自己留一段只属于你的时间，哪怕只有十分钟，做一件不需要回报的事，节奏会慢慢长回来。',
      ai_summary: '区分"我应该"与"我选择"，用主动选择重建生活节奏感。',
      ai_body: '当感到被生活推动时，根源常不在于事件本身，而在于被动的接受模式。可尝试两个具体动作：一是语言层面，将"我应该"替换为"我选择"，让被动接受显性化为主动决定；二是行为层面，每天预留一段只属于自己的时间（哪怕十分钟），做一件不需要回报的事。节奏感并非外部给予，而是从这种微小的主动选择中累积而成。',
      poetic_phrase: '风再大，也能在十分钟的留白里，种下自己的钟。',
      stats: { quoted: 28, matched: 142, reused: 16 },
      created_at: Date.now() - 86400000 * 3,
      comments: [
        { id: 'c1', author_mode: 'anonymous', body: '"我应该"和"我选择"这个区分太戳了。', created_at: Date.now() - 86400000 * 2, replies: [] },
        { id: 'c2', author_mode: 'anonymous', body: '今晚就开始试试十分钟留白。', created_at: Date.now() - 86400000, replies: [
          { id: 'c2r1', author_mode: 'anonymous', body: '一起，我也开始。', created_at: Date.now() - 3600000 }
        ] }
      ]
    },
    {
      id: 'pub_preset_2', topic_id: 't_pets', author_mode: 'anonymous',
      question: '养猫之后，你对陪伴的理解有没有变化？',
      original_answer: '猫教会我的是"沉默的同在"。它不需要回应你，但它在那里。这种不被打扰的陪伴，反而是更纯粹的——没有期待，也就没有失望。人和人之间很难做到，但养猫之后，我开始试着给身边的人这种"沉默的同在"。',
      ai_summary: '陪伴的本质是"沉默的同在"，不依赖回应也能成立。',
      ai_body: '从猫与人的相处中提炼出一种陪伴范式——"沉默的同在"。其特征是对方在场但不要求回应，因无期待而少有失望。这种陪伴的纯粹性高于人际间的回应型陪伴，并可作为可迁移的关系模式，反向应用于人与人之间：减少对即时回应的索取，增加"在场而不打扰"的容忍。',
      poetic_phrase: '它在，不必说话；这是猫给的最大礼物。',
      stats: { quoted: 12, matched: 89, reused: 7 },
      created_at: Date.now() - 86400000 * 5,
      comments: [
        { id: 'c3', author_mode: 'anonymous', body: '沉默的同在，这个词我存下了。', created_at: Date.now() - 86400000 * 4, replies: [] }
      ]
    },
    {
      id: 'pub_preset_3', topic_id: 't_work', author_mode: 'real_name',
      question: '职场里"努力但不被看见"怎么办？',
      original_answer: '先区分两件事：努力的方向是不是被需要的，以及不被看见是你的问题还是结构的问题。前者靠沟通，后者靠换位置。很多努力没被看见，是因为别人不知道你在做什么——主动汇报不是邀功，是让对方有机会选择你。',
      ai_summary: '先辨方向再辨结构，主动汇报是让对方有机会选择你。',
      ai_body: '面对"努力未被看见"的困境，可拆解为两层判断：第一层，努力的方向是否契合被需要，需通过沟通澄清期望；第二层，未被看见的成因归属——是个体表达不足，还是结构性忽视。前者可通过主动汇报缓解，且需澄清汇报的本质非邀功，而是让对方在知情的前提下产生选择权；后者则通常需要更换位置。',
      poetic_phrase: '不汇报，不是低调，是把选择权关在抽屉里。',
      stats: { quoted: 41, matched: 213, reused: 22 },
      created_at: Date.now() - 86400000 * 2,
      comments: []
    },
    {
      id: 'pub_preset_4', topic_id: 't_travel', author_mode: 'anonymous',
      question: '一个人旅行和结伴旅行，哪个更值得？',
      original_answer: '不是哪个更值得，是它们在解决不同的问题。一个人旅行是在和自己对话，结伴旅行是在和别人对话。前者修补独处的能力，后者修补关系的能力。如果你最近很在意"我是谁"，一个人去；如果你最近很在意"我们"，带人去。',
      ai_summary: '独行修补独处能力，结伴修补关系能力，按当下内心诉求选择。',
      ai_body: '独行与结伴并非优劣之分，而是在回应不同的内在需求：一个人旅行指向自我对话，修补独处的能力；结伴旅行指向人际对话，修补关系的能力。选择的依据不是习惯，而是当下最在意的命题——若在意"我是谁"，适合独行；若在意"我们"，适合结伴。',
      poetic_phrase: '独行见自己，结伴见彼此。',
      stats: { quoted: 19, matched: 105, reused: 11 },
      created_at: Date.now() - 86400000 * 4,
      comments: [
        { id: 'c4', author_mode: 'anonymous', body: '最近在想"我是谁"，决定一个人去趟海边。', created_at: Date.now() - 86400000 * 3, replies: [] }
      ]
    },
    {
      id: 'pub_preset_5', topic_id: 't_design', author_mode: 'anonymous',
      question: '设计里的"少即是多"怎么理解才不空洞？',
      original_answer: '"少"不是数量的少，是冗余的少。少即是多，本质是"每个留下的东西都必须有用"。如果删掉一个元素，体验没变差，那它就是冗余。真正的极简不是空，是被反复确认过的"必要"。',
      ai_summary: '少即冗余的减少，留下的每个元素都必须被确认为必要。',
      ai_body: '"少即是多"中的"少"不是数量的精简，而是冗余的剔除。其核心是"每个留下的元素都必须有用"——若删除某元素后体验无下降，则该元素即为冗余。真正的极简并非空无一物，而是经过反复确认后的"必要"集合。',
      poetic_phrase: '极简不是空，是每一处都被确认过。',
      stats: { quoted: 23, matched: 131, reused: 14 },
      created_at: Date.now() - 86400000 * 6,
      comments: []
    },
    {
      id: 'pub_preset_6', topic_id: 't_news', author_mode: 'anonymous',
      question: '面对海量信息怎么保持自己的判断？',
      original_answer: '先问来源，再问立场，最后问利益。来源决定事实可信度，立场决定叙事角度，利益决定为何这样说。三者都看清，你才能分清"发生了什么"和"别人想让你以为发生了什么"。',
      ai_summary: '通过来源、立场、利益三层追问，区分事实与叙事。',
      ai_body: '在海量信息中保持独立判断，可通过三层追问实现：一查来源，判断事实可信度；二看立场，理解叙事角度；三问利益，洞察发声动机。三者交叉验证后，才能区分"客观发生了什么"与"别人想让你以为发生了什么"。',
      poetic_phrase: '来源、立场、利益，三层追问后，才是你自己的判断。',
      stats: { quoted: 35, matched: 187, reused: 19 },
      created_at: Date.now() - 86400000 * 1,
      comments: [
        { id: 'c5', author_mode: 'anonymous', body: '三层追问法，存下了。', created_at: Date.now() - 3600000 * 5, replies: [] }
      ]
    },
    {
      id: 'pub_preset_7', topic_id: 't_study', author_mode: 'anonymous',
      question: '为什么我看了很多书但记不住？',
      original_answer: '因为阅读本身不产生记忆，思考才产生记忆。看完一章合上书，问自己三个问题：作者解决了什么问题？用什么方式？我同意吗？能回答这三个问题的章节，你十年后都记得。不能回答的，等于没读。',
      ai_summary: '阅读不产生记忆，主动思考（三问法）才产生记忆。',
      ai_body: '读书却记不住，根因在于"阅读"本身不生成记忆，"思考"才生成记忆。可采用三问法：每读完一章合上书，自问"作者解决了什么问题？用什么方式？我同意吗？"。能清晰回答的章节会形成长期记忆，无法回答的则相当于未读。',
      poetic_phrase: '合上书的三个问题，比翻开书更重要。',
      stats: { quoted: 27, matched: 156, reused: 13 },
      created_at: Date.now() - 86400000 * 7,
      comments: []
    }
  ];

  /* ====================================================================
   * 工具函数
   * ==================================================================== */
  function genId(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function nowISO() { return new Date().toISOString(); }

  // 简单语义相似度（关键词重叠 Demo 模拟，正式落地换向量检索）
  // 提取文本的双字 n-gram 集合（用于中文语义相似度近似匹配）
  function bigrams(text) {
    const clean = String(text).replace(/[\s，。、,.;:！？!?？?"''""（）()]+/g, '');
    const set = new Set();
    for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
    return set;
  }

  function semanticScore(text, item) {
    // 主匹配：embedding_hint 与问题的 bigram 重叠率
    const tBigrams = bigrams(text);
    const hintBigrams = bigrams(item.embedding_hint || '');
    let hit = 0;
    hintBigrams.forEach(function (bg) { if (tBigrams.has(bg)) hit++; });
    const hintScore = hintBigrams.size > 0 ? hit / hintBigrams.size : 0;

    // 辅匹配：问题与 canonical_question 的 bigram 重叠（提升召回）
    const qBigrams = bigrams(item.canonical_question || '');
    let qHit = 0;
    qBigrams.forEach(function (bg) { if (tBigrams.has(bg)) qHit++; });
    const qScore = qBigrams.size > 0 ? qHit / qBigrams.size : 0;

    // 同主题加权：如果问题里出现该主题 hint 的任意单字，给保底分
    const hintChars = (item.embedding_hint || '').replace(/\s/g, '').split('');
    let charHit = 0;
    hintChars.forEach(function (c) { if (text.indexOf(c) >= 0) charHit++; });
    const charScore = hintChars.length > 0 ? (charHit / hintChars.length) * 0.3 : 0;

    return Math.max(hintScore, qScore) + charScore;
  }

  // 文本安全预检（Demo 极简版）
  const RISK_PATTERNS = [
    { re: /(去死|自杀|杀|跳楼|割腕|不想活|陪葬)/g, level: 'high', reason: 'high_risk_self_harm' },
    { re: /(傻逼|脑残|废物|垃圾|滚|贱|婊|操你|草你|妈的)/g, level: 'malicious', reason: 'abuse' },
    { re: /(打你|弄死你|教训你|报复|挂你|挂人|挂主页)/g, level: 'malicious', reason: 'attack' }
  ];
  function moderate(text) {
    for (let i = 0; i < RISK_PATTERNS.length; i++) {
      const p = RISK_PATTERNS[i];
      if (p.re.test(text)) {
        return { blocked: true, risk_level: p.level, reason: p.reason };
      }
    }
    return { blocked: false };
  }

  // AI 棱镜模拟（过滤/保留/优化三层处理）
  function prismProcess(original_answer, question) {
    // 模拟"核心观点提炼 + 优化阐释正文"
    const sentences = original_answer.split(/[。.!?！？\n]+/).filter(function (s) { return s.trim().length > 4; });
    const summary = sentences.length
      ? (sentences[0].length > 20 ? sentences[0].slice(0, 18) + '…' : sentences[0])
      : '观点已提炼。';
    const body = sentences.join('。') + '。';
    const poetic = pickPoetic(question, original_answer);
    return {
      summary: summary,
      body: body,
      poetic_phrase: poetic,
      model: 'prism-v1-demo',
      prompt_version: 'system-prompt-v1',
      policy_version: 'ai-policy-v1',
      ai_tag: '【本内容为AI阐释优化版，非用户原始原文】'
    };
  }

  const POETIC_TEMPLATES = [
    function (k1, k2) { return '在' + k1 + '里，看见' + k2 + '的微光。'; },
    function (k1, k2) { return k1 + '是入口，' + k2 + '是回声。'; },
    function (k1, k2) { return '不必追赶' + k1 + '，' + k2 + '会自己抵达。'; },
    function (k1, k2) { return '把' + k1 + '放轻，' + k2 + '就重了。'; }
  ];
  function pickPoetic(question, answer) {
    const q = question.replace(/[？?]/g, '').slice(0, 4);
    const a = answer.slice(0, 4);
    const tpl = POETIC_TEMPLATES[Math.floor(Math.random() * POETIC_TEMPLATES.length)];
    return tpl(q, a);
  }

  /* ====================================================================
   * Mock 路由分发
   * ==================================================================== */
  async function handleMock(method, path, body, opts) {
    await new Promise(function (r) { setTimeout(r, 200 + Math.random() * 500); });
    const rid = 'req_mock_' + Date.now().toString(36);
    const meta = { demo: true, server_time: nowISO() };

    try {
      // —— OAuth 模拟回调 ——
      if (method === 'POST' && path === '/v1/oauth/callback') {
        state.user.logged_in = true;
        state.user.nickname = '星海漫游者';
        save();
        return { request_id: rid, data: state.user, meta: meta };
      }
      if (method === 'POST' && path === '/v1/session/logout') {
        state.user.logged_in = false;
        save();
        return { request_id: rid, data: { logged_out: true }, meta: meta };
      }
      // —— GET /v1/session ——
      if (method === 'GET' && path === '/v1/session') {
        return { request_id: rid, data: {
          user: state.user,
          capabilities: {
            anonymous: true,
            real_name: true,
            image_upload: true,
            knowledge_consent: true,
            deletion: true,
            native_zhihu_interactions: false  // 文档约束：未获批时诚实降级
          }
        }, meta: meta };
      }
      // —— GET /v1/topics ——
      if (method === 'GET' && path.startsWith('/v1/topics')) {
        return { request_id: rid, data: { topics: TOPICS, default_sort: 'personalized' }, meta: meta };
      }
      // —— POST /v1/prism/sessions ——
      if (method === 'POST' && path === '/v1/prism/sessions') {
        const session = {
          id: genId('sess'),
          user_id: state.user.zhihu_user_id_hash,
          topic_id: body.topic_id,
          visibility: body.visibility || 'anonymous',
          status: 'draft',
          expires_at: Date.now() + 3600000,
          created_at: Date.now()
        };
        state.sessions.push(session);
        save();
        return { request_id: rid, data: session, meta: meta };
      }
      // —— POST /v1/prism/sessions/{id}/turns ——
      if (method === 'POST' && path.match(/^\/v1\/prism\/sessions\/[^/]+\/turns$/)) {
        const parts = path.split('/');
        const sid = parts[4];
        const session = state.sessions.find(function (s) { return s.id === sid; });
        if (!session) return mockFail(rid, 'FORBIDDEN', '会话不存在或已过期');
        const text = (body.raw_text || '').trim();
        if (!text) return mockFail(rid, 'CONTENT_BLOCKED', '请输入观点或思辨类问题');
        const mod = moderate(text);
        if (mod.blocked) {
          if (mod.risk_level === 'high') {
            return mockFail(rid, 'HIGH_RISK_ESCALATION', '检测到可能涉及高危内容，已转入专门处置通道，未进入普通匹配', { user_action: 'support' });
          }
          return mockFail(rid, 'CONTENT_BLOCKED', '检测到辱骂、攻击或对立引战内容，已拦截', { user_action: 'rewrite' });
        }
        // 召回匹配
        const candidates = [];
        // 从预制库
        PRESET_KNOWLEDGE.forEach(function (k) {
          if (!body.topic_id || k.topic_id === body.topic_id) {
            candidates.push({ source: 'preset', item: k, score: semanticScore(text, k) });
          }
        });
        // 从用户授权入库
        state.knowledgeItems.forEach(function (k) {
          if (k.state === 'active' && (!body.topic_id || k.topic_id === body.topic_id)) {
            candidates.push({ source: 'user_kb', item: k, score: semanticScore(text, k) });
          }
        });
        // 重排：按分数降序
        candidates.sort(function (a, b) { return b.score - a.score; });
        const turnId = genId('turn');
        const turn = {
          id: turnId,
          session_id: sid,
          prompt: { raw_text: text, identity_mode: body.identity_mode || 'anonymous', topic_id: body.topic_id },
          status: 'processing',
          candidate: null,
          ai: null,
          created_at: Date.now()
        };
        // 把 turn 持久化到 state.turns（Demo 内内存中保留，便于轮询查询）
        state.turns.push(turn);
        save();
        // 异步处理（Demo 用 setTimeout 模拟 SSE 阶段反馈）
        setTimeout(function () {
          if (candidates.length === 0 || candidates[0].score < 0.05) {
            turn.status = 'no_match';
            turn.no_match_reason = 'NO_MATCH';
          } else {
            const top = candidates[0].item;
            const ai = prismProcess(top.canonical_answer, text);
            turn.candidate = { source_turn_id: top.id, canonical_question: top.canonical_question, original_answer: top.canonical_answer, author_mode: top.author_mode, score: top.score || candidates[0].score };
            turn.ai = ai;
            turn.status = 'result';
          }
          save();
        }, 1500);
        // 立即返回 turn 状态：processing
        return { request_id: rid, data: turn, meta: meta };
      }
      // —— GET /v1/prism/sessions/{id}/turns/{turnId} ——
      if (method === 'GET' && path.match(/^\/v1\/prism\/sessions\/[^/]+\/turns\/[^/]+$/)) {
        const parts = path.split('/');
        const sid = parts[4];
        const tid = parts[6];
        const session = state.sessions.find(function (s) { return s.id === sid; });
        if (!session) return mockFail(rid, 'FORBIDDEN', '会话不存在');
        const turn = state.turns.find(function (t) { return t.id === tid; });
        if (!turn) return mockFail(rid, 'NOT_FOUND', '轮次不存在或已过期');
        return { request_id: rid, data: turn, meta: meta };
      }
      // —— POST /v1/prism/sessions/{id}/close ——
      if (method === 'POST' && path.match(/^\/v1\/prism\/sessions\/[^/]+\/close$/)) {
        const parts = path.split('/');
        const sid = parts[4];
        const session = state.sessions.find(function (s) { return s.id === sid; });
        if (session) { session.status = 'closed'; session.closed_at = Date.now(); save(); }
        return { request_id: rid, data: { closed: true }, meta: meta };
      }
      // —— POST /v1/decisions/publication ——
      if (method === 'POST' && path === '/v1/decisions/publication') {
        // 用 source_turn_id 直接定位
        const t = state.turns.find(function (x) { return x.id === body.source_turn_id; });
        if (!t) return mockFail(rid, 'FORBIDDEN', '没有可发布的本轮问答');
        if (t.status !== 'result') return mockFail(rid, 'CONSENT_REQUIRED', '当前轮次未完成，无法发布');
        const pub = {
          id: genId('pub'),
          source_turn_id: t.id,
          topic_id: body.topic_id || t.prompt.topic_id,
          author_mode: body.author_mode || 'anonymous',
          question: t.prompt.raw_text,
          original_answer: t.candidate ? t.candidate.original_answer : '',
          ai_summary: t.ai ? t.ai.summary : '',
          ai_body: t.ai ? t.ai.body : '',
          poetic_phrase: t.ai ? t.ai.poetic_phrase : '',
          ai_tag: '【本内容为AI阐释优化版，非用户原始原文】',
          stats: { quoted: 0, matched: 0, reused: 0 },
          created_at: Date.now(),
          comments: []
        };
        state.publications.push(pub);
        save();
        return { request_id: rid, data: pub, meta: meta };
      }
      // —— POST /v1/decisions/knowledge-consent ——
      if (method === 'POST' && path === '/v1/decisions/knowledge-consent') {
        if (body.consent !== 'granted') {
          return { request_id: rid, data: { consent: 'denied', state: 'denied' }, meta: meta };
        }
        const t = state.turns.find(function (x) { return x.id === body.source_turn_id; });
        if (!t) return mockFail(rid, 'FORBIDDEN', '没有可入库的本轮问答');
        const item = {
          id: genId('ki'),
          owner_user_id: state.user.zhihu_user_id_hash,
          source_turn_id: t.id,
          topic_id: t.prompt.topic_id,
          question: t.prompt.raw_text,
          original_answer: t.candidate ? t.candidate.original_answer : '',
          ai_summary: t.ai ? t.ai.summary : '',
          ai_body: t.ai ? t.ai.body : '',
          state: 'active',
          consent_at: Date.now(),
          consent_version: 1
        };
        state.knowledgeItems.push(item);
        save();
        return { request_id: rid, data: item, meta: meta };
      }
      // —— GET /v1/feed ——
      if (method === 'GET' && path.startsWith('/v1/feed')) {
        const u = new URL('http://x' + path);
        const topicSlug = u.searchParams.get('topic');
        const topicObj = TOPICS.find(function (t) { return t.slug === topicSlug; });
        const topicId = topicObj ? topicObj.id : null;
        const all = PRESET_PUBLICATIONS.concat(state.publications);
        const filtered = topicId ? all.filter(function (p) { return p.topic_id === topicId; }) : all;
        const sorted = filtered.slice().sort(function (a, b) { return b.created_at - a.created_at; });
        return { request_id: rid, data: { items: sorted, next_cursor: '' }, meta: meta };
      }
      // —— GET /v1/publications/{id} ——
      if (method === 'GET' && path.match(/^\/v1\/publications\/[^?]+/)) {
        const parts = path.split('?')[0].split('/');
        const pid = parts[3];
        const all = PRESET_PUBLICATIONS.concat(state.publications);
        const pub = all.find(function (p) { return p.id === pid; });
        if (!pub) return mockFail(rid, 'NOT_FOUND', '帖子不存在或已下架');
        return { request_id: rid, data: pub, meta: meta };
      }
      // —— POST /v1/publications/{id}/interactions ——
      if (method === 'POST' && path.match(/^\/v1\/publications\/[^/]+\/interactions$/)) {
        const parts = path.split('/');
        const pid = parts[3];
        const kind = body.type;
        const key = kind === 'like' ? 'likes' : kind === 'favorite' ? 'favorites' : kind === 'follow' ? 'follows' : null;
        if (!key) return mockFail(rid, 'BAD_REQUEST', '不支持的互动类型');
        const exists = state.interactions[key].indexOf(pid);
        if (body.action === 'add' && exists < 0) state.interactions[key].push(pid);
        if (body.action === 'remove' && exists >= 0) state.interactions[key].splice(exists, 1);
        save();
        return { request_id: rid, data: { type: kind, action: body.action, count: state.interactions[key].length }, meta: meta };
      }
      // —— POST /v1/publications/{id}/comments ——
      if (method === 'POST' && path.match(/^\/v1\/publications\/[^/]+\/comments$/)) {
        const parts = path.split('/');
        const pid = parts[3];
        const all = PRESET_PUBLICATIONS.concat(state.publications);
        const pub = all.find(function (p) { return p.id === pid; });
        if (!pub) return mockFail(rid, 'NOT_FOUND', '帖子不存在');
        const c = { id: genId('c'), author_mode: body.author_mode || 'anonymous', body: body.body, created_at: Date.now(), replies: [] };
        if (body.parent_id) {
          // 二级回复
          (function walk(arr) {
            arr.some(function (item) {
              if (item.id === body.parent_id) { item.replies.push(c); return true; }
              return walk(item.replies);
            });
          })(pub.comments);
        } else {
          pub.comments.push(c);
        }
        save();
        return { request_id: rid, data: c, meta: meta };
      }
      // —— GET /v1/me/knowledge-items ——
      if (method === 'GET' && path.startsWith('/v1/me/knowledge-items')) {
        return { request_id: rid, data: { items: state.knowledgeItems, next_cursor: '' }, meta: meta };
      }
      // —— POST /v1/me/knowledge-items/{id}/revoke ——
      if (method === 'POST' && path.match(/^\/v1\/me\/knowledge-items\/[^/]+\/revoke$/)) {
        const parts = path.split('/');
        const kid = parts[4];
        const item = state.knowledgeItems.find(function (k) { return k.id === kid; });
        if (!item) return mockFail(rid, 'NOT_FOUND', '知识项不存在');
        item.state = 'revoked';
        item.revoked_at = Date.now();
        // 启动异步清理任务（Demo 立即完成）
        state.deletionJobs[kid] = { progress: 0, started_at: Date.now() };
        save();
        setTimeout(function () {
          state.deletionJobs[kid] = { progress: 100, completed_at: Date.now() };
          save();
        }, 600);
        return { request_id: rid, data: { id: kid, state: 'revoked', deletion_job: 'started' }, meta: meta };
      }
      // —— DELETE /v1/me/knowledge-items/{id} ——
      if (method === 'DELETE' && path.match(/^\/v1\/me\/knowledge-items\/[^/]+$/)) {
        const parts = path.split('?')[0].split('/');
        const kid = parts[4];
        const idx = state.knowledgeItems.findIndex(function (k) { return k.id === kid; });
        if (idx < 0) return mockFail(rid, 'NOT_FOUND', '知识项不存在');
        // 立即标记删除中
        state.deletionJobs[kid] = { progress: 0, started_at: Date.now() };
        save();
        setTimeout(function () {
          state.knowledgeItems.splice(idx, 1);
          state.deletionJobs[kid] = { progress: 100, completed_at: Date.now() };
          save();
        }, 800);
        return { request_id: rid, data: { id: kid, state: 'deleting', deletion_job: 'started' }, meta: meta };
      }
      // —— GET /v1/me/sessions ——
      if (method === 'GET' && path.startsWith('/v1/me/sessions')) {
        return { request_id: rid, data: { items: state.sessions, next_cursor: '' }, meta: meta };
      }
      // —— GET /v1/me/interactions ——
      if (method === 'GET' && path.startsWith('/v1/me/interactions')) {
        const u = new URL('http://x' + path);
        const kind = u.searchParams.get('kind');
        const key = kind === 'likes' ? 'likes' : kind === 'favorites' ? 'favorites' : 'follows';
        const ids = state.interactions[key] || [];
        const all = PRESET_PUBLICATIONS.concat(state.publications);
        const items = ids.map(function (id) { return all.find(function (p) { return p.id === id; }); }).filter(Boolean);
        return { request_id: rid, data: { items: items, next_cursor: '' }, meta: meta };
      }
      // —— GET /v1/me/messages ——
      if (method === 'GET' && path.startsWith('/v1/me/messages')) {
        const u = new URL('http://x' + path);
        const cat = u.searchParams.get('category');
        let items = PRESET_MESSAGES.slice();
        if (cat === 'community' || cat === 'prism') {
          items = items.filter(function (m) { return m.category === cat; });
        }
        items.sort(function (a, b) { return b.created_at - a.created_at; });
        const unread = items.filter(function (m) { return !m.read; }).length;
        return { request_id: rid, data: { items: items, unread: unread, next_cursor: '' }, meta: meta };
      }
      // —— POST /v1/me/messages/read ——
      if (method === 'POST' && path.startsWith('/v1/me/messages/read')) {
        const ids = (body && body.ids) || [];
        PRESET_MESSAGES.forEach(function (m) { if (ids.indexOf(m.id) >= 0) m.read = true; });
        return { request_id: rid, data: { ok: true }, meta: meta };
      }

      // —— 未匹配 ——
      return mockFail(rid, 'NOT_FOUND', 'Demo 路由未实现: ' + method + ' ' + path);
    } catch (e) {
      return mockFail(rid, 'INTERNAL', (e && e.message) || '内部错误');
    }
  }

  function mockFail(rid, code, message, opts) {
    const e = new Error(message);
    e.request_id = rid;
    e.code = code;
    e.retryable = false;
    e.user_action = (opts && opts.user_action) || null;
    return Promise.reject(e);
  }

  /* ====================================================================
   * 暴露给前端使用的便捷查询（非 HTTP，纯本地）
   * ==================================================================== */
  function findPublication(id) {
    const all = PRESET_PUBLICATIONS.concat(state.publications);
    return all.find(function (p) { return p.id === id; });
  }
  function getTopicsList() { return TOPICS; }
  function findTopic(slug) { return TOPICS.find(function (t) { return t.slug === slug; }); }
  function isLoggedIn() { return state.user.logged_in; }
  function ensureLogin() {
    if (!state.user.logged_in) {
      state.user.logged_in = true;
      save();
    }
  }
  // 获取指定轮次（用于 prism 页轮询）
  function getTurnById(turnId) {
    return state.turns.find(function (t) { return t.id === turnId; });
  }
  // 获取最新一次轮次
  function getLastTurn() {
    return state.turns[state.turns.length - 1] || null;
  }

  /* —— 初始化 —— */
  load();

  return {
    // 配置
    LS_KEY: LS_KEY,
    TOPICS: TOPICS,
    // 状态
    getState: function () { return state; },
    reset: reset,
    // HTTP mock 路由
    handleMock: handleMock,
    // 便捷方法
    getTopicsList: getTopicsList,
    findTopic: findTopic,
    findPublication: findPublication,
    isLoggedIn: isLoggedIn,
    ensureLogin: ensureLogin,
    getTurnById: getTurnById,
    getLastTurn: getLastTurn
  };
})();
