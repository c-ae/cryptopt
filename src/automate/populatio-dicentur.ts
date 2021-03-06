#!/usr/bin/env -S node -r "ts-node/register/transpile-only" -r "tsconfig-paths/register"
// this is the Population based apporoch.
// Basically a wrapper script around generate_asm.js
// Y the name tho => https://translate.yandex.com/?lang=la-en&text=populatio-dicentur
//
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync, exec } from "child_process";
import type { CryptoptGlobals } from "./types";

import { SI } from "./lamdas";
import { sha1Hash } from "./Paul.helper";
import { parsedArgs } from "./argParse";
import { PRINT_EVERY, cy, re, gn, rd } from "./constants";
import { generateResultsPath, generateStateFileName } from "./path.helper";
import env from "./envHelper";

const { populatio, populatioratio, seed, curve, method, bridge, evals, readBestState } = parsedArgs;

if (populatioratio === 0) {
  process.exit(12);
}

const resPath = generateResultsPath({ curve, method, bridge });
const offspringEvals = evals * populatioratio; // each of the offspring
const allocatedToPopulation = offspringEvals * populatio; // total for population

const constantArgs = ["curve", "method", "cyclegoal", "bridge" ]
  .map((k) => `--${k} ${parsedArgs[k] ?? ""}`)
  .concat(
    ...["silent", "skipProof"].map((booleanFlag) =>
      parsedArgs[booleanFlag] ? `--${booleanFlag}` : "",
    ),
  );

/**
 * @returns an array of statefiles, to be sorted by ratio and then the best shall be used.
 */
function findSeeds(): string[] {
  if (offspringEvals < 1) {
    process.exit(12);
  }

  if (evals <= allocatedToPopulation) {
    console.error(
      `Wrong parameters. All the evaluations are being used for the population. Decrease Ratio or decrease Populatio. Observe, that this holds: Populatioratio * populatio < 1. Instead its ${populatioratio} * ${populatio} (= ${
        populatioratio * populatio
      }) < 1.`,
    );
    process.exit(12);
  }

  // generating seeds
  let derivedSeed = seed;
  const derivedSeeds = new Array<number>(populatio);
  for (let i = 0; i < populatio; i++) {
    derivedSeeds[i] = derivedSeed;
    derivedSeed = sha1Hash(derivedSeed);
  }

  // using seeds to generate states i.e. statefiles
  return derivedSeeds.reduce((acc, ds, i) => {
    const lc = `${i}-${populatio}`;

    const args = constantArgs
      .concat(`--seed ${ds}`, `--evals ${offspringEvals}`, `--logComment ${lc} `)
      .flatMap((m) => m.split(" "));
    console.log(`derivedSeed: ${ds}, starting ${lc}, for ${offspringEvals} evals`);
    execFileSync(`${__dirname}/generate_asm.js`, args, { stdio: "inherit" });

    acc[i] = generateStateFileName({
      curve,
      method,
      seed: ds,
      bridge,
    });
    return acc;
  }, new Array<string>(derivedSeeds.length));
}

// get initial statefiles.
const statefiles = readBestState
  ? fs // read
      .readdirSync(resPath)
      .filter((filename) => filename.startsWith("_state_") && filename.endsWith(".json"))
      .map((filename) => path.resolve(resPath, filename))
  : // generate
    findSeeds();

// this reads the state-files and sorts then according to their ratios.
const ratios = statefiles
  .reduce((arr, filename) => {
    // read
    const content = fs.readFileSync(filename).toString();
    if (content.length > 0) {
      const { ratio, convergence } = JSON.parse(content);
      arr.push({ filename, ratio, convergence });
    }
    return arr;
  }, [] as Array<{ filename: string; ratio: number; convergence: number[] }>)
  .sort((a, b) => b.ratio - a.ratio); // note: reverse sort

// keeping the `populatio`-best files; removing others.
// if (ratios.length > populatio) {
//   ratios.splice(populatio).forEach(({ filename }) => {
//     fs.rmSync(filename);
//   });
// }
const bestStateFileYet = ratios[0].filename;

