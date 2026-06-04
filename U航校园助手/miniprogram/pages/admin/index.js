const { call, showError } = require('../../utils/api');
const { relativeTime } = require('../../utils/format');
const { channelNames, statusNames, verificationNames } = require('../../utils/constants');

Page({
  data: {
    tabs: [
      { key: 'postPending', name: '帖审', target: 'posts', status: 'pending' },
      { key: 'postReported', name: '举报帖', target: 'posts', status: 'reported' },
      { key: 'commentPending', name: '评审', target: 'comments', status: 'pending' },
      { key: 'commentReported', name: '举报评', target: 'comments', status: 'reported' },
      { key: 'verify', name: '认证', target: 'verifications', status: 'verification' },
      { key: 'users', name: '用户', target: 'users', status: 'all' }
    ],
    activeKey: 'postPending',
    activeTarget: 'posts',
    activeStatus: 'pending',
    items: [],
    loading: false
  },

  onLoad() {
    this.loadItems();
  },

  onPullDownRefresh() {
    this.loadItems().finally(() => wx.stopPullDownRefresh());
  },

  selectTab(event) {
    const key = event.currentTarget.dataset.key;
    const tab = this.data.tabs.find((item) => item.key === key);
    if (!tab) return;
    this.setData({
      activeKey: tab.key,
      activeTarget: tab.target,
      activeStatus: tab.status,
      items: []
    });
    this.loadItems();
  },

  loadItems() {
    this.setData({ loading: true });
    return call('post', {
      action: 'adminList',
      target: this.data.activeTarget,
      status: this.data.activeStatus,
      limit: 80
    })
      .then((result) => {
        const items = (result.items || result.posts || []).map((item) => this.decorateItem(item));
        this.setData({ items });
      })
      .catch((error) => {
        showError(error);
        if (error.message && error.message.indexOf('管理员') >= 0) {
          setTimeout(() => wx.navigateBack(), 800);
        }
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  decorateItem(item) {
    return {
      ...item,
      timeText: relativeTime(item.createdAt || item.updatedAt),
      channelText: channelNames[item.channel] || item.channel || '用户',
      statusText: statusNames[item.status] || item.status || '正常',
      verificationText: verificationNames[item.verificationStatus || 'none']
    };
  },

  auditPost(event) {
    const id = event.currentTarget.dataset.id;
    const auditAction = event.currentTarget.dataset.action;
    call('post', {
      action: 'audit',
      targetType: 'post',
      id,
      auditAction
    })
      .then(() => {
        wx.showToast({ title: '已处理', icon: 'success' });
        this.loadItems();
      })
      .catch(showError);
  },

  auditComment(event) {
    const id = event.currentTarget.dataset.id;
    const auditAction = event.currentTarget.dataset.action;
    call('post', {
      action: 'audit',
      targetType: 'comment',
      id,
      auditAction
    })
      .then(() => {
        wx.showToast({ title: '已处理', icon: 'success' });
        this.loadItems();
      })
      .catch(showError);
  },

  auditVerification(event) {
    const userId = event.currentTarget.dataset.id;
    const auditAction = event.currentTarget.dataset.action;
    call('post', {
      action: 'auditVerification',
      userId,
      auditAction
    })
      .then(() => {
        wx.showToast({ title: '已处理', icon: 'success' });
        this.loadItems();
      })
      .catch(showError);
  },

  setUserStatus(event) {
    const userId = event.currentTarget.dataset.id;
    const status = event.currentTarget.dataset.status;
    const title = status === 'banned' ? '确认封禁该用户？' : '确认解封该用户？';

    wx.showModal({
      title,
      content: status === 'banned' ? '封禁后该用户不能继续发布、评论和举报。' : '解封后用户可恢复正常操作。',
      success: (res) => {
        if (!res.confirm) return;
        call('post', {
          action: 'setUserStatus',
          userId,
          status,
          banReason: status === 'banned' ? '后台封禁' : ''
        })
          .then(() => {
            wx.showToast({ title: '已处理', icon: 'success' });
            this.loadItems();
          })
          .catch(showError);
      }
    });
  },

  openDetail(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/index?id=${id}` });
  }
});
