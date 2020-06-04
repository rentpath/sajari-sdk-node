import * as grpc from "@grpc/grpc-js";

describe("grpc client", () => {
  test("grpc.Client should NOT be undefined", () => {
    expect(grpc.Client).not.toBe(undefined);
  });
});