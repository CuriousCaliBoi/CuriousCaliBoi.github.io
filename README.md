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

## Art and photographs

`/art/` combines a photo gallery, a keyboard-accessible lightbox, and a color sampler. The sampler reads actual pixels from the locally hosted photographs; it does not send anything to a server. Photos and attribution are defined in `_data/art.yml`, with files under `images/art/`. Add entries there to extend the gallery. Two photos are also shown on the homepage.

The initial photographs are Wikimedia Commons 1280-pixel thumbnails, otherwise unchanged. Homepage previews use CSS crops. The photograph licenses apply to the photographs, independently of the site's code:

- Mikhail Kalugin, [Sunset At Coyote Hills](https://commons.wikimedia.org/wiki/File:Sunset_At_Coyote_Hills_(55533170).jpeg), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Deodandem, [Coyote Hills Salt](https://commons.wikimedia.org/wiki/File:Coyote_Hills_Salt.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Sarah Sammis, [Coyote Hills 20140310](https://commons.wikimedia.org/wiki/File:Coyote_Hills_20140310_(20777120886).jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).

## Interactive posts

Add `interactive: true` to a post's front matter, then put an experiment block anywhere between its paragraphs:

```liquid
{% include experiment.html id="smallville" %}
```

Register the experiment in `_data/experiments.yml` with `title`, `url`, `embed_url`, `description`, `mode`, and `note`. URLs can be a local app or a trusted public HTTPS app that permits embedding. This supports fully interactive apps inside a post, not just videos. Inputs, sliders, visualizations, and server requests live in the embedded app itself. Nothing connects until the visitor presses **Connect to viewer**. Disconnect unloads the frame; it does not stop the server's experiment. The full viewer link also works without JavaScript.

Pokémon remains a spectator view. Smallville allows camera movement, agent following, and inspection of agents' minds. The MiniMax-H3 workbench at `/h3/` sends text-to-video jobs to the private DGX API configured in `/h3/live.json`; `?api=` can override that endpoint for local testing. These viewers report connection status to the parent post using `postMessage`; the parent checks both the source window and origin. For a new same-origin app, send `{ type: 'zuko:experiment-status', state: 'live', message: '...' }` (states: `live`, `wait`, or `off`) to `location.origin`. A frame's load event alone is labeled **Viewer loaded**, never treated as proof that the remote experiment is online.

To reuse the browser-only color sampler in a post:

```liquid
<div data-interactive-only hidden>{% include color-study.html %}</div>
```

GitHub Pages serves the article and client interface. Experiments that call a model or run computation need their own server, as the existing DGX viewers do. Keep API keys and model credentials on that server. Enforce authentication, input validation, and request limits there before exposing any new computation or write controls to visitors.
