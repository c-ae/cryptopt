import { cloneDeep } from "lodash";
import fs from "fs";
import { IMM_64_BIT_IMM, IMM_31_BIT_IMM } from "./constants";

import { CryptOpt, Flags, asm, mem, imm, Register, DwordRegister, ByteRegister, FUNCTIONS } from "./types";
import {
  IMM_REGEX,
  XD_REGEX,
  MEM_REGEX,
  ARG_PREFIX_REGEX,
  ARG_REGEX,
  ARG_PREFIX,
  OUT_PREFIX,
  CALLER_SAVE_PREFIX,
} from "./constants";
import Paul from "@/Paul.class";
import { Allocation, U1Allocation, U64Allocation } from "./Allocation.types";
import { RegisterAllocator } from "@/RegisterAllocator.class";

export * from "./lamdas";

// splits strings at _ and writes numbers as base16
export function toImm(val: string | number): imm {
  if (typeof val === "string") {
    return val;
  }
  return val < 0 ? `-0x${(-val).toString(16)}` : `0x${val.toString(16)}`;
}
// gets the memorylocation for a given offset
export function toMem(offset: number | string, base: Register = Register.rsp): mem {
  return `[ ${base} + 0x${(Number(offset) * 8).toString(16)} ]`;
}

export function matchXD(variable: string | null | undefined): RegExpMatchArray | null {
  if (!variable) {
    return null;
  }
  return variable.match(XD_REGEX);
}
export function isXD(variable: string | null | undefined): variable is CryptOpt.Varname {
  return !!variable?.match(XD_REGEX);
}
export function assertXD(variable: string | null | undefined): asserts variable is CryptOpt.Varname {
  if (!isXD(variable)) {
    throw new Error(`${variable} is not xd, which is should be`);
  }
}

export function matchIMM(variable: string | null | undefined): RegExpMatchArray | null {
  if (!variable) {
    return null;
  }
  return variable.match(IMM_REGEX);
}
export function isCallerSave(variable: string | null | undefined): boolean {
  if (!variable) {
    return false;
  }
  return variable.startsWith(CALLER_SAVE_PREFIX);
}
export function matchArgPrefix(variable: string | null | undefined): RegExpMatchArray | null {
  if (!variable) {
    return null;
  }
  return variable.match(ARG_PREFIX_REGEX);
}
export function matchArg(variable: string | null | undefined): RegExpMatchArray | null {
  if (!variable) {
    return null;
  }
  return variable.match(ARG_REGEX);
}
// matches argN[n]
export function isReadOnlyMemory(variable: string | null | undefined): boolean {
  return variable?.match(ARG_REGEX)?.groups?.base?.startsWith(ARG_PREFIX) ?? false;
}
// matches outN[n]
export function isWriteOnlyMemory(variable: string | null | undefined): boolean {
  return variable?.match(ARG_REGEX)?.groups?.base?.startsWith(OUT_PREFIX) ?? false;
}
export function matchMem(variable: string | null | undefined): RegExpMatchArray | null {
  if (!variable) {
    return null;
  }
  return variable.match(MEM_REGEX);
}

export function isRegister(test: string | undefined | null): test is Register {
  if (!test) {
    return false;
  }
  for (const r in Register) {
    if (r === test) return true;
  }
  return false;
}

export function isByteRegister(test: string | undefined | null): test is ByteRegister {
  if (!test) {
    return false;
  }
  for (const r in ByteRegister) {
    if (r === test) return true;
  }
  return false;
}

export function isFlag(test?: string): test is Flags {
  if (!test) {
    return false;
  }
  return [Flags.CF, Flags.OF].includes(test as Flags);
}

export function isImm(test: string): test is imm {
  return IMM_REGEX.test(test);
}

export function isMem(test?: string): test is mem {
  if (!test) {
    return false;
  }
  return MEM_REGEX.test(test);
}

export function isNotNoU<T>(arg: T | null | undefined): arg is T {
  return !(arg === null || arg === undefined);
}
export function getByteRegFromQwReg(reg: Register): ByteRegister {
  const mapping: { [reg in Register]: ByteRegister } = {
    [Register.rax]: ByteRegister.al,
    [Register.rbx]: ByteRegister.bl,
    [Register.rcx]: ByteRegister.cl,
    [Register.rdx]: ByteRegister.dl,
    [Register.rdi]: ByteRegister.dil,
    [Register.rsi]: ByteRegister.sil,
    [Register.rsp]: ByteRegister.spl,
    [Register.rbp]: ByteRegister.bpl,
    [Register.r8]: ByteRegister.r8b,
    [Register.r9]: ByteRegister.r9b,
    [Register.r10]: ByteRegister.r10b,
    [Register.r11]: ByteRegister.r11b,
    [Register.r12]: ByteRegister.r12b,
    [Register.r13]: ByteRegister.r13b,
    [Register.r14]: ByteRegister.r14b,
    [Register.r15]: ByteRegister.r15b,
  };
  return mapping[reg];
}

