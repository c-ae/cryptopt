import { execSync } from "child_process";
import { existsSync, accessSync, chmodSync, constants as FS_CONSTANTS } from "fs";
import os from "os";

import {
  AVAILABLE_CURVES,
  AVAILABLE_METHODS,
  CURVE_DETAILS,
  CURVE_T,
  METHOD_DETAILS,
  METHOD_T,
} from "./constants";

import { BINS } from "./enums";
import fiat from "./all_fiat_array";
import { Fiat } from "./fiat.types";
import env from "../envHelper";
export * from "./constants";

const { CC, CFLAGS } = env;
const shouldTeeToTmp = false;

export default class FiatBridge {
  //decides, if we need to read local c / libs / jsons or if we can generate them on the fly
  private static get readlocal(): boolean {
    // we are on an ancient system (Cough * kernel 3.x Cough Phoenix Cough GLIB-from-the-stone-age).
    const type = os.type();
    return type === "Darwin" || (type == "Linux" && os.release().startsWith("3"));
  }

  public static argnumin(m: METHOD_T): number {
    if (!AVAILABLE_METHODS.includes(m)) {
      throw new Error(`unsupported method ${m}`);
    }
    if (m === "square") return 1;
    // add, sub, mul
    return 2;
  }

  public static argnumout(_m: METHOD_T): number {
    return 1;
  }

  public static argwidth(c: CURVE_T): number {
    if (c in CURVE_DETAILS) return CURVE_DETAILS[c].argwidth;
    throw new Error(`unsupported curve ${c}`);
  }

  public static bounds(c: CURVE_T): string[] {
    return CURVE_DETAILS[c].bounds;
  }

  /**
   * calls ./unsaturated_solinas or ./word_by_word_montgomery,
   * obtains the JSON code and returns the parsed string of the specified @param method on @param curve
   */
  public static getFiatFunction(curve: CURVE_T, method: METHOD_T): Fiat.FiatFunction {
    const { cmd, methodname } = FiatBridge.buildCommand(curve, method, "JSON");
    let command = `${cmd} | jq -s .[0]`;
    if (shouldTeeToTmp) {
      command += ` | tee /tmp/fiat_cur${curve}_${method}.json`;
    }
    console.log(`executing cmd to generate fiat: ${command}`);

    const r = FiatBridge.readlocal
      ? (fiat.find(({ operation }) => operation === methodname) as Fiat.FiatFunction)
      : (JSON.parse(execSync(command).toString()) as Fiat.FiatFunction);
    return r;
  }

  /**
   * calls the ./unsaturated_solinas or ./word_by_word_montgomery with @param curve @param method to get the C code, and compiles the c code to an so
   * @returns the name of the symbol, which is being present in @param filename after this function is finished.
   * if force is false, it will check if the machinecode needs to be generated, and skip the step if its not necessary
   */
  public static machinecode(
    curve: CURVE_T,
    method: METHOD_T,
    filename = "libcheckfunctions.so",
    ccOverwrite: string | undefined = undefined,
    force = true,
  ): string {
    let { cmd, methodname } = FiatBridge.buildCommand(curve, method, "C");
    if (!force && existsSync(filename)) {
      return methodname;
    }
    let cc = ccOverwrite ?? CC; // this is being used for the x-val, where in one session of the FiatBridge, the CC chagnes

    if (shouldTeeToTmp) {
      cmd += ` | tee /tmp/fiat_cur${curve}_${method}.c`;
    }

    const command = FiatBridge.readlocal
      ? // fallback to compiling all curves / methods and hoping that the correct one was in there
        `${cc} ${CFLAGS} -fPIC -shared -o ${filename} ${__dirname}/fiat.c`
      : `${cmd} | ${cc} ${CFLAGS} -x c -fPIC -shared -o ${filename} -`;

    console.log(`executing cmd to generate machinecode: ${command}`);
    execSync(command);

    return methodname;
  }

