import Bridge from "@bcb/index";
describe("bridge", () => {
  describe("bridge:getCryptOptFunction", () => {
    it("should only have every node once", () => {
      const b = new Bridge().getCryptOptFunction("mul").body;
      const set = new Set(b.map((n) => n.name[0]));
      expect(b).toHaveLength(set.size);
    });
  });
});
