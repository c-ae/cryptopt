import { BINS } from "./enums";
import { primes } from "./primes";

export type CURVE_T = typeof AVAILABLE_CURVES[number];
export type METHOD_T = typeof AVAILABLE_METHODS[number];

export const AVAILABLE_CURVES = [
  "curve25519",
  "p224",
  "p256",
  "p384",
  "p434",
  "p448_solinas",
  "p521",
  "poly1305",
  "secp256k1",
].concat(...Object.keys(primes));
export const AVAILABLE_METHODS = ["square", "mul"];

export const COMPILERS = ["gcc", "clang"];

export const METHOD_DETAILS: {
  [f in METHOD_T]: {
    name: {
      [k in BINS]: string;
    };
  };
} = {
  mul: {
    // the operation 'multiply' is called carry_mul if the bin is unsaturated; mul if it is wbw_montgomery
    name: {
      [BINS.unsaturated]: "carry_mul",
      [BINS.wbw_montgomery]: "mul",
    },
  },
  square: {
    name: {
      [BINS.unsaturated]: "carry_square",
      [BINS.wbw_montgomery]: "square",
    },
  },
};

export const CURVE_DETAILS: {
  [curve in CURVE_T]: {
    bitwidth: number;
    argwidth: number;
    prime: string;
    binary: BINS;
    bounds: string[];
  };
} = Object.assign(primes, {
  curve25519: {
    argwidth: 5,
    bitwidth: 64,
    prime: "2^255 - 19",
    binary: BINS.unsaturated,
    bounds: [
      "0x18000000000000",
      "0x18000000000000",
      "0x18000000000000",
      "0x18000000000000",
      "0x18000000000000",
    ],
  },
  p224: {
    bitwidth: 64,
    argwidth: 4,
    prime: "2^224 - 2^96 + 1",
    binary: BINS.wbw_montgomery,
    bounds: ["0xffffffffffffffff", "0xffffffffffffffff", "0xffffffffffffffff", "0xffffffffffffffff"],
  },
  p256: {
    argwidth: 4,
    bitwidth: 64,
    prime: "2^256 - 2^224 + 2^192 + 2^96 - 1",
    binary: BINS.wbw_montgomery,
    bounds: ["0xffffffffffffffff", "0xffffffffffffffff", "0xffffffffffffffff", "0xffffffffffffffff"],
  },
  p384: {
    argwidth: 6,
    bitwidth: 64,
    prime: "2^384 - 2^128 - 2^96 + 2^32 - 1",
    binary: BINS.wbw_montgomery,
    bounds: [
      "0xffffffffffffffff",
      "0xffffffffffffffff",
      "0xffffffffffffffff",
      "0xffffffffffffffff",
      "0xffffffffffffffff",
      "0xffffffffffffffff",
    ],
  },
  p434: {
    argwidth: 7,
    bitwidth: 64,
    prime: "2^216 * 3^137 - 1",
    binary: BINS.wbw_montgomery,
    bounds: [
      "0xffffffffffffffff",
      "0xffffffffffffffff",
      "0xffffffffffffffff",
      "0xffffffffffffffff",
      "0xffffffffffffffff",
      "0xffffffffffffffff",
      "0xffffffffffffffff",
    ],
  },
  p448_solinas: {
    argwidth: 8,
    bitwidth: 64,
    prime: "2^448 - 2^224 - 1",
    binary: BINS.unsaturated,
    bounds: [
      "0x300000000000000",
      "0x300000000000000",
      "0x300000000000000",
      "0x300000000000000",
      "0x300000000000000",
      "0x300000000000000",
      "0x300000000000000",
      "0x300000000000000",
    ],
  },
  p521: {
    argwidth: 9,
    bitwidth: 64,
    prime: "2^521 - 1",
    binary: BINS.unsaturated,
    bounds: [
      "0xc00000000000000",
      "0xc00000000000000",
      "0xc00000000000000",
      "0xc00000000000000",
      "0xc00000000000000",
      "0xc00000000000000",
      "0xc00000000000000",
      "0xc00000000000000",
      "0x600000000000000",
    ],
  },
  poly1305: {
    argwidth: 3,
    bitwidth: 64,
    prime: "2^130 - 5",
    binary: BINS.unsaturated,
    bounds: ["0x300000000000", "0x180000000000", "0x180000000000"],
  },
  secp256k1: {
    argwidth: 4,
    bitwidth: 64,
    prime: "2^256 - 2^32 - 977",
    binary: BINS.wbw_montgomery,
    bounds: ["0xffffffffffffffff", "0xffffffffffffffff", "0xffffffffffffffff", "0xffffffffffffffff"],
  },
});
