# Zuko’s Blog

A Jekyll site for notes on code, mathematics, and creative computing, published at [curiouscaliboi.github.io](https://curiouscaliboi.github.io).

## Design

Let the content speak for itself. Use plain titles, dates, and direct navigation.
Avoid promotional introductions, decorative labels, repeated calls to action,
and model or hardware branding outside relevant technical details. Descriptions
should be short, factual, and useful. Do not invent personal opinions or narration
for the author. Preserve source attribution and instructions needed to use a page.

The homepage lists writing by date. Art, Models, and Experiments have their own
indexes. The bird collection opens directly to the Pokédex.

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

Personal writing lives in `_posts/` and appears in Writing, its RSS feed, and previous/next article links. Live demos, project announcements, experiment reports, and republished articles belong under Experiments. Use `layout: post`, `title`, and `date` in the front matter. Optional fields:

- `author`: overrides the default byline, Zuko.
- `date_format`: optional display format for dates. The Infinite Observatory retains its original month-only date (`%B %Y`); the first day of that month is used for sorting.

The post title comes from the front matter, so start the body with paragraphs or `##` section headings. Posts with two or more `##`/`###` headings receive a contents sidebar, which becomes a collapsible panel on narrow screens. Reading and site navigation work without JavaScript; the contents and math rendering are progressive enhancements. Math uses KaTeX: `$...$` for inline math and `$$...$$` for display math. Fenced code uses Rouge.

The theme is in `_layouts/`, `_includes/`, `assets/main.scss`, and `assets/js/journal.js`. Existing model-atlas diagram styles live in `_sass/atlas.scss`. The Pokémon and Smallville viewers are standalone applications and retain their own interfaces.

List each experiment once in `_data/experiments.yml`; its `url` opens the project.
Supporting write-ups live in the `_experiment_notes/` collection. Add `notes_url`
to an existing entry when it has a substantial write-up. Moved documents retain
their published URLs through explicit `permalink` values. New notes default to
`/experiments/notes/:name/`. The collection uses Experiments navigation and is
excluded from the writing feed.

## Design credit

The warm paper palette, serif reading experience, quiet navigation, and margin contents are inspired by [Wenhao Chai’s website](https://wenhaochai.com/), especially [Predictable Swarm Scaling](https://wenhaochai.com/blogs/predictable-swarm-scaling.html). This is an independently written Jekyll implementation; the reference site’s code, article content, and imagery are not included.

[Newsreader](https://github.com/google/fonts/tree/main/ofl/newsreader) and [Inter](https://github.com/google/fonts/tree/main/ofl/inter) are served locally from `assets/fonts/`. The Latin WOFF2 files come from the Google Fonts CSS API. Their SIL Open Font License texts are included alongside the fonts. The monospace metadata uses system fonts.

## Art and photographs

`/art/` combines a photo gallery, a keyboard-accessible lightbox, and a color sampler. The sampler reads actual pixels from the locally hosted photographs; it does not send anything to a server. Photos and attribution are defined in `_data/art.yml`, with files under `images/art/`. Add entries there to extend the gallery.

The initial photographs are Wikimedia Commons 1280-pixel thumbnails, otherwise unchanged. The photograph licenses apply to the photographs, independently of the site's code:

- Mikhail Kalugin, [Sunset At Coyote Hills](https://commons.wikimedia.org/wiki/File:Sunset_At_Coyote_Hills_(55533170).jpeg), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Deodandem, [Coyote Hills Salt](https://commons.wikimedia.org/wiki/File:Coyote_Hills_Salt.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Sarah Sammis, [Coyote Hills 20140310](https://commons.wikimedia.org/wiki/File:Coyote_Hills_20140310_(20777120886).jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).

The painting practice studio at `/perspective/` is a standalone app in `perspective/`, linked from Art. Its markup, styles, and simulation are in `index.html`, `studio.css`, and `studio.js`. Choose **Move light** or **Move vanishing point**, then click or tap the scene to place it. Both handles also support dragging and arrow keys (Shift moves faster). Light depth and fill light sit above the scene; cube color, grayscale, and perspective guides sit below it. Settings are saved in the current browser. Lighting uses flat diffuse face values without cast shadows.

## Interactive posts

Add `interactive: true` to a post's front matter, then put an experiment block anywhere between its paragraphs:

```liquid
{% include experiment.html id="smallville" %}
```

Register the experiment in `_data/experiments.yml` with `title`, `url`, `embed_url`, `description`, `mode`, and `note`. URLs can be a local app or a trusted public HTTPS app that permits embedding. This supports fully interactive apps inside a post, not just videos. Inputs, sliders, visualizations, and server requests live in the embedded app itself. Nothing connects until the visitor presses **Enter experiment**. Disconnect unloads the frame; it does not stop the server's experiment. The full viewer link also works without JavaScript.

Pokémon remains a spectator view. Smallville allows camera movement, agent following, and inspection of agents' minds. The MiniMax-H3 workbench at `/h3/` sends text-to-video jobs to the private DGX API configured in `/h3/live.json`; `?api=` can override that endpoint for local testing. These viewers report connection status to the parent post using `postMessage`; the parent checks both the source window and origin. For a new same-origin app, send `{ type: 'zuko:experiment-status', state: 'live', message: '...' }` (states: `live`, `wait`, or `off`) to `location.origin`. A frame's load event alone is labeled **Viewer loaded**, never treated as proof that the remote experiment is online.

To reuse the browser-only color sampler in a post:

```liquid
<div data-interactive-only hidden>{% include color-study.html %}</div>
```

GitHub Pages serves the article and client interface. Experiments that call a model or run computation need their own server, as the existing DGX viewers do. Keep API keys and model credentials on that server. Enforce authentication, input validation, and request limits there before exposing any new computation or write controls to visitors.

## World Models in the browser

`/world-models-carracing/` is a standalone static app: the CarRacing agent from
the 2018 World Models paper (ConvVAE, MDN-RNN, CMA-ES controller), trained on
the DGX Spark with the PyTorch code in `world-models-carracing/train/`. The
decoder and one RNN step are ONNX graphs in `world-models-carracing/model/`,
run by onnxruntime-web from the jsDelivr CDN; the controller and starting
latents are JSON. The page dreams closed-loop, lets visitors take the wheel
with the arrow keys or an on-screen pad, and reports `live`, `wait`, or `off`
to the parent post with the usual `postMessage`. Rebuilding the model files
is described in `world-models-carracing/train/README.md`; the recorded
rollouts and checkpoints stay on the Spark.

## Play Craftax

`/craftax/` is a human-play interface for the original Craftax-Classic engine on the DGX. Keyboard and touch controls, player statistics, achievement progress, seeded new worlds, and trajectory downloads are available through the owner's private Tailscale connection. The public interface loads independently of the game server. Its connection is configured in `craftax/live.json`; no session credentials are stored in the repository. Backend source and operating notes are in `craftax/server/`, excluded from the published Jekyll site.

## Neuron Explorer

`/neurons/` serves the Neuron Explorer frontend directly from GitHub Pages.
Its map, signed activation examples, lenses, connections, embeddings, and
steering interface use the private Spark gateway configured in
`neurons/live.json`. The model, corpus, and generated results remain on the
Spark. Browsers need the owner's Tailscale connection and may ask for local
network access; the connection screen offers retry and the direct Spark viewer.

The frontend is adapted from lyramakesmusic's MIT-licensed Neuron Explorer;
`neurons/SOURCE.txt` pins the source revision and `neurons/LICENSE` retains its
license. `neurons/client.js` routes API requests, including binary responses
and streamed generation, to the gateway. It does not send browser cookies.
The Spark's existing agent, upload, and neuron-naming restrictions remain in
place. Gateway source, deployment notes, and tests are in `_neuron_explorer/`,
which Jekyll excludes from the public build.

## Saved experiment records

`/experiments/` is the public experiment library. The World Models Lab at
`/experiments/world-models/` reads immutable run records from
`runs/<experiment-id>/experiment.json` and can be embedded through the normal
experiment include. Its current replay revision includes a compact sprite and
frame index, so visitors can play, pause, and inspect every recorded step
without contacting the Spark.

The companion lab validates and syncs only replay media, action/reward traces,
metrics, training history, and reproducibility fingerprints. Raw datasets,
PyTorch checkpoints, credentials, internal paths, and machine-specific
manifests are not copied into this public repository. A saved website record
can replay and audit a run; it is not a resumable training checkpoint.

## World Models republication

`/world-models/` republishes David Ha and Jürgen Schmidhuber’s 2018 article with
its original layout and browser demos. The Jekyll entry is
`_posts/2026-10-18-world-models-original.html`; its static assets and pretrained
weights live in `world-models/`. It is separate from the locally trained
CarRacing experiment at `/world-models-carracing/`.

The article retains the original authors, citations, and CC BY 4.0 notice.
`world-models/SOURCE.txt` records the pinned upstream commit, hosting changes,
and third-party illustrations that remain hosted by the original site.
`world-models/LICENSE` contains the upstream license. The original analytics
tracker is removed, and the canonical URL points to the original article.
