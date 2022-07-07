import { CryptOpt } from "@/types";
import type { Fiat } from "../fiat-bridge/fiat.types";
export interface Bridge {
  getCryptOptFunction(method: string): CryptOpt.Function;
  argwidth(curve: string, method: string): number;
  argnumin(method: string): number;
  argnumout(method: string): number;
  machinecode(method: string, filename: string): string;
}
export type { Fiat };
