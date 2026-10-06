import { Injectable } from "@nestjs/common";
import {
  AuthenticationStorage,
  type MfaStore,
  type RefreshTokenStore,
} from "@nestjs/authentication";

/**
 * The package consults these contracts even for password-only sessions.
 * No authenticator or refresh token can exist until a real store replaces this one.
 */
@Injectable()
export class DisabledAuthenticationFeaturesStore
  implements MfaStore, RefreshTokenStore
{
  constructor(storage: AuthenticationStorage) {
    storage.registerSource({ mfa: this, refreshTokens: this });
  }

  async getTotp() {
    return undefined;
  }
  async getRefreshToken() {
    return undefined;
  }
  async countRecoveryCodes() {
    return 0;
  }
  async countMfaFailures() {
    return 0;
  }
  async isRefreshTokenFamilyRevoked() {
    return true;
  }
  async clearMfaFailures() {}
  async revokeRefreshTokenFamily() {}
  async revokeUserRefreshTokens() {}

  async saveTotp() {
    throw featureDisabled("MFA");
  }
  async claimTotpStep(): Promise<boolean> {
    throw featureDisabled("MFA");
  }
  async saveRecoveryCodes() {
    throw featureDisabled("MFA");
  }
  async consumeRecoveryCode(): Promise<boolean> {
    throw featureDisabled("MFA");
  }
  async recordMfaFailure(): Promise<number> {
    throw featureDisabled("MFA");
  }
  async saveRefreshToken() {
    throw featureDisabled("Refresh tokens");
  }
  async markRefreshTokenUsed(): Promise<boolean> {
    throw featureDisabled("Refresh tokens");
  }
}

function featureDisabled(feature: string) {
  return new Error(
    `${feature} support is disabled. Configure persistent storage before enabling this feature.`,
  );
}
