# Built-in step tools

Each file here is one built-in worksheet (StepTool). A member starts one as their own copy
(StepWork keeps the whole definition), so changing a file here never changes work already
started. The section kinds and their settings are described in app/models/step_tool.rb.

The wording is our own. Where a tool follows a book's approach (Drop the Rock) it credits the
book; we don't copy text from books still under copyright (the 12&12 versions ask questions
that point back to the chapters instead).

Since November 2026 these are copied into the database once (the CreateStepTemplates
migration) and changed in Site Admin > Step worksheets, with draft, publish and history. After
that, editing a file here changes nothing on the site: the files are only read while there are
no templates (tests, a fresh development database), and Site Admin can import one as a new
worksheet.

A worksheet added here later needs its own migration to copy it in (AddAlternateStep67Worksheets
is the pattern: it skips keys already there, and does nothing while the table is empty).
