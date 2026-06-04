const { call, showError } = require('../../utils/api');

Page({
  data: {
    content: '',
    contact: '',
    submitting: false
  },

  onInput(event) {
    this.setData({
      [event.currentTarget.dataset.field]: event.detail.value
    });
  },

  submit() {
    if (this.data.submitting) return;
    const content = this.data.content.trim();
    if (content.length < 4) {
      wx.showToast({ title: '建议至少 4 个字', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    call('login', {
      action: 'submitFeedback',
      content,
      contact: this.data.contact.trim()
    })
      .then(() => {
        wx.showModal({
          title: '已收到',
          content: '感谢你的建议，我会在后台查看。',
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
