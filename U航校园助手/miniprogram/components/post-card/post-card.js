const { normalizePost } = require('../../utils/format');

Component({
  properties: {
    post: {
      type: Object,
      value: {}
    },
    compact: {
      type: Boolean,
      value: false
    }
  },

  observers: {
    post(value) {
      this.setData({
        viewPost: normalizePost(value || {})
      });
    }
  },

  data: {
    viewPost: {}
  },

  methods: {
    onOpen() {
      this.triggerEvent('open', { id: this.data.post._id });
    },

    onLike() {
      this.triggerEvent('like', { id: this.data.post._id });
    }
  }
});
