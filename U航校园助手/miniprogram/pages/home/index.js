const { call, showError } = require('../../utils/api');
const { normalizePost } = require('../../utils/format');

Page({
  data: {
    confessionPosts: [],
    modules: [
      {
        title: '失物招领',
        desc: '丢失、拾到、找回标记',
        icon: '失',
        tone: 'lost',
        url: '/pages/lost/index'
      },
      {
        title: '悬赏互助',
        desc: '代取、维修、学习互助',
        icon: '赏',
        tone: 'help',
        url: '/pages/help/index'
      },
      {
        title: '物品交易',
        desc: '出物、收物分开展示',
        icon: '物',
        tone: 'market',
        url: '/pages/market/index'
      },
      {
        title: '缘分抽签',
        desc: '主题同行、学习生活互助',
        icon: '签',
        tone: 'chat',
        url: '/pages/chat/index'
      }
    ],
    loading: false
  },

  onLoad() {
    this.login();
    this.loadConfessions();
  },

  onShow() {
    this.loadConfessions();
  },

  onPullDownRefresh() {
    this.loadConfessions().finally(() => wx.stopPullDownRefresh());
  },

  login() {
    call('login')
      .then((result) => {
        getApp().globalData.user = result.user;
      })
      .catch(showError);
  },

  loadConfessions() {
    if (this.data.loading) return Promise.resolve();
    this.setData({ loading: true });

    return call('post', {
      action: 'list',
      channel: 'square',
      topic: 'confession',
      skip: 0,
      limit: 3
    })
      .then((result) => {
        this.setData({
          confessionPosts: (result.posts || []).map((post) =>
            normalizePost({
              ...post,
              topicName: '表白'
            })
          )
        });
      })
      .catch(showError)
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  openModule(event) {
    const url = event.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url });
  },

  openConfession() {
    wx.navigateTo({ url: '/pages/confession/index' });
  },

  publishConfession() {
    wx.navigateTo({ url: '/pages/publish/index?channel=square&topic=confession' });
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/index?id=${event.detail.id}` });
  }
});
