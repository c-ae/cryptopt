export type mem = string; // represent a memory location as a string a` la '[rsi+0xOFFSET]'
export type imm = string; // represent a immediate value as a string a` la '0x12'
export type asm = string; // strings like "mov rax, [rsp+10]"

export * from "./bridge/types";
export * from "./Registers.enum";

export enum DECISION_IDENTIFIER {
  DI_FLAG = "di_flag", // if a choice needs to be taken on which flag to choose from (add via OF or CF)
  DI_HANDLE_FLAGS_KK = "di_handle_flags_kk", // how to deal with two killed flags (in an add situation, for now).
  DI_CHOOSE_ARG = "di_choose_arg", // which Instruction arg to do something with (load to reg  or load to rdx or so...)
  DI_CHOOSE_IMM = "di_choose_imm", // in the case that there needs to be a immediate value to be loaded to a reg (think clear OF)
  DI_INSTRUCTION_AND = "di_choose_instr_and", // e.g. bzhi | and
  DI_MULTIPLICATION_IMM = "di_mult_imm", // if we multiply a value by a known immediate, we can choose different instrs. (*2 -> *2 | +itself | shl|| *5 lea [x+4*x])
}

// C stands for choice (as in possible values for the DI_HANDLE_FLAGS_KK to be)
export enum C_DI_HANDLE_FLAGS_KK {
  C_ADD = "c_add", // just use the add operation
  C_XOR_ADX = "c_xor_adx", // get a unused register, xor it to 0, then decide again on which flag to use w/ adx
  C_TEST_ADX = "c_test_adx", // same as C_XOR_ADX, but not writing a 0 to a register.
}

// C stands for choice
export enum C_DI_INSTRUCTION_AND {
  C_AND = "c_and", // use plain old and
  C_BZHI = "c_bzhi", // zero higher bits
}

// C stands for choice
export enum C_DI_MULTIPLICATION_IMM {
  // C_lea_M = "c_lea_*", // lea rax = [      2 * rax]
  C_SHL = "c_shl", // use at least one shift
  C_SHLX = "c_shlx", // same as shl, but use shlx, needs the const. in an reg, does not affect flags. and can save in different spot and can read from mem
  C_LEA = "c_lea", // some combination (for now...)
  C_IMUL = "c_imul", //
}

export enum C_DI_IMM {
  ZERO = "0x0",
  NEG_1 = "-0x1",
}

export enum Flags {
  OF = "OF",
  CF = "CF",
}

export enum FUNCTIONS {
  F_A = "function_A",
  F_B = "function_B",
}
export enum CHOICE {
  PERMUTE = " P",
  DECISION = "D ",
}

// let op be \in CHAINABLE_OPS, then A op (B op (C op D)) will be squashed to A op B op C op D
export const CHAINABLE_OPS: CryptOpt.Operation_T[] = ["-", "&", "|"];

import { Fiat } from "./fiat-bridge/fiat.types";
export namespace CryptOpt {
  export type Operation_T =
    | Fiat.Operation
    // | "-" // name = arguments[0] - arguments[1] - arguments[2]
    // | "<<" // name = arguments[0] >> arguments [1]
    // | ">>" // name = arguments[0] >> arguments [1] (logical shift right)
    | "sar" // arithmetic shift right
    | "shrd" // name = arguments[0], arguments [1] >> arguments [2]; shift arg0 arg2-bits to the right, filling up with bits from arg1
    | "ror"
    | "^" //xor
    | "limb" // only available on u128 variables. selects limb arguments[1] form arguments[0] (x2=limb(x1, 1) with x1 a u128, with assign x2 the high limb from x1;
    | "cmp"
    | "zext";
  // grep operation -r *.json |tr -s '[[:space:]]' |  cut -d":" -f 3 | sed -e 's/,/|/' |sort |uniq

  export type Datatype_T = Fiat.Datatype;
  export type VarnameL = `${Fiat.VarName}_${number}`; // limb
  export type VarnameNL = Fiat.VarName; // no-limb
  export type Varname = VarnameL | VarnameNL; // either
  export type HexConstant = Fiat.HexConstant | `-${Fiat.HexConstant}`; // 0x{string} or -0x{string}
  export type ConstArgument =
    | Exclude<Fiat.ConstArgument, Fiat.HexConstant | Fiat.VarName>
    | HexConstant //-0xabc, 0xabe
    | Varname; // extends Fiat Types to x1_1
  export type Argument = ConstArgument | DynArgument;

  /**
   *
   * This is more specific, using tuples rather than arrays.
   */
  export type DynArgumentName =
    | []
    | [Fiat.OutVarName] // out1[0]
    | [Fiat.OutName] // out1 (used in addcarryx)
    | [Varname] // x1
    | [Varname | "_", Varname] // x1, x2 and _, x2 for the case one does not care about HI limb
    | [Varname, "_"]; //  x2, _ for the case one does not care about LO limb /** cant combine them to avoid "_","_" which does not make sense.
  export interface DynArgument extends Omit<Fiat.DynArgument, "operation" | "arguments" | "name"> {
    name: DynArgumentName;
    operation: Operation_T;
    arguments: Argument[];
    decisions: {
      [DECISION_IDENTIFIER.DI_FLAG]?: [number, Flags[]];
      [DECISION_IDENTIFIER.DI_HANDLE_FLAGS_KK]?: [number, C_DI_HANDLE_FLAGS_KK[]];
      [DECISION_IDENTIFIER.DI_CHOOSE_ARG]?: [number, string[]]; // probably len 2 or three (rdx or add(a,b,c))
      [DECISION_IDENTIFIER.DI_CHOOSE_IMM]?: [number, string[]]; // probably len 2 ["0x0", "-0x1"]
      [DECISION_IDENTIFIER.DI_MULTIPLICATION_IMM]?: [number, C_DI_MULTIPLICATION_IMM[]]; //
      [DECISION_IDENTIFIER.DI_INSTRUCTION_AND]?: [number, string[]]; // probably len 2  bzhi / and
    };
    decisionsHot: string[];
  }

  export type Function = Omit<Fiat.FiatFunction, "body"> & { body: StringInstruction[] };

  export interface StaticCastInstruction extends DynArgument {
    name: [];
    operation: "static_cast";
    arguments: Argument[];
  }

  export interface ArgumentWithStringArguments extends DynArgument {
    arguments: ConstArgument[];
  }

  /**
   * This is more specific, using tuples rather than arrays.
   * Also it narrows down to not use empty arrays
   */
  export interface ArgumentWithStringNames extends DynArgument {
    name: Exclude<DynArgument["name"], []>;
  }

  export interface StringInstruction
    extends Omit<ArgumentWithStringNames, "arguments">,
      Omit<ArgumentWithStringArguments, "name"> {}
}

// const a: CryptOpt.ArgumentWithStringNames = {
//   name: ["out1[8]"],
//   arguments: ["x2"],
//   operation: "*",
//   datatype: "u64",
//   decisionsHot: [],
//   decisions: {},
// };

export interface CryptoptGlobals {
  currentRatio: number;
  convergence: string[]; // numbers, but .toFixed(4)
  time: {
    // in seconds
    validate: number;
    generateCryptopt: number;
  };
}
