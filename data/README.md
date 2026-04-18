# Data Layout

This folder is the local working area for the Exam Coach backend.

## Subfolders

- `parsed/raw/`
  - cached raw LlamaParse outputs for supported source PDFs
- `parsed/normalized/`
  - normalized structured documents derived from raw parser output
- `runs/`
  - generated blueprints, question sets, and performance reports
- `ingestion/`
  - generated JSON snapshots of the latest ingestion run, including which topics were actually ingested

## Notes

- These files are local working artifacts and should not be committed.
- The canonical topic/file selection lives in [`exam_coach/config/topics.json`](../exam_coach/config/topics.json).
- The parsed document shape is defined in [`exam_coach/config/parsed_document.schema.json`](../exam_coach/config/parsed_document.schema.json).
