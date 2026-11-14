// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseArxivFeed } from '../atomFeed';

// A real arXiv API answer (2026-09-28) for ti:"machine learning" ANDNOT au:smith, two entries.
const REAL_FEED = fs.readFileSync(path.join(__dirname, 'fixtures', 'arxiv_feed.xml'), 'utf8');

const feedWith = (entry: string) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom"
      xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <opensearch:totalResults>1</opensearch:totalResults>
  ${entry}
</feed>`;

describe('parseArxivFeed', () => {
  it('reads the total and each entry of a real arXiv answer', () => {
    const { total, entries } = parseArxivFeed(REAL_FEED);

    expect(total).toBe(19732);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: 'http://arxiv.org/abs/2609.32552v1',
      title: 'Uncovering flame physics with machine learning: application to the reaction rate in hydrogen flames',
      published: '2026-09-26T12:30:25Z',
      pdfUrl: 'https://arxiv.org/pdf/2609.32552v1',
      primaryCategory: 'physics.flu-dyn',
    });
    expect(entries[0].authors.slice(0, 2)).toEqual([
      { name: 'Antonio Attili', affiliation: undefined },
      { name: 'Ludovico Nista', affiliation: undefined },
    ]);
    expect(entries[0].summary.startsWith('Convolutional Neural Networks (CNNs) are used')).toBe(true);
  });

  it('reads the journal DOI, reference and affiliations when the entry has them, and joins broken lines', () => {
    const { entries } = parseArxivFeed(
      feedWith(`<entry>
        <id>http://arxiv.org/abs/hep-th/9901001v2</id>
        <title>A title broken
          over two lines</title>
        <summary>Text.</summary>
        <published>1999-01-01T00:00:00Z</published>
        <author><name>Ana Lima</name><arxiv:affiliation>USP</arxiv:affiliation></author>
        <arxiv:doi>10.1103/PhysRevD.1.1</arxiv:doi>
        <arxiv:journal_ref>Phys. Rev. D 1 (1999) 1</arxiv:journal_ref>
      </entry>`),
    );

    expect(entries[0]).toMatchObject({
      title: 'A title broken over two lines',
      doi: '10.1103/PhysRevD.1.1',
      journalRef: 'Phys. Rev. D 1 (1999) 1',
      authors: [{ name: 'Ana Lima', affiliation: 'USP' }],
    });
  });

  it('returns no entries for a feed without results', () => {
    expect(parseArxivFeed(feedWith(''))).toEqual({ total: 1, entries: [] });
  });
});
