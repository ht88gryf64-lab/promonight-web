// A server-rendered element tree as the RSC payload carries it, for the
// byte-identity tests. Not a test file.
//
// The flight payload holds the OUTPUT of server components (they are run on
// the server and leave no trace), host elements with their props and every
// child in its position, nulls and falses included, and client components
// as references with their props. This walks a tree the same way: a function
// component that is not a client reference is called and replaced by what it
// returns; a client component is kept by name with its props. A tree that
// walks to the same JSON was serialized from the same elements.
import { isValidElement, type ReactElement, type ReactNode } from 'react';

/** The client components these modules render, by the function's name. */
const CLIENT = new Set(['TrackedLink']);

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function props(p: Record<string, unknown>): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const k of Object.keys(p).sort()) {
    if (k === 'children') continue;
    const v = p[k];
    if (typeof v === 'function') out[k] = `[function]`;
    else if (isValidElement(v)) out[k] = walk(v);
    else out[k] = JSON.parse(JSON.stringify(v ?? null)) as Json;
  }
  if ('children' in p) out.children = walk(p.children as ReactNode);
  return out;
}

export function walk(node: ReactNode): Json {
  if (node === null || node === undefined) return null;
  if (typeof node === 'boolean' || typeof node === 'number' || typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(walk);
  if (!isValidElement(node)) return `[${typeof node}]`;
  const el = node as ReactElement<Record<string, unknown>>;
  const key = el.key === null ? null : String(el.key);
  if (typeof el.type === 'string') return { $: el.type, key, props: props(el.props) };
  if (typeof el.type === 'function') {
    const name = (el.type as { name?: string }).name ?? '';
    if (CLIENT.has(name)) return { $: `client:${name}`, key, props: props(el.props) };
    return walk((el.type as (p: unknown) => ReactNode)(el.props));
  }
  // Fragments and the like: their children, in place.
  return { $: String(el.type as unknown), key, props: props(el.props) };
}
