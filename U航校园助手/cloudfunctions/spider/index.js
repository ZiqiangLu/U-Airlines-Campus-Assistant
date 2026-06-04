const cloud = require('wx-server-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const DEFAULT_NOTICE_URL = 'https://www.cauc.edu.cn/zhv5/index/tzgg.htm';
const DEFAULT_NOTICE_SOURCES = [
  {
    id: 'cauc_notice',
    name: '中国民航大学官网',
    category: '通知公告',
    url: DEFAULT_NOTICE_URL
  },
  {
    id: 'cauc_jobs',
    name: '中航大就业信息网',
    category: '就业信息',
    url: 'http://cauc.bysjy.com.cn/'
  }
];
const USER_AGENT = 'HKSquareGuideBot/1.0 (+WeChat Mini Program; public notice title cache)';
const DEFAULT_MIN_INTERVAL_MINUTES = 360;

function normalizeDate(text) {
  const full = `${text}`.match(/(20\d{2})[-./年](\d{1,2})[-./月](\d{1,2})/);
  if (full) {
    return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
  }

  const short = `${text}`.match(/(?:^|[\[\s])(\d{1,2})[-/](\d{1,2})(?:\]|[\s\u4e00-\u9fa5]|$)/);
  if (!short) return '';
  return `${new Date().getFullYear()}-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}`;
}

function compactText(text) {
  return `${text || ''}`.replace(/\s+/g, ' ').trim();
}

function dedupeTitle(text) {
  const title = compactText(text)
    .replace(/^(20\d{2})[-./年](\d{1,2})[-./月](\d{1,2})\s*/, '')
    .replace(/^\[?\d{1,2}[-/]\d{1,2}\]?\s*/, '')
    .replace(/^[-–—·\s]+/, '');

  const parts = title.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.length % 2 === 0) {
    const half = parts.length / 2;
    const left = parts.slice(0, half).join('');
    const right = parts.slice(half).join('');
    if (left === right) return parts.slice(0, half).join(' ');
  }

  const middle = Math.floor(title.length / 2);
  if (title.length > 8 && title.length % 2 === 0 && title.slice(0, middle) === title.slice(middle)) {
    return title.slice(0, middle).trim();
  }

  return title;
}

function isAllowedPublicUrl(url) {
  try {
    const parsed = new URL(url);
    const allowedHosts = ['www.cauc.edu.cn', 'cauc.edu.cn', 'cauc.bysjy.com.cn'];
    const allowedProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    return allowedProtocol && (allowedHosts.includes(parsed.hostname) || parsed.hostname.endsWith('.cauc.edu.cn'));
  } catch (error) {
    return false;
  }
}

function normalizeUrl(href, baseUrl) {
  if (!href || /^javascript:/i.test(href) || /^mailto:/i.test(href)) return '';
  try {
    const url = new URL(href, baseUrl).href;
    return isAllowedPublicUrl(url) ? url : '';
  } catch (error) {
    return '';
  }
}

function extractNotices(html, source, limit) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const notices = [];

  $('a[href]').each((_, element) => {
    if (notices.length >= limit) return false;

    const href = $(element).attr('href');
    const url = normalizeUrl(href, source.url);
    if (!url || seen.has(url)) return;

    const anchorText = compactText($(element).text());
    const parentText = compactText($(element).closest('li,tr,.item,.news,.news-list,.news_list,.list-item').text());
    const date = normalizeDate(`${anchorText} ${parentText}`);
    if (!date) return;

    const title = dedupeTitle(anchorText);
    if (!title || title.length < 6 || title.length > 120) return;

    seen.add(url);
    notices.push({
      title,
      date,
      url,
      category: source.category,
      sourceName: source.name,
      sourceUrl: source.url,
      isPdf: /\.pdf($|\?)/i.test(url)
    });
  });

  return notices;
}

