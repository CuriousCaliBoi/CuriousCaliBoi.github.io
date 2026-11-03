CODEX TRAJECTORIES: EXPERIMENTS 1–6

Open index.html, then choose an original or fresh conversation. Each conversation also has a complete plain-text transcript. The raw folder contains the copied source logs and exact prompt files; manifest.json gives their source paths and SHA-256 hashes.

Scope: 21 original and 21 fresh conversations. Every saved main turn is included. Prompts, assistant replies, CLI-emitted reasoning summaries, execution records, returned feedback, errors and metadata are retained without shortening. Original Go budget-50 failed resume attempts are preserved as fail* files and linked from turn 63. The readable view uses successful-turn events; the failure records remain in raw.

TOOLS WERE DISABLED
All built-in experimental Codex tools were disabled: no shell, web, editor or sub-agent calls. The event audit separately checks the reported tool-free flag and every recorded item type. All 244 fresh turns have zero built-in tool calls.
Experiments 1, 2, 4 and 5: no experiment-time execution.
Experiment 3: an external harness executes weight-analysis Python written in the response; no model forward passes. Fresh total: 50 Python executions.
Experiment 6: an external harness executes hand-written policy construction/analysis and the budgeted games/positions requests. Fresh total: 88 Python executions, 81 games calls and 4 positions calls (85 feedback passes).
The archive does not imply that Experiments 3 and 6 were computation-free. These harness capabilities were part of the original protocol.

Provenance and limits
Original revision: 4d09ba6d6a7e891dd8063974dfe81b3d78e3494f, https://github.com/RikiyaT/lm_understand-logs . Original licenses are under protocol/original.
Fresh runs are the frozen runs used for the reported results. Earlier contaminated attempts are excluded. Experiment 6 includes the exact disclosed prompt changes for substitute opponents. This packaging does not run a model or regenerate a response.
Reasoning entries are the summaries exposed by the CLI; unrecorded internal reasoning is not available. The neutral instruction file and recorded command options are included; this is not a claim that every historical backend instruction is available.
The plain-text transcripts include all prompt text, including weight dumps. HTML collapses long prompts for readability without removing their content. Raw copies retain exact bytes; text viewers decode them as UTF-8.
Bulk Go scratch arrays, intermediate weights and environment-state dumps are excluded from this conversation package. The complete printed outputs and returned feedback ARE included, along with the retained artifact manifests pointing to those larger files. Original run-folder files are copied in full. This is a transcript archive, not an execution environment or checkpoint bundle.
Original tool ledger entries are matched to replies by exact code/request content in chronological order. Fresh Go bridge records are already stored per turn. All available fresh feedback files are checked against the next prompt.
