import { Register, Flags, imm, mem } from "./types";
import { isMem, isRegister } from "./helpers";
export class Instruction {
  constructor(
    public writeRegs: Register[],
    public readRegs: Register[],
    public writeFlags: Flags[],
    public readFlags: Flags[],
    public ins: string, // strings like "mov rax, 0x0"
  ) {}
}

export class MOV extends Instruction {
  constructor(src: Register | mem | imm, dest: Register | mem, comment = "") {
    if (isMem(src) && isMem(dest)) {
      throw new Error("Cannot mov from mem to mem.");
    }
    super(
      isRegister(dest) ? [dest] : [],
      isRegister(src) ? [src] : [],
      [],
      [],
      `mov ${dest}, ${src} ;${comment}`,
    );
  }
}
