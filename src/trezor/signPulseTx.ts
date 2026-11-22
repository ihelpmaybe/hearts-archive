/**
 * Sign + broadcast a PulseChain tx with Trezor Connect (real device path).
 */
import {
  createPublicClient,
  http,
  serializeTransaction,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { pulsechain } from "viem/chains";
import {
  TrezorConnect,
  ensureTrezorInit,
  humanTrezorError,
  isTrezorInited,
} from "./connect";
import { ethAccountPath } from "./paths";
import { getPulseRpcUrls } from "../wagmi";

const INDEX_KEY = "hearts-archive-trezor-sign-index";

export function setTrezorSignIndex(index: number) {
  try {
    sessionStorage.setItem(INDEX_KEY, String(Math.max(0, Math.floor(index))));
  } catch {
    /* ignore */
  }
}

export function getTrezorSignIndex(): number {
  try {
    const n = Number(sessionStorage.getItem(INDEX_KEY));
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function pulsePublicClient() {
  const url = getPulseRpcUrls()[0];
  return createPublicClient({
    chain: pulsechain,
    transport: http(url, { timeout: 60_000 }),
  });
}

function toHexQuantity(n: bigint): string {
  return `0x${n.toString(16)}`;
}

type TrezorSig = { v: string | number; r: string; s: string };

function normalizeSig(payload: unknown): { r: Hex; s: Hex; v: bigint } {
  const p = payload as TrezorSig;
  if (p?.r == null || p?.s == null || p?.v == null) {
    throw new Error("Trezor returned no signature.");
  }
  const r = (p.r.startsWith("0x") ? p.r : `0x${p.r}`) as Hex;
  const s = (p.s.startsWith("0x") ? p.s : `0x${p.s}`) as Hex;
  const v = typeof p.v === "number" ? BigInt(p.v) : BigInt(p.v);
  return { r, s, v };
}

export type StudioSendTxArgs = {
  account: Address;
  to: Address;
  value?: bigint;
  data?: Hex;
  derivationIndex?: number;
};

/** Prepare fees, sign on Trezor, broadcast on PulseChain (369). */
export async function studioSendTx(args: StudioSendTxArgs): Promise<Hash> {
  await ensureTrezorInit();
  if (!isTrezorInited()) {
    throw new Error(
      "Trezor Connect still starting — wait a second, then click again.",
    );
  }

  const index = args.derivationIndex ?? getTrezorSignIndex();
  const path = ethAccountPath(index);
  const client = pulsePublicClient();
  const value = args.value ?? 0n;
  const data = (args.data ?? "0x") as Hex;

  const nonce = await client.getTransactionCount({
    address: args.account,
    blockTag: "pending",
  });

  let gas: bigint;
  try {
    gas = await client.estimateGas({
      account: args.account,
      to: args.to,
      value,
      data,
    });
    gas = (gas * 12n) / 10n;
  } catch {
    gas = 500_000n;
  }

  const fees = await client.estimateFeesPerGas().catch(() => null);
  const legacyGasPrice = await client.getGasPrice().catch(() => 1_000_000_000n);
  const useEip1559 = fees?.maxFeePerGas != null && fees.maxFeePerGas > 0n;

  const trezorTx: Record<string, unknown> = {
    to: args.to,
    value: toHexQuantity(value),
    data,
    chainId: pulsechain.id,
    nonce: toHexQuantity(BigInt(nonce)),
    gasLimit: toHexQuantity(gas),
  };

  if (useEip1559) {
    trezorTx.maxFeePerGas = toHexQuantity(fees!.maxFeePerGas!);
    trezorTx.maxPriorityFeePerGas = toHexQuantity(
      fees!.maxPriorityFeePerGas ?? fees!.maxFeePerGas! / 10n,
    );
  } else {
    trezorTx.gasPrice = toHexQuantity(legacyGasPrice);
  }

  const signed = await TrezorConnect.ethereumSignTransaction({
    path,
    transaction: trezorTx as never,
  });

  if (!signed.success) {
    const fail = signed as unknown as {
      payload?: { error?: string };
      error?: { message?: string } | string;
    };
    const err =
      fail.payload?.error ||
      (typeof fail.error === "string" ? fail.error : fail.error?.message) ||
      "Trezor sign failed";
    throw new Error(humanTrezorError(String(err)));
  }

  const sig = normalizeSig(signed.payload);

  const serialized = useEip1559
    ? serializeTransaction(
        {
          chainId: pulsechain.id,
          nonce,
          to: args.to,
          value,
          data,
          gas,
          maxFeePerGas: fees!.maxFeePerGas!,
          maxPriorityFeePerGas:
            fees!.maxPriorityFeePerGas ?? fees!.maxFeePerGas! / 10n,
          type: "eip1559",
        },
        sig,
      )
    : serializeTransaction(
        {
          chainId: pulsechain.id,
          nonce,
          to: args.to,
          value,
          data,
          gas,
          gasPrice: legacyGasPrice,
          type: "legacy",
        },
        sig,
      );

  return client.sendRawTransaction({ serializedTransaction: serialized });
}
