import {
  ALGORITHM_VERSIONS,
  type CastingMethod,
} from "@/domain/casting/types";
import { DomainError } from "@/server/errors/domain-error";
import { isExternalReleaseGateApproved } from "./release-gates";

type MethodReleaseEnv = Record<string, string | undefined>;

export interface MethodReleasePolicy {
  assertReleased(method: CastingMethod): void;
  isReleased(method: CastingMethod): boolean;
}

export class ProductionMethodReleasePolicy implements MethodReleasePolicy {
  constructor(private readonly env: MethodReleaseEnv = process.env) {}

  isReleased(method: CastingMethod): boolean {
    if (method === "three_coin") return true;
    if (method === "yarrow_stalk") {
      return isExternalReleaseGateApproved("G-03")
        && this.env.YARROW_RULESET_APPROVED_VERSION === ALGORITHM_VERSIONS.yarrow_stalk;
    }
    return isExternalReleaseGateApproved("G-04")
      && this.env.MEI_HUA_RULESET_APPROVED_VERSION === ALGORITHM_VERSIONS.mei_hua_current_time;
  }

  assertReleased(method: CastingMethod): void {
    if (this.isReleased(method)) return;
    const requiredVersion = ALGORITHM_VERSIONS[method];
    throw new DomainError(
      "METHOD_NOT_RELEASED",
      `This casting method is not available until ruleset ${requiredVersion} has completed release approval.`,
      false,
      "method",
    );
  }
}

export const allowAllMethodsPolicy: MethodReleasePolicy = {
  isReleased: () => true,
  assertReleased: () => undefined,
};
