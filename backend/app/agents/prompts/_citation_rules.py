# ABOUTME: Shared citation and findings_text rules for all domain agent prompts.
# ABOUTME: Eliminates duplication of ~30 lines of identical rules across 4 domain agents.

CITATION_AND_FINDINGS_TEXT_RULES = """\
## CITATION AND FINDINGS TEXT REQUIREMENTS

### Exhaustive Citation Rules
Every factual statement in your findings MUST have a citation. No exceptions.

For EACH citation, ALL THREE fields are REQUIRED:
- `file_id` (REQUIRED): The exact file ID provided in the input. Never omit.
- `locator` (REQUIRED): Use the format:
  - PDF/documents: "page:N" (e.g., "page:3", "page:17")
  - Video: "ts:MM:SS" (e.g., "ts:01:23", "ts:00:45:12")
  - Audio: "ts:MM:SS" (e.g., "ts:05:30")
  - Images: "region:description" (e.g., "region:top-left-corner")
- `excerpt` (REQUIRED): The EXACT text from the source, character-for-character.
  The excerpt is used for PDF text-layer highlighting — if it is missing or
  paraphrased, the user CANNOT verify the source in the document viewer.
  Copy the source text EXACTLY as it appears, preserving:
  - Original spelling (even if incorrect)
  - Original punctuation and whitespace
  - Original line breaks within the excerpt
  - Original formatting (capitalization, abbreviations)

### Citation Anti-Patterns (DO NOT)
- DO NOT leave excerpt empty or null — every citation MUST have an excerpt.
- DO NOT paraphrase or summarize the source text. Copy it verbatim.
- DO NOT combine non-contiguous text fragments into a single excerpt.
- DO NOT use ellipsis ("...") to abbreviate the middle of an excerpt.
  If the relevant text is too long, select the most important contiguous
  fragment (up to 500 characters).
- DO NOT hallucinate or reconstruct text that you cannot read from the source.
  If a passage is illegible, note that in the finding description instead.

### Citation Quality Checklist
Before finalizing each citation, verify:
1. file_id matches the exact ID from the input (not a filename or URL).
2. locator pinpoints the specific page or timestamp (not a range).
3. excerpt is a verbatim copy-paste from the source (not a paraphrase).
4. excerpt is under 500 characters and is a single contiguous passage.
5. excerpt would produce a match if searched in the original document.

{domain_specific_citation_notes}\
If a finding spans multiple pages or time segments, create SEPARATE citations
for each page/segment. Do not combine into ranges.

### findings_text Field
In addition to the structured `findings` array, produce a `findings_text` field
containing a rich markdown narrative analysis. This text:
- Organizes analysis by category (use ## headers for each category)
- Contains detailed paragraphs explaining each finding in context
- References specific evidence using inline notation: [Source: file_id, page:N, "exact excerpt"]
- Connects findings to broader case implications
- Must be comprehensive -- this is the primary text used for search indexing
  and downstream synthesis
- Minimum 500 words for cases with substantive findings
- Every factual claim in the narrative must reference its source

{findings_text_example}"""
