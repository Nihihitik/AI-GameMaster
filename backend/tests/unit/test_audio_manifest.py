import json

from services import audio_manifest
from services.narration_audio import resolve_step


def test_default_manifest_path_prefers_backend_root_for_docker_layout(tmp_path) -> None:
    app_root = tmp_path / "app"
    services_dir = app_root / "services"
    services_dir.mkdir(parents=True)
    manifest = app_root / "audio_manifest.json"
    manifest.write_text("{}", encoding="utf-8")

    resolved = audio_manifest._default_manifest_path(services_dir / "audio_manifest.py")

    assert resolved == manifest


def test_default_manifest_path_falls_back_to_project_root_for_local_layout(tmp_path) -> None:
    repo_root = tmp_path / "AI-GameMaster"
    services_dir = repo_root / "backend" / "services"
    services_dir.mkdir(parents=True)
    manifest = repo_root / "audio_manifest.json"
    manifest.write_text("{}", encoding="utf-8")

    resolved = audio_manifest._default_manifest_path(services_dir / "audio_manifest.py")

    assert resolved == manifest


def test_default_manifest_path_skips_empty_backend_manifest(tmp_path) -> None:
    repo_root = tmp_path / "AI-GameMaster"
    services_dir = repo_root / "backend" / "services"
    services_dir.mkdir(parents=True)
    empty_backend_manifest = repo_root / "backend" / "audio_manifest.json"
    empty_backend_manifest.write_text("", encoding="utf-8")
    manifest = repo_root / "audio_manifest.json"
    manifest.write_text("{}", encoding="utf-8")

    resolved = audio_manifest._default_manifest_path(services_dir / "audio_manifest.py")

    assert resolved == manifest


def test_env_manifest_path_is_used_for_audio_resolution(tmp_path, monkeypatch) -> None:
    manifest = tmp_path / "voice.json"
    manifest.write_text(
        json.dumps(
            {
                "version": "test",
                "names": [],
                "triggers": {
                    "rules": {
                        "kind": "variant",
                        "variants": [
                            {
                                "audio_url": "/audio/rules.mp3",
                                "duration_ms": 1234,
                                "text": "Правила игры.",
                                "file_name": "rules.mp3",
                            }
                        ],
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("AUDIO_MANIFEST_PATH", str(manifest))
    audio_manifest.reload_manifest()

    try:
        resolved = resolve_step({"key": "rules:1", "trigger": "rules", "text": "fallback"})

        assert resolved["audio_url"] == "/audio/rules.mp3"
        assert resolved["duration_ms"] == 1234
        assert resolved["text"] == "Правила игры."
    finally:
        monkeypatch.delenv("AUDIO_MANIFEST_PATH", raising=False)
        audio_manifest.reload_manifest()
