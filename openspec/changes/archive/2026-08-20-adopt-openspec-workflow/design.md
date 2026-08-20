## Context

The project already carries five planning artifacts (Linear, ROADMAP.md, `docs/adr/`,
`docs/GLOSSARY.md`, `docs/capability-graph.md`), four of them enforced or generated.
Adding a sixth is only defensible if its boundary against the other five is stated
once and mechanically obvious afterwards. That boundary is ADR-0020; this document
covers the mechanics the ADR does not need to fix forever.

The constraint that shapes everything below: this is a solo project with one human
reviewer and an agent that ships several PRs a day. Ceremony that costs the human
attention per PR will be dropped within a week, and a workflow dropped silently is
worse than one never adopted.

## Goals / Non-Goals

**Goals:**

- A change folder exists for work where scope is genuinely uncertain, and is not
  required where it is not.
- Every artifact the workflow produces is validated by a command, not by review habit.
- `openspec/specs/` becomes the place where intended behaviour lives, incrementally,
  as changes land — never as a big-bang documentation project.

**Non-Goals:**

- Replacing ADRs, the capability graph or Linear. See ADR-0020.
- Enforcing a change folder on every commit.

## Decisions

### A change folder is required when scope is uncertain, not when the diff is large

The threshold is **whether the ticket's premise could be wrong**, because that is what
the proposal step actually catches. Phase 1 offers two worked examples: VKB-113
proposed a `SKIP_MIGRATIONS` flag that could not work (a database-less build has no
env config to set a flag in), and VKB-137 was framed around a client seeing a 500 when
no client exists on that path. Both were caught while reading code, after the branch
was cut. A proposal is where that belongs.

So: a change folder is required when the ticket adds or changes product behaviour, or
when the implementer cannot state the acceptance criteria without reading code first.
It is not required for a dependency bump, a formatting pass, a docs edit, or a
mechanical refactor whose acceptance is "behaviour is identical" — those are already
covered by the extraction-first rule and by the checks.

Rejected: "every ticket gets a change folder". It converts the proposal from a
thinking tool into a form to fill in, and forms get filled in without thinking.

### Specs accrete; they are never backfilled in bulk

A capability gets a spec the first time a change touches it. This is slower to full
coverage than a documentation sprint, but every spec written this way is written by
someone who just read the code and had a reason to state the behaviour — which is the
difference between a spec and a description. `docs/capability-graph.md` already
answers "what exists"; `openspec/specs/` answers "what is it supposed to do", and only
for the parts someone has needed to pin.

### `skip_specs: true` is a legitimate answer, and is checked

The spec template warns against inventing a requirement to satisfy validation. A
tooling or docs change declares `skip_specs: true` and validation accepts it. The
marker is deliberate: it makes "this change has no behaviour" an explicit statement in
the change folder rather than an absence someone has to interpret.

### The gate ships as a script here and a CI step separately

`bun run spec:check` lands in `package.json` in this PR. The matching step in
`.github/workflows/ci.yml` cannot: the bot PAT lacks the `workflow` scope, so a branch
touching that path cannot be pushed by the agent. Splitting is not a preference — it
is the only route. The script existing here means the CI step is one line the owner
adds, not a change they have to design.

## Risks / Trade-offs

- **Ceremony decay.** The realistic failure mode is that change folders stop being
  written and nobody notices, because `openspec validate` only checks the changes that
  exist — it cannot know about a change that should have had a folder. This is
  accepted knowingly: the threshold above is deliberately narrow so that the folders
  which do get written are the ones that pay for themselves. If it decays anyway, that
  is evidence the threshold is still too wide, not that the tool failed.
- **The next phase barely exercises it, and that is the rule working.** Phase 2 is
  the layering epic: VKB-86 through 90 are behaviour-neutral by construction, so
  under the threshold above they correctly need no change folder. Only VKB-105
  (auth state onto Redis TTL, dropping the lazy sweeps) changes behaviour and
  should produce the first spec. That is a checkable prediction, not a hope — if
  Phase 2 ends with zero change folders including VKB-105, the threshold is being
  applied wrongly.
- **A sixth artifact to keep in sync.** Mitigated by the boundary in ADR-0020 and by
  the archive step advancing `specs/` atomically with the merge, so a merged change
  cannot leave its spec behind.
- **Empty `specs/` for a while.** Accepted. An empty directory that fills as work lands
  is honest; a directory filled in one sitting with prose nobody verified is the
  documentation equivalent of a passing test that pins nothing.
