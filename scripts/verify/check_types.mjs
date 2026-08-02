// Pack and install the package, then compile a strict TypeScript consumer against the
// installed declarations. Source-tree imports cannot catch missing files or export-map
// mistakes, which are the failures this release gate exists to expose.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const core = join(root, "packages/core");
const work = mkdtempSync(join(tmpdir(), "subsynth-types-"));
let tarball;

const run = (command, args, options = {}) => execFileSync(command, args, {
  timeout: 180_000,
  ...options,
});

try {
  run("npm", ["run", "build"], { cwd: core, stdio: "ignore" });
  const name = run("npm", ["pack", "--silent"], { cwd: core, encoding: "utf8" }).trim();
  tarball = join(core, name);
  writeFileSync(join(work, "package.json"), JSON.stringify({ name: "strict-consumer", private: true, type: "module" }));
  run("npm", ["install", "--no-audit", "--no-fund", "--silent", tarball], { cwd: work, stdio: "ignore" });
  writeFileSync(join(work, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      lib: ["ES2022", "DOM"],
      skipLibCheck: false,
    },
    include: ["consumer.ts"],
  }));
  writeFileSync(join(work, "consumer.ts"), `
import { ALGORITHM, PARAM, PARAMETERS, RATIOS, createEngine, type Engine, type ParamName } from "fm-synthesizers.js";
import { DEFAULTS, PRESETS, applyPreset, type Preset } from "fm-synthesizers.js/presets";

const name: ParamName = "op2Ratio";
const id: number = PARAM[name];
const ratioDefault: number = PARAMETERS.op2Ratio.default;
const ratioUnit: "ratio" = PARAMETERS.op2Ratio.unit;
const algorithm: 0 = ALGORITHM.mod1;
const ratio: 2 = RATIOS.two;
const preset: Preset = PRESETS["e-piano-fm"];
const defaults: Readonly<Record<ParamName, number>> = DEFAULTS;

async function play(): Promise<Engine> {
  const engine = await createEngine({ connect: false });
  engine.setParam(name, ratioDefault);
  applyPreset(engine, "e-piano-fm");
  engine.output.connect(engine.context.destination);
  return engine;
}

// @ts-expect-error unknown parameter names must not widen to string
PARAM.notAParameter;
// @ts-expect-error preset fields must use public parameter names
const invalid: Preset = { label: "x", group: "keys", blurb: "x", params: { nope: 1 } };
void [id, ratioUnit, algorithm, ratio, preset, defaults, play, invalid];
`);

  const tsc = join(root, "node_modules/typescript/bin/tsc");
  run(process.execPath, [tsc, "--project", join(work, "tsconfig.json")], { cwd: work, stdio: "inherit" });

  const installed = JSON.parse(readFileSync(join(work, "node_modules/fm-synthesizers.js/package.json"), "utf8"));
  console.log(`TYPE CONSUMER OK — strict TypeScript compiled against installed ${installed.name}@${installed.version}`);
} finally {
  if (tarball) rmSync(tarball, { force: true });
  rmSync(work, { recursive: true, force: true });
}