console.log(
  [
    `Done finding good SEEEDs.`,
    `Starting final optimistaion now.`,
    `Starting with a ratio of: ${cy}${ratios[0].ratio}${re}`,
    `on statefile ${cy}${bestStateFileYet.replace(resPath, "RES")}${re}`,
  ].join(" "),
);
const finalConvergences = [] as string[];
const times: CryptoptGlobals["time"] = { validate: 0, generateCryptopt: 0};
let longestDataRow: number = -1;

  const finalStateFile = generateStateFileName({
    curve,
    method,
    seed, // from the last sha1Hash.
    bridge,
  });

  const args = constantArgs
    .concat(
      `--seed ${seed}`,
      //yes, the seed will be ignored, but is needed for creating the final state file correctly
      `--evals ${evals - allocatedToPopulation}`,
      `--readState ${bestStateFileYet}`,
      `--logComment ${populatio}-${populatio}`,
    )
    .flatMap((m) => m.split(" "));
  execFileSync(`${__dirname}/generate_asm.js`, args, { stdio: "inherit" });

  const parsed = JSON.parse(fs.readFileSync(finalStateFile).toString()) as CryptoptGlobals;

  if ("time" in parsed) {
    const { validate, generateCryptopt } = parsed.time;
    times.validate += validate;

    times.generateCryptopt += generateCryptopt;
  }

  const convergence = parsed.convergence;
  finalConvergences.push(convergence.join(" "));
  longestDataRow = Math.max(longestDataRow, convergence.length);


// MEASUREMENT STUFF DONE.

const space_separated = ratios
  .reduce((arr, { convergence }) => {
    // in order to create a matrix for gnuplot, we need to pad with " ?"
    const paddingAmount = longestDataRow - convergence.length;
    const paddingArray = new Array(paddingAmount).fill("?");
    arr.push(convergence.concat(paddingArray).join(" "));
    return arr;
  }, [] as string[])
  // have the final convergences at the end, so that it overwrites the earlier one. (that way it will be the same color.)
  // For some eager programmer, feel free to find the particular rows of finalConvergences in ratios and delete it.
  .concat(finalConvergences);

const datFileFull = `${bestStateFileYet}.dat`;

fs.writeFileSync(datFileFull, space_separated.join("\n"));
process.stdout.write(
  // `Wrote ${cy}${datFileName}${re} ${space_separated.length} x ${longestDataRow} lines x elements.`,
  `Wrote ${cy}${datFileFull.replace(resPath, "RES")}${re} ${space_separated.length}x${longestDataRow}`,
);
const gpFile = `${datFileFull}.gp`;
fs.writeFileSync(
  gpFile,
  [
    `#!/usr/bin/env gnuplot\n`,
    `set title "${curve.replace("_", "\\\\_")}-${method}, Restarts^{${populatio}}_{${
      populatioratio * 100
    }%}, #Mutations ${SI(evals)}, ${new Date().toISOString()}, ${os.hostname()}, Times: validate ${(
      times.validate / 60
    ).toFixed(2)}min;  genCryptopt ${(
      times.generateCryptopt / 60
    ).toFixed(2)} min"`,
    "# missing values are the ones from earlier-finished seed-searching evaluations",
    `set datafile missing "?"\n`,
    "# setting output sizes and filename",
    "set terminal pdf size 80cm,20cm",
    `set output '${datFileFull}.pdf'\n`,
    "# set x",
    'set xlabel "Mutation"',
    "set logscale x 10\n",
    "# set y",
    // "set yrange [0:2]\n",
    `set ylabel "ratio: '${env.CC}-compiled cycle lib'/'cycle good' "\n`,
    "# remove legend",
    "unset key\n",
    "# and plot the marix with linecolors, and a line at y=1 with color 0 (gre)",
    `plot "${datFileFull}" matrix using ($1*${PRINT_EVERY}):3:2 linecolor variable with lines, 1 lc 0`,
  ].join("\n"),
  { mode: 0o700 },
);

// process.stdout.write(`Done optimising. Exe'ing ${cy}${gpFile}${re}.`);
process.stdout.write(`Gen Pdf...`);
const child = exec(`gnuplot ${gpFile}`);
const d = (chunk: Buffer | string | any) => {
  const str = chunk.toString();
  if (
    !str.includes("line 22: ") &&
    !str.includes(gpFile) &&
    str !== "\n" &&
    !str.includes("warning: ") &&
    !str.includes("matrix contains missing or undefined values")
  ) {
    process.stdout.write(str);
  }
};
child.stdout?.on("data", d);
child.stderr?.on("data", d);
child.on("close", (code) => {
  process.stdout.write(`${code == 0 ? gn : rd + "not"} OK ${re}\n`);
});
