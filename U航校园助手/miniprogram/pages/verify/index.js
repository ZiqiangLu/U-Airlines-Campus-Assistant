const { call, showError } = require('../../utils/api');
const { verificationNames } = require('../../utils/constants');

Page({
  data: {
    user: null,
    verificationNames,
    school: '',
    college: '',
    studentNoSuffix: '',
    realNameHint: '',
    submitting: false
  },

  onLoad() {
    this.loadUser();
  },

  loadUser() {
    call('login')
      .then((result) => {
        const user = result.user || {};
        this.setData({
          user,
          school: user.school || '',
          college: user.college || '',
          studentNoSuffix: user.studentNoSuffix || '',
          realNameHint: user.realNameHint || ''
        });
      })
      .catch(showError);
  },

  onInput(event) {
    this.setData({
      [event.currentTarget.dataset.field]: event.detail.value
    });
  },

  submit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });

    call('login', {
      action: 'submitVerification',
      school: this.data.school,
      college: this.data.college,
      studentNoSuffix: this.data.studentNoSuffix,
      realNameHint: this.data.realNameHint
    })
      .then((result) => {
        getApp().globalData.user = result.user;
        wx.showModal({
          title: '已提交',
          content: '认证信息已进入后台审核。',
          showCancel: false,
          success: () => wx.navigateBack()
        });
      })
      .catch(showError)
      .finally(() => {
        this.setData({ submitting: false });
      });
  }
});
