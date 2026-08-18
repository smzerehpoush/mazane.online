from __future__ import annotations

import ast
import json
import pathlib
import sys

PLATFORM_FIELDS = (
    "slug",
    "name_fa",
    "data_policy",
    "market_model",
    "name_en",
    "website_url",
    "legal_entity",
    "founded_year_jalali",
    "delivery_note_fa",
)
PLATFORM_DEFAULTS: dict[str, object] = {"market_model": "OTC"}

INSTRUMENT_FIELDS = ("slug", "instrument", "name_fa", "unit_fa", "purity", "currency")


def literal(node: ast.expr) -> object:
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Attribute):
        return node.attr
    raise SystemExit(f"unexpected registry value: {ast.dump(node)}")


def module_of(path: pathlib.Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def assigned_value(module: ast.Module, name: str) -> ast.expr:
    for node in module.body:
        targets = (
            [node.target]
            if isinstance(node, ast.AnnAssign)
            else node.targets
            if isinstance(node, ast.Assign)
            else []
        )
        for target in targets:
            if isinstance(target, ast.Name) and target.id == name:
                if node.value is None:
                    raise SystemExit(f"{name} has no value")
                return node.value
    raise SystemExit(f"{name} was not found in the module")


def calls_in(node: ast.expr) -> list[ast.Call]:
    if not isinstance(node, (ast.Tuple, ast.List)):
        raise SystemExit("registry is not a tuple/list")
    return [item for item in node.elts if isinstance(item, ast.Call)]


def entries(call: ast.Call, fields: tuple[str, ...], defaults: dict[str, object]) -> dict:
    given = {kw.arg: literal(kw.value) for kw in call.keywords if kw.arg is not None}
    return {field: given.get(field, defaults.get(field)) for field in fields}


def model_fields(module: ast.Module, class_name: str) -> list[str]:
    for node in ast.walk(module):
        if not isinstance(node, ast.ClassDef) or node.name != class_name:
            continue
        return [
            statement.target.id
            for statement in node.body
            if isinstance(statement, ast.AnnAssign)
            and isinstance(statement.target, ast.Name)
            and statement.target.id != "model_config"
        ]
    raise SystemExit(f"{class_name} was not found in models.py")


def adapter_instruments(adapters_dir: pathlib.Path) -> dict[str, list[str]]:
    emitted: dict[str, list[str]] = {}
    for path in sorted(adapters_dir.glob("*.py")):
        module = module_of(path)
        for node in ast.walk(module):
            if not isinstance(node, ast.ClassDef):
                continue
            slug: str | None = None
            instruments: list[str] | None = None
            for statement in node.body:
                if not isinstance(statement, (ast.Assign, ast.AnnAssign)):
                    continue
                targets = (
                    [statement.target]
                    if isinstance(statement, ast.AnnAssign)
                    else statement.targets
                )
                names = [t.id for t in targets if isinstance(t, ast.Name)]
                if statement.value is None:
                    continue
                if "slug" in names and isinstance(statement.value, ast.Constant):
                    slug = str(statement.value.value)
                if "instruments" in names and isinstance(
                    statement.value, (ast.Tuple, ast.List)
                ):
                    instruments = [str(literal(item)) for item in statement.value.elts]
            if slug is not None and instruments is not None:
                emitted[slug] = instruments
    return emitted


def main() -> None:
    root = pathlib.Path(sys.argv[1])
    platforms_module = module_of(root / "platforms.py")
    instruments_module = module_of(root / "instruments.py")
    slugs_module = module_of(root / "slugs.py")
    models_module = module_of(root / "models.py")

    reserved = assigned_value(slugs_module, "RESERVED_WORDS")
    static_pages = assigned_value(slugs_module, "STATIC_PAGE_SLUGS")

    payload = {
        "platforms": [
            entries(call, PLATFORM_FIELDS, PLATFORM_DEFAULTS)
            for call in calls_in(assigned_value(platforms_module, "PLATFORMS"))
        ],
        "instruments": [
            entries(call, INSTRUMENT_FIELDS, {})
            for call in calls_in(assigned_value(instruments_module, "INSTRUMENTS"))
        ],
        "platform_model_fields": model_fields(models_module, "Platform"),
        "platform_profile_fields": model_fields(models_module, "PlatformProfile"),
        "adapters": adapter_instruments(root / "adapters"),
        "publish_gate_min_platforms": literal(
            assigned_value(instruments_module, "PUBLISH_GATE_MIN_PLATFORMS")
        ),
        "reserved_words": sorted(
            str(literal(item))
            for item in (
                reserved.args[0].elts
                if isinstance(reserved, ast.Call)
                else reserved.elts  # type: ignore[union-attr]
            )
        ),
        "static_page_slugs": [
            str(literal(item))
            for item in static_pages.elts  # type: ignore[union-attr]
        ],
    }
    json.dump(payload, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
