const { call, showError } = require('../../utils/api');
const {
  squareTopics,
  lostTypes,
  lostCategories,
  marketCategories,
  marketTypes,
  helpCategories,
  publishChannels
} = require('../../utils/constants');

Page({
  data: {
    channel: 'square',
    channelName: '表白墙',
    placeholder: '',
    topics: squareTopics.filter((item) => item.key !== 'all'),
    lostTypes,
    lostCategories: lostCategories.filter((item) => item.key !== 'all'),
    marketTypes,
    marketCategories: marketCategories.filter((item) => item.key !== 'all'),
    helpCategories: helpCategories.filter((item) => item.key !== 'all'),
    topic: 'confession',
    type: 'lost',
    category: 'other',
    title: '',
    content: '',
    location: '',
    contact: '',
    price: '',
    anonymous: true,
    images: [],
    submitting: false,
    uploading: false
  },

  onLoad(options) {
    const channel = options.channel || 'square';
    const meta = publishChannels[channel] || publishChannels.square;
    const defaultCategory = channel === 'market' ? 'daily' : channel === 'partner' ? 'reward' : 'treehole';
    const defaultType = channel === 'market' ? 'sell' : 'lost';
    this.setData({
      channel,
      channelName: meta.name,
      placeholder: meta.placeholder,
      topic: options.topic || 'confession',
      type: options.type || defaultType,
      category: options.category || defaultCategory
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [field]: event.detail.value
    });
  },

  onAnonymousChange(event) {
    this.setData({ anonymous: event.detail.value });
  },

  selectTopic(event) {
    this.setData({ topic: event.currentTarget.dataset.key });
  },

  selectType(event) {
    this.setData({ type: event.currentTarget.dataset.key });
  },

  selectCategory(event) {
    this.setData({ category: event.currentTarget.dataset.key });
  },

  chooseImage() {
    const remain = 6 - this.data.images.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传 6 张图片', icon: 'none' });
      return;
    }

    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.uploadImages(res.tempFilePaths || []);
      }
    });
  },

  uploadImages(paths) {
    if (!paths.length) return;
    this.setData({ uploading: true });
    wx.showLoading({ title: '上传中' });

    const tasks = paths.map((path) => {
      const suffix = path.match(/\.[^.]+$/);
      const ext = suffix ? suffix[0] : '.jpg';
      const cloudPath = `ugc/${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
      return wx.cloud.uploadFile({ cloudPath, filePath: path }).then((res) => res.fileID);
    });

    Promise.all(tasks)
      .then((fileIDs) => {
        this.setData({
          images: this.data.images.concat(fileIDs)
        });
      })
      .catch(showError)
      .finally(() => {
        this.setData({ uploading: false });
        wx.hideLoading();
      });
  },

  removeImage(event) {
    const index = event.currentTarget.dataset.index;
    const images = this.data.images.slice();
    images.splice(index, 1);
    this.setData({ images });
  },

  submit() {
    if (this.data.submitting || this.data.uploading) return;

    const content = this.data.content.trim();
    const title = this.data.title.trim();

    if (content.length < 4) {
      wx.showToast({ title: '内容至少 4 个字', icon: 'none' });
      return;
    }

    if (this.data.channel !== 'square' && title.length < 2) {
      wx.showToast({ title: '请写标题', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    call('post', {
      action: 'create',
      channel: this.data.channel,
      topic: this.data.topic,
      type: this.data.type,
      category: this.data.category,
      title,
      content,
      location: this.data.location.trim(),
      contact: this.data.contact.trim(),
      price: this.data.price.trim(),
      anonymous: this.data.anonymous,
      images: this.data.images
    })
      .then((result) => {
        wx.showModal({
          title: '已提交',
          content: result.status === 'visible' ? '内容已发布。' : '内容已进入审核队列，通过后展示。',
          showCancel: false,
          success: () => {
            const pages = getCurrentPages();
            if (pages.length > 1) {
              wx.navigateBack();
            } else {
              wx.switchTab({ url: '/pages/home/index' });
            }
          }
        });
      })
      .catch(showError)
      .finally(() => {
        this.setData({ submitting: false });
      });
  }
});
