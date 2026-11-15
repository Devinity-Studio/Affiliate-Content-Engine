# Owner direction — content identity, file identity, and Library role
source: ACE Mission 1 discussion, 1 November 2026
companion reads:
- docs/mission1/8.8.11-content-management-decision-history-reconciliation.md
- docs/mission1/8.8.12-content-identity-lifecycle-policy-proposal.md

## What I was told, in my own words

The current model is too file-name-centric. Users should not have to reason about the
internal exported filename, and they should not have to remember which file on disk
belongs to which idea. They should be able to identify a file by what it is, and reach it
from the Library.

The proposed direction is better separation between:
- what the system stores as a file,
- what the Library shows as a human-readable entry,
- what the user actually wants to do with the file.

## Owner-approved direction (not yet a Requirement)

1. Separate real filename from the name the user sees.
   - The system may keep stable, internal, non-repeating file identities for exports
     instead of deriving the export filename purely from `content_id + script_version`.
   - Example mental model:
     ```
     EXP-000124.mp4
     EXP-000125.mp4
     EXP-000126.mp4
     ```
     but in the Library the user sees something like:
     - วิดีโอแนะนำผลิตภัณฑ์ A
     - วิดีโอแนะนำผลิตภัณฑ์ A (แก้ไขคำบรรยาย)
     - วิดีโอแนะนำผลิตภัณฑ์ A (แนวตั้งสำหรับอีกช่องทาง)
   - The real filename is internal system detail. The displayed name is what humans use
     to understand and find the item.

2. Library should be a management center, not just a list of filenames.
   - A user reaches an export by content / product / file type and by the displayed name,
     not by memorizing a filename or folder path.
   - Each Library entry should carry the work-relevant facts the user cares about, such as:
     - what the file is,
     - export id,
     - file type,
     - when it was created,
     - which Content it came from,
     - which script version it used,
     - where the real file lives,
     - the file hash,
     - which destinations/uses it has been sent to.

3. Use two consumption patterns, both acceptable.
   - Path A: send from the Library directly to a supported destination/channel.
     The system reads the file from storage, sends it over an authorized connection, and
     records the result and destination.
     Pros: no download-and-re-upload loop. Needs a connected destination and the right
     permissions.
   - Path B: open the real file location from the Library, for example Browse/Reveal File
     or open via the machine’s file manager.
     Pros: the user can still take the file into other tools without hunting through nested
     folders.
     Caution: revealing the file location does not mean the user should edit the stored
     file directly. Direct edits can break the alignment between Library and the real file.

4. Separate the identity of Content from the identity of Export.
   - One Content Project can have many Exports.
   - Each Export has its own identity and its own file.
   - Possible example structure:
     - Content Project — CNT-001
       - the source that is edited and used to produce work
     - Exports:
       - EXP-000124 — MP4 v1
       - EXP-000125 — MP4 v2
       - EXP-000126 — cover image
       - EXP-000127 — another format
   - Under this model, re-exporting does not have to overwrite the old file, because each
     export can be given a distinct identity.
   - The system can keep separate facts per Export, including:
     - which Content it came from,
     - which script version it used,
     - when it was created,
     - where the real file is,
     - the file hash,
     - which destinations it has been sent to.

   This is described as a way to build a Reviewable Export History without turning the
   Content Project into multiple files.

## Important caveats the user explicitly emphasized

- Giving exports stable, non-colliding file names reduces overwrite risk, but that alone is
  NOT a complete data-loss prevention mechanism.
- An export should not be declared ready for use until we have verified:
  - the file was written successfully,
  - the hash was checked successfully,
  - the Library record was saved successfully.

## How the user wants this treated now

- Proposed direction: System-managed File Identity + Library-centered File Management.
- This is a design direction to study further.
- This is NOT yet a Requirement.
- This is NOT yet approval to change the system.

## Recommended reframing of Library

From: “place that lists Export files.”
Toward: “central point for discovering, accessing, and managing system-produced work
files.”

## Status note for Mission 1 documents

- This file stores the user’s stated direction and conditions.
- It is Owner direction only.
- Do not promote it automatically into Requirement or Authorization.
- If a later Mission 1 document should reflect this emphasis, reconcile it explicitly and
  preserve the existing distinction between current implementation, documented design,
  Owner Intent, team/agent proposals, and unresolved questions.
