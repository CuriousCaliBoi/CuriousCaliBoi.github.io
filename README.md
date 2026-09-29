# Zuko’s Blog

A Jekyll site for notes on code, mathematics, and creative computing, published at [curiouscaliboi.github.io](https://curiouscaliboi.github.io).

## Local preview

Use Ruby 3.3 and Bundler:

```sh
bundle install
bundle exec jekyll serve --host 127.0.0.1
```

Open http://127.0.0.1:4000. To verify the production build:

```sh
JEKYLL_ENV=production bundle exec jekyll build
```

The existing GitHub Pages publishing setup still works. No Node build is required.

## Writing

Writing and project entries are Markdown files in `_posts/`, with their existing date/category URLs. Project posts link to standalone live demos. Use `layout: post`, `title`, and `date` in the front matter. Optional fields:

- `subtitle`: a short introduction beneath the article title and on the homepage feature.
- `author`: overrides the default byline, Zuko.
- `date_format`: optional display format for dates. The Infinite Observatory retains its original month-only date (`%B %Y`); the first day of that month is used for sorting.
- `image` and `image_alt`: the preview image and its description when the post is featured as the latest entry.

The post title comes from the front matter, so start the body with paragraphs or `##` section headings. Posts with two or more `##`/`###` headings receive a contents sidebar, which becomes a collapsible panel on narrow screens. Reading and site navigation work without JavaScript; the contents and math rendering are progressive enhancements. Math uses KaTeX: `$...$` for inline math and `$$...$$` for display math. Fenced code uses Rouge.

The theme is in `_layouts/`, `_includes/`, `assets/main.scss`, and `assets/js/journal.js`. Existing model-atlas diagram styles live in `_sass/atlas.scss`. The Pokémon and Smallville viewers are standalone applications and retain their own interfaces.

## Design credit

The warm paper palette, serif reading experience, quiet navigation, and margin contents are inspired by [Wenhao Chai’s website](https://wenhaochai.com/), especially [Predictable Swarm Scaling](https://wenhaochai.com/blogs/predictable-swarm-scaling.html). The footer links to this reference. This is an independently written Jekyll implementation; the reference site’s code, article content, and imagery are not included.

[Newsreader](https://github.com/google/fonts/tree/main/ofl/newsreader) and [Inter](https://github.com/google/fonts/tree/main/ofl/inter) are served locally from `assets/fonts/`. The Latin WOFF2 files come from the Google Fonts CSS API. Their SIL Open Font License texts are included alongside the fonts. The monospace metadata uses system fonts.
