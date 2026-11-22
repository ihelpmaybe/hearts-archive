/**
 * Minimal WalletClient-shaped sender for Studio — signs via Trezor, not injected.
 */
import {
  encodeFunctionData,
  type Abi,
  type Address,
  type Hash,
  type Hex,
  type WalletClient,
} from "viem";
import { pulsechain } from "viem/chains";
import { studioSendTx } from "./signPulseTx";

type SendArgs = {
  to?: Address | null;
  value?: bigint;
  data?: Hex;
  account?: Address;
  chain?: unknown;
};

type WriteArgs = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  account?: Address;
  chain?: unknown;
};

export function createStudioWalletClient(account: Address): WalletClient {
  const send = async (args: {
    to?: Address | null;
    value?: bigint;
    data?: Hex;
  }): Promise<Hash> => {
    if (!args.to) throw new Error("Studio tx needs a to address");
    return studioSendTx({
      account,
      to: args.to,
      value: args.value ?? 0n,
      data: args.data,
    });
  };

  const client = {
    account,
    chain: pulsechain,
    async sendTransaction(args: SendArgs): Promise<Hash> {
      return send({
        to: args.to ?? undefined,
        value: args.value,
        data: args.data,
      });
    },
    async writeContract(args: WriteArgs): Promise<Hash> {
      const data = encodeFunctionData({
        abi: args.abi,
        functionName: args.functionName,
        args: args.args as never,
      });
      return send({
        to: args.address,
        value: args.value ?? 0n,
        data,
      });
    },
  };

  return client as unknown as WalletClient;
}
