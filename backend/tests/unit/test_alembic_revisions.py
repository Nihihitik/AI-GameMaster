import ast
from pathlib import Path


def test_alembic_revision_ids_fit_version_table() -> None:
    for path in Path("alembic/versions").glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        revision = None
        for node in tree.body:
            if isinstance(node, ast.AnnAssign) and getattr(node.target, "id", None) == "revision":
                if isinstance(node.value, ast.Constant):
                    revision = node.value.value
                    break

        assert revision is not None, f"{path} has no revision id"
        assert len(revision) <= 32, f"{path} revision id is too long for alembic_version"
