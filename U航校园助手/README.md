# 航校广场小程序 V2

这是一个微信小程序原生 + CloudBase 云开发的校园信息查询与互助工具 V2 骨架，当前包含：

- 表白墙：表白、祝福和校园墙内容独立展示
- 失物招领：失物/拾物发布、分类、找回标记
- 悬赏互助：代取、维修、学习互助等独立展示
- 物品交易：内置出物、收物两个模块
- 缘分抽签：按主题随机抽取学习生活同行
- 校园指南：常用链接、生活服务、新生指南、中航大公开通知缓存
- 我的：发布入口、个人统计、校园认证、管理员入口
- 治理后台：帖子审核、评论审核、举报处理、置顶精选、用户封禁、认证审核
- 分享海报：详情页生成本地分享图
- 云函数：登录、认证、帖子、评论、点赞、举报、用户治理、指南配置、公开通知爬取缓存

## 目录结构

```text
.
├─ miniprogram/              小程序前端
│  ├─ pages/                 页面
│  ├─ components/            公共组件
│  └─ utils/                 API、常量和格式化工具
├─ cloudfunctions/           CloudBase 云函数
│  ├─ login/                 OpenID 登录与用户初始化
│  ├─ post/                  帖子、评论、点赞、举报、审核
│  ├─ chat/                  缘分抽签与主题同行
│  ├─ guide/                 校园指南配置和通知缓存读取
│  └─ spider/                中航大公开通知定时爬取缓存
├─ docs/                     初始化说明和示例数据
└─ project.config.json       微信开发者工具项目配置
```

## 启动步骤

1. 用微信开发者工具导入当前文件夹。
2. 当前 `project.config.json` 已配置小程序 AppID：`wxd14bb488ee7e9003`。
3. 当前 `miniprogram/app.js` 已配置云开发环境 ID：`cloud1-d1g1017agb2a55992`。
4. 在云开发控制台创建这些集合：
   - `users`
   - `posts`
   - `comments`
   - `likes`
   - `reports`
   - `bottle_draws`
   - `feedbacks`
   - `audit_logs`
   - `system_config`
   - `guide_services`
5. 右键 `cloudfunctions/login`、`cloudfunctions/post`、`cloudfunctions/chat`、`cloudfunctions/guide`、`cloudfunctions/spider`，分别选择“上传并部署：云端安装依赖”。
6. 运行小程序，先打开一次“我的”，让 `users` 集合自动生成当前用户。
7. 在云开发数据库把你的用户记录 `role` 改成 `admin`，再进入“我的 -> 治理后台”。
8. 在云开发控制台手动运行一次 `spider` 云函数，确认 `system_config.cauc_notices` 自动生成。

## 校园指南与中航大动态

指南页采用合规的“信息查询”流程：

- 静态入口读取 `system_config.guides`，前端只展示标题、说明和官方链接。
- 用户点击入口时，小程序弹窗说明外部网页限制，确认后复制链接到剪贴板。
- 中航大动态读取 `system_config.cauc_notices`，按来源模块展示公开通知、就业信息等标题、日期、来源类型、是否 PDF 和原链接。
- 快递站和打印店使用 `guide_services` 集合，普通用户可提交，提交内容通过微信内容安全后展示，列表按点赞量排序。
- `spider` 云函数只抓取公开页面列表，不抓正文，不访问需要登录的成绩、课表、校园卡等个人数据。

建议给 `spider` 云函数配置低频定时触发器，避免学校服务器把云函数 IP 判定为高频访问：

```text
0 0 */6 * * * *
```

默认抓取地址是：

```text
https://www.cauc.edu.cn/zhv5/index/tzgg.htm
```

如果学校页面改版，可在 `spider` 云函数环境变量里设置：

```text
CAUC_NOTICE_URL=https://www.cauc.edu.cn/zhv5/index/tzgg.htm
CAUC_NOTICE_LIMIT=5
SPIDER_MIN_INTERVAL_MINUTES=360
```

如果要增加公开来源，可以用 JSON 配置 `CAUC_NOTICE_SOURCES`，不要加入教务登录页、成绩、课表、校园卡等页面：

