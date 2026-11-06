import assert from "node:assert/strict";
import test from "node:test";
import { InputError, parseQuery } from "../src/parse.js";

test("reads an instagram handle, a Nigerian mobile, and a shop link", () => {
  assert.equal(parseQuery("@Lagos_Bags").instagram, "lagos_bags");
  assert.equal(parseQuery("https://instagram.com/Lagos.Bags/").instagram, "lagos.bags");
  assert.equal(parseQuery("08031234567").phone, "+2348031234567");
  assert.equal(parseQuery("https://wa.me/2348031234567").phone, "+2348031234567");
  assert.equal(parseQuery("https://shop.example.ng/bags").url, "https://shop.example.ng/bags");
});

test("rejects empty, local, and private targets", () => {
  assert.throws(() => parseQuery("   "), InputError);
  assert.throws(() => parseQuery("http://127.0.0.1/shop"), InputError);
  assert.throws(() => parseQuery("http://192.168.1.8/shop"), InputError);
  assert.throws(() => parseQuery("javascript:alert(1)"), InputError);
});
