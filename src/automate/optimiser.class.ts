import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";

import FiatBridge from "./fiat-bridge";
import Paul from "@/Paul.class";
import globals from "@/globals";
import { Assembler } from "./assembler.class";
import { CHOICE, FUNCTIONS } from "./types";
import { ERRORS } from "@/errors";
import { Model } from "@/model.class";
import { PRINT_EVERY, LOG_EVERY } from "./constants";
import { analyseMeasureResult, AnalyseResult } from "./analyse";
import { init } from "./optimiser.helper.class";
import { shouldProof, genStatusLine } from "./optimiser.helper";
import { writeasm, toggleFUNCTIONS } from "./helpers";

import env from "./envHelper";
const { CC, CFLAGS } = env;

import Measuresuite from "measuresuite";
let choice: CHOICE;

export class Optimiser {
  private measuresuite: Measuresuite;

  private logfilename: string;

  public constructor(
    private resultspath: string,
    private args: {
      evals: number;
      seed: number;
      curve: string;
      method: string;
      cyclegoal: number;
      readState?: string; // filename
      logComment: string;
      skipProof: boolean;
      silent: boolean;
      bridge?: string;
    },
  ) {
    this.measuresuite = init(args);
    this.logfilename = path.join(resultspath, `s${args.seed}-p${process.pid}-cc${CC}.log`);
    // load a saved state if necessary
    if (args.readState) {
      Model.import(args.readState);
    }
  }
  private static _errors: Error[] = [];
  private no_of_instructions = -1;
  private asmStrings: { [k in FUNCTIONS]: string } = {
    [FUNCTIONS.F_A]: "",
    [FUNCTIONS.F_B]: "",
  };
  private numMut: { [id: string]: number } = {
    permutation: 0,
    decision: 0,
  };
  private numRevert: { [id: string]: number } = {
    permutation: 0,
    decision: 0,
  };

  private revertFunction = (): void => {
    /**intentionally blank */
  };
  /** you usually dont want to mess with @param random.
   * mutate should not be called from outside with @param random=false*/
  private mutate(random = true): void {
    if (random) {
      choice = Paul.pick([CHOICE.PERMUTE, CHOICE.DECISION]);
    }
    console.log("Mutationalita");
    switch (choice) {
      case CHOICE.PERMUTE:
        Model.mutatePermutation();
        this.revertFunction = () => {
          this.numRevert.permutation++;
          Model.revertLastMutation();
        };
        this.numMut.permutation++;
        break;
      case CHOICE.DECISION:
        const hasHappend = Model.mutateDecision();
        if (!hasHappend) {
          // this is the case, if there is no hot decisions.
          choice = CHOICE.PERMUTE;
          this.mutate(false);
          return;
        }
        this.revertFunction = () => {
          this.numRevert.decision++;
          Model.revertLastMutation();
        };

        this.numMut.decision++;
    }
  }

  private logToLogfile(statusline: string): void {
    fs.appendFileSync(this.logfilename, statusline);
  }

