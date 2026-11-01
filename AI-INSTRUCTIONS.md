# AI Instructions: Home Assistant Menu Card

Write valid Home Assistant YAML for one meal. Use US English for explanations and the user's preferred language for meal content. By default return one fenced `yaml` block. Arrange keys in the order below and omit empty fields and default values. Include as many applicable fields as you can support from the user's information or reliable sources; do not fabricate facts. Quote strings where YAML requires it.

Choose `custom:bistro-menu-card` only for exceptionally elegant, luxurious dishes; otherwise use `custom:recipe-gallery-card`. Bistro does not support the recipe button; use the gallery card when a recipe button is needed. Both default to automatic grid row height.

## Field reference, in output order

- `type` (required): exactly `custom:bistro-menu-card` or `custom:recipe-gallery-card`.
- `title`: concise name of the actual dish, for example `Cremige Tomatenpasta`.
- `duration`: preparation/cooking time as a human-readable string, for example `25 Min.`. Use total time when known; do not present a guess as a fact.
- `difficulty`: brief cooking difficulty such as `Einfach`, `Mittel`, or `Anspruchsvoll`. Use a reasonable assessment only if the recipe or reliable source supports it; omit if unclear.
- `category`: a short, accurate description such as `Vegetarisch`, `Vegan`, `Fisch`, or `Fleisch`. Verify the ingredients support dietary claims; do not label a meal vegan or vegetarian when uncertain.
- `card_color`: gallery card background, a quoted six-digit hexadecimal color such as `'#dae6f4'`. Default is light green `'#e8eddd'`. Choose a soft color only if requested or appropriate; omit to use the default.
- `recipe`: optional gallery-only object for a recipe button. See the recipe reference below. Omit entirely when no supported action or recipe is available.
- `rating`: numeric score (e.g. `4.5`). **Never decide, estimate, generate, or infer a rating. Include it only when the user explicitly gives a rating for this dish.** A missing rating hides stars and score entirely; `0` is a real explicit rating and shows empty stars.
- `max_rating`: maximum number of stars, integer 0–10, default `5`. Include only when the user explicitly specifies a different scale; `0` hides the rating.
- `rating_count`: nonnegative integer count of ratings. Include only if the user explicitly provides the count. Never invent or infer it, including from a recipe website.
- `image_1`, `image_2`, `image_3`: optional photos, in display order. Use a verified, publicly accessible direct image URL if available (for example an HTTPS URL that returns image bytes rather than an HTML recipe or search page), or an image path explicitly provided by the user such as `/local/food/pasta.jpg` or `media-source://...`. An `image.*` Home Assistant entity is supported only for `image_1`. Do not invent URLs, claim an unverified link works, or use a page URL as an image. Omit unavailable images. In the gallery, image 1 is large and images 2 and 3 are stacked.
- `description`: one or two appetizing, factual sentences describing ingredients or preparation; basic Markdown is supported. Avoid unsupported dietary or nutritional claims.
- `tap_action`, `hold_action`, `double_tap_action`: optional Home Assistant-style action objects for the card itself. Use only if a destination or action is supplied or requested. Supported actions are listed below. Image taps open the image.
- `grid_options`: optional Home Assistant section layout object. Rows default to `auto`; omit it unless the user explicitly wants different grid settings. If explicitly requested, use `grid_options: {rows: auto}` or another valid Home Assistant layout.

## Recipe object

Use this format for the gallery card, never the obsolete `recipe_label` or `recipe_action` fields:

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
      - Pasta nach Packungsanweisung kochen.
      - Tomaten garen und mit der Pasta vermengen.
```

- `recipe.label`: optional button text; default `Rezept anzeigen`.
- `recipe.action`: required to show the button. Set its `action` to `recipe` to open the integrated recipe window, or use a supported external action below.
- `recipe.recipe_details.ingredients`: array of plain strings, one ingredient per item, with quantity and unit when known. It is optional and may be empty.
- `recipe.recipe_details.steps`: array of plain strings, one complete instruction per step, in cooking order. It is optional and may be empty. Do not manually number the strings; the card numbers them.

Use a reliable recipe or user-provided details; where the user requests a newly composed recipe, clearly treat the recipe as a suggested preparation rather than an established source. Do not invent a recipe URL.

## Action objects

The `action` property of `recipe` and the card actions use these shapes:

```yaml
action: url
url_path: https://example.com/recipe
```

Other supported values: `navigate` with `navigation_path`, `assist` (optionally `pipeline_id`), `perform-action` with `perform_action: domain.service` and optional `target` and `data`, or `none`. `recipe` is supported only for `recipe.action.action`, and opens the integrated window. Do not add an action unless its target is known.
