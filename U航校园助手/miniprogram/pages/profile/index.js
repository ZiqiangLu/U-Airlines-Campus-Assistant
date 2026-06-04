const { call, showError } = require('../../utils/api');
const { verificationNames, genderNames } = require('../../utils/constants');

Page({
  data: {
    user: null,
    verificationNames,
    genderNames,
    stats: {
      posts: 0,
      likes: 0,
      pending: 0,
      pendingComments: 0
    }
  },

  onShow() {
    this.loadProfile();
  },

  loadProfile() {
    call('login')
      .then((result) => {
        getApp().globalData.user = result.user;
        this.setData({ user: result.user });
        if (!result.user || !result.user.registered) {
          return { stats: this.data.stats };
        }
        return call('post', { action: 'stats' });
      })
      .then((result) => {
        this.setData({ stats: result.stats });
      })
      .catch(showError);
  },

  goPublishSquare() {
    wx.navigateTo({ url: '/pages/publish/index?channel=square&topic=confession' });
  },

  goPublishLost() {
    wx.navigateTo({ url: '/pages/publish/index?channel=lost_found&type=lost' });
  },

  goPublishMarket() {
    wx.navigateTo({ url: '/pages/publish/index?channel=market&type=sell' });
  },

  goPublishPartner() {
    wx.navigateTo({ url: '/pages/publish/index?channel=partner&category=reward' });
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/verify/index' });
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/index' });
  },

  goFeedback() {
    wx.navigateTo({ url: '/pages/feedback/index' });
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
          })
          .catch(showError);
      }
    });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index' });
  }
});
