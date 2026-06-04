const { call, showError } = require('../../utils/api');
const { helpCategories } = require('../../utils/constants');
const { normalizePost } = require('../../utils/format');

function categoryName(key) {
  const item = helpCategories.find((category) => category.key === key);
  return item ? item.name : '悬赏互助';
}

Page({
  data: {
    categories: helpCategories,
    activeCategory: 'all',
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
    const category = this.data.activeCategory === 'all' ? '' : this.data.activeCategory;

    return call('post', {
      action: 'list',
      channel: 'partner',
      category,
      skip,
      limit: 20
    })
      .then((result) => {
        const nextPosts = (result.posts || []).map((post) =>
          normalizePost({
            ...post,
            categoryName: categoryName(post.category)
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

  selectCategory(event) {
    this.setData({
      activeCategory: event.currentTarget.dataset.key,
      posts: [],
      hasMore: true
    });
    this.loadPosts(true);
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish/index?channel=partner&category=reward' });
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/index?id=${event.detail.id}` });
  }
});
