import { bridge, openExternalUrl } from "@/helpers/bridge";

export function buildTripShareUrl(
  tripId: string,
  origin = globalThis.location?.origin ?? "http://localhost",
): string {
  const url = new URL(`/`, origin);
  url.hash = `/trips/${encodeURIComponent(tripId)}`;
  return url.toString();
}

export async function shareTrip(tripId: string): Promise<"shared" | "opened"> {
  const link = buildTripShareUrl(tripId);
  try {
    await bridge.send("VKWebAppShare", { link });
    return "shared";
  } catch {
    await openExternalUrl(link);
    return "opened";
  }
}
