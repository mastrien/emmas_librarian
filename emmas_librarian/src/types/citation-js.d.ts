declare module 'citation-js' {
  const Cite: { plugins: { add: (a: string, b: unknown) => void; config: { get: (a: string) => unknown } }; new (data?: unknown): { format: (fmt: string, opts?: unknown) => string } };
  export = Cite;
}
