/**
 * Donation destinations — keep in lockstep with vault
 * `memory/crypto/donation-addresses.json` (project-tip-jar).
 */

function assertPulseAddress(address: string, name: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(
      `[wallets] Invalid ${name} address — fix src/data/wallets.ts before shipping.`,
    );
  }
}

export const FOOTER_DONATION = {
  label: "Donate (PLS / PulseChain)",
  address: "0x64fB4919D9336a059cbD5F4428E319d0F232F64d",
} as const;

assertPulseAddress(FOOTER_DONATION.address, "Footer donation");
