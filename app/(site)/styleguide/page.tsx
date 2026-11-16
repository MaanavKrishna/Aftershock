import type { Metadata } from "next";
import { Button, ButtonLink, IconButton } from "@/components/ui/Button";
import { Card, CardBody, CardHead, Stat } from "@/components/ui/Card";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Badge, EmptyState, Kbd, PageHeader, Skeleton, Tooltip } from "@/components/ui/Feedback";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { Pill } from "@/components/ui/Pill";
import { Segmented, Tabs } from "@/components/ui/Tabs";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { Verdict, VERDICTS, type VerdictKind } from "@/components/ui/Verdict";
import * as I from "@/components/ui/icons";

export const metadata: Metadata = { title: "Styleguide", robots: { index: false, follow: false } };

const SURFACES = ["canvas", "s1", "s2", "s3", "sunken"];
const TEXT = ["fg", "fg-2", "fg-3"];
const LINES = ["border", "border-strong", "field"];
const STATUS = ["signal", "proven", "recur", "safe", "inconclusive", "flaky"];
const TYPE: [string, string][] = [
  ["text-display-1", "Display 1"],
  ["text-display-2", "Display 2"],
  ["text-title-1", "Title 1"],
  ["text-title-2", "Title 2"],
  ["text-title-3", "Title 3"],
  ["text-lede", "Lede: introductions on marketing pages"],
  ["text-body", "Body: marketing text, 15 on 22"],
  ["text-ui", "UI: app text, 14 on 20, figures 0123456789"],
  ["text-callout", "Callout: labels and secondary text"],
  ["text-caption", "Caption: metadata and hints"],
];
const ICONS = Object.entries(I).filter(([, v]) => typeof v === "function") as [string, (p: { size?: number }) => React.ReactNode][];

