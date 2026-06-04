const { call, showError } = require('../../utils/api');
const { bottleCategories, targetGenderOptions, genderNames } = require('../../utils/constants');
const { relativeTime } = require('../../utils/format');

function findName(list, key, fallback) {
  const item = list.find((value) => value.key === key);
  return item ? item.name : fallback;
}

Page({
  data: {
    user: null,
    genderNames,
    categories: bottleCategories.filter((item) => item.key !== 'all'),
    filterCategories: bottleCategories,
    targetOptions: targetGenderOptions,
    selectedCategory: 'fate',
    filterCategory: 'all',
    targetGender: 'all',
    title: '',
    content: '',
    latest: [],
    currentBottle: null,
    drawState: null,
    loading: false,
    throwing: false,
    drawing: false
  },

  onLoad() {
    this.loadUser();
  },

  onShow() {
    this.loadUser();
    this.loadLatest();
  },

  onPullDownRefresh() {
    Promise.all([this.loadUser(), this.loadLatest()]).finally(() => wx.stopPullDownRefresh());
  },

  loadUser() {
    return call('login')
      .then((result) => {
        const user = result.user || {};
        getApp().globalData.user = user;
        this.setData({ user });
        if (user.gender) this.loadDrawState();
      })
      .catch(showError);
  },

  loadDrawState() {
    return call('chat', { action: 'drawState' })
      .then((result) => {
        this.setData({ drawState: result.drawState });
      })
      .catch(() => {});
  },

  loadLatest() {
    if (this.data.loading) return Promise.resolve();
    this.setData({ loading: true });

    const category = this.data.filterCategory === 'all' ? '' : this.data.filterCategory;
    return call('chat', {
      action: 'listLatest',
      category,
      limit: 20
    })
      .then((result) => {
        this.setData({
          latest: (result.bottles || []).map((item) => this.decorateBottle(item))
        });
      })
      .catch((error) => {
        if (error.message && error.message.indexOf('性别') >= 0) return;
        showError(error);
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  decorateBottle(item) {
    return {
      ...item,
      timeText: relativeTime(item.createdAt),
      categoryName: findName(bottleCategories, item.category, '缘分抽签'),
      targetGenderName: findName(targetGenderOptions, item.targetGender, '所有人可见'),
      userGenderName: genderNames[item.userGender] || '同学'
    };
  },

  chooseGender() {
    wx.showActionSheet({
      itemList: ['男生', '女生'],
      success: (res) => {
        const gender = res.tapIndex === 0 ? 'male' : 'female';
        call('login', {
          action: 'updateGender',
          gender
        })
          .then((result) => {
            getApp().globalData.user = result.user;
            this.setData({ user: result.user });
            wx.showToast({ title: '已保存', icon: 'success' });
            this.loadDrawState();
            this.loadLatest();
          })
          .catch(showError);
      }
    });
  },

  selectCategory(event) {
    this.setData({ selectedCategory: event.currentTarget.dataset.key });
  },

  selectFilter(event) {
    this.setData({ filterCategory: event.currentTarget.dataset.key });
    this.loadLatest();
  },

  selectTarget(event) {
    this.setData({ targetGender: event.currentTarget.dataset.key });
  },

  onInput(event) {
    this.setData({
      [event.currentTarget.dataset.field]: event.detail.value
    });
  },

  throwBottle() {
    if (!this.data.user || !this.data.user.gender) {
      wx.showToast({ title: '请先选择性别', icon: 'none' });
      return;
    }

    const content = this.data.content.trim();
    if (content.length < 4) {
      wx.showToast({ title: '内容至少 4 个字', icon: 'none' });
      return;
    }

    this.setData({ throwing: true });
    call('chat', {
      action: 'throwBottle',
      category: this.data.selectedCategory,
      targetGender: this.data.targetGender,
      title: this.data.title.trim(),
      content
    })
      .then(() => {
        wx.showToast({ title: '已投递', icon: 'success' });
        this.setData({
          title: '',
          content: '',
          targetGender: 'all'
        });
        this.loadLatest();
      })
      .catch(showError)
      .finally(() => {
        this.setData({ throwing: false });
      });
  },

  drawBottle() {
    if (!this.data.user || !this.data.user.gender) {
      wx.showToast({ title: '请先选择性别', icon: 'none' });
      return;
    }

    this.setData({ drawing: true });
    const category = this.data.filterCategory === 'all' ? '' : this.data.filterCategory;
    call('chat', {
      action: 'drawBottle',
      category
    })
      .then((result) => {
        this.setData({
          currentBottle: result.data ? this.decorateBottle(result.data) : null,
          drawState: result.drawState
        });
        wx.showToast({
          title: result.message || '已抽取',
          icon: 'none'
        });
      })
      .catch(showError)
      .finally(() => {
        this.setData({ drawing: false });
      });
  },

  report(event) {
    const id = event.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: ['广告或引流', '辱骂攻击', '泄露隐私', '其他违规'],
      success: (res) => {
        const reasons = ['广告或引流', '辱骂攻击', '泄露隐私', '其他违规'];
        call('chat', {
          action: 'report',
          id,
          reason: reasons[res.tapIndex]
        })
          .then(() => wx.showToast({ title: '已举报', icon: 'success' }))
          .catch(showError);
      }
    });
  }
});