  public optimise(): void {
    console.log("starting optimisation");
    let batchSize = 200;
    const numBatches = 31;
    let lastGood = Infinity;
    let ratioString = "";
    let numEvals = 0;

    const optimistaionStartDate = Date.now();
    let accumulatedTimeSpentByMeasuring = 0;

    const write_current_asm = (number_evaluation?: number): void => {
      console.log("writing current asm");
      const elapsed = Date.now() - optimistaionStartDate;
      const evaluation_number = number_evaluation ?? this.args.evals;
      const statistics = [
        `; cpu ${os.cpus()[0].model}`,
        `; ratio ${ratioString}`,
        `; seed ${Paul.initialSeed} `,
        `; CC / CFLAGS ${CC} / ${CFLAGS} `,
        `; time needed: ${elapsed} ms / ${evaluation_number} evals=> ${
          elapsed / Number(evaluation_number)
        }ms/eval`,
        `; Time spent for assembling and measureing (initial batch_size=${batchSize}, initial num_batches=${numBatches}): ${accumulatedTimeSpentByMeasuring} ms`,
        `; number of used evaluations: ${evaluation_number}`,
        `; Ratio (time for assembling + measure)/(total runtime for ${evaluation_number} evals): ${
          accumulatedTimeSpentByMeasuring / elapsed
        }`,
        ...["permutation", "decision"].map(
          (key) =>
            `; number reverted ${key}/ tried ${key}: ${this.numRevert[key]} / ${this.numMut[key]} =${(
              (this.numRevert[key] / this.numMut[key]) *
              100
            ).toFixed(3)}%`,
        ),
      ];

      console.log(statistics);
      if (Optimiser._errors.length) {
        Optimiser._errors.forEach((e) => console.error(e));
      }
      const { curve, method: func } = this.args;

      const evalString = number_evaluation ? `_eval${number_evaluation}of${this.args.evals}` : "";

      const methodName = `${func}_${curve}`;
      const fileNameOptimised = [
        `${lastGood.toFixed(0)}${evalString}`,
        `_ratio${ratioString.replace(".", "")}`,
        `_seed${Paul.initialSeed}_${methodName}`,
      ].join("");
      const fullpath = path.join(this.resultspath, `${fileNameOptimised}.asm`);
      // write best found solution with headers
      // flip, because we want the last accepted, not the last mutated.
      const flipped = toggleFUNCTIONS(currentNameOfTheFunctionThatHasTheMutation);
      writeasm(
        ["SECTION .text", `\tGLOBAL ${methodName}`, `${methodName}:`]
          .concat(this.asmStrings[flipped])
          .concat(statistics)
          .join("\n"),
        fullpath,
      );

      if (shouldProof(this.args)) {
        // and proof correct
        const proofCommandLine = FiatBridge.buildProofCommand(curve, func, fullpath);
        try {
          const now = Date.now();
          execSync(proofCommandLine);
          globals.time.validate += (Date.now() - now) / 1000;
        } catch (e) {
          console.error(
            `Could not prove ${fullpath} correct with ${proofCommandLine}`,
            `. Aborting mission. I repeat: Abort mission now.`,
            e,
          );
          process.exit(6);
        }
      }
    };
    let currentNameOfTheFunctionThatHasTheMutation = FUNCTIONS.F_A;
    let time = Date.now();
    let show_per_second = "many/s";
    let per_second_counter = 0;
    const intervalHandle = setInterval(() => {
      if (numEvals > 0) {
        // not first eval thus, undefined we want to mutate.
        this.mutate();
      }

      console.log("assembling");
      const { code, stacklength } = Assembler.assemble(this.resultspath);

      console.log("now we have the current string in the object, filtering");
      const filteredInstructions = code.filter((line) => line && !line.startsWith(";") && line !== "\n");
      this.no_of_instructions = filteredInstructions.length;

      // and depening on the silent-opt use filtered or the verbose ones for the string
      this.asmStrings[currentNameOfTheFunctionThatHasTheMutation] = (
        this.args.silent ? filteredInstructions : code
      ).join("\n");
      // check if this was the first round

      if (numEvals == 0) {
        // then point to fB and continue, write first
        console.log("wrote to /tmp/cur_frist.asm");
        writeasm(this.asmStrings[FUNCTIONS.F_A], "/tmp/cur_frist.asm");
        if (this.asmStrings[FUNCTIONS.F_A].includes("undefined")) {
          const e = "\n\n\nNah... we dont want undefined \n\n\n";
          console.error(e);
          throw new Error(e);
        }
        currentNameOfTheFunctionThatHasTheMutation = FUNCTIONS.F_B;
        numEvals++;
      } else {
        //else, it was not the first round, we need to measure

        const now_measure = Date.now();

        let analyseResult: AnalyseResult | undefined;
        try {
          console.log("let the measurements begin!");

          const results = this.measuresuite.measure(
            this.asmStrings[FUNCTIONS.F_A],
            this.asmStrings[FUNCTIONS.F_B],
            batchSize,
            numBatches,
          );
          console.log("well done guys. the results are in!");

          if (!results) {
            throw new Error("Measuresuite did not yield results.");
          }
          if (!results.stats.checkResult) {
            const ro = results.stats.runOrder;
            console.error(
              `${ro.charAt(ro.length - 1)} was incorreect: ${ro}. You probably want to diff them. here:`,
              `diff ${this.resultspath}/tested_incorrect_*.asm`,
            );
            throw Error("tested_incorrect");
          }

          try {
            if (results.times.length > 1) {
              analyseResult = analyseMeasureResult(results);
            } else {
              console.error(JSON.stringify(results));
              console.error("measuresuite did not yield enough datapoints. TSNH.");
              process.exit(15);
            }
          } catch (e) {
            console.error(JSON.stringify(results));
            console.error(e, "Could not analyse measuresuites' results. TSNH.");
            process.exit(14);
          }

          //TODO increase num_batches, if the times have a big stddeviation
          //TODO change batch_size if the avg number is batch_size *= avg(times)/goal ; goal=10000cycles
        } catch (e) {
          const isIncorrect = e instanceof Error && e.message.includes("tested_incorrect");
          const isInvalid = e instanceof Error && e.message.includes("could not be assembled");
          if (isInvalid || isIncorrect) {
            writeasm(this.asmStrings[FUNCTIONS.F_A], path.join(this.resultspath, "tested_incorrect_A.asm"));
            writeasm(this.asmStrings[FUNCTIONS.F_B], path.join(this.resultspath, "tested_incorrect_B.asm"));
            writeasm(
              JSON.stringify(Model.nodesInTopologicalOrder),
              path.join(this.resultspath, "tested_incorrect.json"),
            );
          }

          if (isIncorrect) {
            console.error(e, ERRORS.measureIncorrect.msg);
            process.exit(ERRORS.measureIncorrect.exitCode);
          }
          if (isInvalid) {
            console.error(e, ERRORS.measureInvalid.msg);
            process.exit(ERRORS.measureInvalid.exitCode);
          }

          console.error(e, ERRORS.measureGeneric.msg);
          process.exit(ERRORS.measureGeneric.exitCode);
        }

        accumulatedTimeSpentByMeasuring += Date.now() - now_measure;

        const [meanrawA, meanrawB, meanrawCheck] = analyseResult.rawMedian;

        batchSize = Math.ceil((Number(this.args.cyclegoal) / meanrawCheck) * batchSize);
        if (batchSize > 10000) {
          batchSize = 10000;
        }
        const currentFunctionIsA = () => currentNameOfTheFunctionThatHasTheMutation === FUNCTIONS.F_A;

        console.log(currentFunctionIsA() ? "New".padEnd(10) : "New".padStart(10));

        let kept: boolean;

        if (
          // A is better and A is new
          (meanrawA <= meanrawB && currentFunctionIsA()) ||
          // or B is better and B is new
          (meanrawA >= meanrawB && !currentFunctionIsA())
        ) {
          console.log("kept    mutation");
          kept = true;
          currentNameOfTheFunctionThatHasTheMutation = toggleFUNCTIONS(
            currentNameOfTheFunctionThatHasTheMutation,
          );
        } else {
          // revert
          kept = false;
          this.revertFunction();
        }
        const indexGood = Number(meanrawA > meanrawB);
        const indexBad = 1 - indexGood;
        globals.currentRatio = meanrawCheck / Math.min(meanrawB, meanrawA);

        lastGood = analyseResult.rawMedian[indexGood];

        ratioString = globals.currentRatio /*aka: new ratio*/
          .toFixed(4);

        per_second_counter++;
        if (Date.now() - time > 1000) {
          time = Date.now();
          show_per_second = (per_second_counter + "/s").padStart(6);
          per_second_counter = 0;
        }
        if (numEvals % PRINT_EVERY == 0) {
          // print every 10th eval
          // a line every 5% (also to logfile) also write the asm when
          const writeout = numEvals % (this.args.evals / LOG_EVERY) === 0;
          const statusline = genStatusLine({
            writeout,
            ...this.args,
            stacklength,
            batchSize,
            no_of_instructions: this.no_of_instructions,
            analyseResult,
            indexGood,
            indexBad,
            choice,
            kept,
            numEvals,
            ratioString,
            show_per_second,
          });
          process.stdout.write(statusline);
          if (writeout) {
            this.logToLogfile(statusline);
            write_current_asm(numEvals);
          }

          globals.convergence.push(ratioString);
        }
        numEvals++;
        if (numEvals >= this.args.evals) {
          globals.time.generateCryptopt = (Date.now() - optimistaionStartDate) / 1000 - globals.time.validate;
          // DONE WITH OPTIMISING WRITE EVERYTING TO DISK AND EXIT.
          clearInterval(intervalHandle);
          write_current_asm();
          process.exit(0);
        }
      }
    }, 0);
  }
  public static recordError(e: Error): void {
    this._errors.push(e);
  }
}
