from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match in {path}, found {count}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "src/components/cast/use-casting-controller.ts",
    '''    setState((current) => stateFromSnapshot(current, loaded.value));
''',
    '''    const snapshot = loaded.value;
    setState((current) => stateFromSnapshot(current, snapshot));
''',
)
replace_once(
    "src/server/services/casting-snapshot-service.test.ts",
    '''    expect(snapshot).toMatchObject({
''',
    '''    expect(snapshot).not.toBeNull();
    if (!snapshot) throw new Error("expected snapshot");
    expect(snapshot).toMatchObject({
''',
)

Path("scripts/fix-pr3-nullability.py").unlink()
Path(".github/workflows/fix-pr3-nullability.yml").unlink()
