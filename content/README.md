# Content — chapters & problems

Everything the judge shows lives in this folder. No code changes are needed to
add a problem or a chapter; drop in a JSON file and refresh.

## Layout

```
content/
  01-ori-2026/                  <- a chapter (folder)
    chapter.json                <- the chapter's name
    01-hora-cifrelor.json       <- a problem
    02-reducere-binara.json
    03-mostenirea-lui-amenka.json
    ...
```

**The `NN-` prefix controls ordering only.** Chapters are sorted by folder
name, problems by file name, and the prefix is stripped from the URL. So
`01-hora-cifrelor.json` is served at `/problem/hora-cifrelor`.

## Adding a chapter

Make a folder, and put a `chapter.json` in it:

```json
{
  "title": "Recursivitate",
  "description": "Probleme care se rezolvă cu funcții recursive."
}
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Shown as the chapter heading |
| `description` | no | Small grey line under the heading; omit it if you don't want one |
| `links` | no | Documents that apply to the whole chapter, shown as links under the heading |

Each entry in `links` needs a `label` and an `href`. Use it for things like the
contest's general problem description — put the file in `public/` and point at
it with a leading slash:

```json
{
  "title": "ORI 2026, clasa IX",
  "links": [
    { "label": "Descrierea generală — Ziua 1", "href": "/descriere-z1.pdf" }
  ]
}
```

To put the chapter third in the list, name the folder `03-recursivitate`.

## Adding a problem

Make a `.json` file inside a chapter folder:

```json
{
  "title": "Suma a Doua Numere",
  "statement": "Se citesc două numere întregi. Afișați suma lor.",
  "testCases": [
    {
      "id": 1,
      "name": "Test 1",
      "description": "Exemplu din enunț",
      "input": "3 4\n",
      "expectedOutput": "7"
    },
    {
      "id": 2,
      "name": "Test 2",
      "description": "Numere negative",
      "input": "-5 2\n",
      "expectedOutput": "-3"
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Also becomes the URL: `Suma a Doua Numere` → `/problem/suma-a-doua-numere` |
| `statement` | yes | Plain text. Bare URLs are auto-linked, and raw HTML works if you need a link with custom text |
| `testCases` | yes | At least one |

Each test case:

| Field | Required | Notes |
|---|---|---|
| `id` | yes | A number, unique within the problem. Controls result ordering |
| `name` | yes | Shown on the result row |
| `description` | no | Not currently displayed; useful as a note to yourself |
| `input` | yes | Fed to the program's stdin. Use `""` for no input |
| `expectedOutput` | yes | Compared against stdout after trimming leading/trailing whitespace |
| `timeoutMs` | no | Currently unused — Judge0 applies its own limit |

### Things worth knowing

- **`\n` in JSON is a real newline.** `"input": "5\n-2 4\n"` sends two lines.
  Multi-line input is usually easier to read written this way than as one long
  string.
- **Output comparison trims the ends but nothing else.** A trailing newline in
  `expectedOutput` does not matter; a missing space in the middle of a line
  does.
- **Titles must be unique across every chapter,** because the title becomes the
  URL. Two problems both called "Bilete" is an error, and the app will tell you
  which two collided rather than silently judging against the wrong tests.
- **Linking a PDF statement:** put the file in `public/` and reference it from
  the statement:
  `"statement": "Enunțul: <a href=\"/enunt.pdf\" target=\"_blank\">PDF</a>"`

## Checking your work

Mistakes fail loudly, naming the file and the field:

```
Invalid content in .../content/01-ori-2026/01-hora-cifrelor.json:
  testCases[3].expectedOutput must be a string
```

Run `npm run build` to check everything at once. In `npm run dev`, content is
re-read on every request, so editing a JSON file and refreshing is enough.

## Adding a problem to Vercel

Content is read at request time by the judging API, so `content/**/*.json` is
listed in `outputFileTracingIncludes` in `next.config.ts`. If you ever move
this folder, update that path too or submissions will 404 in production while
working fine locally.
