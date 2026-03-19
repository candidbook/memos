export interface Profile {
  public_key: string;
  ranking: number;
  imbalance: number;
  locale?: string;
  label?: string;
  bio?: string;
  block_id?: string;
  height?: number;
  error?: string;
}

export interface GraphNode {
  id: number;
  group?: number;
  neighbors?: GraphNode[];
  links?: GraphLink[];
  pubkey: string;
  label: string;
  memo?: string;
  locale?: string;
  ranking: number;
  imbalance: number;
}

export interface GraphLink {
  source: number;
  target: number;
  value: number;
  height: number;
  time: number;
  memo?: string;
}

export interface BlockHeader {
  previous: string;
  hash_list_root: string;
  time: number;
  target: string;
  point_work: string;
  nonce: number;
  height: number;
  transaction_count: number;
}

export interface BlockIdHeaderPair {
  block_id: string;
  header: BlockHeader;
}

export interface Block {
  header: BlockHeader;
  transactions: Transaction[];
}

export interface Transaction {
  time: number;
  nonce?: number;
  from?: string;
  to: string;
  amount: number;
  fee: number;
  memo: string;
  series?: number;
  signature?: string;
}
