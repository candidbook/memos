import { Transaction } from './appTypes';

export type EdgeKind = 'spatial' | 'temporal' | 'periodic' | 'verbal';

export interface IndexedEdge {
  source: string;
  target: string;
  weight: number;
  height: number;
  time: number;
  kind: EdgeKind;
}

export interface IndexedNodeState {
  memo?: string;
  time?: number;
}

export interface IndexedDirectoryGraph {
  edges: IndexedEdge[];
  keyState: Record<string, IndexedNodeState>;
}

const BASE64_PUBKEY_LENGTH = 44;

export const pad44 = (input: string) => {
  if (input.length >= BASE64_PUBKEY_LENGTH) {
    return input;
  }

  let normalized = input;
  if (normalized !== '0' && !normalized.includes('/')) {
    normalized = `${normalized}/`;
  }

  const padLength = BASE64_PUBKEY_LENGTH - normalized.length - 1;
  return `${normalized}${'0'.repeat(Math.max(0, padLength))}=`;
};

interface InflateNodeResult {
  ok: boolean;
  rootDir: string;
  paths: string[];
  nodes: string[];
  revision: number;
  isSpatial: boolean;
}

export const inflateNodes = (pubkey: string): InflateNodeResult => {
  const minimallyTrimmed = pubkey.replace(/^[/+0=]+|[/+0=]+$/g, '');
  const minimallySplit = minimallyTrimmed.split('/');

  if (!minimallySplit.length || !minimallySplit[0]) {
    return {
      ok: false,
      rootDir: '',
      paths: [],
      nodes: [],
      revision: 0,
      isSpatial: false,
    };
  }

  if (minimallySplit.some((segment) => segment === '')) {
    return {
      ok: false,
      rootDir: '',
      paths: [],
      nodes: [pubkey],
      revision: 0,
      isSpatial: false,
    };
  }

  const trimmed = pubkey.replace(/[0=]+$/g, '');
  const initialNodes = trimmed.split('/');

  let nodes = [...initialNodes];
  let revision = 0;

  const last = nodes.at(-1) ?? '';
  if (last && last.replace(/\+/g, '') === '') {
    revision = last.length;
    nodes = nodes.slice(0, -1);
  }

  const paths: string[] = [];

  for (let i = 0; i < nodes.length; i += 1) {
    let node = nodes[i];

    const next = nodes[i + 1];
    if (next && next.startsWith('+')) {
      const marker = next.split(next.replace(/\+/g, ''))[0] ?? '';
      node = `${node}/${marker}`;
    }

    nodes[i] = node;
    paths.push(`${nodes.slice(0, i + 1).join('/')}/`);
  }

  return {
    ok: true,
    rootDir: initialNodes[0] ?? '',
    paths,
    nodes,
    revision,
    isSpatial: pubkey.startsWith('/'),
  };
};

export const diminishingOrders = (n: number) => {
  if (n === 0) {
    return [0];
  }

  const digits = Math.floor(Math.log10(n)) + 1;
  const results = [n];

  for (let i = 0; i < digits; i += 1) {
    const power = 10 ** (i + 1);
    const rounded = n - (n % power);
    if (rounded !== results[results.length - 1]) {
      results.push(rounded);
    }
  }

  return results;
};

export const indexDirectoryTransactions = (transactions: Transaction[]): IndexedDirectoryGraph => {
  const edgeMap = new Map<string, IndexedEdge>();
  const keyState: Record<string, IndexedNodeState> = {};

  const link = (
    source: string,
    target: string,
    weight: number,
    height: number,
    time: number,
    kind: EdgeKind,
  ) => {
    const paddedSource = pad44(source);
    const paddedTarget = pad44(target);
    const mapKey = `${paddedSource}->${paddedTarget}->${kind}`;

    const existing = edgeMap.get(mapKey);
    if (!existing) {
      edgeMap.set(mapKey, {
        source: paddedSource,
        target: paddedTarget,
        weight,
        height,
        time,
        kind,
      });
      return;
    }

    existing.weight += weight;
    existing.height = height;
    existing.time = Math.max(existing.time, time);
  };

  transactions.forEach((transaction) => {
    const txnTo = transaction.to;
    const txnMemo = transaction.memo?.trim() ?? '';
    const txnTime = transaction.time ?? 0;
    const height = transaction.series ?? 0;
    const amount = Math.max(1, Number(transaction.amount) || 0);

    if (!txnTo) {
      return;
    }

    const inflated = inflateNodes(txnTo);

    if (!inflated.ok) {
      return;
    }

    const paddedTxnTo = pad44(txnTo);
    keyState[paddedTxnTo] = {
      memo: txnMemo,
      time: txnTime,
    };

    const dimensionWeight = amount / 3;

    inflated.paths.forEach((path, i) => {
      const additive = 10 + i;

      if (i === 0) {
        link('0', path, dimensionWeight, height, txnTime + additive, inflated.isSpatial ? 'spatial' : 'verbal');
      }

      const next = inflated.paths[i + 1];
      if (next) {
        link(path, next, dimensionWeight, height, txnTime + additive + i + 1, inflated.isSpatial ? 'spatial' : 'verbal');
      }

      if (i === inflated.paths.length - 1) {
        link(path, txnTo, dimensionWeight, height, txnTime + additive + i + 1, inflated.isSpatial ? 'spatial' : 'verbal');
      }
    });

    const timestamp = new Date(txnTime * 1000);
    const year = `${timestamp.getUTCFullYear()}`;
    const month = `${year}+${`${timestamp.getUTCMonth() + 1}`.padStart(2, '0')}`;
    const day = `${month}+${`${timestamp.getUTCDate()}`.padStart(2, '0')}`;

    link('0', year, dimensionWeight, height, txnTime + 20, 'temporal');
    link(year, month, dimensionWeight, height, txnTime + 21, 'temporal');
    link(month, day, dimensionWeight, height, txnTime + 22, 'temporal');
    link(day, txnTo, dimensionWeight, height, txnTime + 23, 'temporal');

    const orders = diminishingOrders(Math.max(0, height));
    for (let j = 1; j < orders.length; j += 1) {
      const source = `${orders[j - 1]}`;
      const target = `${orders[j]}`;
      link(source, target, dimensionWeight, height, txnTime + 30 + j, 'periodic');
    }

    link(txnTo, `${height}`, dimensionWeight, height, txnTime + 30 + orders.length, 'periodic');
  });

  return {
    edges: [...edgeMap.values()],
    keyState,
  };
};
