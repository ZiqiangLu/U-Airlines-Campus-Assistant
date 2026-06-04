# 数据库集合说明

## `users`

```js
{
  openid: string,
  role: 'user' | 'admin',
  status: 'active' | 'banned',
  registered: boolean,
  gender: 'male' | 'female' | '',
  verificationStatus: 'none' | 'pending' | 'verified' | 'rejected',
  school: string,
  college: string,
  studentNoSuffix: string,
  realNameHint: string,
  verificationSubmittedAt: Date,
  verificationReviewedAt: Date,
  verificationReviewerOpenid: string,
  banReason: string,
  bannedAt: Date,
  bannedByOpenid: string,
  nickname: string,
  avatarUrl: string,
  postCount: number,
  likeReceivedCount: number,
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date
}
```

## `feedbacks`

用户写给开发者的建议信：

```js
{
  authorOpenid: string,
  userId: string,
  nickname: string,
  content: string,
  contact: string,
  status: 'pending' | 'handled',
  createdAt: Date,
  updatedAt: Date
}
```

上线前至少手动把一个用户设为管理员：

```js
{
  role: 'admin',
  status: 'active'
}
```

## `posts`

```js
{
  authorOpenid: string,
  authorVerificationStatus: 'none' | 'pending' | 'verified' | 'rejected',
  channel: 'square' | 'lost_found' | 'market' | 'partner',
  topic: 'confession' | 'treehole' | 'qa' | 'rant' | 'notice',
  type: 'lost' | 'found',
  category: string,
  title: string,
  content: string,
  location: string,
  contact: string,
  price: string,
  images: string[],
  anonymous: boolean,
  status: 'pending' | 'visible' | 'rejected' | 'deleted',
  resolved: boolean,
  pinned: boolean,
  featured: boolean,
  likeCount: number,
  commentCount: number,
  reportCount: number,
  viewCount: number,
  createdAt: Date,
  updatedAt: Date,
  reviewedAt: Date,
  reviewerOpenid: string
}
```

## `comments`

```js
{
  postId: string,
  postAuthorOpenid: string,
  authorOpenid: string,
  content: string,
  anonymous: boolean,
  status: 'visible' | 'pending' | 'rejected' | 'deleted',
  likeCount: number,
  reportCount: number,
  createdAt: Date,
  updatedAt: Date
}
```

## `likes`

帖子点赞文档 ID 使用：

```text
${postId}_${openid}
```

字段：

```js
{
  postId: string,
  openid: string,
  createdAt: Date
}
```

## `reports`

举报文档 ID 使用：

```text
${targetType}_${targetId}_${openid}
```

字段：

```js
{
  targetType: 'post' | 'comment',
  targetId: string,
  postId: string,
  reporterOpenid: string,
  reason: string,
  status: 'pending' | 'handled',
  createdAt: Date,
  updatedAt: Date
}
```

## `audit_logs`

```js
{
  targetType: 'post' | 'comment' | 'user',
  targetId: string,
  action: string,
  operatorOpenid: string,
  createdAt: Date
}
```

## 缘分抽签字段

缘分抽签和主题同行复用 `posts` 集合，核心字段：

```js
{
  channel: 'friend',
  topic: 'bottle',
  type: 'bottle',
  category: 'fate' | 'study' | 'meal' | 'sport' | 'activity' | 'life',
  targetGender: 'all' | 'male' | 'female',
  userGender: 'male' | 'female',
  bottleStatus: 'active',
  status: 'visible' | 'pending' | 'deleted',
  content: string
}
```

## `bottle_draws`

每日抽签次数记录：

```js
{
  openid: string,
  gender: 'male' | 'female',
  day: 'YYYY-MM-DD',
  count: number,
  limit: number,
  lastBottleId: string,
  createdAt: Date,
  updatedAt: Date
}
```

## `system_config`

当前使用 `guides` 文档保存校园指南静态入口：

```js
{
  _id: 'guides',
  groups: [
    {
      title: string,
      items: [
        {
          title: string,
          desc: string,
          url: string
        }
      ]
    }
  ],
  updatedAt: Date,
  operatorOpenid: string
}
```

`cauc_notices` 文档保存中航大公开通知缓存，由 `spider` 云函数定时覆盖写入：

```js
{
  _id: 'cauc_notices',
  sources: [
    {
      id: string,
      name: string,
      category: string,
      url: string
    }
  ],
  items: [
    {
      title: string,
      date: 'YYYY-MM-DD',
      url: string,
      category: string,
      sourceName: string,
      sourceUrl: string,
      isPdf: boolean,
      fetchedAt: Date
    }
  ],
  sourceName: string,
  sourceUrl: string,
  category: string,
  updatedAt: Date,
  minIntervalMinutes: number,
  parserVersion: string
}
```

注意：这里只缓存公开页面的标题、日期、来源类型、是否 PDF 和原链接，不保存通知正文，也不抓取需要登录的成绩、课表、校园卡等个人信息。涉及教务系统、网上服务大厅等敏感入口时，只在 `guides` 中配置官方链接，由用户复制后自行打开。

## `guide_services`

快递站、打印店用户投稿榜，按点赞数展示：

```js
{
  type: 'courier' | 'print',
  title: string,
  location: string,
  desc: string,
  contact: string,
  authorOpenid: string,
  status: 'visible' | 'deleted',
  likeCount: number,
  likedOpenids: string[],
  reportCount: number,
  createdAt: Date,
  updatedAt: Date
}
```

投稿会先通过微信官方 `msgSecCheck`，再进入列表。

## 建议索引

建议在云开发数据库控制台给下面查询建立索引：

- `posts`: `status + channel + createdAt`
- `posts`: `status + channel + topic + createdAt`
- `posts`: `status + channel + type + category + createdAt`
- `posts`: `reportCount + status`
- `comments`: `postId + status + createdAt`
- `comments`: `status + createdAt`
- `comments`: `reportCount + status`
- `users`: `openid`
- `users`: `status + updatedAt`
- `users`: `verificationStatus + updatedAt`
- `posts`: `channel + topic + status + bottleStatus + targetGender`
- `bottle_draws`: `openid + day`
- `feedbacks`: `status + createdAt`
- `guide_services`: `type + status + likeCount + updatedAt`
