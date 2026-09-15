<div align="center">

# 4choor3.github.io

**站点构建产物 —— 请勿直接编辑此仓库**

<a href="https://4choor3.github.io"><img src="https://img.shields.io/badge/%E8%AE%BF%E9%97%AE%E7%AB%99%E7%82%B9-4choor3.github.io-4E9A4E?style=flat-square&logo=hexo&logoColor=white" alt="Site"></a>
<img src="https://img.shields.io/badge/Hexo-8.1.2-0E83CD?style=flat-square&logo=hexo&logoColor=white" alt="Hexo">
<img src="https://img.shields.io/badge/GitHub%20Pages-deployed-4E9A4E?style=flat-square&logo=githubpages&logoColor=white" alt="Pages">

</div>

## 这是什么

这里存放的是 **[4choor3.github.io](https://4choor3.github.io)** 的静态构建产物 —— 由 Hexo 8.1.2 + anzhiyu 主题生成后自动推送，属于机器可读的输出，不是人维护的源码。

> **源码是私有的，本仓库不接受针对 HTML / CSS / JS 的手动修改。**
> 所有内容改动都发生在 Hexo 源仓库，push 后经 GitHub Actions 构建并发布到这里。

## 发布机制

```
Hexo 源仓库  ──push──▶  GitHub Actions（构建 + 产物校验，校验 index.html / atom.xml / sitemap.xml）
                                 │
                                 ▼
                    peaceiris/actions-gh-pages@v4  ──▶  本仓库 main 分支
                                 │
                          force_orphan: true
                                 ▼
                         https://4choor3.github.io
```

关键点：部署使用 **`force_orphan: true`**，即每次发布都重建为单次孤儿提交 ——

- 本仓库**历史会被重置**，`git log` 只保留最近一次部署记录；
- 目录内容每次被**完整覆盖**，手工新增的文件（包括本 README）都会在下一次部署时消失；
- 本 README 由源仓库的构建钩子在生成阶段注入，因此能持续存在，但**不要在这里编辑它** —— 改了也不会留下来。

## 站点结构

| 路径 | 内容 |
|:---|:---|
| `/` | 首页（`index.html`） |
| `/2026/09/...` | 文章正文，permalink 形如 `/:year/:month/:day/:title/` |
| `/archives/` | 归档 |
| `/categories/`、`/tags/` | 分类与标签聚合 |
| `/about/`、`/equipment/`、`/room/` | 关于、装备、房间 |
| `/essay/`、`/album/`、`/music/` | 随笔、相册、音乐 |
| `/projects/`、`/link/` | 项目、友链 |
| `/atom.xml`、`/sitemap.xml`、`/sitemap.txt` | 订阅与站点地图 |
| `/search.xml` | 本地搜索索引 |
| `/anzhiyu/`、`/css/`、`/js/`、`/lib/`、`/img/` | 主题资源与静态文件 |

站点主题围绕 A 股量化、Python 工具链与 Linux 折腾记录。

## 想本地预览 / 提改动

构建产物无法直接改，正确路径是从源仓库出发（源码私有，如有协作需求请先开 issue 联系）：

```bash
npm install
npx hexo server     # http://localhost:4000
```

## 问题反馈

发现错别字、链接失效、样式异常等问题，欢迎在 [Issues](https://github.com/4choor3/4choor3.github.io/issues) 提出。内容会回到源仓库修正，而不是在此处原地修补。
