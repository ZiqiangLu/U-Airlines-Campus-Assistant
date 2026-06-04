const { call, showError } = require('../../utils/api');
const { genderNames } = require('../../utils/constants');

Page({
  data: {
    nickname: '',
    gender: '',
    genderNames,
    submitting: false
  },

  onLoad() {
    call('login')
      .then((result) => {
        const user = result.user || {};
        this.setData({
          nickname: user.nickname || '',
          gender: user.gender || ''
        });
      })
      .catch(showError);
  },

  onInput(event) {
    this.setData({ nickname: event.detail.value });
  },

  chooseGender(event) {
    this.setData({ gender: event.currentTarget.dataset.gender });
  },

  submit() {
    if (this.data.submitting) return;
    const nickname = this.data.nickname.trim();
    if (!nickname || !this.data.gender) {
      wx.showToast({ title: '请填写昵称并选择性别', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    call('login', {
      action: 'register',
      nickname,
      gender: this.data.gender
    })
      .then((result) => {
        getApp().globalData.user = result.user;
        wx.showToast({ title: '注册完成', icon: 'success' });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/home/index' });
        }, 400);
      })
      .catch(showError)
      .finally(() => {
        this.setData({ submitting: false });
      });
  }
});
