const { call, showError } = require('../../utils/api');
const { lostTypes, lostCategories } = require('../../utils/constants');
const { normalizePost } = require('../../utils/format');

function categoryName(key) {
  const item = lostCategories.find((category) => category.key === key);
  return item ? item.name : '失物';
}

Page({
  data: {
    types: lostTypes,
    categories: lostCategories,
    activeType: 'lost',
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
      channel: 'lost_found',
      type: this.data.activeType,
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

  selectType(event) {
    this.setData({
      activeType: event.currentTarget.dataset.key,
      posts: [],
      hasMore: true
    });
    this.loadPosts(true);
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
    wx.navigateTo({
      url: `/pages/publish/index?channel=lost_found&type=${this.data.activeType}`
    });
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/detail/index?id=${event.detail.id}`
    });
  }
});
