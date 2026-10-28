# Roster format: `transit-roster/1`

How the school hands Transit Portfolio its class lists. A pilot admin imports the file from
**Accounts › Import class lists**; everyone with an email then gets a sign-in account and a one-time
setup link (downloaded as a CSV).

Either **one JSON file**, or **four CSV files** (`teachers.csv`, `students.csv`, `classes.csv`,
`enrolments.csv`) with the same column names. In CSVs, a list cell (`roles`, `teacherIds`) is split by `;`.
Column names are matched without case. Files are UTF-8; Thai text is fine.

## Rules

- **Names are already altered** by the school before export.
- **Ids are stable** across exports (the SIS ids). They become the record ids, so a later file updates the
  same people.
- **Every referenced id must exist** in the same file: a student's `advisorId`, a class's `teacherIds`, an
  enrolment's `studentId` and `classId`. If one is missing, nothing is imported and the missing ids are listed.
- **Re-importing updates, never duplicates.** Only the fields below are updated; a student's map, lines,
  reflections and presentations are never touched.
- **Nobody is removed.** People and classes in the record but not in a new file are listed for the admin.
  A class place (enrolment) missing from a new file, for a student who is in it, ends: its `to` is set to
  the export date and it stays as history.
- Any other problem (a missing required field, a Year outside 7 to 13, an unknown role or line, the same
  id or email twice) also stops the import, with the file and row named.

## Fields

`school` (JSON only; a missing field is a warning, not a stop)

| field | required | notes |
|---|---|---|
| `name` | yes | |
| `academicYear` | yes | `2026-27`. Used to place each student's map in time. |
| `exportedAt` | yes | ISO date or time. Ended class places get this date. |
| `source` | no | Where the file came from, e.g. the SIS report name. |

`teachers` (all staff, not only teachers)

| field | required | notes |
|---|---|---|
| `id` | yes | SIS staff id |
| `name` | yes | As it should appear, e.g. `Ms Ada Brook` |
| `email` | no | School email. Without one, no sign-in account is made. |
| `roles` | yes | Any of `teacher`, `advisor`, `counsellor`, `coordinator`, `leadership`. The account's role is the most senior: leadership > coordinator > counsellor > advisor > teacher. |
| `department` | no | e.g. `Biology`. Shown under their name with their advisory, e.g. "Biology · Advisor, 12B". |

`students`

| field | required | notes |
|---|---|---|
| `id` | yes | SIS student id |
| `name` | yes | |
| `year` | yes | British Year, 7 to 13 (`12`, `Year 12` and `Y12` all work) |
| `programme` | yes | `IB MYP`, `IB Diploma`, `IB Career-related` (`MYP`, `DP`, `CP` are read too); anything else is kept as written |
| `homeroom` | yes | e.g. `12B` |
| `advisorId` | yes | A teacher `id` (who should have the `advisor` role) |
| `joinedYear` | no | Calendar year they joined NIST, e.g. `2021`. Their map starts in that Year (not before Year 7); without it, in their current Year. |
| `email` | no | School email. Without one, no sign-in account is made. |
| `house` | no | |

`classes`

| field | required | notes |
|---|---|---|
| `id` | yes | SIS class id |
| `name` | yes | e.g. `12 Biology HL` |
| `subject` | yes | e.g. `Biology` |
| `year` | yes | British Year, 7 to 13 |
| `level` | no | `HL`, `SL`, … |
| `teacherIds` | yes | Teacher ids; may be empty (a warning) |
| `line` | no | The map line: `science`, `computing`, `environment`, `sport`, `service`, `music`, `design`, `languages`, `art`. Without it the line is guessed from the subject (Biology, Chemistry, Physics → science; Computer Science → computing; ESS, Geography → environment; PE → sport; Music; Design; English, French, Spanish, Thai, Chinese and other languages → languages; Visual Arts, Theatre, Film → art). Classes that match no line (e.g. Mathematics) are listed and have none. |

`enrolments` (one row per student per class)

| field | required | notes |
|---|---|---|
| `studentId` | yes | |
| `classId` | yes | |
| `from` | no | Date they joined the class |
| `to` | no | Date they left it |

## Example (JSON)

```json
{
  "format": "transit-roster/1",
  "school": { "name": "NIST International School", "academicYear": "2026-27", "exportedAt": "2026-10-20T08:00:00Z", "source": "SIS class lists" },
  "teachers": [
    { "id": "T100", "name": "Ms Ada Brook", "email": "ada.brook@nist.ac.th", "roles": ["teacher", "advisor"], "department": "Biology" },
    { "id": "T102", "name": "Ms Chloe Dumas", "email": "chloe.dumas@nist.ac.th", "roles": ["counsellor"] }
  ],
  "students": [
    { "id": "S2001", "name": "Fern Gale", "year": 12, "programme": "IB Diploma", "homeroom": "12B", "advisorId": "T100", "joinedYear": 2021, "email": "fern.gale@nist.ac.th", "house": "Teak" }
  ],
  "classes": [
    { "id": "C-BIO12", "name": "12 Biology HL", "subject": "Biology", "year": 12, "level": "HL", "teacherIds": ["T100"] }
  ],
  "enrolments": [
    { "studentId": "S2001", "classId": "C-BIO12", "from": "2026-08-12" }
  ]
}
```

## Example (CSV)

`teachers.csv`

```
id,name,email,roles,department
T100,Ms Ada Brook,ada.brook@nist.ac.th,teacher;advisor,Biology
T102,Ms Chloe Dumas,chloe.dumas@nist.ac.th,counsellor,
```

`students.csv`

```
id,name,year,programme,homeroom,advisorId,joinedYear,email,house
S2001,Fern Gale,12,IB Diploma,12B,T100,2021,fern.gale@nist.ac.th,Teak
```

`classes.csv`

```
id,name,subject,year,level,teacherIds,line
C-BIO12,12 Biology HL,Biology,12,HL,T100,
```

`enrolments.csv`

```
studentId,classId,from,to
S2001,C-BIO12,2026-08-12,
```

With CSVs there is no `school` block: the school year is taken from today's date and ended class places
get today's date. A full test set is in `src/imports/fixtures/roster/`.
