const squareTopics = [
  { key: 'all', name: '全部' },
  { key: 'confession', name: '表白' },
  { key: 'treehole', name: '校园墙' },
  { key: 'qa', name: '问答' },
  { key: 'rant', name: '吐槽' },
  { key: 'notice', name: '公告' }
];

const lostTypes = [
  { key: 'lost', name: '我丢了' },
  { key: 'found', name: '我捡到' }
];

const lostCategories = [
  { key: 'all', name: '全部' },
  { key: 'card', name: '校园卡' },
  { key: 'digital', name: '数码' },
  { key: 'key', name: '钥匙' },
  { key: 'book', name: '书本' },
  { key: 'id', name: '证件' },
  { key: 'other', name: '其他' }
];

const marketCategories = [
  { key: 'all', name: '全部' },
  { key: 'book', name: '教材书籍' },
  { key: 'digital', name: '数码配件' },
  { key: 'daily', name: '生活用品' },
  { key: 'sport', name: '运动户外' },
  { key: 'beauty', name: '服饰用品' },
  { key: 'other', name: '其他' }
];

const marketTypes = [
  { key: 'sell', name: '出物' },
  { key: 'buy', name: '收物' }
];

const helpCategories = [
  { key: 'all', name: '全部' },
  { key: 'reward', name: '悬赏' },
  { key: 'errand', name: '代取' },
  { key: 'study', name: '学习互助' },
  { key: 'repair', name: '维修' },
  { key: 'other', name: '其他' }
];

const friendCategories = [
  { key: 'all', name: '全部' },
  { key: 'chat', name: '缘分抽签' },
  { key: 'study', name: '学习' },
  { key: 'sport', name: '运动' },
  { key: 'activity', name: '活动' },
  { key: 'other', name: '其他' }
];

const channelNames = {
  square: '表白墙',
  lost_found: '失物招领',
  market: '物品交易',
  partner: '悬赏互助',
  friend: '缘分抽签'
};

const statusNames = {
  active: '正常',
  banned: '已封禁',
  pending: '待审核',
  visible: '已通过',
  rejected: '已拒绝',
  deleted: '已删除'
};

const verificationNames = {
  none: '未认证',
  pending: '认证待审',
  verified: '已认证',
  rejected: '认证被拒'
};

const genderNames = {
  male: '男生',
  female: '女生'
};

const targetGenderOptions = [
  { key: 'all', name: '所有人可见' },
  { key: 'male', name: '仅男生可见' },
  { key: 'female', name: '仅女生可见' }
];

const bottleCategories = [
  { key: 'all', name: '全部' },
  { key: 'fate', name: '缘分抽签' },
  { key: 'study', name: '学习同行' },
  { key: 'meal', name: '就餐同行' },
  { key: 'sport', name: '运动同行' },
  { key: 'activity', name: '活动同行' },
  { key: 'life', name: '生活互助' }
];

const publishChannels = {
  square: {
    name: '表白墙',
    placeholder: '写下想公开展示的表白、祝福或校园墙内容。通过内容安全检测后展示。'
  },
  lost_found: {
    name: '失物招领',
    placeholder: '描述物品特征、地点、时间和联系办法，避免公开过多隐私。'
  },
  market: {
    name: '物品交易',
    placeholder: '描述出物或收物需求、价格、成色和联系办法。平台只做信息展示，不提供交易担保。'
  },
  partner: {
    name: '悬赏互助',
    placeholder: '说明悬赏事项、时间地点、报酬或感谢方式。通过内容安全检测后展示。'
  }
};

const guideGroups = [
  {
    title: '常用入口',
    items: [
      { title: '中航大官网', desc: '学校官网、公开通知和院系入口', url: 'https://www.cauc.edu.cn/' },
      { title: '本科生教育', desc: '教务处入口，选课、考试、培养相关信息', url: 'https://www.cauc.edu.cn/jwc/' },
      { title: '网上服务大厅', desc: '师生事务、报修、校园服务统一入口', url: 'https://i.cauc.edu.cn/' }
    ]
  },
  {
    title: '生活服务',
    items: [
      { title: '虚拟校园', desc: '校内楼宇、道路和服务点位置查询', url: 'https://map.cauc.edu.cn/' }
    ]
  },
  {
    title: '新生指南',
    items: [
      { title: '招生信息网', desc: '本科招生、招录政策和入学信息', url: 'https://www.cauc.edu.cn/zsb/' },
      { title: '校园卡', desc: '充值、挂失、补办说明', url: '' }
    ]
  }
];

module.exports = {
  squareTopics,
  lostTypes,
  lostCategories,
  marketCategories,
  marketTypes,
  helpCategories,
  friendCategories,
  channelNames,
  statusNames,
  verificationNames,
  genderNames,
  targetGenderOptions,
  bottleCategories,
  publishChannels,
  guideGroups
};
