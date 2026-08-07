import ms from "ms";

type MsInput = Parameters<typeof ms>[0];

export function durationToMs(value: string): number {
  return ms(value as MsInput);
}

export function expiryDateFromNow(durationStr: string): Date {
  return new Date(Date.now() + durationToMs(durationStr));
}
