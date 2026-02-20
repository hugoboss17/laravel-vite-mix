# laravel-vite-mix

Use Vite with a Laravel Mix-like API.

## Purpuse

Laravel mix is not maintained anymore and it's not as secured as Vite.

With this package you're able to migrate to vite without having to change your frontend structure.

All you have to do is transform your webpack.mix.js into mix.config.mjs

## Install

```bash
npm install laravel-vite-mix
```

## CLI

After installing, use:

```bash
mix dev
mix build
```

Options:

```bash
mix dev --config mix.config.mjs
mix build --config mix.config.mjs
```

Default config path is `mix.config.mjs`.

## Config format

Create a `mix.config.mjs` in your project root:

```js
export default (mix) => {
  mix.setPublicPath("public");

  mix.js("resources/assets/js/app.js", "public/js").vue({ version: 3 });
  mix.sass("resources/assets/sass/app.scss", "public/css");
  mix.css("resources/assets/css/simple.css", "public/css");

  mix.copy("resources/assets/images/logo.png", "public/images/logo.png");
  mix.copyDirectory("resources/assets/fonts", "public/fonts");

  mix.combine(
    [
      "resources/assets/css/a.css",
      "resources/assets/css/b.css",
    ],
    "public/css/bundle.css"
  );

  mix.autoload({
    jquery: ["$", "jQuery", "window.jQuery"],
  });

  mix.version();
};
```

## Supported API

- `mix.setPublicPath(path)`
- `mix.options(opts)`
- `mix.js(src, dest)`
- `mix.vue({ version: 3 })`
- `mix.sass(src, dest)`
- `mix.css(src, dest)`
- `mix.copy(src, dest)`
- `mix.copyDirectory(src, dest)`
- `mix.combine(sources, dest)`
- `mix.autoload(map)`
- `mix.webpackConfig(fn)` (captured for compatibility)
- `mix.version()`
- `mix.inProduction()`

## Webpack compatibility handled

- Sass `~` imports (example: `@import "~bootstrap-sass/assets/stylesheets/bootstrap";`)
- Extensionless Vue imports (example: `import Component from "../Component";`)
- Directory Vue imports to `index.vue`
- Legacy bare asset paths in templates for common asset extensions
  (example: `src="theme/images/image.png"` resolves from `resources/assets` when present)

## Important

Package is still in construction although it's already working on some laravel legacy projects.

Feel free to contribute.