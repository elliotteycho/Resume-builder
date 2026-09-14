# Local setup — generate resumes into a folder on your machine

One-time setup, then every resume builds locally with one command. No downloads, no cloud.

This repo is **public**: personal content (the experience bank and tailored resume JSONs) is
git-ignored and must never be committed. Code lives in git; your data lives only on your machine.

## One-time setup

```bash
git clone https://github.com/elliotteycho/Resume-builder.git
cd Resume-builder
npm install
mkdir -p data/resumes
```

Then put your personal files in place (they arrive from Claude as file cards / a zip, never via git):

- `data/experience-bank.json` — the evidence bank (restore from your backup)
- `data/resumes/*-resume.json` — one JSON per tailored resume

## Build every resume

```bash
npm run resumes
```

All `data/resumes/*-resume.json` files render to `resumes/ElliottCho_<Company>_Resume.docx`
in the canonical layout (see `docs/RESUME_LAYOUT_SPEC.md`).

To build into a different folder (for example one synced by Google Drive for desktop):

```bash
node scripts/build-all-resumes.js data/resumes "$HOME/Google Drive/PM Internship Resumes"
```

## Build a single resume

```bash
node scripts/build-resume-docx.js data/resumes/pwc-resume.json resumes/ElliottCho_PwC_Resume.docx
```

## Ongoing flow

1. Claude tailors a new resume and sends the `<company>-resume.json` file card.
2. Save it into `data/resumes/`.
3. `npm run resumes` — the .docx appears in your folder, byte-exact, no manual download of the docx itself.

## Run the full web app locally (optional)

The Next.js app (JD analysis, 4-agent research, generation, verification) runs with:

```bash
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```
