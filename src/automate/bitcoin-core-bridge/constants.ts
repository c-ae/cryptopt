export type METHOD_T = typeof AVAILABLE_METHODS[number];

export const AVAILABLE_METHODS = ["square", "mul"];

export const METHOD_DETAILS: {
  [f in METHOD_T]: {
    name: string;
  };
} = {
  mul: {
    name: "secp256k1_fe_mul_inner",
  },
  square: {
    name: "secp256k1_fe_sqr_inner",
  },
};
