import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CompactGp, Conjunction, GpGroup } from "@/types";

/** Shape of public/data/sample-gp.json (written by scripts/fetch-sample-data.ts). */
export interface SampleFile {
  generatedAt: string;
  groups: Partial<Record<GpGroup, CompactGp[]>>;
  conjunctions: Conjunction[];
}

let memo: Promise<SampleFile> | null = null;

/** Server-side loader: reads the bundled dataset from disk. */
export function loadSample(): Promise<SampleFile> {
  memo ??= readFile(path.join(process.cwd(), "public", "data", "sample-gp.json"), "utf8").then(
    (text) => JSON.parse(text) as SampleFile,
  );
  return memo;
}

export async function sampleGpFor(group: GpGroup): Promise<CompactGp[]> {
  const sample = await loadSample();
  return sample.groups[group] ?? [];
}
