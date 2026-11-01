# Menu Card

Two custom Home Assistant dashboard cards for presenting meals: **Bistro**, a dark photo-led card, and **Recipe Card**, a light card with a three-image gallery.

## Features

- Two layouts, each with a visual editor
- Meal description with basic Markdown, star rating and optional rating count
- Optional duration, difficulty and meal category
- Up to three photos from URLs or the Home Assistant media library; tap to enlarge
- Configurable background color and recipe button for the Recipe Card
- Configurable tap, hold and double-tap actions
- Editor loaded only when needed
- HEIC/HEIF support where the browser can decode the image or the fallback converter can access it

## Installation

### Manual

1. Copy `menu-cards.js` and `menu-card-editor.js` into the same directory, for example `config/www/community/menu-cards/`.
2. Add a dashboard resource in **Settings → Dashboards → Resources**:
   - URL: `/local/community/menu-cards/menu-cards.js`
   - Type: **JavaScript module**
3. Reload the browser. After updating, refresh the browser cache if necessary.

Only register `menu-cards.js` as a resource. Keep the editor file next to it so it can be loaded when the visual editor opens. Update both files together.

## Configuration

Add **Bistro Menu Card** or **Recipe Gallery Card** through the card picker, then configure it in the visual editor or use YAML.

### Bistro

```yaml
type: custom:bistro-menu-card
title: Cremige Tomatenpasta
duration: 25 Min.
difficulty: Einfach
category: Vegetarisch
rating: 5.0
rating_count: 128
image_1: /local/essen/pasta.jpg
description: Samtige Tomatensauce mit Knoblauch, frischem Basilikum und Parmesan.
```

### Recipe Card

```yaml
type: custom:recipe-gallery-card
title: Cremige Tomatenpasta
duration: 25 Min.
difficulty: Einfach
category: Vegetarisch
card_color: '#dae6f4'
recipe:
  action:
    action: navigate
    navigation_path: /lovelace/rezept
rating: 5.0
rating_count: 128
image_1: /local/essen/pasta.jpg
image_2: /local/essen/zutaten.jpg
image_3: /local/essen/pasta-detail.jpg
description: Samtige Tomatensauce mit Knoblauch, frischem Basilikum und Parmesan.
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `type` | Required | `custom:bistro-menu-card` or `custom:recipe-gallery-card` |
| `title` | Empty | Meal name |
| `duration` | Empty | Preparation time, as text |
| `difficulty` | Empty | Difficulty, as text |
| `category` | Empty | Meal category, as text |
| `card_color` | `#e8eddd` | Recipe Card background color, as a six-digit hex color |
| `recipe.label` | `Rezept anzeigen` | Recipe Card button label |
| `recipe.action` | `none` | Recipe Card button action; the button is hidden when no action is configured |
| `rating` | Not set | Rating value; displayed with one decimal place |
| `max_rating` | `5` | Maximum stars, from 0 to 10; use 0 to hide the rating |
| `rating_count` | Empty | Optional number of ratings |
| `image_1`, `image_2`, `image_3` | Empty | Image URL or media-library source; `image_1` also accepts an `image.*` entity |
| `description` | Empty | Description with basic Markdown |
| `tap_action`, `hold_action`, `double_tap_action` | `none` | Actions for the card |

Empty meal details are hidden. The rating is hidden when `rating` is not set. Stars are rounded to the nearest half while the numeric value is shown to one decimal place. For Recipe Card, the first photo is large and the second and third photos are stacked; on narrow cards the gallery moves above the text. The visual editor offers color presets and a custom color picker. The text panel and editor are tinted to match the selected background. Defaults are omitted when edited visually.

### Actions

The visual editor supports `none`, `navigate`, `url`, `assist` and `perform-action` for the card and the recipe button. For example:

```yaml
recipe:
  action:
    action: url
    url_path: https://example.com/recipe
```

For `perform-action`, use `perform_action: domain.service` and optionally `target` and `data`. The visual editor exposes a service and target entity; additional service data can be configured in YAML. Image taps open the image and do not trigger the card action.

### Images and HEIC

Use an image URL, a `/local/...` path, or choose an image through the media selector. The first image can also use an `image.*` entity. Browsers with native HEIC/HEIF support display those files directly. When native decoding fails, the card tries to load `heic2any` from jsDelivr and convert the image in the browser. This fallback needs internet access and permission to fetch the image (same-origin or suitable CORS headers); unsupported files or blocked requests show a placeholder.

## Troubleshooting

- **Card not found:** check the resource URL and that it is registered as a JavaScript module, then reload the browser.
- **Editor does not open:** ensure `menu-card-editor.js` is beside `menu-cards.js` and that both files were updated together.
- **Image unavailable:** check the image path and permissions. External images must permit access for HEIC conversion.
- **Recipe button missing:** configure an action in the Recipe Button section.

## Integrated recipe

```yaml
recipe:
  label: Rezept anzeigen
  action:
    action: recipe
  recipe_details:
    ingredients:
      - 200 g Pasta
      - 300 g Tomaten
    steps:
      - Pasta kochen.
      - Tomaten garen und mit der Pasta vermengen.
```

The button opens the ingredients and numbered steps in Home Assistant. See [AI-CONFIGURATION.md](AI-CONFIGURATION.md) for precise configuration instructions.