  /**
   * this is a helper function which looks up the parameters for @param method on curve @param curve.
   * It also validated, if the generation binaries are present (./word_by_word_montgomery or ./unsaturated_solinas), depending on the curve.
   * It @returns a string to be executed in the current dir and the method it has created (like mul or carry_mul).
   */
  public static buildCommand(
    curve: CURVE_T,
    method: METHOD_T,
    lang: "C" | "JSON",
  ): { cmd: string; methodname: string } {
    const { binary, prime, bitwidth, argwidth } = CURVE_DETAILS[curve];
    const binWithPath = `${__dirname}/${binary}`;

    this.check(curve, method, binWithPath, lang);

    const required_function = METHOD_DETAILS[method].name[binary]; // e.g carry_mul
    const methodname = `fiat_${curve}_${required_function}`;

    // independent of implementation strategy
    const CODE_GENERATION_ARGS = {
      // JSON: "--no-primitives --no-wide-int",
      JSON: "--no-primitives --emit-all-casts",
      C: " --inline-internal --internal-static --use-value-barrier",
      // C: " --inline-internal --internal-static --use-value-barrier --no-primitives --no-wide-int ",
    };

    switch (binary) {
      case BINS.unsaturated:
        return {
          cmd: `${binWithPath} --lang ${lang} ${CODE_GENERATION_ARGS[lang]} '${curve}' '${bitwidth}' '${argwidth}' '${prime}' ${required_function}`,
          methodname,
        };
      case BINS.wbw_montgomery:
        return {
          cmd: `${binWithPath} --lang ${lang} ${CODE_GENERATION_ARGS[lang]} '${curve}' '${bitwidth}'               '${prime}' ${required_function}`,
          methodname,
        };
    }
  }
  /**
   * creates string to execute for proof.
   * Depending on curve, it'll invoke unsaturated_solinas or word_by_word_montgomery with resp. arguments
   */

  public static buildProofCommand(curve: CURVE_T, method: METHOD_T, hintsFilename: string): string {
    const { binary, prime, bitwidth, argwidth } = CURVE_DETAILS[curve];
    const binWithPath = `${__dirname}/${binary}`;

    this.check(curve, method, binWithPath);

    const required_function = METHOD_DETAILS[method].name[binary]; // e.g carry_mul

    let CODE_PROOF_ARGS = [
      "--no-primitives",
      "--no-wide-int",
      "--shiftr-avoid-uint1",
      "--output /dev/null",
      "--output-asm /dev/null",
    ].join(" ");

    const hintstring = `--hints-file ${hintsFilename}`;

    switch (binary) {
      case BINS.unsaturated:
        CODE_PROOF_ARGS += ` --tight-bounds-mul-by 1.000001`;
        return `${binWithPath}  ${CODE_PROOF_ARGS} '${curve}' '${bitwidth}' '${argwidth}' '${prime}' ${required_function} ${hintstring}`;
      case BINS.wbw_montgomery:
        return `${binWithPath}  ${CODE_PROOF_ARGS} '${curve}' '${bitwidth}'               '${prime}' ${required_function} ${hintstring}`;
    }
  }

  /**
   * checks if file @param binary is present
   * checks if @param method is supported
   * checks if @param curve is supported
   * checks if @param lang is supported
   * @throws if any check fails.
   */
  private static check(curve: CURVE_T, method: METHOD_T, binary: string, lang?: string): void {
    if (!AVAILABLE_METHODS.includes(method)) {
      throw new Error(`Invalid method. Arg ${method} is not in ${AVAILABLE_METHODS}.`);
    }

    if (!AVAILABLE_CURVES.includes(curve)) {
      throw new Error(`Invalid curve. Arg ${curve} is not in ${AVAILABLE_CURVES}.`);
    }

    if (lang && !["C", "JSON"].includes(lang)) {
      throw new Error(`Unsupported lang "${lang}"`);
    }

    if (!existsSync(binary)) {
      throw new Error(`${binary} does not exist. Cannot create ${lang} code.`);
    }

    const requiredPermissions = FS_CONSTANTS.F_OK | FS_CONSTANTS.R_OK | FS_CONSTANTS.X_OK | FS_CONSTANTS.W_OK;
    try {
      accessSync(binary, requiredPermissions);
      // here it exists with correct permissons
    } catch (e) {
      // here it exists with INCORRECT permissons
      try {
        chmodSync(binary, requiredPermissions);
        // here it exists with correct permissons
      } catch (e) {
        // here it exists with INCORRECT permissons, cause they couldn't be set. Fatal here.
        const permOct = `0${requiredPermissions.toString(8)}`;
        throw new Error(
          `${binary} does exist, but does not have the correct permissions (${permOct}). Cannot change permissions either - this is an error code.`,
        );
      }
    }
  }
}
