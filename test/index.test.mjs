import assert from "node:assert/strict";
import test from "node:test";
import { isFilePath, mix } from "../dist/index.js";

test("isFilePath detects file-like paths", () => {
  assert.equal(isFilePath("resources/assets/js/app.js"), true);
  assert.equal(isFilePath("resources/assets/js"), false);
  assert.equal(isFilePath("/tmp/archive.TAR.GZ"), true);
});

test("toGraph returns a defensive copy", () => {
  const builder = mix();

  builder
    .setPublicPath("public/")
    .js("resources/assets/js/app.js", "js")
    .autoload({ jquery: ["$", "jQuery"] });

  const first = builder.toGraph();
  first.publicPath = "changed";
  first.js[0].src = "mutated.js";
  first.autoload.jquery.push("window.jQuery");

  const second = builder.toGraph();
  assert.equal(second.publicPath, "public");
  assert.equal(second.js[0].src, "resources/assets/js/app.js");
  assert.deepEqual(second.autoload.jquery, ["$", "jQuery"]);
});