function Swatches({ names }: { names: string[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3">
      {names.map((c) => (
        <div key={c} className="flex flex-col gap-2">
          <span className="h-14 rounded-control border border-border" style={{ background: `var(--color-${c})` }} />
          <span className="font-mono text-caption text-fg-2">{c}</span>
        </div>
      ))}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-border pt-10">
      <h2 className="m-0 text-title-2 font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

/** Every token and primitive of Fault Line in one place. Checked for accessibility in both themes by the e2e suite. */
export default function Styleguide() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-4">
        <Badge tone="signal">Design system</Badge>
        <h1 className="m-0 text-display-2 font-semibold text-fg">Fault Line</h1>
        <p className="m-0 max-w-[62ch] text-lede text-fg-2">Quiet surfaces, one instrument. Colour is kept for verdicts, blue means you can act on it, and motion only ever confirms a change.</p>
      </div>

      <Group title="Colour">
        <h3 className="m-0 text-callout font-medium text-fg-3">Surfaces</h3>
        <Swatches names={SURFACES} />
        <h3 className="m-0 text-callout font-medium text-fg-3">Text and lines</h3>
        <Swatches names={[...TEXT, ...LINES]} />
        <h3 className="m-0 text-callout font-medium text-fg-3">Signal and verdicts</h3>
        <Swatches names={STATUS} />
      </Group>

      <Group title="Type">
        <div className="flex flex-col gap-3">
          {TYPE.map(([cls, label]) => (
            <p key={cls} className={`m-0 ${cls} ${cls.includes("display") || cls.includes("title") ? "font-semibold text-fg" : "text-fg-2"}`}>
              {label}
            </p>
          ))}
          <p className="m-0 font-mono text-callout text-fg">Geist Mono: 3f2a1c9 → aa86f56 tests/aftershock/test_inc_12.py</p>
        </div>
      </Group>

      <Group title="Verdicts">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(VERDICTS) as VerdictKind[]).map((k) => (
            <Verdict key={k} kind={k} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone="neutral">12 tests</Pill>
          <Pill tone="signal">Labs</Pill>
          <Pill tone="dashed">Draft</Pill>
          <Badge>v0.2.2</Badge>
          <Badge tone="outline">Team</Badge>
        </div>
      </Group>

      <Group title="Actions">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="dangerOutline">Delete</Button>
          <Button disabled>Disabled</Button>
          <ButtonLink href="/styleguide" size="sm" variant="secondary">
            Small link <I.ArrowRight size={14} />
          </ButtonLink>
          <IconButton label="Search">
            <I.Search size={18} />
          </IconButton>
          <Tooltip id="sg-tip" tip="Runs every memory test">
            <Button variant="secondary" size="sm">
              Hover or focus me
            </Button>
          </Tooltip>
        </div>
        <p className="m-0 flex items-center gap-2 text-callout text-fg-3">
          Open the command palette with <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </p>
      </Group>

      <Group title="Forms">
        <form className="grid max-w-[720px] gap-4 sm:grid-cols-2" action="/styleguide">
          <TextField label="Incident title" name="title" placeholder="Duplicate charge on retry" hint="What broke, in a few words." />
          <TextField label="Fix commit" name="sha" mono error="That commit isn't on the default branch." defaultValue="3f2a1c9" />
          <SelectField label="Repository" name="repo" defaultValue="api">
            <option value="api">acme/api</option>
            <option value="web">acme/web</option>
          </SelectField>
          <div className="flex flex-col gap-1.5">
            <span className="text-callout font-medium text-fg">Check mode</span>
            <Segmented name="mode" label="Check mode" value="enforce" options={[{ value: "advise", label: "Advise" }, { value: "enforce", label: "Enforce" }]} />
          </div>
          <TextArea label="What happened" name="observed" className="sm:col-span-2" />
        </form>
      </Group>

      <Group title="Surfaces and data">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardBody>
              <Stat label="Proof rate" value="92%" hint="Last 30 days" tone="proven" />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat label="Recurrences blocked" value="14" />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </CardBody>
          </Card>
        </div>
        <Tabs label="Example tabs" items={[{ href: "/styleguide", label: "Overview", active: true }, { href: "/styleguide#forms", label: "Tests", active: false, count: 12 }, { href: "/styleguide#data", label: "Runs", active: false }]} />
        <Table label="Example memory tests">
          <THead>
            <tr>
              <Th>Test</Th>
              <Th>Incident</Th>
              <Th sort="descending">Last run</Th>
              <Th>Status</Th>
            </tr>
          </THead>
          <tbody>
            <Tr>
              <Td className="font-mono text-callout text-fg">test_retry_is_rejected</Td>
              <Td>INC-12</Td>
              <Td>2h ago</Td>
              <Td><Verdict kind="healthy" size="sm" /></Td>
            </Tr>
            <Tr>
              <Td className="font-mono text-callout text-fg">test_cache_key_includes_locale</Td>
              <Td>INC-9</Td>
              <Td>2h ago</Td>
              <Td><Verdict kind="flaky" size="sm" /></Td>
            </Tr>
          </tbody>
        </Table>
        <Card>
          <CardHead sub="Shown when a list is empty">Empty state</CardHead>
          <CardBody>
            <EmptyState title="No incidents yet" icon={<I.Wave size={18} />} action={<ButtonLink href="/styleguide" size="sm">Record an incident</ButtonLink>}>
              Label a GitHub issue <span className="font-mono">incident</span> or paste a postmortem, and it will appear here.
            </EmptyState>
          </CardBody>
        </Card>
        <div className="glass rounded-card border border-border p-5">
          <PageHeader eyebrow="Material" title="Glass header" sub="Canvas at 72% with a 20px blur. Solid when transparency is reduced." />
        </div>
      </Group>

      <Group title="Code">
        <CodeBlock file="tests/aftershock/test_inc_12.py" mark={[3]} code={`def test_retry_is_rejected(client, order):\n    client.post("/payments", json={"order_id": order.id})\n    assert client.post("/payments", json={"order_id": order.id}).status_code == 400`} />
      </Group>

      <Group title="Mark and icons">
        <div className="flex flex-wrap items-center gap-4">
          <Wordmark />
          <LogoMark size={40} accent />
          <LogoMark size={40} inverted />
        </div>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 p-0">
          {ICONS.map(([name, Icon]) => (
            <li key={name} className="flex flex-col items-center gap-2 rounded-control border border-border-soft py-3 text-fg-2">
              <Icon size={20} />
              <span className="font-mono text-caption text-fg-3">{name}</span>
            </li>
          ))}
        </ul>
      </Group>
    </div>
  );
}