export function getQwRegFromByteReg(reg: ByteRegister): Register {
  const mapping: { [reg in ByteRegister]: Register } = {
    [ByteRegister.al]: Register.rax,
    [ByteRegister.ah]: Register.rax,
    [ByteRegister.bl]: Register.rbx,
    [ByteRegister.bh]: Register.rbx,
    [ByteRegister.cl]: Register.rcx,
    [ByteRegister.ch]: Register.rcx,
    [ByteRegister.dl]: Register.rdx,
    [ByteRegister.dh]: Register.rdx,
    [ByteRegister.dil]: Register.rdi,
    [ByteRegister.sil]: Register.rsi,
    [ByteRegister.spl]: Register.rsp,
    [ByteRegister.sp]: Register.rsp,
    [ByteRegister.bpl]: Register.rbp,
    [ByteRegister.bp]: Register.rbp,
    [ByteRegister.r8b]: Register.r8,
    [ByteRegister.r9b]: Register.r9,
    [ByteRegister.r10b]: Register.r10,
    [ByteRegister.r11b]: Register.r11,
    [ByteRegister.r12b]: Register.r12,
    [ByteRegister.r13b]: Register.r13,
    [ByteRegister.r14b]: Register.r14,
    [ByteRegister.r15b]: Register.r15,
  };
  return mapping[reg];
}
export function getDwordRegFromQwReg(reg: Register): DwordRegister {
  const mapping: { [reg in Register]: DwordRegister } = {
    [Register.rax]: DwordRegister.eax,
    [Register.rbx]: DwordRegister.ebx,
    [Register.rcx]: DwordRegister.ecx,
    [Register.rdx]: DwordRegister.edx,
    [Register.rdi]: DwordRegister.edi,
    [Register.rsi]: DwordRegister.esi,
    [Register.rsp]: DwordRegister.esp,
    [Register.rbp]: DwordRegister.ebp,
    [Register.r8]: DwordRegister.r8d,
    [Register.r9]: DwordRegister.r9d,
    [Register.r10]: DwordRegister.r10d,
    [Register.r11]: DwordRegister.r11d,
    [Register.r12]: DwordRegister.r12d,
    [Register.r13]: DwordRegister.r13d,
    [Register.r14]: DwordRegister.r14d,
    [Register.r15]: DwordRegister.r15d,
  };
  return mapping[reg];
}

export const beautify = (instruction: asm): string =>
  instruction
    .split(";")
    .map((a) => a.padEnd(40))
    .join(";");

/**
 * will make a deep copy of @param nodes,
 * @returns a new Array with a mixed order
 * @param _elements input array to shuffle
 */
export function mix<T>(_elements: T[]): T[] {
  const elements = cloneDeep(_elements) as T[];
  const len = elements.length;
  const res = new Array(len);
  for (let i = 0; i < len; i++) {
    const c = Paul.pick(elements);
    res[i] = c;
  }
  return res;
}

// will get rid of all undefined entries and entries less than 1 and return the MIN of the resulting numbers
export function getMin(arr: Array<number | undefined>): number {
  const ns = arr.filter((v) => typeof v === "number" && v > 0) as number[];
  return Math.min(...ns);
}

// can also take an undefined input; returns F_A then
export function toggleFUNCTIONS(f: FUNCTIONS = FUNCTIONS.F_B): FUNCTIONS {
  return f === FUNCTIONS.F_A ? FUNCTIONS.F_B : FUNCTIONS.F_A;
}

export function toggleFlag(f: Flags): Flags {
  return f === Flags.CF ? Flags.OF : Flags.CF;
}

export function zx(br: ByteRegister | Register): { inst: asm; reg: Register } {
  if (isRegister(br)) {
    return { inst: `; why am i here ? ${br} is already a qw reg`, reg: br };
  }

  const reg = getQwRegFromByteReg(br);
  return { inst: `movzx ${reg}, ${br}`, reg };
}
export const isU64 = (va: Allocation | undefined | null): va is U64Allocation =>
  (va && "datatype" in va && va.datatype === "u64") || false;

export const isU1 = (va: Allocation | undefined | null): va is U1Allocation =>
  (va && "datatype" in va && va.datatype === "u1") || false;

export const assertStringArguments: (
  c: CryptOpt.Argument,
) => asserts c is CryptOpt.ArgumentWithStringArguments = (c) => {
  if (typeof c === "string" || c.arguments.length == 0 || c.arguments.some((a) => typeof a !== "string")) {
    throw new Error(` ${c} was used with hierarchical arguments. This is not yet supported`);
  }
};

export const assertStringNames: (c: CryptOpt.Argument) => asserts c is CryptOpt.ArgumentWithStringNames = (
  c,
) => {
  if (typeof c === "string") {
    throw new Error(`Argument is expected to be an object, but it is a string: ${c}. Assertion Failed.`);
  }
  if (c.name.length < 1 || c.name.length > 2) {
    throw new Error(
      `Argument is expected to be an object with names being a tuple with 1 or 2 elements, instead it has ${c.name.length} elements. Assertion Failed.`,
    );
  }
  const a = [1, 12] as [number, number] | [];
  a.every((a) => a + 1);

  if (c.name.some((a) => typeof a !== "string")) {
    throw new Error(`${c} is a operation which has names wh, which are not all strings.`);
  }
};
/**
 * This function will get the Register allocator and check, whether for any register, the
 *  same byte register is allocated as well. If so, itll throw.
 */
