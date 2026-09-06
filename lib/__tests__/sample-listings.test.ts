import { getSampleListingsForBusinessType } from "@/lib/sample-listings";

describe("starter listing resolution", () => {
  it("resolves normalized signature business types to starter content", () => {
    expect(getSampleListingsForBusinessType("Hotel & Lodging")).toHaveLength(2);
    expect(getSampleListingsForBusinessType("Restaurant")).toHaveLength(2);
    expect(getSampleListingsForBusinessType("Salon")).toHaveLength(2);
    expect(getSampleListingsForBusinessType("Electronics")).toHaveLength(2);
  });

  it("provides starter content for professional service niches", () => {
    expect(getSampleListingsForBusinessType("Graphic Design & Printing")).toHaveLength(2);
    expect(getSampleListingsForBusinessType("Branding & Brand Identity")).toHaveLength(2);
    expect(getSampleListingsForBusinessType("Engineering Services")).toHaveLength(2);
  });

  it("does not fabricate samples for an unsupported niche", () => {
    expect(getSampleListingsForBusinessType("Unknown Niche")).toEqual([]);
  });
});
