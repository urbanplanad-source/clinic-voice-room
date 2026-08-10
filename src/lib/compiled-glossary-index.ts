import type { ClinicGlossaryData, VerifiedSentenceEntry } from "./clinic-glossary";
import { normalizeForGlossaryMatch } from "./glossary-normalization";

type TrieNode = {
  children: Map<string, TrieNode>;
  terminalEntryIds: Set<string>;
};

export type CompiledGlossaryIndex = {
  verifiedByNormalizedInput: Map<string, VerifiedSentenceEntry>;
  termTrie: TrieNode;
  termCandidateCount: number;
  verifiedCandidateCount: number;
};

const compiledIndexes = new WeakMap<ClinicGlossaryData, CompiledGlossaryIndex>();

function newTrieNode(): TrieNode {
  return { children: new Map(), terminalEntryIds: new Set() };
}

function addToTrie(root: TrieNode, value: string, entryId: string) {
  let node = root;
  for (const character of value) {
    let child = node.children.get(character);
    if (!child) {
      child = newTrieNode();
      node.children.set(character, child);
    }
    node = child;
  }
  node.terminalEntryIds.add(entryId);
}

export function compileGlossaryIndex(glossaryData: ClinicGlossaryData) {
  const existing = compiledIndexes.get(glossaryData);
  if (existing) return existing;

  const verifiedByNormalizedInput = new Map<string, VerifiedSentenceEntry>();
  let verifiedCandidateCount = 0;
  for (const entry of glossaryData.verifiedSentences) {
    for (const candidate of [entry.standardKo, ...entry.spoken]) {
      const normalized = normalizeForGlossaryMatch(candidate);
      if (!normalized || verifiedByNormalizedInput.has(normalized)) continue;
      verifiedByNormalizedInput.set(normalized, entry);
      verifiedCandidateCount += 1;
    }
  }

  const termTrie = newTrieNode();
  const termCandidates = new Set<string>();
  const termEntryIds = new Map<string, Set<string>>();
  glossaryData.terms.forEach((entry, entryIndex) => {
    const entryId = entry.entryId ?? `term:${entryIndex}`;
    for (const candidate of [entry.standardKo, ...entry.spoken]) {
      const normalized = normalizeForGlossaryMatch(candidate);
      if (!normalized) continue;
      termCandidates.add(normalized);
      const ids = termEntryIds.get(normalized) ?? new Set<string>();
      ids.add(entryId);
      termEntryIds.set(normalized, ids);
    }
  });
  for (const candidate of termCandidates) {
    for (const entryId of termEntryIds.get(candidate) ?? []) addToTrie(termTrie, candidate, entryId);
  }

  const compiled = {
    verifiedByNormalizedInput,
    termTrie,
    termCandidateCount: termCandidates.size,
    verifiedCandidateCount
  };
  compiledIndexes.set(glossaryData, compiled);
  return compiled;
}

export function compiledGlossaryHasTerm(text: string, glossaryData: ClinicGlossaryData) {
  const normalized = normalizeForGlossaryMatch(text);
  if (!normalized) return false;
  const { termTrie } = compileGlossaryIndex(glossaryData);
  for (let start = 0; start < normalized.length; start += 1) {
    let node: TrieNode | undefined = termTrie;
    for (let index = start; index < normalized.length && node; index += 1) {
      node = node.children.get(normalized[index]);
      if (node && node.terminalEntryIds.size > 0) return true;
    }
  }
  return false;
}

export function matchedGlossaryEntryIds(text: string, glossaryData: ClinicGlossaryData) {
  const normalized = normalizeForGlossaryMatch(text);
  if (!normalized) return [];
  const compiled = compileGlossaryIndex(glossaryData);
  const matched = new Set<string>();
  const verified = compiled.verifiedByNormalizedInput.get(normalized);
  if (verified) matched.add(verified.entryId ?? `verified:${glossaryData.verifiedSentences.indexOf(verified)}`);

  for (let start = 0; start < normalized.length; start += 1) {
    let node: TrieNode | undefined = compiled.termTrie;
    for (let index = start; index < normalized.length && node; index += 1) {
      node = node.children.get(normalized[index]);
      if (node) for (const entryId of node.terminalEntryIds) matched.add(entryId);
    }
  }
  return [...matched].sort();
}
