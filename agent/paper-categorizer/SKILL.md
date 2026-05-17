---
name: paper-categorizer
description: Categorizes PDF research papers by extracting specific metadata (audience, technique, implementation status, etc.) and appending it to categorizing_papers.md. Use when summarizing or classifying new papers.
---

# Paper Categorizer

This skill automates the extraction of key metadata from research papers (PDFs) and appends a standardized summary to the project's tracking file.

## Usage Workflow

When asked to categorize a paper, follow these exact steps:

1. **Locate the Paper:** Find the specified PDF paper in the workspace.
2. **Read the Content:** Use `read_file` to extract the content. Read the first 1000 lines to find abstract, intro, and methodology.
3. **Extract Metadata:** Analyze the text for:
   - **Target audience**: (e.g., elementary school, higher education, etc.)
   - **What is recommended**: (e.g., books, learning paths, etc.)
   - **Recommendation technique**: (e.g., collaborative filtering, deep learning, etc.)
   - **Input data**: (e.g., grade history, platform clicks, etc.)
   - **Type of assessment**: (e.g., offline datasets, case study, A/B testing)
   - **Implementation Status**: (Determine if it's "Purely Theoretical" or "Implemented/Experimental" with a brief explanation of where it was tested).
   - **Main limitations/challenges**: (e.g., cold start, lack of data, etc.)
   - **Year of publication**: 4-digit year.
   - **Database/conference**: (e.g., IEEE, ACM, Springer, etc.)
4. **Append to Tracking File:** Find `categorizing_papers.md`.
5. **Format the Entry:** Use the template below. The title must be a relative link to the PDF.
6. **Save Changes:** Append the new entry to the end of `categorizing_papers.md`.

## Output Template

```markdown
---

# [Insert exact paper title here](./papers/insert_filename_here.pdf)

### Target audience (elementary school, high school, higher education, corporate training, etc.)

[Extracted info]

### What is recommended (books, articles, exercises, peers, learning paths)

[Extracted info]

### Recommendation technique (collaborative filtering, content-based, knowledge-based, hybrid, deep learning/AI)

[Extracted info]

### Input data (grade history, platform clicks, profile questionnaires, forum interactions, etc.)

[Extracted info]

### Type of assessment (offline with historical datasets, case study with real users, A/B testing)

[Extracted info]

### Implementation Status (Theoretical vs. Implemented)

[e.g., Implemented - Tested with 400 real students in a live platform]

### Main limitations/challenges (cold start problem, lack of data, algorithmic bias, etc.)

[Extracted info]

### Year of publication

[Extracted 4-digit year]

### Database/conference (IEEE, ACM, Springer, Scopus, WoS)

[Extracted info]

---
```