export function sanityCheckAllocations(c: CryptOpt.DynArgument): void {
  const ra = RegisterAllocator.getInstance();
  const allocations = ra.getCurrentAllocations();
  Object.entries(allocations).reduce((byReg, [varname, { store }]) => {
    let r64 = null;
    if (isRegister(store)) {
      r64 = store;
    }
    if (isByteRegister(store)) {
      r64 = getQwRegFromByteReg(store);
    }
    if (isFlag(store)) {
      r64 = store;
    }
    if (r64) {
      if (byReg[r64]) {
        throw new Error(
          `@calculating ${c.name.join("--")}, ${r64} is used twice. ${
            byReg[r64]
          } and for ${varname}. Allocations: ${ra.allocationString()}`,
        );
      }
      byReg[r64] = varname;
    }
    if (matchArg(varname)) {
      throw new Error("should not be allocated.");
    }
    return byReg;
  }, {} as { [k in Register | Flags]: string });
}

export function setToString(s: Set<string>, max = Infinity): string {
  let depstring = '"';
  let i = 0;
  for (const v of s.values()) {
    if (i == 0) depstring += v;
    else depstring += `, ${v}`;
    if (i++ == max) break;
  }
  return depstring + '"';
}

export function writeasm(asmString: string, filename: string): void {
  // remove the speculation barrier, when finalizing the output
  asmString = asmString.split("\n").join("\n");
  fs.writeFileSync(filename, asmString);
}

export function limbify(
  arg:
    | CryptOpt.DynArgument["name"]
    | CryptOpt.DynArgument["name"][number]
    | CryptOpt.ArgumentWithStringArguments["arguments"]
    | CryptOpt.ArgumentWithStringArguments["arguments"][number],
) {
  let xdd;
  if (Array.isArray(arg)) {
    if (arg.length > 1) {
      throw new Error("Are you sure you want to limbify this ?");
    }
    xdd = arg[0];
  } else {
    xdd = arg;
  }
  const match = matchXD(xdd);
  if (match && !match?.[2]) {
    // if there is a match, but no _d
    return [`${xdd}_0`, `${xdd}_1`] as [CryptOpt.VarnameL, CryptOpt.VarnameL];
  }
  // either no match (aka imm/out1/...) or it already has a limb
  return [xdd] as [CryptOpt.VarnameL];
}
/**
 * This one cuts of the n-part from xDD_n
 */
export function delimbify(
  arg: CryptOpt.ArgumentWithStringArguments["arguments"][number] | CryptOpt.Varname,
): Exclude<CryptOpt.ArgumentWithStringArguments["arguments"][number], CryptOpt.VarnameL> {
  const xdd = arg.match(/(?<xdd>x\d+)_\d/)?.groups?.xdd as undefined | CryptOpt.VarnameNL;
  // we can cast because if it would be VarnameL, than it would match and we would return VarnameNL... TypeScript doesn't know this though
  return (
    xdd ?? (arg as Exclude<CryptOpt.ArgumentWithStringArguments["arguments"][number], CryptOpt.VarnameL>)
  );
}

/**
 * as in: safe unsigned.
 * as in: must be smaller than
 */
export function isSafeImm32(a: CryptOpt.HexConstant) {
  if (a.startsWith("-")) {
    throw new Error("unimplemented");
  }
  const n = BigInt(a);
  // for now: positive,
  return n > 0 && n <= BigInt(IMM_31_BIT_IMM);
}

/**
 * This one cuts long imms in to its 64-bits parts
 * or gives back just one limb
 */
export function limbifyImm<T extends CryptOpt.ArgumentWithStringArguments["arguments"][number]>(i: T) {
  // return if its not imm
  if (!isImm(i)) {
    return [i] as [T];
  }
  const isNeg = i.startsWith("-");
  const abs_i = i.replaceAll("-", "") as T;
  // if that imm is shorter than that, we know it's less that 64 bits. and we just return
  if (abs_i.length <= IMM_64_BIT_IMM.length) {
    return [i] as [T];
  }

  if (isNeg) {
    throw new Error(` >${i}< is negative and bigger than IMM_64_BIT_IMM, we don't know what to to.`);
  }
  // else positive and long
  const { hi, lo } = /0x(?<hi>\w{1,16})(?<lo>\w{16})$/.exec(i)?.groups! as { hi: string; lo: string };
  return [`0x${lo}`, `0x${hi}`] as [CryptOpt.HexConstant, CryptOpt.HexConstant];
}

export function makeU64NameLimbs<T extends CryptOpt.ArgumentWithStringNames>(node: T) {
  const r = node.datatype == "u128" ? limbify(node.name) : node.name;
  // until https://github.com/microsoft/TypeScript/issues/44373 is adressed
  return r as Array<CryptOpt.Varname | "_">;
}
