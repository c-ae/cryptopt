import yargs from "yargs";

import { AVAILABLE_CURVES, AVAILABLE_METHODS } from "./fiat-bridge";
import { AVAILABLE_METHODS as BITCOIN_CORE_METHODS } from "./bitcoin-core-bridge";
import { BRIDGES } from "./bridge";

export const parsedArgs = yargs
  .option("curve", {
    alias: "c",
    describe: `Curve to optimise a method on.`,
    choices: AVAILABLE_CURVES,
    default: "curve25519",
    type: "string",
  })
  .option("method", {
    alias: "m",
    describe: "Method to optimise on.",
    choices: AVAILABLE_METHODS.concat(BITCOIN_CORE_METHODS),
    default: "square",
    type: "string",
  })
  .option("bridge", {
    alias: "b",
    describe: `The specified method will be searched in this order: ${BRIDGES}. If there is ambiguities, the choice of bridge can be specified. Then, the method is only searched in respective bridge. (Errors out, if not found.)\nIf --bridge gets assigned 'manual', one must specify --cFile and --jsonFile.`,
    choices: [""].concat(BRIDGES),
    default: "",
    type: "string",
  })
  .option("jsonFile", {
    alias: "j",
    describe: `The file containsing the JSON-CODE for the method. Only used if the --bridge manual.`,
    default: "",
    type: "string",
  })
  .option("cFile", {
    describe: `The file containsing the C-CODE for the method. Only used if the --bridge manual.`,
    default: "",
    type: "string",
  })
  .option("silent", {
    alias: "s",
    describe: "will omit consle.log's. Will only print the progess to stdout.",
    default: false,
    boolean: true,
  })
  .option("seed", {
    describe: "Seed to base the randomness on.",
    default: 1,
    number: true,
  })
  .option("populatio", {
    describe:
      "This setting is only used when populatio-dicentur.ts is being called. It describes, how many seeds should be derived from the initial @param seed. For each of those seeds a part (refer to @param populatioratio) of the total @params evaluations will be used to find best seeds. For the best one, the rest of budget will be used to optimsie.",
    default: 80,
    number: true,
    min: 1,
  })
  .option("populatioratio", {
    describe:
      "This setting is only used when populatio-dicentur.ts is being called. It describes, how much of the total evaluation-budget is being used for each of the first generation. E.g. if this is 0.01, then 1% of @param evals will be used for each of the offsprings in gen1. (100% - 1% * @param populatio) will then be used for the best found seed. (Assume populatio is 40, then 40*1% is spent on finding good seeds, and 60% of mutations is spent on the best found.)",
    default: 0.005,
    number: true,
    min: 0,
    max: 1,
  })
  .option("skipProof", {
    alias: "n",
    describe:
      "If this is set, it will not Proof the solution correct. It will only comapre the results with the CC compiled solution.",
    boolean: true,
    default: false,
  })
  .option("readState", {
    describe: "this must be a filename to a json, which has a parsable state (to, body).",
    string: true,
    demandOption: false,
  })
  .option("logComment", {
    describe: "May provice a hint of any kint to be printed on the statusline",
    string: true,
    default: "",
  })
  .option("cyclegoal", {
    describe: "This may cycles should one measurement take, adjust the batchsize.",
    default: 10000,
    number: true,
  })
  .option("evals", {
    alias: "e",
    describe:
      "How many evaluations (=mutations) to execute. The higher this number the longer it'll but and the better the result will be. Multiplier 'k','M','T' and factors are allowed like '0.4M', also 1e3 (1000) or 4e9 (4M) are allowed`]",
    default: "1k",
    coerce: (evals: number | string) => {
      const attemptcast = Number(evals);
      if (!isNaN(attemptcast)) {
        return attemptcast;
      }
      if (typeof evals === "number") {
        throw new Error("TSNH. evals is a number but cannot be casted.");
      }
      const multipliers = ["k", "M", "T"];
      const idx = multipliers.findIndex((m) => evals.endsWith(m));
      if (idx == -1) {
        throw new Error("Unsupported 'evals' arguments.");
      }
      return Math.pow(1000, idx + 1) * Number(evals.substring(0, evals.length - 1));
    },
  })
  .check(({ evals, bridge, cFile, jsonFile }) => {
    if (evals <= 0) return false;
    if (bridge == "manual" && (!jsonFile || !cFile)) return false;
    return true;
  })
  .help("help")
  .alias("h", "help")
  .wrap(Math.min(160, yargs.terminalWidth()))
  .parseSync();
