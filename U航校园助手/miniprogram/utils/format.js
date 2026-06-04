function pad(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function relativeTime(value) {
  if (!value) return '';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';

  const diff = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return formatDate(value);
}

function normalizePost(post) {
  return {
    ...post,
    timeText: relativeTime(post.createdAt),
    fullTimeText: formatTime(post.createdAt)
  };
}

module.exports = {
  formatDate,
  formatTime,
  relativeTime,
  normalizePost
};
