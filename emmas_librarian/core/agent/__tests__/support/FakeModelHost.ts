import type { FetchLike } from '../../runtime/modelDownload';

export interface HostRequest {
  url: string;
  range: string | undefined;
}

/**
 * Serves one file as a model host would, honouring `Range` requests, and remembers what was asked. `ignoreRange` makes it
 * answer 200 with the whole file anyway (a host without range support); `status` makes it fail; `rejectRanges` makes it answer 416 to any Range request, as a host does when the offset is not one it can serve.
 */
export class FakeModelHost {
  readonly requests: HostRequest[] = [];

  constructor(
    private readonly content: Buffer,
    private readonly options: { ignoreRange?: boolean; status?: number; rejectRanges?: boolean } = {},
  ) {}

  readonly fetch: FetchLike = async (url, init) => {
    const range = init.headers.range;
    this.requests.push({ url, range });
    if (this.options.status) return new Response('nope', { status: this.options.status });
    if (range && this.options.rejectRanges) return new Response('', { status: 416 });
    const from = range && !this.options.ignoreRange ? Number(/bytes=(\d+)-/.exec(range)?.[1] ?? 0) : 0;
    const status = from > 0 ? 206 : 200;
    return new Response(this.content.subarray(from), { status });
  };
}