```json
[
  {
    "id": "cauc_notice",
    "name": "中国民航大学官网",
    "category": "通知公告",
    "url": "https://www.cauc.edu.cn/zhv5/index/tzgg.htm"
  },
  {
    "id": "cauc_jobs",
    "name": "中航大就业信息网",
    "category": "就业信息",
    "url": "http://cauc.bysjy.com.cn/"
  }
]
```

`SPIDER_MIN_INTERVAL_MINUTES` 默认是 `360`，也就是 6 小时内不会重复抓取同一公开页面。手动调试时可以在云函数测试参数里传：

```json
{
  "force": true
}
```

教务系统、网上服务大厅、成绩、课表、校园卡等涉及登录或个人隐私的数据不要加入爬虫，只在 `system_config.guides` 中配置官方链接，让用户复制后自行打开。

## 注册要求

用户不需要账号密码，但首次使用必须完成资料注册。注册会保存：

- `registered: true`
- `nickname`
- `gender: male | female`

未注册用户不能发布社区内容、评论、举报、使用缘分抽签或提交建议信。指南页、公开列表和快递打印榜属于信息查询工具层，可先查看；快递站/打印店投稿会绑定 OpenID 并经过微信内容安全检测。

开发者工具测试时，前端会自动跳过注册页拦截，方便先看页面和列表效果；正式版仍然保留主要互动功能的注册要求。写入类动作，例如发布、评论、举报、抽签、建议信提交，后端仍会校验注册状态。

## 审核定位

提交审核时建议按“工具 - 信息查询”表达产品定位，首页突出失物招领、校园指南、校园信息查询，避免把产品描述成社区、论坛或陌生人社交。

审核说明可写：

```text
本小程序为校园信息查询与生活互助工具，包含表白墙、失物招领、悬赏互助、物品交易、缘分抽签和校园指南。用户提交内容会先通过微信官方内容安全接口检测，通过后展示；提供举报入口，后台支持删除、拒绝、封禁用户；物品交易不提供支付担保。
```

## 审核模式

`post` 云函数默认采用微信官方内容安全自动审核：文本通过 `msgSecCheck`、图片通过 `mediaCheckAsync` 提交检测后，帖子直接展示。

如果你想临时恢复“管理员先审后发”，可以在 `post` 云函数环境变量里设置：

```text
MANUAL_REVIEW_POSTS=true
```

评论同样默认通过微信官方文本安全检测后直接展示。如果你想让评论也进入人工审核队列，可以在 `post` 云函数环境变量里设置：

```text
MANUAL_REVIEW_COMMENTS=true
```

缘分抽签不是实时聊天，使用 `chat` 云函数按需写入和随机抽取。女生每天可抽取 2 次，男生每天可抽取 1 次。

## 内容安全

`cloudfunctions/post/index.js` 已接入：

- 本地敏感词初筛
- 微信官方 `msgSecCheck` 文本安全检查
- 微信官方 `mediaCheckAsync` 图片异步安全检查

`cloudfunctions/chat/index.js` 已接入文本敏感词和 `msgSecCheck`，用于投递和抽取缘分签。

注意：

- 只有 `msgSecCheck` 返回 `suggest: pass` 时才会写入数据库。
- 如果检测结果为 `risky`、`review`，或接口调用失败，会直接拒绝保存并提示用户修改或稍后重试。
- 图片会提交微信 `mediaCheckAsync`；如果图片安全检测提交失败，也会拒绝保存。
- 内容安全能力需要真实 AppID、云环境和云函数部署完整后才能稳定调用。

## V2 新增后台能力

- 帖子：通过、拒绝、删除、置顶、精选
- 评论：通过、拒绝、删除、举报处理
- 用户：封禁、解封
- 认证：通过、拒绝、重置

用户被封禁后，`post` 云函数会拒绝其发布、评论、点赞、举报等操作。管理员账号需要保持 `role=admin` 且 `status=active`。

## 数据集合

核心字段见 [docs/database.md](docs/database.md)。

## 后续建议

下一版优先补：

- 后台搜索和按 OpenID/关键词筛选
- 评论回复楼中楼
- 指南后台可视化编辑
- 活动报名表单
- 多校区配置
- 小程序码海报，替换当前纯文本海报
