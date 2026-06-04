const { call, showError } = require('../../utils/api');
const { normalizePost } = require('../../utils/format');

Page({
  data: {
    posts: [],
    loading: false,
    hasMore: true
  },

  onLoad() {
    this.loadPosts(true);
  },

  onPullDownRefresh() {
    this.loadPosts(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore) this.loadPosts(false);
  },

  loadPosts(reset) {
    if (this.data.loading) return Promise.resolve();
    this.setData({ loading: true });

    const skip = reset ? 0 : this.data.posts.length;
    return call('post', {
      action: 'list',
      channel: 'square',
      topic: 'confession',
      skip,
      limit: 20
    })
      .then((result) => {
        const nextPosts = (result.posts || []).map((post) =>
          normalizePost({
            ...post,
            topicName: '表白'
          })
        );

        this.setData({
          posts: reset ? nextPosts : this.data.posts.concat(nextPosts),
          hasMore: nextPosts.length >= 20
        });
      })
      .catch(showError)
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish/index?channel=square&topic=confession' });
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/index?id=${event.detail.id}` });
  }
});
