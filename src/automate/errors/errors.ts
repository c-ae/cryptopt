export const ERRORS = {
  measureGeneric: {
    exitCode: 20,
    msg: "measuresuite.measure should return a result but didn't. TSNH.",
  },
  measureIncorrect: {
    exitCode: 21,
    msg: `measuresuite.measure should return a result but didn't, because the result is not the same as per measureCheck.`,
  },
  measureInvalid: {
    exitCode: 22,
    msg: `measuresuite.measure should return a result but didn't, because the asmstring could not be assembled.`,
  },
  bcbMakeFail: {
    exitCode: 30,
    msg: "While Executing `make` in bitcoin-core-bridge, there was an error.",
  },
  bcbFail: {
    exitCode: 31,
    msg: "While reading files in bitcoin-core-bridge, there was an error.",
  },
};