async function fetchNoticeHtml(sourceUrl) {
  const response = await axios.get(sourceUrl, {
    responseType: 'arraybuffer',
    timeout: 10000,
    maxRedirects: 3,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  return Buffer.from(response.data).toString('utf8').replace(/^\uFEFF/, '');
}

function safeSource(source, index) {
  const url = `${source.url || ''}`.trim();
  if (!url || !isAllowedPublicUrl(url)) return null;
  return {
    id: `${source.id || `source_${index}`}`.slice(0, 40),
    name: `${source.name || source.category || '公开来源'}`.slice(0, 40),
    category: `${source.category || source.name || '公开信息'}`.slice(0, 40),
    url
  };
}

function buildSources() {
  if (process.env.CAUC_NOTICE_SOURCES) {
    try {
      const parsed = JSON.parse(process.env.CAUC_NOTICE_SOURCES);
      const sources = Array.isArray(parsed) ? parsed.map(safeSource).filter(Boolean) : [];
      if (sources.length) return sources.slice(0, 5);
    } catch (error) {
      console.error('CAUC_NOTICE_SOURCES parse failed', error);
    }
  }

  if (process.env.CAUC_NOTICE_URL) {
    const source = safeSource({
      id: 'cauc_notice',
      name: '中国民航大学官网',
      category: '通知公告',
      url: process.env.CAUC_NOTICE_URL
    });
    if (source) return [source];
  }

  return DEFAULT_NOTICE_SOURCES.map(safeSource).filter(Boolean);
}

function minutesSince(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / 60000;
}

exports.main = async (event = {}) => {
  const sources = buildSources();
  const limit = Math.min(Math.max(Number(process.env.CAUC_NOTICE_LIMIT || 5), 1), 10);
  const minInterval = Math.max(Number(process.env.SPIDER_MIN_INTERVAL_MINUTES || DEFAULT_MIN_INTERVAL_MINUTES), 30);

  if (!sources.length) {
    return {
      ok: false,
      message: '没有可抓取的公开来源'
    };
  }

  try {
    const oldCache = await db.collection('system_config').doc('cauc_notices').get().catch(() => null);
    const oldData = oldCache && oldCache.data ? oldCache.data : null;
    if (!event.force && oldData && minutesSince(oldData.updatedAt) < minInterval) {
      return {
        ok: true,
        skipped: true,
        message: `距离上次抓取不足 ${minInterval} 分钟，已跳过以保护学校服务器`,
        count: Array.isArray(oldData.items) ? oldData.items.length : 0,
        items: Array.isArray(oldData.items) ? oldData.items : [],
        sources: oldData.sources || [],
        updatedAt: oldData.updatedAt
      };
    }

    const fetchedAt = new Date();
    const items = [];
    const errors = [];

    for (const source of sources) {
      try {
        const html = await fetchNoticeHtml(source.url);
        items.push(
          ...extractNotices(html, source, limit).map((item) => ({
            ...item,
            fetchedAt
          }))
        );
      } catch (error) {
        console.error('source fetch failed', source.url, error);
        errors.push({ sourceUrl: source.url, message: error.message });
      }
    }

    if (!items.length) {
      return {
        ok: false,
        message: '未解析到公开通知，已保留数据库中的旧缓存',
        sources,
        errors
      };
    }

    await db.collection('system_config').doc('cauc_notices').set({
      data: {
        items,
        sources,
        sourceName: sources.map((source) => source.name).join('、'),
        sourceUrl: sources[0].url,
        category: '公开信息',
        updatedAt: fetchedAt,
        minIntervalMinutes: minInterval,
        parserVersion: 'anchor-date-v1'
      }
    });

    return {
      ok: true,
      count: items.length,
      items,
      sources,
      errors,
      updatedAt: fetchedAt
    };
  } catch (error) {
    console.error('spider failed', error);
    return {
      ok: false,
      message: '公开通知抓取失败，已保留数据库中的旧缓存',
      error: error.message,
      sources
    };
  }
};
