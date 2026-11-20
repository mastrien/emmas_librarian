import type { FetchLike } from '../../runtime/modelDownload';

export interface HostRequest {
  url: string;
  range: string | undefined;
}

/**
 * Serves one file as a model host would, honouring `Range` requests, and remembers what was asked. `ignoreRange` makes it
 * answer 200 with the whole file anyway (a host without range support); `status` makes it fail.
 */
export class FakeModelHost {
  readonly requests: HostRequest[] = [];

  constructor(
    private readonly content: Buffer,
    private readonly options: { ignoreRange?: boolean; status?: number } = {},
  ) {}

  readonly fetch: FetchLike = async (url, init) => {
    const range = init.headers.range;
    this.requests.push({ url, range });
    if (this.options.status) return new Response('nope', { status: this.options.status });
    const from = range && !this.options.ignoreRange ? Number(/bytes=(\d+)-/.exec(range)?.[1] ?? 0) : 0;
    const status = from > 0 ? 206 : 200;
    return new Response(this.content.subarray(from), { status });
  };
}
