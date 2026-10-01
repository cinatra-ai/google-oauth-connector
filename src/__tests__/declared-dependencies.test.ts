/**
 * Every package the shipped source imports must be declared in package.json.
 *
 * An undeclared import resolves today only through the host application's
 * hoisted node_modules, so it stays invisible until the package is installed
 * on its own — which is exactly what the host's phantom-dependency audit
 * reports. The host application supplies the React and Next runtime, so
 * framework packages are declared as peer dependencies (the shape the sibling
 * OAuth connectors use); everything the package brings itself sits in
 * dependencies.
 *
 * The specifiers are read with TypeScript's own pre-processor rather than a
 * regular expression, so comments, regular-expression literals, template
 * strings, `import()` and `require()` are all handled by the compiler.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { isBuiltin } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const manifest = JSON.parse(
  readFileSync(path.join(packageRoot, "package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

const SOURCE_FILE_RE = /\.(?:tsx?|mts|cts)$/;

/**
 * Everything the published tarball carries: package.json `files` ships `src`
 * minus `src/__tests__`, so the tests themselves (and their dev-only imports)
 * are out of scope, while any other nested directory is in scope.
 */
function shippedSourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        return path.relative(packageRoot, full) === path.join("src", "__tests__")
          ? []
          : shippedSourceFiles(full);
      }
      return SOURCE_FILE_RE.test(entry) ? [full] : [];
    });
}

function packageNameOf(specifier: string): string | null {
  // The host serves this exact virtual module; it has no registry dependency.
  // Keep subpaths and similarly named packages in the ordinary dependency check.
  if (specifier === "@cinatra-ai/design-primitives") return null;
  const segments = specifier.split("/");
  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0];
}

function importedPackages(): string[] {
  const imported = new Set<string>();
  for (const file of shippedSourceFiles(path.join(packageRoot, "src"))) {
    const source = readFileSync(file, "utf8");
    const { importedFiles } = ts.preProcessFile(source, true, true);
    for (const { fileName: specifier } of importedFiles) {
      // Relative paths and Node built-ins are never npm packages. Built-ins
      // are recognised by Node itself, so the bare form ("fs") counts too.
      if (specifier.startsWith(".") || isBuiltin(specifier)) continue;
      const name = packageNameOf(specifier);
      if (name !== null) imported.add(name);
    }
  }
  return [...imported].sort();
}

describe("declared dependencies", () => {
  it("excludes only the exact host-served virtual module from registry packages", () => {
    expect(packageNameOf("@cinatra-ai/design-primitives")).toBeNull();
    expect(packageNameOf("@cinatra-ai/design-primitives/button")).toBe("@cinatra-ai/design-primitives");
    expect(packageNameOf("@cinatra-ai/design-primitives-other")).toBe("@cinatra-ai/design-primitives-other");
    expect(packageNameOf("next/cache")).toBe("next");
  });

  // Only the buckets that survive a production install: a package the shipped
  // source imports may never rest on a dev-only declaration.
  const declaredForRuntime = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);

  it("declares every package the shipped source imports", () => {
    const undeclared = importedPackages().filter(
      (name) => !declaredForRuntime.has(name),
    );
    expect(undeclared).toEqual([]);
  });

  it("sees the next import that motivated this test", () => {
    expect(importedPackages()).toContain("next");
  });

  it("declares next as a peer dependency, like the sibling connectors", () => {
    expect(Object.keys(manifest.peerDependencies ?? {})).toContain("next");
    expect(manifest.dependencies ?? {}).not.toHaveProperty("next");
  });

  it("gives next the caret range of the version the host application pins", () => {
    expect(manifest.peerDependencies?.next).toBe("^16.2.10");
  });

  it("keeps next a required peer, not an optional one", () => {
    // An optional peer is not installed, so the import would go back to
    // resolving through the host application only — the defect this fixes.
    expect(manifest.peerDependenciesMeta?.next?.optional).not.toBe(true);
  });
});
