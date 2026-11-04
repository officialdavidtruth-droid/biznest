# Blog: Shopify model

Blogs hold articles. There is no category tree; articles are organised by blog and by tags.

| Shopify | BizNest |
|---|---|
| Blog (e.g. "News") | `Blog` (title, handle). Managed at Admin > Blog > Manage blogs |
| Article | `Article` (title, handle, excerpt, body, tags, image, author, SEO) |
| Visible / Hidden / publish date | `Article.publishedAt`: null = Hidden, past = Visible, future = Scheduled |
| /blogs/news/my-article | `/store/<slug>/blogs/<blog>/<article>` (`/blog` and `/blog/<article>` serve the first blog) |

Migration `20261128090000_shopify_style_blogs` moves BlogPost/BlogCategory data over: one "News" blog per store,
a post's category becomes a tag, drafts become Hidden. The "featured" pin is dropped (Shopify has no equivalent).
