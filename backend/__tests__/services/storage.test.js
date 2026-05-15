import { resolveObjectAcl } from "../../services/storage/index.js";

describe("resolveObjectAcl", () => {
  const original = process.env.SPACES_OBJECT_ACL;

  afterEach(() => {
    if (original === undefined) delete process.env.SPACES_OBJECT_ACL;
    else process.env.SPACES_OBJECT_ACL = original;
  });

  test("defaults to public-read when env is unset", () => {
    delete process.env.SPACES_OBJECT_ACL;
    expect(resolveObjectAcl()).toBe("public-read");
  });

  test("honors SPACES_OBJECT_ACL when set", () => {
    process.env.SPACES_OBJECT_ACL = "authenticated-read";
    expect(resolveObjectAcl()).toBe("authenticated-read");
  });

  test("SPACES_OBJECT_ACL=none omits ACL", () => {
    process.env.SPACES_OBJECT_ACL = "none";
    expect(resolveObjectAcl()).toBe("");
  });

  test("explicit per-call acl overrides env", () => {
    process.env.SPACES_OBJECT_ACL = "private";
    expect(resolveObjectAcl("public-read")).toBe("public-read");
  });

  test("explicit none skips ACL", () => {
    process.env.SPACES_OBJECT_ACL = "public-read";
    expect(resolveObjectAcl("none")).toBe("");
  });
});
